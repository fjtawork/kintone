"""Add workflow columns to records

Revision ID: 2d6c0d2fb7d1
Revises: 0a07cb5d1cda
Create Date: 2026-02-15 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "2d6c0d2fb7d1"
down_revision: Union[str, Sequence[str], None] = "0a07cb5d1cda"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("records", sa.Column("workflow_requester_id", sa.UUID(), nullable=True))
    op.add_column(
        "records",
        sa.Column(
            "workflow_approver_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "records",
        sa.Column("workflow_current_step", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("records", sa.Column("workflow_submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("records", sa.Column("workflow_decided_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "records",
        sa.Column(
            "workflow_history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.create_foreign_key(None, "records", "users", ["workflow_requester_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint(None, "records", type_="foreignkey")
    op.drop_column("records", "workflow_history")
    op.drop_column("records", "workflow_decided_at")
    op.drop_column("records", "workflow_submitted_at")
    op.drop_column("records", "workflow_current_step")
    op.drop_column("records", "workflow_approver_ids")
    op.drop_column("records", "workflow_requester_id")
