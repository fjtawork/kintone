import pytest
from httpx import AsyncClient

@pytest.fixture
async def auth_headers(client: AsyncClient):
    email = "test_records_user@example.com"
    password = "password123"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    response = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

@pytest.fixture
async def app_with_fields(client: AsyncClient, auth_headers):
    # 1. Create App
    app_res = await client.post("/api/v1/apps", headers=auth_headers, json={"name": "Records App"})
    app_id = app_res.json()["id"]

    # 2. Add Fields
    await client.post("/api/v1/fields", headers=auth_headers, json={
        "app_id": app_id, "type": "SINGLE_LINE_TEXT", "code": "title", "label": "Title", "required": True
    })
    await client.post("/api/v1/fields", headers=auth_headers, json={
        "app_id": app_id, "type": "USER_SELECTION", "code": "assignee", "label": "Assignee", "required": False
    })
    return app_id

@pytest.mark.asyncio
async def test_create_and_list_records(client: AsyncClient, auth_headers, app_with_fields):
    app_id = app_with_fields

    # We need a valid user ID for realism, let's fetch 'me'
    me_res = await client.get("/api/v1/users/me", headers=auth_headers)
    user_id = me_res.json()["id"]

    # Create Record
    record_data = {
        "app_id": app_id,
        "data": {
            "title": "Test Task",
            "assignee": user_id
        }
    }
    response = await client.post("/api/v1/records", headers=auth_headers, json=record_data)
    assert response.status_code == 201
    created_record = response.json()
    assert created_record["data"]["title"] == "Test Task"
    assert created_record["data"]["assignee"] == user_id

    # 4. Multi-Select User Field Test
    # Add a multi-select field (simulating frontend config, though backend just sees 'USER_SELECTION')
    # Actually, backend doesn't enforce 'isMultiSelect' config yet, it just stores JSON.
    # We can rely on frontend validation. But let's verify backend stores list correctly.
    
    await client.post("/api/v1/fields", headers=auth_headers, json={
        "app_id": app_id, "type": "USER_SELECTION", "code": "colleagues", "label": "Colleagues", "required": False
    })
    
    record_multi_data = {
        "app_id": app_id,
        "data": {
            "title": "Team Task",
            "colleagues": [user_id, user_id] # Duplicate for testing list, normally unique
        }
    }
    response = await client.post("/api/v1/records", headers=auth_headers, json=record_multi_data)
    assert response.status_code == 201
    assert response.json()["data"]["colleagues"] == [user_id, user_id]

    # List Records
    response = await client.get(f"/api/v1/records?app_id={app_id}", headers=auth_headers)
    assert response.status_code == 200
    records = response.json()
    assert len(records) > 0
    record_id = records[0]["id"]
    assert records[0]["data"]["title"] == "Team Task"

    # Update Status (Workflow)
    action_name = "In Progress"
    response = await client.put(f"/api/v1/records/{record_id}/status", headers=auth_headers, json={
        "action": action_name
    })
    assert response.status_code == 200
    updated_record = response.json()
    assert updated_record["status"] == action_name

    # Verify Persistence
    response = await client.get(f"/api/v1/records/{record_id}", headers=auth_headers) # We need to ensure GET /{id} exists in router
    assert response.status_code == 200
    assert response.json()["status"] == action_name


@pytest.mark.asyncio
async def test_records_paged_cursor(client: AsyncClient, auth_headers, app_with_fields):
    app_id = app_with_fields

    # Create multiple records
    for i in range(1, 6):
        response = await client.post(
            "/api/v1/records",
            headers=auth_headers,
            json={
                "app_id": app_id,
                "data": {"title": f"Task {i}"},
            },
        )
        assert response.status_code == 201

    first_page = await client.get(
        f"/api/v1/records/paged?app_id={app_id}&limit=2&field_codes=title",
        headers=auth_headers,
    )
    assert first_page.status_code == 200
    page1 = first_page.json()
    assert page1["has_next"] is True
    assert page1["next_cursor"] is not None
    assert len(page1["items"]) == 2

    # Ensure list payload is compact (only requested field in data)
    assert list(page1["items"][0]["data"].keys()) == ["title"]

    cursor = page1["next_cursor"]
    second_page = await client.get(
        f"/api/v1/records/paged?app_id={app_id}&limit=2&cursor={cursor}&field_codes=title",
        headers=auth_headers,
    )
    assert second_page.status_code == 200
    page2 = second_page.json()
    assert len(page2["items"]) == 2
    assert page2["items"][0]["record_number"] < page1["items"][-1]["record_number"]


@pytest.mark.asyncio
async def test_record_comments_enabled_and_retention(client: AsyncClient, auth_headers, app_with_fields):
    app_id = app_with_fields

    create_res = await client.post(
        "/api/v1/records",
        headers=auth_headers,
        json={"app_id": app_id, "data": {"title": "Chat target"}},
    )
    assert create_res.status_code == 201
    record_id = create_res.json()["id"]

    # Enable chat and keep only latest 2 messages.
    update_view = await client.put(
        f"/api/v1/apps/{app_id}/view",
        headers=auth_headers,
        json={"record_chat_enabled": True, "record_chat_max_messages": 2},
    )
    assert update_view.status_code == 200

    for text in ["first", "second", "third"]:
        post_res = await client.post(
            f"/api/v1/records/{record_id}/comments",
            headers=auth_headers,
            json={"message": text},
        )
        assert post_res.status_code == 200

    list_res = await client.get(f"/api/v1/records/{record_id}/comments", headers=auth_headers)
    assert list_res.status_code == 200
    comments = list_res.json()
    assert len(comments) == 2
    assert comments[0]["message"] == "second"
    assert comments[1]["message"] == "third"


@pytest.mark.asyncio
async def test_mention_candidates_are_permission_filtered(client: AsyncClient, auth_headers, app_with_fields):
    app_id = app_with_fields

    # Create second user (should be excluded by app ACL later).
    second_email = "mention_other@example.com"
    second_password = "password123"
    signup = await client.post("/api/v1/auth/signup", json={"email": second_email, "password": second_password})
    assert signup.status_code == 200

    # Restrict app view to creator only.
    app_update = await client.put(
        f"/api/v1/apps/{app_id}",
        headers=auth_headers,
        json={
            "app_acl": [
                {"entity_type": "creator", "allow_view": True, "allow_manage": True}
            ]
        },
    )
    assert app_update.status_code == 200

    # Enable chat.
    update_view = await client.put(
        f"/api/v1/apps/{app_id}/view",
        headers=auth_headers,
        json={"record_chat_enabled": True, "record_chat_max_messages": 300},
    )
    assert update_view.status_code == 200

    create_res = await client.post(
        "/api/v1/records",
        headers=auth_headers,
        json={"app_id": app_id, "data": {"title": "mention target"}},
    )
    assert create_res.status_code == 201
    record_id = create_res.json()["id"]

    candidates_res = await client.get(
        f"/api/v1/records/{record_id}/mention-candidates",
        headers=auth_headers,
    )
    assert candidates_res.status_code == 200
    candidates = candidates_res.json()

    emails = {item["email"] for item in candidates}
    assert "test_records_user@example.com" in emails
    assert second_email not in emails


@pytest.mark.asyncio
async def test_record_comment_mention_creates_notification(client: AsyncClient, auth_headers, app_with_fields):
    app_id = app_with_fields

    target_email = "mention_notify_target@example.com"
    mention_token = "mention_notify_target"
    target_password = "password123"
    signup = await client.post("/api/v1/auth/signup", json={"email": target_email, "password": target_password})
    assert signup.status_code == 200

    # Enable chat
    update_view = await client.put(
        f"/api/v1/apps/{app_id}/view",
        headers=auth_headers,
        json={"record_chat_enabled": True, "record_chat_max_messages": 300},
    )
    assert update_view.status_code == 200

    create_res = await client.post(
        "/api/v1/records",
        headers=auth_headers,
        json={"app_id": app_id, "data": {"title": "mention notify"}},
    )
    assert create_res.status_code == 201
    record_id = create_res.json()["id"]

    post_res = await client.post(
        f"/api/v1/records/{record_id}/comments",
        headers=auth_headers,
        json={"message": f"確認です @{mention_token}"},
    )
    assert post_res.status_code == 200

    login_target = await client.post(
        "/api/v1/auth/login",
        data={"username": target_email, "password": target_password},
    )
    assert login_target.status_code == 200
    target_headers = {"Authorization": f"Bearer {login_target.json()['access_token']}"}

    notifications_res = await client.get("/api/v1/notifications", headers=target_headers)
    assert notifications_res.status_code == 200
    notifications = notifications_res.json()["items"]
    mention = next((item for item in notifications if item["kind"] == "record_mention" and item["record_id"] == record_id), None)
    assert mention is not None
    assert "Records App" in mention["title"]
    assert "確認です" in mention["message"]
    assert mention["link_path"] == f"/apps/{app_id}/records/{record_id}"
