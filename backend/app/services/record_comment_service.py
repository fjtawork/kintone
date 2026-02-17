from typing import List
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.record_comment import RecordComment
from app.models.user import User


class RecordCommentService:
    @staticmethod
    async def list_comments(db: AsyncSession, record_id: UUID, limit: int = 100) -> List[dict]:
        safe_limit = max(1, min(limit, 300))

        query = (
            select(
                RecordComment.id,
                RecordComment.record_id,
                RecordComment.user_id,
                RecordComment.message,
                RecordComment.created_at,
                User.full_name,
                User.email,
            )
            .join(User, User.id == RecordComment.user_id)
            .where(RecordComment.record_id == record_id)
            .order_by(RecordComment.created_at.asc())
            .limit(safe_limit)
        )

        rows = (await db.execute(query)).all()
        return [
            {
                "id": row.id,
                "record_id": row.record_id,
                "user_id": row.user_id,
                "user_name": row.full_name or row.email,
                "message": row.message,
                "created_at": row.created_at,
            }
            for row in rows
        ]

    @staticmethod
    async def add_comment(
        db: AsyncSession,
        record_id: UUID,
        user_id: UUID,
        message: str,
        max_messages: int = 300,
    ) -> dict:
        max_limit = max(1, min(max_messages, 1000))

        count_query = select(func.count(RecordComment.id)).where(RecordComment.record_id == record_id)
        existing_count = int((await db.execute(count_query)).scalar() or 0)

        overflow = existing_count - max_limit + 1
        if overflow > 0:
            oldest_ids_query = (
                select(RecordComment.id)
                .where(RecordComment.record_id == record_id)
                .order_by(RecordComment.created_at.asc())
                .limit(overflow)
            )
            oldest_ids = list((await db.execute(oldest_ids_query)).scalars().all())
            if oldest_ids:
                await db.execute(delete(RecordComment).where(RecordComment.id.in_(oldest_ids)))

        comment = RecordComment(record_id=record_id, user_id=user_id, message=message.strip())
        db.add(comment)
        await db.commit()
        await db.refresh(comment)

        user = await db.get(User, user_id)
        return {
            "id": comment.id,
            "record_id": comment.record_id,
            "user_id": comment.user_id,
            "user_name": (user.full_name if user else None) or (user.email if user else None),
            "message": comment.message,
            "created_at": comment.created_at,
        }

    @staticmethod
    async def list_active_users_for_mentions(
        db: AsyncSession,
        query_text: str | None = None,
        fetch_limit: int = 200,
    ) -> List[User]:
        safe_limit = max(1, min(fetch_limit, 500))
        query = select(User).where(User.is_active.is_(True))
        if query_text:
            pattern = f"%{query_text.strip()}%"
            query = query.where((User.full_name.ilike(pattern)) | (User.email.ilike(pattern)))
        query = query.order_by(User.full_name.asc().nullslast(), User.email.asc()).limit(safe_limit)
        return list((await db.execute(query)).scalars().all())
