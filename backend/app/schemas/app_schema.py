from pydantic import BaseModel, Field as PydanticField
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# Shared properties
class AppBase(BaseModel):
    name: str = PydanticField(min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None

# Properties to receive on creation
class AppCreate(AppBase):
    pass

# Properties to return to client
class AppResponse(AppBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
