"""
Static plan configuration registry — single source of truth for all subscription
tiers, limits, feature flags, and Stripe price mappings.

Adding a new plan? Add it to PLANS dict. All limit enforcement reads from here.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlanConfig:
    """Immutable plan tier definition."""

    name: str  # internal key: "free", "basic_29", etc.
    display_name: str  # UI-facing: "Free", "₹29 Basic", etc.
    price_inr_monthly: int
    price_inr_yearly: int  # ~20% discount

    # ── Daily / storage limits ────────────────────────────────────────
    daily_requests: int
    memory_writes_per_day: int
    memory_storage_limit: int  # max memories stored (FIFO eviction beyond this)
    reminders_per_day: int
    reminder_24h_only: bool  # if True, reject reminders > 24h in the future

    # ── Monthly cost budget (INR) ─────────────────────────────────────
    monthly_cost_budget_inr: float

    # ── Feature flags ─────────────────────────────────────────────────
    voice_input: bool
    premium_tts: bool
    priority_processing: bool
    long_term_reminder: bool  # reminders beyond 24h


# ═══════════════════════════════════════════════════════════════════════
#  PLAN DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════

PLANS: dict[str, PlanConfig] = {
    "free": PlanConfig(
        name="free",
        display_name="Free",
        price_inr_monthly=0,
        price_inr_yearly=0,
        daily_requests=15,
        memory_writes_per_day=3,
        memory_storage_limit=10,
        reminders_per_day=2,
        reminder_24h_only=True,
        monthly_cost_budget_inr=20.0,
        voice_input=False,
        premium_tts=False,
        priority_processing=False,
        long_term_reminder=False,
    ),
    "basic_29": PlanConfig(
        name="basic_29",
        display_name="₹29 Basic",
        price_inr_monthly=29,
        price_inr_yearly=278,  # ~20% off
        daily_requests=40,
        memory_writes_per_day=5,
        memory_storage_limit=20,
        reminders_per_day=5,
        reminder_24h_only=True,
        monthly_cost_budget_inr=20.0,
        voice_input=False,
        premium_tts=False,
        priority_processing=False,
        long_term_reminder=False,
    ),
    "standard_49": PlanConfig(
        name="standard_49",
        display_name="₹49 Standard",
        price_inr_monthly=49,
        price_inr_yearly=470,  # ~20% off
        daily_requests=80,
        memory_writes_per_day=10,
        memory_storage_limit=50,
        reminders_per_day=10,
        reminder_24h_only=False,
        monthly_cost_budget_inr=35.0,
        voice_input=False,
        premium_tts=False,
        priority_processing=False,
        long_term_reminder=True,
    ),
    "pro_99": PlanConfig(
        name="pro_99",
        display_name="₹99 Pro",
        price_inr_monthly=99,
        price_inr_yearly=950,  # ~20% off
        daily_requests=150,
        memory_writes_per_day=20,
        memory_storage_limit=100,
        reminders_per_day=20,
        reminder_24h_only=False,
        monthly_cost_budget_inr=60.0,
        voice_input=True,
        premium_tts=False,
        priority_processing=False,
        long_term_reminder=True,
    ),
    "premium_499": PlanConfig(
        name="premium_499",
        display_name="₹499 Premium",
        price_inr_monthly=499,
        price_inr_yearly=4790,  # ~20% off
        daily_requests=300,
        memory_writes_per_day=50,
        memory_storage_limit=500,
        reminders_per_day=50,
        reminder_24h_only=False,
        monthly_cost_budget_inr=200.0,
        voice_input=True,
        premium_tts=True,
        priority_processing=True,
        long_term_reminder=True,
    ),
}


# ═══════════════════════════════════════════════════════════════════════
#  STRIPE PRICE → PLAN MAPPING
# ═══════════════════════════════════════════════════════════════════════
# Populated at startup from env or Stripe Dashboard.
# Key: Stripe price_id, Value: plan name.
# Example: {"price_1Abc123": "basic_29", "price_1Def456": "basic_29"}
#   (one monthly + one yearly price per plan)

STRIPE_PRICE_TO_PLAN: dict[str, str] = {}


def register_stripe_prices(mapping: dict[str, str]) -> None:
    """Bulk-register Stripe price_id → plan_name mappings (called at startup)."""
    STRIPE_PRICE_TO_PLAN.update(mapping)


def plan_from_stripe_price(price_id: str) -> str:
    """Resolve a Stripe price_id to an internal plan name.  Falls back to 'free'."""
    return STRIPE_PRICE_TO_PLAN.get(price_id, "free")


# ═══════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════


def get_plan(plan_name: str) -> PlanConfig:
    """Return plan config by name, defaulting to free if unknown."""
    return PLANS.get(plan_name, PLANS["free"])


def get_next_upgrade(current_plan: str) -> PlanConfig | None:
    """Return the next tier up from the current plan, or None if already max."""
    order = ["free", "basic_29", "standard_49", "pro_99", "premium_499"]
    try:
        idx = order.index(current_plan)
    except ValueError:
        return PLANS.get("basic_29")
    if idx + 1 < len(order):
        return PLANS[order[idx + 1]]
    return None


def get_all_plans() -> list[PlanConfig]:
    """Return all plans in tier order (cheapest first)."""
    order = ["free", "basic_29", "standard_49", "pro_99", "premium_499"]
    return [PLANS[k] for k in order]


# ── Feature name → minimum plan mapping ──────────────────────────────

FEATURE_MIN_PLAN: dict[str, str] = {
    "voice_input": "pro_99",
    "premium_tts": "premium_499",
    "priority_processing": "premium_499",
    "long_term_reminder": "standard_49",
}


def min_plan_for_feature(feature: str) -> PlanConfig | None:
    """Return the cheapest plan that unlocks a given feature."""
    plan_name = FEATURE_MIN_PLAN.get(feature)
    if plan_name:
        return PLANS.get(plan_name)
    return None
