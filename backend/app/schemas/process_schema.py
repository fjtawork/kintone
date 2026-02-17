from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class RecordStatusUpdate(BaseModel):
    action: str # Name of the action (e.g. "Start", "Complete")
    assignee: str | None = None # Optional assignee


class WorkflowActionExecuteRequest(BaseModel):
    next_assignee_id: Optional[UUID] = None
    comment: Optional[str] = None
