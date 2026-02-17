from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Department Schemas
class DepartmentBase(BaseModel):
    name: str
    code: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None

class DepartmentResponse(DepartmentBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# JobTitle Schemas
class JobTitleBase(BaseModel):
    name: str
    rank: int = 0

class JobTitleCreate(JobTitleBase):
    pass

class JobTitleUpdate(BaseModel):
    name: Optional[str] = None
    rank: Optional[int] = None

class JobTitleResponse(JobTitleBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
