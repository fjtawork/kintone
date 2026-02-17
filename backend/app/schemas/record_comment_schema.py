from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RecordCommentCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class RecordCommentResponse(BaseModel):
    id: UUID
    record_id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class MentionCandidateResponse(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    email: str
