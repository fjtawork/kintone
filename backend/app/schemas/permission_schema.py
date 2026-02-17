from pydantic import BaseModel
from typing import Dict, List, Any

class PermissionUpdate(BaseModel):
    app: Dict[str, List[str]]
    record: Dict[str, List[str]]
    fields: Dict[str, Any]
