import uuid
import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class EmailConfig(Base):
    """Singleton SMTP configuration (always id=1)."""

    __tablename__ = "email_config"

    id: Mapped[int] = mapped_column(Integer(), primary_key=True, default=1)
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer(), nullable=True, default=587)
    smtp_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(Text(), nullable=True)
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True, default="Deminder")
    use_tls: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    editor: Mapped["User | None"] = relationship(lazy="joined", foreign_keys=[updated_by])

    def __repr__(self) -> str:
        return f"<EmailConfig host={self.smtp_host!r} active={self.is_active}>"
