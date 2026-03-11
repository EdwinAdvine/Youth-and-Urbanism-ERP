"""phase4_supplychain_mfg_support_embeddings

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-10 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── pgvector extension (skip if not installed on system) ────────────────
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector')"
    ))
    _has_pgvector = result.scalar()

    if _has_pgvector:
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
        # ── Document Embeddings (RAG) ───────────────────────────────────────
        op.create_table(
            'document_embeddings',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('source_type', sa.String(50), nullable=False, index=True),
            sa.Column('source_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('chunk_index', sa.Integer, nullable=False, default=0),
            sa.Column('chunk_text', sa.Text, nullable=False),
            sa.Column('metadata_json', postgresql.JSON, nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        # Add vector column separately (pgvector syntax)
        op.execute("ALTER TABLE document_embeddings ADD COLUMN embedding vector(768) NOT NULL")
    else:
        import logging
        logging.getLogger("alembic").warning(
            "pgvector extension not available — skipping document_embeddings table. "
            "Switch to pgvector/pgvector:pg16 image to enable RAG."
        )

    # ── Support / Tickets ───────────────────────────────────────────────────
    op.create_table(
        'ticket_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(200), unique=True, nullable=False, index=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('color', sa.String(30), nullable=True, server_default='#51459d'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('ticket_number', sa.String(20), unique=True, nullable=False, index=True),
        sa.Column('subject', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='open', index=True),
        sa.Column('priority', sa.String(20), nullable=False, server_default='medium', index=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ticket_categories.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('contact_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('crm_contacts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('customer_email', sa.String(320), nullable=True),
        sa.Column('customer_name', sa.String(300), nullable=True),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('first_response_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sla_response_due', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sla_resolution_due', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sla_response_breached', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('sla_resolution_breached', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('tags', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'ticket_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('is_internal', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('attachments', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'kb_articles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('slug', sa.String(500), unique=True, nullable=False, index=True),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ticket_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('view_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('helpful_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'sla_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('priority', sa.String(20), nullable=False, index=True),
        sa.Column('response_time_hours', sa.Integer, nullable=False),
        sa.Column('resolution_time_hours', sa.Integer, nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Supply Chain ────────────────────────────────────────────────────────
    op.create_table(
        'sc_suppliers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(30), unique=True, nullable=False),
        sa.Column('contact_name', sa.String(200), nullable=True),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('payment_terms', sa.String(20), nullable=True),
        sa.Column('payment_terms_days', sa.Integer, server_default='30'),
        sa.Column('rating', sa.Integer, nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('contact_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('crm_contacts.id'), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'sc_requisitions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('requisition_number', sa.String(30), unique=True, nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('department_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hr_departments.id'), nullable=True),
        sa.Column('status', sa.String(30), server_default='draft'),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('priority', sa.String(20), server_default='medium'),
        sa.Column('required_by_date', sa.Date, nullable=True),
        sa.Column('total_estimated', sa.Numeric(14, 2), server_default='0'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'sc_requisition_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('requisition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sc_requisitions.id'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('estimated_unit_price', sa.Numeric(12, 2), server_default='0'),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sc_suppliers.id'), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
    )

    op.create_table(
        'sc_goods_received_notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('grn_number', sa.String(30), unique=True, nullable=False),
        sa.Column('purchase_order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_purchase_orders.id'), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sc_suppliers.id'), nullable=False),
        sa.Column('warehouse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_warehouses.id'), nullable=False),
        sa.Column('received_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('received_date', sa.Date, nullable=False),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'sc_grn_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('grn_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sc_goods_received_notes.id'), nullable=False),
        sa.Column('po_line_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_purchase_order_lines.id'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('ordered_quantity', sa.Integer, nullable=False),
        sa.Column('received_quantity', sa.Integer, nullable=False),
        sa.Column('accepted_quantity', sa.Integer, nullable=False),
        sa.Column('rejected_quantity', sa.Integer, server_default='0'),
        sa.Column('rejection_reason', sa.String(500), nullable=True),
    )

    op.create_table(
        'sc_supplier_returns',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('return_number', sa.String(30), unique=True, nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sc_suppliers.id'), nullable=False),
        sa.Column('grn_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sc_goods_received_notes.id'), nullable=True),
        sa.Column('warehouse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_warehouses.id'), nullable=False),
        sa.Column('status', sa.String(30), server_default='draft'),
        sa.Column('reason', sa.Text, nullable=False),
        sa.Column('total_value', sa.Numeric(14, 2), server_default='0'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'sc_supplier_return_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('return_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sc_supplier_returns.id'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('unit_cost', sa.Numeric(12, 2), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
    )

    # ── Manufacturing ───────────────────────────────────────────────────────
    op.create_table(
        'mfg_bom',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('bom_number', sa.String(30), unique=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('finished_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('quantity_produced', sa.Integer, server_default='1'),
        sa.Column('version', sa.Integer, server_default='1'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('is_default', sa.Boolean, server_default='false'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'mfg_bom_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('bom_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mfg_bom.id'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('child_bom_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mfg_bom.id'), nullable=True),
        sa.Column('quantity_required', sa.Numeric(12, 4), nullable=False),
        sa.Column('unit_of_measure', sa.String(50), server_default='unit'),
        sa.Column('scrap_percentage', sa.Numeric(5, 2), server_default='0'),
        sa.Column('sort_order', sa.Integer, server_default='0'),
        sa.Column('notes', sa.String(500), nullable=True),
    )

    op.create_table(
        'mfg_workstations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(50), unique=True, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('capacity_per_hour', sa.Numeric(10, 2), nullable=True),
        sa.Column('hourly_rate', sa.Numeric(10, 2), server_default='0'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('warehouse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_warehouses.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'mfg_work_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('wo_number', sa.String(30), unique=True, nullable=False),
        sa.Column('bom_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mfg_bom.id'), nullable=False),
        sa.Column('workstation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mfg_workstations.id'), nullable=True),
        sa.Column('finished_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('planned_quantity', sa.Integer, nullable=False),
        sa.Column('completed_quantity', sa.Integer, server_default='0'),
        sa.Column('rejected_quantity', sa.Integer, server_default='0'),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('priority', sa.String(10), server_default='medium'),
        sa.Column('planned_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('planned_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('target_warehouse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_warehouses.id'), nullable=False),
        sa.Column('source_warehouse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_warehouses.id'), nullable=False),
        sa.Column('total_material_cost', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total_labor_cost', sa.Numeric(14, 2), server_default='0'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'mfg_material_consumption',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('work_order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mfg_work_orders.id'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=False),
        sa.Column('planned_quantity', sa.Numeric(12, 4), nullable=False),
        sa.Column('actual_quantity', sa.Numeric(12, 4), server_default='0'),
        sa.Column('warehouse_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_warehouses.id'), nullable=False),
        sa.Column('stock_movement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_stock_movements.id'), nullable=True),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'mfg_quality_checks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('check_number', sa.String(30), unique=True, nullable=False),
        sa.Column('work_order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mfg_work_orders.id'), nullable=False),
        sa.Column('inspector_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('checked_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('quantity_inspected', sa.Integer, nullable=False),
        sa.Column('quantity_passed', sa.Integer, nullable=False),
        sa.Column('quantity_failed', sa.Integer, nullable=False),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('parameters', postgresql.JSON, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Indexes ─────────────────────────────────────────────────────────────
    op.create_index('ix_sc_suppliers_code', 'sc_suppliers', ['code'])
    op.create_index('ix_sc_requisitions_status', 'sc_requisitions', ['status'])
    op.create_index('ix_sc_grn_po', 'sc_goods_received_notes', ['purchase_order_id'])
    op.create_index('ix_mfg_wo_status', 'mfg_work_orders', ['status'])
    op.create_index('ix_mfg_wo_bom', 'mfg_work_orders', ['bom_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_mfg_wo_bom')
    op.drop_index('ix_mfg_wo_status')
    op.drop_index('ix_sc_grn_po')
    op.drop_index('ix_sc_requisitions_status')
    op.drop_index('ix_sc_suppliers_code')

    # Manufacturing
    op.drop_table('mfg_quality_checks')
    op.drop_table('mfg_material_consumption')
    op.drop_table('mfg_work_orders')
    op.drop_table('mfg_workstations')
    op.drop_table('mfg_bom_items')
    op.drop_table('mfg_bom')

    # Supply Chain
    op.drop_table('sc_supplier_return_lines')
    op.drop_table('sc_supplier_returns')
    op.drop_table('sc_grn_lines')
    op.drop_table('sc_goods_received_notes')
    op.drop_table('sc_requisition_lines')
    op.drop_table('sc_requisitions')
    op.drop_table('sc_suppliers')

    # Support
    op.drop_table('sla_policies')
    op.drop_table('kb_articles')
    op.drop_table('ticket_comments')
    op.drop_table('tickets')
    op.drop_table('ticket_categories')

    # Embeddings (may not exist if pgvector was unavailable)
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_embeddings')"
    ))
    if result.scalar():
        op.drop_table('document_embeddings')
    op.execute("DROP EXTENSION IF EXISTS vector")
