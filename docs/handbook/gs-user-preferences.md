---
title: User Preferences & Notifications
slug: gs-user-preferences
category: getting-started
article_type: guide
module: admin
tags: [preferences, theme, notifications, language, timezone]
sort_order: 8
is_pinned: false
excerpt: Personalise your Urban Vibes Dynamics experience — theme, language, timezone, and notification settings.
---

# User Preferences & Notifications

Every user in Urban Vibes Dynamics can personalise their own experience independently of other users. Preferences are stored per account and apply across all devices you log in from.

> **Tip:** Set your timezone before creating calendar events — Urban Vibes Dynamics uses it to localise all time displays.

---

## 1. Accessing Preferences

Your preferences panel is always accessible from the top-right corner of the screen.

1. Click your **avatar** or profile photo in the top-right corner.
2. Select **Profile & Settings** from the dropdown menu.
3. The settings panel opens with tabs for: **Profile**, **Appearance**, **Notifications**, **Security**, and **Shortcuts**.

You can also navigate directly to `/settings/profile` in the URL bar.

---

## 2. Theme — Light, Dark, and System

Urban Vibes Dynamics supports three display modes. All themes use the same design tokens; only the background and text contrast changes.

1. Go to **Profile & Settings → Appearance**.
2. Under **Theme**, choose one of:

| Option | Behaviour |
|---|---|
| **Light** | Always uses the light theme regardless of your OS setting. |
| **Dark** | Always uses the dark theme. Recommended for low-light environments. |
| **System** | Automatically follows your operating system's light/dark preference and switches at sunset if your OS supports it. |

3. A live preview updates instantly — no save needed.
4. Click **Save Appearance** to persist the setting.

---

## 3. Language Selection

Urban Vibes Dynamics's interface language defaults to **English (en)**. Additional language packs are added as they become available.

1. Go to **Profile & Settings → Appearance**.
2. Under **Language**, select your preferred language from the dropdown.
3. Click **Save Appearance**.

The page will reload with the new language applied. All UI labels, menu items, and system messages will switch. Note: data you enter (customer names, notes, etc.) is stored as-is and is not translated.

---

## 4. Timezone

Your timezone setting controls how all dates and times are displayed to you — including calendar events, payroll periods, invoice due dates, AI scheduling, and audit logs.

1. Go to **Profile & Settings → Appearance**.
2. Under **Timezone**, search for your timezone (e.g., `Africa/Nairobi`).
3. The current time in your selected timezone is shown as a preview.
4. Click **Save Appearance**.

**Why timezone matters:**
- **Calendar & Meetings:** Events created by you are stored in UTC and displayed in your local timezone. If your timezone is wrong, meeting times will appear offset.
- **Payroll:** Pay period start/end calculations use the payroll admin's timezone. If you are an HR admin, set this correctly before running payroll.
- **Notifications:** Scheduled notification digests (daily summary emails) are sent at the configured hour in your timezone.
- **Audit Logs:** All system actions are timestamped in UTC but displayed in your timezone when you view them.

> If your organisation spans multiple timezones, each user should set their own timezone independently.

---

## 5. Notification Preferences

Urban Vibes Dynamics sends notifications through two channels: **in-app** (bell icon in the top bar) and **email**. You control which channels each notification type uses.

1. Go to **Profile & Settings → Notifications**.
2. You will see a table of notification categories with toggles for **In-App** and **Email**.

---

## 6. Notification Types by Module

The following table shows which modules send notifications and the default channel for each:

| Module | Notification | In-App | Email |
|---|---|---|---|
| **Projects** | Task assigned to you | On | On |
| **Projects** | Task status changed | On | Off |
| **Projects** | Comment on your task | On | Off |
| **CRM** | Deal stage changed | On | Off |
| **CRM** | Lead assigned to you | On | On |
| **Finance** | Invoice overdue | On | On |
| **Finance** | Payment received | On | On |
| **HR** | Leave request approved/rejected | On | On |
| **HR** | Payslip available | On | On |
| **Support** | New ticket assigned | On | On |
| **Support** | Ticket reply received | On | On |
| **Mail** | New email received | Off | Off |
| **Meetings** | Meeting starting in 15 min | On | On |
| **Calendar** | Event reminder | On | On |
| **Chat** | Direct message received | On | Off |
| **AI / Urban Bad AI** | Agent task completed | On | Off |

Toggle any row on or off. Click **Save Notifications** when done.

> Email notifications use the SMTP configuration set by your Super Admin. If you are not receiving email notifications, contact your admin to verify SMTP settings.

---

## 7. Keyboard Shortcuts Overview

Urban Vibes Dynamics includes keyboard shortcuts for common actions. A full reference is available in the application.

1. Press `?` anywhere in the app to open the **Keyboard Shortcuts** overlay.
2. Or go to **Profile & Settings → Shortcuts** to see the full list grouped by module.

Common shortcuts:

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open global search |
| `Cmd/Ctrl + Shift + A` | Toggle AI / Urban Bad AI sidebar |
| `Cmd/Ctrl + N` | New record (context-dependent) |
| `Cmd/Ctrl + S` | Save current form |
| `Esc` | Close modal or panel |
| `?` | Open keyboard shortcuts help |
| `G then D` | Go to Dashboard |
| `G then C` | Go to CRM |
| `G then F` | Go to Finance |

Module-specific shortcuts are listed in each module's handbook section.

---

## 8. Profile Photo Upload

Adding a profile photo helps your colleagues identify you in team views, meeting participant lists, and chat.

1. Go to **Profile & Settings → Profile**.
2. Click the avatar circle at the top — it will highlight and show an upload icon.
3. Select an image file (JPG or PNG, max 5MB, square images work best).
4. Use the crop tool to adjust framing.
5. Click **Apply** then **Save Profile**.

Your photo appears in: the top-right avatar, Chat messages, task assignee chips, meeting participant cards, and the People directory.

---

## Next Steps

- [Module Overview](./module-overview.md) — explore what each module offers
- [Setting Up Your Workspace](./gs-setup-workspace.md) — admin-level workspace configuration
- [Keyboard Shortcuts Reference](./gs-keyboard-shortcuts.md) — full shortcut list
