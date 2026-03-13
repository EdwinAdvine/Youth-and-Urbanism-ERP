---
title: POS Terminals & Hardware
slug: pos-terminals
category: pos
article_type: guide
module: pos
tags: [terminals, hardware, barcode-scanner, receipt-printer, cash-drawer]
sort_order: 4
is_pinned: false
excerpt: Configure POS terminals, connect hardware peripherals, and manage multiple till points.
---

# POS Terminals & Hardware

A terminal is a named till point — it tracks which cashier is on which physical register and holds session-specific settings.

## Creating a Terminal

Go to **POS → Settings → Terminals → New Terminal**:

| Field | Description |
|-------|-------------|
| Name | e.g. "Till 1 – Ground Floor" |
| Location | Physical location or branch |
| Default warehouse | Stock decrements from this warehouse on each sale |
| Receipt printer | IP address + port of the ESC/POS network printer |
| Cash drawer | Tick if connected via receipt printer RJ11 port |

## Opening a Session

1. Go to **POS → Open Session**
2. Select your terminal
3. Enter the opening float (count cash by denomination)
4. Click **Open Session** — the POS interface loads

## Multiple Terminals

A single location can run multiple terminals simultaneously — useful for retail stores with several checkout lanes. Each terminal has its own session, cash drawer, and receipt printer.

## Hardware Setup

### Receipt Printer
- Requires an ESC/POS compatible network printer
- Set the IP address and port (usually 9100) in terminal settings
- Test with **Settings → Terminal → Test Print**

### Cash Drawer
- Connect to the receipt printer via RJ11 cable
- The drawer opens automatically on cash payment
- No separate configuration needed — triggered by the printer

### Barcode Scanner
- USB HID barcode scanners work plug-and-play
- Focus the POS search field and scan — the item is added to the cart instantly

### Customer Display
- Point a second monitor at `http://yourserver:3010/pos/display?terminal=TERMINAL_ID`
- Shows item name, quantity, and running total facing the customer

### Kitchen Display System (KDS)
- For restaurants: orders route to the KDS screen automatically
- Configure in **POS → Settings → KDS → Assign to Terminal**

## Terminal Permissions

Specify which users can open a given terminal under **Terminal → Allowed Users**. This prevents cashiers from opening terminals they're not assigned to.

## Closing a Session

1. Click **Close Session** in the POS header
2. Count your cash and enter the actual amount per denomination
3. Urban ERP shows **Expected vs Actual** variance
4. Session report is saved; any variance is flagged for the manager

## Offline Mode

If the internet connection drops:
- The terminal continues processing cash sales locally
- Pending transactions sync automatically when connectivity is restored
- Card and M-Pesa payments are blocked in offline mode (require connectivity)

> **Tip:** Name terminals by location rather than by person — "Till 1 – Ground Floor" is more useful than "John's Till" when staff rotate.
