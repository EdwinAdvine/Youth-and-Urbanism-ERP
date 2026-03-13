---
title: Urban Bad AI Assistant
slug: urban-bad-ai-assistant
category: communication
article_type: pro_tip
module: chat
tags: [ai, assistant, automation, multi-agent, urban-bad-ai, copilot]
sort_order: 8
is_pinned: false
excerpt: Use the AI assistant sidebar (Cmd+Shift+A) to automate tasks across all ERP modules.
---

# Urban Bad AI Assistant

Urban Bad AI is the built-in AI automation engine inside Urban Vibes Dynamics. It goes far beyond a simple chat bot — it is a coordinated system of four specialised agents that can research, verify, and execute tasks across every module in the platform, from Finance and CRM to HR and Supply Chain.

## How It Works: Four Agents

When you give Urban Bad AI a task, four agents collaborate behind the scenes:

1. **Orchestrator** — receives your prompt, breaks it into a plan, and coordinates the other agents.
2. **Researcher** — queries the database and reads relevant records to gather context (e.g., finds all open deals, checks invoice history for a client).
3. **Verifier** — checks the Researcher's findings for accuracy and flags any data inconsistencies before action is taken.
4. **Executor** — carries out the approved actions (creates records, sends emails, updates statuses, generates documents).

This chain ensures that the AI does not blindly act on bad data. The Verifier step catches errors that a single-agent system would miss.

## Opening the Sidebar

- Press **Cmd+Shift+A** (Mac) or **Ctrl+Shift+A** (Windows/Linux) from anywhere in Urban Vibes Dynamics.
- Or click the **AI** button in the top navigation bar.

The AI sidebar slides in from the right (380px wide) and stays open as you navigate the app. You can close it with the same shortcut or by clicking the X.

## Example Prompts

Here are practical examples of what you can ask Urban Bad AI:

**Finance:**
- "Create an invoice for Nairobi Breweries Ltd for KES 85,000 consulting services, 16% VAT, due in 30 days."
- "Show me all overdue invoices above KES 50,000."
- "What is our total revenue for Q1 2026?"

**CRM:**
- "Show me which leads have been inactive for more than 30 days."
- "Move all deals in the Proposal stage that have had no activity this week to 'At Risk'."
- "Create a follow-up task for every deal in the Negotiation stage, due tomorrow."

**Calendar & Meetings:**
- "Schedule a follow-up meeting with all deals in the Negotiation stage — set it for next Monday at 10am."
- "Show me my schedule for tomorrow."

**HR:**
- "How many leave days does Jane Wangari have remaining this year?"
- "List all employees whose contracts expire in the next 60 days."

**Supply Chain:**
- "Create a purchase order to Jambo Supplies Ltd for 200 units of A4 paper at KES 450 per ream."

## Approval Workflow

Not all actions are executed automatically. Urban Bad AI classifies every action by risk level:

- **Auto-approve** — low-risk read operations and minor record updates happen immediately.
- **Warn** — moderate actions (e.g., sending a bulk email, updating multiple records) show a confirmation prompt before proceeding.
- **Require approval** — high-value or irreversible actions (e.g., creating an invoice above a configured threshold, deleting records) pause and wait for your explicit approval. You see a summary of exactly what will happen, and you click **Approve** or **Reject**.

Financial approval thresholds are configured by the Super Admin in **Admin → Settings → AI Approvals**.

## What Urban Bad AI Can Do

- Create, update, and retrieve records in any module (CRM, Finance, HR, Projects, Support, Supply Chain, Manufacturing, E-Commerce, etc.)
- Send emails and calendar invites
- Generate reports and summaries
- Search and surface information from across the ERP
- Trigger workflows and escalations

## What It Cannot Do

- It cannot access systems outside Urban Vibes Dynamics (no internet browsing, no external APIs).
- It cannot override RBAC permissions — if your account does not have access to HR payroll, neither does the AI acting on your behalf.
- It does not guess. If it lacks enough information to complete a task safely, it asks for clarification before proceeding.

Urban Bad AI runs via your configured AI provider (OpenAI, Anthropic, or Grok) as set by the Super Admin.
