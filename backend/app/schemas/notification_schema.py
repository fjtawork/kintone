from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    app_id: Optional[UUID] = None
    record_id: Optional[UUID] = None
    kind: str
    title: str
    message: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    link_path: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    unread_count: int


class MarkAllReadResponse(BaseModel):
    updated: int
