"""Seed all ERP module tables with realistic demo data.

Uses raw SQL INSERT matching the actual PostgreSQL column names.
Run with: docker compose exec -w /app backend python3 -m scripts.seed_all
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text

# ── Helpers ────────────────────────────────────────────────────────────────────

def uid() -> uuid.UUID:
    return uuid.uuid4()

def today() -> date:
    return date.today()

def now() -> datetime:
    return datetime.now(timezone.utc)

# ── User IDs (must exist in users table) ──────────────────────────────────────

SUPER_ADMIN = uuid.UUID("a0bb2505-ae1b-4c86-a9a8-979ea586e1f8")
FINANCE_ADMIN = uuid.UUID("a34ea68e-8a9d-426d-ab3a-4c12ba46e45d")
USER_001 = uuid.UUID("135beeaa-8e6e-4a36-a767-8905dd043a9e")


async def seed():
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        r = await db.execute(text("SELECT COUNT(*) FROM finance_accounts"))
        if r.scalar() > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding all modules...")

        # ══════════════════════════════════════════════════════════════════
        # FINANCE
        # ══════════════════════════════════════════════════════════════════

        # Accounts (Chart of Accounts)
        # DB cols: id, code, name, account_type, currency, balance, is_active, description, created_at, updated_at
        acct_cash = uid()
        acct_bank = uid()
        acct_ar = uid()
        acct_ap = uid()
        acct_revenue = uid()
        acct_cogs = uid()
        acct_salary = uid()
        acct_rent = uid()
        acct_equity = uid()
        acct_inventory = uid()
        acct_fixed = uid()
        acct_tax_payable = uid()

        accounts = [
            (acct_cash, "1000", "Cash", "asset", "USD", Decimal("25000.00")),
            (acct_bank, "1010", "Bank Account", "asset", "USD", Decimal("150000.00")),
            (acct_ar, "1200", "Accounts Receivable", "asset", "USD", Decimal("42000.00")),
            (acct_inventory, "1300", "Inventory", "asset", "USD", Decimal("85000.00")),
            (acct_fixed, "1500", "Fixed Assets", "asset", "USD", Decimal("120000.00")),
            (acct_ap, "2000", "Accounts Payable", "liability", "USD", Decimal("28000.00")),
            (acct_tax_payable, "2100", "Tax Payable", "liability", "USD", Decimal("5600.00")),
            (acct_equity, "3000", "Owner Equity", "equity", "USD", Decimal("300000.00")),
            (acct_revenue, "4000", "Sales Revenue", "revenue", "USD", Decimal("185000.00")),
            (acct_cogs, "5000", "Cost of Goods Sold", "expense", "USD", Decimal("78000.00")),
            (acct_salary, "5100", "Salaries & Wages", "expense", "USD", Decimal("95000.00")),
            (acct_rent, "5200", "Rent & Utilities", "expense", "USD", Decimal("18000.00")),
        ]
        for a_id, code, name, atype, currency, balance in accounts:
            await db.execute(text("""
                INSERT INTO finance_accounts (id, code, name, account_type, currency, balance, is_active, created_at, updated_at)
                VALUES (:id, :code, :name, :type, :currency, :balance, true, now(), now())
            """), {"id": a_id, "code": code, "name": name, "type": atype, "currency": currency, "balance": balance})

        # Tax Rates — DB cols: id, name, rate, is_default, is_active, created_at, updated_at
        for i, (name, rate) in enumerate([("Standard VAT", 16.0), ("Reduced VAT", 8.0), ("Zero-Rated", 0.0), ("Withholding Tax", 5.0)]):
            await db.execute(text("""
                INSERT INTO finance_tax_rates (id, name, rate, is_default, is_active, created_at, updated_at)
                VALUES (:id, :name, :rate, :is_default, true, now(), now())
            """), {"id": uid(), "name": name, "rate": rate, "is_default": (i == 0)})

        # Currencies — DB cols: id, code, name, symbol, exchange_rate, is_base, last_updated, created_at, updated_at
        for code, name, symbol, rate, is_base in [("USD", "US Dollar", "$", 1.0, True), ("EUR", "Euro", "€", 0.92, False), ("GBP", "British Pound", "£", 0.79, False), ("KES", "Kenyan Shilling", "KSh", 129.50, False)]:
            await db.execute(text("""
                INSERT INTO finance_currencies (id, code, name, symbol, exchange_rate, is_base, last_updated, created_at, updated_at)
                VALUES (:id, :code, :name, :symbol, :rate, :is_base, now(), now(), now())
            """), {"id": uid(), "code": code, "name": name, "symbol": symbol, "rate": rate, "is_base": is_base})

        # Invoices — DB cols: id, invoice_number, invoice_type, status, customer_name, customer_email, issue_date, due_date, subtotal, tax_amount, total, currency, notes, items, owner_id, created_at, updated_at
        inv_ids = []
        customers = [
            ("Acme Corp", "billing@acme.com", 12500.00),
            ("TechStart Inc", "accounts@techstart.io", 8750.00),
            ("GlobalTrade Ltd", "finance@globaltrade.co", 21000.00),
            ("Metro Services", "pay@metroservices.com", 4200.00),
            ("Summit Holdings", "ap@summitholdings.com", 15800.00),
        ]
        for i, (cname, cemail, total) in enumerate(customers):
            inv_id = uid()
            inv_ids.append(inv_id)
            inv_status = ["paid", "sent", "draft", "overdue", "sent"][i]
            issue = today() - timedelta(days=30 - i * 5)
            due = issue + timedelta(days=30)
            subtotal = round(total / 1.16, 2)
            tax = round(total - subtotal, 2)
            items_json = json.dumps([{"description": "Professional Services", "quantity": 1, "unit_price": float(subtotal)}])
            await db.execute(text("""
                INSERT INTO finance_invoices (id, invoice_number, invoice_type, status, customer_name, customer_email,
                    issue_date, due_date, subtotal, tax_amount, total, currency, items, owner_id, created_at, updated_at)
                VALUES (:id, :num, 'sales', :status, :cname, :cemail, :issue, :due, :sub, :tax, :total, 'USD', CAST(:items AS jsonb), :owner, now(), now())
            """), {"id": inv_id, "num": f"INV-2026-{1001+i}", "status": inv_status, "cname": cname, "cemail": cemail,
                   "issue": issue, "due": due, "sub": subtotal, "tax": tax, "total": total, "items": items_json, "owner": SUPER_ADMIN})

        # Payments — DB cols: id, payment_number, invoice_id, amount, currency, payment_method, payment_date, reference, status, payer_id, created_at, updated_at
        for i, (inv_id, amt) in enumerate([(inv_ids[0], 12500.00), (inv_ids[3], 4200.00)]):
            await db.execute(text("""
                INSERT INTO finance_payments (id, payment_number, invoice_id, amount, currency, payment_method, payment_date, reference, status, payer_id, created_at, updated_at)
                VALUES (:id, :num, :inv, :amt, 'USD', :method, :pdate, :ref, 'completed', :payer, now(), now())
            """), {"id": uid(), "num": f"PAY-2026-{2001+i}", "inv": inv_id, "amt": amt,
                   "method": ["bank_transfer", "card"][i], "pdate": today() - timedelta(days=5+i*3),
                   "ref": f"REF-{3000+i}", "payer": USER_001})

        # Journal Entries — DB cols: id, entry_number, entry_date, description, status, posted_by, metadata_json, created_at, updated_at
        je_id = uid()
        await db.execute(text("""
            INSERT INTO finance_journal_entries (id, entry_number, entry_date, description, status, posted_by, created_at, updated_at)
            VALUES (:id, 'JE-2026-0001', :d, 'Monthly salary accrual', 'posted', :owner, now(), now())
        """), {"id": je_id, "d": today().replace(day=1), "owner": FINANCE_ADMIN})

        # Journal Lines — DB cols: id, journal_entry_id, account_id, debit, credit, description
        await db.execute(text("""
            INSERT INTO finance_journal_lines (id, journal_entry_id, account_id, debit, credit, description) VALUES
            (:id1, :je, :acct_salary, 95000, 0, 'Salary expense'),
            (:id2, :je, :acct_bank, 0, 95000, 'Bank payment')
        """), {"id1": uid(), "id2": uid(), "je": je_id, "acct_salary": acct_salary, "acct_bank": acct_bank})

        # Budgets — DB cols: id, name, fiscal_year, department_id, total_amount, spent_amount, status, owner_id, created_at, updated_at
        budget_id = uid()
        await db.execute(text("""
            INSERT INTO finance_budgets (id, name, fiscal_year, total_amount, spent_amount, status, owner_id, created_at, updated_at)
            VALUES (:id, 'FY 2026 Operating Budget', 2026, 500000, 125000, 'active', :owner, now(), now())
        """), {"id": budget_id, "owner": SUPER_ADMIN})

        # Budget Lines — DB cols: id, budget_id, account_id, allocated, spent, created_at, updated_at
        for acct, planned in [(acct_salary, 380000), (acct_rent, 72000), (acct_cogs, 48000)]:
            await db.execute(text("""
                INSERT INTO finance_budget_lines (id, budget_id, account_id, allocated, spent, created_at, updated_at)
                VALUES (:id, :bid, :acct, :planned, :actual, now(), now())
            """), {"id": uid(), "bid": budget_id, "acct": acct, "planned": planned, "actual": int(planned * 0.25)})

        # Expenses — DB cols: id, description, amount, currency, category, expense_date, receipt_file_id, status, user_id, approver_id, approved_at, rejection_reason, account_id, created_at, updated_at
        expenses = [
            ("Client lunch — Acme Corp", 85.50, "meals", "submitted"),
            ("Uber to airport", 45.00, "travel", "approved"),
            ("Adobe Creative Cloud", 599.88, "software", "reimbursed"),
            ("Office supplies — paper & ink", 124.30, "supplies", "draft"),
            ("Team building dinner", 320.00, "meals", "submitted"),
        ]
        for desc, amt, cat, exp_status in expenses:
            await db.execute(text("""
                INSERT INTO finance_expenses (id, description, amount, currency, category, expense_date, status, user_id, created_at, updated_at)
                VALUES (:id, :desc, :amt, 'USD', :cat, :d, :status, :uid, now(), now())
            """), {"id": uid(), "desc": desc, "amt": amt, "cat": cat, "d": today() - timedelta(days=3), "status": exp_status, "uid": USER_001})

        print("  + Finance seeded (12 accounts, 4 tax rates, 4 currencies, 5 invoices, 2 payments, 1 journal entry, 1 budget, 5 expenses)")

        # ══════════════════════════════════════════════════════════════════
        # HR
        # ══════════════════════════════════════════════════════════════════

        # Create demo users for employees (user_id is unique per employee)
        demo_users = []
        demo_user_emails = [
            "john.kamau@youthandurbanism.org",
            "sarah.wanjiku@youthandurbanism.org",
            "james.ochieng@youthandurbanism.org",
            "grace.muthoni@youthandurbanism.org",
            "david.kiprop@youthandurbanism.org",
            "lucy.akinyi@youthandurbanism.org",
            "peter.njoroge@youthandurbanism.org",
            "mary.nyambura@youthandurbanism.org",
        ]
        demo_user_names = [
            "John Kamau", "Sarah Wanjiku", "James Ochieng", "Grace Muthoni",
            "David Kiprop", "Lucy Akinyi", "Peter Njoroge", "Mary Nyambura",
        ]
        for email, full_name in zip(demo_user_emails, demo_user_names):
            u_id = uid()
            demo_users.append(u_id)
            # password hash for 'demo1234' using bcrypt
            await db.execute(text("""
                INSERT INTO users (id, email, full_name, hashed_password, is_active, is_superadmin, created_at, updated_at)
                VALUES (:id, :email, :name, '$2b$12$qGyqokwDc6b08NHdIbuS1.u3M66VnFqVN6S6IYiSVcL6rw/PGBPa2', true, false, now(), now())
            """), {"id": u_id, "email": email, "name": full_name})

        # Departments — DB cols: id, name, description, head_id, parent_id, is_active, created_at, updated_at
        dept_ids = {}
        for name in ["Engineering", "Finance", "Marketing", "Human Resources", "Operations"]:
            d_id = uid()
            dept_ids[name] = d_id
            await db.execute(text("""
                INSERT INTO hr_departments (id, name, description, is_active, created_at, updated_at)
                VALUES (:id, :name, :desc, true, now(), now())
            """), {"id": d_id, "name": name, "desc": f"{name} department"})

        # Employees — DB cols: id, user_id, employee_number, department_id, job_title, employment_type, hire_date, termination_date, salary, currency, is_active, metadata_json, created_at, updated_at
        employees = [
            ("EMP-001", "Engineering", "Senior Developer", 120000, demo_users[0]),
            ("EMP-002", "Finance", "Accountant", 95000, demo_users[1]),
            ("EMP-003", "Marketing", "Marketing Lead", 105000, demo_users[2]),
            ("EMP-004", "Human Resources", "HR Manager", 110000, demo_users[3]),
            ("EMP-005", "Operations", "Operations Manager", 115000, demo_users[4]),
            ("EMP-006", "Engineering", "Frontend Developer", 90000, demo_users[5]),
            ("EMP-007", "Engineering", "Backend Developer", 95000, demo_users[6]),
            ("EMP-008", "Finance", "Finance Analyst", 85000, demo_users[7]),
        ]
        emp_ids = []
        for emp_num, dept, title, salary, user_id in employees:
            e_id = uid()
            emp_ids.append(e_id)
            await db.execute(text("""
                INSERT INTO hr_employees (id, user_id, employee_number, department_id, job_title, employment_type, hire_date, salary, currency, is_active, created_at, updated_at)
                VALUES (:id, :user_id, :emp_num, :dept, :title, 'full_time', :hire, :salary, 'USD', true, now(), now())
            """), {"id": e_id, "user_id": user_id, "emp_num": emp_num, "dept": dept_ids[dept], "title": title, "hire": today() - timedelta(days=365), "salary": salary})

        # Leave requests — DB cols: id, employee_id, leave_type, start_date, end_date, days, reason, status, approved_by, created_at, updated_at
        for emp, ltype, days in [(emp_ids[0], "annual", 5), (emp_ids[2], "sick", 2), (emp_ids[4], "annual", 10)]:
            start = today() + timedelta(days=14)
            await db.execute(text("""
                INSERT INTO hr_leave_requests (id, employee_id, leave_type, start_date, end_date, days, status, reason, created_at, updated_at)
                VALUES (:id, :emp, :ltype, :start, :end, :days, 'pending', 'Personal time off', now(), now())
            """), {"id": uid(), "emp": emp, "ltype": ltype, "start": start, "end": start + timedelta(days=days-1), "days": days})

        print("  + HR seeded (5 departments, 8 employees, 3 leave requests)")

        # ══════════════════════════════════════════════════════════════════
        # CRM
        # ══════════════════════════════════════════════════════════════════

        # Contacts — DB cols: id, contact_type, first_name, last_name, company_name, email, phone, address, tags, source, owner_id, is_active, metadata_json, created_at, updated_at
        contacts = [
            ("Alice", "Mwangi", "alice@acmecorp.com", "Acme Corp", "+254712345678"),
            ("Bob", "Johnson", "bob@techstart.io", "TechStart Inc", "+14155551234"),
            ("Carol", "Chen", "carol@globaltrade.co", "GlobalTrade Ltd", "+8613912345678"),
            ("Daniel", "Otieno", "daniel@metroservices.com", "Metro Services", "+254723456789"),
            ("Eva", "Schmidt", "eva@summitholdings.com", "Summit Holdings", "+4930123456"),
        ]
        contact_ids = []
        for first, last, email, company, phone in contacts:
            c_id = uid()
            contact_ids.append(c_id)
            await db.execute(text("""
                INSERT INTO crm_contacts (id, contact_type, first_name, last_name, company_name, email, phone, source, owner_id, is_active, created_at, updated_at)
                VALUES (:id, 'customer', :first, :last, :company, :email, :phone, 'website', :owner, true, now(), now())
            """), {"id": c_id, "first": first, "last": last, "company": company, "email": email, "phone": phone, "owner": SUPER_ADMIN})

        # Leads — DB cols: id, title, contact_id, status, source, estimated_value, currency, notes, assigned_to, owner_id, created_at, updated_at
        leads = [
            ("Enterprise License Inquiry", contact_ids[0], 50000),
            ("Custom Integration Project", contact_ids[1], 25000),
            ("Bulk Hardware Order", contact_ids[2], 75000),
        ]
        for title, contact, value in leads:
            await db.execute(text("""
                INSERT INTO crm_leads (id, title, contact_id, status, source, estimated_value, currency, owner_id, created_at, updated_at)
                VALUES (:id, :title, :contact, 'new', 'referral', :val, 'USD', :owner, now(), now())
            """), {"id": uid(), "title": title, "contact": contact, "val": value, "owner": SUPER_ADMIN})

        # Deals — DB cols: id, title, opportunity_id, deal_value, currency, close_date, status, notes, owner_id, created_at, updated_at
        deals = [
            ("Acme Corp — Annual Contract", "negotiation", 120000),
            ("TechStart — Platform License", "proposal", 45000),
            ("Metro Services — Support Plan", "won", 28000),
            ("Summit — Enterprise Rollout", "qualification", 250000),
        ]
        for title, deal_status, value in deals:
            await db.execute(text("""
                INSERT INTO crm_deals (id, title, deal_value, currency, close_date, status, owner_id, created_at, updated_at)
                VALUES (:id, :title, :value, 'USD', :close, :status, :owner, now(), now())
            """), {"id": uid(), "title": title, "value": value, "close": today() + timedelta(days=30), "status": deal_status, "owner": SUPER_ADMIN})

        print("  + CRM seeded (5 contacts, 3 leads, 4 deals)")

        # ══════════════════════════════════════════════════════════════════
        # INVENTORY
        # ══════════════════════════════════════════════════════════════════

        # Warehouses — DB cols: id, name, location, is_active, created_at, updated_at
        wh_main = uid()
        wh_satellite = uid()
        await db.execute(text("""
            INSERT INTO inventory_warehouses (id, name, location, is_active, created_at, updated_at) VALUES
            (:id1, 'Main Warehouse', '123 Industrial Rd, Nairobi', true, now(), now()),
            (:id2, 'Satellite Warehouse', '456 Commerce Ave, Mombasa', true, now(), now())
        """), {"id1": wh_main, "id2": wh_satellite})

        # Items — DB cols: id, sku, name, description, category, unit_of_measure, cost_price, selling_price, reorder_level, is_active, owner_id, created_at, updated_at
        items = [
            ("Laptop — Dell XPS 15", "SKU-LAP-001", "Electronics", 720.00, 1200.00, 45),
            ("Office Chair — Ergonomic", "SKU-CHR-001", "Furniture", 210.00, 350.00, 120),
            ("Wireless Mouse", "SKU-MOU-001", "Electronics", 21.00, 35.00, 500),
            ("Standing Desk", "SKU-DSK-001", "Furniture", 390.00, 650.00, 30),
            ("Monitor — 27\" 4K", "SKU-MON-001", "Electronics", 270.00, 450.00, 75),
            ("Keyboard — Mechanical", "SKU-KEY-001", "Electronics", 51.00, 85.00, 200),
            ("Printer Paper (Box)", "SKU-PAP-001", "Supplies", 15.00, 25.00, 1000),
            ("Ink Cartridge Set", "SKU-INK-001", "Supplies", 39.00, 65.00, 150),
        ]
        item_ids = []
        for name, sku, cat, cost, price, qty in items:
            i_id = uid()
            item_ids.append(i_id)
            await db.execute(text("""
                INSERT INTO inventory_items (id, name, sku, category, unit_of_measure, cost_price, selling_price, reorder_level, is_active, owner_id, created_at, updated_at)
                VALUES (:id, :name, :sku, :cat, 'each', :cost, :price, :reorder, true, :owner, now(), now())
            """), {"id": i_id, "name": name, "sku": sku, "cat": cat, "cost": cost, "price": price, "reorder": max(10, qty // 10), "owner": SUPER_ADMIN})

            # Stock Levels — DB cols: id, item_id, warehouse_id, quantity_on_hand, quantity_reserved, created_at, updated_at
            await db.execute(text("""
                INSERT INTO inventory_stock_levels (id, item_id, warehouse_id, quantity_on_hand, quantity_reserved, created_at, updated_at)
                VALUES (:id, :item, :wh, :qty, 0, now(), now())
            """), {"id": uid(), "item": i_id, "wh": wh_main, "qty": qty})

        # Purchase Order — DB cols: id, po_number, supplier_name, supplier_email, status, order_date, expected_date, total, notes, owner_id, created_at, updated_at
        po_id = uid()
        await db.execute(text("""
            INSERT INTO inventory_purchase_orders (id, po_number, supplier_name, supplier_email, status, order_date, expected_date, total, notes, owner_id, created_at, updated_at)
            VALUES (:id, 'PO-2026-0001', 'Tech Distributors Ltd', 'orders@techdist.com', 'confirmed', :odate, :edate, 15000, 'Monthly restock', :owner, now(), now())
        """), {"id": po_id, "odate": today() - timedelta(days=3), "edate": today() + timedelta(days=7), "owner": SUPER_ADMIN})

        # PO Lines — DB cols: id, purchase_order_id, item_id, quantity, unit_price, received_quantity
        for item_id, qty, price in [(item_ids[0], 10, 720.00), (item_ids[4], 15, 270.00)]:
            await db.execute(text("""
                INSERT INTO inventory_purchase_order_lines (id, purchase_order_id, item_id, quantity, unit_price, received_quantity)
                VALUES (:id, :po, :item, :qty, :price, 0)
            """), {"id": uid(), "po": po_id, "item": item_id, "qty": qty, "price": price})

        print("  + Inventory seeded (2 warehouses, 8 items, 8 stock levels, 1 PO)")

        # ══════════════════════════════════════════════════════════════════
        # SUPPLY CHAIN
        # ══════════════════════════════════════════════════════════════════

        # Suppliers — DB cols: id, name, code, contact_name, email, phone, address, payment_terms, payment_terms_days, rating, tags, is_active, contact_id, notes, owner_id, created_at, updated_at
        suppliers = [
            ("Tech Distributors Ltd", "SUP-001", "orders@techdist.com", "+254700111222"),
            ("Office World", "SUP-002", "sales@officeworld.com", "+254700333444"),
            ("Furniture Direct", "SUP-003", "info@furnituredirect.com", "+254700555666"),
        ]
        supplier_ids = []
        for name, code, email, phone in suppliers:
            s_id = uid()
            supplier_ids.append(s_id)
            await db.execute(text("""
                INSERT INTO sc_suppliers (id, name, code, email, phone, payment_terms, payment_terms_days, rating, is_active, owner_id, created_at, updated_at)
                VALUES (:id, :name, :code, :email, :phone, 'net_30', 30, 4.5, true, :owner, now(), now())
            """), {"id": s_id, "name": name, "code": code, "email": email, "phone": phone, "owner": SUPER_ADMIN})

        # Requisition — DB cols: id, requisition_number, title, description, requested_by, department_id, status, approved_by, approved_at, priority, required_by_date, total_estimated, notes, created_at, updated_at
        req_id = uid()
        await db.execute(text("""
            INSERT INTO sc_requisitions (id, requisition_number, title, status, priority, requested_by, total_estimated, created_at, updated_at)
            VALUES (:id, 'REQ-2026-0001', 'Q2 Office Equipment', 'approved', 'high', :user, 8500, now(), now())
        """), {"id": req_id, "user": SUPER_ADMIN})

        print("  + Supply Chain seeded (3 suppliers, 1 requisition)")

        # ══════════════════════════════════════════════════════════════════
        # MANUFACTURING
        # ══════════════════════════════════════════════════════════════════

        # Workstations — DB cols: id, name, code, description, capacity_per_hour, hourly_rate, is_active, warehouse_id, created_at, updated_at
        ws_assembly = uid()
        ws_quality = uid()
        await db.execute(text("""
            INSERT INTO mfg_workstations (id, name, code, capacity_per_hour, hourly_rate, is_active, created_at, updated_at) VALUES
            (:id1, 'Assembly Line A', 'WS-ASM-A', 50, 75.00, true, now(), now()),
            (:id2, 'Quality Control', 'WS-QC-1', 100, 45.00, true, now(), now())
        """), {"id1": ws_assembly, "id2": ws_quality})

        # BOM — DB cols: id, bom_number, name, finished_item_id, quantity_produced, version, is_active, is_default, notes, owner_id, created_at, updated_at
        bom_id = uid()
        await db.execute(text("""
            INSERT INTO mfg_bom (id, bom_number, name, finished_item_id, quantity_produced, version, is_active, is_default, owner_id, created_at, updated_at)
            VALUES (:id, 'BOM-WSB-001', 'Workstation Bundle', :item, 1, 1, true, true, :owner, now(), now())
        """), {"id": bom_id, "item": item_ids[3], "owner": SUPER_ADMIN})  # Standing Desk as finished item

        # Work Order — DB cols: id, wo_number, bom_id, workstation_id, finished_item_id, planned_quantity, completed_quantity, rejected_quantity, status, priority, planned_start, planned_end, actual_start, actual_end, target_warehouse_id, source_warehouse_id, total_material_cost, total_labor_cost, notes, assigned_to, owner_id, created_at, updated_at
        wo_id = uid()
        await db.execute(text("""
            INSERT INTO mfg_work_orders (id, wo_number, bom_id, workstation_id, finished_item_id, planned_quantity, completed_quantity, rejected_quantity, status, priority, planned_start, planned_end, target_warehouse_id, source_warehouse_id, owner_id, created_at, updated_at)
            VALUES (:id, 'WO-2026-0001', :bom, :ws, :item, 20, 0, 0, 'in_progress', 'high', :start, :end, :twh, :swh, :owner, now(), now())
        """), {"id": wo_id, "bom": bom_id, "ws": ws_assembly, "item": item_ids[3], "start": today(), "end": today() + timedelta(days=5), "twh": wh_main, "swh": wh_main, "owner": SUPER_ADMIN})

        print("  + Manufacturing seeded (2 workstations, 1 BOM, 1 work order)")

        # ══════════════════════════════════════════════════════════════════
        # E-COMMERCE
        # ══════════════════════════════════════════════════════════════════

        # Stores — DB cols: id, name, slug, currency, settings_json, is_active, created_at, updated_at
        store_id = uid()
        await db.execute(text("""
            INSERT INTO ecom_stores (id, name, slug, currency, is_active, created_at, updated_at)
            VALUES (:id, 'Urban Store', 'urban-store', 'USD', true, now(), now())
        """), {"id": store_id})

        # Products — DB cols: id, store_id, inventory_item_id, display_name, slug, description, images, price, compare_at_price, is_published, seo_title, seo_description, created_at, updated_at
        products = [
            ("Premium Laptop Stand", "premium-laptop-stand", "Ergonomic aluminum laptop stand", 89.99),
            ("USB-C Hub 7-in-1", "usb-c-hub-7in1", "Multi-port USB-C hub with HDMI", 49.99),
            ("Noise Cancelling Headphones", "noise-cancelling-headphones", "Over-ear Bluetooth headphones", 199.99),
            ("Desk Organizer Set", "desk-organizer-set", "Bamboo desk organizer 5-piece", 34.99),
        ]
        for name, slug, desc, price in products:
            await db.execute(text("""
                INSERT INTO ecom_products (id, store_id, display_name, slug, description, price, compare_at_price, is_published, created_at, updated_at)
                VALUES (:id, :store, :name, :slug, :desc, :price, :compare, true, now(), now())
            """), {"id": uid(), "store": store_id, "name": name, "slug": slug, "desc": desc, "price": price, "compare": round(price * 1.2, 2)})

        print("  + E-Commerce seeded (1 store, 4 products)")

        # ══════════════════════════════════════════════════════════════════
        # SUPPORT
        # ══════════════════════════════════════════════════════════════════

        # Ticket Categories — DB cols: id, name, slug, description, color, is_active, sort_order, created_at, updated_at
        categories = [("Technical", "technical"), ("Billing", "billing"), ("General", "general"), ("Feature Request", "feature-request")]
        cat_ids = {}
        for i, (name, slug) in enumerate(categories):
            c_id = uid()
            cat_ids[name] = c_id
            await db.execute(text("""
                INSERT INTO ticket_categories (id, name, slug, description, is_active, sort_order, created_at, updated_at)
                VALUES (:id, :name, :slug, :desc, true, :order, now(), now())
            """), {"id": c_id, "name": name, "slug": slug, "desc": f"{name} support tickets", "order": i + 1})

        # Tickets — DB cols: id, ticket_number, subject, description, status, priority, category_id, contact_id, customer_email, customer_name, assigned_to, created_by, ...timestamps..., tags, created_at, updated_at
        tickets = [
            ("TKT-001", "Cannot login after password reset", "Technical", "high", "open"),
            ("TKT-002", "Invoice discrepancy on March bill", "Billing", "medium", "in_progress"),
            ("TKT-003", "Request for API documentation", "General", "low", "open"),
            ("TKT-004", "Add dark mode to dashboard", "Feature Request", "low", "open"),
        ]
        for tkt_num, subject, cat, priority, tkt_status in tickets:
            await db.execute(text("""
                INSERT INTO tickets (id, ticket_number, subject, description, category_id, priority, status, created_by, created_at, updated_at)
                VALUES (:id, :num, :subj, :desc, :cat, :pri, :status, :creator, now(), now())
            """), {"id": uid(), "num": tkt_num, "subj": subject, "desc": f"Details for: {subject}",
                   "cat": cat_ids[cat], "pri": priority, "status": tkt_status, "creator": USER_001})

        # KB Articles — DB cols: id, title, slug, content, category_id, status, author_id, tags, view_count, helpful_count, created_at, updated_at
        for title, slug, content in [
            ("How to Reset Your Password", "how-to-reset-password", "Go to Settings > Security > Change Password. Click 'Forgot Password' if locked out."),
            ("Invoice Payment Methods", "invoice-payment-methods", "We accept bank transfer, credit card, and mobile money. Payment terms are Net 30."),
            ("Getting Started Guide", "getting-started-guide", "Welcome to Urban Vibes Dynamics! This guide covers your first steps: login, dashboard navigation, and module access."),
        ]:
            await db.execute(text("""
                INSERT INTO kb_articles (id, title, slug, content, category_id, status, author_id, view_count, helpful_count, created_at, updated_at)
                VALUES (:id, :title, :slug, :content, :cat, 'published', :author, 0, 0, now(), now())
            """), {"id": uid(), "title": title, "slug": slug, "content": content, "cat": cat_ids["General"], "author": SUPER_ADMIN})

        print("  + Support seeded (4 categories, 4 tickets, 3 KB articles)")

        # ══════════════════════════════════════════════════════════════════
        # PROJECTS
        # ══════════════════════════════════════════════════════════════════

        # Projects — DB cols: id, name, description, owner_id, status, start_date, end_date, color, members, created_at, updated_at
        proj_id = uid()
        await db.execute(text("""
            INSERT INTO projects (id, name, description, status, owner_id, start_date, end_date, created_at, updated_at)
            VALUES (:id, 'ERP Platform v2.0', 'Next major version with advanced analytics', 'active', :owner, :start, :end, now(), now())
        """), {"id": proj_id, "owner": SUPER_ADMIN, "start": today() - timedelta(days=30), "end": today() + timedelta(days=60)})

        # Tasks — DB cols: id, project_id, title, description, assignee_id, status, priority, due_date, order, tags, created_at, updated_at
        tasks = [
            ("Design new dashboard layout", "done", "high"),
            ("Implement real-time notifications", "in_progress", "high"),
            ("Add export to PDF for all reports", "in_progress", "medium"),
            ("Write API documentation", "todo", "medium"),
            ("Performance testing & optimization", "todo", "high"),
            ("User acceptance testing", "todo", "medium"),
        ]
        for i, (title, task_status, priority) in enumerate(tasks):
            await db.execute(text("""
                INSERT INTO project_tasks (id, project_id, title, status, priority, assignee_id, "order", created_at, updated_at)
                VALUES (:id, :proj, :title, :status, :pri, :assignee, :ord, now(), now())
            """), {"id": uid(), "proj": proj_id, "title": title, "status": task_status, "pri": priority, "assignee": USER_001, "ord": i + 1})

        # Milestones — DB cols: id, project_id, title, due_date, is_completed, created_at, updated_at
        await db.execute(text("""
            INSERT INTO project_milestones (id, project_id, title, due_date, is_completed, created_at, updated_at)
            VALUES (:id, :proj, 'Beta Release', :due, false, now(), now())
        """), {"id": uid(), "proj": proj_id, "due": today() + timedelta(days=30)})

        print("  + Projects seeded (1 project, 6 tasks, 1 milestone)")

        # ══════════════════════════════════════════════════════════════════
        # NOTIFICATIONS
        # ══════════════════════════════════════════════════════════════════

        # DB cols: id, user_id, title, message, type, module, is_read, link_url, created_at, updated_at
        notifs = [
            ("Invoice Overdue", "Invoice INV-2026-1003 is overdue", "finance", "warning"),
            ("Leave Request", "New leave request from employee EMP-001", "hr", "info"),
            ("Low Stock Alert", "Low stock alert: Standing Desk (30 units)", "inventory", "warning"),
            ("New Ticket", "New support ticket: Cannot login after password reset", "support", "info"),
            ("Deal Won", "Deal won: Metro Services — Support Plan ($28,000)", "crm", "success"),
        ]
        for title, msg, module, ntype in notifs:
            await db.execute(text("""
                INSERT INTO notifications (id, user_id, title, message, module, type, is_read, created_at, updated_at)
                VALUES (:id, :user, :title, :msg, :module, :type, false, now(), now())
            """), {"id": uid(), "user": SUPER_ADMIN, "title": title, "msg": msg, "module": module, "type": ntype})

        print("  + Notifications seeded (5 notifications)")

        # ══════════════════════════════════════════════════════════════════
        # SYSTEM SETTINGS — Agent financial thresholds
        # ══════════════════════════════════════════════════════════════════

        thresholds = [
            ("agent.approval_threshold.invoice_amount", "500000", "agent"),
            ("agent.approval_threshold.payment_amount", "500000", "agent"),
            ("agent.approval_threshold.purchase_order", "1000000", "agent"),
        ]
        for key, value, category in thresholds:
            await db.execute(text("""
                INSERT INTO system_settings (id, key, value, category, created_at, updated_at)
                VALUES (:id, :key, :value, :category, now(), now())
                ON CONFLICT (key) DO NOTHING
            """), {"id": uid(), "key": key, "value": value, "category": category})

        print("  + System Settings seeded (3 agent approval thresholds)")

        # ══════════════════════════════════════════════════════════════════

        await db.commit()
        print("\nAll modules seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
