import asyncio
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.models import App, Field
from app.models.organization import Department, JobTitle
from app.models.user import User


DEFAULT_PASSWORD = "password123"


@dataclass(frozen=True)
class SeedUser:
    email: str
    full_name: str
    is_superuser: bool = False
    is_active: bool = True
    department_code: Optional[str] = None
    job_title_name: Optional[str] = None


async def upsert_department(code: str, name: str) -> Department:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Department).where(Department.code == code))
        department = result.scalar_one_or_none()
        if department:
            department.name = name
        else:
            department = Department(code=code, name=name)
            db.add(department)
        await db.commit()
        await db.refresh(department)
        return department


async def upsert_job_title(name: str, rank: int) -> JobTitle:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(JobTitle).where(JobTitle.name == name))
        title = result.scalar_one_or_none()
        if title:
            title.rank = rank
        else:
            title = JobTitle(name=name, rank=rank)
            db.add(title)
        await db.commit()
        await db.refresh(title)
        return title


async def upsert_user(user: SeedUser, departments: dict[str, Department], titles: dict[str, JobTitle]) -> User:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == user.email))
        existing = result.scalar_one_or_none()

        department_id = departments[user.department_code].id if user.department_code else None
        job_title_id = titles[user.job_title_name].id if user.job_title_name else None

        if existing:
            existing.full_name = user.full_name
            existing.is_superuser = user.is_superuser
            existing.is_active = user.is_active
            existing.department_id = department_id
            existing.job_title_id = job_title_id
            existing.hashed_password = get_password_hash(DEFAULT_PASSWORD)
            target = existing
        else:
            target = User(
                email=user.email,
                full_name=user.full_name,
                hashed_password=get_password_hash(DEFAULT_PASSWORD),
                is_superuser=user.is_superuser,
                is_active=user.is_active,
                department_id=department_id,
                job_title_id=job_title_id,
            )
            db.add(target)

        await db.commit()
        await db.refresh(target)
        return target


async def upsert_sample_app(created_by_user_id) -> App:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(App).where(App.name == "Sample Workflow App"))
        app = result.scalar_one_or_none()

        app_acl = [
            {"entity_type": "creator", "allow_view": True, "allow_edit": True, "allow_delete": True, "allow_manage": True},
            {"entity_type": "department", "allow_view": True},
            {"entity_type": "job_title", "allow_view": True},
        ]

        if app:
            app.description = "Seeded sample app for local development."
            app.icon = "Database"
            app.theme = "#2563eb"
            app.created_by = created_by_user_id
            app.app_acl = app_acl
        else:
            app = App(
                name="Sample Workflow App",
                description="Seeded sample app for local development.",
                icon="Database",
                theme="#2563eb",
                created_by=created_by_user_id,
                app_acl=app_acl,
            )
            db.add(app)

        await db.commit()
        await db.refresh(app)
        return app


async def upsert_sample_field(app_id) -> Field:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Field).where(Field.app_id == app_id, Field.code == "title")
        )
        field = result.scalar_one_or_none()
        if field:
            field.type = "SINGLE_LINE_TEXT"
            field.label = "Title"
            field.config = {"required": True, "defaultValue": ""}
        else:
            field = Field(
                app_id=app_id,
                code="title",
                type="SINGLE_LINE_TEXT",
                label="Title",
                config={"required": True, "defaultValue": ""},
            )
            db.add(field)

        await db.commit()
        await db.refresh(field)
        return field


async def main():
    departments = {
        "CORP": await upsert_department("CORP", "Corporate"),
        "SALES": await upsert_department("SALES", "Sales"),
        "HR": await upsert_department("HR", "Human Resources"),
    }
    titles = {
        "General Manager": await upsert_job_title("General Manager", 100),
        "Department Manager": await upsert_job_title("Department Manager", 70),
        "Staff": await upsert_job_title("Staff", 10),
    }

    users_to_seed = [
        SeedUser(
            email="admin@example.com",
            full_name="System Admin",
            is_superuser=True,
            department_code="CORP",
            job_title_name="General Manager",
        ),
        SeedUser(
            email="manager@example.com",
            full_name="Sales Manager",
            department_code="SALES",
            job_title_name="Department Manager",
        ),
        SeedUser(
            email="staff@example.com",
            full_name="General Staff",
            department_code="SALES",
            job_title_name="Staff",
        ),
        SeedUser(
            email="hr_staff@example.com",
            full_name="HR Staff",
            department_code="HR",
            job_title_name="Staff",
        ),
        SeedUser(
            email="title_only@example.com",
            full_name="Title Only User",
            job_title_name="Department Manager",
        ),
    ]

    seeded_users = []
    for user in users_to_seed:
        seeded_users.append(await upsert_user(user, departments, titles))

    app_creator = next(user for user in seeded_users if user.email == "manager@example.com")
    sample_app = await upsert_sample_app(app_creator.id)
    sample_field = await upsert_sample_field(sample_app.id)

    print("Seed completed.")
    print(f"Default password for all seeded users: {DEFAULT_PASSWORD}")
    print("Users:")
    for user in seeded_users:
        print(f"  - {user.email} / {DEFAULT_PASSWORD}")
    print(f"Sample app: {sample_app.name} ({sample_app.id})")
    print(f"Sample field: {sample_field.code} ({sample_field.type})")


if __name__ == "__main__":
    asyncio.run(main())
