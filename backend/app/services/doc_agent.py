"""Agentic Document Copilot — multi-step document creation from ERP data."""
from __future__ import annotations

import io
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class DocAgentService:
    """Creates complex documents by gathering data from multiple ERP modules."""

    def __init__(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        self.db = db
        self.user_id = user_id

    async def _ai_chat(self, prompt: str, system_prompt: str | None = None) -> str:
        """Call AI service for text generation."""
        try:
            from app.services.ai import AIService
            svc = AIService(self.db)
            result = await svc.chat(self.user_id, prompt, system_prompt=system_prompt)
            return result.get("content", "")
        except Exception:
            return ""

    async def _gather_finance_data(self, start: date | None = None, end: date | None = None) -> dict[str, Any]:
        """Gather financial summary data."""
        from app.models.finance import Invoice, Expense

        inv_query = select(
            func.coalesce(func.sum(Invoice.total), 0).label("revenue"),
            func.count(Invoice.id).label("invoice_count"),
        ).where(Invoice.status != "draft")
        exp_query = select(func.coalesce(func.sum(Expense.amount), 0).label("expenses"))

        if start:
            inv_query = inv_query.where(Invoice.issue_date >= start)
            exp_query = exp_query.where(Expense.expense_date >= start)
        if end:
            inv_query = inv_query.where(Invoice.issue_date <= end)
            exp_query = exp_query.where(Expense.expense_date <= end)

        inv_result = await self.db.execute(inv_query)
        inv_row = inv_result.one()
        exp_result = await self.db.execute(exp_query)
        exp_total = exp_result.scalar() or 0

        return {
            "revenue": float(inv_row.revenue),
            "invoice_count": inv_row.invoice_count,
            "expenses": float(exp_total),
            "net_income": float(inv_row.revenue) - float(exp_total),
        }

    async def _gather_hr_data(self) -> dict[str, Any]:
        """Gather HR summary data."""
        from app.models.hr import Employee, Department

        headcount = (await self.db.execute(
            select(func.count(Employee.id)).where(Employee.status == "active")
        )).scalar() or 0

        dept_count = (await self.db.execute(select(func.count(Department.id)))).scalar() or 0

        return {"active_employees": headcount, "departments": dept_count}

    async def _gather_crm_data(self) -> dict[str, Any]:
        """Gather CRM summary data."""
        from app.models.crm import Deal, Opportunity

        pipeline_value = (await self.db.execute(
            select(func.coalesce(func.sum(Opportunity.expected_value), 0))
        )).scalar() or 0

        deal_count = (await self.db.execute(select(func.count(Deal.id)))).scalar() or 0
        won_deals = (await self.db.execute(
            select(func.count(Deal.id)).where(Deal.status == "won")
        )).scalar() or 0

        return {
            "pipeline_value": float(pipeline_value),
            "total_deals": deal_count,
            "won_deals": won_deals,
        }

    async def _gather_project_data(self) -> dict[str, Any]:
        """Gather project summary data."""
        from app.models.projects import Project, Task

        total_projects = (await self.db.execute(select(func.count(Project.id)))).scalar() or 0
        active_projects = (await self.db.execute(
            select(func.count(Project.id)).where(Project.status == "active")
        )).scalar() or 0
        total_tasks = (await self.db.execute(select(func.count(Task.id)))).scalar() or 0
        done_tasks = (await self.db.execute(
            select(func.count(Task.id)).where(Task.status == "done")
        )).scalar() or 0

        return {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "total_tasks": total_tasks,
            "completed_tasks": done_tasks,
            "completion_rate": round((done_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0,
        }

    async def create_board_deck(self, period: str | None = None) -> dict[str, Any]:
        """Create a board meeting deck pulling data from Finance, HR, CRM, Projects.

        Returns dict with file_bytes, filename, content_type.
        """
        today = date.today()
        if period:
            parts = period.split("-")
            year = int(parts[0])
            quarter = int(parts[1].replace("Q", "").replace("q", "")) if len(parts) > 1 else ((today.month - 1) // 3) + 1
        else:
            year = today.year
            quarter = ((today.month - 1) // 3) + 1

        q_start = date(year, (quarter - 1) * 3 + 1, 1)
        q_end_month = quarter * 3
        if q_end_month == 12:
            q_end = date(year, 12, 31)
        else:
            q_end = date(year, q_end_month + 1, 1)

        # Gather data from all modules
        finance = await self._gather_finance_data(q_start, q_end)
        hr = await self._gather_hr_data()
        crm = await self._gather_crm_data()
        projects = await self._gather_project_data()

        # Generate executive summary via AI
        data_summary = (
            f"Q{quarter} {year} Data:\n"
            f"Revenue: ${finance['revenue']:,.2f}, Expenses: ${finance['expenses']:,.2f}, "
            f"Net Income: ${finance['net_income']:,.2f}, Invoices: {finance['invoice_count']}\n"
            f"Headcount: {hr['active_employees']}, Departments: {hr['departments']}\n"
            f"Pipeline: ${crm['pipeline_value']:,.2f}, Deals: {crm['total_deals']} (Won: {crm['won_deals']})\n"
            f"Projects: {projects['active_projects']} active, Tasks: {projects['completion_rate']}% complete"
        )

        exec_summary = await self._ai_chat(
            f"Write a concise 3-paragraph executive summary for a board meeting based on this data:\n{data_summary}",
            system_prompt="You are a business analyst writing board meeting documents. Be concise and data-driven.",
        )

        # Build DOCX
        from docx import Document as DocxDocument
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = DocxDocument()
        style = doc.styles["Normal"]
        style.font.name = "Open Sans"
        style.font.size = Pt(11)

        # Title
        title = doc.add_heading(f"Board Meeting Report — Q{quarter} {year}", level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in title.runs:
            run.font.color.rgb = RGBColor(0x51, 0x45, 0x9D)

        doc.add_paragraph(f"Generated: {today.strftime('%B %d, %Y')}")
        doc.add_paragraph("")

        # Executive Summary
        doc.add_heading("Executive Summary", level=1)
        doc.add_paragraph(exec_summary or "No AI summary available.")

        # Financial Highlights
        doc.add_heading("Financial Highlights", level=1)
        table = doc.add_table(rows=5, cols=2, style="Light Grid Accent 1")
        metrics = [
            ("Revenue", f"${finance['revenue']:,.2f}"),
            ("Expenses", f"${finance['expenses']:,.2f}"),
            ("Net Income", f"${finance['net_income']:,.2f}"),
            ("Invoices Issued", str(finance['invoice_count'])),
            ("Profit Margin", f"{(finance['net_income'] / finance['revenue'] * 100):.1f}%" if finance['revenue'] > 0 else "N/A"),
        ]
        for i, (label, value) in enumerate(metrics):
            table.rows[i].cells[0].text = label
            table.rows[i].cells[1].text = value

        # HR Overview
        doc.add_heading("Human Resources", level=1)
        doc.add_paragraph(f"Active Employees: {hr['active_employees']}")
        doc.add_paragraph(f"Departments: {hr['departments']}")

        # Sales & CRM
        doc.add_heading("Sales & CRM Pipeline", level=1)
        doc.add_paragraph(f"Pipeline Value: ${crm['pipeline_value']:,.2f}")
        doc.add_paragraph(f"Total Deals: {crm['total_deals']} (Won: {crm['won_deals']})")
        win_rate = round((crm['won_deals'] / crm['total_deals']) * 100, 1) if crm['total_deals'] > 0 else 0
        doc.add_paragraph(f"Win Rate: {win_rate}%")

        # Project Status
        doc.add_heading("Project Portfolio", level=1)
        doc.add_paragraph(f"Active Projects: {projects['active_projects']} of {projects['total_projects']}")
        doc.add_paragraph(f"Task Completion Rate: {projects['completion_rate']}%")

        buf = io.BytesIO()
        doc.save(buf)
        filename = f"Board_Report_Q{quarter}_{year}.docx"

        return {
            "file_bytes": buf.getvalue(),
            "filename": filename,
            "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "sections": ["Executive Summary", "Financial Highlights", "HR", "CRM", "Projects"],
            "data": {"finance": finance, "hr": hr, "crm": crm, "projects": projects},
        }

    async def create_monthly_report(self, department: str | None = None, month: str | None = None) -> dict[str, Any]:
        """Create a monthly department report."""
        today = date.today()
        if month:
            parts = month.split("-")
            year, mon = int(parts[0]), int(parts[1])
        else:
            year, mon = today.year, today.month

        start = date(year, mon, 1)
        if mon == 12:
            end = date(year + 1, 1, 1)
        else:
            end = date(year, mon + 1, 1)

        finance = await self._gather_finance_data(start, end)
        hr = await self._gather_hr_data()
        projects = await self._gather_project_data()

        from docx import Document as DocxDocument
        from docx.shared import Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = DocxDocument()
        style = doc.styles["Normal"]
        style.font.name = "Open Sans"
        style.font.size = Pt(11)

        month_name = start.strftime("%B %Y")
        title = doc.add_heading(f"Monthly Report — {month_name}", level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in title.runs:
            run.font.color.rgb = RGBColor(0x51, 0x45, 0x9D)

        if department:
            doc.add_paragraph(f"Department: {department}")

        doc.add_heading("Financial Summary", level=1)
        doc.add_paragraph(f"Revenue: ${finance['revenue']:,.2f}")
        doc.add_paragraph(f"Expenses: ${finance['expenses']:,.2f}")
        doc.add_paragraph(f"Net: ${finance['net_income']:,.2f}")

        doc.add_heading("Team", level=1)
        doc.add_paragraph(f"Active employees: {hr['active_employees']}")

        doc.add_heading("Projects", level=1)
        doc.add_paragraph(f"Active: {projects['active_projects']}")
        doc.add_paragraph(f"Task completion: {projects['completion_rate']}%")

        buf = io.BytesIO()
        doc.save(buf)
        dept_slug = department.replace(" ", "_") if department else "all"
        filename = f"Monthly_Report_{dept_slug}_{year}_{mon:02d}.docx"

        return {
            "file_bytes": buf.getvalue(),
            "filename": filename,
            "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }

    async def create_proposal(self, deal_id: str) -> dict[str, Any]:
        """Create a sales proposal document from CRM deal data."""
        from app.models.crm import Deal, Contact

        deal = await self.db.get(Deal, uuid.UUID(deal_id))
        if not deal:
            raise ValueError(f"Deal {deal_id} not found")

        contact = await self.db.get(Contact, deal.contact_id) if deal.contact_id else None

        proposal_text = await self._ai_chat(
            f"Write a professional sales proposal for:\n"
            f"Deal: {deal.title}\nValue: ${float(deal.deal_value or 0):,.2f}\n"
            f"Client: {contact.name if contact else 'N/A'}\n"
            f"Company: {contact.company if contact else 'N/A'}",
            system_prompt="You are a sales professional writing compelling proposals. Include sections: Introduction, Proposed Solution, Pricing, Timeline, Terms.",
        )

        from docx import Document as DocxDocument
        from docx.shared import Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = DocxDocument()
        style = doc.styles["Normal"]
        style.font.name = "Open Sans"
        style.font.size = Pt(11)

        title = doc.add_heading(f"Proposal: {deal.title}", level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in title.runs:
            run.font.color.rgb = RGBColor(0x51, 0x45, 0x9D)

        doc.add_paragraph(f"Prepared for: {contact.name if contact else 'N/A'}")
        doc.add_paragraph(f"Date: {date.today().strftime('%B %d, %Y')}")
        doc.add_paragraph(f"Deal Value: ${float(deal.deal_value or 0):,.2f}")
        doc.add_paragraph("")

        for paragraph in (proposal_text or "Proposal content pending.").split("\n"):
            if paragraph.strip():
                doc.add_paragraph(paragraph.strip())

        buf = io.BytesIO()
        doc.save(buf)
        safe_title = deal.title.replace(" ", "_")[:30] if deal.title else "proposal"
        filename = f"Proposal_{safe_title}_{date.today().isoformat()}.docx"

        return {
            "file_bytes": buf.getvalue(),
            "filename": filename,
            "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }

    @staticmethod
    def available_actions() -> list[dict[str, str]]:
        return [
            {"id": "board_deck", "name": "Board Meeting Deck", "description": "Comprehensive board report with Finance, HR, CRM, and Project data"},
            {"id": "monthly_report", "name": "Monthly Report", "description": "Monthly department summary with key metrics"},
            {"id": "proposal", "name": "Sales Proposal", "description": "Professional proposal from CRM deal data"},
        ]
