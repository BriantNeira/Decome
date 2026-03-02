from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.custom_field import CustomFieldDefinition, CustomFieldValue


async def list_definitions(
    db: AsyncSession, entity_type: str | None = None, skip: int = 0, limit: int = 50
) -> tuple[list[CustomFieldDefinition], int]:
    query = select(CustomFieldDefinition)

    if entity_type:
        query = query.where(CustomFieldDefinition.entity_type == entity_type)

    count_result = await db.execute(select(func.count()).select_from(CustomFieldDefinition))
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(CustomFieldDefinition.sort_order).offset(skip).limit(limit)
    )
    definitions = result.scalars().all()
    return definitions, total


async def get_definition(db: AsyncSession, def_id: int) -> CustomFieldDefinition:
    result = await db.execute(
        select(CustomFieldDefinition).where(CustomFieldDefinition.id == def_id)
    )
    definition = result.scalar_one_or_none()
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Custom field definition not found"
        )
    return definition


async def create_definition(
    db: AsyncSession,
    field_name: str,
    field_type: str,
    entity_type: str,
    is_required: bool = False,
    options: dict | None = None,
    sort_order: int = 0,
) -> CustomFieldDefinition:
    definition = CustomFieldDefinition(
        field_name=field_name,
        field_type=field_type,
        entity_type=entity_type,
        is_required=is_required,
        options=options,
        sort_order=sort_order,
    )
    db.add(definition)
    await db.flush()
    return definition


async def update_definition(db: AsyncSession, def_id: int, **fields) -> CustomFieldDefinition:
    definition = await get_definition(db, def_id)

    if "field_type" in fields or "entity_type" in fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change field_type or entity_type after creation",
        )

    for key, value in fields.items():
        if hasattr(definition, key) and value is not None:
            setattr(definition, key, value)

    await db.flush()
    return definition


async def delete_definition(db: AsyncSession, def_id: int) -> CustomFieldDefinition:
    definition = await get_definition(db, def_id)
    await db.delete(definition)
    await db.flush()
    return definition


async def get_values_for_entity(
    db: AsyncSession, entity_type: str, entity_id: str
) -> list[dict]:
    result = await db.execute(
        select(CustomFieldDefinition, CustomFieldValue)
        .select_from(CustomFieldValue)
        .join(
            CustomFieldDefinition,
            CustomFieldDefinition.id == CustomFieldValue.definition_id,
        )
        .where(
            CustomFieldDefinition.entity_type == entity_type,
            CustomFieldValue.entity_id == entity_id,
        )
    )

    rows = result.all()
    values = [
        {
            "definition_id": definition.id,
            "field_name": definition.field_name,
            "field_type": definition.field_type,
            "value": value.value,
        }
        for definition, value in rows
    ]
    return values


async def set_values_for_entity(
    db: AsyncSession, entity_type: str, entity_id: str, values: list[dict]
) -> list[CustomFieldValue]:
    created_values = []

    for val_data in values:
        definition_id = val_data.get("definition_id")
        value = val_data.get("value")

        # Validate definition exists and matches entity_type
        definition = await get_definition(db, definition_id)
        if definition.entity_type != entity_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Definition {definition_id} is not for entity type {entity_type}",
            )

        # Find or create value
        existing_result = await db.execute(
            select(CustomFieldValue).where(
                CustomFieldValue.definition_id == definition_id,
                CustomFieldValue.entity_id == entity_id,
            )
        )
        existing_value = existing_result.scalar_one_or_none()

        if existing_value:
            existing_value.value = value
            created_values.append(existing_value)
        else:
            new_value = CustomFieldValue(
                definition_id=definition_id, entity_id=entity_id, value=value
            )
            db.add(new_value)
            await db.flush()
            created_values.append(new_value)

    return created_values
