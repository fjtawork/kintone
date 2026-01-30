from pydantic import BaseModel, Field as PydanticField
from typing import Optional, Any, Dict, List
from uuid import UUID
from datetime import datetime

class RecordBase(BaseModel):
    app_id: UUID
    record_number: Optional[int] = None # Server generated, but can be part of response
    status: Optional[str] = "Draft"
    data: Dict[str, Any] = PydanticField(default={}, description="Dynamic data matching app schema")

class RecordCreate(RecordBase):
    pass

class RecordResponse(RecordBase):
    id: UUID
    record_number: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
