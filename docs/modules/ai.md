# AI System

> Local-first AI with multi-agent orchestration, 55+ tools, and configurable provider fallback.

## Overview

Urban Vibes Dynamics runs AI completely locally using **Ollama** as the primary provider. Every AI feature works offline with full data privacy — no data leaves the server. OpenAI, Anthropic, and Grok can be configured as fallback providers by the Super Admin.

The AI system has two layers:
1. **Basic AI Chat** — streaming chat with module context and voice input
2. **Urban Bad AI** — multi-agent system (Orchestrator → Researcher → Verifier → Executor) for complex cross-module tasks

**Who uses it:** All authenticated users (chat), Super Admin (provider config)
**Requires:** Ollama running locally (default) or external API key configured

---

## Features

- **AI Chat** — streaming chat with module-aware context (knows which page you're on)
- **55 AI Tools** — tools across all modules (create invoice, schedule meeting, lookup employee, etc.)
- **Urban Bad AI** — 4-agent orchestration system for complex multi-step tasks
- **Tool Approval Tiers** — auto_approve / warn / require_approval for sensitive operations
- **Voice Input** — speak your queries (browser speech-to-text)
- **AI Sidebar** — persistent right-side panel (Cmd+Shift+A to toggle, 380px wide)
- **Document AI** — summarize, translate, review Drive documents
- **Email AI** — draft replies, summarize threads, auto-categorize
- **Finance AI** — cash flow forecasting, anomaly detection, report generation
- **HR AI** — resume screening, attrition risk prediction, skills gap analysis
- **CRM AI** — lead scoring, deal win probability, customer sentiment analysis
- **Notes AI** — auto-summarize, extract action items, suggest tags
- **Manufacturing AI** — production scheduling, quality prediction
- **Provider Configuration** — Super Admin sets primary/fallback AI provider

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/ai.py` | Basic AI chat WebSocket + REST endpoints |
| `backend/app/api/v1/ai_ext.py` | Extended AI: document AI, email AI |
| `backend/app/api/v1/ai_features.py` | Module-specific AI features |
| `backend/app/api/v1/agent.py` | Urban Bad AI WebSocket + approval endpoints |
| `backend/app/services/ai.py` | Core AI service (Ollama + fallback providers) |
| `backend/app/services/ai_tools.py` | All 55 tool definitions and approval tiers |
| `backend/app/services/agent_orchestrator.py` | Multi-agent orchestration engine (~400 lines) |
| `backend/app/services/agent_prompts.py` | System prompts for each agent type |
| `backend/app/models/agent.py` | AgentRun, AgentRunStep, AgentApproval models |
| `frontend/src/components/ai/AISidebar.tsx` | Right sidebar UI |
| `frontend/src/hooks/useAgentWebSocket.ts` | Agent WebSocket hook |
| `frontend/src/components/ai/AgentThinkingIndicator.tsx` | Animated status display |

---

## Urban Bad AI — Multi-Agent System

### Agents

| Agent | Role |
|-------|------|
| **Orchestrator** | Receives user request, breaks it into steps, coordinates other agents |
| **Researcher** | Queries the database and APIs to gather information |
| **Verifier** | Checks Researcher's findings for accuracy and completeness |
| **Executor** | Carries out approved actions (create records, send emails, etc.) |

### Message Protocol (WebSocket)

**Send to agent:**
```json
{ "type": "prompt", "message": "...", "context": { "module": "finance", "route": "/finance/invoices" } }
{ "type": "approve", "run_id": "...", "step_ids": ["..."], "decision": "approve" }
{ "type": "approve", "run_id": "...", "step_ids": ["..."], "decision": "reject" }
```

**Receive from agent:**
```
plan → agent_thinking → step_started → step_completed → approval_needed → result
```

### Tool Approval Tiers

| Tier | Examples | Behavior |
|------|---------|---------|
| `auto_approve` | Read operations, lookups, reports | Executes without user confirmation |
| `warn` | Create records, send emails | Shows warning, proceeds in 5 seconds unless cancelled |
| `require_approval` | Delete records, financial transactions above threshold | Pauses and waits for explicit user approval |

---

## WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8000/api/v1/ai/ws/chat/{session_id}?token={jwt}` | Basic AI chat |
| `ws://localhost:8000/api/v1/agent/ws/{session_id}?token={jwt}` | Urban Bad AI multi-agent |

---

## AI Provider Configuration

Configured by Super Admin at Admin > AI Settings:

| Provider | Model Examples | When Used |
|----------|---------------|---------|
| Ollama (local) | llama3.1, mistral, codellama | Default — always used if available |
| OpenAI | gpt-4o, gpt-4-turbo | Fallback when Ollama unavailable |
| Anthropic | claude-3-5-sonnet | Fallback option |
| Grok | grok-2 | Optional additional provider |

Pull Ollama models:
```bash
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama list
```

---

## Adding New AI Tools

1. Add tool definition to `backend/app/services/ai_tools.py`
2. Set the approval tier in `TOOL_APPROVAL_TIERS` dict
3. Implement the tool handler function
4. Register tool with the orchestrator
5. Add tool to the appropriate agent's capabilities
