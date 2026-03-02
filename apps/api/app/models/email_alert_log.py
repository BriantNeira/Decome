import uuid
import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.reminder import Reminder


class EmailAlertLog(Base):
    """Records every email alert attempt (sent or failed)."""

    __tablename__ = "email_alert_logs"

    id: Mapped[int] = mapped_column(BigInteger(), primary_key=True, autoincrement=True)
    reminder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reminders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # alert_type: '7_day' | '1_day' | 'overdue'
    alert_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sent_to: Mapped[str] = mapped_column(String(255), nullable=False)
    # status: 'sent' | 'failed'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sent", index=True)
    error_message: Mapped[str | None] = mapped_column(Text(), nullable=True)
    sent_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    reminder: Mapped["Reminder"] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"<EmailAlertLog reminder={self.reminder_id} type={self.alert_type} status={self.status}>"
