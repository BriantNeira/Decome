from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.custom_field import (
    CustomFieldDefinitionCreate,
    CustomFieldDefinitionListResponse,
    CustomFieldDefinitionRead,
    CustomFieldDefinitionUpdate,
    CustomFieldValueSet,
)
from app.services import custom_field_service, audit_service

router = APIRouter(prefix="/api/custom-fields", tags=["custom-fields"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


@router.get("/definitions", response_model=CustomFieldDefinitionListResponse)
async def list_definitions(
    entity_type: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    definitions, total = await custom_field_service.list_definitions(
        db, entity_type=entity_type, skip=skip, limit=limit
    )
    return CustomFieldDefinitionListResponse(
        items=[CustomFieldDefinitionRead.model_validate(d) for d in definitions], total=total
    )


@router.get("/definitions/{def_id}", response_model=CustomFieldDefinitionRead)
async def get_definition(
    def_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    definition = await custom_field_service.get_definition(db, def_id)
    return CustomFieldDefinitionRead.model_validate(definition)


@router.post("/definitions", response_model=CustomFieldDefinitionRead, status_code=status.HTTP_201_CREATED)
async def create_definition(
    data: CustomFieldDefinitionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    definition = await custom_field_service.create_definition(
        db,
        field_name=data.field_name,
        field_type=data.field_type,
        entity_type=data.entity_type,
        is_required=data.is_required,
        options=data.options,
        sort_order=data.sort_order,
    )
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "CUSTOM_FIELD_DEF_CREATED", user_id=current_user.id, resource_type="custom_field_definition",
        resource_id=str(definition.id), details={"field_name": definition.field_name, "field_type": definition.field_type}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return CustomFieldDefinitionRead.model_validate(definition)


@router.patch("/definitions/{def_id}", response_model=CustomFieldDefinitionRead)
async def update_definition(
    def_id: int,
    data: CustomFieldDefinitionUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    definition = await custom_field_service.update_definition(
        db, def_id, **data.model_dump(exclude_unset=True)
    )
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "CUSTOM_FIELD_DEF_UPDATED", user_id=current_user.id, resource_type="custom_field_definition",
        resource_id=str(def_id), details=data.model_dump(exclude_unset=True), ip_address=ip, user_agent=ua
    )
    await db.commit()
    return CustomFieldDefinitionRead.model_validate(definition)


@router.delete("/definitions/{def_id}", response_model=CustomFieldDefinitionRead)
async def delete_definition(
    def_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    definition = await custom_field_service.delete_definition(db, def_id)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "CUSTOM_FIELD_DEF_DELETED", user_id=current_user.id, resource_type="custom_field_definition",
        resource_id=str(def_id), details={}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return CustomFieldDefinitionRead.model_validate(definition)


@router.get("/values/{entity_type}/{entity_id}")
async def get_values(
    entity_type: str,
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    values = await custom_field_service.get_values_for_entity(db, entity_type, entity_id)
    return {"values": values}


@router.put("/values/{entity_type}/{entity_id}")
async def set_values(
    entity_type: str,
    entity_id: str,
    data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    values = data.get("values", [])
    created = await custom_field_service.set_values_for_entity(db, entity_type, entity_id, values)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "CUSTOM_FIELD_VALUES_UPDATED", user_id=current_user.id, resource_type=f"{entity_type}_custom_values",
        resource_id=entity_id, details={"count": len(created)}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return {"count": len(created)}
