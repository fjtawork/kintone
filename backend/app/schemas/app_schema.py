from typing import List, Optional, Dict, Any, TYPE_CHECKING
from pydantic import BaseModel, UUID4, Field
from datetime import datetime
from uuid import UUID

class AppCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    theme: Optional[str] = None
    app_acl: Optional[List[Dict[str, Any]]] = None
    record_acl: Optional[List[Dict[str, Any]]] = None

class AppUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    theme: Optional[str] = None
    app_acl: Optional[List[Dict[str, Any]]] = None
    record_acl: Optional[List[Dict[str, Any]]] = None

class AppUserPermissions(BaseModel):
    view: bool
    edit: bool
    delete: bool
    manage: bool = False # Added manage permission

class AppResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    icon: Optional[str]
    theme: Optional[str]
    process_management: Optional[Dict[str, Any]]
    permissions: Optional[Dict[str, Any]]
    app_acl: Optional[List[Dict[str, Any]]]
    record_acl: Optional[List[Dict[str, Any]]]
    view_settings: Optional[Dict[str, Any]] = None
    user_permissions: Optional[AppUserPermissions] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class ProcessManagementUpdate(BaseModel):
    enabled: bool
    statuses: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]

class ViewSettingsUpdate(BaseModel):
    list_fields: Optional[List[str]] = None
    form_columns: Optional[int] = Field(default=None, ge=1, le=3)
