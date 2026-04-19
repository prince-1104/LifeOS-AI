import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from db.postgres import Base


class User(Base):
    """Maps Clerk `sub` to app identity; synced from Clerk on every authenticated request."""

    __tablename__ = "users"

    id = Column(String(255), primary_key=True)
    email = Column(Text, nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    image_url = Column(Text, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    hobbies = Column(Text, nullable=True)
    last_sign_in_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Subscription fields ───────────────────────────────────────────
    plan = Column(String(50), nullable=False, server_default="free")
    stripe_customer_id = Column(String(255), nullable=True, unique=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    plan_start_date = Column(DateTime(timezone=True), nullable=True)
    plan_end_date = Column(DateTime(timezone=True), nullable=True)


class Memory(Base):
    __tablename__ = "memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False, default="default")
    content = Column(Text, nullable=False)
    tags = Column(ARRAY(String), default=[])
    raw_input = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint(
            "type IN ('income', 'expense')",
            name="ck_transactions_type",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    category = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    source = Column(Text, nullable=True)
    event_time = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Reminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'done')",
            name="ck_reminders_status",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False)
    task = Column(Text, nullable=False)
    reminder_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    snooze_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class QueryLog(Base):
    """Audit trail for /process calls (debugging, analytics, prompt iteration)."""

    __tablename__ = "query_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(String(36), nullable=True)
    user_id = Column(String(255), nullable=False)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    result_type = Column(String(64), nullable=False)
    latency_ms_total = Column(Numeric(12, 3), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class OrchestratorLog(Base):
    __tablename__ = "orchestrator_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(String(36), nullable=False)
    user_id = Column(String(255), nullable=False)
    input_text = Column(Text, nullable=False)
    orchestrator_json = Column(Text, nullable=True)
    latency_ms = Column(Numeric(12, 3), nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(String(36), nullable=False)
    user_id = Column(String(255), nullable=False)
    agent = Column(String(64), nullable=False)
    latency_ms = Column(Numeric(12, 3), nullable=False)
    response_preview = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(String(36), nullable=False)
    user_id = Column(String(255), nullable=False)
    stage = Column(String(32), nullable=False)
    message = Column(Text, nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class UsageLog(Base):
    """Tracks token usage per LLM call for billing and analytics."""

    __tablename__ = "usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(String(36), nullable=False)
    user_id = Column(String(255), nullable=False)
    model = Column(String(64), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    endpoint = Column(String(128), nullable=True)
    latency_ms = Column(Numeric(12, 3), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class AdminOtp(Base):
    """Temporary reset codes for admin password recovery."""

    __tablename__ = "admin_otp"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, nullable=False)
    otp = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class AdminConfig(Base):
    """Key-value store for admin settings (e.g. password override from reset flow)."""

    __tablename__ = "admin_config"

    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AdminSession(Base):
    """Active admin sessions (JWT-like bearer tokens)."""

    __tablename__ = "admin_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(Text, nullable=False, unique=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)


class DailyUsage(Base):
    """Per-user per-day usage counters for subscription limit enforcement."""

    __tablename__ = "daily_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_usage_user_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False, index=True)
    date = Column(Date, nullable=False)
    requests_count = Column(Integer, nullable=False, default=0)
    memory_writes = Column(Integer, nullable=False, default=0)
    reminders_created = Column(Integer, nullable=False, default=0)
    tokens_used = Column(Integer, nullable=False, default=0)
    cost_inr = Column(Numeric(10, 4), nullable=False, default=0)

