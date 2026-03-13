---
title: Email Configuration (SMTP & IMAP)
slug: integr-smtp-imap
category: integrations
article_type: guide
module: mail
tags: [smtp, imap, email, stalwart, configuration, mail-server]
sort_order: 4
is_pinned: false
excerpt: Configure Urban ERP's built-in Stalwart mail server or connect an external SMTP/IMAP provider.
---

# Email Configuration (SMTP & IMAP)

Urban ERP supports two email modes: a **built-in Stalwart mail server** (fully self-hosted) or an **external SMTP provider** (Gmail, Outlook, Zoho, etc.).

## Mode 1: Built-in Stalwart (Recommended)

The `urban-erp-stalwart` container handles both sending (SMTP) and receiving (IMAP). No external mail service subscription needed.

### Required DNS Records

Configure these on your domain registrar before going live:

| Record | Value |
|--------|-------|
| MX | `mail.yourdomain.com` priority 10 |
| A | `mail.yourdomain.com` → your server IP |
| SPF | `v=spf1 ip4:YOUR_SERVER_IP ~all` |
| DKIM | Generated in the Stalwart admin UI (Admin → Email → DKIM) |
| DMARC | `v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com` |

### Stalwart Admin UI

Access at `http://yourserver:8082`. Use this to:
- Create mailboxes per user
- Generate DKIM keys
- View delivery logs and bounce reports
- Configure spam filtering rules

## Mode 2: External SMTP

Configure in **Admin → Settings → Email**:

| Setting | Description | Example |
|---------|-------------|---------|
| `SMTP_HOST` | Mail server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | Port — 587 (STARTTLS) or 465 (SSL) | `587` |
| `SMTP_USER` | Authentication username | `noreply@yourcompany.com` |
| `SMTP_PASSWORD` | App password or SMTP password | — |
| `SENDER_EMAIL` | From address on all system emails | `noreply@yourcompany.com` |

> **Note:** For Gmail, use an **App Password** (not your main password). Google blocks basic SMTP auth for regular passwords.

## IMAP Configuration (Mail Module Inbox)

For the Mail module to fetch incoming emails:

| Setting | Value |
|---------|-------|
| `IMAP_HOST` | Your IMAP server |
| `IMAP_PORT` | 993 (SSL) |
| `IMAP_USER` | Email address |
| `IMAP_PASSWORD` | App password |

Urban ERP polls IMAP every 5 minutes for new messages.

## Testing Email Delivery

1. Go to **Admin → Settings → Email → Send Test Email**
2. Enter a recipient address and click Send
3. If not received, check the spam folder and the Stalwart delivery logs

## Email Templates

System emails (invoice notifications, payroll slips, support tickets) use templates in **Admin → Settings → Email Templates**. Each template supports `{{variable}}` placeholders pulled from the related record.

## Deliverability Tips

- Always configure SPF, DKIM, and DMARC before sending bulk emails
- Use a subdomain for transactional email (`mail.yourdomain.com`) to protect the main domain's reputation
- Avoid words like "FREE", "URGENT", "CLICK HERE" in subject lines

> **Tip:** If using Gmail as external SMTP, create an App Password at myaccount.google.com → Security → App Passwords. This is required since Google disabled basic auth for SMTP.
