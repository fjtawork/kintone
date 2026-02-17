import pytest
from httpx import AsyncClient

# Helper to get headers for a new user
async def get_user_headers(client: AsyncClient, email: str, name: str):
    pwd = "password123"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": pwd, "full_name": name})
    response = await client.post("/api/v1/auth/login", data={"username": email, "password": pwd})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_app_permissions_flow(client: AsyncClient):
    # 1. Setup Users
    creator_headers = await get_user_headers(client, "creator@example.com", "Creator User")
    stranger_headers = await get_user_headers(client, "stranger@example.com", "Stranger User")

    # 2. Creator creates an App
    app_res = await client.post("/api/v1/apps", headers=creator_headers, json={
        "name": "Permission Test App",
        "description": "Testing access control"
    })
    assert app_res.status_code == 201
    app_data = app_res.json()
    app_id = app_data["id"]
    
    # Verify Default Permissions
    perms = app_data["permissions"]
    assert "everyone" in perms["app"]["view"]
    assert "creator" in perms["app"]["edit"]

    # 3. Stranger tries to VIEW App (Should PASS as View is 'everyone')
    res = await client.get(f"/api/v1/apps/{app_id}", headers=stranger_headers)
    assert res.status_code == 200, "Stranger should be able to view by default"

    # 4. Stranger tries to EDIT App Permissions (Should FAIL)
    # Trying to give themselves edit access
    res = await client.put(f"/api/v1/apps/{app_id}/permissions", headers=stranger_headers, json={
        "app": {"view": ["everyone"], "edit": ["everyone"], "delete": ["creator"]},
        "record": {},
        "fields": {}
    })
    # Note: API might return 403 or 404 depending on implementation of check (usually 403 or found but denied)
    # However, update_permissions endpoint logic in endpoints.py:
    # app = await AppService.update_permissions(...) -> This service method does NOT check permissions internally yet?
    # Wait, looking at endpoints.py, update_permissions calls AppService.update_permissions but NO PermissionService check is visible in the route handler!
    # This might be a BUG I will find via test.
    
    # If the bug exists, this will return 200. If we fixed it or it's protected, 403.
    # Let's Assert 403 to see if it fails (and thus perform TDD).
    
    if res.status_code == 200:
        pytest.fail("SECURITY BUG: Stranger was able to update permissions! Endpoint is not protected.")
    assert res.status_code == 403

    # 5. Creator changes Permissions (Lockdown: View = Creator only)
    res = await client.put(f"/api/v1/apps/{app_id}/permissions", headers=creator_headers, json={
        "app": {"view": ["creator"], "edit": ["creator"], "delete": ["creator"]},
        "record": {},
        "fields": {}
    })
    assert res.status_code == 200

    # 6. Stranger tries to VIEW App (Should FAIL now)
    res = await client.get(f"/api/v1/apps/{app_id}", headers=stranger_headers)
    assert res.status_code == 403, "Stranger should be denied view access after lockdown"
