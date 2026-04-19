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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.deps import get_authenticated_user_id
from config import get_settings
from db.models import DailyUsage, User
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
        price = _get_plan_price(req.plan_id, req.billing_cycle)

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
                "return_url": f"{return_url}?order_id={order_id}",
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
        signature = request.headers.get("x-cashfree-signature") or request.headers.get("x-webhook-signature", "")
        expected = hmac.HMAC(
            settings.CASHFREE_WEBHOOK_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            print("[CASHFREE] Webhook signature mismatch", flush=True)
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
