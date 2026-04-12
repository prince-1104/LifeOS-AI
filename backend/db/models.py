import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from db.postgres import Base


class User(Base):
    """Maps Clerk `sub` to app identity; created on first authenticated request."""

    __tablename__ = "users"

    id = Column(String(255), primary_key=True)
    email = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


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
