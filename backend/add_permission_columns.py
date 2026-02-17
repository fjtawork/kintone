import asyncio
from sqlalchemy import text
from app.core.database import create_async_engine, settings

async def add_permission_columns():
    print("Adding permission columns to apps table...")
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    
    async with engine.begin() as conn:
        # Check and add app_acl
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apps' AND column_name='app_acl') THEN
                    ALTER TABLE apps ADD COLUMN app_acl JSONB DEFAULT '[]';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apps' AND column_name='record_acl') THEN
                    ALTER TABLE apps ADD COLUMN record_acl JSONB DEFAULT '[]';
                END IF;
            END $$;
        """))
    
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(add_permission_columns())
