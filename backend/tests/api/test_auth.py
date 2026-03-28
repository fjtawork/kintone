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


@pytest.mark.asyncio
async def test_login_with_wrong_password_returns_400(client: AsyncClient):
    email = "test_auth_wrong_pwd@example.com"
    password = "password123"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})

    response = await client.post("/api/v1/auth/login", data={"username": email, "password": "wrong-password"})
    assert response.status_code == 400
    assert "Incorrect email or password" in response.text


@pytest.mark.asyncio
async def test_login_inactive_user_returns_400(client: AsyncClient):
    email = "test_auth_inactive@example.com"
    password = "password123"
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "is_active": False},
    )
    assert signup.status_code == 200

    response = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert response.status_code == 400
    assert "Inactive user" in response.text


@pytest.mark.asyncio
async def test_signup_email_is_case_insensitive_for_uniqueness(client: AsyncClient):
    first = await client.post(
        "/api/v1/auth/signup",
        json={"email": "CaseSensitive@example.com", "password": "password123"},
    )
    assert first.status_code == 200

    second = await client.post(
        "/api/v1/auth/signup",
        json={"email": "casesensitive@example.com", "password": "password123"},
    )
    assert second.status_code == 400
    assert "already exists" in second.text
