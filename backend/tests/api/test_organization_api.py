import pytest
from httpx import AsyncClient


async def signup_and_login(client: AsyncClient, email: str, password: str = "password123") -> dict:
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def promote_self_to_superuser(client: AsyncClient, headers: dict) -> None:
    me = await client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["id"]
    promoted = await client.put(f"/api/v1/users/{user_id}", headers=headers, json={"is_superuser": True})
    assert promoted.status_code == 200


@pytest.mark.asyncio
async def test_organization_crud_requires_superuser(client: AsyncClient):
    user_headers = await signup_and_login(client, "org_forbidden@example.com")

    dept_forbidden = await client.post(
        "/api/v1/organization/departments",
        headers=user_headers,
        json={"name": "Sales", "code": "SALES"},
    )
    assert dept_forbidden.status_code == 403

    title_forbidden = await client.post(
        "/api/v1/organization/job_titles",
        headers=user_headers,
        json={"name": "Manager", "rank": 50},
    )
    assert title_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_organization_department_crud_and_404(client: AsyncClient):
    admin_headers = await signup_and_login(client, "org_admin_dept@example.com")
    await promote_self_to_superuser(client, admin_headers)

    create = await client.post(
        "/api/v1/organization/departments",
        headers=admin_headers,
        json={"name": "Sales", "code": "SALES"},
    )
    assert create.status_code == 200
    dept_id = create.json()["id"]

    update = await client.put(
        f"/api/v1/organization/departments/{dept_id}",
        headers=admin_headers,
        json={"name": "Global Sales"},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "Global Sales"

    list_res = await client.get("/api/v1/organization/departments", headers=admin_headers)
    assert list_res.status_code == 200
    assert any(item["id"] == dept_id and item["name"] == "Global Sales" for item in list_res.json())

    delete = await client.delete(f"/api/v1/organization/departments/{dept_id}", headers=admin_headers)
    assert delete.status_code == 200
    assert delete.json()["ok"] is True

    missing = "11111111-1111-1111-1111-111111111111"
    not_found = await client.put(
        f"/api/v1/organization/departments/{missing}",
        headers=admin_headers,
        json={"name": "Missing"},
    )
    assert not_found.status_code == 404


@pytest.mark.asyncio
async def test_organization_job_title_crud_and_404(client: AsyncClient):
    admin_headers = await signup_and_login(client, "org_admin_title@example.com")
    await promote_self_to_superuser(client, admin_headers)

    create = await client.post(
        "/api/v1/organization/job_titles",
        headers=admin_headers,
        json={"name": "Director", "rank": 100},
    )
    assert create.status_code == 200
    title_id = create.json()["id"]

    update = await client.put(
        f"/api/v1/organization/job_titles/{title_id}",
        headers=admin_headers,
        json={"rank": 120},
    )
    assert update.status_code == 200
    assert update.json()["rank"] == 120

    list_res = await client.get("/api/v1/organization/job_titles", headers=admin_headers)
    assert list_res.status_code == 200
    assert any(item["id"] == title_id and item["rank"] == 120 for item in list_res.json())

    delete = await client.delete(f"/api/v1/organization/job_titles/{title_id}", headers=admin_headers)
    assert delete.status_code == 200
    assert delete.json()["ok"] is True

    missing = "22222222-2222-2222-2222-222222222222"
    not_found = await client.delete(f"/api/v1/organization/job_titles/{missing}", headers=admin_headers)
    assert not_found.status_code == 404

