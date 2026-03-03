import uuid
import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.reminder import Reminder
    from app.models.email_template import EmailTemplate
    from app.models.user import User
    from app.models.contact import Contact


class GeneratedMessage(Base):
    __tablename__ = "generated_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reminder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reminders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    tone: Mapped[str] = mapped_column(String(20), nullable=False, default="formal")
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text(), nullable=False)
    tokens_used: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    generated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    generated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    sent_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_to_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    reminder: Mapped["Reminder"] = relationship(lazy="joined")
    template: Mapped["EmailTemplate | None"] = relationship(lazy="joined")
    generator: Mapped["User"] = relationship(lazy="joined", foreign_keys=[generated_by])
    contact: Mapped["Contact | None"] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"<GeneratedMessage id={self.id} reminder_id={self.reminder_id}>"
