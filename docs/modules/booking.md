# Booking Module

> Appointment scheduling and resource reservation with calendar integration.

## Overview

The Booking module provides appointment booking for services, consultations, and resource reservations. Integrates with the Calendar module for availability management.

---

## Features

- Appointment booking with service selection
- Provider availability management
- Customer self-booking via public booking page
- Confirmation and reminder emails
- Buffer time between appointments
- Booking cancellation and rescheduling
- Calendar integration (appointments appear in provider's calendar)

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/booking.py` | Core booking CRUD |
| `backend/app/models/booking.py` | Booking SQLAlchemy models |

---

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Calendar | Appointments create calendar events for the provider |
| Mail | Confirmation and reminder emails sent automatically |
| CRM | Booking customer linked to CRM Contact |
