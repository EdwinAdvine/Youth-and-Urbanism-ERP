---
title: Setting Up Your Mail Account
slug: setting-up-mail-account
category: communication
article_type: guide
module: mail
tags: [mail, imap, smtp, email, setup]
sort_order: 1
is_pinned: false
excerpt: Connect your email account (IMAP/SMTP) to send and receive mail inside Urban Vibes Dynamics.
---

# Setting Up Your Mail Account

Urban Vibes Dynamics has a built-in mail client that lets you send, receive, and manage email without leaving the platform. You can connect any standard email account — including Google Workspace, Microsoft 365, Zoho Mail, or a business hosting provider — as long as it supports IMAP and SMTP.

## Before You Begin

You will need the following from your email provider or IT administrator:

- **IMAP server hostname** (e.g., `mail.yourdomain.co.ke`)
- **SMTP server hostname** (often the same host)
- **Your email address and password** (or an app-specific password if two-factor authentication is enabled)

## Adding Your Account

1. Open the **Mail** module from the left sidebar.
2. Click **Settings** (gear icon, top-right), then select **Add Account**.
3. Fill in the incoming mail (IMAP) settings:
   - **Host**: your IMAP server address
   - **Port**: `993` (SSL/TLS — recommended) or `143` (STARTTLS)
   - **Encryption**: select **SSL/TLS** for port 993
   - **Username**: your full email address
   - **Password**: your email password or app password
4. Fill in the outgoing mail (SMTP) settings:
   - **Host**: your SMTP server address
   - **Port**: `587` (STARTTLS — recommended) or `465` (SSL)
   - **Encryption**: select **STARTTLS** for port 587
   - **Username** and **Password**: same credentials as IMAP
5. Click **Test Connection**. Urban Vibes Dynamics will verify both IMAP and SMTP connectivity. If the test passes, click **Save Account**.

## Sending and Receiving Mail

Once connected, Urban Vibes Dynamics syncs your inbox automatically. New messages appear in **Mail → Inbox** in real time. Use the **Compose** button (top-left) to write a new email — select the sender account from the **From** dropdown if you have multiple accounts connected.

You can organise mail using folders (mirrored from your IMAP server), apply labels, and flag messages for follow-up. The search bar supports full-text search across all synced messages.

## CRM Integration: Creating Contacts from Unknown Senders

One of the most useful features is the CRM link. When you receive an email from someone who is not yet in your CRM:

1. Open the email.
2. Click **Add to CRM** in the message toolbar.
3. Urban Vibes Dynamics pre-fills a new CRM contact form with the sender's name and email address.
4. Optionally attach the email thread to a CRM deal or activity log.
5. Click **Save Contact** — the contact is immediately available in the CRM module.

This eliminates the need to copy email addresses manually and ensures every customer interaction is recorded in one place.

## Tips

- If your email provider requires an **app password** (common with Google and Microsoft accounts that have two-factor authentication), generate that in your email provider's security settings and use it here instead of your regular password.
- You can connect **multiple accounts** — for example, a personal business address and a shared `support@` address. Each account appears as a separate inbox in the sidebar.
- Sent mail, drafts, and trash are synced back to your IMAP server, so messages sent from Urban Vibes Dynamics also appear in your email client on your phone or desktop.
