import pytest
from httpx import AsyncClient

@pytest.fixture
async def auth_headers(client: AsyncClient):
    # Register/Login
    email = "test_fields_user@example.com"
    password = "password123"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    response = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def test_app(client: AsyncClient, auth_headers):
    # Create App
    response = await client.post("/api/v1/apps", headers=auth_headers, json={"name": "Fields Test App"})
    return response.json()

@pytest.mark.asyncio
async def test_fields_ops(client: AsyncClient, auth_headers, test_app):
    app_id = test_app["id"]
    
    # 1. Add Field
    field_data = {
        "app_id": app_id,
        "type": "SINGLE_LINE_TEXT",
        "code": "field_1",
        "label": "Test Field",
        "required": True,
        "options": ["Option 1", "Option 2"]
    }
    response = await client.post("/api/v1/fields", headers=auth_headers, json=field_data)
    assert response.status_code == 201
    created_field = response.json()
    assert created_field["code"] == "field_1"
    assert created_field["app_id"] == app_id

    # 3. Add User Selection Field
    field_data_3 = {
        "app_id": app_id,
        "type": "USER_SELECTION",
        "code": "user_select",
        "label": "Assignee",
        "required": False,
        "options": None
    }
    response = await client.post("/api/v1/fields", headers=auth_headers, json=field_data_3)
    assert response.status_code == 201

    # 3. Get Fields
    response = await client.get(f"/api/v1/fields/app/{app_id}", headers=auth_headers)
    assert response.status_code == 200
    fields = response.json()
    assert len(fields) >= 2
    codes = [f["code"] for f in fields]
    assert "field_1" in codes
    assert "user_select" in codes
