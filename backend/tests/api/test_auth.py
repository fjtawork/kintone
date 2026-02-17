import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_signup_and_login(client: AsyncClient):
    # Signup
    email = "test_auth_user@example.com"
    password = "password123"
    
    response = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": "Test Auth User"
    })
    
    # If user already exists (from previous runs), expect 400 or handle it
    if response.status_code == 400 and "already exists" in response.text:
        pass # User exists, proceed to login
    else:
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email

    # Login
    response = await client.post("/api/v1/auth/login", data={
        "username": email,
        "password": password
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
