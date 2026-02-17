import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import App
from app.models.user import User
from app.services.app_service import AppService, AppUserPermissions

# Mocking objects to test logic without DB dependencies if possible, 
# or use DB if needed. Let's test the logic function itself first which is pure logic mostly.

def test_permission_logic():
    print("Testing Permission Logic...")
    
    # Setup
    creator_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    dept_id = uuid.uuid4()
    
    creator = User(id=creator_id, is_superuser=False)
    other_user = User(id=other_user_id, is_superuser=False, department_id=dept_id)
    superuser = User(id=uuid.uuid4(), is_superuser=True)
    
    # Case 1: No ACL (Default)
    app_default = App(created_by=creator_id, app_acl=[])
    
    p1 = AppService.evaluate_app_permissions(app_default, creator)
    print(f"Case 1 (Creator): View={p1.view}, Manage={p1.manage} (Expected: T, T)")
    
    p2 = AppService.evaluate_app_permissions(app_default, other_user)
    print(f"Case 1 (Other): View={p2.view}, Manage={p2.manage} (Expected: T, F) -> Default assumes public view")
    
    # Case 2: Restricted View (Dept only)
    acl = [
        {"entity_type": "department", "entity_id": str(dept_id), "allow_view": True, "allow_manage": False},
        {"entity_type": "creator", "entity_id": None, "allow_view": True, "allow_manage": True} 
    ]
    app_restricted = App(created_by=creator_id, app_acl=acl)
    
    p3 = AppService.evaluate_app_permissions(app_restricted, other_user)
    print(f"Case 2 (Dept User): View={p3.view}, Manage={p3.manage} (Expected: T, F)")
    
    stranger = User(id=uuid.uuid4(), is_superuser=False, department_id=uuid.uuid4())
    p4 = AppService.evaluate_app_permissions(app_restricted, stranger)
    print(f"Case 2 (Stranger): View={p4.view}, Manage={p4.manage} (Expected: F, F)")

    # Case 3: Superuser
    p5 = AppService.evaluate_app_permissions(app_restricted, superuser)
    print(f"Case 3 (Superuser): View={p5.view}, Manage={p5.manage} (Expected: T, T)")

    print(f"Case 3 (Superuser): View={p5.view}, Manage={p5.manage} (Expected: T, T)")

from app.models.models import Record
from app.services.record_service import RecordService

def test_record_permission_logic():
    print("\nTesting Record Permission Logic...")
    
    user_creator = User(id=uuid.uuid4(), is_superuser=False)
    user_other = User(id=uuid.uuid4(), is_superuser=False)
    
    # Record Data
    rec1 = Record(created_by=user_creator.id, data={"status": "Private", "title": "Secret"})
    rec2 = Record(created_by=user_creator.id, data={"status": "Public", "title": "Open"})
    
    # ACL: If status=Private, Only Creator View.
    acl = [
        {
            "condition": {"field": "status", "operator": "=", "value": "Private"},
            "permissions": {"view": [{"entity_type": "creator", "entity_id": None}]}
        }
    ]
    
    # Test 1: Private Record
    # Creator Access
    can_view_1 = RecordService.check_record_permission(rec1, user_creator, acl)
    print(f"Rec1 (Private) - Creator: {can_view_1} (Expected: True)")
    
    # Other Access
    can_view_2 = RecordService.check_record_permission(rec1, user_other, acl)
    print(f"Rec1 (Private) - Other: {can_view_2} (Expected: False)")
    
    # Test 2: Public Record (Matches NO rules -> Default Allow)
    can_view_3 = RecordService.check_record_permission(rec2, user_other, acl)
    print(f"Rec2 (Public) - Other: {can_view_3} (Expected: True)")

if __name__ == "__main__":
    test_permission_logic()
    test_record_permission_logic()
