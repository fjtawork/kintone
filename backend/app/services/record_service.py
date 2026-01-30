from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
from app.models.models import Record
from app.schemas.record_schema import RecordCreate

class RecordService:
    @staticmethod
    async def get_next_record_number(db: AsyncSession, app_id: UUID) -> int:
        # Simple auto-increment logic (Replace with sequence or robust locking in prod)
        result = await db.execute(select(func.max(Record.record_number)).where(Record.app_id == app_id))
        max_num = result.scalar()
        return (max_num or 0) + 1

    @staticmethod
    async def create_record(db: AsyncSession, record_in: RecordCreate) -> Record:
        # TODO: Validate record_in.data against App Fields
        
        next_num = await RecordService.get_next_record_number(db, record_in.app_id)
        
        db_record = Record(
            app_id=record_in.app_id,
            record_number=next_num,
            status=record_in.status,
            data=record_in.data
        )
        db.add(db_record)
        await db.commit()
        await db.refresh(db_record)
        return db_record

    @staticmethod
    async def get_records(db: AsyncSession, app_id: UUID, skip: int = 0, limit: int = 100) -> List[Record]:
        result = await db.execute(
            select(Record)
            .where(Record.app_id == app_id)
            .order_by(Record.record_number.desc())
            .offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    @staticmethod
    async def get_record(db: AsyncSession, record_id: UUID) -> Optional[Record]:
        result = await db.execute(select(Record).where(Record.id == record_id))
        return result.scalar_one_or_none()
