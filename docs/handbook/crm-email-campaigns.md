---
title: Email Marketing Campaigns
slug: email-marketing-campaigns
category: crm
article_type: guide
module: crm
tags: [campaigns, email-marketing, segments, open-rate, deliverability]
sort_order: 4
is_pinned: false
excerpt: Create and send email campaigns to contact segments with open/click tracking.
---

# Email Marketing Campaigns

Urban Vibes Dynamics's campaign module lets you send targeted email campaigns to your contact base — newsletters, product announcements, promotional offers, re-engagement emails — all sent through your own Stalwart mail server, with full open and click tracking built in.

## Step 1: Create a Campaign

Navigate to **CRM → Campaigns** and click **New Campaign**.

| Field | Description |
|---|---|
| **Campaign Name** | Internal label for your own reference (not shown to recipients) |
| **Subject Line** | The email subject your recipients will see in their inbox |
| **From Name** | Sender display name, e.g. "Amina from Savanna Tech" |
| **From Email** | Sender email address — must be a configured address on your domain |
| **Reply-To** | Where replies go — can differ from the From address |

## Step 2: Write the Email Body

Urban Vibes Dynamics includes a rich text email editor. You can:

- Format text (bold, italic, headings, bullet lists)
- Add images (uploaded to your Drive or external URL)
- Insert hyperlinks
- Use **merge tags** to personalise: `{{contact.first_name}}`, `{{contact.company}}`, `{{contact.city}}`

**Example subject line using personalisation:**
`Hi {{contact.first_name}}, our Q2 pricing update for {{contact.company}}`

Keep your emails concise. Studies consistently show that emails under 200 words have higher click rates. Lead with the most important information — assume your reader will skim.

## Step 3: Select Your Recipient Segment

Click **Add Recipients** to define who receives this campaign.

| Segment Type | How It Works |
|---|---|
| **All Contacts** | Every contact in your CRM with a valid email |
| **By Tag** | E.g. all contacts tagged "Wholesale" or "Nairobi" |
| **Custom Filter** | Build a filter by any field — e.g. contacts with no purchase in 6 months, or contacts in a specific industry |
| **Manual List** | Hand-pick specific contacts |

The segment builder shows you a **contact count preview** before you proceed, so you know exactly how many people will receive the email.

> **Important:** Urban Vibes Dynamics automatically excludes contacts who have unsubscribed or have invalid/bounced email addresses. You cannot override this — it is required for email compliance.

## Step 4: Send or Schedule

- **Send Now** — The campaign is queued and begins sending immediately through Stalwart. Large campaigns are sent in batches to avoid overwhelming the mail server.
- **Schedule** — Pick a future date and time. Scheduled campaigns appear in your Campaigns list as Scheduled and can be edited or cancelled before they go out.

**Best time to send in Kenya:** Tuesday to Thursday between 8am and 10am typically sees the highest open rates for B2B email. Avoid Friday afternoons and Monday mornings.

## Step 5: Track Performance

After sending, open the campaign and click the **Analytics** tab. You will see:

| Metric | What It Measures |
|---|---|
| **Sent** | Total emails successfully dispatched |
| **Delivered** | Emails confirmed received by the recipient's mail server |
| **Opened** | Recipients who opened the email (tracked via a pixel) |
| **Open Rate** | Opened ÷ Delivered × 100 |
| **Clicks** | Links clicked within the email |
| **Click Rate** | Clicks ÷ Opened × 100 |
| **Unsubscribed** | Recipients who clicked "unsubscribe" |
| **Bounced** | Emails that failed to deliver (hard bounce = bad address) |

Industry benchmarks for Kenya B2B email:
- Good open rate: **20–30%**
- Good click rate: **3–7%**

If your open rate is below 15%, the issue is likely the subject line or sender reputation. If click rate is low but open rate is good, the email content or call-to-action needs work.

## Deliverability Best Practices

1. **Use a proper domain email.** Never send campaigns from a Gmail or Outlook personal address. Your Stalwart server sends from your own domain (e.g. marketing@yourcompany.co.ke).
2. **Keep your list clean.** Remove hard bounces after every campaign. Urban Vibes Dynamics does this automatically.
3. **Do not buy email lists.** Purchased lists have low engagement and high spam complaint rates, which damages your domain's sending reputation.
4. **Include a plain-text version.** Urban Vibes Dynamics generates this automatically from your HTML content.
5. **Honour unsubscribes immediately.** Urban Vibes Dynamics handles this automatically — unsubscribed contacts are never sent future campaigns.
6. **Warm up a new domain gradually.** If your domain is new, start with small batches (100–200 emails per day) before scaling up. Stalwart's rate-limiting settings are configured by your Admin.
