from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FieldType(str, PyEnum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    DROPDOWN = "dropdown"


class EntityType(str, PyEnum):
    ACCOUNT = "account"
    ASSIGNMENT = "assignment"
    CONTACT = "contact"


class CustomFieldDefinition(Base):
    __tablename__ = "custom_field_definitions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_type: Mapped[str] = mapped_column(
        Enum(FieldType, name="field_type_enum", create_constraint=True, values_callable=lambda objs: [e.value for e in objs]),
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(
        Enum(EntityType, name="entity_type_enum", create_constraint=True, values_callable=lambda objs: [e.value for e in objs]),
        nullable=False,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<CustomFieldDefinition id={self.id} field_name={self.field_name}>"


class CustomFieldValue(Base):
    __tablename__ = "custom_field_values"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    definition_id: Mapped[int] = mapped_column(
        ForeignKey("custom_field_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    value: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<CustomFieldValue id={self.id} def={self.definition_id} entity={self.entity_id}>"
