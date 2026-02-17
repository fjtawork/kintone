from pydantic import BaseModel, Field as PydanticField
from typing import Optional, Any, Dict, List
from uuid import UUID
from datetime import datetime

class RecordBase(BaseModel):
    app_id: UUID
    record_number: Optional[int] = None # Server generated, but can be part of response
    status: Optional[str] = None
    data: Dict[str, Any] = PydanticField(default={}, description="Dynamic data matching app schema")

class RecordCreate(RecordBase):
    pass

class RecordUpdate(BaseModel):
    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class WorkflowEvent(BaseModel):
    actor_id: UUID
    action: str
    comment: Optional[str] = None
    at: datetime

class RecordResponse(RecordBase):
    id: UUID
    record_number: int
    created_by: Optional[UUID] = None
    workflow_requester_id: Optional[UUID] = None
    workflow_approver_ids: List[UUID] = PydanticField(default_factory=list)
    workflow_current_step: int = 0
    workflow_submitted_at: Optional[datetime] = None
    workflow_decided_at: Optional[datetime] = None
    workflow_history: List[WorkflowEvent] = PydanticField(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecordListResponse(BaseModel):
    id: UUID
    app_id: UUID
    record_number: int
    status: Optional[str] = None
    data: Dict[str, Any] = PydanticField(default={}, description="Subset data for list view")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecordListPageResponse(BaseModel):
    items: List[RecordListResponse]
    next_cursor: Optional[int] = None
    has_next: bool
