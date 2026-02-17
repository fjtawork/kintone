"""add record search indexes

Revision ID: b7a1c3d9e2f4
Revises: 9c4f6d8e2a11
Create Date: 2026-02-17 11:35:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b7a1c3d9e2f4"
down_revision: Union[str, Sequence[str], None] = "9c4f6d8e2a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Supports listing by app and record number sort.
    op.create_index(
        "ix_records_app_id_record_number_desc",
        "records",
        ["app_id", "record_number"],
        unique=False,
    )
    # Supports status-filtered listing with stable record number sort.
    op.create_index(
        "ix_records_app_id_status_record_number_desc",
        "records",
        ["app_id", "status", "record_number"],
        unique=False,
    )
    # Supports recent-first listing per app.
    op.create_index(
        "ix_records_app_id_created_at",
        "records",
        ["app_id", "created_at"],
        unique=False,
    )
    # Improves JSONB containment/existence style filters.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_records_data_gin ON records USING GIN (data jsonb_path_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_records_data_gin")
    op.drop_index("ix_records_app_id_created_at", table_name="records")
    op.drop_index("ix_records_app_id_status_record_number_desc", table_name="records")
    op.drop_index("ix_records_app_id_record_number_desc", table_name="records")
