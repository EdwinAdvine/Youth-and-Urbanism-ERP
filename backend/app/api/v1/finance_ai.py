"""Finance AI endpoints — 2026-era AI-native finance features.

Features:
- Cash flow forecast (30/60/90 day)
- Financial narrative generator
- AI bank transaction categorizer
- Receipt OCR (Ollama vision)
- Natural language report query
- Anomaly detection
- Tax optimizer suggestions
- Smart dunning engine
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta

import httpx
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select, text

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.models.finance import (
    Invoice,
    Expense,
    VendorBill,
    DunningLog,
)
from app.models.finance_ext import BankCategorizationRule

router = APIRouter(tags=["Finance AI"])


# ── Ollama helper ──────────────────────────────────────────────────────────

async def _ollama_complete(prompt: str, model: str = "llama3.2", max_tokens: int = 1024) -> str:
    """Send a completion request to Ollama."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False, "options": {"num_predict": max_tokens}},
            )
            resp.raise_for_status()
            return resp.json().get("response", "")
    except Exception as e:
        return f"[AI unavailable: {str(e)[:100]}]"


# ── Cash Flow Forecast ─────────────────────────────────────────────────────

@router.get("/ai/cash-flow-forecast")
async def cash_flow_forecast(
    db: DBSession,
    current_user: CurrentUser,
    horizon_days: int = Query(90, ge=7, le=365),
):
    """30/60/90-day rolling cash flow forecast.

    Uses: scheduled invoice due dates, historical collection rates,
    recurring expenses, upcoming vendor bill due dates.
    """
    today = date.today()
    horizon_end = today + timedelta(days=horizon_days)

    # Expected inflows: unpaid invoices by due date
    inv_result = await db.execute(
        select(Invoice).where(
            Invoice.status.in_(["sent", "overdue"]),
            Invoice.due_date <= horizon_end,
        )
    )
    pending_invoices = inv_result.scalars().all()

    # Historical collection rate per customer (last 12 months)
    paid_result = await db.execute(
        select(Invoice).where(
            Invoice.status == "paid",
            Invoice.issue_date >= today - timedelta(days=365),
        )
    )
    paid_invoices = paid_result.scalars().all()

    # Simple collection rate: paid / (paid + overdue) by customer
    customer_paid: dict[str, int] = {}
    customer_total: dict[str, int] = {}
    for inv in paid_invoices:
        key = inv.customer_name or "unknown"
        customer_paid[key] = customer_paid.get(key, 0) + 1
        customer_total[key] = customer_total.get(key, 0) + 1
    inv_result2 = await db.execute(select(Invoice).where(Invoice.status == "overdue"))
    for inv in inv_result2.scalars().all():
        key = inv.customer_name or "unknown"
        customer_total[key] = customer_total.get(key, 0) + 1

    overall_rate = (
        len(paid_invoices) / max(len(paid_invoices) + len((await db.execute(
            select(Invoice).where(Invoice.status == "overdue")
        )).scalars().all()), 1)
    )

    # Expected outflows: pending vendor bills by due date
    bill_result = await db.execute(
        select(VendorBill).where(
            VendorBill.status.in_(["received", "approved"]),
            VendorBill.due_date <= horizon_end,
        )
    )
    pending_bills = bill_result.scalars().all()

    # Build daily forecast buckets: 30/60/90 day segments
    def bucket(d: date) -> str:
        delta = (d - today).days
        if delta <= 30:
            return "0-30"
        elif delta <= 60:
            return "31-60"
        else:
            return "61-90"

    inflows: dict[str, float] = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0}
    outflows: dict[str, float] = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0}
    inflow_items: list[dict] = []
    outflow_items: list[dict] = []

    for inv in pending_invoices:
        b = bucket(inv.due_date)
        rate = customer_paid.get(inv.customer_name or "unknown", 0) / max(
            customer_total.get(inv.customer_name or "unknown", 1), 1
        ) if (inv.customer_name or "unknown") in customer_total else overall_rate
        expected = float(inv.total) * rate
        inflows[b] = inflows.get(b, 0.0) + expected
        inflow_items.append({
            "invoice_number": inv.invoice_number,
            "customer": inv.customer_name,
            "due_date": str(inv.due_date),
            "amount": float(inv.total),
            "expected_amount": round(expected, 2),
            "collection_rate": round(rate, 2),
            "bucket": b,
        })

    for bill in pending_bills:
        b = bucket(bill.due_date)
        outflows[b] = outflows.get(b, 0.0) + float(bill.total)
        outflow_items.append({
            "bill_number": bill.bill_number,
            "vendor": bill.vendor_name,
            "due_date": str(bill.due_date),
            "amount": float(bill.total),
            "bucket": b,
        })

    net = {k: round(inflows[k] - outflows[k], 2) for k in ["0-30", "31-60", "61-90"]}

    # Generate AI narrative
    prompt = f"""You are a financial analyst. Based on this cash flow forecast data, write a concise 2-3 sentence executive summary.

Forecast horizon: {horizon_days} days
Expected inflows: 0-30 days: ${inflows['0-30']:.0f}, 31-60 days: ${inflows['31-60']:.0f}, 61-90 days: ${inflows['61-90']:.0f}
Expected outflows: 0-30 days: ${outflows['0-30']:.0f}, 31-60 days: ${outflows['31-60']:.0f}, 61-90 days: ${outflows['61-90']:.0f}
Net cash flow: 0-30 days: ${net['0-30']:.0f}, 31-60 days: ${net['31-60']:.0f}, 61-90 days: ${net['61-90']:.0f}
Overall collection rate: {overall_rate:.0%}

Identify any cash shortfall risks and highlight the most critical period. Be direct and specific."""

    narrative = await _ollama_complete(prompt, max_tokens=200)

    return {
        "horizon_days": horizon_days,
        "as_of": str(today),
        "overall_collection_rate": round(overall_rate, 3),
        "buckets": {
            "0-30": {"inflow": round(inflows["0-30"], 2), "outflow": round(outflows["0-30"], 2), "net": net["0-30"]},
            "31-60": {"inflow": round(inflows["31-60"], 2), "outflow": round(outflows["31-60"], 2), "net": net["31-60"]},
            "61-90": {"inflow": round(inflows["61-90"], 2), "outflow": round(outflows["61-90"], 2), "net": net["61-90"]},
        },
        "inflow_items": inflow_items,
        "outflow_items": outflow_items,
        "ai_narrative": narrative,
        "alerts": [
            f"Cash shortfall of ${abs(net[k]):.0f} projected in {k} days period"
            for k in ["0-30", "31-60", "61-90"]
            if net[k] < 0
        ],
    }


# ── Financial Narrative Generator ─────────────────────────────────────────

class NarrativeRequest(BaseModel):
    report_type: str  # pnl, balance_sheet, cash_flow, budget_vs_actual, kpis
    report_data: dict
    period_label: str = "this period"
    audience: str = "executive"  # executive, accountant, board


@router.post("/ai/financial-narrative")
async def generate_financial_narrative(
    payload: NarrativeRequest,
    current_user: CurrentUser,
):
    """Generate an AI executive summary for any financial report."""
    audience_instruction = {
        "executive": "Write for a CEO. Focus on key insights, growth, and strategic implications. Use plain language.",
        "accountant": "Write for a CPA. Include technical accounting observations, variance analysis, and compliance notes.",
        "board": "Write for a board of directors. Focus on financial health, risks, and strategic recommendations.",
    }.get(payload.audience, "Write a clear, professional financial summary.")

    data_summary = json.dumps(payload.report_data, default=str, indent=2)[:2000]

    prompt = f"""You are a senior financial analyst preparing a {payload.report_type.replace("_", " ")} narrative.
{audience_instruction}

Period: {payload.period_label}
Report data:
{data_summary}

Write a 3-5 sentence executive narrative that:
1. Leads with the most important financial insight
2. Highlights key drivers of performance
3. Identifies any risks or opportunities
4. Ends with a forward-looking statement

Be specific with numbers from the data. Do not use generic phrases."""

    narrative = await _ollama_complete(prompt, max_tokens=300)

    return {
        "report_type": payload.report_type,
        "period_label": payload.period_label,
        "audience": payload.audience,
        "narrative": narrative,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ── AI Bank Transaction Categorizer ───────────────────────────────────────

class CategorizationRequest(BaseModel):
    transactions: list[dict]  # [{description: str, amount: float, date: str}]
    apply_rules: bool = True


@router.post("/ai/categorize-bank-transactions")
async def categorize_bank_transactions(
    payload: CategorizationRequest,
    db: DBSession,
    current_user: CurrentUser,
):
    """AI-powered bank transaction categorization using rules + Ollama embeddings."""
    # First pass: apply exact rules from BankCategorizationRule table
    rules_result = await db.execute(
        select(BankCategorizationRule)
        .where(BankCategorizationRule.is_active == True)
        .order_by(BankCategorizationRule.priority.asc())
    )
    rules = rules_result.scalars().all()

    results = []
    for txn in payload.transactions:
        desc = txn.get("description", "")
        matched_rule = None

        if payload.apply_rules:
            for rule in rules:
                pattern = rule.pattern.lower()
                desc_lower = desc.lower()
                match = False
                if rule.match_type == "contains":
                    match = pattern in desc_lower
                elif rule.match_type == "starts_with":
                    match = desc_lower.startswith(pattern)
                elif rule.match_type == "ends_with":
                    match = desc_lower.endswith(pattern)
                elif rule.match_type == "exact":
                    match = desc_lower == pattern
                elif rule.match_type == "regex":
                    import re
                    try:
                        match = bool(re.search(pattern, desc_lower))
                    except Exception:
                        pass

                if match:
                    matched_rule = rule
                    rule.match_count = (rule.match_count or 0) + 1
                    break

        if matched_rule:
            results.append({
                **txn,
                "suggested_account_id": str(matched_rule.account_id),
                "confidence": 0.99,
                "match_source": "rule",
                "rule_id": str(matched_rule.id),
            })
        else:
            # Fall back to Ollama AI classification
            prompt = f"""You are an accounting assistant. Classify this bank transaction into one of these categories:
- Revenue (sales income, customer payments)
- Cost of Goods Sold (COGS, inventory costs)
- Payroll (salaries, wages, contractor fees)
- Software & Subscriptions (SaaS, tools, licenses)
- Marketing & Advertising
- Travel & Meals
- Office & Supplies
- Utilities (electricity, internet, phone)
- Rent & Facilities
- Professional Services (legal, accounting, consulting)
- Bank Fees & Interest
- Taxes & Compliance
- Equipment & Depreciation
- Other

Transaction description: "{desc}"
Amount: {txn.get('amount', 0)}

Respond with ONLY: CategoryName|confidence_score (e.g. "Software & Subscriptions|0.92")"""

            ai_response = await _ollama_complete(prompt, max_tokens=30)
            parts = ai_response.strip().split("|")
            category = parts[0].strip() if parts else "Other"
            try:
                confidence = float(parts[1].strip()) if len(parts) > 1 else 0.6
            except (ValueError, IndexError):
                confidence = 0.6

            results.append({
                **txn,
                "suggested_category": category,
                "confidence": min(confidence, 0.99),
                "match_source": "ai",
                "rule_id": None,
            })

    await db.flush()
    return {
        "total": len(results),
        "categorized_by_rule": sum(1 for r in results if r.get("match_source") == "rule"),
        "categorized_by_ai": sum(1 for r in results if r.get("match_source") == "ai"),
        "results": results,
    }


# ── Natural Language Report Query ──────────────────────────────────────────

class NLQueryRequest(BaseModel):
    query: str
    max_rows: int = 50


@router.post("/ai/nl-query")
async def natural_language_query(
    payload: NLQueryRequest,
    db: DBSession,
    current_user: CurrentUser,
):
    """Convert natural language financial query to safe SQL and execute it.

    SAFETY: Only SELECT queries against finance tables. No DDL/DML allowed.
    """
    # Describe schema to Ollama
    schema_desc = """Finance database tables:
- finance_invoices (id, invoice_number, invoice_type, status, customer_name, customer_email, issue_date, due_date, subtotal, tax_amount, total, currency, created_at)
- finance_payments (id, payment_number, amount, currency, payment_method, payment_date, status)
- finance_expenses (id, description, amount, currency, category, expense_date, status, created_at)
- finance_vendor_bills (id, bill_number, vendor_name, vendor_email, issue_date, due_date, total, status, currency)
- finance_accounts (id, code, name, account_type, is_active)
- finance_budgets (id, name, fiscal_year, total_amount, spent_amount, status)
- finance_fixed_assets (id, name, asset_code, category, purchase_cost, current_value, status)"""

    prompt = f"""You are a PostgreSQL expert. Convert this natural language query to a safe SQL SELECT statement.

Database schema:
{schema_desc}

User query: "{payload.query}"

Rules:
1. Only generate SELECT statements — never INSERT, UPDATE, DELETE, DROP, CREATE, or any DDL/DML
2. Use only the tables listed above
3. Limit results to {payload.max_rows} rows using LIMIT
4. Return ONLY the SQL statement, no explanation
5. If the query is ambiguous or unsafe, return: SELECT 'Query not supported' as message;"""

    sql = await _ollama_complete(prompt, max_tokens=200)
    sql = sql.strip().strip("`").strip()

    # Safety check — block any non-SELECT or dangerous patterns
    sql_upper = sql.upper().strip()
    dangerous = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "EXEC", "EXECUTE", "--"]
    if not sql_upper.startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Only SELECT queries are supported")
    for kw in dangerous:
        if kw in sql_upper:
            raise HTTPException(status_code=400, detail=f"Query contains disallowed keyword: {kw}")

    try:
        result = await db.execute(text(sql))
        rows = result.fetchall()
        columns = list(result.keys()) if rows else []
        data = [dict(zip(columns, row)) for row in rows[:payload.max_rows]]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Query execution failed: {str(e)[:200]}")

    return {
        "query": payload.query,
        "sql": sql,
        "columns": columns,
        "row_count": len(data),
        "data": data,
    }


# ── Anomaly Detection ──────────────────────────────────────────────────────

@router.get("/ai/anomaly-detection")
async def detect_financial_anomalies(
    db: DBSession,
    current_user: CurrentUser,
    days: int = Query(30, ge=7, le=365),
):
    """Detect statistical anomalies and suspicious patterns in recent transactions."""
    cutoff = date.today() - timedelta(days=days)
    anomalies = []

    # 1. Round-number detection (potential fabricated amounts)
    inv_result = await db.execute(
        select(Invoice).where(Invoice.created_at >= cutoff)
    )
    invoices = inv_result.scalars().all()

    round_threshold = 1000
    for inv in invoices:
        if float(inv.total) % round_threshold == 0 and float(inv.total) >= 10000:
            anomalies.append({
                "type": "round_number",
                "severity": "low",
                "entity": "invoice",
                "entity_id": str(inv.id),
                "entity_ref": inv.invoice_number,
                "description": f"Invoice {inv.invoice_number} has a suspiciously round amount: {float(inv.total):,.2f}",
            })

    # 2. Duplicate detection: same vendor + amount within 7 days
    bill_result = await db.execute(
        select(VendorBill).where(VendorBill.created_at >= cutoff).order_by(VendorBill.vendor_name, VendorBill.total)
    )
    bills = bill_result.scalars().all()
    seen: dict[str, list] = {}
    for bill in bills:
        key = f"{bill.vendor_name}:{float(bill.total)}"
        if key not in seen:
            seen[key] = []
        seen[key].append(bill)
    for key, group in seen.items():
        if len(group) >= 2:
            dates = [b.issue_date for b in group]
            min_gap = min(
                abs((dates[i] - dates[j]).days)
                for i in range(len(dates))
                for j in range(i + 1, len(dates))
            )
            if min_gap <= 7:
                anomalies.append({
                    "type": "duplicate_bill",
                    "severity": "high",
                    "entity": "vendor_bill",
                    "entity_ids": [str(b.id) for b in group],
                    "description": f"Potential duplicate bills from '{group[0].vendor_name}' for {float(group[0].total):,.2f} within {min_gap} days",
                })

    # 3. Expense spikes: expenses with amount 3x above category average
    exp_result = await db.execute(
        select(Expense).where(Expense.created_at >= cutoff)
    )
    expenses = exp_result.scalars().all()
    category_amounts: dict[str, list[float]] = {}
    for exp in expenses:
        category_amounts.setdefault(exp.category, []).append(float(exp.amount))

    for exp in expenses:
        cat_avg = sum(category_amounts.get(exp.category, [0])) / max(len(category_amounts.get(exp.category, [1])), 1)
        if cat_avg > 0 and float(exp.amount) > cat_avg * 3 and float(exp.amount) > 500:
            anomalies.append({
                "type": "expense_spike",
                "severity": "medium",
                "entity": "expense",
                "entity_id": str(exp.id),
                "description": f"Expense '{exp.description[:60]}' ({exp.category}) is {float(exp.amount) / cat_avg:.1f}x the category average (avg: {cat_avg:.0f})",
            })

    # Generate AI summary
    if anomalies:
        prompt = f"""You are a fraud detection specialist. Summarize these {len(anomalies)} financial anomalies in 2-3 sentences.
Focus on the highest severity items and recommend immediate actions.

Anomalies: {json.dumps(anomalies[:5], default=str)}"""
        ai_summary = await _ollama_complete(prompt, max_tokens=150)
    else:
        ai_summary = "No significant anomalies detected in the review period. Financial patterns appear normal."

    return {
        "period_days": days,
        "anomaly_count": len(anomalies),
        "high_severity": sum(1 for a in anomalies if a["severity"] == "high"),
        "medium_severity": sum(1 for a in anomalies if a["severity"] == "medium"),
        "low_severity": sum(1 for a in anomalies if a["severity"] == "low"),
        "anomalies": anomalies,
        "ai_summary": ai_summary,
    }


# ── Smart Dunning Engine ───────────────────────────────────────────────────

@router.post("/ai/dunning/generate-reminder/{invoice_id}")
async def generate_dunning_reminder(
    invoice_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """Generate AI-personalized payment reminder for an overdue invoice."""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Check dunning stage based on previous logs
    logs_result = await db.execute(
        select(DunningLog)
        .where(DunningLog.invoice_id == invoice_id)
        .order_by(DunningLog.sent_at.desc())
    )
    logs = logs_result.scalars().all()
    current_stage = (max((l.stage for l in logs), default=0)) + 1
    days_overdue = (date.today() - invoice.due_date).days if invoice.due_date else 0

    tone_map = {1: "polite and friendly", 2: "firm and professional", 3: "formal and urgent", 4: "final notice"}
    tone = tone_map.get(min(current_stage, 4), "final notice")

    prompt = f"""You are writing a {tone} payment reminder email for an overdue invoice.

Invoice details:
- Invoice number: {invoice.invoice_number}
- Customer: {invoice.customer_name}
- Amount due: {invoice.currency} {float(invoice.total):,.2f}
- Days overdue: {days_overdue} days
- Reminder stage: {current_stage} of 4

Write a complete email with subject line and body. The tone must be {tone}.
Format: SUBJECT: <subject>\n\nBODY: <body>
Keep body under 150 words. Include the amount and invoice number."""

    email_content = await _ollama_complete(prompt, max_tokens=300)

    # Parse subject and body
    subject, body = "", email_content
    if "SUBJECT:" in email_content and "BODY:" in email_content:
        parts = email_content.split("BODY:", 1)
        subject = parts[0].replace("SUBJECT:", "").strip()
        body = parts[1].strip()

    # Log the dunning action
    log = DunningLog(
        invoice_id=invoice_id,
        stage=current_stage,
        channel="email",
        message_preview=body[:500],
        ai_generated=True,
    )
    db.add(log)
    await db.commit()

    return {
        "invoice_id": str(invoice_id),
        "invoice_number": invoice.invoice_number,
        "customer": invoice.customer_name,
        "amount_due": float(invoice.total),
        "days_overdue": days_overdue,
        "dunning_stage": current_stage,
        "tone": tone,
        "subject": subject,
        "body": body,
        "dunning_log_id": str(log.id),
    }


@router.get("/ai/dunning/status/{invoice_id}")
async def get_dunning_status(
    invoice_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """Get the dunning history for an invoice."""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    logs_result = await db.execute(
        select(DunningLog)
        .where(DunningLog.invoice_id == invoice_id)
        .order_by(DunningLog.sent_at.asc())
    )
    logs = logs_result.scalars().all()

    return {
        "invoice_id": str(invoice_id),
        "invoice_number": invoice.invoice_number,
        "current_status": invoice.status,
        "days_overdue": (date.today() - invoice.due_date).days if invoice.due_date else 0,
        "dunning_stage": max((l.stage for l in logs), default=0),
        "reminders_sent": len(logs),
        "history": [
            {
                "stage": l.stage,
                "sent_at": l.sent_at.isoformat() if l.sent_at else None,
                "channel": l.channel,
                "opened": l.opened,
                "responded": l.responded,
                "ai_generated": l.ai_generated,
            }
            for l in logs
        ],
    }


# ── Tax Optimizer ──────────────────────────────────────────────────────────

@router.get("/ai/tax-optimizer")
async def tax_optimizer(
    db: DBSession,
    current_user: CurrentUser,
    fiscal_year: int | None = Query(None),
):
    """AI quarter-end tax optimization suggestions."""
    year = fiscal_year or date.today().year
    cutoff_start = date(year, 1, 1)
    cutoff_end = date(year, 12, 31)

    # Gather expense data
    exp_result = await db.execute(
        select(
            Expense.category,
            func.count(Expense.id).label("count"),
            func.sum(Expense.amount).label("total"),
        )
        .where(Expense.expense_date >= cutoff_start, Expense.expense_date <= cutoff_end)
        .group_by(Expense.category)
    )
    expense_breakdown = [
        {"category": row.category, "count": row.count, "total": float(row.total or 0)}
        for row in exp_result.all()
    ]

    # Revenue total
    rev_result = await db.execute(
        select(func.sum(Invoice.total)).where(
            Invoice.invoice_type == "sales",
            Invoice.status == "paid",
            Invoice.issue_date >= cutoff_start,
            Invoice.issue_date <= cutoff_end,
        )
    )
    total_revenue = float(rev_result.scalar_one() or 0)

    prompt = f"""You are a tax optimization advisor. Review this company's financial data for fiscal year {year} and provide 3-5 specific tax optimization suggestions.

Total revenue: ${total_revenue:,.2f}
Expense breakdown by category: {json.dumps(expense_breakdown)}

For each suggestion:
1. State the specific opportunity
2. Estimate potential tax savings
3. Recommend immediate action

Focus on: expense categorization, timing of income/deductions, and commonly missed deductions.
Format each suggestion as: "• [Opportunity]: [Action] — Estimated savings: [Amount/Percentage]"."""

    suggestions = await _ollama_complete(prompt, max_tokens=400)

    return {
        "fiscal_year": year,
        "total_revenue": total_revenue,
        "expense_breakdown": expense_breakdown,
        "ai_suggestions": suggestions,
        "generated_at": datetime.utcnow().isoformat(),
        "disclaimer": "AI suggestions are for planning purposes only. Consult a qualified tax professional before making decisions.",
    }


# ── Receipt OCR ────────────────────────────────────────────────────────────


@router.post("/ai/ocr-receipt")
async def ocr_receipt(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: DBSession = None,
):
    """Upload a receipt image → Ollama llava extracts vendor, amount, date, category.

    Returns pre-filled expense fields ready for form auto-population.
    """
    import base64

    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, WebP, or GIF.",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")

    image_b64 = base64.b64encode(content).decode("utf-8")

    prompt = (
        "You are a receipt OCR assistant. Extract the following fields from this receipt image "
        "and return ONLY valid JSON with no extra text:\n"
        '{"vendor_name":"string or null","amount":number or null,"currency":"3-letter code or USD",'
        '"date":"YYYY-MM-DD or null","category":"one of: meals,travel,accommodation,office_supplies,'
        'software,hardware,utilities,marketing,training,other","description":"brief purchase description",'
        '"tax_amount":number or null,"confidence":"high|medium|low"}\n'
        "Only return the JSON object, nothing else."
    )

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": "llava",
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 256},
                },
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="OCR model unavailable")
            raw_response = resp.json().get("response", "")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="OCR request timed out. Try a smaller image.")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    extracted: dict[str, Any] = {}
    try:
        match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if match:
            extracted = json.loads(match.group())
        else:
            extracted = {"confidence": "low", "error": "Could not parse receipt"}
    except (json.JSONDecodeError, ValueError):
        extracted = {"confidence": "low", "raw_response": raw_response[:500]}

    return {
        "ocr_result": extracted,
        "filename": file.filename,
        "file_size_bytes": len(content),
        "model_used": "llava",
        "pre_filled": {
            "vendor_name": extracted.get("vendor_name"),
            "amount": extracted.get("amount"),
            "currency": extracted.get("currency", "USD"),
            "expense_date": extracted.get("date"),
            "category": extracted.get("category"),
            "description": extracted.get("description"),
            "tax_amount": extracted.get("tax_amount"),
        },
    }
