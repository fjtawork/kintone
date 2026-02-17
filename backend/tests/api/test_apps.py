import pytest
from httpx import AsyncClient

@pytest.fixture
async def auth_token(client: AsyncClient):
    # Register/Login to get token
    email = "test_apps_user@example.com"
    password = "password123"
    
    await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": "Test Apps User"
    })
    
    response = await client.post("/api/v1/auth/login", data={
        "username": email,
        "password": password
    })
    return response.json()["access_token"]

@pytest.mark.asyncio
async def test_create_and_list_apps(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Create App
    app_name = "Test App"
    response = await client.post("/api/v1/apps", headers=headers, json={
        "name": app_name,
        "description": "Test Description"
    })
    assert response.status_code == 201
    app_data = response.json()
    assert app_data["name"] == app_name
    app_id = app_data["id"]

    # List Apps
    response = await client.get("/api/v1/apps", headers=headers)
    assert response.status_code == 200
    apps = response.json()
    assert len(apps) > 0
    assert any(a["id"] == app_id for a in apps)

    # Get Single App
    response = await client.get(f"/api/v1/apps/{app_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == app_id
