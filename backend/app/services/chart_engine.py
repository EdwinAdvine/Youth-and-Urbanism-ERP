"""Chart Engine — generates chart configurations from ERP data."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class ChartEngine:
    """Generates chart data configurations from ERP module data."""

    CHART_TYPES = ["bar", "line", "pie", "doughnut", "area", "column"]

    PRESET_CHARTS = [
        {"id": "revenue_monthly", "name": "Monthly Revenue", "module": "finance", "chart_type": "bar",
         "description": "Revenue breakdown by month"},
        {"id": "expense_category", "name": "Expenses by Category", "module": "finance", "chart_type": "pie",
         "description": "Expense distribution across categories"},
        {"id": "headcount_dept", "name": "Headcount by Department", "module": "hr", "chart_type": "bar",
         "description": "Employee count per department"},
        {"id": "pipeline_stages", "name": "Pipeline by Stage", "module": "crm", "chart_type": "doughnut",
         "description": "CRM opportunities by stage"},
        {"id": "project_status", "name": "Projects by Status", "module": "projects", "chart_type": "pie",
         "description": "Project distribution by status"},
        {"id": "ticket_trend", "name": "Support Ticket Trend", "module": "support", "chart_type": "line",
         "description": "Daily support tickets over time"},
        {"id": "pos_daily_sales", "name": "Daily POS Sales", "module": "pos", "chart_type": "area",
         "description": "POS sales totals by day"},
        {"id": "inventory_top", "name": "Top Inventory Items", "module": "inventory", "chart_type": "bar",
         "description": "Top items by stock quantity"},
    ]

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate(self, chart_id: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Generate chart data for a preset chart."""
        params = params or {}

        generators = {
            "revenue_monthly": self._revenue_monthly,
            "expense_category": self._expense_category,
            "headcount_dept": self._headcount_dept,
            "pipeline_stages": self._pipeline_stages,
            "project_status": self._project_status,
            "ticket_trend": self._ticket_trend,
            "pos_daily_sales": self._pos_daily_sales,
            "inventory_top": self._inventory_top,
        }

        generator = generators.get(chart_id)
        if not generator:
            return {"error": f"Unknown chart: {chart_id}"}

        data = await generator(params)
        preset = next((p for p in self.PRESET_CHARTS if p["id"] == chart_id), {})
        return {
            "chart_id": chart_id,
            "chart_type": preset.get("chart_type", "bar"),
            "title": preset.get("name", chart_id),
            **data,
        }

    async def _revenue_monthly(self, params: dict) -> dict[str, Any]:
        from app.models.finance import Invoice
        months = int(params.get("months", 6))
        today = date.today()
        labels, values = [], []
        for i in range(months - 1, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            start = date(y, m, 1)
            end = date(y, m + 1, 1) if m < 12 else date(y + 1, 1, 1)
            result = await self.db.execute(
                select(func.coalesce(func.sum(Invoice.total), 0))
                .where(Invoice.status != "draft", Invoice.issue_date >= start, Invoice.issue_date < end)
            )
            val = float(result.scalar() or 0)
            labels.append(start.strftime("%b %Y"))
            values.append(val)
        return {"labels": labels, "datasets": [{"label": "Revenue", "data": values}]}

    async def _expense_category(self, params: dict) -> dict[str, Any]:
        from app.models.finance import Expense
        result = await self.db.execute(
            select(Expense.category, func.coalesce(func.sum(Expense.amount), 0).label("total"))
            .group_by(Expense.category)
            .order_by(func.sum(Expense.amount).desc())
            .limit(10)
        )
        rows = result.all()
        return {
            "labels": [r.category or "Uncategorized" for r in rows],
            "datasets": [{"label": "Expenses", "data": [float(r.total) for r in rows]}],
        }

    async def _headcount_dept(self, params: dict) -> dict[str, Any]:
        from app.models.hr import Employee, Department
        result = await self.db.execute(
            select(Department.name, func.count(Employee.id).label("count"))
            .join(Employee, Employee.department_id == Department.id)
            .where(Employee.status == "active")
            .group_by(Department.name)
            .order_by(func.count(Employee.id).desc())
        )
        rows = result.all()
        return {
            "labels": [r.name for r in rows],
            "datasets": [{"label": "Employees", "data": [r.count for r in rows]}],
        }

    async def _pipeline_stages(self, params: dict) -> dict[str, Any]:
        from app.models.crm import Opportunity
        result = await self.db.execute(
            select(Opportunity.stage, func.count(Opportunity.id).label("count"))
            .group_by(Opportunity.stage)
            .order_by(func.count(Opportunity.id).desc())
        )
        rows = result.all()
        return {
            "labels": [r.stage or "Unknown" for r in rows],
            "datasets": [{"label": "Opportunities", "data": [r.count for r in rows]}],
        }

    async def _project_status(self, params: dict) -> dict[str, Any]:
        from app.models.projects import Project
        result = await self.db.execute(
            select(Project.status, func.count(Project.id).label("count"))
            .group_by(Project.status)
        )
        rows = result.all()
        return {
            "labels": [r.status or "Unknown" for r in rows],
            "datasets": [{"label": "Projects", "data": [r.count for r in rows]}],
        }

    async def _ticket_trend(self, params: dict) -> dict[str, Any]:
        from app.models.support import Ticket
        days = int(params.get("days", 14))
        start = datetime.utcnow() - timedelta(days=days)
        result = await self.db.execute(
            select(func.date(Ticket.created_at).label("day"), func.count(Ticket.id).label("count"))
            .where(Ticket.created_at >= start)
            .group_by(func.date(Ticket.created_at))
            .order_by(func.date(Ticket.created_at))
        )
        rows = result.all()
        return {
            "labels": [str(r.day) for r in rows],
            "datasets": [{"label": "Tickets", "data": [r.count for r in rows]}],
        }

    async def _pos_daily_sales(self, params: dict) -> dict[str, Any]:
        from app.models.pos import POSTransaction
        days = int(params.get("days", 14))
        start = datetime.utcnow() - timedelta(days=days)
        result = await self.db.execute(
            select(
                func.date(POSTransaction.created_at).label("day"),
                func.coalesce(func.sum(POSTransaction.total_amount), 0).label("total"),
            )
            .where(POSTransaction.created_at >= start)
            .group_by(func.date(POSTransaction.created_at))
            .order_by(func.date(POSTransaction.created_at))
        )
        rows = result.all()
        return {
            "labels": [str(r.day) for r in rows],
            "datasets": [{"label": "Sales", "data": [float(r.total) for r in rows]}],
        }

    async def _inventory_top(self, params: dict) -> dict[str, Any]:
        from app.models.inventory import InventoryItem, StockLevel
        limit = int(params.get("limit", 10))
        result = await self.db.execute(
            select(InventoryItem.name, func.coalesce(func.sum(StockLevel.quantity), 0).label("qty"))
            .join(StockLevel, StockLevel.item_id == InventoryItem.id)
            .group_by(InventoryItem.name)
            .order_by(func.sum(StockLevel.quantity).desc())
            .limit(limit)
        )
        rows = result.all()
        return {
            "labels": [r.name for r in rows],
            "datasets": [{"label": "Stock", "data": [float(r.qty) for r in rows]}],
        }

    @staticmethod
    def available_charts() -> list[dict[str, str]]:
        return ChartEngine.PRESET_CHARTS
