import pytest
from uuid import uuid4
from unittest.mock import MagicMock
from app.services.app_service import AppService
from app.services.record_service import RecordService
from app.models.models import App, Record
from app.models.user import User

# --- Fixtures ---
@pytest.fixture
def mock_users():
    dept_sales = uuid4()
    dept_dev = uuid4()
    title_manager = uuid4()
    
    return {
        "admin": User(id=uuid4(), is_superuser=True),
        "creator": User(id=uuid4(), is_superuser=False, department_id=dept_dev),
        "sales_user": User(id=uuid4(), is_superuser=False, department_id=dept_sales),
        "sales_manager": User(id=uuid4(), is_superuser=False, department_id=dept_sales, job_title_id=title_manager),
        "stranger": User(id=uuid4(), is_superuser=False),
        "dept_sales_id": dept_sales,
        "title_manager_id": title_manager
    }

# --- App Permission Tests ---

def test_app_permission_default(mock_users):
    """Test default behavior when no ACL is present."""
    creator = mock_users["creator"]
    other = mock_users["sales_user"]
    app = App(created_by=creator.id, app_acl=[])

    # Creator should have full access
    perms_creator = AppService.evaluate_app_permissions(app, creator)
    assert perms_creator.view is True
    assert perms_creator.manage is True
    assert perms_creator.edit is True
    assert perms_creator.delete is True

    # Other should only have View access
    perms_other = AppService.evaluate_app_permissions(app, other)
    assert perms_other.view is True
    assert perms_other.manage is False
    assert perms_other.edit is False
    assert perms_other.delete is False

def test_app_permission_superuser_bypass(mock_users):
    """Superuser should always have full access."""
    admin = mock_users["admin"]
    # Even with an empty or restrictive ACL
    app = App(created_by=uuid4(), app_acl=[{"entity_type": "everyone", "allow_view": False}])

    perms = AppService.evaluate_app_permissions(app, admin)
    assert perms.view is True
    assert perms.manage is True

def test_app_permission_acl_user(mock_users):
    """Test ACL for specific user."""
    user = mock_users["sales_user"]
    user_id = str(user.id)
    app = App(created_by=uuid4(), app_acl=[
        {"entity_type": "user", "entity_id": user_id, "allow_view": True, "allow_manage": True}
    ])

    perms = AppService.evaluate_app_permissions(app, user)
    assert perms.view is True
    assert perms.manage is True

    # Stranger should fail
    perms_stranger = AppService.evaluate_app_permissions(app, mock_users["stranger"])
    assert perms_stranger.view is False
    assert perms_stranger.manage is False

def test_app_permission_acl_dept(mock_users):
    """Test ACL for department."""
    sales_user = mock_users["sales_user"]
    dept_id = str(mock_users["dept_sales_id"])
    
    app = App(created_by=uuid4(), app_acl=[
        {"entity_type": "department", "entity_id": dept_id, "allow_view": True, "allow_edit": True}
    ])

    perms = AppService.evaluate_app_permissions(app, sales_user)
    assert perms.view is True
    assert perms.edit is True
    
    # Dev user should faile
    perms_dev = AppService.evaluate_app_permissions(app, mock_users["creator"])
    assert perms_dev.view is False

# --- Record Permission Tests ---

def test_record_permission_no_rules(mock_users):
    """No rules = Allow All."""
    user = mock_users["stranger"]
    record = Record(data={"status": "Secret"})
    assert RecordService.check_record_permission(record, user, []) is True

def test_record_permission_condition_mismatch(mock_users):
    """Condition does not match = Rule Skipped = Default Allow."""
    user = mock_users["stranger"]
    record = Record(data={"status": "Public"})
    acl = [
        # Rule applies only to Private
        {"condition": {"field": "status", "operator": "=", "value": "Private"}, "permissions": {"view": []}}
    ]
    # Record is Public, so rule doesn't apply -> Allow
    assert RecordService.check_record_permission(record, user, acl) is True

def test_record_permission_condition_match_deny(mock_users):
    """Condition matches, user NOT in permission list = Deny."""
    user = mock_users["stranger"]
    record = Record(data={"status": "Private"})
    acl = [
        {"condition": {"field": "status", "operator": "=", "value": "Private"}, "permissions": {"view": [{"entity_type": "creator"}]}}
    ]
    # Stranger is not creator
    assert RecordService.check_record_permission(record, user, acl) is False

def test_record_permission_condition_match_allow(mock_users):
    """Condition matches, user IS in permission list = Allow."""
    creator = mock_users["creator"]
    record = Record(data={"status": "Private"}, created_by=creator.id)
    acl = [
        {"condition": {"field": "status", "operator": "=", "value": "Private"}, "permissions": {"view": [{"entity_type": "creator"}]}}
    ]
    assert RecordService.check_record_permission(record, creator, acl) is True

def test_record_permission_priority(mock_users):
    """Test First Match Wins logic (Rule 1 vs Rule 2)."""
    user = mock_users["stranger"]
    record = Record(data={"status": "Confidential", "type": "Report"})
    
    # Rule 1: status=Confidential -> Only Admin (Stranger Denied)
    # Rule 2: type=Report -> Everyone (Stranger Allowed)
    
    # If standard top-down logic: Rule 1 matches -> Process Permissions -> Deny. Rule 2 ignored.
    acl = [
        {
            "condition": {"field": "status", "operator": "=", "value": "Confidential"},
            "permissions": {"view": [{"entity_type": "user", "entity_id": str(mock_users["admin"].id)}]} # Only admin
        },
        {
            "condition": {"field": "type", "operator": "=", "value": "Report"},
            "permissions": {"view": [{"entity_type": "everyone"}]}
        }
    ]
    
    # Should be DENIED because Rule 1 matches and denies.
    assert RecordService.check_record_permission(record, user, acl) is False

def test_record_permission_priority_reverse(mock_users):
    """Test First Match Wins logic (Reverse order)."""
    user = mock_users["stranger"]
    record = Record(data={"status": "Confidential", "type": "Report"})
    
    # Same rules, reversed order.
    # Rule 1: type=Report -> Everyone (Stranger Allowed)
    # Rule 2: status=Confidential -> Only Admin
    
    acl = [
        {
            "condition": {"field": "type", "operator": "=", "value": "Report"},
            "permissions": {"view": [{"entity_type": "everyone"}]}
        },
        {
            "condition": {"field": "status", "operator": "=", "value": "Confidential"},
            "permissions": {"view": [{"entity_type": "user", "entity_id": str(mock_users["admin"].id)}]} 
        }
    ]
    
    # Should be ALLOWED because Rule 1 matches first and allows.
    assert RecordService.check_record_permission(record, user, acl) is True

def test_record_permission_multiple_entities(mock_users):
    """Condition matches, check multiple entities in allow list."""
    sales_user = mock_users["sales_user"]
    manager = mock_users["sales_manager"]
    stranger = mock_users["stranger"]
    dept_id = str(mock_users["dept_sales_id"])
    
    record = Record(data={"secret": "true"})
    
    acl = [
        {
            "condition": {"field": "secret", "operator": "=", "value": "true"},
            "permissions": {
                "view": [
                    {"entity_type": "department", "entity_id": dept_id},
                    {"entity_type": "job_title", "entity_id": str(mock_users["title_manager_id"])} 
                ]
            }
        }
    ]
    
    # Sales User (Matches Dept) -> Allow
    assert RecordService.check_record_permission(record, sales_user, acl) is True
    
    # Manager (Matches Dept AND Job Title) -> Allow
    assert RecordService.check_record_permission(record, manager, acl) is True
    
    # Stranger -> Deny
    assert RecordService.check_record_permission(record, stranger, acl) is False
