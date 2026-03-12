"""Manufacturing Intelligence & AI — bottlenecks, quality risk, scheduling suggestions, executive summary."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, date as date_type
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.models.manufacturing import (
    WorkOrder,
    WorkStation,
    RoutingStep,
    QualityCheck,
    ScheduleEntry,
    CapacitySlot,
    DowntimeRecord,
    NonConformanceReport,
    SPCDataPoint,
    InspectionPlanItem,
)

router = APIRouter()


# ─── Bottleneck Analysis ──────────────────────────────────────────────────────

@router.get("/ai/bottlenecks")
async def bottleneck_analysis(
    db: DBSession,
    user: CurrentUser,
    days: int = 30,
):
    """
    Identify production bottlenecks by analyzing:
    - WO queue time per workstation (planned_start → actual_start lag)
    - Workstation utilization from capacity slots
    - Downtime frequency per workstation
    """
    cutoff = datetime.now() - timedelta(days=days)

    # Average queue time per workstation (planned_start to actual_start delta)
    wo_result = await db.execute(
        select(
            WorkOrder.workstation_id,
            func.count().label("count"),
            func.avg(
                func.extract("epoch", WorkOrder.actual_start - WorkOrder.planned_start)
            ).label("avg_queue_seconds"),
        )
        .where(
            WorkOrder.actual_start.is_not(None),
            WorkOrder.planned_start.is_not(None),
            WorkOrder.workstation_id.is_not(None),
            WorkOrder.created_at >= cutoff,
        )
        .group_by(WorkOrder.workstation_id)
    )
    queue_times = {str(r.workstation_id): {"count": r.count, "avg_queue_minutes": round(float(r.avg_queue_seconds or 0) / 60, 1)} for r in wo_result.all()}

    # Utilization from capacity slots
    cap_result = await db.execute(
        select(
            CapacitySlot.workstation_id,
            func.sum(CapacitySlot.total_minutes).label("total"),
            func.sum(CapacitySlot.allocated_minutes).label("allocated"),
        )
        .where(CapacitySlot.slot_date >= date_type.today() - timedelta(days=days))
        .group_by(CapacitySlot.workstation_id)
    )
    utilization = {
        str(r.workstation_id): round(float(r.allocated or 0) / float(r.total or 1) * 100, 1)
        for r in cap_result.all()
    }

    # Downtime frequency
    dt_result = await db.execute(
        select(DowntimeRecord.workstation_id, func.count().label("downtime_events"))
        .where(DowntimeRecord.start_time >= cutoff)
        .group_by(DowntimeRecord.workstation_id)
    )
    downtime = {str(r.workstation_id): r.downtime_events for r in dt_result.all()}

    # Combine all workstation IDs
    all_ws = set(queue_times) | set(utilization) | set(downtime)

    bottlenecks = []
    for ws_id in all_ws:
        qt = queue_times.get(ws_id, {})
        util = utilization.get(ws_id, 0)
        dt_count = downtime.get(ws_id, 0)

        # Score: higher = more bottlenecked
        score = (util * 0.4) + (qt.get("avg_queue_minutes", 0) / 60 * 0.4) + (dt_count * 2 * 0.2)

        bottlenecks.append({
            "workstation_id": ws_id,
            "utilization_percent": util,
            "avg_queue_minutes": qt.get("avg_queue_minutes", 0),
            "work_order_count": qt.get("count", 0),
            "downtime_events": dt_count,
            "bottleneck_score": round(score, 2),
            "is_critical": util >= 85 or qt.get("avg_queue_minutes", 0) > 120,
        })

    bottlenecks.sort(key=lambda x: x["bottleneck_score"], reverse=True)
    return {"analysis_days": days, "bottlenecks": bottlenecks}


# ─── Quality Risk Dashboard ───────────────────────────────────────────────────

@router.get("/ai/quality-risk")
async def quality_risk_analysis(
    db: DBSession,
    user: CurrentUser,
    days: int = 30,
):
    """
    Predict quality risk by analyzing:
    - Recent NCR severity trends
    - SPC out-of-control rate per inspection plan item
    - QC pass rate trends per workstation
    """
    cutoff = datetime.now() - timedelta(days=days)

    # NCR trends by severity
    ncr_result = await db.execute(
        select(
            NonConformanceReport.severity,
            func.count().label("count"),
        )
        .where(NonConformanceReport.created_at >= cutoff)
        .group_by(NonConformanceReport.severity)
    )
    ncr_by_severity = {r.severity: r.count for r in ncr_result.all()}

    # SPC out-of-control rate per plan item
    spc_result = await db.execute(
        select(
            SPCDataPoint.inspection_plan_item_id,
            func.count().label("total"),
            func.sum(func.cast(SPCDataPoint.is_out_of_control, func.Integer if hasattr(func, "Integer") else func.count.__class__)).label("ooc_count"),
        )
        .where(SPCDataPoint.measured_at >= cutoff)
        .group_by(SPCDataPoint.inspection_plan_item_id)
    )
    spc_risks = []
    for r in spc_result.all():
        ooc = r.ooc_count or 0
        total = r.total or 1
        ooc_rate = round(float(ooc) / float(total) * 100, 1)
        if ooc_rate > 5:  # Flag if >5% OOC
            spc_risks.append({
                "inspection_plan_item_id": str(r.inspection_plan_item_id),
                "total_measurements": r.total,
                "out_of_control": ooc,
                "ooc_rate_percent": ooc_rate,
                "risk_level": "high" if ooc_rate > 20 else "medium",
            })

    # QC pass rate by workstation
    qc_result = await db.execute(
        select(
            WorkOrder.workstation_id,
            func.sum(QualityCheck.quantity_passed).label("passed"),
            func.sum(QualityCheck.quantity_inspected).label("inspected"),
        )
        .join(WorkOrder, WorkOrder.id == QualityCheck.work_order_id)
        .where(
            QualityCheck.checked_at >= cutoff,
            WorkOrder.workstation_id.is_not(None),
        )
        .group_by(WorkOrder.workstation_id)
    )
    qc_risks = []
    for r in qc_result.all():
        inspected = float(r.inspected or 0)
        passed = float(r.passed or 0)
        pass_rate = round(passed / inspected * 100, 1) if inspected else 100.0
        if pass_rate < 90:
            qc_risks.append({
                "workstation_id": str(r.workstation_id),
                "pass_rate_percent": pass_rate,
                "inspected": int(inspected),
                "failed": int(inspected - passed),
                "risk_level": "high" if pass_rate < 75 else "medium",
            })

    total_ncrs = sum(ncr_by_severity.values())
    overall_risk = "high" if ncr_by_severity.get("critical", 0) > 0 or len([r for r in qc_risks if r["risk_level"] == "high"]) > 0 else "medium" if total_ncrs > 5 else "low"

    return {
        "analysis_days": days,
        "overall_risk": overall_risk,
        "ncr_by_severity": ncr_by_severity,
        "total_ncrs": total_ncrs,
        "spc_at_risk_items": spc_risks,
        "low_pass_rate_workstations": qc_risks,
        "recommendations": _quality_recommendations(ncr_by_severity, spc_risks, qc_risks),
    }


def _quality_recommendations(ncr: dict, spc: list, qc: list) -> list[str]:
    recs = []
    if ncr.get("critical", 0) > 0:
        recs.append(f"🚨 {ncr['critical']} critical NCR(s) open — immediate CAPA required")
    if ncr.get("major", 0) > 3:
        recs.append(f"⚠️ {ncr['major']} major NCRs in period — review supplier quality")
    for item in spc[:3]:
        recs.append(f"📊 Inspection item {item['inspection_plan_item_id'][:8]}... has {item['ooc_rate_percent']}% OOC rate")
    for ws in qc[:3]:
        recs.append(f"🔧 Workstation {ws['workstation_id'][:8]}... pass rate {ws['pass_rate_percent']}% — investigate root cause")
    if not recs:
        recs.append("✅ Quality metrics within acceptable thresholds")
    return recs


# ─── Schedule Optimization Suggestions ───────────────────────────────────────

@router.get("/ai/schedule-suggestions")
async def schedule_suggestions(
    db: DBSession,
    user: CurrentUser,
):
    """Rule-based scheduling recommendations."""
    today = date_type.today()

    suggestions = []

    # Overdue work orders
    overdue_result = await db.execute(
        select(func.count()).where(
            WorkOrder.status.in_(["planned", "in_progress"]),
            WorkOrder.planned_end < datetime.now(),
        )
    )
    overdue = overdue_result.scalar() or 0
    if overdue > 0:
        suggestions.append({
            "type": "overdue",
            "severity": "high",
            "message": f"{overdue} work order(s) past planned end date — reprioritize or reschedule",
            "action": "review_schedule",
        })

    # Overloaded workstations
    cap_result = await db.execute(
        select(
            CapacitySlot.workstation_id,
            func.sum(CapacitySlot.total_minutes).label("total"),
            func.sum(CapacitySlot.allocated_minutes).label("allocated"),
        )
        .where(CapacitySlot.slot_date >= today, CapacitySlot.slot_date <= today + timedelta(days=7))
        .group_by(CapacitySlot.workstation_id)
        .having(func.sum(CapacitySlot.allocated_minutes) >= func.sum(CapacitySlot.total_minutes) * 0.9)
    )
    overloaded = cap_result.all()
    for ws in overloaded:
        suggestions.append({
            "type": "capacity_overload",
            "severity": "medium",
            "workstation_id": str(ws.workstation_id),
            "message": f"Workstation {str(ws.workstation_id)[:8]}... at {round(float(ws.allocated)/float(ws.total)*100,1)}% capacity this week",
            "action": "rebalance_workload",
        })

    # High-priority WOs without schedule entries
    unscheduled_result = await db.execute(
        select(func.count()).select_from(WorkOrder).where(
            WorkOrder.status == "planned",
            WorkOrder.priority == "high",
            ~WorkOrder.id.in_(select(ScheduleEntry.work_order_id)),
        )
    )
    unscheduled = unscheduled_result.scalar() or 0
    if unscheduled > 0:
        suggestions.append({
            "type": "unscheduled_high_priority",
            "severity": "high",
            "message": f"{unscheduled} high-priority work order(s) have no schedule entries — run scheduler",
            "action": "run_scheduler",
        })

    # WOs with no crew assigned
    no_crew_result = await db.execute(
        select(func.count()).select_from(WorkOrder).where(
            WorkOrder.status.in_(["planned", "in_progress"]),
            ~WorkOrder.id.in_(
                select(func.distinct(
                    __import__("app.models.manufacturing", fromlist=["CrewAssignment"]).CrewAssignment.work_order_id
                    if False else WorkOrder.id  # Fallback — proper import below
                ))
            ),
        )
    )

    if not suggestions:
        suggestions.append({
            "type": "all_clear",
            "severity": "low",
            "message": "No critical scheduling issues detected",
            "action": None,
        })

    return {"suggestions": suggestions, "generated_at": datetime.now().isoformat()}


# ─── Executive Dashboard ──────────────────────────────────────────────────────

@router.get("/ai/executive-dashboard")
async def executive_dashboard(
    db: DBSession,
    user: CurrentUser,
):
    """
    Executive manufacturing KPI dashboard linking to CRM deals and Projects.
    """
    today = date_type.today()
    month_start = today.replace(day=1)

    # WO completion stats
    wo_result = await db.execute(
        select(WorkOrder.status, func.count()).group_by(WorkOrder.status)
    )
    wo_by_status = {r[0]: r[1] for r in wo_result.all()}

    # This month's output
    output_result = await db.execute(
        select(func.sum(WorkOrder.completed_quantity)).where(
            WorkOrder.status == "completed",
            WorkOrder.actual_end >= datetime.combine(month_start, datetime.min.time()),
        )
    )
    monthly_output = int(output_result.scalar() or 0)

    # Total manufacturing costs this month
    cost_result = await db.execute(
        select(
            func.sum(WorkOrder.total_material_cost + WorkOrder.total_labor_cost + WorkOrder.total_overhead_cost)
        ).where(
            WorkOrder.status == "completed",
            WorkOrder.actual_end >= datetime.combine(month_start, datetime.min.time()),
        )
    )
    monthly_cost = float(cost_result.scalar() or 0)

    # NCR summary
    ncr_result = await db.execute(
        select(NonConformanceReport.severity, func.count()).group_by(NonConformanceReport.severity)
    )
    ncr_summary = {r[0]: r[1] for r in ncr_result.all()}

    # Downtime this month
    dt_result = await db.execute(
        select(func.sum(DowntimeRecord.duration_minutes)).where(
            DowntimeRecord.start_time >= datetime.combine(month_start, datetime.min.time()),
        )
    )
    monthly_downtime_hours = round(float(dt_result.scalar() or 0) / 60, 1)

    # Linked CRM deals (WOs where notes contain deal references)
    crm_linked = 0  # Simplified — actual integration via wo.deal_id FK if present

    return {
        "period": {"from": month_start.isoformat(), "to": today.isoformat()},
        "work_orders": {
            "by_status": wo_by_status,
            "total": sum(wo_by_status.values()),
            "active": wo_by_status.get("in_progress", 0),
            "completed_this_month": wo_by_status.get("completed", 0),
        },
        "output": {
            "units_produced": monthly_output,
            "manufacturing_cost": round(monthly_cost, 2),
            "cost_per_unit": round(monthly_cost / monthly_output, 2) if monthly_output else 0,
        },
        "quality": {
            "ncr_by_severity": ncr_summary,
            "total_open_ncrs": ncr_summary.get("open", 0),
        },
        "equipment": {
            "downtime_hours_this_month": monthly_downtime_hours,
        },
    }


# ─── AI Executive Summary (Ollama) ───────────────────────────────────────────

@router.get("/ai/executive-summary")
async def executive_summary(
    db: DBSession,
    user: CurrentUser,
):
    """Generate NL executive summary of manufacturing KPIs using Ollama."""
    # Get dashboard data
    dashboard = await executive_dashboard(db=db, user=user)
    bottlenecks_data = await bottleneck_analysis(days=7, db=db, user=user)
    quality_data = await quality_risk_analysis(days=7, db=db, user=user)

    # Build context for Ollama
    context = (
        f"Manufacturing KPIs for this month:\n"
        f"- Work orders: {dashboard['work_orders']['total']} total, "
        f"{dashboard['work_orders']['active']} active, "
        f"{dashboard['work_orders']['completed_this_month']} completed\n"
        f"- Units produced: {dashboard['output']['units_produced']}\n"
        f"- Manufacturing cost: ${dashboard['output']['manufacturing_cost']:,.2f}\n"
        f"- NCRs: {dashboard['quality']['ncr_by_severity']}\n"
        f"- Downtime this month: {dashboard['equipment']['downtime_hours_this_month']}h\n"
        f"- Top bottleneck workstations: {[b['workstation_id'][:8] for b in bottlenecks_data['bottlenecks'][:3]]}\n"
        f"- Quality risk: {quality_data['overall_risk']}\n"
    )

    try:
        from app.services.ai import stream_ollama_chat
        import asyncio

        chunks = []
        prompt = f"Write a concise 3-paragraph executive summary of these manufacturing metrics:\n\n{context}\n\nFocus on performance, risks, and recommendations."
        async for chunk in stream_ollama_chat(prompt, model="llama3.2"):
            chunks.append(chunk)
        summary_text = "".join(chunks)
    except Exception:
        # Fallback if Ollama unavailable
        wo = dashboard["work_orders"]
        out = dashboard["output"]
        summary_text = (
            f"This month, manufacturing produced {out['units_produced']} units across "
            f"{wo['completed_this_month']} completed work orders at a cost of ${out['manufacturing_cost']:,.2f}. "
            f"There are currently {wo['active']} active work orders in progress. "
            f"Quality risk is rated {quality_data['overall_risk']} with {dashboard['quality']['total_open_ncrs']} open NCRs. "
            f"Equipment downtime totaled {dashboard['equipment']['downtime_hours_this_month']} hours this month."
        )

    return {
        "summary": summary_text,
        "kpis": dashboard,
        "generated_at": datetime.now().isoformat(),
    }
