"""Admin API routes: password auth + usage analytics.

All analytics endpoints require a valid admin bearer token.
Only the hardcoded ADMIN_EMAIL can authenticate.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from auth.admin_auth import (
    create_admin_session,
    generate_reset_code,
    get_admin_session,
    set_admin_password,
    store_reset_code,
    verify_admin_credentials,
    verify_reset_code,
)
from config import get_settings
from db.models import DailyUsage, UsageLog, User, PromoCode
from db.postgres import get_db
from plans import get_plan
from schemas_admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminUserRow,
    DailyUsageRow,
    ForgotPasswordRequest,
    MessageResponse,
    MonthlyUsageRow,
    ResetPasswordRequest,
    RevenueSummaryResponse,
    TopUserRow,
    UsageSummaryResponse,
    UserRevenueRow,
    UserUsageRow,
    WeeklyUsageRow,
    CreatePromoCodeRequest,
    PromoCodeResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ═══════════════════════════════════════════════════════════════════════
#  AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(req: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """Verify email + password and return a session token."""
    if not await verify_admin_credentials(db, req.email, req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    settings = get_settings()
    token = await create_admin_session(db)
    return AdminLoginResponse(
        token=token,
        expires_in_hours=settings.ADMIN_SESSION_EXPIRY_HOURS,
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a 6-digit password-reset code to the admin email."""
    settings = get_settings()

    if req.email != settings.ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized email address",
        )

    code = generate_reset_code()
    await store_reset_code(db, req.email, code)

    return MessageResponse(message="Reset code sent. Check your email or backend console.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Verify reset code and set a new admin password."""
    settings = get_settings()

    if req.email != settings.ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized email address",
        )

    is_valid = await verify_reset_code(db, req.email, req.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset code",
        )

    await set_admin_password(db, req.new_password)
    return MessageResponse(message="Password updated successfully")


# ═══════════════════════════════════════════════════════════════════════
#  USER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════


@router.get("/users/all", response_model=list[AdminUserRow])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """List all registered users with their usage stats (if any)."""
    settings = get_settings()

    # Fetch all users from the users table
    users_stmt = select(User).order_by(User.created_at.desc())
    users = (await db.execute(users_stmt)).scalars().all()

    # Fetch usage stats grouped by user_id
    usage_stmt = (
        select(
            UsageLog.user_id,
            func.coalesce(func.sum(UsageLog.total_tokens), 0).label("total_tokens"),
            func.count(UsageLog.id).label("total_requests"),
        )
        .group_by(UsageLog.user_id)
    )
    usage_rows = (await db.execute(usage_stmt)).all()
    usage_map = {r.user_id: r for r in usage_rows}

    result = []
    for u in users:
        usage = usage_map.get(u.id)
        tokens = int(usage.total_tokens) if usage else 0
        requests = int(usage.total_requests) if usage else 0
        result.append(
            AdminUserRow(
                user_id=u.id,
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                image_url=u.image_url,
                plan=u.plan or "free",
                created_at=str(u.created_at) if u.created_at else None,
                total_tokens=tokens,
                total_requests=requests,
                cost=round((tokens / 1000) * settings.MODEL_COST_PER_1K, 4),
            )
        )
    return result


# ═══════════════════════════════════════════════════════════════════════
#  ANALYTICS ENDPOINTS (all require admin session)
# ═══════════════════════════════════════════════════════════════════════


@router.get("/usage/summary", response_model=UsageSummaryResponse)
async def usage_summary(
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Total users, total tokens, total cost across all time."""
    settings = get_settings()

    # Total registered users
    user_count_stmt = select(func.count(User.id))
    user_count = (await db.execute(user_count_stmt)).scalar_one() or 0

    # Total tokens
    tokens_stmt = select(func.coalesce(func.sum(UsageLog.total_tokens), 0))
    total_tokens = (await db.execute(tokens_stmt)).scalar_one()

    cost = round((total_tokens / 1000) * settings.MODEL_COST_PER_1K, 4)

    return UsageSummaryResponse(
        total_users=user_count,
        total_tokens=total_tokens,
        total_cost=cost,
    )


@router.get("/usage/users", response_model=list[UserUsageRow])
async def usage_per_user(
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Per-user token usage with cost."""
    settings = get_settings()

    stmt = (
        select(
            UsageLog.user_id,
            func.coalesce(func.sum(UsageLog.total_tokens), 0).label("total_tokens"),
            func.count(UsageLog.id).label("total_requests"),
        )
        .group_by(UsageLog.user_id)
        .order_by(func.sum(UsageLog.total_tokens).desc())
    )
    rows = (await db.execute(stmt)).all()

    # Fetch user profiles for display names
    user_ids = [r.user_id for r in rows]
    profiles: dict[str, User] = {}
    if user_ids:
        profile_stmt = select(User).where(User.id.in_(user_ids))
        profile_rows = (await db.execute(profile_stmt)).scalars().all()
        profiles = {u.id: u for u in profile_rows}

    result = []
    for r in rows:
        u = profiles.get(r.user_id)
        tokens = int(r.total_tokens)
        result.append(
            UserUsageRow(
                user_id=r.user_id,
                email=u.email if u else None,
                first_name=u.first_name if u else None,
                last_name=u.last_name if u else None,
                total_tokens=tokens,
                total_requests=int(r.total_requests),
                cost=round((tokens / 1000) * settings.MODEL_COST_PER_1K, 4),
            )
        )
    return result


@router.get("/usage/daily", response_model=list[DailyUsageRow])
async def usage_daily(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Daily token usage for the last N days."""
    settings = get_settings()

    stmt = text("""
        SELECT
            DATE(created_at) AS day,
            COALESCE(SUM(total_tokens), 0) AS tokens,
            COUNT(*) AS requests
        FROM usage_logs
        WHERE created_at >= CURRENT_DATE - make_interval(days => :days)
        GROUP BY DATE(created_at)
        ORDER BY day
    """)
    rows = (await db.execute(stmt, {"days": days})).all()

    return [
        DailyUsageRow(
            date=str(r.day),
            total_tokens=int(r.tokens),
            total_requests=int(r.requests),
            cost=round((int(r.tokens) / 1000) * settings.MODEL_COST_PER_1K, 4),
        )
        for r in rows
    ]


@router.get("/usage/weekly", response_model=list[WeeklyUsageRow])
async def usage_weekly(
    weeks: int = 12,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Weekly token usage for the last N weeks."""
    settings = get_settings()

    stmt = text("""
        SELECT
            DATE_TRUNC('week', created_at)::date AS week_start,
            COALESCE(SUM(total_tokens), 0) AS tokens,
            COUNT(*) AS requests
        FROM usage_logs
        WHERE created_at >= CURRENT_DATE - make_interval(weeks => :weeks)
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week_start
    """)
    rows = (await db.execute(stmt, {"weeks": weeks})).all()

    return [
        WeeklyUsageRow(
            week_start=str(r.week_start),
            total_tokens=int(r.tokens),
            total_requests=int(r.requests),
            cost=round((int(r.tokens) / 1000) * settings.MODEL_COST_PER_1K, 4),
        )
        for r in rows
    ]


@router.get("/usage/monthly", response_model=list[MonthlyUsageRow])
async def usage_monthly(
    months: int = 12,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Monthly token usage for the last N months."""
    settings = get_settings()

    stmt = text("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COALESCE(SUM(total_tokens), 0) AS tokens,
            COUNT(*) AS requests
        FROM usage_logs
        WHERE created_at >= CURRENT_DATE - make_interval(months => :months)
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
    """)
    rows = (await db.execute(stmt, {"months": months})).all()

    return [
        MonthlyUsageRow(
            month=r.month,
            total_tokens=int(r.tokens),
            total_requests=int(r.requests),
            cost=round((int(r.tokens) / 1000) * settings.MODEL_COST_PER_1K, 4),
        )
        for r in rows
    ]


@router.get("/top-users", response_model=list[TopUserRow])
async def top_users(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Top N users by token consumption."""
    settings = get_settings()

    # Fetch all users from the users table
    users_stmt = select(User).order_by(User.created_at.desc())
    users = (await db.execute(users_stmt)).scalars().all()

    # Fetch usage stats grouped by user_id
    usage_stmt = (
        select(
            UsageLog.user_id,
            func.coalesce(func.sum(UsageLog.total_tokens), 0).label("total_tokens"),
            func.count(UsageLog.id).label("total_requests"),
        )
        .group_by(UsageLog.user_id)
    )
    usage_rows = (await db.execute(usage_stmt)).all()
    usage_map = {r.user_id: r for r in usage_rows}

    # Combine and sort by tokens descending
    combined = []
    for u in users:
        usage = usage_map.get(u.id)
        tokens = int(usage.total_tokens) if usage else 0
        requests = int(usage.total_requests) if usage else 0
        combined.append(
            TopUserRow(
                user_id=u.id,
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                plan=u.plan or "free",
                total_tokens=tokens,
                total_requests=requests,
                cost=round((tokens / 1000) * settings.MODEL_COST_PER_1K, 4),
            )
        )
    
    combined.sort(key=lambda x: x.total_tokens, reverse=True)
    return combined[:limit]


# ═══════════════════════════════════════════════════════════════════════
#  REVENUE & PROFITABILITY
# ═══════════════════════════════════════════════════════════════════════


@router.get("/revenue/summary", response_model=RevenueSummaryResponse)
async def revenue_summary(
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Total revenue (sum of plan prices), total cost, and net profit."""
    users_stmt = select(User)
    users = (await db.execute(users_stmt)).scalars().all()

    total_revenue = 0.0
    paying_count = 0
    for u in users:
        plan = get_plan(u.plan or "free")
        if plan.price_inr_monthly > 0:
            total_revenue += plan.price_inr_monthly
            paying_count += 1

    # Total cost from daily_usage
    cost_stmt = select(func.coalesce(func.sum(DailyUsage.cost_inr), 0))
    total_cost = float((await db.execute(cost_stmt)).scalar_one())

    return RevenueSummaryResponse(
        total_users=len(users),
        paying_users=paying_count,
        total_revenue_inr=round(total_revenue, 2),
        total_cost_inr=round(total_cost, 4),
        net_profit_inr=round(total_revenue - total_cost, 2),
    )


@router.get("/revenue/users", response_model=list[UserRevenueRow])
async def revenue_per_user(
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(get_admin_session),
):
    """Per-user revenue vs cost with over-budget flagging."""
    users_stmt = select(User).order_by(User.created_at.desc())
    users = (await db.execute(users_stmt)).scalars().all()

    # Per-user total cost from daily_usage
    cost_stmt = (
        select(
            DailyUsage.user_id,
            func.coalesce(func.sum(DailyUsage.cost_inr), 0).label("total_cost"),
        )
        .group_by(DailyUsage.user_id)
    )
    cost_rows = (await db.execute(cost_stmt)).all()
    cost_map = {r.user_id: float(r.total_cost) for r in cost_rows}

    result = []
    for u in users:
        plan = get_plan(u.plan or "free")
        user_cost = cost_map.get(u.id, 0.0)
        profit = plan.price_inr_monthly - user_cost
        is_over = user_cost > plan.monthly_cost_budget_inr

        result.append(
            UserRevenueRow(
                user_id=u.id,
                email=u.email,
                first_name=u.first_name,
                last_name=u.last_name,
                plan=plan.name,
                plan_display_name=plan.display_name,
                plan_price_inr=plan.price_inr_monthly,
                total_cost_inr=round(user_cost, 4),
                profit_loss_inr=round(profit, 2),
                is_over_budget=is_over,
            )
        )

    # Sort by cost descending (heaviest users first)
    result.sort(key=lambda x: x.total_cost_inr, reverse=True)
    return result

@router.post("/promos", response_model=PromoCodeResponse)
async def create_promo_code(
    req: CreatePromoCodeRequest,
    admin_id: str = Depends(get_admin_session),
    db: AsyncSession = Depends(get_db)
):
    """Create a new promo code."""
    promo_code_str = req.code.strip().upper()
    existing = await db.execute(select(PromoCode).where(func.upper(PromoCode.code) == promo_code_str))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    promo = PromoCode(
        code=promo_code_str,
        discount_percent=req.discount_percent,
        max_uses=req.max_uses,
        min_amount=req.min_amount,
        applicable_plans=req.applicable_plans,
        expires_at=req.expires_at
    )
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    
    return PromoCodeResponse(
        id=str(promo.id),
        code=promo.code,
        discount_percent=promo.discount_percent,
        max_uses=promo.max_uses,
        times_used=promo.times_used,
        min_amount=promo.min_amount,
        applicable_plans=promo.applicable_plans,
        is_active=promo.is_active,
        expires_at=promo.expires_at,
        created_at=promo.created_at
    )

@router.get("/promos", response_model=list[PromoCodeResponse])
async def get_promo_codes(
    admin_id: str = Depends(get_admin_session),
    db: AsyncSession = Depends(get_db)
):
    """List all promo codes."""
    result = await db.execute(select(PromoCode).order_by(PromoCode.created_at.desc()))
    promos = result.scalars().all()
    return [
        PromoCodeResponse(
            id=str(p.id),
            code=p.code,
            discount_percent=p.discount_percent,
            max_uses=p.max_uses,
            times_used=p.times_used,
            min_amount=p.min_amount,
            applicable_plans=p.applicable_plans,
            is_active=p.is_active,
            expires_at=p.expires_at,
            created_at=p.created_at
        ) for p in promos
    ]

@router.delete("/promos/{promo_id}")
async def delete_promo_code(
    promo_id: str,
    admin_id: str = Depends(get_admin_session),
    db: AsyncSession = Depends(get_db)
):
    """Delete a promo code completely."""
    try:
        import uuid
        parsed_id = uuid.UUID(promo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid promo code ID format")
        
    result = await db.execute(select(PromoCode).where(PromoCode.id == parsed_id))
    promo = result.scalars().first()
    
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
        
    await db.delete(promo)
    await db.commit()
    return {"status": "success", "message": "Promo code deleted"}
