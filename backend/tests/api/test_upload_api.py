from io import BytesIO

import pytest
from httpx import AsyncClient


async def signup_and_login(client: AsyncClient, email: str, password: str = "password123") -> dict:
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_upload_requires_authentication(client: AsyncClient):
    res = await client.post(
        "/api/v1/files",
        files={"file": ("sample.txt", BytesIO(b"hello"), "text/plain")},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_upload_success_and_filename_sanitized(client: AsyncClient):
    headers = await signup_and_login(client, "upload_user@example.com")

    res = await client.post(
        "/api/v1/files",
        headers=headers,
        files={"file": ("nested/path\\name.txt", BytesIO(b"binary-data"), "text/plain")},
    )
    assert res.status_code == 200

    payload = res.json()
    assert payload["originalName"] == "nested/path\\name.txt"
    assert payload["contentType"] == "text/plain"
    assert payload["fileKey"].endswith("_nested_path_name.txt")
    assert "/" not in payload["fileKey"]
    assert "\\" not in payload["fileKey"]

