from typing import Optional
from pydantic import BaseModel
from uuid import UUID

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    department_id: Optional[UUID] = None
    job_title_id: Optional[UUID] = None

class UserResponse(UserBase):
    id: UUID
    department_id: Optional[UUID] = None
    job_title_id: Optional[UUID] = None
    id: UUID

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[UUID] = None
