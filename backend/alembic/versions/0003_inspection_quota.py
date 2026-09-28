"""Add inspection quota schema

Revision ID: 0003_inspection_quota
Revises: 0002_sc_st_and_aging
Create Date: 2026-09-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0003_inspection_quota'
down_revision: Union[str, None] = '0002_sc_st_and_aging'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. Create inspections table
    if not insp.has_table('inspections'):
        op.create_table(
            'inspections',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('work_id', sa.Uuid(), nullable=False),
            sa.Column('district', sa.String(length=100), nullable=False),
            sa.Column('inspection_date', sa.Date(), nullable=False),
            sa.Column('inspector_name', sa.String(length=255), nullable=True),
            sa.Column('inspection_outcome', sa.String(length=20), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('photo_reference', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['work_id'], ['works.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # 2. Create inspection_coverage table
    if not insp.has_table('inspection_coverage'):
        op.create_table(
            'inspection_coverage',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('district', sa.String(length=100), nullable=False),
            sa.Column('financial_year', sa.String(length=10), nullable=False),
            sa.Column('works_in_progress', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('works_inspected', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('coverage_pct', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='COMPLIANT'),
            sa.Column('calculated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('district', 'financial_year', name='uq_inspection_district_fy')
        )


def downgrade() -> None:
    op.drop_table('inspection_coverage')
    op.drop_table('inspections')
