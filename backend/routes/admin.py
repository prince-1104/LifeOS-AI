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
from db.models import UsageLog, User
from db.postgres import get_db
from schemas_admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminUserRow,
    DailyUsageRow,
    ForgotPasswordRequest,
    MessageResponse,
    MonthlyUsageRow,
    ResetPasswordRequest,
    TopUserRow,
    UsageSummaryResponse,
    UserUsageRow,
    WeeklyUsageRow,
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
                total_tokens=tokens,
                total_requests=requests,
                cost=round((tokens / 1000) * settings.MODEL_COST_PER_1K, 4),
            )
        )
    
    combined.sort(key=lambda x: x.total_tokens, reverse=True)
    return combined[:limit]
