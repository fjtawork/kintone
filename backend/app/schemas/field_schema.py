from pydantic import BaseModel, Field as PydanticField
from typing import Optional, Any, Dict
from uuid import UUID

class FieldBase(BaseModel):
    code: str = PydanticField(min_length=1, max_length=100, description="Unique field code in the app")
    label: str = PydanticField(min_length=1, max_length=100)
    type: str = PydanticField(description="SINGLE_LINE_TEXT, NUMBER, etc.")
    config: Optional[Dict[str, Any]] = {}

class FieldCreate(FieldBase):
    app_id: UUID

class FieldResponse(FieldBase):
    id: UUID
    app_id: UUID

    class Config:
        from_attributes = True
