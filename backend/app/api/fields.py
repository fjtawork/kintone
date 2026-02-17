from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.schemas.field_schema import FieldCreate, FieldResponse
from app.services.field_service import FieldService

router = APIRouter()

@router.post("", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
async def create_field(
    field_in: FieldCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Add a field to an App.
    """
    return await FieldService.create_field(db, field_in)

@router.get("/app/{app_id}", response_model=List[FieldResponse])
async def read_fields(
    app_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all fields for a specific App.
    """
    return await FieldService.get_fields_by_app(db, app_id)

@router.put("/app/{app_id}", response_model=List[FieldResponse])
async def sync_fields(
    app_id: UUID,
    fields_in: List[FieldCreate],
    db: AsyncSession = Depends(get_db)
):
    """
    Replace all fields for an App.
    """
    return await FieldService.sync_fields(db, app_id, fields_in)
