from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from app.models.models import Field
from app.schemas.field_schema import FieldCreate

class FieldService:
    @staticmethod
    async def create_field(db: AsyncSession, field_in: FieldCreate) -> Field:
        db_field = Field(
            app_id=field_in.app_id,
            code=field_in.code,
            label=field_in.label,
            type=field_in.type,
            config=field_in.config
        )
        db.add(db_field)
        await db.commit()
        await db.refresh(db_field)
        return db_field

    @staticmethod
    async def get_fields_by_app(db: AsyncSession, app_id: UUID) -> List[Field]:
        result = await db.execute(select(Field).where(Field.app_id == app_id))
        return result.scalars().all()
