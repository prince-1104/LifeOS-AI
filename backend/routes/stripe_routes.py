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
#  CREATE SUBSCRIPTION
# ═══════════════════════════════════════════════════════════════════════


@router.post("/payments/create-subscription", response_model=CreateSubscriptionResponse)
async def create_subscription(
    req: CreateSubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_authenticated_user_id),
):
    """
    Create a Cashfree subscription (mandate) for the selected plan.

    Flow:
    1. Create a plan on Cashfree (if not already cached)
    2. Create a subscription with customer details
    3. Return the authorization link for the customer
    """
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

    base_url = _cashfree_base_url()
    headers = _cashfree_headers()
    price = _get_plan_price(req.plan_id, req.billing_cycle)
    
    # Cashfree requires EXACT uppercase interval types
    interval_type = "MONTH" if req.billing_cycle == "monthly" else "YEAR"

    # ── Step 1: Create plan on Cashfree ───────────────────────────────
    cf_plan_id = f"{plan.name}_{req.billing_cycle}"

    plan_payload = {
        "plan_id": cf_plan_id,
        "plan_name": f"{plan.display_name} ({req.billing_cycle})",
        "plan_type": "PERIODIC",
        "plan_currency": "INR",
        "plan_recurring_amount": price,
        "plan_max_amount": price * 2,  # allow some headroom
        "plan_max_cycles": 120 if req.billing_cycle == "monthly" else 10,
        "plan_intervals": 1,
        "plan_interval_type": interval_type,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Try to create the plan (ignore 409 if already exists)
        plan_resp = await client.post(
            f"{base_url}/plans",
            headers=headers,
            json=plan_payload,
        )
        if plan_resp.status_code not in (200, 201, 409):
            logger.error("Cashfree create plan failed: %s %s", plan_resp.status_code, plan_resp.text)
            err_detail = "Failed to create subscription plan."
            try:
                err_detail = plan_resp.json().get('message', err_detail)
            except: pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,  # Avoid 502 so Vercel doesn't mask it
                detail=err_detail,
            )

        # ── Step 2: Create subscription ───────────────────────────────
        import uuid
        sub_id = f"sub_{user_id[:8]}_{uuid.uuid4().hex[:8]}"

        # Clean phone to 10 digits if possible
        import re
        phone = user.phone or ""
        clean_phone = re.sub(r'\D', '', phone)  # Remove all non-digits
        if len(clean_phone) > 10:
            clean_phone = clean_phone[-10:]  # Take last 10 (removes country code +91)
        if len(clean_phone) < 10:
            clean_phone = "9999999999"

        sub_payload = {
            "subscription_id": sub_id,
            "plan_id": cf_plan_id,
            "customer_details": {
                "customer_id": user_id[:50],
                "customer_phone": clean_phone,
                "customer_email": user.email or "user@example.com", # Cannot be empty
                "customer_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or "User",
            },
            "subscription_meta": {
                "return_url": f"{req.return_url}?subscription_id={sub_id}",
            },
            "subscription_tags": {
                "app_user_id": user_id,
                "plan_name": plan.name,
                "billing_cycle": req.billing_cycle,
            },
        }

        sub_resp = await client.post(
            f"{base_url}/subscriptions",
            headers=headers,
            json=sub_payload,
        )

        if sub_resp.status_code not in (200, 201):
            logger.error("Cashfree create subscription failed: %s %s", sub_resp.status_code, sub_resp.text)
            err_detail = "Failed to create subscription."
            try:
                err_detail = sub_resp.json().get('message', err_detail)
            except: pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_detail,
            )

        sub_data = sub_resp.json()
        auth_link = sub_data.get("subscription_payment_link") or sub_data.get("authorization_link", "")

    # Save subscription ID to user record
    user.stripe_subscription_id = sub_id  # reusing column for cashfree sub id
    await db.commit()

    return CreateSubscriptionResponse(
        subscription_id=sub_id,
        authorization_link=auth_link,
    )


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
    - SUBSCRIPTION_NEW_PAYMENT_CHARGED → plan active, extend dates
    - SUBSCRIPTION_STATUS_CHANGED → activate/pause/cancel
    - PAYMENT_SUCCESS_WEBHOOK → one-time payment confirmation
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
            logger.warning("Cashfree webhook signature mismatch")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        data = json.loads(payload_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("type") or data.get("event", "")
    event_data = data.get("data", {})

    logger.info("Cashfree webhook: %s", event_type)

    if event_type in ("SUBSCRIPTION_PAYMENT_CHARGED", "SUBSCRIPTION_NEW_PAYMENT_CHARGED"):
        await _handle_payment_charged(db, event_data)

    elif event_type == "SUBSCRIPTION_STATUS_CHANGED":
        await _handle_subscription_status_changed(db, event_data)

    elif event_type == "PAYMENT_SUCCESS_WEBHOOK":
        # One-time order payment success (if used for non-subscription payments)
        logger.info("Payment success webhook received")

    return {"status": "ok"}


async def _handle_payment_charged(db: AsyncSession, event_data: dict):
    """Handle successful subscription charge — activate/renew plan."""
    subscription = event_data.get("subscription", {})
    sub_id = subscription.get("subscription_id", "")
    tags = subscription.get("subscription_tags", {})
    plan_name = tags.get("plan_name", "")

    if not sub_id:
        logger.warning("Payment charged webhook without subscription_id")
        return

    # Find user by subscription ID
    stmt = select(User).where(User.stripe_subscription_id == sub_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        logger.warning("No user found for subscription %s", sub_id)
        return

    now = datetime.now(timezone.utc)
    if plan_name and plan_name in PLANS:
        user.plan = plan_name
    if not user.plan_start_date:
        user.plan_start_date = now

    # Extend plan_end_date by cycle
    from dateutil.relativedelta import relativedelta
    billing_cycle = tags.get("billing_cycle", "monthly")
    if billing_cycle == "yearly":
        user.plan_end_date = now + relativedelta(years=1)
    else:
        user.plan_end_date = now + relativedelta(months=1)

    await db.commit()
    logger.info("Plan '%s' activated/renewed for user %s (sub: %s)", user.plan, user.id, sub_id)


async def _handle_subscription_status_changed(db: AsyncSession, event_data: dict):
    """Handle subscription lifecycle changes."""
    subscription = event_data.get("subscription", {})
    sub_id = subscription.get("subscription_id", "")
    new_status = subscription.get("subscription_status", "")

    if not sub_id:
        return

    stmt = select(User).where(User.stripe_subscription_id == sub_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        logger.warning("No user found for subscription %s", sub_id)
        return

    if new_status in ("CANCELLED", "EXPIRED", "COMPLETED"):
        user.plan = "free"
        user.plan_end_date = datetime.now(timezone.utc)
        await db.commit()
        logger.info("User %s downgraded to free (subscription %s: %s)", user.id, sub_id, new_status)

    elif new_status == "ACTIVE":
        # Subscription activated after mandate authorization
        tags = subscription.get("subscription_tags", {})
        plan_name = tags.get("plan_name", "")
        if plan_name and plan_name in PLANS:
            user.plan = plan_name
            user.plan_start_date = datetime.now(timezone.utc)
            await db.commit()
            logger.info("User %s plan activated: %s", user.id, plan_name)

    elif new_status == "PAUSED":
        logger.info("Subscription %s paused for user %s", sub_id, user.id)


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
