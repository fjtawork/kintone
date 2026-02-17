from uuid import UUID
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.record_comment_schema import (
    MentionCandidateResponse,
    RecordCommentCreate,
    RecordCommentResponse,
)
from app.services.app_service import AppService
from app.services.notification_service import NotificationService
from app.services.record_comment_service import RecordCommentService
from app.services.record_service import RecordService

router = APIRouter()


def _message_preview(text: str, limit: int = 20) -> str:
    first_line = (text or "").strip().splitlines()[0] if (text or "").strip() else ""
    if len(first_line) <= limit:
        return first_line
    return f"{first_line[:limit]}..."


def _mention_keys_for_user(user: User) -> set[str]:
    keys: set[str] = set()
    if user.full_name:
        keys.add(user.full_name.strip().lower())
    if user.email:
        keys.add(user.email.lower())
        local = user.email.split("@", 1)[0].strip().lower()
        if local:
            keys.add(local)
    return {k for k in keys if k}


def _is_key_mentioned(message_lower: str, key: str) -> bool:
    if not key:
        return False
    # Allow mentions like "@Sales Manager", "@sales_manager", "@user@example.com".
    # Enforce a boundary after the key to avoid partial matches.
    pattern = re.compile(rf"(?<!\S)@{re.escape(key)}(?=$|[\s.,!?:;、。])", re.IGNORECASE)
    return bool(pattern.search(message_lower))


def _chat_settings(app) -> tuple[bool, int]:
    view_settings = app.view_settings or {}
    enabled = bool(view_settings.get("record_chat_enabled", False))
    max_messages = int(view_settings.get("record_chat_max_messages", 300) or 300)
    max_messages = max(1, min(max_messages, 1000))
    return enabled, max_messages


async def _load_authorized_record(db: AsyncSession, current_user: User, record_id: UUID):
    record = await RecordService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    app = await AppService.get_app(db, record.app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    perms = AppService.evaluate_app_permissions(app, current_user)
    if not perms.view:
        raise HTTPException(status_code=403, detail="Not authorized to view this app")

    if not RecordService.check_record_permission(record, current_user, app.record_acl):
        raise HTTPException(status_code=403, detail="Not authorized to view this record")

    return app, record


@router.get("/{record_id}/comments", response_model=list[RecordCommentResponse])
async def list_record_comments(
    record_id: UUID,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app, record = await _load_authorized_record(db, current_user, record_id)
    enabled, _ = _chat_settings(app)
    if not enabled:
        return []

    return await RecordCommentService.list_comments(db, record.id, limit=limit)


@router.post("/{record_id}/comments", response_model=RecordCommentResponse)
async def create_record_comment(
    record_id: UUID,
    payload: RecordCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app, record = await _load_authorized_record(db, current_user, record_id)
    enabled, max_messages = _chat_settings(app)
    if not enabled:
        raise HTTPException(status_code=400, detail="Record chat is disabled for this app")

    created = await RecordCommentService.add_comment(
        db,
        record_id=record.id,
        user_id=current_user.id,
        message=payload.message,
        max_messages=max_messages,
    )

    message_lower = (payload.message or "").lower()
    if "@" in message_lower:
        users = list((await db.execute(select(User).where(User.is_active.is_(True)))).scalars().all())
        sender = current_user.full_name or current_user.email
        preview = _message_preview(payload.message or "", 20)
        target_user_ids: set[str] = set()
        for user in users:
            if str(user.id) == str(current_user.id):
                continue
            mention_keys = _mention_keys_for_user(user)
            if not any(_is_key_mentioned(message_lower, key) for key in mention_keys):
                continue
            app_perms = AppService.evaluate_app_permissions(app, user)
            if not app_perms.view:
                continue
            if not RecordService.check_record_permission(record, user, app.record_acl):
                continue
            if str(user.id) in target_user_ids:
                continue
            target_user_ids.add(str(user.id))

            await NotificationService.create_notification(
                db,
                user_id=user.id,
                app_id=record.app_id,
                record_id=record.id,
                kind="record_mention",
                title=f"[{app.name}] {sender} からメンション",
                message=preview or "メンションがあります。",
            )
        await db.commit()

    return created


@router.get("/{record_id}/mention-candidates", response_model=list[MentionCandidateResponse])
async def list_mention_candidates(
    record_id: UUID,
    q: str | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app, record = await _load_authorized_record(db, current_user, record_id)
    enabled, _ = _chat_settings(app)
    if not enabled:
        return []

    users = await RecordCommentService.list_active_users_for_mentions(
        db,
        query_text=q,
        fetch_limit=max(limit * 10, 200),
    )

    visible = []
    for user in users:
        app_perms = AppService.evaluate_app_permissions(app, user)
        if not app_perms.view:
            continue
        if not RecordService.check_record_permission(record, user, app.record_acl):
            continue
        visible.append({
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
        })
        if len(visible) >= max(1, min(limit, 100)):
            break

    return visible
