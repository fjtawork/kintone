import pytest

from app.models.notification import Notification
from app.models.user import User
from app.services.notification_service import NotificationService


@pytest.mark.asyncio
async def test_mark_read_is_idempotent(db_session):
    user = User(email="notify_service_user@example.com", hashed_password="x", is_active=True)
    db_session.add(user)
    await db_session.flush()

    notification = Notification(
        user_id=user.id,
        kind="workflow_terminal",
        title="Done",
        message="record completed",
        is_read=False,
    )
    db_session.add(notification)
    await db_session.commit()
    await db_session.refresh(notification)

    first = await NotificationService.mark_read(db_session, notification_id=notification.id, user_id=user.id)
    assert first is not None
    assert first.is_read is True
    assert first.read_at is not None
    first_read_at = first.read_at

    second = await NotificationService.mark_read(db_session, notification_id=notification.id, user_id=user.id)
    assert second is not None
    assert second.is_read is True
    assert second.read_at == first_read_at


@pytest.mark.asyncio
async def test_mark_all_read_returns_updated_count(db_session):
    user = User(email="notify_service_user2@example.com", hashed_password="x", is_active=True)
    other = User(email="notify_service_other@example.com", hashed_password="x", is_active=True)
    db_session.add_all([user, other])
    await db_session.flush()

    notifications = [
        Notification(user_id=user.id, kind="record_mention", title="A", message="a", is_read=False),
        Notification(user_id=user.id, kind="record_mention", title="B", message="b", is_read=False),
        Notification(user_id=user.id, kind="record_mention", title="C", message="c", is_read=True),
        Notification(user_id=other.id, kind="record_mention", title="D", message="d", is_read=False),
    ]
    db_session.add_all(notifications)
    await db_session.commit()

    updated = await NotificationService.mark_all_read(db_session, user_id=user.id)
    assert updated == 2

    unread_count_user = await NotificationService.unread_count(db_session, user_id=user.id)
    unread_count_other = await NotificationService.unread_count(db_session, user_id=other.id)
    assert unread_count_user == 0
    assert unread_count_other == 1


@pytest.mark.asyncio
async def test_mark_read_returns_none_for_other_users_notification(db_session):
    owner = User(email="notify_owner@example.com", hashed_password="x", is_active=True)
    attacker = User(email="notify_attacker@example.com", hashed_password="x", is_active=True)
    db_session.add_all([owner, attacker])
    await db_session.flush()

    notification = Notification(
        user_id=owner.id,
        kind="workflow_terminal",
        title="Owner only",
        message="secret",
        is_read=False,
    )
    db_session.add(notification)
    await db_session.commit()

    result = await NotificationService.mark_read(
        db_session,
        notification_id=notification.id,
        user_id=attacker.id,
    )
    assert result is None
