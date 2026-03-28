import pytest
from httpx import AsyncClient


async def signup_and_login(client: AsyncClient, email: str, password: str = "password123") -> dict:
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_apps_update_and_view_settings_require_manage_permission(client: AsyncClient):
    owner_headers = await signup_and_login(client, "apps_owner@example.com")
    other_headers = await signup_and_login(client, "apps_other@example.com")

    create = await client.post(
        "/api/v1/apps",
        headers=owner_headers,
        json={
            "name": "Strict App",
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
    assert create.status_code == 201
    app_id = create.json()["id"]

    update_general = await client.put(
        f"/api/v1/apps/{app_id}",
        headers=other_headers,
        json={"name": "Unauthorized Rename"},
    )
    assert update_general.status_code == 403

    update_view = await client.put(
        f"/api/v1/apps/{app_id}/view",
        headers=other_headers,
        json={"record_chat_enabled": True},
    )
    assert update_view.status_code == 403


@pytest.mark.asyncio
async def test_apps_process_update_requires_manage_permission(client: AsyncClient):
    owner_headers = await signup_and_login(client, "apps_owner2@example.com")
    other_headers = await signup_and_login(client, "apps_other2@example.com")

    create = await client.post(
        "/api/v1/apps",
        headers=owner_headers,
        json={
            "name": "Strict Process App",
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
    assert create.status_code == 201
    app_id = create.json()["id"]

    payload = {
        "enabled": True,
        "statuses": [
            {"name": "Draft", "assignee": {"type": "creator"}},
            {"name": "Done", "assignee": {}},
        ],
        "actions": [{"name": "Complete", "from": "Draft", "to": "Done"}],
    }
    update_process = await client.put(f"/api/v1/apps/{app_id}/process", headers=other_headers, json=payload)
    assert update_process.status_code == 403


@pytest.mark.asyncio
async def test_apps_list_created_by_filter(client: AsyncClient):
    user1_headers = await signup_and_login(client, "apps_filter_u1@example.com")
    user2_headers = await signup_and_login(client, "apps_filter_u2@example.com")

    user1_me = await client.get("/api/v1/users/me", headers=user1_headers)
    user2_me = await client.get("/api/v1/users/me", headers=user2_headers)
    assert user1_me.status_code == 200
    assert user2_me.status_code == 200
    user1_id = user1_me.json()["id"]
    user2_id = user2_me.json()["id"]

    created_by_user1 = await client.post("/api/v1/apps", headers=user1_headers, json={"name": "U1 App"})
    created_by_user2 = await client.post("/api/v1/apps", headers=user2_headers, json={"name": "U2 App"})
    assert created_by_user1.status_code == 201
    assert created_by_user2.status_code == 201
    user2_app_id = created_by_user2.json()["id"]

    # Query by user2 id from user1 context.
    filtered = await client.get(f"/api/v1/apps?created_by={user2_id}", headers=user1_headers)
    assert filtered.status_code == 200
    ids = {app["id"] for app in filtered.json()}
    assert user2_app_id in ids
    assert created_by_user1.json()["id"] not in ids
    assert user1_id != user2_id

