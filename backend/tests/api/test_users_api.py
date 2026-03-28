import pytest
from httpx import AsyncClient


async def signup_and_login(client: AsyncClient, email: str, password: str = "password123") -> dict:
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def promote_self_to_superuser(client: AsyncClient, headers: dict) -> dict:
    me = await client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["id"]
    promoted = await client.put(f"/api/v1/users/{user_id}", headers=headers, json={"is_superuser": True})
    assert promoted.status_code == 200
    return headers


@pytest.mark.asyncio
async def test_users_create_requires_superuser(client: AsyncClient):
    user_headers = await signup_and_login(client, "users_forbidden@example.com")

    res = await client.post(
        "/api/v1/users",
        headers=user_headers,
        json={"email": "new_user@example.com", "password": "password123", "full_name": "New User"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_users_create_delete_by_superuser(client: AsyncClient):
    admin_headers = await signup_and_login(client, "users_admin@example.com")
    await promote_self_to_superuser(client, admin_headers)

    create_res = await client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={"email": "managed_user@example.com", "password": "password123", "full_name": "Managed User"},
    )
    assert create_res.status_code == 200
    created_id = create_res.json()["id"]
    assert create_res.json()["email"] == "managed_user@example.com"

    delete_res = await client.delete(f"/api/v1/users/{created_id}", headers=admin_headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["ok"] is True

    me = await client.get("/api/v1/users/me", headers=admin_headers)
    assert me.status_code == 200
    admin_id = me.json()["id"]
    not_found_delete = await client.delete(f"/api/v1/users/{created_id}", headers=admin_headers)
    assert not_found_delete.status_code == 404

    self_delete = await client.delete(f"/api/v1/users/{admin_id}", headers=admin_headers)
    assert self_delete.status_code == 200


@pytest.mark.asyncio
async def test_users_create_duplicate_email_returns_400(client: AsyncClient):
    admin_headers = await signup_and_login(client, "users_admin_dup@example.com")
    await promote_self_to_superuser(client, admin_headers)

    first = await client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={"email": "dup_user@example.com", "password": "password123", "full_name": "Dup User"},
    )
    assert first.status_code == 200

    second = await client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={"email": "dup_user@example.com", "password": "password123", "full_name": "Dup User 2"},
    )
    assert second.status_code == 400


@pytest.mark.asyncio
async def test_users_update_other_user_forbidden_for_non_superuser(client: AsyncClient):
    alice_headers = await signup_and_login(client, "users_alice@example.com")
    bob_headers = await signup_and_login(client, "users_bob@example.com")

    bob_me = await client.get("/api/v1/users/me", headers=bob_headers)
    assert bob_me.status_code == 200
    bob_id = bob_me.json()["id"]

    forbidden = await client.put(
        f"/api/v1/users/{bob_id}",
        headers=alice_headers,
        json={"full_name": "Hacked Name"},
    )
    assert forbidden.status_code == 403

