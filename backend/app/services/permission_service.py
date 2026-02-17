from uuid import UUID
from app.models.models import App, Record
from app.models.user import User

class PermissionService:
    @staticmethod
    def check_app_permission(user: User, app: App, action: str) -> bool:
        """
        Check if user has permission to perform action on app.
        action: 'view', 'edit', 'delete'
        """
        if user.is_superuser:
            return True
        
        # Default permissions if not set
        permissions = app.permissions or {}
        app_perms = permissions.get("app", {})
        allowed_groups = app_perms.get(action, [])
        
        if "everyone" in allowed_groups:
            return True
        
        if "creator" in allowed_groups and app.created_by == user.id:
            return True
            
        # TODO: Add specific user/group checks later
        
        return False

    @staticmethod
    def check_record_permission(user: User, record: Record, app: App, action: str) -> bool:
        """
        Check if user has permission to perform action on record.
        action: 'view', 'edit', 'delete'
        """
        if user.is_superuser:
            return True
            
        permissions = app.permissions or {}
        record_perms = permissions.get("record", {})
        allowed_groups = record_perms.get(action, [])
        
        if "everyone" in allowed_groups:
            return True
            
        if "creator" in allowed_groups:
            # Check if user created the record
            if record.created_by == user.id:
                return True
                
        return False
