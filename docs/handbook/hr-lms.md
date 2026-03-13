---
title: "Learning Management System (LMS)"
slug: learning-management-system
category: hr-payroll
article_type: guide
module: hr
tags: [LMS, training, courses, certificates, e-learning]
sort_order: 7
is_pinned: false
excerpt: "Create training courses, track employee learning progress, and issue certificates."
---

# Learning Management System (LMS)

Urban Vibes Dynamics's LMS lets your HR team build internal training courses, enrol employees, track completion, and issue certificates — all within the same platform your team already uses daily. No separate LMS subscription required.

## Navigating to the LMS

Go to **HR → Learning**. The page has two views:

- **Admin View** (HR Admins and Super Admins) — create and manage courses, view all enrolments, generate reports.
- **Employee View** (all users) — see enrolled courses, continue learning, view completed certificates.

## Creating a Course

1. Go to **HR → Learning → Courses → New Course**.
2. Fill in the course header:
   - **Course Title** — e.g., "Fire Safety Awareness" or "Kenya Data Protection Act Overview".
   - **Description** — what the course covers and who should take it.
   - **Category** — Compliance, Technical Skills, Leadership, Soft Skills, or a custom category.
   - **Training Type** — select **Mandatory** or **Optional**. Mandatory courses are flagged prominently in employees' learning dashboards and included in compliance reporting.
   - **Estimated Duration** — total learning time in hours/minutes (e.g., 2h 30m).
   - **Validity Period** — if the training needs to be refreshed periodically (e.g., every 12 months for safety training), set the re-enrolment interval here.
3. Click **Save & Add Modules**.

## Building Course Modules

Courses are made up of one or more modules. Each module is a self-contained learning unit.

1. Click **Add Module**.
2. Give the module a title (e.g., "Module 1: Understanding Fire Hazards").
3. Add content:
   - **Text / Rich Content** — write or paste formatted text, embed images or tables.
   - **Video** — upload a video file (MP4, max 500 MB) or paste a URL (YouTube/Vimeo).
   - **PDF Document** — upload a PDF for the employee to read in-browser.
   - **Slide Deck** — upload a PowerPoint or use ONLYOFFICE to build slides directly.
4. Toggle **Mark as Complete** behaviour: manually (employee clicks "Mark Complete") or automatically (after all content is viewed).
5. Repeat for each module. Drag modules to reorder them.

## Adding a Quiz

Quizzes are optional but recommended for compliance and technical courses to verify understanding.

1. Open the last module (or add a standalone Quiz module) and click **Add Quiz**.
2. Add questions:
   - **Multiple Choice** — one correct answer from 4 options.
   - **True / False** — simple binary question.
   - **Short Answer** — employee types a response (manually reviewed by HR).
3. Set the **Pass Mark** (e.g., 70%). Employees who score below the pass mark can be allowed to retake (configure max retakes).
4. Optionally, toggle **Show Correct Answers** on completion — useful for learning reinforcement, but disable for strict compliance assessments.

## Enrolling Employees

### Individual Enrolment

1. Open a course and go to the **Enrolments** tab.
2. Click **Enrol Employee**, search by name or employee ID, and confirm.

### Department / Group Enrolment

1. Click **Bulk Enrol**.
2. Select one or more departments (e.g., All Finance Staff, All Field Agents).
3. Confirm. All active employees in those departments are enrolled immediately and notified by email.

Enrolled employees see the course listed in **HR → Learning → My Courses** with a progress bar.

## Tracking Completion

HR Admins can monitor learning progress at any time:

- **Per Course**: HR → Learning → [Course] → Enrolments tab. Shows each employee's completion percentage, quiz score, and last activity date.
- **Per Employee**: HR → Employees → [Employee] → Learning tab. Shows all courses, status, and certificates earned.
- **Compliance Report**: HR → Learning → Reports → Compliance. Lists all mandatory courses with a completion rate per course and flags employees who are overdue.

## Certificate Generation

When an employee completes all modules and passes the quiz (if applicable), Urban Vibes Dynamics automatically:

1. Generates a personalised **Certificate of Completion** (PDF) with the employee's name, course title, completion date, and a unique certificate number.
2. Emails the certificate to the employee.
3. Stores the certificate on the employee's profile under **HR → Employees → [Employee] → Learning**.

HR Admins can customise the certificate template (add company logo, signature fields) under **HR → Settings → Certificate Template**.

> **Tip:** Use the mandatory + validity period combination for compliance-critical training. Setting "Fire Safety" as Mandatory with a 12-month validity means Urban Vibes Dynamics will automatically re-enrol employees and alert HR if anyone's certification is expiring — keeping your compliance record clean without manual tracking.
