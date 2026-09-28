"""Add SC/ST compliance and fund aging schema

Revision ID: 0002_sc_st_and_aging
Revises: 0001_initial_schema
Create Date: 2026-09-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0002_sc_st_and_aging'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. Add beneficiary_category to works
    works_cols = [c['name'] for c in insp.get_columns('works')]
    if 'beneficiary_category' not in works_cols:
        op.add_column('works', sa.Column('beneficiary_category', sa.String(length=20), nullable=True, server_default='NA'))

    # 2. Add allocation targets to constituencies
    const_cols = [c['name'] for c in insp.get_columns('constituencies')]
    if 'sc_allocation_target_pct' not in const_cols:
        op.add_column('constituencies', sa.Column('sc_allocation_target_pct', sa.Numeric(precision=5, scale=2), nullable=True, server_default='15.00'))
    if 'st_allocation_target_pct' not in const_cols:
        op.add_column('constituencies', sa.Column('st_allocation_target_pct', sa.Numeric(precision=5, scale=2), nullable=True, server_default='7.50'))

    # 3. Create sc_st_compliance table
    if not insp.has_table('sc_st_compliance'):
        op.create_table(
            'sc_st_compliance',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('constituency_id', sa.Uuid(), nullable=False),
            sa.Column('financial_year', sa.String(length=10), nullable=False),
            sa.Column('sc_pct_actual', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
            sa.Column('sc_pct_target', sa.Numeric(precision=5, scale=2), nullable=False, server_default='15.00'),
            sa.Column('st_pct_actual', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
            sa.Column('st_pct_target', sa.Numeric(precision=5, scale=2), nullable=False, server_default='7.50'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='COMPLIANT'),
            sa.Column('calculated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['constituency_id'], ['constituencies.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('constituency_id', 'financial_year', name='uq_sc_st_const_fy')
        )

    # 4. Add aging fields to constituency_risk_scores
    risk_cols = [c['name'] for c in insp.get_columns('constituency_risk_scores')]
    if 'avg_days_unspent' not in risk_cols:
        op.add_column('constituency_risk_scores', sa.Column('avg_days_unspent', sa.Integer(), nullable=True))
    if 'max_project_days_unspent' not in risk_cols:
        op.add_column('constituency_risk_scores', sa.Column('max_project_days_unspent', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('constituency_risk_scores', 'max_project_days_unspent')
    op.drop_column('constituency_risk_scores', 'avg_days_unspent')
    op.drop_table('sc_st_compliance')
    op.drop_column('constituencies', 'st_allocation_target_pct')
    op.drop_column('constituencies', 'sc_allocation_target_pct')
    op.drop_column('works', 'beneficiary_category')
