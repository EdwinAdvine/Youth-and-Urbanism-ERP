"""AI-powered feature endpoints — lead scoring, ticket classification, demand forecasting, etc."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, DBSession
from app.services.ai_tools import ToolExecutor

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class AIScoreResponse(BaseModel):
    lead_id: str
    title: str | None = None
    score: int
    category: str
    factors: list[str]
    result: str | None = None


class AIClassifyResponse(BaseModel):
    ticket_id: str
    ticket_number: str | None = None
    suggested_category: dict | None = None
    suggested_priority: str
    current_priority: str | None = None
    suggested_assignee: dict | None = None
    result: str | None = None


class AISuggestReplyResponse(BaseModel):
    ticket_id: str
    ticket_number: str | None = None
    suggested_reply: str
    kb_articles_used: list[dict] | None = None
    result: str | None = None


class AIKBGenerateResponse(BaseModel):
    status: str
    article_id: str | None = None
    title: str | None = None
    slug: str | None = None
    result: str | None = None
    error: str | None = None


class AIDemandForecastResponse(BaseModel):
    item: str | None = None
    sku: str | None = None
    historical: list[dict] | None = None
    forecast: list[dict] | None = None
    trend: str | None = None
    moving_average: float | None = None
    monthly_trend_slope: float | None = None
    result: str | None = None
    error: str | None = None


class AIReorderOptimizeResponse(BaseModel):
    item_id: str | None = None
    item_name: str | None = None
    sku: str | None = None
    current_stock: int | None = None
    avg_daily_usage: float | None = None
    lead_time_days: int | None = None
    safety_stock: int | None = None
    reorder_point: int | None = None
    reorder_quantity: int | None = None
    reasoning: list[str] | None = None
    result: str | None = None
    error: str | None = None


class AINextBestActionResponse(BaseModel):
    entity: str | None = None
    context: str | None = None
    suggested_actions: list[str] | None = None
    result: str | None = None
    error: str | None = None


class AIMeetingSummaryRequest(BaseModel):
    meeting_notes: str
    event_id: str | None = None


class AIMeetingSummaryResponse(BaseModel):
    status: str | None = None
    summary: str | None = None
    event_updated: bool | None = None
    result: str | None = None


class AIComposeEmailRequest(BaseModel):
    instructions: str
    to: str | None = None
    tone: str = "formal"


class AIComposeEmailResponse(BaseModel):
    status: str | None = None
    to: str | None = None
    subject: str | None = None
    body: str | None = None
    result: str | None = None


class AIAvailabilityRequest(BaseModel):
    user_emails: list[str]
    date: str


class AIScheduleMeetingRequest(BaseModel):
    title: str
    attendee_emails: list[str]
    duration_minutes: int = 60
    preferred_date: str | None = None
    description: str | None = None


class AIEstimateTaskRequest(BaseModel):
    task_description: str
    project_name: str | None = None


class AIReportRequest(BaseModel):
    query: str
    format: str = "summary"


class AIQueryRequest(BaseModel):
    question: str


class AIAttritionRiskResponse(BaseModel):
    employee_id: str
    employee_name: str | None = None
    risk_score: int
    risk_level: str
    risk_factors: list[str] | None = None
    recommendations: list[str] | None = None
    details: dict | None = None
    result: str | None = None
    error: str | None = None


class AIPayrollAnomalyResponse(BaseModel):
    period_months: int | None = None
    employees_analyzed: int | None = None
    payslips_analyzed: int | None = None
    anomalies_found: int | None = None
    anomalies: list[dict] | None = None
    result: str | None = None
    error: str | None = None


class AISupplierRecommendationRequest(BaseModel):
    item_category: str | None = None
    budget_limit: float | None = None


class AISupplierRecommendationResponse(BaseModel):
    item_category: str | None = None
    suppliers_analyzed: int | None = None
    recommendations: list[dict] | None = None
    result: str | None = None
    error: str | None = None


class AIProductionOptimizationResponse(BaseModel):
    pending_work_orders: int | None = None
    available_workstations: int | None = None
    suggestions: list[dict] | None = None
    result: str | None = None
    error: str | None = None


class AIPredictiveMaintenanceResponse(BaseModel):
    workstation_id: str | None = None
    workstation_name: str | None = None
    risk_score: int | None = None
    risk_level: str | None = None
    risk_factors: list[str] | None = None
    recommendations: list[str] | None = None
    details: dict | None = None
    result: str | None = None
    error: str | None = None


class AIProductRecommendationRequest(BaseModel):
    product_id: str | None = None
    customer_id: str | None = None
    limit: int = 5


class AIProductRecommendationResponse(BaseModel):
    product_id: str | None = None
    customer_id: str | None = None
    recommendations: list[dict] | None = None
    result: str | None = None
    error: str | None = None


class AIPricingOptimizationResponse(BaseModel):
    product_id: str | None = None
    product_name: str | None = None
    current_price: float | None = None
    compare_at_price: float | None = None
    total_units_sold: int | None = None
    total_revenue: float | None = None
    suggestions: list[dict] | None = None
    result: str | None = None
    error: str | None = None


class AIProjectRiskResponse(BaseModel):
    project_id: str | None = None
    project_name: str | None = None
    risk_score: int | None = None
    risk_level: str | None = None
    risk_factors: list[str] | None = None
    recommendations: list[str] | None = None
    details: dict | None = None
    result: str | None = None
    error: str | None = None


class AIThreadSummaryResponse(BaseModel):
    thread_id: str | None = None
    subject: str | None = None
    message_count: int | None = None
    summary: str | None = None
    result: str | None = None
    error: str | None = None


class AIEmailCategoryResponse(BaseModel):
    message_id: str | None = None
    subject: str | None = None
    categories: list[dict] | None = None
    primary_category: str | None = None
    is_urgent: bool | None = None
    is_negative_sentiment: bool | None = None
    suggested_labels: list[str] | None = None
    result: str | None = None
    error: str | None = None


class AIAutoTagResponse(BaseModel):
    note_id: str | None = None
    note_title: str | None = None
    existing_tags: list[str] | None = None
    suggested_tags: list[str] | None = None
    tag_details: list[dict] | None = None
    result: str | None = None
    error: str | None = None


class AIFormGenerateRequest(BaseModel):
    description: str
    max_fields: int = 10


class AIFormGenerateResponse(BaseModel):
    status: str | None = None
    form_schema: dict | None = None
    field_count: int | None = None
    result: str | None = None
    error: str | None = None


class AITranslateRequest(BaseModel):
    target_language: str


class AITranslateResponse(BaseModel):
    doc_id: str | None = None
    doc_name: str | None = None
    target_language: str | None = None
    translated_content: str | None = None
    result: str | None = None
    error: str | None = None


class AIFileOrganizeResponse(BaseModel):
    total_files: int | None = None
    files_by_type: dict | None = None
    suggestions: list[dict] | None = None
    proposed_structure: dict | None = None
    result: str | None = None
    error: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_executor(db: AsyncSession, user_id: uuid.UUID) -> ToolExecutor:
    return ToolExecutor(db, user_id)


# ── CRM: Lead Scoring ───────────────────────────────────────────────────────

@router.post(
    "/crm/leads/{lead_id}/ai-score",
    response_model=AIScoreResponse,
    summary="AI-score a CRM lead",
    tags=["CRM", "AI"],
)
async def ai_score_lead(
    lead_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("score_lead", {"lead_id": str(lead_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── CRM: Next Best Action ───────────────────────────────────────────────────

@router.post(
    "/crm/deals/{deal_id}/ai-next-action",
    response_model=AINextBestActionResponse,
    summary="AI next-best-action for a deal",
    tags=["CRM", "AI"],
)
async def ai_next_action_deal(
    deal_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("next_best_action", {"deal_id": str(deal_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


@router.post(
    "/crm/contacts/{contact_id}/ai-next-action",
    response_model=AINextBestActionResponse,
    summary="AI next-best-action for a contact",
    tags=["CRM", "AI"],
)
async def ai_next_action_contact(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("next_best_action", {"contact_id": str(contact_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


@router.post(
    "/crm/opportunities/{opp_id}/ai-next-action",
    response_model=AINextBestActionResponse,
    summary="AI next-best-action for an opportunity",
    tags=["CRM", "AI"],
)
async def ai_next_action_opportunity(
    opp_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("next_best_action", {"opportunity_id": str(opp_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Support: Ticket Classification ───────────────────────────────────────────

@router.post(
    "/support/tickets/{ticket_id}/ai-classify",
    response_model=AIClassifyResponse,
    summary="AI-classify a support ticket (category, priority, assignee)",
    tags=["Support", "AI"],
)
async def ai_classify_ticket(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("classify_ticket", {"ticket_id": str(ticket_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Support: Suggested Reply ─────────────────────────────────────────────────

@router.post(
    "/support/tickets/{ticket_id}/ai-suggest-reply",
    response_model=AISuggestReplyResponse,
    summary="AI-generated suggested reply for a support ticket",
    tags=["Support", "AI"],
)
async def ai_suggest_reply(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("suggest_response", {"ticket_id": str(ticket_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Support: KB Article Generation ───────────────────────────────────────────

@router.post(
    "/support/tickets/{ticket_id}/ai-generate-kb",
    response_model=AIKBGenerateResponse,
    summary="Generate a KB article from a resolved ticket",
    tags=["Support", "AI"],
)
async def ai_generate_kb(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("generate_kb_article", {"ticket_id": str(ticket_id)})
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST if "must be resolved" in result.get("error", "") else status.HTTP_404_NOT_FOUND,
            detail=result["error"],
        )
    return result


# ── Inventory: Demand Forecasting ────────────────────────────────────────────

@router.post(
    "/inventory/items/{item_id}/ai-demand-forecast",
    response_model=AIDemandForecastResponse,
    summary="AI demand forecast for an inventory item",
    tags=["Inventory", "AI"],
)
async def ai_demand_forecast(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    periods_ahead: int = 3,
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("demand_forecast", {"item_id": str(item_id), "periods_ahead": periods_ahead})
    if "error" in result and "not found" in result.get("error", "").lower():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Inventory: Reorder Point Optimization ────────────────────────────────

@router.post(
    "/inventory/items/{item_id}/ai-reorder-optimize",
    response_model=AIReorderOptimizeResponse,
    summary="AI reorder point optimization for an inventory item",
    tags=["Inventory", "AI"],
)
async def ai_reorder_optimize(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("optimize_reorder_point", {"item_id": str(item_id)})
    if "error" in result and "not found" in result.get("error", "").lower():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── AI: Meeting Summarization ────────────────────────────────────────────────

@router.post(
    "/ai/summarize-meeting",
    response_model=AIMeetingSummaryResponse,
    summary="Summarize meeting notes with structured action items",
    tags=["AI", "Meetings"],
)
async def ai_summarize_meeting(
    payload: AIMeetingSummaryRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    args: dict[str, Any] = {"meeting_notes": payload.meeting_notes}
    if payload.event_id:
        args["event_id"] = payload.event_id
    result = await executor.execute("summarize_meeting_notes", args)
    return result


# ── AI: Check Availability ──────────────────────────────────────────────────

@router.post(
    "/ai/check-availability",
    summary="Check free/busy status for users on a date",
    tags=["AI", "Calendar"],
)
async def ai_check_availability(
    payload: AIAvailabilityRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("check_availability", {
        "user_emails": payload.user_emails,
        "date": payload.date,
    })
    return result


# ── AI: Schedule Meeting ────────────────────────────────────────────────────

@router.post(
    "/ai/schedule-meeting",
    summary="AI-powered meeting scheduling with free slot detection",
    tags=["AI", "Calendar"],
)
async def ai_schedule_meeting(
    payload: AIScheduleMeetingRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    args: dict[str, Any] = {
        "title": payload.title,
        "attendee_emails": payload.attendee_emails,
        "duration_minutes": payload.duration_minutes,
    }
    if payload.preferred_date:
        args["preferred_date"] = payload.preferred_date
    if payload.description:
        args["description"] = payload.description
    result = await executor.execute("schedule_meeting", args)
    return result


# ── AI: Compose Email ───────────────────────────────────────────────────────

@router.post(
    "/ai/compose-email",
    response_model=AIComposeEmailResponse,
    summary="AI-draft an email from instructions",
    tags=["AI", "Mail"],
)
async def ai_compose_email(
    payload: AIComposeEmailRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("compose_email", {
        "instructions": payload.instructions,
        "to": payload.to,
        "tone": payload.tone,
    })
    return result


# ── AI: Estimate Task ───────────────────────────────────────────────────────

@router.post(
    "/ai/estimate-task",
    summary="AI estimation for task effort",
    tags=["AI", "Projects"],
)
async def ai_estimate_task(
    payload: AIEstimateTaskRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    args: dict[str, Any] = {"task_description": payload.task_description}
    if payload.project_name:
        args["project_name"] = payload.project_name
    result = await executor.execute("estimate_task", args)
    return result


# ── AI: Generate Report ─────────────────────────────────────────────────────

@router.post(
    "/ai/generate-report",
    summary="Generate analytics report from natural language query",
    tags=["AI", "Analytics"],
)
async def ai_generate_report(
    payload: AIReportRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("generate_report", {
        "query": payload.query,
        "format": payload.format,
    })
    return result


# ── AI: Query Data ──────────────────────────────────────────────────────────

@router.post(
    "/ai/query-data",
    summary="Natural language to SQL query (read-only)",
    tags=["AI", "Analytics"],
)
async def ai_query_data(
    payload: AIQueryRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("query_data", {"question": payload.question})
    if "error" in result and "Could not map" in result.get("error", ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


# ── HR: AI Attrition Prediction ────────────────────────────────────────────

@router.post(
    "/hr/employees/{employee_id}/ai-attrition-risk",
    response_model=AIAttritionRiskResponse,
    summary="Predict employee attrition risk based on tenure, leave, and performance",
    tags=["HR", "AI"],
)
async def ai_attrition_risk(
    employee_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("predict_attrition", {"employee_id": str(employee_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── HR: AI Payroll Anomaly Detection ───────────────────────────────────────

@router.post(
    "/hr/payroll/ai-anomaly-check",
    response_model=AIPayrollAnomalyResponse,
    summary="Detect anomalies in payroll data across all employees",
    tags=["HR", "AI"],
)
async def ai_payroll_anomaly_check(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    months_back: int = 6,
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("detect_payroll_anomalies", {"months_back": months_back})
    return result


# ── Supply Chain: AI Supplier Recommendation ───────────────────────────────

@router.post(
    "/supply-chain/ai-recommend-supplier",
    response_model=AISupplierRecommendationResponse,
    summary="AI-powered supplier scoring and recommendation",
    tags=["Supply Chain", "AI"],
)
async def ai_recommend_supplier(
    payload: AISupplierRecommendationRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    args: dict[str, Any] = {}
    if payload.item_category:
        args["item_category"] = payload.item_category
    if payload.budget_limit:
        args["budget_limit"] = payload.budget_limit
    result = await executor.execute("recommend_supplier", args)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Manufacturing: AI Production Optimization ──────────────────────────────

@router.post(
    "/manufacturing/ai-optimize-production",
    response_model=AIProductionOptimizationResponse,
    summary="AI-optimized production scheduling based on capacity and materials",
    tags=["Manufacturing", "AI"],
)
async def ai_optimize_production(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("optimize_production", {})
    return result


# ── Manufacturing: AI Predictive Maintenance ───────────────────────────────

@router.post(
    "/manufacturing/workstations/{workstation_id}/ai-predict-maintenance",
    response_model=AIPredictiveMaintenanceResponse,
    summary="Predict maintenance needs for a workstation based on history and workload",
    tags=["Manufacturing", "AI"],
)
async def ai_predict_maintenance(
    workstation_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("predict_maintenance", {"workstation_id": str(workstation_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── E-Commerce: AI Product Recommendations ─────────────────────────────────

@router.post(
    "/ecommerce/ai-recommend-products",
    response_model=AIProductRecommendationResponse,
    summary="AI-powered cross-sell/upsell product recommendations",
    tags=["E-Commerce", "AI"],
)
async def ai_recommend_products(
    payload: AIProductRecommendationRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    args: dict[str, Any] = {"limit": payload.limit}
    if payload.product_id:
        args["product_id"] = payload.product_id
    if payload.customer_id:
        args["customer_id"] = payload.customer_id
    result = await executor.execute("recommend_products", args)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── E-Commerce: AI Pricing Optimization ────────────────────────────────────

@router.post(
    "/ecommerce/products/{product_id}/ai-optimize-price",
    response_model=AIPricingOptimizationResponse,
    summary="AI-powered pricing optimization for an e-commerce product",
    tags=["E-Commerce", "AI"],
)
async def ai_optimize_pricing(
    product_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("optimize_pricing", {"product_id": str(product_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Projects: AI Risk Analysis ─────────────────────────────────────────────

@router.post(
    "/projects/{project_id}/ai-risk-analysis",
    response_model=AIProjectRiskResponse,
    summary="AI risk analysis for a project based on tasks, deadlines, and progress",
    tags=["Projects", "AI"],
)
async def ai_project_risk_analysis(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("analyze_project_risk", {"project_id": str(project_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Mail: AI Thread Summarization ──────────────────────────────────────────

@router.post(
    "/mail/threads/{thread_id}/ai-summarize",
    response_model=AIThreadSummaryResponse,
    summary="AI-summarize an email thread",
    tags=["Mail", "AI"],
)
async def ai_summarize_email_thread(
    thread_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("summarize_email_thread", {"thread_id": thread_id})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


# ── Mail: AI Smart Categorization ──────────────────────────────────────────

@router.post(
    "/mail/messages/{message_id}/ai-categorize",
    response_model=AIEmailCategoryResponse,
    summary="AI-categorize and label an email message",
    tags=["Mail", "AI"],
)
async def ai_categorize_email(
    message_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("categorize_email", {"message_id": message_id})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


# ── Notes: AI Auto-Tagging ─────────────────────────────────────────────────

@router.post(
    "/notes/{note_id}/ai-auto-tag",
    response_model=AIAutoTagResponse,
    summary="AI-suggest tags for a note based on content analysis",
    tags=["Notes", "AI"],
)
async def ai_auto_tag_note(
    note_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("auto_tag_note", {"note_id": str(note_id)})
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Forms: AI Form Generation ──────────────────────────────────────────────

@router.post(
    "/forms/ai-generate",
    response_model=AIFormGenerateResponse,
    summary="Generate a form schema from a natural language description",
    tags=["Forms", "AI"],
)
async def ai_generate_form(
    payload: AIFormGenerateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("generate_form", {
        "description": payload.description,
        "max_fields": payload.max_fields,
    })
    return result


# ── Docs: AI Translation ──────────────────────────────────────────────────

@router.post(
    "/docs/{doc_id}/ai-translate",
    response_model=AITranslateResponse,
    summary="Translate a document to a target language using AI",
    tags=["Docs", "AI"],
)
async def ai_translate_document(
    doc_id: uuid.UUID,
    payload: AITranslateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("translate_document", {
        "doc_id": str(doc_id),
        "target_language": payload.target_language,
    })
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
    return result


# ── Drive: AI File Organization Suggestions ────────────────────────────────

@router.post(
    "/drive/ai-organize-suggestions",
    response_model=AIFileOrganizeResponse,
    summary="AI-powered file organization suggestions for Drive",
    tags=["Drive", "AI"],
)
async def ai_organize_suggestions(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    include_shared: bool = False,
) -> dict[str, Any]:
    executor = _make_executor(db, current_user.id)
    result = await executor.execute("suggest_file_organization", {
        "include_shared": include_shared,
    })
    return result
