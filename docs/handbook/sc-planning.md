---
title: Supply Chain Planning & Forecasting
slug: supply-chain-planning-forecasting
category: supply-chain
article_type: guide
module: supply-chain
tags: [planning, forecasting, reorder, safety-stock, s-and-op]
sort_order: 4
is_pinned: false
excerpt: Use demand forecasting and S&OP plans to optimise procurement and avoid stockouts.
---

# Supply Chain Planning & Forecasting

Urban Vibes Dynamics's Planning module combines historical sales data, current stock levels, and supplier lead times to help you procure the right quantities at the right time — without relying on guesswork or spreadsheets.

## Accessing the Planning Module

Navigate to **Supply Chain → Planning**. The dashboard shows three panels:

- **Demand Forecast** — Projected demand for the next 4, 8, and 12 weeks per product.
- **Suggested Reorders** — Items where projected stock will fall below safety stock before the next expected delivery.
- **S&OP Plan** — Your approved sales and operations plan for the current period.

## Demand Forecasting

Urban Vibes Dynamics generates demand forecasts by analysing:

- **Sales History** — The past 52 weeks of sales orders and POS transactions (from Finance and POS modules).
- **Seasonality** — The algorithm detects recurring seasonal patterns (e.g. higher demand in December) and adjusts projections accordingly.
- **Pipeline Orders** — Confirmed Sales Orders not yet fulfilled are added to near-term demand.

The forecast is displayed as a weekly bar chart per product. You can override any forecast value manually — click the bar, enter your adjusted figure, and add a note (e.g. "Trade event expected — demand up 30%"). Manual overrides are tracked separately from the system forecast so you can revert easily.

## Safety Stock Calculation

Safety stock is the buffer quantity that protects against demand spikes and late deliveries. Urban Vibes Dynamics calculates it using:

```
Safety Stock = Z × σ_demand × √(Lead Time)
```

Where Z = service level factor (default 1.65 for 95% service level), σ_demand = standard deviation of weekly demand, and Lead Time is the supplier's configured lead time in weeks.

You can override the calculated safety stock per product under **Inventory → Products → [Product] → Planning Tab**. Common reasons to override: products with very stable demand (lower buffer), or critical single-source items (higher buffer).

## Lead Time Buffers

Every supplier has a configured **Delivery Lead Time** (set on the Supplier record). The Planning module adds a configurable **buffer days** (default: 3 days) on top of stated lead times to account for administrative delays. You can adjust the global buffer under **Supply Chain → Settings → Planning**.

## S&OP Plan

The Sales & Operations Plan aligns your procurement schedule with your sales commitments. To create or update the plan:

1. Go to **Supply Chain → Planning → S&OP**.
2. Select the planning period (typically monthly).
3. Review the system-generated plan: opening stock, forecast demand, planned receipts (open POs), closing stock projection.
4. Adjust planned receipt quantities where needed.
5. Click **Approve Plan** — this locks the plan for the period and notifies the procurement team to action any suggested POs.

## Reviewing AI-Generated Procurement Suggestions

Urban Vibes Dynamics's AI (powered by the local Ollama instance) analyses the demand forecast, safety stock levels, supplier lead times, and your S&OP plan to generate **Suggested Purchase Requisitions**.

To review:

1. Go to **Supply Chain → Planning → Suggested Reorders**.
2. Each suggestion shows: product, suggested order quantity, recommended supplier, estimated delivery date, and the reason (e.g. "Safety stock breach in 12 days").
3. Click **Accept** to auto-create a draft requisition, or **Reject** to dismiss with a reason.
4. Accepted requisitions follow the normal approval workflow.

Suggestions are recalculated nightly. You can trigger a manual recalculation any time by clicking **Recalculate** on the Suggested Reorders page.

## Best Practices

- Review the Suggested Reorders list every Monday morning before the procurement team's weekly meeting.
- Keep supplier lead times updated — outdated lead times produce unreliable safety stock calculations.
- Use manual forecast overrides proactively before known demand events (promotions, tenders, seasonal peaks).
