from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.schemas.record_schema import RecordCreate, RecordResponse, RecordUpdate
from app.schemas.process_schema import RecordStatusUpdate, WorkflowActionExecuteRequest
from app.services.record_service import RecordService
from app.api.deps import get_current_user
from app.models.user import User
from app.services.permission_service import PermissionService
from app.services.app_service import AppService

router = APIRouter()

@router.post("", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
async def create_record(
    record_in: RecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new Record.
    """
    # Check App Record Create Permission (Mapped to 'edit' or custom 'create'?)
    # Kintone Permissions: App View/Edit/Delete, Record View/Edit/Delete.
    # Usually 'add' is a separate permission or grouped with Edit. 
    # For MVP, let's assume 'edit' permission on App (or Record 'edit' for new records? No, record doesn't exist yet)
    # Actually, often "Allow Adding Records" is an App-level permission.
    # Let's use 'edit' on App for now as a proxy or just allow if can view app?
    # Better: Check Record 'edit' permission for "everyone" or "creator" (wait, creator is me).
    # If Record Edit is allowed for "creator", then I can create?
    # Let's simplify: If I can view the app, let's assume I can add records for now unless strict check needed.
    # Or strict: Check App 'edit' permission?
    
    app = await AppService.get_app(db, record_in.app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
        
    # Temporary: Allow creation if user can view app
    if not PermissionService.check_app_permission(current_user, app, 'view'):
         raise HTTPException(status_code=403, detail="Not authorized")

    return await RecordService.create_record(db, record_in, current_user.id)

@router.get("", response_model=List[RecordResponse])
async def read_records(
    app_id: UUID,
    skip: int = 0,
    limit: int = 100,
    filters: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get records for an App with optional filtering.
    """
    app = await AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    perms = AppService.evaluate_app_permissions(app, current_user)
    if not perms.view:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    filter_dict = {}
    if filters:
        try:
            import json
            filter_dict = json.loads(filters)
        except json.JSONDecodeError:
             raise HTTPException(status_code=400, detail="Invalid filters JSON")

    return await RecordService.get_records(
        db, 
        app_id, 
        skip=skip, 
        limit=limit, 
        filters=filter_dict,
        user=current_user,
        app_record_acl=app.record_acl
    )


@router.get("/pending-approvals", response_model=List[RecordResponse])
async def read_pending_approvals(
    app_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get records currently waiting for current user's approval.
    """
    records = await RecordService.get_pending_approvals_for_user(
        db=db,
        user_id=current_user.id,
        app_id=app_id,
    )

    if current_user.is_superuser:
        return records

    app_cache = {}
    visible = []
    for record in records:
        if record.app_id not in app_cache:
            app_cache[record.app_id] = await AppService.get_app(db, record.app_id)
        app = app_cache[record.app_id]
        if app and AppService.evaluate_app_permissions(app, current_user).view:
            visible.append(record)
    return visible

@router.get("/{record_id}", response_model=RecordResponse)
async def read_record(
    record_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get record by ID.
    """
    record = await RecordService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
        
    app = await AppService.get_app(db, record.app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    # App View Check
    app_perms = AppService.evaluate_app_permissions(app, current_user)
    if not app_perms.view:
        raise HTTPException(status_code=403, detail="Not authorized to view this app")

    # Record ACL Check
    if not RecordService.check_record_permission(record, current_user, app.record_acl):
        raise HTTPException(status_code=403, detail="Not authorized to view this record")

    return record

@router.put("/{record_id}/status", response_model=RecordResponse)
async def update_record_status(
    record_id: UUID,
    status_update: RecordStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update Record Status.
    """
    record = await RecordService.update_status(db, record_id, status_update.action)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.put("/{record_id}", response_model=RecordResponse)
async def update_record(
    record_id: UUID,
    record_update: RecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update Record Data.
    """
    record = await RecordService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    app = await AppService.get_app(db, record.app_id)
    if not app:
          raise HTTPException(status_code=404, detail="App not found")

    # Permission Check
    if not PermissionService.check_app_permission(current_user, app, 'edit'):
        # Just checking app edit permission for now. 
        # Ideally check record edit permission if granular.
        # If I am creator of record, maybe I can edit?
        # For now, strict app edit permission.
        raise HTTPException(status_code=403, detail="Not authorized to edit record")

    updated_record = await RecordService.update_record(db, record_id, record_update)
    return updated_record


@router.post("/{record_id}/workflow/actions/{action_name}", response_model=RecordResponse)
async def execute_workflow_action(
    record_id: UUID,
    action_name: str,
    request: WorkflowActionExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = await RecordService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    app = await AppService.get_app(db, record.app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    app_perms = AppService.evaluate_app_permissions(app, current_user)
    if not app_perms.view:
        raise HTTPException(status_code=403, detail="Not authorized to access this app")

    try:
        updated = await RecordService.execute_workflow_action(
            db=db,
            app=app,
            record_id=record_id,
            actor=current_user,
            action_name=action_name,
            next_assignee_id=request.next_assignee_id,
            comment=request.comment,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not updated:
        raise HTTPException(status_code=404, detail="Record not found")
    return updated
