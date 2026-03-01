import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BrandingConfig(Base):
    __tablename__ = "branding_config"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    logo_light_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_dark_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    favicon_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<BrandingConfig id={self.id}>"
