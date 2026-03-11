"""
Manufacturing finite capacity scheduler.

Priority-based forward scheduling:
  1. Load all planned/draft WOs ordered by priority + planned_start.
  2. For each WO, get its routing steps in sequence order.
  3. For each routing step, find the earliest available slot on the target workstation.
  4. Create ScheduleEntry records and update CapacitySlot.allocated_minutes.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.manufacturing import (
    WorkOrder,
    RoutingStep,
    CapacitySlot,
    ScheduleEntry,
)

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


async def schedule_work_orders(db: AsyncSession, scenario_id: uuid.UUID | None = None) -> list[dict]:
    """
    Run forward scheduling for all planned WOs.
    Returns list of dicts describing created ScheduleEntry records.
    """
    # Load planned/draft work orders sorted by priority then planned_start
    wo_result = await db.execute(
        select(WorkOrder)
        .where(WorkOrder.status.in_(["planned", "draft"]))
        .order_by(WorkOrder.planned_start.asc().nulls_last())
    )
    work_orders: list[WorkOrder] = list(wo_result.scalars().all())
    work_orders.sort(key=lambda w: (PRIORITY_ORDER.get(w.priority, 1), w.planned_start or datetime.max))

    # Load all capacity slots
    slot_result = await db.execute(
        select(CapacitySlot).where(CapacitySlot.status.in_(["available", "partial"]))
    )
    all_slots: list[CapacitySlot] = list(slot_result.scalars().all())

    # Build a lookup: workstation_id → sorted list of slots
    slot_map: dict[str, list[CapacitySlot]] = {}
    for s in all_slots:
        key = str(s.workstation_id)
        slot_map.setdefault(key, []).append(s)
    for key in slot_map:
        slot_map[key].sort(key=lambda s: (s.slot_date, s.shift))

    created_entries: list[dict] = []

    for wo in work_orders:
        # Get routing steps for this WO's BOM, ordered by sequence
        step_result = await db.execute(
            select(RoutingStep)
            .where(RoutingStep.bom_id == wo.bom_id)
            .order_by(RoutingStep.sequence)
        )
        steps: list[RoutingStep] = list(step_result.scalars().all())

        if not steps:
            continue

        # Start scheduling from WO planned_start or today
        current_start = wo.planned_start or datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)

        for step in steps:
            ws_key = str(step.workstation_id)
            slots = slot_map.get(ws_key, [])

            # Find earliest slot with enough free capacity
            assigned_slot: CapacitySlot | None = None
            for slot in slots:
                free = slot.total_minutes - slot.allocated_minutes
                if free >= step.duration_minutes:
                    # Slot date must be on or after current_start
                    slot_datetime = datetime.combine(slot.slot_date, datetime.min.time())
                    slot_shift_hour = {"morning": 6, "afternoon": 14, "night": 22}.get(slot.shift, 6)
                    slot_start = slot_datetime.replace(hour=slot_shift_hour)
                    if slot_start >= current_start.replace(tzinfo=None) if current_start.tzinfo else current_start:
                        assigned_slot = slot
                        break

            if assigned_slot is None:
                # No slot found — schedule at current_start anyway (infinite capacity fallback)
                sched_start = current_start
            else:
                slot_shift_hour = {"morning": 6, "afternoon": 14, "night": 22}.get(assigned_slot.shift, 6)
                sched_start = datetime.combine(assigned_slot.slot_date, datetime.min.time()).replace(
                    hour=slot_shift_hour
                )

            sched_end = sched_start + timedelta(minutes=step.duration_minutes)

            # Delete existing schedule entry for this WO+step+scenario (re-schedule)
            existing = await db.execute(
                select(ScheduleEntry).where(
                    and_(
                        ScheduleEntry.work_order_id == wo.id,
                        ScheduleEntry.routing_step_id == step.id,
                        ScheduleEntry.scenario_id == scenario_id,
                    )
                )
            )
            for old in existing.scalars().all():
                await db.delete(old)

            entry = ScheduleEntry(
                work_order_id=wo.id,
                routing_step_id=step.id,
                workstation_id=step.workstation_id,
                scenario_id=scenario_id,
                scheduled_start=sched_start,
                scheduled_end=sched_end,
                status="scheduled",
                sequence=step.sequence,
            )
            db.add(entry)

            # Update capacity slot
            if assigned_slot:
                assigned_slot.allocated_minutes += step.duration_minutes
                if assigned_slot.allocated_minutes >= assigned_slot.total_minutes:
                    assigned_slot.status = "full"
                else:
                    assigned_slot.status = "partial"

            created_entries.append(
                {
                    "work_order_id": str(wo.id),
                    "routing_step_id": str(step.id),
                    "workstation_id": str(step.workstation_id),
                    "scheduled_start": sched_start.isoformat(),
                    "scheduled_end": sched_end.isoformat(),
                }
            )

            # Next step starts after this one ends
            current_start = sched_end

    await db.commit()
    return created_entries
