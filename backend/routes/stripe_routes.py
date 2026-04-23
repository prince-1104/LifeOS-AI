"""
Cashfree Payments integration: Subscriptions, Webhooks, and Status.

Replaces Stripe with Cashfree for native INR subscription billing in India.

Cashfree Subscription API flow:
  1. Create Plan (one-time, matches our plan tiers)
  2. Create Subscription → returns authorization link
  3. Customer authorizes mandate (UPI Autopay / eNACH / Card SI)
  4. Cashfree auto-charges on each cycle
  5. Webhooks notify us of payment events

Endpoints:
  POST /payments/create-subscription  — initiate subscription + get auth link
  POST /payments/webhook              — handle Cashfree webhook events
  GET  /subscription/status           — current plan + usage snapshot
  GET  /subscription/plans            — all plans for pricing page
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth.deps import get_authenticated_user_id
from config import get_settings
from db.models import DailyUsage, User, PromoCode, PromoCodeUsage, PromoCode, PromoCodeUsage
from db.postgres import get_db
from plans import (
    PLANS,
    get_all_plans,
    get_plan,
)
from services.subscription_service import get_monthly_cost

logger = logging.getLogger(__name__)
router = APIRouter(tags=["payments"])

# ── Cashfree API base URLs ────────────────────────────────────────────
CASHFREE_SANDBOX = "https://sandbox.cashfree.com/pg"
CASHFREE_PROD = "https://api.cashfree.com/pg"
CASHFREE_API_VERSION = "2025-01-01"


# ═══════════════════════════════════════════════════════════════════════
#  REQUEST / RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════


class CreateSubscriptionRequest(BaseModel):
    plan_id: str  # e.g. "basic_29"
    billing_cycle: str = "monthly"  # "monthly" | "yearly"
    return_url: str = "https://app.example.com/billing?status=success"
    promo_code: str | None = None

class ValidatePromoRequest(BaseModel):
    promo_code: str
    plan_id: str | None = None
    billing_cycle: str = "monthly"

class ValidatePromoResponse(BaseModel):
    valid: bool
    discount_percent: int = 0
    final_amount_inr: float = 0.0
    message: str = ""
    applicable_plans: list[str] = []


class CreateSubscriptionResponse(BaseModel):
    subscription_id: str
    authorization_link: str  # redirect user here to authorize mandate
    payment_session_id: str = ""  # for Cashfree JS SDK checkout
    cashfree_env: str = "sandbox"  # "sandbox" or "production" — frontend SDK needs this


class PlanInfo(BaseModel):
    name: str
    display_name: str
    price_inr_monthly: int
    price_inr_yearly: int
    daily_requests: int
    memory_writes_per_day: int
    memory_storage_limit: int
    reminders_per_day: int
    voice_input: bool
    premium_tts: bool
    long_term_reminder: bool


class UsageSnapshot(BaseModel):
    requests_today: int
    memory_writes_today: int
    reminders_today: int
    monthly_cost_inr: float


class SubscriptionStatusResponse(BaseModel):
    plan: PlanInfo
    usage: UsageSnapshot
    plan_start_date: str | None
    plan_end_date: str | None
    is_active: bool
    cashfree_subscription_id: str | None


# ═══════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════


def _cashfree_base_url() -> str:
    """Return sandbox or production URL based on config."""
    settings = get_settings()
    if settings.CASHFREE_ENV == "production":
        return CASHFREE_PROD
    return CASHFREE_SANDBOX


def _cashfree_headers() -> dict:
    """Standard headers for Cashfree API calls."""
    settings = get_settings()
    if not settings.CASHFREE_CLIENT_ID or not settings.CASHFREE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cashfree payment gateway is not configured",
        )
    return {
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": settings.CASHFREE_CLIENT_ID.strip(),
        "x-client-secret": settings.CASHFREE_CLIENT_SECRET.strip(),
    }


def _get_plan_price(plan_name: str, billing_cycle: str) -> int:
    """Return the INR price for the given plan and cycle."""
    plan = PLANS.get(plan_name)
    if not plan or plan.price_inr_monthly == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan: {plan_name}",
        )
    if billing_cycle == "yearly":
        return plan.price_inr_yearly
    return plan.price_inr_monthly


# ═══════════════════════════════════════════════════════════════════════
#  CREATE PAYMENT ORDER  (uses Cashfree Orders API — universally available)
# ═══════════════════════════════════════════════════════════════════════


@router.post("/payments/validate-promo", response_model=ValidatePromoResponse)
async def validate_promo(
    req: ValidatePromoRequest,
    db: AsyncSession = Depends(get_db)
):
    promo_code_str = req.promo_code.strip().upper()
    result = await db.execute(select(PromoCode).where(func.upper(PromoCode.code) == promo_code_str))
    promo = result.scalars().first()

    if not promo:
        return ValidatePromoResponse(valid=False, message="Invalid promo code")
    if promo.is_active == 0:
        return ValidatePromoResponse(valid=False, message="Promo code is inactive")
    if promo.max_uses and promo.times_used >= promo.max_uses:
        return ValidatePromoResponse(valid=False, message="Promo code usage limit reached")
    if promo.expires_at and promo.expires_at < datetime.now(timezone.utc):
        return ValidatePromoResponse(valid=False, message="Promo code expired")

    allowed_plans = [p.strip() for p in promo.applicable_plans.split(",") if p.strip()] if promo.applicable_plans else []

    final_amount = 0.0
    if req.plan_id:
        plan = PLANS.get(req.plan_id)
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
        if req.billing_cycle not in ["monthly", "yearly"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing cycle")

        base_price = plan.price_inr_monthly if req.billing_cycle == "monthly" else plan.price_inr_yearly
        if base_price == 0:
            return ValidatePromoResponse(valid=False, message="Plan is free. Promo code not needed.")
            
        if promo.min_amount and base_price < promo.min_amount:
            return ValidatePromoResponse(valid=False, message=f"Order amount is too low for this promo code (min ₹{promo.min_amount})")
        
        if allowed_plans and req.plan_id not in allowed_plans:
            return ValidatePromoResponse(valid=False, message="Promo code is not applicable to this plan")

        discount_amount = (base_price * promo.discount_percent) / 100.0
        final_amount = max(0.0, base_price - discount_amount)

    return ValidatePromoResponse(
        valid=True,
        discount_percent=promo.discount_percent,
        final_amount_inr=final_amount,
        message=f"Success! {promo.discount_percent}% applied.",
        applicable_plans=allowed_plans
    )

@router.post("/payments/create-subscription", response_model=CreateSubscriptionResponse)
async def create_subscription(
    req: CreateSubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    """
    Create a Cashfree payment order for the selected plan.

    Uses the Orders API (/pg/orders) which is universally available,
    unlike the Subscriptions API which requires special activation.

    Flow:
    1. Create an order on Cashfree
    2. Return the payment link for the customer to pay
    3. Webhook confirms payment → activate plan
    """
    import re
    import uuid

    plan = PLANS.get(req.plan_id)
    if not plan or plan.name == "free":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan: {req.plan_id}",
        )

    # Fetch user details
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        base_url = _cashfree_base_url()
        headers = _cashfree_headers()
        base_price = _get_plan_price(req.plan_id, req.billing_cycle)
        
        final_amount = float(base_price)
        applied_promo = None
        discount_amount = 0.0

        if req.promo_code:
            promo_code_str = req.promo_code.strip().upper()
            result = await db.execute(select(PromoCode).where(func.upper(PromoCode.code) == promo_code_str))
            promo = result.scalars().first()
            if promo and promo.is_active == 1:
                # Validate promo
                valid = True
                if promo.max_uses and promo.times_used >= promo.max_uses:
                    valid = False
                if promo.expires_at and promo.expires_at < datetime.now(timezone.utc):
                    valid = False
                if promo.min_amount and base_price < promo.min_amount:
                    valid = False
                if promo.applicable_plans:
                    allowed_plans = [p.strip() for p in promo.applicable_plans.split(",")]
                    if req.plan_id not in allowed_plans:
                        valid = False
                
                # Check user usage
                if valid:
                    usage_check = await db.execute(
                        select(PromoCodeUsage).where(
                            PromoCodeUsage.promo_code_id == promo.id,
                            PromoCodeUsage.user_id == user_id
                        )
                    )
                    if usage_check.scalars().first():
                        valid = False
                        print(f"User {user_id} already used promo {promo.code}")

                if valid:
                    discount_amount = (base_price * promo.discount_percent) / 100.0
                    final_amount = max(0.0, base_price - discount_amount)
                    applied_promo = promo

        if final_amount < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Final amount after discount must be at least ₹1",
            )
        
        # Ensure order amount is correctly formatted (two decimal places)
        price = round(final_amount, 2)

        # Generate unique order ID
        order_id = f"order_{user_id[:8]}_{uuid.uuid4().hex[:8]}"

        # Clean phone to exactly 10 digits
        phone = user.phone or ""
        clean_phone = re.sub(r'\D', '', phone)
        if len(clean_phone) > 10:
            clean_phone = clean_phone[-10:]
        if len(clean_phone) < 10:
            clean_phone = "9999999999"

        return_url = req.return_url or "https://cortexa.doptonin.online/billing"

        order_payload = {
            "order_id": order_id,
            "order_amount": float(price),
            "order_currency": "INR",
            "customer_details": {
                "customer_id": re.sub(r'[^a-zA-Z0-9_\-.]', '', user_id[:50]) or "user",
                "customer_phone": clean_phone,
                "customer_email": user.email or "user@example.com",
                "customer_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or "User",
            },
            "order_meta": {
                "return_url": f"{return_url}?status=success&order_id={order_id}",
            },
            "order_note": f"Plan: {plan.display_name} ({req.billing_cycle})",
            "order_tags": {
                "app_user_id": user_id,
                "plan_name": plan.name,
                "billing_cycle": req.billing_cycle,
            },
        }

        print(f"[CASHFREE] Create order payload: {order_payload}", flush=True)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/orders",
                headers=headers,
                json=order_payload,
            )
            print(f"[CASHFREE] Create order response: {resp.status_code} {resp.text[:1000]}", flush=True)

            if resp.status_code not in (200, 201):
                full_resp = resp.text[:500]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cashfree order error: {full_resp}",
                )

            order_data = resp.json()

            # Get the payment link — Cashfree returns it in different places
            payment_link = (
                order_data.get("payment_link")
                or order_data.get("payments", {}).get("url")
                or ""
            )

            session_id = order_data.get("payment_session_id", "")

        # Save order ID to user record for webhook matching
        user.stripe_subscription_id = order_id  # reusing column for cashfree order id
        
        # Persist promo usage if applicable
        if applied_promo:
            applied_promo.times_used += 1
            promo_usage = PromoCodeUsage(
                promo_code_id=applied_promo.id,
                user_id=user_id,
                order_id=order_id,
                discount_amount=discount_amount
            )
            db.add(promo_usage)

        await db.commit()

        return CreateSubscriptionResponse(
            subscription_id=order_id,
            authorization_link=payment_link,
            payment_session_id=session_id,
            cashfree_env=get_settings().CASHFREE_ENV or "sandbox",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[CASHFREE] UNEXPECTED ERROR: {str(e)}", flush=True)
        import traceback; traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment setup failed: {str(e)}",
        )


def _extract_cashfree_error(resp: httpx.Response, default: str) -> str:
    """Extract the most useful error message from a Cashfree API error response."""
    try:
        data = resp.json()
        return (
            data.get("message")
            or data.get("detail")
            or data.get("error", {}).get("message")
            or str(data)
        )
    except Exception:
        return f"{default} (HTTP {resp.status_code})"


# ═══════════════════════════════════════════════════════════════════════
#  WEBHOOK
# ═══════════════════════════════════════════════════════════════════════


@router.post("/payments/webhook")
async def cashfree_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Cashfree webhook notifications.

    Events handled:
    - PAYMENT_SUCCESS_WEBHOOK → payment completed, activate plan
    - ORDER_PAID → order payment confirmed
    - SUBSCRIPTION_* → legacy subscription events (kept for compatibility)
    """
    settings = get_settings()
    payload = await request.body()
    payload_str = payload.decode("utf-8")

    # ── Signature verification ────────────────────────────────────────
    if settings.CASHFREE_WEBHOOK_SECRET:
        import base64
        signature = request.headers.get("x-webhook-signature") or request.headers.get("x-cashfree-signature", "")
        ts = request.headers.get("x-webhook-timestamp", "")
        
        # In Cashfree V3, signature is base64 of HMAC SHA256 of (timestamp + body)
        # In legacy, it's just base64 or hex of HMAC SHA256 of body
        message = (ts + payload_str).encode("utf-8") if ts else payload
        
        expected_digest = hmac.HMAC(
            settings.CASHFREE_WEBHOOK_SECRET.encode("utf-8"),
            message,
            hashlib.sha256,
        ).digest()
        
        expected_b64 = base64.b64encode(expected_digest).decode("utf-8")
        expected_hex = expected_digest.hex()
        
        if not hmac.compare_digest(signature, expected_b64) and not hmac.compare_digest(signature, expected_hex):
            # One more attempt for legacy signature without timestamp
            leg_msg = payload
            leg_digest = hmac.HMAC(
                settings.CASHFREE_WEBHOOK_SECRET.encode("utf-8"),
                leg_msg,
                hashlib.sha256,
            ).digest()
            if not hmac.compare_digest(signature, base64.b64encode(leg_digest).decode("utf-8")) and not hmac.compare_digest(signature, leg_digest.hex()):
                print(f"[CASHFREE] Webhook signature mismatch. Recv: {signature}", flush=True)
                raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        data = json.loads(payload_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("type") or data.get("event", "")
    event_data = data.get("data", {})

    print(f"[CASHFREE] Webhook received: {event_type}", flush=True)
    print(f"[CASHFREE] Webhook data: {json.dumps(event_data)[:500]}", flush=True)

    # Handle order-based payment events
    if event_type in ("PAYMENT_SUCCESS_WEBHOOK", "ORDER_PAID"):
        await _handle_order_paid(db, event_data)

    # Handle legacy subscription events
    elif event_type in ("SUBSCRIPTION_PAYMENT_CHARGED", "SUBSCRIPTION_NEW_PAYMENT_CHARGED"):
        await _handle_payment_charged(db, event_data)

    elif event_type == "SUBSCRIPTION_STATUS_CHANGED":
        await _handle_subscription_status_changed(db, event_data)

    return {"status": "ok"}


async def _handle_order_paid(db: AsyncSession, event_data: dict):
    """Handle successful order payment — activate/renew plan."""
    order = event_data.get("order", {})
    order_id = order.get("order_id", "")
    tags = order.get("order_tags", {})
    plan_name = tags.get("plan_name", "")
    billing_cycle = tags.get("billing_cycle", "monthly")

    if not order_id:
        print("[CASHFREE] Order paid webhook without order_id", flush=True)
        return

    # Find user by order ID (stored in stripe_subscription_id)
    stmt = select(User).where(User.stripe_subscription_id == order_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        # Also try via user_id from tags
        app_user_id = tags.get("app_user_id", "")
        if app_user_id:
            stmt2 = select(User).where(User.id == app_user_id)
            user = (await db.execute(stmt2)).scalar_one_or_none()

    if not user:
        print(f"[CASHFREE] No user found for order {order_id}", flush=True)
        return

    from dateutil.relativedelta import relativedelta
    now = datetime.now(timezone.utc)

    if plan_name and plan_name in PLANS:
        user.plan = plan_name
    user.plan_start_date = now

    if billing_cycle == "yearly":
        user.plan_end_date = now + relativedelta(years=1)
    else:
        user.plan_end_date = now + relativedelta(months=1)

    await db.commit()
    print(f"[CASHFREE] Plan '{user.plan}' activated for user {user.id} (order: {order_id})", flush=True)


async def _handle_payment_charged(db: AsyncSession, event_data: dict):
    """Handle successful subscription charge — activate/renew plan (legacy)."""
    subscription = event_data.get("subscription", {})
    sub_id = subscription.get("subscription_id", "")
    tags = subscription.get("subscription_tags", {})
    plan_name = tags.get("plan_name", "")

    if not sub_id:
        return

    stmt = select(User).where(User.stripe_subscription_id == sub_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        return

    now = datetime.now(timezone.utc)
    if plan_name and plan_name in PLANS:
        user.plan = plan_name
    if not user.plan_start_date:
        user.plan_start_date = now

    from dateutil.relativedelta import relativedelta
    billing_cycle = tags.get("billing_cycle", "monthly")
    if billing_cycle == "yearly":
        user.plan_end_date = now + relativedelta(years=1)
    else:
        user.plan_end_date = now + relativedelta(months=1)

    await db.commit()
    print(f"[CASHFREE] Subscription plan '{user.plan}' renewed for user {user.id}", flush=True)


async def _handle_subscription_status_changed(db: AsyncSession, event_data: dict):
    """Handle subscription lifecycle changes (legacy)."""
    subscription = event_data.get("subscription", {})
    sub_id = subscription.get("subscription_id", "")
    new_status = subscription.get("subscription_status", "")

    if not sub_id:
        return

    stmt = select(User).where(User.stripe_subscription_id == sub_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        return

    if new_status in ("CANCELLED", "EXPIRED", "COMPLETED"):
        user.plan = "free"
        user.plan_end_date = datetime.now(timezone.utc)
        await db.commit()

    elif new_status == "ACTIVE":
        tags = subscription.get("subscription_tags", {})
        plan_name = tags.get("plan_name", "")
        if plan_name and plan_name in PLANS:
            user.plan = plan_name
            user.plan_start_date = datetime.now(timezone.utc)
            await db.commit()


# ═══════════════════════════════════════════════════════════════════════
#  VERIFY ORDER (fallback when webhooks fail/delay)
# ═══════════════════════════════════════════════════════════════════════


class VerifyOrderRequest(BaseModel):
    order_id: str


class VerifyOrderResponse(BaseModel):
    status: str  # "PAID", "ACTIVE", "PENDING", "FAILED", etc.
    plan_activated: bool
    plan_name: str | None = None
    message: str = ""


@router.post("/payments/verify-order", response_model=VerifyOrderResponse)
async def verify_order(
    req: VerifyOrderRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    """
    Verify payment status directly with Cashfree and activate plan if paid.

    This is a CRITICAL fallback for when webhooks fail, are delayed, or have
    signature verification issues. The frontend calls this after payment
    completion to guarantee the user's plan gets activated.

    Flow:
    1. Check if the order belongs to this user
    2. Call Cashfree API to get order status
    3. If PAID → activate the plan in DB
    4. Return current status to frontend
    """
    order_id = req.order_id.strip()
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id is required")

    # Verify this order belongs to the requesting user
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.stripe_subscription_id != order_id:
        # Security: don't let users verify orders that aren't theirs
        raise HTTPException(status_code=403, detail="Order does not belong to this user")

    # Check if plan is already activated (avoid redundant API calls)
    if user.plan and user.plan != "free" and user.plan_end_date:
        from datetime import datetime, timezone as tz
        if user.plan_end_date > datetime.now(tz.utc):
            plan_config = get_plan(user.plan)
            return VerifyOrderResponse(
                status="PAID",
                plan_activated=True,
                plan_name=plan_config.display_name,
                message="Plan is already active",
            )

    # Call Cashfree API to verify order status
    try:
        base_url = _cashfree_base_url()
        headers = _cashfree_headers()

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{base_url}/orders/{order_id}",
                headers=headers,
            )

            print(f"[CASHFREE] Verify order {order_id}: {resp.status_code} {resp.text[:500]}", flush=True)

            if resp.status_code != 200:
                return VerifyOrderResponse(
                    status="UNKNOWN",
                    plan_activated=False,
                    message=f"Could not verify order (HTTP {resp.status_code})",
                )

            order_data = resp.json()
            order_status = order_data.get("order_status", "").upper()

            print(f"[CASHFREE] Order {order_id} status: {order_status}", flush=True)

            if order_status == "PAID":
                # Extract plan info from order tags
                tags = order_data.get("order_tags", {})
                plan_name = tags.get("plan_name", "")
                billing_cycle = tags.get("billing_cycle", "monthly")

                # Activate the plan
                from dateutil.relativedelta import relativedelta
                now = datetime.now(timezone.utc)

                if plan_name and plan_name in PLANS:
                    user.plan = plan_name
                user.plan_start_date = now

                if billing_cycle == "yearly":
                    user.plan_end_date = now + relativedelta(years=1)
                else:
                    user.plan_end_date = now + relativedelta(months=1)

                await db.commit()

                plan_config = get_plan(user.plan or "free")
                print(f"[CASHFREE] Plan '{user.plan}' activated via verify for user {user.id} (order: {order_id})", flush=True)

                return VerifyOrderResponse(
                    status="PAID",
                    plan_activated=True,
                    plan_name=plan_config.display_name,
                    message="Payment verified and plan activated!",
                )

            elif order_status in ("ACTIVE", "PENDING"):
                return VerifyOrderResponse(
                    status=order_status,
                    plan_activated=False,
                    message="Payment is still being processed. Please wait a moment.",
                )

            else:
                return VerifyOrderResponse(
                    status=order_status or "UNKNOWN",
                    plan_activated=False,
                    message=f"Order status: {order_status}",
                )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[CASHFREE] Verify order error: {str(e)}", flush=True)
        import traceback; traceback.print_exc()
        return VerifyOrderResponse(
            status="ERROR",
            plan_activated=False,
            message="Could not verify payment. Please contact support at doptonin@gmail.com",
        )


# ═══════════════════════════════════════════════════════════════════════
#  SUBSCRIPTION STATUS
# ═══════════════════════════════════════════════════════════════════════


@router.get("/subscription/status", response_model=SubscriptionStatusResponse)
async def subscription_status(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    """Return the user's current plan, limits, and today's usage snapshot."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    plan_config = get_plan(user.plan or "free")

    # Today's usage
    today = datetime.now(timezone.utc).date()
    usage_stmt = select(DailyUsage).where(
        DailyUsage.user_id == user_id,
        DailyUsage.date == today,
    )
    usage_row = (await db.execute(usage_stmt)).scalar_one_or_none()

    monthly_cost = await get_monthly_cost(db, user_id)

    plan_info = PlanInfo(
        name=plan_config.name,
        display_name=plan_config.display_name,
        price_inr_monthly=plan_config.price_inr_monthly,
        price_inr_yearly=plan_config.price_inr_yearly,
        daily_requests=plan_config.daily_requests,
        memory_writes_per_day=plan_config.memory_writes_per_day,
        memory_storage_limit=plan_config.memory_storage_limit,
        reminders_per_day=plan_config.reminders_per_day,
        voice_input=plan_config.voice_input,
        premium_tts=plan_config.premium_tts,
        long_term_reminder=plan_config.long_term_reminder,
    )

    usage = UsageSnapshot(
        requests_today=usage_row.requests_count if usage_row else 0,
        memory_writes_today=usage_row.memory_writes if usage_row else 0,
        reminders_today=usage_row.reminders_created if usage_row else 0,
        monthly_cost_inr=float(monthly_cost),
    )

    is_active = True
    if user.plan_end_date:
        is_active = user.plan_end_date > datetime.now(timezone.utc)

    return SubscriptionStatusResponse(
        plan=plan_info,
        usage=usage,
        plan_start_date=str(user.plan_start_date) if user.plan_start_date else None,
        plan_end_date=str(user.plan_end_date) if user.plan_end_date else None,
        is_active=is_active,
        cashfree_subscription_id=user.stripe_subscription_id,
    )


# ═══════════════════════════════════════════════════════════════════════
#  LIST ALL PLANS
# ═══════════════════════════════════════════════════════════════════════


@router.get("/subscription/plans", response_model=list[PlanInfo])
async def list_plans():
    """Return all available plans (for pricing page)."""
    return [
        PlanInfo(
            name=p.name,
            display_name=p.display_name,
            price_inr_monthly=p.price_inr_monthly,
            price_inr_yearly=p.price_inr_yearly,
            daily_requests=p.daily_requests,
            memory_writes_per_day=p.memory_writes_per_day,
            memory_storage_limit=p.memory_storage_limit,
            reminders_per_day=p.reminders_per_day,
            voice_input=p.voice_input,
            premium_tts=p.premium_tts,
            long_term_reminder=p.long_term_reminder,
        )
        for p in get_all_plans()
    ]
