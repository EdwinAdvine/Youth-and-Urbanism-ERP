# Comment & Documentation Standards — Urban Vibes Dynamics

This document defines the inline comment and docstring standards for the entire Urban Vibes Dynamics codebase. All contributors must follow these conventions to ensure consistency, readability, and self-documentation.

**Gold-standard reference:** `backend/app/core/events.py` — exemplary module-level docstring with usage examples and registered event catalog.

---

## 1. Python (Backend)

### 1.1 Module-Level Docstrings

Every `.py` file MUST have a module-level docstring as the very first statement. It should explain:

- **What** the file does (one-liner summary)
- **Which module** it belongs to (e.g., Finance, CRM, HR)
- **Business context** — why this file exists, not just what it contains
- **Key integrations** — cross-module dependencies, event bus channels

```python
"""Finance API — Invoicing, payments, and journal entry management.

Handles the core accounting workflow: creating invoices, recording payments,
and generating double-entry journal entries. Integrates with:
- Inventory (stock valuation → balance sheet)
- E-Commerce (order.created → auto-generate invoice)
- POS (sale.completed → journal entry)

Permissions: Requires 'finance' app access. Most endpoints need
finance.invoice.* or finance.payment.* permissions.
"""
```

### 1.2 Function/Endpoint Docstrings

Every public function (especially FastAPI endpoints) MUST have a docstring covering:

- **Purpose** — one-line summary
- **Business Rules** — domain logic, constraints, edge cases
- **Args** — parameter descriptions (skip obvious ones like `db: DBSession`)
- **Returns** — what the response contains
- **Raises** — HTTP exceptions with conditions

```python
async def create_invoice(
    payload: InvoiceCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Create a new invoice and optionally generate a journal entry.

    Business Rules:
    - Invoice number auto-generated from sequence per fiscal year.
    - Draft invoices do NOT create journal entries until posted.
    - Tax lines calculated from TaxRate configuration.
    - If customer has a default currency, amounts are converted at today's rate.

    Args:
        payload: Invoice data including line items, due date, and customer.

    Returns:
        Created invoice dict with computed totals and line items.

    Raises:
        HTTPException 400: If line items are empty or debit/credit don't balance.
        HTTPException 403: If user lacks finance.invoice.create permission.
        HTTPException 404: If referenced customer or account doesn't exist.
    """
```

### 1.3 Class Docstrings (Models)

Every SQLAlchemy model class MUST have a docstring explaining:

- **What entity** it represents in the business domain
- **Key relationships** — what it connects to
- **Non-obvious columns** — anything that isn't self-explanatory

```python
class Invoice(Base):
    """A customer invoice representing money owed for goods or services.

    Lifecycle: draft → sent → partial → paid → void
    Each posted invoice generates a corresponding JournalEntry.
    Linked to Customer (via customer_id) and InvoiceLineItem (one-to-many).

    Notes:
        - total_amount is computed from line items, not stored directly.
        - currency_code defaults to the company's base currency.
    """
```

### 1.4 Inline Comments

Use inline comments for:

- **Non-obvious business logic** — tax calculations, scoring algorithms, approval thresholds
- **Workarounds** — with a link to the issue or reason
- **Critical ordering** — when statement order matters

```python
# Calculate tax: Kenya VAT is 16%, applied to taxable line items only
tax_amount = sum(line.amount * tax_rate for line in taxable_lines)

# asyncpg requires uuid.UUID objects — never raw strings
user_id = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
```

Do NOT add comments that merely restate the code:

```python
# BAD — restates the code
total = price * quantity  # multiply price by quantity

# GOOD — explains business context
total = price * quantity  # before discount and tax adjustments
```

### 1.5 Section Dividers

Use the established divider pattern for organizing large files:

```python
# ── Schemas ────────────────────────────────────────────────────────────────
# ── CRUD Endpoints ─────────────────────────────────────────────────────────
# ── Reports ────────────────────────────────────────────────────────────────
```

---

## 2. TypeScript / React (Frontend)

### 2.1 File-Level JSDoc

Every `.tsx` and `.ts` file SHOULD have a file-level JSDoc block:

```typescript
/**
 * InvoicesPage — Lists, filters, and manages customer invoices.
 *
 * Part of the Finance module. Supports bulk actions (send, void, export PDF)
 * and real-time status filtering (draft, sent, paid, overdue).
 *
 * Route: /finance/invoices
 * Permissions: finance app access required
 */
```

### 2.2 Component JSDoc

Every exported React component MUST have a JSDoc block:

```typescript
/**
 * Renders a single invoice row in the invoices table.
 * Handles inline status updates and quick-action menu (send, void, duplicate).
 *
 * @param invoice - The invoice data object
 * @param onStatusChange - Callback when invoice status is updated
 */
export function InvoiceRow({ invoice, onStatusChange }: InvoiceRowProps) {
```

### 2.3 API Hook Documentation

Every TanStack Query hook MUST document what it fetches/mutates and cache behavior:

```typescript
/**
 * Fetches paginated invoices with optional filters.
 * Cache key: ['invoices', filters, page]. Auto-invalidated on invoice mutations.
 *
 * @param filters - Status, date range, customer ID filters
 * @param page - Current page (1-indexed, 20 items per page)
 */
export function useInvoices(filters: InvoiceFilters, page: number) {
```

### 2.4 Inline Comments

Same rules as Python — explain "why", not "what":

```typescript
// Debounce search input to avoid flooding the API on every keystroke
const debouncedSearch = useDebouncedCallback(handleSearch, 300);

// Finance amounts use 2 decimal places; inventory quantities use 4
const formatter = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 });
```

### 2.5 Section Dividers

Use the established pattern:

```typescript
// ── Helpers ───────────────────────────────────────────────────────────────
// ── State ─────────────────────────────────────────────────────────────────
// ── Render ────────────────────────────────────────────────────────────────
```

---

## 3. Markdown Documentation (`/docs`)

### 3.1 Module Docs Structure

Each `docs/modules/{module}.md` file MUST follow this structure:

```markdown
# {Module Name}

> One-line description of the module's purpose.

## Overview
What this module does, who uses it, and how it fits into the ERP.

## Features
Bulleted list of all capabilities.

## Architecture
Key files, data flow, and integration points.

## Data Models
Table of models with key fields and relationships.

## API Endpoints
Summary table (auto-generated docs in docs/api/ for full details).

## Workflows
Step-by-step business processes (e.g., Invoice lifecycle: draft → sent → paid).

## Cross-Module Integrations
How this module connects to others via events, links, or shared data.

## Configuration
Relevant env vars and settings.

## Known Limitations
Current constraints and planned improvements.
```

---

## 4. Changelog Entries

Follow the [Keep a Changelog](https://keepachangelog.com) format. Every PR that changes source code must update `CHANGELOG.md` under the `[Unreleased]` section.

Categories: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`

```markdown
## [Unreleased]

### Added
- Finance: Multi-currency invoice support with automatic rate conversion

### Fixed
- CRM: Pipeline drag-and-drop not updating deal stage on mobile
```

---

## 5. Coverage Targets

| Area | Minimum | Target |
|------|---------|--------|
| Backend module-level docstrings | 100% | 100% |
| Backend function docstrings | 80% | 90%+ |
| Frontend file-level JSDoc | 50% | 70%+ |
| Frontend component JSDoc | 50% | 70%+ |
| API hook documentation | 90% | 100% |

Measured by `scripts/doc-coverage.py`. CI enforces minimums on every PR.
