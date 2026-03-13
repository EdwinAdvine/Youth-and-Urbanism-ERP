---
title: Keyboard Shortcuts & Power Tips
slug: keyboard-shortcuts-power-tips
category: getting-started
article_type: pro_tip
tags: [productivity, shortcuts, keyboard, ai, search]
sort_order: 7
is_pinned: false
excerpt: Speed up your workflow with global shortcuts and hidden productivity features.
---

# Keyboard Shortcuts & Power Tips

Urban Vibes Dynamics is designed to be operated almost entirely from the keyboard once you know the shortcuts. Here is every shortcut and productivity trick worth knowing.

---

## Global Shortcuts (Work Everywhere)

| Shortcut | Action |
|---|---|
| `Cmd+K` (Mac) / `Ctrl+K` (Win) | Open global search |
| `Cmd+Shift+A` | Toggle AI sidebar (Urban Bad AI) |
| `Cmd+/` | Open keyboard shortcut reference overlay |
| `Escape` | Close any open dialog, drawer, or panel |
| `Cmd+S` | Save the current form (works in most edit screens) |

---

## Global Search (Cmd+K)

The search bar is the fastest way to navigate. It searches across:

- **Routes** — type "invoices" to jump to `/finance/invoices`
- **Records** — type a contact name, invoice number, project name, or employee
- **Handbook articles** — type any keyword to surface help content inline

**Power move:** Use search to quick-create records. Type `new invoice`, `new contact`, or `new task` and hit Enter to open the creation form for that record type without navigating first.

---

## Module-Specific Quick-Create Shortcuts

When you are already inside a module, these shortcuts open the creation form without clicking:

| Module | Shortcut | Creates |
|---|---|---|
| Finance | `N` then `I` | New Invoice |
| Finance | `N` then `B` | New Bill |
| CRM | `N` then `C` | New Contact |
| CRM | `N` then `D` | New Deal |
| Projects | `N` then `P` | New Project |
| Projects | `N` then `T` | New Task |
| HR | `N` then `E` | New Employee |
| Calendar | `N` then `V` | New Event |

The `N` prefix activates "new record" mode — you will see a brief mode indicator in the bottom status bar.

---

## Table & List View Shortcuts

When viewing any data table (invoices list, contacts list, etc.):

| Key | Action |
|---|---|
| `J` / `K` | Move selection down / up |
| `Enter` or `Space` | Open selected record |
| `X` | Toggle checkbox on selected row |
| `A` | Select all visible rows |
| `D` | Deselect all |
| `/` | Focus the filter/search bar for this table |

---

## AI Sidebar Tips (Cmd+Shift+A)

The **Urban Bad AI** sidebar is a multi-agent assistant with access to all your modules. Get more out of it with these techniques:

- **Be specific with context.** Instead of "show me revenue", say "show me total revenue for March 2026 broken down by customer segment". The AI reads your current module and route automatically.
- **Ask it to do things.** "Create an invoice for Acme Ltd for $2,500 — web design services" will draft the invoice for your review before saving.
- **Approval prompts.** When the AI proposes an action that modifies data (creating a record, updating a balance), it will pause and ask for your explicit approval. Read the confirmation carefully before approving.
- **Chained tasks.** "Find all overdue invoices older than 60 days and draft a reminder email for each" is a valid multi-step prompt.

---

## Navigation Tips

- **Breadcrumbs are clickable** — click any segment in the breadcrumb bar to jump back up the hierarchy.
- **Right-click any sidebar item** to pin it to the top of the navigation for quick access.
- **Browser back/forward** works fully — Urban Vibes Dynamics uses real URL routing, so your browser history is always correct.
- **Tabs:** Open records in a new browser tab with `Cmd+Click` on any record link. Multiple records stay synced via the shared React Query cache — changes in one tab reflect in others within seconds.

---

## Offline & Low-Connectivity Tips

- Recent pages are cached — if your connection drops briefly, you can still browse records you have already visited.
- The **Notes** module works fully offline. Changes sync automatically when connection is restored.
- If a form submission fails due to connectivity, Urban Vibes Dynamics stores the draft locally and prompts you to retry when back online.
