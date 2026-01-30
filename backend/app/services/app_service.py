from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from app.models.models import App
from app.schemas.app_schema import AppCreate

class AppService:
    @staticmethod
    async def create_app(db: AsyncSession, app_in: AppCreate) -> App:
        db_app = App(
            name=app_in.name,
            description=app_in.description,
            icon=app_in.icon
        )
        db.add(db_app)
        await db.commit()
        await db.refresh(db_app)
        return db_app

    @staticmethod
    async def get_apps(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[App]:
        result = await db.execute(select(App).offset(skip).limit(limit))
        return result.scalars().all()

    @staticmethod
    async def get_app(db: AsyncSession, app_id: UUID) -> Optional[App]:
        result = await db.execute(select(App).where(App.id == app_id))
        return result.scalar_one_or_none()
