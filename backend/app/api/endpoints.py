from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.schemas.app_schema import AppCreate, AppResponse
from app.services.app_service import AppService

router = APIRouter()

@router.post("/", response_model=AppResponse, status_code=status.HTTP_201_CREATED)
async def create_app(
    app_in: AppCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new App.
    """
    return await AppService.create_app(db, app_in)

@router.get("/", response_model=List[AppResponse])
async def read_apps(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve apps.
    """
    return await AppService.get_apps(db, skip=skip, limit=limit)

@router.get("/{app_id}", response_model=AppResponse)
async def read_app(
    app_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get app by ID.
    """
    app = await AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app
