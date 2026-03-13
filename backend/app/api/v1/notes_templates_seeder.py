"""Notes Template Seeder — Super Admin only.

POST /notes/templates/seed
  Seeds 30 system NoteTemplate records across 6 categories.
  Safe to call multiple times; already-existing templates are skipped.

Router prefix: /notes/templates  (registered in api/v1/__init__.py)
"""

import json
from typing import Any

from fastapi import APIRouter, status
from sqlalchemy import and_, select

from app.core.deps import DBSession, SuperAdminUser

router = APIRouter()


# ── TipTap JSON builder helpers ───────────────────────────────────────────────

def _tiptap_heading(text: str, level: int = 2) -> dict:
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": [{"type": "text", "text": text}],
    }


def _tiptap_bullet_list(items: list[str]) -> dict:
    return {
        "type": "bulletList",
        "content": [
            {
                "type": "listItem",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": item}],
                    }
                ],
            }
            for item in items
        ],
    }


def _tiptap_paragraph(text: str = "") -> dict:
    content: list[dict] = [{"type": "text", "text": text}] if text else []
    return {"type": "paragraph", "content": content}


def _build_tiptap(sections: list[tuple[str, list[str]]]) -> str:
    """Build a TipTap JSON document from a list of (heading, bullet_items) tuples."""
    nodes: list[dict] = []
    for heading, bullets in sections:
        nodes.append(_tiptap_heading(heading, level=2))
        nodes.append(_tiptap_bullet_list(bullets) if bullets else _tiptap_paragraph())
    return json.dumps({"type": "doc", "content": nodes})


def _build_html(sections: list[tuple[str, list[str]]]) -> str:
    """Build an HTML string from (heading, bullet_items) tuples."""
    parts: list[str] = []
    for heading, bullets in sections:
        parts.append(f"<h2>{heading}</h2>")
        if bullets:
            items = "".join(f"<li>{item}</li>" for item in bullets)
            parts.append(f"<ul>{items}</ul>")
        else:
            parts.append("<p></p>")
    return "".join(parts)


# ── Template definitions ──────────────────────────────────────────────────────

PLACEHOLDER = ["Add notes here..."]

TEMPLATES: list[dict[str, Any]] = [
    # ── Meetings (6) ─────────────────────────────────────────────────────────
    {
        "name": "Weekly Team Meeting",
        "category": "Meetings",
        "description": "Standard weekly team standup / sync template.",
        "icon": "📅",
        "sections": [
            ("Attendees", ["List attendees here..."]),
            ("Agenda", ["Item 1", "Item 2", "Item 3"]),
            ("Discussion Points", PLACEHOLDER),
            ("Action Items", ["Owner — Action — Due date"]),
            ("Decisions", PLACEHOLDER),
        ],
    },
    {
        "name": "1-on-1 Meeting",
        "category": "Meetings",
        "description": "Manager and direct-report one-on-one session.",
        "icon": "🤝",
        "sections": [
            ("Check-in", ["How are things going overall?"]),
            ("Goals Review", ["Progress on current goals..."]),
            ("Concerns", PLACEHOLDER),
            ("Action Items", ["Owner — Action — Due date"]),
            ("Next Meeting", ["Schedule:", "Topics to carry forward:"]),
        ],
    },
    {
        "name": "Project Kickoff",
        "category": "Meetings",
        "description": "Kickoff meeting template for new projects.",
        "icon": "🚀",
        "sections": [
            ("Project Overview", PLACEHOLDER),
            ("Stakeholders", ["Name — Role — Contact"]),
            ("Goals & Success Criteria", PLACEHOLDER),
            ("Timeline", ["Start:", "Milestones:", "End:"]),
            ("Risks", ["Risk — Likelihood — Mitigation"]),
            ("Action Items", ["Owner — Action — Due date"]),
        ],
    },
    {
        "name": "Retrospective",
        "category": "Meetings",
        "description": "Sprint or project retrospective template.",
        "icon": "🔄",
        "sections": [
            ("What Went Well", PLACEHOLDER),
            ("What Didn't", PLACEHOLDER),
            ("Action Items", ["Owner — Action — Due date"]),
            ("Team Mood", ["Rate the sprint on a scale of 1–5:"]),
        ],
    },
    {
        "name": "Client Meeting",
        "category": "Meetings",
        "description": "External client meeting notes.",
        "icon": "💼",
        "sections": [
            ("Client Name / Contact", ["Company:", "Name:", "Email:", "Phone:"]),
            ("Agenda", ["Topic 1", "Topic 2"]),
            ("Discussion", PLACEHOLDER),
            ("Follow-up Items", ["Item — Owner — Due date"]),
            ("Next Steps", PLACEHOLDER),
        ],
    },
    {
        "name": "Board Meeting",
        "category": "Meetings",
        "description": "Board of directors meeting minutes template.",
        "icon": "🏛️",
        "sections": [
            ("Attendees", ["Name — Title — Organisation"]),
            ("Agenda", ["Item 1", "Item 2"]),
            ("Reports", ["Finance:", "Operations:", "People:"]),
            ("Resolutions", ["Resolution — Proposed by — Seconded by — Result"]),
            ("Action Items", ["Owner — Action — Due date"]),
        ],
    },
    # ── Projects (5) ─────────────────────────────────────────────────────────
    {
        "name": "Project Brief",
        "category": "Projects",
        "description": "High-level project brief for stakeholder alignment.",
        "icon": "📋",
        "sections": [
            ("Overview", PLACEHOLDER),
            ("Goals", ["Goal 1", "Goal 2"]),
            ("Scope", ["In scope:", "Out of scope:"]),
            ("Timeline", ["Start:", "End:", "Key milestones:"]),
            ("Budget", ["Total budget:", "Breakdown:"]),
            ("Team", ["Name — Role"]),
            ("Success Metrics", ["Metric — Target"]),
        ],
    },
    {
        "name": "Project Status Report",
        "category": "Projects",
        "description": "Weekly or monthly project status report.",
        "icon": "📊",
        "sections": [
            ("Summary", PLACEHOLDER),
            ("Milestones", ["Milestone — Status — Due date"]),
            ("Risks", ["Risk — Status — Mitigation"]),
            ("Budget Burn", ["Budgeted:", "Spent:", "Remaining:"]),
            ("Next Steps", PLACEHOLDER),
        ],
    },
    {
        "name": "Technical Spec",
        "category": "Projects",
        "description": "Technical specification document template.",
        "icon": "⚙️",
        "sections": [
            ("Overview", PLACEHOLDER),
            ("Requirements", ["Functional:", "Non-functional:"]),
            ("Architecture", PLACEHOLDER),
            ("API Design", ["Endpoint — Method — Description"]),
            ("Testing Plan", ["Unit tests:", "Integration tests:", "E2E tests:"]),
        ],
    },
    {
        "name": "Decision Log",
        "category": "Projects",
        "description": "Record important project decisions and their rationale.",
        "icon": "⚖️",
        "sections": [
            ("Decision", PLACEHOLDER),
            ("Context", PLACEHOLDER),
            ("Options Considered", ["Option 1:", "Option 2:", "Option 3:"]),
            ("Rationale", PLACEHOLDER),
            ("Date", ["Date decided:", "Decided by:"]),
        ],
    },
    {
        "name": "Bug Report",
        "category": "Projects",
        "description": "Standard software bug report template.",
        "icon": "🐛",
        "sections": [
            ("Summary", PLACEHOLDER),
            ("Steps to Reproduce", ["1. Step one", "2. Step two", "3. Step three"]),
            ("Expected vs Actual", ["Expected:", "Actual:"]),
            ("Environment", ["OS:", "Browser / Version:", "Build:"]),
            ("Priority", ["Priority:", "Severity:", "Assigned to:"]),
        ],
    },
    # ── HR & People (5) ──────────────────────────────────────────────────────
    {
        "name": "Job Description",
        "category": "HR & People",
        "description": "Job posting template for open roles.",
        "icon": "📄",
        "sections": [
            ("Role Overview", ["Title:", "Department:", "Location:", "Type:"]),
            ("Responsibilities", ["Responsibility 1", "Responsibility 2"]),
            ("Requirements", ["Required skill 1", "Required skill 2", "Nice to have:"]),
            ("Benefits", ["Benefit 1", "Benefit 2"]),
        ],
    },
    {
        "name": "Performance Review",
        "category": "HR & People",
        "description": "Annual or mid-year employee performance review.",
        "icon": "⭐",
        "sections": [
            ("Goals Achievement", ["Goal — Result — %"]),
            ("Strengths", PLACEHOLDER),
            ("Areas to Improve", PLACEHOLDER),
            ("Development Plan", ["Skill — Action — Timeline"]),
            ("Rating", ["Overall rating (1–5):", "Manager comments:"]),
        ],
    },
    {
        "name": "Onboarding Checklist",
        "category": "HR & People",
        "description": "New employee onboarding checklist.",
        "icon": "✅",
        "sections": [
            ("Day 1", ["Desk / equipment ready", "Welcome call", "Introduction email"]),
            ("Week 1", ["Team introductions", "Shadow sessions", "Tool access"]),
            ("Month 1", ["30-day review", "First project assigned"]),
            ("Accounts & Access", ["Email", "Slack / Teams", "ERP", "Git"]),
            ("Team Intro", ["Buddy assigned:", "Key contacts:"]),
        ],
    },
    {
        "name": "Exit Interview",
        "category": "HR & People",
        "description": "Structured exit interview guide.",
        "icon": "🚪",
        "sections": [
            ("Reason for Leaving", PLACEHOLDER),
            ("Feedback on Role", ["What did you enjoy?", "What could be improved?"]),
            ("Team Feedback", PLACEHOLDER),
            ("Suggestions", ["What could the company do better?"]),
        ],
    },
    {
        "name": "Employee Development Plan",
        "category": "HR & People",
        "description": "Individual development plan (IDP) template.",
        "icon": "📈",
        "sections": [
            ("Current Skills", ["Skill — Proficiency level"]),
            ("Goals", ["Goal 1 — Timeframe", "Goal 2 — Timeframe"]),
            ("Learning Resources", ["Course / Book / Mentor"]),
            ("Timeline", ["Q1:", "Q2:", "Q3:", "Q4:"]),
        ],
    },
    # ── Finance & Sales (5) ──────────────────────────────────────────────────
    {
        "name": "Client Proposal",
        "category": "Finance & Sales",
        "description": "Sales proposal template for prospective clients.",
        "icon": "📝",
        "sections": [
            ("Executive Summary", PLACEHOLDER),
            ("Problem", PLACEHOLDER),
            ("Solution", PLACEHOLDER),
            ("Pricing", ["Item — Quantity — Unit price — Total"]),
            ("Timeline", ["Start:", "Delivery milestones:"]),
            ("Terms", ["Payment terms:", "Validity:", "Disclaimers:"]),
        ],
    },
    {
        "name": "Sales Call Notes",
        "category": "Finance & Sales",
        "description": "Notes captured during a sales call or discovery call.",
        "icon": "📞",
        "sections": [
            ("Contact Info", ["Name:", "Title:", "Company:", "Email:", "Phone:"]),
            ("Pain Points", ["Pain 1", "Pain 2"]),
            ("Budget", ["Budget range:", "Decision timeline:"]),
            ("Decision Process", ["Who decides?", "Process steps:"]),
            ("Next Steps", ["Action — Owner — Due date"]),
        ],
    },
    {
        "name": "Contract Notes",
        "category": "Finance & Sales",
        "description": "Contract review and notes template.",
        "icon": "📜",
        "sections": [
            ("Parties", ["Party A:", "Party B:"]),
            ("Key Terms", ["Term 1", "Term 2"]),
            ("Obligations", ["Our obligations:", "Their obligations:"]),
            ("Deadlines", ["Effective date:", "Expiry date:", "Renewal clause:"]),
            ("Risks", ["Risk — Mitigation"]),
        ],
    },
    {
        "name": "Budget Request",
        "category": "Finance & Sales",
        "description": "Template for requesting budget approval.",
        "icon": "💰",
        "sections": [
            ("Purpose", PLACEHOLDER),
            ("Amount Requested", ["Amount:", "Currency:", "Cost centre:"]),
            ("Justification", PLACEHOLDER),
            ("Expected ROI", PLACEHOLDER),
            ("Timeline", ["Need by:", "Project duration:"]),
        ],
    },
    {
        "name": "Invoice Dispute",
        "category": "Finance & Sales",
        "description": "Record and track an invoice dispute.",
        "icon": "🔍",
        "sections": [
            ("Invoice Details", ["Invoice #:", "Amount:", "Date:", "Vendor / Client:"]),
            ("Issue Description", PLACEHOLDER),
            ("Resolution Requested", PLACEHOLDER),
            ("Supporting Docs", ["Attachment 1", "Attachment 2"]),
        ],
    },
    # ── Strategy & Planning (5) ──────────────────────────────────────────────
    {
        "name": "OKR Planning",
        "category": "Strategy & Planning",
        "description": "Objectives and Key Results planning template.",
        "icon": "🎯",
        "sections": [
            ("Objective", PLACEHOLDER),
            ("Key Results", ["KR1 — Target metric", "KR2 — Target metric"]),
            ("Initiatives", ["Initiative — Owner — Timeline"]),
            ("Owner", ["Team / Person responsible:"]),
            ("Review Date", ["Quarterly review date:"]),
        ],
    },
    {
        "name": "SWOT Analysis",
        "category": "Strategy & Planning",
        "description": "Strategic SWOT analysis template.",
        "icon": "🔲",
        "sections": [
            ("Strengths", ["Strength 1", "Strength 2"]),
            ("Weaknesses", ["Weakness 1", "Weakness 2"]),
            ("Opportunities", ["Opportunity 1", "Opportunity 2"]),
            ("Threats", ["Threat 1", "Threat 2"]),
            ("Strategies", ["SO strategy:", "WO strategy:", "ST strategy:", "WT strategy:"]),
        ],
    },
    {
        "name": "Quarterly Business Review",
        "category": "Strategy & Planning",
        "description": "QBR template for leadership and board reviews.",
        "icon": "📆",
        "sections": [
            ("Summary", PLACEHOLDER),
            ("KPIs", ["KPI — Target — Actual — Δ"]),
            ("Wins", ["Win 1", "Win 2"]),
            ("Challenges", ["Challenge — Root cause"]),
            ("Next Quarter Plan", ["Initiative — Owner — Target"]),
        ],
    },
    {
        "name": "Product Roadmap",
        "category": "Strategy & Planning",
        "description": "Annual product roadmap planning template.",
        "icon": "🗺️",
        "sections": [
            ("Vision", PLACEHOLDER),
            ("Q1", ["Feature / Initiative 1", "Feature / Initiative 2"]),
            ("Q2", ["Feature / Initiative 1", "Feature / Initiative 2"]),
            ("Q3", ["Feature / Initiative 1", "Feature / Initiative 2"]),
            ("Q4", ["Feature / Initiative 1", "Feature / Initiative 2"]),
            ("Key Risks", ["Risk — Mitigation"]),
        ],
    },
    {
        "name": "Post-Mortem",
        "category": "Strategy & Planning",
        "description": "Incident or project post-mortem analysis.",
        "icon": "🔬",
        "sections": [
            ("Incident Summary", PLACEHOLDER),
            ("Timeline", ["Time — Event"]),
            ("Root Cause", PLACEHOLDER),
            ("Impact", ["Users affected:", "Duration:", "Revenue impact:"]),
            ("Lessons Learned", PLACEHOLDER),
            ("Action Items", ["Owner — Action — Due date"]),
        ],
    },
    # ── Research & Notes (4) ─────────────────────────────────────────────────
    {
        "name": "Research Notes",
        "category": "Research & Notes",
        "description": "General-purpose research notes template.",
        "icon": "🔭",
        "sections": [
            ("Topic", PLACEHOLDER),
            ("Sources", ["Source 1 — URL / Reference", "Source 2 — URL / Reference"]),
            ("Key Findings", ["Finding 1", "Finding 2"]),
            ("Open Questions", ["Question 1", "Question 2"]),
            ("Conclusions", PLACEHOLDER),
        ],
    },
    {
        "name": "Literature Review",
        "category": "Research & Notes",
        "description": "Academic or professional literature review template.",
        "icon": "📚",
        "sections": [
            ("Overview", PLACEHOLDER),
            ("Papers Reviewed", ["Author, Title, Year, Key argument"]),
            ("Themes", ["Theme 1", "Theme 2"]),
            ("Gaps", ["Gap 1", "Gap 2"]),
            ("Recommendations", PLACEHOLDER),
        ],
    },
    {
        "name": "User Interview",
        "category": "Research & Notes",
        "description": "UX user interview notes template.",
        "icon": "🗣️",
        "sections": [
            ("Participant Info", ["Name:", "Role:", "Company:", "Date:"]),
            ("Questions", ["Q1:", "Q2:", "Q3:"]),
            ("Key Insights", ["Insight 1", "Insight 2"]),
            ("Pain Points", ["Pain 1", "Pain 2"]),
            ("Recommendations", PLACEHOLDER),
        ],
    },
    {
        "name": "Daily Journal",
        "category": "Research & Notes",
        "description": "Daily personal or work journal entry.",
        "icon": "📓",
        "sections": [
            ("Focus for Today", ["Priority 1", "Priority 2", "Priority 3"]),
            ("Gratitude", ["I am grateful for..."]),
            ("Progress", PLACEHOLDER),
            ("Blockers", PLACEHOLDER),
            ("Tomorrow", ["Plan for tomorrow..."]),
        ],
    },
]


# ── Seeder endpoint ───────────────────────────────────────────────────────────

@router.post(
    "/seed",
    status_code=status.HTTP_200_OK,
    summary="Seed 30 system note templates (Super Admin only)",
)
async def seed_note_templates(
    current_user: SuperAdminUser,
    db: DBSession,
) -> dict[str, int]:
    from app.models.notes import NoteTemplate  # noqa: PLC0415

    created = 0
    skipped = 0

    for tpl in TEMPLATES:
        # Idempotency check: skip if a system template with this title already exists
        existing = await db.execute(
            select(NoteTemplate).where(
                and_(
                    NoteTemplate.name == tpl["name"],
                    NoteTemplate.is_system == True,  # noqa: E712
                )
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        sections: list[tuple[str, list[str]]] = tpl["sections"]
        html_content = _build_html(sections)
        tiptap_json = _build_tiptap(sections)

        record = NoteTemplate(
            name=tpl["name"],
            content_html=html_content,
            content_tiptap_json=tiptap_json,
            category=tpl.get("category"),
            description=tpl.get("description"),
            icon=tpl.get("icon"),
            is_system=True,
        )
        db.add(record)
        created += 1

    if created:
        await db.commit()

    return {"created": created, "skipped": skipped}
