---
title: Setting Up Your Workspace
slug: gs-setup-workspace
category: getting-started
article_type: guide
module: admin
tags: [setup, workspace, configuration, onboarding]
sort_order: 7
is_pinned: false
excerpt: Configure your company profile, branding, and workspace settings on first login.
---

# Setting Up Your Workspace

This guide walks you through everything you need to configure when you first log in to Urban Vibes Dynamics as a Super Admin. Complete these steps before inviting any other users.

> **Tip:** Before adding users, complete company settings — these defaults apply to all new records.

---

## 1. First Login as Super Admin

When Urban Vibes Dynamics is first deployed, a default Super Admin account is created with temporary credentials. Your first action should be to change the default password.

1. Log in using the credentials provided during deployment.
2. Click your avatar in the top-right corner and select **Profile & Settings**.
3. Navigate to the **Security** tab.
4. Enter your current password, then set a new strong password (minimum 12 characters, mix of letters, numbers, and symbols).
5. Click **Save Password**.

You will be prompted to log in again with the new credentials. Keep these credentials secure — the Super Admin account has unrestricted access to all modules and settings.

---

## 2. Company Settings

Company settings establish the baseline for all records created in the system.

1. Go to **Admin → Settings → Company**.
2. Fill in the following fields:

| Field | Description |
|---|---|
| **Company Name** | Your legal business name. Appears on invoices, receipts, and reports. |
| **Logo** | Upload a PNG or SVG (recommended: 240×60px, transparent background). |
| **Currency** | Default is **KES (Kenyan Shilling)**. This is your base currency for all financial records. |
| **Fiscal Year Start Month** | The month your financial year begins (e.g., January or July). |
| **Company Address** | Printed on invoices, payslips, and official documents. |
| **Tax Registration Number** | KRA PIN or equivalent. Appears on tax documents. |
| **Phone / Email** | Contact details shown in customer-facing documents. |

3. Click **Save Company Settings**.

> Changing the base currency after records have been created will not retroactively convert historical amounts. Set this correctly before creating any transactions.

---

## 3. Timezone and Date Format

Getting the timezone right is critical for scheduling, payroll calculations, and audit logs.

1. Go to **Admin → Settings → Localisation**.
2. Set **Timezone** — select your region (e.g., `Africa/Nairobi` for EAT, UTC+3).
3. Set **Date Format** — choose from:
   - `DD/MM/YYYY` (default for Kenya)
   - `MM/DD/YYYY`
   - `YYYY-MM-DD` (ISO format)
4. Set **Time Format** — 12-hour or 24-hour.
5. Set **Week Starts On** — Monday or Sunday.
6. Click **Save Localisation**.

These settings apply system-wide. Individual users can override their timezone in their own profile preferences.

---

## 4. Creating the First App Admin Users

Urban Vibes Dynamics uses a three-tier access model: **Super Admin → App Admin → User**. After configuring company settings, create at least one App Admin per module you plan to activate.

1. Go to **Admin → Users → Invite User**.
2. Fill in the user's name and email address.
3. Under **Role**, select **App Admin**.
4. Under **Module Scope**, select the module(s) this admin will manage (e.g., Finance, HR, CRM).
5. Click **Send Invite**.

The user will receive an email with a link to set their password. App Admins can then create regular users within their assigned module scope.

> An App Admin for Finance cannot access HR settings, and vice versa. This separation is enforced at the API level.

---

## 5. Configuring SMTP for Email

Urban Vibes Dynamics sends transactional emails (invoices, payslips, notifications, password resets) via your configured SMTP server. Urban Vibes Dynamics ships with Stalwart Mail Server built in, but you can point it to any external SMTP provider.

1. Go to **Admin → Settings → Email (SMTP)**.
2. Configure the following:

| Field | Example |
|---|---|
| **SMTP Host** | `smtp.yourdomain.com` or `localhost` (for Stalwart) |
| **SMTP Port** | `587` (STARTTLS) or `465` (SSL) |
| **SMTP Username** | `noreply@yourdomain.com` |
| **SMTP Password** | Your SMTP account password |
| **Sender Name** | `Urban Vibes Dynamics` or your company name |
| **Sender Address** | `noreply@yourdomain.com` |
| **Use TLS** | Toggle on for secure delivery |

3. Click **Test Connection** to verify — a test email will be sent to your Super Admin address.
4. Click **Save SMTP Settings**.

---

## 6. Enabling and Disabling Modules

Urban Vibes Dynamics ships with all modules installed but you can disable any that your organisation does not use. Disabled modules are hidden from the sidebar for all users.

1. Go to **Admin → Settings → Modules**.
2. You will see a grid of all available modules with toggle switches.
3. Toggle off any modules not required (e.g., Manufacturing if you are a services company).
4. Click **Save Module Configuration**.

Module state changes take effect immediately — no restart required. You can re-enable a module at any time; all previously created data is preserved.

---

## 7. White-Labelling

Urban Vibes Dynamics allows you to replace the "Urban Vibes Dynamics" name in the top-left sidebar with your company name or a custom product name.

1. Go to **Admin → Settings → Branding**.
2. Set **Product Name** — this replaces "Urban Vibes Dynamics" in the sidebar and browser tab title.
3. Upload a **Favicon** (32×32px ICO or PNG) to replace the default browser tab icon.
4. Set **Primary Colour** — enter a hex value to adjust the sidebar and button accent colour (default: `#51459d`).
5. Click **Save Branding**.

> Branding changes apply immediately for all users on next page load.

---

## 8. System Health Check

After completing setup, verify that all services are running correctly.

1. Go to **Admin → Parity Dashboard**.
2. The Parity Dashboard shows the health status of all backend services:
   - **Database** — PostgreSQL connection status
   - **Queue** — Celery worker and beat status
   - **File Storage** — MinIO connectivity
   - **AI Engine** — Ollama availability
   - **Mail** — SMTP test result
   - **Video** — Jitsi service status
3. Any service showing a red status will display an error message and suggested fix.
4. All services should show green before you begin onboarding users.

If a service is red, check the Docker container logs: `docker compose logs <service-name>`.

---

## Next Steps

- [User Preferences & Notifications](./gs-user-preferences.md) — help users personalise their experience
- [Module Overview](./module-overview.md) — understand what each module does
- [Inviting & Managing Users](./gs-users-roles.md) — set up your team's access
