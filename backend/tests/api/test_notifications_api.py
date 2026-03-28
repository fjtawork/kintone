import pytest
from httpx import AsyncClient


async def signup_and_login(client: AsyncClient, email: str, password: str = "password123") -> dict:
    await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def create_record_mention_notification(
    client: AsyncClient,
    sender_headers: dict,
    target_email: str,
) -> tuple[str, dict]:
    target_headers = await signup_and_login(client, target_email)

    app_res = await client.post("/api/v1/apps", headers=sender_headers, json={"name": "Notify App"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    await client.post(
        "/api/v1/fields",
        headers=sender_headers,
        json={"app_id": app_id, "type": "SINGLE_LINE_TEXT", "code": "title", "label": "Title"},
    )

    view = await client.put(
        f"/api/v1/apps/{app_id}/view",
        headers=sender_headers,
        json={"record_chat_enabled": True, "record_chat_max_messages": 300},
    )
    assert view.status_code == 200

    record = await client.post(
        "/api/v1/records",
        headers=sender_headers,
        json={"app_id": app_id, "data": {"title": "Notify Target"}},
    )
    assert record.status_code == 201
    record_id = record.json()["id"]

    mention_token = target_email.split("@", 1)[0]
    comment = await client.post(
        f"/api/v1/records/{record_id}/comments",
        headers=sender_headers,
        json={"message": f"hello @{mention_token}"},
    )
    assert comment.status_code == 200

    notifications = await client.get("/api/v1/notifications", headers=target_headers)
    assert notifications.status_code == 200
    payload = notifications.json()
    target = next((n for n in payload["items"] if n["kind"] == "record_mention" and n["record_id"] == record_id), None)
    assert target is not None
    return target["id"], target_headers


@pytest.mark.asyncio
async def test_notifications_mark_read_and_mark_all(client: AsyncClient):
    sender_headers = await signup_and_login(client, "notify_sender@example.com")

    first_id, target_headers = await create_record_mention_notification(
        client, sender_headers, "notify_target1@example.com"
    )
    second_id, _ = await create_record_mention_notification(
        client, sender_headers, "notify_target1@example.com"
    )
    assert first_id != second_id

    before = await client.get("/api/v1/notifications", headers=target_headers)
    assert before.status_code == 200
    assert before.json()["unread_count"] >= 2

    read_one = await client.patch(f"/api/v1/notifications/{first_id}/read", headers=target_headers)
    assert read_one.status_code == 200
    assert read_one.json()["is_read"] is True
    assert read_one.json()["read_at"] is not None

    unread_only = await client.get("/api/v1/notifications?unread_only=true", headers=target_headers)
    assert unread_only.status_code == 200
    unread_ids = {item["id"] for item in unread_only.json()["items"]}
    assert first_id not in unread_ids
    assert second_id in unread_ids

    read_all = await client.patch("/api/v1/notifications/read-all", headers=target_headers)
    assert read_all.status_code == 200
    assert read_all.json()["updated"] >= 1

    after = await client.get("/api/v1/notifications", headers=target_headers)
    assert after.status_code == 200
    assert after.json()["unread_count"] == 0


@pytest.mark.asyncio
async def test_notifications_mark_read_other_users_notification_returns_404(client: AsyncClient):
    sender_headers = await signup_and_login(client, "notify_sender2@example.com")
    notification_id, target_headers = await create_record_mention_notification(
        client, sender_headers, "notify_target2@example.com"
    )
    other_headers = await signup_and_login(client, "notify_other@example.com")

    forbidden = await client.patch(f"/api/v1/notifications/{notification_id}/read", headers=other_headers)
    assert forbidden.status_code == 404

    still_unread = await client.get("/api/v1/notifications?unread_only=true", headers=target_headers)
    assert still_unread.status_code == 200
    assert any(item["id"] == notification_id for item in still_unread.json()["items"])

