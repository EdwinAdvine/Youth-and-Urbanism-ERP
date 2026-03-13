---
title: AI Financial Forecasting
slug: ai-financial-forecasting
category: finance
article_type: pro_tip
module: finance
tags: [ai, forecasting, cash-flow, anomalies, urban-bad-ai]
sort_order: 10
is_pinned: false
excerpt: Use Urban Bad AI to get cash flow predictions, anomaly alerts, and revenue forecasts.
---

# AI Financial Forecasting

Urban Bad AI — Urban Vibes Dynamics's built-in multi-agent AI system — has direct, secure access to your financial data. You can ask it questions in plain language and it will query your live books, analyse patterns, and deliver actionable insights without you having to build a single report manually.

## Opening the AI Sidebar

Press **Cmd+Shift+A** (Mac) or **Ctrl+Shift+A** (Windows/Linux) from anywhere in the application to open the AI sidebar. It slides in from the right side of the screen. No data leaves your server unless you have configured an external AI provider. The AI runs via your configured provider as set by your Super Admin.

## Useful Finance Prompts

You do not need to phrase prompts in any special way — just ask naturally. Here are examples of what works well:

### Cash Flow and Forecasting

- *"Forecast my cash flow for the next 30 days based on current receivables and outstanding bills."*
- *"What is my expected cash position at the end of Q2 if I collect all invoices due this month?"*
- *"How much runway do I have at the current burn rate?"*

The AI pulls your outstanding invoices, bill due dates, and recent transaction velocity to generate the forecast. It will show you a projected cash balance by week.

### Anomaly Detection

- *"Show me expense anomalies this month."*
- *"Are there any accounts that have unusually high spending compared to last quarter?"*
- *"Flag any invoices that look like duplicates."*

The AI compares current period activity against historical patterns and highlights outliers — for example, a utilities bill that is 3x higher than the previous six-month average.

### Receivables Intelligence

- *"Which invoices are most likely to go overdue based on each customer's payment history?"*
- *"List customers who have paid late more than twice in the last 12 months."*
- *"What is the average days to payment for my top 10 customers?"*

These prompts help you prioritise your collections effort before invoices actually go overdue, rather than chasing after the fact.

### Revenue Analysis

- *"Forecast next quarter's revenue based on the current pipeline and historical conversion rates."*
- *"Which product or service line is growing fastest month-over-month?"*
- *"Break down my revenue by customer segment for the last 6 months."*

### General Finance Q&A

- *"What was my gross profit margin last month?"*
- *"How does my cost of goods sold this year compare to last year?"*
- *"Summarise the financial health of the business in 3 bullet points."*

## How the AI Accesses Your Data

Urban Bad AI uses a set of approved finance tools — functions it can call to query your PostgreSQL database. These include tools for reading invoices, journal entries, account balances, vendor bills, and transaction history. It does not have write access from the AI sidebar unless you explicitly approve an action (like creating a journal entry) through the approval workflow.

When the AI needs to perform a calculation or analysis, it will show you a **Thinking** indicator and list the steps it is taking. For sensitive actions (anything that writes to the books), it will ask for your approval before proceeding.

## Tips for Better Results

- Give the AI a time frame: *"in the last 30 days"*, *"this financial year"*, *"Q3 2025"*
- Be specific about what you want back: *"give me a table"*, *"summarise in bullet points"*, *"show me by account"*
- If the first answer is not quite right, follow up: *"break that down by month"* or *"exclude intercompany transactions"*
- For recurring analyses you want every week, describe the question to your Finance Admin so they can set up a scheduled AI report (coming in a future Urban Vibes Dynamics update)

> **Privacy note:** All AI queries run on your self-hosted infrastructure. No financial data is sent to any external service unless you have configured an external AI provider (OpenAI, Anthropic, etc.) as the fallback in **Settings → AI Configuration**.
