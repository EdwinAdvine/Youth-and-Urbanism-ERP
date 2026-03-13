---
title: CRM Workflow Automation
slug: crm-workflow-automation
category: crm
article_type: guide
module: crm
tags: [automation, workflows, rules, triggers, actions]
sort_order: 5
is_pinned: false
excerpt: Automate repetitive CRM tasks with if-then workflow rules triggered by events.
---

# CRM Workflow Automation

Workflow automation lets you define rules that Urban Vibes Dynamics executes automatically when specific events happen in your CRM. Instead of manually assigning leads, sending follow-up emails, or creating tasks, you set the rule once and the system handles it every time.

## Navigating to Automation

Go to **CRM → Automation**. You will see a list of all existing workflow rules and their on/off status. Click **New Rule** to create one.

## Anatomy of a Workflow Rule

Every rule has three parts:

```
WHEN [Trigger] AND [Conditions] → THEN [Actions]
```

**Example:**
> WHEN a lead's AI score changes AND the score is greater than 80 → THEN assign to the Senior Sales Rep AND send an internal notification

## Step 1: Name Your Rule

Give the rule a clear, descriptive name. Something like *"High-Score Lead → Senior Rep"* or *"Stage: Won → Create Project"*. A good name tells anyone reading it exactly what it does without opening it.

## Trigger Types

Triggers are the events that start the workflow:

| Trigger | When It Fires |
|---|---|
| **Lead Created** | A new lead is added (manually, via form, or email) |
| **Lead Score Changed** | The AI score is recalculated and crosses a threshold |
| **Lead Status Changed** | Lead moves to a new status (e.g. Qualified, Disqualified) |
| **Deal Stage Changed** | A deal moves between pipeline stages |
| **Deal Created** | A new deal is created |
| **Contact Created** | A new contact is added |
| **Deal Inactivity** | A deal has had no updates for N days |
| **Tag Added** | A specific tag is added to a lead or contact |
| **Form Submitted** | A specific web form receives a submission |
| **Campaign Opened / Clicked** | A contact opens or clicks in a specific campaign |

## Conditions (Filters)

After selecting a trigger, add conditions to narrow when the rule fires. Without conditions, the rule fires on every occurrence of the trigger.

**Example conditions:**

| Field | Operator | Value |
|---|---|---|
| Lead Score | greater than | 80 |
| Lead Source | equals | "Website Form" |
| Assigned Rep | is empty | — |
| Deal Value | greater than | 500,000 |
| Contact Tag | contains | "VIP" |

You can combine conditions with **AND** (all must be true) or **OR** (any one must be true).

## Action Types

Actions are what the rule does when triggered and conditions are met:

| Action | What Happens |
|---|---|
| **Assign to User** | Reassigns the lead or deal to a specific rep or round-robins across a team |
| **Send Email to Contact** | Sends an automated email from a template to the lead/contact |
| **Send Internal Notification** | Notifies a team member in-app |
| **Add Tag** | Adds a tag to the lead or contact |
| **Remove Tag** | Removes a tag |
| **Create Task** | Creates a task assigned to a rep with a due date |
| **Move Deal Stage** | Moves a deal to a specified stage |
| **Send Campaign** | Adds the contact to a drip campaign |
| **Create Project** | Creates a linked project (via Projects module integration) |
| **Webhook** | Sends a POST request to an external URL (for custom integrations) |

You can chain multiple actions in one rule — they execute in order.

## Practical Examples

### Example 1: Auto-Assign Hot Leads

- **Trigger:** Lead Score Changed
- **Condition:** Score > 80
- **Action 1:** Assign to Senior Sales Rep (round-robin across the senior team)
- **Action 2:** Create Task — "Call {{lead.first_name}} within 24 hours" — assigned to the rep, due tomorrow
- **Action 3:** Send internal notification to Sales Manager

### Example 2: Re-Engage Cold Leads

- **Trigger:** Lead Inactivity
- **Condition:** No activity in 14 days AND Status = Contacted
- **Action 1:** Send Email to Contact using template "Checking In"
- **Action 2:** Create Task — "Follow up if no reply in 3 days"

### Example 3: Welcome New VIP Contacts

- **Trigger:** Tag Added
- **Condition:** Tag = "VIP"
- **Action 1:** Send Email using template "VIP Welcome"
- **Action 2:** Assign to dedicated Key Account Manager
- **Action 3:** Add tag "Key Account"

### Example 4: Deal Won → Kick Off Delivery

- **Trigger:** Deal Stage Changed
- **Condition:** New Stage = Won
- **Action 1:** Create Project (linked to the deal, with the deal name as the project name)
- **Action 2:** Send internal notification to the delivery team Slack equivalent (in-app notification)
- **Action 3:** Send Email to Contact — "Your project is starting, here's what to expect"

## Testing a Workflow

Before activating a rule on live data, click **Test Rule**. This lets you run the rule against a sample lead or deal and see exactly what actions would have fired and why — without actually sending emails or making changes.

Once you are satisfied the rule behaves correctly, toggle it **Active**.

## Managing Rules

- Rules can be **paused** without deleting them — useful for seasonal campaigns
- The **Execution Log** on each rule shows every time it has fired, which contact or deal triggered it, and whether each action succeeded or failed
- If an action fails (e.g. a template is missing), the log shows the error so you can fix it

> **Tip:** Start with a small number of targeted rules and expand gradually. Over-automating too quickly can lead to contacts receiving too many emails or leads being assigned to the wrong people. Review your rule logs weekly in the first month.
