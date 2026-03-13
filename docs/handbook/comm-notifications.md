---
title: Notifications & Alerts
slug: comm-notifications
category: communication
article_type: guide
module: admin
tags: [notifications, alerts, email, in-app, settings]
sort_order: 10
is_pinned: false
excerpt: Understand and configure in-app and email notifications across all Urban ERP modules.
---

# Notifications & Alerts

Urban ERP sends notifications via two channels: **in-app** (bell icon, real-time) and **email** (delivered to your inbox).

## The Notification Centre

Click the **bell icon** in the top-right header. The badge shows your unread count. Click any notification to navigate directly to the relevant record.

Click **Mark all as read** to clear the badge.

## Notification Categories

| Category | Examples |
|----------|---------|
| Assigned to me | Lead assigned, task assigned, ticket assigned |
| @Mentions | Someone @mentioned you in a chat or comment |
| Approvals Required | Leave approval, expense approval, invoice approval |
| Module Events | Deal won, payroll published, SLA breach |
| System Alerts | Failed jobs, disk space warning (Super Admin only) |

## Configuring Your Preferences

Go to **avatar → Preferences → Notifications**:

- Toggle **in-app** and **email** independently per category
- Enable **daily digest** to receive one summary email per day instead of individual emails for lower-priority categories
- Set **working hours** (Do Not Disturb) — notifications queue outside those hours and deliver when you're back

## Module-Level Triggers

Which events send notifications by module:

| Module | Triggers |
|--------|---------|
| Finance | Invoice approved, payment received, approval required |
| HR | Leave approved/rejected, payroll published, onboarding task due |
| CRM | Lead assigned, deal stage changed, activity overdue |
| Projects | Task assigned, comment on your task, deadline approaching |
| Support | Ticket assigned, SLA breach warning, customer reply |
| Chat | @mention, direct message |

## System Alerts (Super Admin)

Super Admins receive alerts for:
- Background job failures (Celery task errors)
- Disk usage above 85%
- Failed email delivery (SMTP errors)

These appear as in-app notifications marked **System** and also send an email.

> **Tip:** Turn off email notifications for modules you don't actively manage — inbox noise is the fastest way to start ignoring important alerts.
