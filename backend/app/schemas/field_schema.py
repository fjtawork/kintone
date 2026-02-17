from typing import List, Optional, Any, Dict
from pydantic import BaseModel, UUID4
from uuid import UUID

class FieldBase(BaseModel):
    code: str
    type: str # e.g. "SINGLE_LINE_TEXT"
    label: str
    config: Optional[Dict[str, Any]] = {}
    options: Optional[List[str]] = None
    related_app_id: Optional[str] = None

class FieldCreate(FieldBase):
    app_id: UUID

class FieldResponse(FieldBase):
    id: UUID
    app_id: UUID

    class Config:
        from_attributes = True

class FieldBatchUpdate(BaseModel):
    fields: List[FieldCreate]
