"""add record comments table

Revision ID: c13a7c1e9f2b
Revises: b7a1c3d9e2f4
Create Date: 2026-02-17 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c13a7c1e9f2b"
down_revision: Union[str, Sequence[str], None] = "b7a1c3d9e2f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "record_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("record_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["record_id"], ["records.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_record_comments_record_id"), "record_comments", ["record_id"], unique=False)
    op.create_index(op.f("ix_record_comments_user_id"), "record_comments", ["user_id"], unique=False)
    op.create_index(op.f("ix_record_comments_created_at"), "record_comments", ["created_at"], unique=False)
    op.create_index(
        "ix_record_comments_record_id_created_at",
        "record_comments",
        ["record_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_record_comments_record_id_created_at", table_name="record_comments")
    op.drop_index(op.f("ix_record_comments_created_at"), table_name="record_comments")
    op.drop_index(op.f("ix_record_comments_user_id"), table_name="record_comments")
    op.drop_index(op.f("ix_record_comments_record_id"), table_name="record_comments")
    op.drop_table("record_comments")
