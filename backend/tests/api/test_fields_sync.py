import pytest
from httpx import AsyncClient

@pytest.fixture
async def auth_headers(client: AsyncClient):
    # Register/Login
    email = "test_sync_user@example.com"
    password = "password123"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    response = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def test_app(client: AsyncClient, auth_headers):
    # Create App
    # Note: Using path without trailing slash as updated previously
    response = await client.post("/api/v1/apps", headers=auth_headers, json={"name": "Sync Test App"})
    if response.status_code != 201:
        # Fallback to with slash if the previous change wasn't effective or behavior differs
        response = await client.post("/api/v1/apps/", headers=auth_headers, json={"name": "Sync Test App"})
    return response.json()

@pytest.mark.asyncio
async def test_fields_sync(client: AsyncClient, auth_headers, test_app):
    app_id = test_app["id"]
    
    # Define new fields to sync
    fields_payload = [
        {
            "app_id": app_id,
            "type": "SINGLE_LINE_TEXT",
            "code": "new_field_1",
            "label": "New Field 1",
            "config": {}
        },
        {
            "app_id": app_id,
            "type": "NUMBER",
            "code": "new_field_2",
            "label": "New Field 2",
            "config": {}
        }
    ]

    # Call Sync API
    response = await client.put(f"/api/v1/fields/app/{app_id}", headers=auth_headers, json=fields_payload)
    
    # Assert
    assert response.status_code == 200
    synced_fields = response.json()
    assert len(synced_fields) == 2
    codes = [f["code"] for f in synced_fields]
    assert "new_field_1" in codes
    assert "new_field_2" in codes

    # Verify via Get API
    get_response = await client.get(f"/api/v1/fields/app/{app_id}", headers=auth_headers)
    assert get_response.status_code == 200
    current_fields = get_response.json()
    assert len(current_fields) == 2
