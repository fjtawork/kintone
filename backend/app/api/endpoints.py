from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.schemas.app_schema import AppCreate, AppUpdate, AppResponse, ProcessManagementUpdate, ViewSettingsUpdate
from app.schemas.permission_schema import PermissionUpdate
from app.services.app_service import AppService
from app.api.deps import get_current_user
from app.services.app_service import AppService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("", response_model=AppResponse, status_code=status.HTTP_201_CREATED)
async def create_app(
    app_in: AppCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new App.
    """
    return await AppService.create_app(db, app_in, current_user.id)

@router.get("", response_model=List[AppResponse])
async def read_apps(
    skip: int = 0,
    limit: int = 100,
    created_by: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve apps.
    """
    apps = await AppService.get_apps(db, skip=skip, limit=limit, created_by=created_by)

    visible_apps = []
    for app in apps:
        perms = AppService.evaluate_app_permissions(app, current_user)
        if perms.view:
            app.user_permissions = perms
            visible_apps.append(app)

    return visible_apps

@router.get("/{app_id}", response_model=AppResponse)
async def read_app(
    app_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get app by ID.
    """
    app = await AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
        
    perms = AppService.evaluate_app_permissions(app, current_user)
    if not perms.view:
        raise HTTPException(status_code=403, detail="Not authorized to view this app")
    
    app.user_permissions = perms
    return app

@router.put("/{app_id}", response_model=AppResponse)
async def update_app_general(
    app_id: UUID,
    app_update: AppUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update App General Settings (Name, Description, Icon, Theme).
    """
    app = await AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
        
    perms = AppService.evaluate_app_permissions(app, current_user)
    if not perms.manage:
        raise HTTPException(status_code=403, detail="Not authorized to manage this app")

    updated_app = await AppService.update_app(db, app_id, app_update)
    updated_app.user_permissions = perms
    return updated_app

@router.put("/{app_id}/process", response_model=AppResponse)
async def update_process_management(
    app_id: UUID,
    pm_update: ProcessManagementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update App Process Management settings.
    """
    app = await AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
        
    perms = AppService.evaluate_app_permissions(app, current_user)
    if not perms.manage:
        raise HTTPException(status_code=403, detail="Not authorized to manage this app")

    try:
        app = await AppService.update_process_management(db, app_id, pm_update)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    app.user_permissions = perms
    return app

@router.put("/{app_id}/permissions", response_model=AppResponse)
async def update_permissions(
    app_id: UUID,
    permissions_in: PermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update App Permissions.
    """
    app = await AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    perms = AppService.evaluate_app_permissions(app, current_user)
    if not perms.manage:
        raise HTTPException(status_code=403, detail="Not authorized to manage permissions")

    # TODO: Update app_acl/record_acl if passed, currently PermissionUpdate might be old format only?
    # For now assume we use update_app for new ACLs or we need to update PermissionUpdate schema.
    # Actually, let's allow updating old permissions for backward compatibility or remove it?
    # Keeping it simple for now, we just rely on update_permissions for legacy field.
    
    app = await AppService.update_permissions(db, app_id, permissions_in.model_dump())
    app.user_permissions = perms
    return app

@router.put("/{app_id}/view", response_model=AppResponse)
async def update_view_settings(
    app_id: UUID,
    view_update: ViewSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update App View settings (List View columns).
    """
    app = await AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
        
    perms = AppService.evaluate_app_permissions(app, current_user)
    if not perms.manage:
        raise HTTPException(status_code=403, detail="Not authorized to manage this app")

    app = await AppService.update_view_settings(db, app_id, view_update)
    app.user_permissions = perms
    return app
