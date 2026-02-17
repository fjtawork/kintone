from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
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
            config=field_in.config or {}
        )
        if field_in.options:
            db_field.config = {**db_field.config, "options": field_in.options}
        if field_in.related_app_id:
            db_field.config = {**db_field.config, "related_app_id": field_in.related_app_id}
        db.add(db_field)
        await db.commit()
        await db.refresh(db_field)
        return db_field

    @staticmethod
    async def get_fields_by_app(db: AsyncSession, app_id: UUID) -> List[Field]:
        result = await db.execute(select(Field).where(Field.app_id == app_id))
        return result.scalars().all()

    @staticmethod
    async def sync_fields(db: AsyncSession, app_id: UUID, fields_in: List[FieldCreate]) -> List[Field]:
        # 1. Delete existing fields for this app (simplest strategy for now)
        # In a real app, we would diff to preserve IDs and data
        await db.execute(delete(Field).where(Field.app_id == app_id))
        
        # 2. Create new fields
        new_fields = []
        for field_data in fields_in:
            field = Field(
                app_id=app_id,
                code=field_data.code,
                type=field_data.type,
                label=field_data.label,
                config=field_data.config or {}
            )
            if field_data.options:
                field.config = {**field.config, "options": field_data.options}
            if field_data.related_app_id:
                field.config = {**field.config, "related_app_id": field_data.related_app_id}
            db.add(field)
            new_fields.append(field)
        
        await db.commit()
        return new_fields
