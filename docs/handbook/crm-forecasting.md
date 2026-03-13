---
title: Sales Forecasting
slug: crm-forecasting
category: crm
article_type: guide
module: crm
tags: [forecasting, pipeline, revenue, ai, predictions]
sort_order: 9
is_pinned: false
excerpt: Use AI-assisted sales forecasting to predict revenue and identify at-risk deals.
---

# Sales Forecasting

Urban Vibes Dynamics's sales forecasting engine combines weighted pipeline analysis with AI predictions trained on your team's historical close patterns. The result is a projected revenue number for each period — with confidence ranges — that gets more accurate over time.

---

## 1. What Sales Forecasting Does

The forecast answers: "How much revenue will we close this month (or quarter)?"

It draws from:
- Every open deal in your pipeline
- Each deal's stage, value, and assigned close date
- Win probability at each stage
- Historical close rates for your team
- AI-scored deal quality

---

## 2. Accessing the Forecast

Navigate to **CRM → Forecast**.

The main forecast view shows:
- **Current period** (month or quarter — toggle in the top bar)
- Expected revenue with a confidence range (e.g., KES 4.2M – KES 5.8M)
- Breakdown by rep and by pipeline
- Deals contributing to the forecast, sorted by expected value

---

## 3. Forecast Methods

Urban Vibes Dynamics offers two forecast methods, selectable from **CRM → Forecast → Settings**:

### Weighted Pipeline
The classic method:

```
Expected Value = Deal Value × Stage Win Probability
```

Example: A KES 500,000 deal in Negotiation (60% probability) contributes KES 300,000 to the forecast.

All open deals' expected values are summed to produce the period forecast.

### AI Prediction
A more dynamic model that factors in:

- Your team's **actual** historical close rates per stage (not the default probabilities)
- Deal characteristics: size, industry, days in stage, activity frequency
- Seasonal patterns from prior periods
- The AI lead/deal score (higher-scored deals are weighted more heavily)

The AI prediction produces a tighter confidence range than weighted pipeline once enough historical data exists.

> **Tip:** The AI forecast improves each quarter as it learns your team's actual close patterns. Accuracy typically reaches 85–90% after 6 months of data.

---

## 4. Forecast View

The forecast dashboard includes:

| Component | Description |
|---|---|
| Period selector | Switch between current month, quarter, or custom range |
| Expected revenue | Central estimate with low/high confidence band |
| By rep | Each rep's committed vs likely contribution |
| By pipeline | Breakdown across New Business, Renewals, etc. |
| Deal table | All contributing deals with their weighted value |
| Trend line | Rolling 6-month forecast vs actual close chart |

---

## 5. AI Score Influence

Deals with an **AI Score above 70** are considered high-confidence in the prediction model and are weighted more heavily than their stage probability alone would suggest.

Deals with an AI Score below 30 are flagged as low-confidence and may be downweighted even if they are in a high-probability stage — useful for catching stalled or weak deals that inflate a rep's pipeline.

View a deal's AI Score on the deal card (top-right badge) or in the Deal table columns.

---

## 6. Adjusting the Forecast (Rep Overrides)

Reps and managers can override the AI prediction for specific deals:

1. Open the deal from the forecast table
2. Click **Forecast Override**
3. Set your **Committed Amount** (what you are confident will close) and a reason
4. Save — the override applies to the current period's forecast

Override reasons are visible to managers. Common reasons: "Verbal commit received", "Contract in legal review", "Risk — procurement on hold".

Overrides do not change the deal value — they only affect the forecast contribution.

---

## 7. Forecast Categories

Each deal can be assigned a forecast category to give managers a clearer picture:

| Category | Meaning |
|---|---|
| Pipeline | Standard — included at weighted value |
| Commit | Rep is highly confident this will close this period |
| Upside | Possible if conditions are right, but not certain |
| Omitted | Excluded from this period's forecast (e.g., pushed to next quarter) |

Set the category on the deal form or from the forecast table inline. Commits carry higher weight in the managerial rollup.

---

## 8. Manager View

Managers see a rollup across their team:

- Each rep's **Commit** total (what they have said they will close)
- Each rep's **Likely** total (AI-weighted pipeline)
- Gap to quota
- Deals at risk (high value, low AI score, overdue activity)

Filter by rep, pipeline, or stage to drill into the detail. The manager view is accessible from **CRM → Forecast → Team View** (requires CRM Manager role or above).

---

## 9. Forecast vs Actual Report

At the end of each period, compare your forecast to what actually closed:

**CRM → Reports → Forecast Accuracy**

| Column | Description |
|---|---|
| Period | Month or quarter |
| Forecast (Weighted) | What the weighted pipeline predicted |
| Forecast (AI) | What the AI model predicted |
| Actual Closed | Revenue actually closed |
| Variance | Difference between forecast and actual |
| MAPE | Mean Absolute Percentage Error — lower is better |

Use this report to tune your team's habit of keeping deal stages and close dates current — the forecast is only as good as the pipeline hygiene it draws from.

---

## 10. Tips for Forecast Accuracy

- **Update close dates weekly** — a deal with a close date that has passed is dead weight in the forecast
- **Move stalled deals to Lost** — keeping zombie deals in the pipeline inflates numbers
- **Use forecast categories honestly** — Commit should only be used when there is a verbal or written agreement
- **Log activities regularly** — the AI model uses activity frequency as a signal of deal momentum

---

## Quick Reference

| Action | Path |
|---|---|
| View forecast | CRM → Forecast |
| Set forecast method | CRM → Forecast → Settings |
| Override a deal's forecast | Deal → Forecast Override |
| Set forecast category | Deal form → Forecast Category field |
| Manager team view | CRM → Forecast → Team View |
| Forecast vs actual report | CRM → Reports → Forecast Accuracy |
