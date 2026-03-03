import uuid
import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class LLMConfig(Base):
    """Singleton LLM configuration (always id=1)."""

    __tablename__ = "llm_config"

    id: Mapped[int] = mapped_column(Integer(), primary_key=True, default=1)
    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="openai")
    api_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False, default="gpt-4o-mini")
    max_tokens_per_request: Mapped[int] = mapped_column(Integer(), nullable=False, default=1500)
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    editor: Mapped["User | None"] = relationship(lazy="joined", foreign_keys=[updated_by_id])

    def __repr__(self) -> str:
        return f"<LLMConfig provider={self.provider!r} model={self.model!r} active={self.is_active}>"
