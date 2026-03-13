# Forms Module

> Drag-and-drop form builder with response collection, analytics, and CRM integration.

## Overview

The Forms module provides a visual form builder for creating surveys, contact forms, registration forms, and any data collection form. Submissions are stored in the database and can auto-create CRM leads.

---

## Features

- Drag-and-drop form builder
- Field types: text, email, phone, number, date, dropdown, checkbox, radio, file upload, signature
- Conditional logic (show/hide fields based on answers)
- Public form sharing with unique URL
- Response management and export (CSV)
- Response analytics (completion rate, time-to-complete)
- Form embedding (iframe for websites)
- Auto-create CRM Lead on form submission
- Email notifications on new submissions
- Form templates for common use cases

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/forms.py` | Core: form CRUD, fields, responses |
| `backend/app/api/v1/forms_ext.py` | Extended: analytics, conditional logic |
| `backend/app/models/forms.py` | Forms SQLAlchemy models |

---

## Events Published

| Event | Trigger | Handled By |
|-------|---------|------------|
| `form.response.submitted` | Form submitted | CRM (auto-create Lead), Mail (notification) |
