"""ERP Formula Engine — evaluates ERP.* custom formulas against live database data."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class ERPFormulaEngine:
    """Evaluates ERP.* spreadsheet formulas by querying live ERP module data."""

    SUPPORTED_FUNCTIONS = {
        "ERP.REVENUE": "Total revenue for a period",
        "ERP.EXPENSE": "Total expenses by category and period",
        "ERP.HEADCOUNT": "Employee headcount by department",
        "ERP.STOCK": "Current stock level for a product",
        "ERP.PIPELINE": "CRM pipeline value and deal count",
        "ERP.INVOICE_COUNT": "Number of invoices in a period",
        "ERP.PAYROLL_TOTAL": "Total payroll for a period",
        "ERP.PROJECT_PROGRESS": "Project completion percentage",
        "ERP.OPEN_TICKETS": "Open support ticket count",
        "ERP.POS_SALES": "POS sales total for a period",
    }

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def evaluate(self, formula: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Evaluate an ERP.* formula and return the result."""
        params = params or {}
        formula_upper = formula.strip().upper()

        if formula_upper.startswith("ERP.REVENUE"):
            return await self._revenue(params)
        elif formula_upper.startswith("ERP.EXPENSE"):
            return await self._expense(params)
        elif formula_upper.startswith("ERP.HEADCOUNT"):
            return await self._headcount(params)
        elif formula_upper.startswith("ERP.STOCK"):
            return await self._stock(params)
        elif formula_upper.startswith("ERP.PIPELINE"):
            return await self._pipeline(params)
        elif formula_upper.startswith("ERP.INVOICE_COUNT"):
            return await self._invoice_count(params)
        elif formula_upper.startswith("ERP.PAYROLL_TOTAL"):
            return await self._payroll_total(params)
        elif formula_upper.startswith("ERP.PROJECT_PROGRESS"):
            return await self._project_progress(params)
        elif formula_upper.startswith("ERP.OPEN_TICKETS"):
            return await self._open_tickets(params)
        elif formula_upper.startswith("ERP.POS_SALES"):
            return await self._pos_sales(params)
        else:
            return {"error": f"Unknown formula: {formula}", "value": None}

    async def evaluate_batch(self, formulas: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Evaluate multiple formulas in one call."""
        results = []
        for item in formulas:
            result = await self.evaluate(item.get("formula", ""), item.get("params"))
            result["cell"] = item.get("cell", "")
            results.append(result)
        return results

    async def refresh_data_connection(self, connection_id: uuid.UUID) -> dict[str, Any]:
        """Refresh a SpreadsheetDataConnection and return updated data."""
        from app.models.docs import SpreadsheetDataConnection

        conn = await self.db.get(SpreadsheetDataConnection, connection_id)
        if not conn:
            return {"error": "Connection not found"}

        result = await self.evaluate(
            f"ERP.{conn.query_type.upper()}",
            conn.query_params or {},
        )

        conn.cached_data = result
        conn.last_refreshed = datetime.utcnow()
        await self.db.commit()

        return {
            "connection_id": str(connection_id),
            "data": result,
            "refreshed_at": conn.last_refreshed.isoformat(),
        }

    # ── Formula implementations ──────────────────────────────────────────

    def _parse_dates(self, params: dict) -> tuple[date | None, date | None]:
        start = params.get("start_date") or params.get("period_start") or params.get("period")
        end = params.get("end_date") or params.get("period_end")
        start_date = date.fromisoformat(start) if start else None
        end_date = date.fromisoformat(end) if end else None
        return start_date, end_date

    async def _revenue(self, params: dict) -> dict[str, Any]:
        from app.models.finance import Invoice
        query = select(func.coalesce(func.sum(Invoice.total), 0)).where(Invoice.status != "draft")
        start_date, end_date = self._parse_dates(params)
        if start_date:
            query = query.where(Invoice.issue_date >= start_date)
        if end_date:
            query = query.where(Invoice.issue_date <= end_date)
        result = await self.db.execute(query)
        total = result.scalar() or 0
        return {"value": float(total), "formula": "ERP.REVENUE", "label": "Total Revenue", "currency": "USD"}

    async def _expense(self, params: dict) -> dict[str, Any]:
        from app.models.finance import Expense
        query = select(func.coalesce(func.sum(Expense.amount), 0))
        category = params.get("category")
        if category:
            query = query.where(Expense.category == category)
        start_date, end_date = self._parse_dates(params)
        if start_date:
            query = query.where(Expense.expense_date >= start_date)
        if end_date:
            query = query.where(Expense.expense_date <= end_date)
        result = await self.db.execute(query)
        total = result.scalar() or 0
        return {"value": float(total), "formula": "ERP.EXPENSE", "label": f"Expenses{' - ' + category if category else ''}", "currency": "USD"}

    async def _headcount(self, params: dict) -> dict[str, Any]:
        from app.models.hr import Employee
        query = select(func.count(Employee.id)).where(Employee.status == "active")
        dept = params.get("department") or params.get("dept")
        if dept:
            query = query.where(Employee.department_id == uuid.UUID(dept))
        result = await self.db.execute(query)
        count = result.scalar() or 0
        return {"value": count, "formula": "ERP.HEADCOUNT", "label": "Active Headcount"}

    async def _stock(self, params: dict) -> dict[str, Any]:
        from app.models.inventory import StockLevel
        product_id = params.get("product_id") or params.get("item_id")
        if not product_id:
            return {"value": 0, "formula": "ERP.STOCK", "error": "product_id required"}
        query = select(func.coalesce(func.sum(StockLevel.quantity), 0)).where(
            StockLevel.item_id == uuid.UUID(product_id)
        )
        result = await self.db.execute(query)
        qty = result.scalar() or 0
        return {"value": float(qty), "formula": "ERP.STOCK", "label": "Stock Level"}

    async def _pipeline(self, params: dict) -> dict[str, Any]:
        from app.models.crm import Opportunity
        query_value = select(func.coalesce(func.sum(Opportunity.expected_value), 0))
        query_count = select(func.count(Opportunity.id))
        pipeline_id = params.get("pipeline_id")
        if pipeline_id:
            query_value = query_value.where(Opportunity.pipeline_id == uuid.UUID(pipeline_id))
            query_count = query_count.where(Opportunity.pipeline_id == uuid.UUID(pipeline_id))
        result_value = await self.db.execute(query_value)
        result_count = await self.db.execute(query_count)
        total_value = result_value.scalar() or 0
        deal_count = result_count.scalar() or 0
        return {"value": float(total_value), "count": deal_count, "formula": "ERP.PIPELINE", "label": "Pipeline Value", "currency": "USD"}

    async def _invoice_count(self, params: dict) -> dict[str, Any]:
        from app.models.finance import Invoice
        query = select(func.count(Invoice.id))
        start_date, end_date = self._parse_dates(params)
        if start_date:
            query = query.where(Invoice.issue_date >= start_date)
        if end_date:
            query = query.where(Invoice.issue_date <= end_date)
        status_filter = params.get("status")
        if status_filter:
            query = query.where(Invoice.status == status_filter)
        result = await self.db.execute(query)
        count = result.scalar() or 0
        return {"value": count, "formula": "ERP.INVOICE_COUNT", "label": "Invoice Count"}

    async def _payroll_total(self, params: dict) -> dict[str, Any]:
        from app.models.hr import Payslip
        query = select(func.coalesce(func.sum(Payslip.gross_pay), 0))
        start_date, end_date = self._parse_dates(params)
        if start_date:
            query = query.where(Payslip.period_start >= start_date)
        if end_date:
            query = query.where(Payslip.period_end <= end_date)
        result = await self.db.execute(query)
        total = result.scalar() or 0
        return {"value": float(total), "formula": "ERP.PAYROLL_TOTAL", "label": "Payroll Total", "currency": "USD"}

    async def _project_progress(self, params: dict) -> dict[str, Any]:
        from app.models.projects import Task
        project_id = params.get("project_id")
        if not project_id:
            return {"value": 0, "formula": "ERP.PROJECT_PROGRESS", "error": "project_id required"}
        total_q = select(func.count(Task.id)).where(Task.project_id == uuid.UUID(project_id))
        done_q = select(func.count(Task.id)).where(
            Task.project_id == uuid.UUID(project_id),
            Task.status == "done",
        )
        total_result = await self.db.execute(total_q)
        done_result = await self.db.execute(done_q)
        total = total_result.scalar() or 0
        done = done_result.scalar() or 0
        pct = round((done / total) * 100, 1) if total > 0 else 0
        return {"value": pct, "total_tasks": total, "completed_tasks": done, "formula": "ERP.PROJECT_PROGRESS", "label": "Project Progress %"}

    async def _open_tickets(self, params: dict) -> dict[str, Any]:
        from app.models.support import Ticket
        query = select(func.count(Ticket.id)).where(Ticket.status.in_(["open", "in_progress", "pending"]))
        result = await self.db.execute(query)
        count = result.scalar() or 0
        return {"value": count, "formula": "ERP.OPEN_TICKETS", "label": "Open Tickets"}

    async def _pos_sales(self, params: dict) -> dict[str, Any]:
        from app.models.pos import POSTransaction
        query = select(func.coalesce(func.sum(POSTransaction.total_amount), 0))
        start_date, end_date = self._parse_dates(params)
        if start_date:
            query = query.where(func.date(POSTransaction.created_at) >= start_date)
        if end_date:
            query = query.where(func.date(POSTransaction.created_at) <= end_date)
        result = await self.db.execute(query)
        total = result.scalar() or 0
        return {"value": float(total), "formula": "ERP.POS_SALES", "label": "POS Sales Total", "currency": "USD"}

    @staticmethod
    def available_functions() -> list[dict[str, str]]:
        return [
            {"name": name, "description": desc}
            for name, desc in ERPFormulaEngine.SUPPORTED_FUNCTIONS.items()
        ]
