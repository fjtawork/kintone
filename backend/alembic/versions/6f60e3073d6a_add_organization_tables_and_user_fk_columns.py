"""Add organization tables and user foreign key columns

Revision ID: 6f60e3073d6a
Revises: 2d6c0d2fb7d1
Create Date: 2026-02-16 00:58:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "6f60e3073d6a"
down_revision: Union[str, Sequence[str], None] = "2d6c0d2fb7d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Organization master tables.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS departments (
            id UUID PRIMARY KEY,
            name VARCHAR NOT NULL UNIQUE,
            code VARCHAR NOT NULL UNIQUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS job_titles (
            id UUID PRIMARY KEY,
            name VARCHAR NOT NULL UNIQUE,
            rank INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
        """
    )

    # User affiliation columns.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title_id UUID")

    # FKs are added idempotently using pg_constraint checks.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_users_department_id_departments'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT fk_users_department_id_departments
                FOREIGN KEY (department_id) REFERENCES departments (id);
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_users_job_title_id_job_titles'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT fk_users_job_title_id_job_titles
                FOREIGN KEY (job_title_id) REFERENCES job_titles (id);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_job_title_id_job_titles")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_department_id_departments")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS job_title_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS department_id")
    op.execute("DROP TABLE IF EXISTS job_titles")
    op.execute("DROP TABLE IF EXISTS departments")

