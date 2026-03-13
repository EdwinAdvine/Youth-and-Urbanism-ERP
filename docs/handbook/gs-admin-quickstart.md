---
title: Admin Quick Start Guide
slug: admin-quick-start
category: getting-started
article_type: quickstart
tags: [admin, setup, users, email, modules]
sort_order: 1
is_pinned: false
excerpt: Set up Urban Vibes Dynamics from scratch: initial login, creating users, configuring modules.
---

# Admin Quick Start Guide

Welcome to Urban Vibes Dynamics. This guide walks you through the first 30 minutes of setting up your system — from your very first login to having a working organisation with users, modules, and email configured.

---

## Step 1 — First Login

Urban Vibes Dynamics ships with a single Super Admin account. Use the credentials set in your environment file:

- **Email:** value of `SUPER_ADMIN_EMAIL` (e.g. `admin@yourcompany.com`)
- **Password:** value of `SUPER_ADMIN_PASSWORD`

Navigate to `http://localhost:3010` (or your deployed domain) and log in. You will land on the **Super Admin Dashboard**.

> **Pro tip:** Change the default password immediately. Go to your avatar (top right) → **Profile** → **Change Password**.

---

## Step 2 — Navigate to the Admin Panel

From any screen, click **Admin** in the left sidebar (visible only to Super Admins). The Admin panel has three main sections:

- **Users & Roles** — create and manage accounts
- **Module Settings** — enable/disable modules per organisation
- **System Settings** — email (SMTP), AI provider, storage, and global preferences

---

## Step 3 — Create App Admins for Each Module

Each module (Finance, HR, CRM, Projects, etc.) should have at least one App Admin responsible for its configuration.

1. Go to **Admin → Users & Roles → Create User**.
2. Fill in name, email, and a temporary password.
3. Under **Role**, select **App Admin**.
4. Under **Scope**, pick the module(s) this admin should manage (e.g. `finance`, `hr`).
5. Click **Create**. The user will receive a welcome email (once SMTP is configured — see Step 5).

Repeat for each module that needs a dedicated administrator.

---

## Step 4 — Invite Regular Users

1. Go to **Admin → Users & Roles → Invite User**.
2. Enter the user's email and select their default **Role: User**.
3. Assign them to one or more modules they need access to.
4. Click **Send Invite**. They receive an email with a set-password link (valid for 24 hours).

> **Bulk import:** You can also upload a CSV (`email, full_name, role, modules`) via **Admin → Users & Roles → Import CSV**.

---

## Step 5 — Configure Email (SMTP)

Without SMTP, password-reset and invite emails will silently fail.

1. Go to **Admin → System Settings → Email**.
2. Enter your SMTP details:
   - **Host:** your SMTP server (e.g. `mail.yourcompany.com` or `urban-vibes-dynamics-stalwart` if using the bundled Stalwart mail server)
   - **Port:** `587` (STARTTLS) or `465` (SSL)
   - **Username / Password:** your mail account credentials
   - **From Address:** e.g. `noreply@yourcompany.com`
3. Click **Test Email** to send a verification message to your own address.
4. Click **Save**.

---

## Step 6 — Verify All Modules Are Accessible

Go to **Admin → Module Settings**. You will see a card for each of the 18 modules. Ensure every module you are licensed to use is toggled **On**. Disabled modules are hidden from the sidebar for all users.

Click into any module card to configure its specific settings — default currency, fiscal year start, leave policy defaults, and so on.

---

## You Are Ready

At this point your system has:
- A Super Admin account with a secure password
- App Admins scoped to their respective modules
- Regular users invited and assigned
- Email confirmed working
- All required modules enabled

Next step: hand the module-specific quickstart guides to each App Admin so they can finish their own configuration.
