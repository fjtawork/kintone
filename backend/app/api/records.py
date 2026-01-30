from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.schemas.record_schema import RecordCreate, RecordResponse
from app.services.record_service import RecordService

router = APIRouter()

@router.post("/", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
async def create_record(
    record_in: RecordCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new Record.
    """
    return await RecordService.create_record(db, record_in)

@router.get("/", response_model=List[RecordResponse])
async def read_records(
    app_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Get records for an App.
    """
    return await RecordService.get_records(db, app_id, skip=skip, limit=limit)

@router.get("/{record_id}", response_model=RecordResponse)
async def read_record(
    record_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get record by ID.
    """
    record = await RecordService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record
