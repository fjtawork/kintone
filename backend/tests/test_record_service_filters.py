import pytest

from app.models.models import App, Record
from app.models.user import User
from app.services.record_service import RecordService


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("true", True),
        ("false", False),
        ("42", 42),
        ("3.14", 3.14),
        (" hello ", " hello "),
        ("", ""),
        (10, 10),
    ],
)
def test_coerce_filter_value(raw, expected):
    assert RecordService._coerce_filter_value(raw) == expected


@pytest.mark.asyncio
async def test_get_records_filters_eq_and_contains_with_type_coercion(db_session):
    user = User(email="record_filter_user@example.com", hashed_password="x", is_active=True)
    db_session.add(user)
    await db_session.flush()

    app = App(name="Filter App", created_by=user.id, app_acl=[])
    db_session.add(app)
    await db_session.flush()

    records = [
        Record(
            app_id=app.id,
            record_number=1,
            status="Draft",
            created_by=user.id,
            data={"title": "Alpha report", "priority": 1, "active": True},
        ),
        Record(
            app_id=app.id,
            record_number=2,
            status="Draft",
            created_by=user.id,
            data={"title": "Beta report", "priority": 2, "active": False},
        ),
        Record(
            app_id=app.id,
            record_number=3,
            status="Draft",
            created_by=user.id,
            data={"title": "Gamma memo", "priority": 10, "active": True},
        ),
    ]
    db_session.add_all(records)
    await db_session.commit()

    eq_filtered = await RecordService.get_records(
        db=db_session,
        app_id=app.id,
        filters={"priority": {"op": "eq", "value": "10"}},
        user=user,
        app_record_acl=[],
    )
    assert len(eq_filtered) == 1
    assert eq_filtered[0].data["title"] == "Gamma memo"

    contains_filtered = await RecordService.get_records(
        db=db_session,
        app_id=app.id,
        filters={"title": "report"},
        user=user,
        app_record_acl=[],
    )
    assert len(contains_filtered) == 2
    titles = {item.data["title"] for item in contains_filtered}
    assert titles == {"Alpha report", "Beta report"}

    bool_filtered = await RecordService.get_records(
        db=db_session,
        app_id=app.id,
        filters={"active": {"op": "eq", "value": "true"}},
        user=user,
        app_record_acl=[],
    )
    assert len(bool_filtered) == 2
    assert all(item.data["active"] is True for item in bool_filtered)


@pytest.mark.asyncio
async def test_get_records_paged_filters_and_compact_fields(db_session):
    user = User(email="record_paged_filter_user@example.com", hashed_password="x", is_active=True)
    db_session.add(user)
    await db_session.flush()

    app = App(name="Paged Filter App", created_by=user.id, app_acl=[])
    db_session.add(app)
    await db_session.flush()

    for i in range(1, 6):
        db_session.add(
            Record(
                app_id=app.id,
                record_number=i,
                status="Draft",
                created_by=user.id,
                data={"title": f"Task {i}", "priority": i},
            )
        )
    await db_session.commit()

    page = await RecordService.get_records_paged(
        db=db_session,
        app_id=app.id,
        limit=2,
        filters={"title": {"$contains": "Task"}},
        field_codes=["title"],
        user=user,
        app_record_acl=[],
    )
    assert len(page["items"]) == 2
    assert page["has_next"] is True
    assert page["next_cursor"] is not None
    assert list(page["items"][0]["data"].keys()) == ["title"]

