---
title: Recruitment & Job Openings
slug: hr-recruitment
category: hr-payroll
article_type: guide
module: hr
tags: [recruitment, jobs, hiring, ats, candidates]
sort_order: 9
is_pinned: false
excerpt: Post job openings, manage applications, and move candidates through the hiring pipeline.
---

# Recruitment & Job Openings

Urban Vibes Dynamics's built-in ATS (Applicant Tracking System) lets you post job openings, receive applications, score candidates, and convert successful hires directly into employee records — all without a separate tool.

---

## 1. Creating a Job Opening

Navigate to **HR → Recruitment → New Job**.

Fill in the following fields:

| Field | Description |
|---|---|
| Job Title | e.g., Senior Accountant |
| Department | Links the role to an existing HR department |
| Headcount | How many positions are open |
| Application Deadline | Last date to accept applications |
| Job Description | Full role overview (supports rich text) |
| Requirements | Skills, qualifications, experience level |
| Hiring Manager | The person responsible for final decisions |

Save as **Draft** until you are ready to publish.

---

## 2. Publishing Options

When publishing a job opening, choose the visibility:

- **Internal Only** — visible only to existing employees (for internal transfers or promotions). Appears on the internal HR notice board.
- **Public** — also listed on your Careers page if an E-Commerce storefront is active. Urban Vibes Dynamics auto-generates a `/careers` route on your storefront for all public openings.

To publish: open the job → click **Publish**. To unpublish, set status back to **Draft** or **Closed**.

---

## 3. The Hiring Pipeline

Every job opening has a Kanban-style pipeline with the following default stages:

```
Applied → Phone Screen → Interview → Assessment → Offer → Hired / Rejected
```

You can rename stages or add custom stages per role under **HR → Recruitment → Pipeline Settings**. Each stage can have a colour and an optional SLA (e.g., "move out of Phone Screen within 3 days").

---

## 4. Receiving Applications

Applications can arrive in two ways:

- **Manual add** — HR staff adds a candidate directly: open the job → **Candidates** tab → **Add Candidate** (name, email, phone, CV upload).
- **Email-to-apply** — Urban Vibes Dynamics generates a unique application email address per job (e.g., `jobs+snr-accountant@yourdomain.com`). Emails sent to that address automatically create candidate cards with the email body as the cover letter and any attachment as the CV. Configure the inbound address under **HR → Recruitment → Email Settings**.

---

## 5. Candidate Cards

Each candidate has a card with:

- **Profile** — name, contact details, source (how they applied)
- **CV / Attachments** — upload or view submitted documents
- **Notes** — internal notes visible to the hiring team (not the candidate)
- **Interview Scores** — averaged scores from all interviewers
- **Timeline** — all activity on this candidate (emails sent, stage changes, notes)

Click a candidate card to open the full detail view.

---

## 6. Scheduling Interviews

From a candidate card, click **Schedule Interview**.

- Select the interview type (phone, video, in-person)
- Choose interviewers from your team
- Pick date and time — Urban Vibes Dynamics checks interviewer calendar availability in real time
- An event is created in the **Calendar** module and a calendar invite is emailed to the candidate and all interviewers automatically

Interview events appear on the deal/job card and in each interviewer's Calendar feed.

---

## 7. Interview Scorecard

Each job can have a scorecard with rating criteria tailored to the role. Set up criteria under the job's **Scorecard** tab:

- Criteria examples: Communication, Technical Skills, Culture Fit, Problem Solving
- Each criterion is rated 1–5 by each interviewer
- Urban Vibes Dynamics averages scores across all interviewers and surfaces a final score on the candidate card
- Interviewers can add per-criterion comments alongside their ratings

To complete a scorecard after an interview: open the calendar event → **Submit Scorecard**.

> **Tip:** Use the interview scorecard even for informal calls — structured scoring reduces bias and speeds up decisions.

---

## 8. Making an Offer

When a candidate reaches the **Offer** stage:

1. Open the candidate card → **Generate Offer Letter**
2. Select an offer letter template or write one from scratch
3. Use available variables in your template:
   - `{{candidate.name}}` — full name
   - `{{position}}` — job title
   - `{{salary}}` — agreed salary
   - `{{start_date}}` — proposed start date
   - `{{department}}` — department name
4. Preview the letter, then click **Send to Candidate** — delivered via Mail module
5. Track offer status: Sent → Accepted / Declined

---

## 9. Converting to Employee

When a candidate's status is set to **Hired**:

- Urban Vibes Dynamics prompts you to create an employee record
- Candidate data (name, email, phone, department, job title, start date, salary) pre-populates the HR employee form
- Review and confirm the record — the employee is now active in HR & Payroll
- The job opening headcount counter decrements automatically; if all positions are filled, the job is automatically closed

The candidate card is preserved in the recruitment history for future reference.

---

## Quick Reference

| Action | Path |
|---|---|
| New job opening | HR → Recruitment → New Job |
| View all candidates | HR → Recruitment → Candidates |
| Pipeline settings | HR → Recruitment → Pipeline Settings |
| Email-to-apply config | HR → Recruitment → Email Settings |
| Offer letter templates | HR → Recruitment → Templates |
