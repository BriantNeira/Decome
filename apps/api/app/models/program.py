import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.account import Account
    from app.models.contact import Contact


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    season: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )
    account: Mapped["Account | None"] = relationship(
        "Account", foreign_keys=[account_id], lazy="joined"
    )
    contacts: Mapped[list["Contact"]] = relationship(
        "Contact", secondary="contact_programs", back_populates="programs"
    )

    def __repr__(self) -> str:
        return f"<Program id={self.id} name={self.name}>"
