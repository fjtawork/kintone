import pytest
from httpx import AsyncClient


async def signup_and_login(client: AsyncClient, email: str, password: str = "password123") -> dict:
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def create_user_selection_field(client: AsyncClient, app_id: str, code: str, label: str) -> None:
    response = await client.post(
        "/api/v1/fields",
        json={
            "app_id": app_id,
            "type": "USER_SELECTION",
            "code": code,
            "label": label,
            "config": {},
        },
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_workflow_transition_by_app_process_settings(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf_requester@example.com")
    manager_headers = await signup_and_login(client, "wf_manager@example.com")
    director_headers = await signup_and_login(client, "wf_director@example.com")

    manager_me = await client.get("/api/v1/users/me", headers=manager_headers)
    manager_id = manager_me.json()["id"]
    director_me = await client.get("/api/v1/users/me", headers=director_headers)
    director_id = director_me.json()["id"]

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]
    await create_user_selection_field(client, app_id, "manager_user_id", "Manager")
    await create_user_selection_field(client, app_id, "director_user_id", "Director")

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {
                "name": "Manager Approval",
                "assignee": {"type": "field", "field_code": "manager_user_id", "selection": "single"},
            },
            {"name": "Director Approval", "assignee": {"type": "field", "field_code": "director_user_id"}},
            {"name": "Approved", "assignee": {}},
        ],
        "actions": [
            {"name": "Submit", "from": "Draft", "to": "Manager Approval"},
            {"name": "Approve", "from": "Manager Approval", "to": "Director Approval"},
            {"name": "Final Approve", "from": "Director Approval", "to": "Approved"},
        ],
    }
    pm_res = await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)
    assert pm_res.status_code == 200

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={
            "app_id": app_id,
            "data": {"title": "Buy Service", "manager_user_id": manager_id, "director_user_id": director_id},
        },
    )
    assert record_res.status_code == 201
    record_id = record_res.json()["id"]

    submit = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=requester_headers,
        json={},
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == "Manager Approval"
    assert submit.json()["workflow_approver_ids"] == [manager_id]

    manager_pending = await client.get("/api/v1/records/pending-approvals", headers=manager_headers)
    assert manager_pending.status_code == 200
    assert any(r["id"] == record_id for r in manager_pending.json())

    director_try = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Approve",
        headers=director_headers,
        json={},
    )
    assert director_try.status_code == 403

    manager_approve = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Approve",
        headers=manager_headers,
        json={},
    )
    assert manager_approve.status_code == 200
    assert manager_approve.json()["status"] == "Director Approval"
    assert manager_approve.json()["workflow_approver_ids"] == [director_id]

    director_approve = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Final Approve",
        headers=director_headers,
        json={},
    )
    assert director_approve.status_code == 200
    assert director_approve.json()["status"] == "Approved"
    assert director_approve.json()["workflow_approver_ids"] == []


@pytest.mark.asyncio
async def test_workflow_single_selection_requires_next_assignee(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf2_requester@example.com")
    approver1_headers = await signup_and_login(client, "wf2_approver1@example.com")
    approver2_headers = await signup_and_login(client, "wf2_approver2@example.com")

    approver1_id = (await client.get("/api/v1/users/me", headers=approver1_headers)).json()["id"]
    approver2_id = (await client.get("/api/v1/users/me", headers=approver2_headers)).json()["id"]

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App 2"})
    app_id = app_res.json()["id"]

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {
                "name": "Team Approval",
                "assignee": {
                    "type": "users",
                    "user_ids": [approver1_id, approver2_id],
                    "selection": "single",
                },
            },
        ],
        "actions": [{"name": "Submit", "from": "Draft", "to": "Team Approval"}],
    }
    await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={"app_id": app_id, "data": {"title": "Need approval"}},
    )
    record_id = record_res.json()["id"]

    no_next_assignee = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=requester_headers,
        json={},
    )
    assert no_next_assignee.status_code == 400
    assert "next_assignee_id is required" in no_next_assignee.json()["detail"]

    with_next_assignee = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=requester_headers,
        json={"next_assignee_id": approver2_id},
    )
    assert with_next_assignee.status_code == 200
    assert with_next_assignee.json()["workflow_approver_ids"] == [approver2_id]


@pytest.mark.asyncio
async def test_workflow_reject_transition(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf3_requester@example.com")
    manager_headers = await signup_and_login(client, "wf3_manager@example.com")
    manager_id = (await client.get("/api/v1/users/me", headers=manager_headers)).json()["id"]

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App 3"})
    app_id = app_res.json()["id"]
    await create_user_selection_field(client, app_id, "manager_user_id", "Manager")

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {"name": "Manager Approval", "assignee": {"type": "field", "field_code": "manager_user_id"}},
        ],
        "actions": [
            {"name": "Submit", "from": "Draft", "to": "Manager Approval"},
            {"name": "Reject", "from": "Manager Approval", "to": "Draft"},
        ],
    }
    await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={"app_id": app_id, "data": {"title": "Need reject flow", "manager_user_id": manager_id}},
    )
    record_id = record_res.json()["id"]

    submit = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=requester_headers,
        json={},
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == "Manager Approval"

    reject = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Reject",
        headers=manager_headers,
        json={"comment": "insufficient details"},
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "Draft"
    assert reject.json()["workflow_approver_ids"] == [record_res.json()["created_by"]]


@pytest.mark.asyncio
async def test_workflow_invalid_action_and_invalid_from_status(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf4_requester@example.com")
    manager_headers = await signup_and_login(client, "wf4_manager@example.com")
    manager_id = (await client.get("/api/v1/users/me", headers=manager_headers)).json()["id"]

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App 4"})
    app_id = app_res.json()["id"]
    await create_user_selection_field(client, app_id, "manager_user_id", "Manager")

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {"name": "Manager Approval", "assignee": {"type": "field", "field_code": "manager_user_id"}},
        ],
        "actions": [{"name": "Submit", "from": "Draft", "to": "Manager Approval"}],
    }
    await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={"app_id": app_id, "data": {"title": "Invalid transition", "manager_user_id": manager_id}},
    )
    record_id = record_res.json()["id"]

    invalid_name = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/NotExists",
        headers=requester_headers,
        json={},
    )
    assert invalid_name.status_code == 400
    assert "not allowed" in invalid_name.json()["detail"]

    submit = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=requester_headers,
        json={},
    )
    assert submit.status_code == 200

    invalid_from_status = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=manager_headers,
        json={},
    )
    assert invalid_from_status.status_code == 400
    assert "not allowed" in invalid_from_status.json()["detail"]


@pytest.mark.asyncio
async def test_workflow_assignee_entities_department_and_job_title(client: AsyncClient):
    admin_headers = await signup_and_login(client, "wf5_admin@example.com")
    admin_id = (await client.get("/api/v1/users/me", headers=admin_headers)).json()["id"]
    # Escalate for org management endpoints in this test.
    await client.put(f"/api/v1/users/{admin_id}", headers=admin_headers, json={"is_superuser": True})
    admin_headers = await signup_and_login(client, "wf5_admin@example.com")

    requester_headers = await signup_and_login(client, "wf5_requester@example.com")
    dept_user_headers = await signup_and_login(client, "wf5_dept_user@example.com")
    title_user_headers = await signup_and_login(client, "wf5_title_user@example.com")

    dept_user = (await client.get("/api/v1/users/me", headers=dept_user_headers)).json()
    title_user = (await client.get("/api/v1/users/me", headers=title_user_headers)).json()

    dept_res = await client.post(
        "/api/v1/organization/departments",
        headers=admin_headers,
        json={"name": "Sales", "code": "SALES"},
    )
    title_res = await client.post(
        "/api/v1/organization/job_titles",
        headers=admin_headers,
        json={"name": "Director", "rank": 100},
    )
    assert dept_res.status_code == 200
    assert title_res.status_code == 200
    dept_id = dept_res.json()["id"]
    title_id = title_res.json()["id"]

    await client.put(
        f"/api/v1/users/{dept_user['id']}",
        headers=dept_user_headers,
        json={"department_id": dept_id},
    )
    await client.put(
        f"/api/v1/users/{title_user['id']}",
        headers=title_user_headers,
        json={"job_title_id": title_id},
    )

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App 5"})
    app_id = app_res.json()["id"]

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {
                "name": "Entity Approval",
                "assignee": {
                    "type": "entities",
                    "entities": [
                        {"entity_type": "department", "entity_id": dept_id},
                        {"entity_type": "job_title", "entity_id": title_id},
                    ],
                },
            },
        ],
        "actions": [{"name": "Submit", "from": "Draft", "to": "Entity Approval"}],
    }
    await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={"app_id": app_id, "data": {"title": "Entity assignee"}},
    )
    record_id = record_res.json()["id"]

    submit = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=requester_headers,
        json={},
    )
    assert submit.status_code == 200
    approver_ids = set(submit.json()["workflow_approver_ids"])
    assert dept_user["id"] in approver_ids
    assert title_user["id"] in approver_ids


@pytest.mark.asyncio
async def test_pending_approvals_hidden_when_no_app_view_permission(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf6_requester@example.com")
    approver_headers = await signup_and_login(client, "wf6_approver@example.com")
    approver_id = (await client.get("/api/v1/users/me", headers=approver_headers)).json()["id"]

    # App view/edit/manage only for creator.
    app_res = await client.post(
        "/api/v1/apps",
        headers=requester_headers,
        json={
            "name": "Workflow App 6",
            "app_acl": [
                {
                    "entity_type": "creator",
                    "allow_view": True,
                    "allow_edit": True,
                    "allow_delete": True,
                    "allow_manage": True,
                }
            ],
        },
    )
    app_id = app_res.json()["id"]
    await create_user_selection_field(client, app_id, "approver_id", "Approver")

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {"name": "Approval", "assignee": {"type": "field", "field_code": "approver_id"}},
        ],
        "actions": [{"name": "Submit", "from": "Draft", "to": "Approval"}],
    }
    await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={"app_id": app_id, "data": {"title": "Hidden pending", "approver_id": approver_id}},
    )
    record_id = record_res.json()["id"]
    submit = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/Submit",
        headers=requester_headers,
        json={},
    )
    assert submit.status_code == 200

    # The user is assignee but has no app view permission; should be filtered out.
    pending = await client.get("/api/v1/records/pending-approvals", headers=approver_headers)
    assert pending.status_code == 200
    assert all(r["id"] != record_id for r in pending.json())


@pytest.mark.asyncio
async def test_process_management_rejects_non_user_selection_field_assignee(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf7_requester@example.com")

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App 7"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    text_field = await client.post(
        "/api/v1/fields",
        json={
            "app_id": app_id,
            "type": "SINGLE_LINE_TEXT",
            "code": "customer_name",
            "label": "Customer Name",
            "config": {},
        },
    )
    assert text_field.status_code == 201

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {"name": "Approval", "assignee": {"type": "field", "field_code": "customer_name"}},
        ],
        "actions": [{"name": "Submit", "from": "Draft", "to": "Approval"}],
    }

    pm_res = await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)
    assert pm_res.status_code == 400
    assert "must be USER_SELECTION" in pm_res.json()["detail"]


@pytest.mark.asyncio
async def test_new_record_starts_from_first_process_status_when_enabled(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf8_requester@example.com")

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App 8"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "未承認", "assignee": {"type": "creator"}},
            {"name": "進行中", "assignee": {"type": "creator"}},
        ],
        "actions": [{"name": "開始", "from": "未承認", "to": "進行中"}],
    }
    pm_res = await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)
    assert pm_res.status_code == 200

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={"app_id": app_id, "data": {"title": "initial status should follow process"}},
    )
    assert record_res.status_code == 201
    assert record_res.json()["status"] == "未承認"

    start_res = await client.post(
        f"/api/v1/records/{record_res.json()['id']}/workflow/actions/開始",
        headers=requester_headers,
        json={},
    )
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "進行中"


@pytest.mark.asyncio
async def test_terminal_transition_creates_notification_for_creator(client: AsyncClient):
    requester_headers = await signup_and_login(client, "wf9_requester@example.com")
    approver_headers = await signup_and_login(client, "wf9_approver@example.com")
    approver_id = (await client.get("/api/v1/users/me", headers=approver_headers)).json()["id"]

    app_res = await client.post("/api/v1/apps", headers=requester_headers, json={"name": "Workflow App 9"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    await create_user_selection_field(client, app_id, "approver_id", "Approver")

    pm_payload = {
        "enabled": True,
        "statuses": [
            {"name": "開始前", "assignee": {"type": "creator"}},
            {"name": "進行中", "assignee": {"type": "field", "field_code": "approver_id", "selection": "single"}},
            {"name": "完了", "assignee": {}},
        ],
        "actions": [
            {"name": "開始する", "from": "開始前", "to": "進行中"},
            {"name": "完了する", "from": "進行中", "to": "完了"},
        ],
    }
    pm_res = await client.put(f"/api/v1/apps/{app_id}/process", headers=requester_headers, json=pm_payload)
    assert pm_res.status_code == 200

    record_res = await client.post(
        "/api/v1/records",
        headers=requester_headers,
        json={"app_id": app_id, "data": {"title": "notify me", "approver_id": approver_id}},
    )
    assert record_res.status_code == 201
    record_id = record_res.json()["id"]

    submit = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/開始する",
        headers=requester_headers,
        json={},
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == "進行中"

    complete = await client.post(
        f"/api/v1/records/{record_id}/workflow/actions/完了する",
        headers=approver_headers,
        json={},
    )
    assert complete.status_code == 200
    assert complete.json()["status"] == "完了"

    notifications_res = await client.get("/api/v1/notifications", headers=requester_headers)
    assert notifications_res.status_code == 200
    payload = notifications_res.json()
    assert payload["unread_count"] >= 1
    assert any(
        item["kind"] == "workflow_terminal"
        and item["record_id"] == record_id
        and "完了" in item["title"]
        for item in payload["items"]
    )
