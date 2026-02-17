from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification


class NotificationService:
    @staticmethod
    async def create_notification(
        db: AsyncSession,
        *,
        user_id: UUID,
        title: str,
        message: str,
        kind: str = "workflow_terminal",
        app_id: Optional[UUID] = None,
        record_id: Optional[UUID] = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            app_id=app_id,
            record_id=record_id,
            kind=kind,
            title=title,
            message=message,
            is_read=False,
        )
        db.add(notification)
        await db.flush()
        return notification

    @staticmethod
    async def list_notifications(
        db: AsyncSession,
        *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> List[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read.is_(False))
        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def unread_count(db: AsyncSession, *, user_id: UUID) -> int:
        query = select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.is_read.is_(False)
        )
        result = await db.execute(query)
        return int(result.scalar() or 0)

    @staticmethod
    async def mark_read(db: AsyncSession, *, notification_id: UUID, user_id: UUID) -> Optional[Notification]:
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return None
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(notification)
        return notification

    @staticmethod
    async def mark_all_read(db: AsyncSession, *, user_id: UUID) -> int:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True, read_at=now)
        )
        await db.commit()
        return result.rowcount or 0
