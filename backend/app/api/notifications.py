from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.notification_schema import (
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter()


def _to_response(item) -> NotificationResponse:
    link_path = None
    if item.app_id and item.record_id:
        link_path = f"/apps/{item.app_id}/records/{item.record_id}"
    elif item.app_id:
        link_path = f"/apps/{item.app_id}"

    return NotificationResponse(
        id=item.id,
        user_id=item.user_id,
        app_id=item.app_id,
        record_id=item.record_id,
        kind=item.kind,
        title=item.title,
        message=item.message,
        is_read=item.is_read,
        created_at=item.created_at,
        read_at=item.read_at,
        link_path=link_path,
    )


@router.get("", response_model=NotificationListResponse)
async def read_notifications(
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = await NotificationService.list_notifications(
        db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
    )
    unread_count = await NotificationService.unread_count(db, user_id=current_user.id)
    return NotificationListResponse(items=[_to_response(item) for item in items], unread_count=unread_count)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = await NotificationService.mark_read(
        db, notification_id=notification_id, user_id=current_user.id
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return _to_response(notification)


@router.patch("/read-all", response_model=MarkAllReadResponse)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = await NotificationService.mark_all_read(db, user_id=current_user.id)
    return MarkAllReadResponse(updated=updated)
