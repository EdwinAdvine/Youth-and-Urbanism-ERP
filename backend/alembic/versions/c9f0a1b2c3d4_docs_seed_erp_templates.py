"""Seed 50+ pre-built ERP document templates.

Revision ID: c9f0a1b2c3d4
Revises: b8e9f0a1b2c3
Create Date: 2026-03-12

Seeds document_templates with production-ready ERP templates covering:
  Finance, HR, Legal, CRM/Sales, Projects, Operations, Marketing, Support, Manufacturing, Supply Chain
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c9f0a1b2c3d4"
down_revision = "b8e9f0a1b2c3"
branch_labels = None
depends_on = None

# Template definitions: (name, doc_type, category, file_path, is_system)
# file_path is a MinIO key placeholder — actual DOCX files are generated on-demand by ERPTemplateEngine
TEMPLATES = [
    # ── Finance (10) ────────────────────────────────────────────────────────
    ("Standard Invoice", "doc", "finance", "templates/finance/standard_invoice.docx", True),
    ("Pro-Forma Invoice", "doc", "finance", "templates/finance/proforma_invoice.docx", True),
    ("Credit Note", "doc", "finance", "templates/finance/credit_note.docx", True),
    ("Payment Receipt", "doc", "finance", "templates/finance/payment_receipt.docx", True),
    ("Expense Report", "xlsx", "finance", "templates/finance/expense_report.xlsx", True),
    ("Profit & Loss Statement", "xlsx", "finance", "templates/finance/profit_loss.xlsx", True),
    ("Balance Sheet", "xlsx", "finance", "templates/finance/balance_sheet.xlsx", True),
    ("Cash Flow Forecast", "xlsx", "finance", "templates/finance/cash_flow_forecast.xlsx", True),
    ("Budget Template", "xlsx", "finance", "templates/finance/budget.xlsx", True),
    ("Board Financial Report", "doc", "finance", "templates/finance/board_financial_report.docx", True),

    # ── HR (10) ─────────────────────────────────────────────────────────────
    ("Offer Letter", "doc", "hr", "templates/hr/offer_letter.docx", True),
    ("Employment Contract", "doc", "hr", "templates/hr/employment_contract.docx", True),
    ("Employee Termination Letter", "doc", "hr", "templates/hr/termination_letter.docx", True),
    ("Warning Letter", "doc", "hr", "templates/hr/warning_letter.docx", True),
    ("Payslip Template", "doc", "hr", "templates/hr/payslip.docx", True),
    ("Performance Review Form", "doc", "hr", "templates/hr/performance_review.docx", True),
    ("Job Description Template", "doc", "hr", "templates/hr/job_description.docx", True),
    ("Headcount Report", "xlsx", "hr", "templates/hr/headcount_report.xlsx", True),
    ("Leave Request Form", "doc", "hr", "templates/hr/leave_request.docx", True),
    ("New Hire Onboarding Checklist", "doc", "hr", "templates/hr/onboarding_checklist.docx", True),

    # ── Legal (6) ───────────────────────────────────────────────────────────
    ("Non-Disclosure Agreement (NDA)", "doc", "legal", "templates/legal/nda.docx", True),
    ("Service Agreement", "doc", "legal", "templates/legal/service_agreement.docx", True),
    ("Vendor Agreement", "doc", "legal", "templates/legal/vendor_agreement.docx", True),
    ("Software License Agreement", "doc", "legal", "templates/legal/software_license.docx", True),
    ("Consulting Agreement", "doc", "legal", "templates/legal/consulting_agreement.docx", True),
    ("Data Processing Agreement (DPA)", "doc", "legal", "templates/legal/dpa.docx", True),

    # ── CRM / Sales (7) ─────────────────────────────────────────────────────
    ("Sales Proposal", "doc", "crm", "templates/crm/sales_proposal.docx", True),
    ("Statement of Work (SoW)", "doc", "crm", "templates/crm/sow.docx", True),
    ("Sales Quotation", "doc", "crm", "templates/crm/quotation.docx", True),
    ("Deal Pipeline Report", "xlsx", "crm", "templates/crm/pipeline_report.xlsx", True),
    ("Customer Onboarding Plan", "doc", "crm", "templates/crm/customer_onboarding.docx", True),
    ("Account Review Presentation", "pptx", "crm", "templates/crm/account_review.pptx", True),
    ("Win/Loss Analysis", "xlsx", "crm", "templates/crm/win_loss_analysis.xlsx", True),

    # ── Projects (5) ────────────────────────────────────────────────────────
    ("Project Charter", "doc", "projects", "templates/projects/project_charter.docx", True),
    ("Project Status Report", "doc", "projects", "templates/projects/status_report.docx", True),
    ("Project Plan / Gantt", "xlsx", "projects", "templates/projects/project_plan.xlsx", True),
    ("Risk Register", "xlsx", "projects", "templates/projects/risk_register.xlsx", True),
    ("Lessons Learned Report", "doc", "projects", "templates/projects/lessons_learned.docx", True),

    # ── Operations / Supply Chain (5) ────────────────────────────────────────
    ("Purchase Order", "doc", "operations", "templates/operations/purchase_order.docx", True),
    ("Request for Quotation (RFQ)", "doc", "operations", "templates/operations/rfq.docx", True),
    ("Goods Receipt Note", "doc", "operations", "templates/operations/goods_receipt.docx", True),
    ("Inventory Count Sheet", "xlsx", "operations", "templates/operations/inventory_count.xlsx", True),
    ("Supplier Evaluation Form", "xlsx", "operations", "templates/operations/supplier_evaluation.xlsx", True),

    # ── Marketing (4) ────────────────────────────────────────────────────────
    ("Marketing Campaign Brief", "doc", "marketing", "templates/marketing/campaign_brief.docx", True),
    ("Content Calendar", "xlsx", "marketing", "templates/marketing/content_calendar.xlsx", True),
    ("Social Media Plan", "xlsx", "marketing", "templates/marketing/social_media_plan.xlsx", True),
    ("Marketing Report", "pptx", "marketing", "templates/marketing/marketing_report.pptx", True),

    # ── Support (3) ──────────────────────────────────────────────────────────
    ("Support Ticket Report", "xlsx", "support", "templates/support/ticket_report.xlsx", True),
    ("SLA Report", "doc", "support", "templates/support/sla_report.docx", True),
    ("Customer Satisfaction Survey", "doc", "support", "templates/support/csat_survey.docx", True),

    # ── Manufacturing (3) ────────────────────────────────────────────────────
    ("Work Order", "doc", "manufacturing", "templates/manufacturing/work_order.docx", True),
    ("Bill of Materials (BOM)", "xlsx", "manufacturing", "templates/manufacturing/bom.xlsx", True),
    ("Quality Control Checklist", "doc", "manufacturing", "templates/manufacturing/qc_checklist.docx", True),

    # ── General / Board (4) ──────────────────────────────────────────────────
    ("Board Meeting Deck", "pptx", "general", "templates/general/board_deck.pptx", True),
    ("Monthly Business Review", "pptx", "general", "templates/general/monthly_review.pptx", True),
    ("Meeting Minutes", "doc", "general", "templates/general/meeting_minutes.docx", True),
    ("Company Announcement", "doc", "general", "templates/general/announcement.docx", True),
]


def upgrade() -> None:
    conn = op.get_bind()

    for name, doc_type, category, file_path, is_system in TEMPLATES:
        conn.execute(sa.text("""
            INSERT INTO document_templates (id, name, doc_type, category, file_path, is_system, rating, rating_count, created_at, updated_at)
            VALUES (
                gen_random_uuid(),
                :name,
                :doc_type,
                :category,
                :file_path,
                :is_system,
                0.0,
                0,
                NOW(),
                NOW()
            )
            ON CONFLICT DO NOTHING
        """), {
            "name": name,
            "doc_type": doc_type,
            "category": category,
            "file_path": file_path,
            "is_system": is_system,
        })


def downgrade() -> None:
    conn = op.get_bind()
    # Remove seeded templates (those with is_system=true and matching our file_paths)
    file_paths = [t[3] for t in TEMPLATES]
    conn.execute(
        sa.text("DELETE FROM document_templates WHERE file_path = ANY(:paths) AND is_system = true"),
        {"paths": file_paths},
    )
