"""Initial baseline schema migration for MPLADS Sentinel

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension if postgres
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=30), nullable=False),
        sa.Column('scope_type', sa.String(length=20), nullable=False),
        sa.Column('scope_value', sa.String(length=100), nullable=True),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
    )

    op.create_table(
        'constituencies',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('mp_name', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    op.create_table(
        'works',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('work_id', sa.String(length=50), nullable=False),
        sa.Column('constituency_id', sa.Uuid(), nullable=False),
        sa.Column('work_description', sa.Text(), nullable=False),
        sa.Column('work_category', sa.String(length=50), nullable=False),
        sa.Column('sanctioned_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('actual_expenditure', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('cost_overrun_percentage', sa.Float(), nullable=True),
        sa.Column('sanction_date', sa.Date(), nullable=False),
        sa.Column('expected_completion_date', sa.Date(), nullable=True),
        sa.Column('completion_date', sa.Date(), nullable=True),
        sa.Column('work_status', sa.String(length=30), nullable=False),
        sa.Column('implementing_agency', sa.String(length=100), nullable=True),
        sa.Column('financial_year', sa.String(length=10), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('risk_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('risk_tier', sa.String(length=20), nullable=False, server_default='LOW'),
        sa.Column('risk_components', postgresql.JSONB(astext_type=sa.Text()) if bind.dialect.name == "postgresql" else sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['constituency_id'], ['constituencies.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('work_id')
    )

    op.create_table(
        'fund_releases',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('release_id', sa.String(length=50), nullable=False),
        sa.Column('constituency_id', sa.Uuid(), nullable=False),
        sa.Column('financial_year', sa.String(length=10), nullable=False),
        sa.Column('installment_number', sa.Integer(), nullable=False),
        sa.Column('amount_released', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('release_date', sa.Date(), nullable=False),
        sa.Column('cumulative_release', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.ForeignKeyConstraint(['constituency_id'], ['constituencies.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('release_id')
    )

    op.create_table(
        'anomalies',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('work_id', sa.Uuid(), nullable=True),
        sa.Column('constituency_id', sa.Uuid(), nullable=False),
        sa.Column('anomaly_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('detection_method', sa.String(length=30), nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()) if bind.dialect.name == "postgresql" else sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='NEW'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['constituency_id'], ['constituencies.id'], ),
        sa.ForeignKeyConstraint(['work_id'], ['works.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'duplicate_pairs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('work_a_id', sa.Uuid(), nullable=False),
        sa.Column('work_b_id', sa.Uuid(), nullable=False),
        sa.Column('text_similarity', sa.Float(), nullable=False),
        sa.Column('amount_similarity', sa.Float(), nullable=False),
        sa.Column('composite_score', sa.Integer(), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['work_a_id'], ['works.id'], ),
        sa.ForeignKeyConstraint(['work_b_id'], ['works.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'constituency_risk_scores',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('constituency_id', sa.Uuid(), nullable=False),
        sa.Column('financial_year', sa.String(length=10), nullable=False),
        sa.Column('risk_score', sa.Integer(), nullable=False),
        sa.Column('risk_tier', sa.String(length=20), nullable=False),
        sa.Column('total_works', sa.Integer(), nullable=False),
        sa.Column('high_risk_works', sa.Integer(), nullable=False),
        sa.Column('fund_utilization_rate', sa.Float(), nullable=True),
        sa.Column('total_funds_released', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('total_expenditure', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('computed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['constituency_id'], ['constituencies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('resource_id', sa.String(length=100), nullable=False),
        sa.Column('old_value', postgresql.JSONB(astext_type=sa.Text()) if bind.dialect.name == "postgresql" else sa.JSON(), nullable=True),
        sa.Column('new_value', postgresql.JSONB(astext_type=sa.Text()) if bind.dialect.name == "postgresql" else sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'upload_history',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_hash', sa.String(length=64), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('records_total', sa.Integer(), nullable=False),
        sa.Column('records_valid', sa.Integer(), nullable=False),
        sa.Column('records_rejected', sa.Integer(), nullable=False),
        sa.Column('validation_errors', postgresql.JSONB(astext_type=sa.Text()) if bind.dialect.name == "postgresql" else sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'detection_runs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('triggered_by', sa.Uuid(), nullable=True),
        sa.Column('trigger_type', sa.String(length=20), nullable=False, server_default='MANUAL'),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('anomalies_detected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('works_analyzed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['triggered_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('jti', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti')
    )


def downgrade() -> None:
    op.drop_table('refresh_tokens')
    op.drop_table('detection_runs')
    op.drop_table('upload_history')
    op.drop_table('audit_logs')
    op.drop_table('constituency_risk_scores')
    op.drop_table('duplicate_pairs')
    op.drop_table('anomalies')
    op.drop_table('fund_releases')
    op.drop_table('works')
    op.drop_table('constituencies')
    op.drop_table('users')
