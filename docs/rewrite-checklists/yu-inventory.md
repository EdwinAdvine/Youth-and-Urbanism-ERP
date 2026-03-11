# Y&U Inventory – Rewrite Checklist

**Status: 100% COMPLETE** (Phase 3 + Phase 4 + Extensions + Mobile + AI reorder + camera barcode)
**Owner: 100% Ours**

## Database Models
- [x] Item model (name, sku, description, category, unit, cost_price, selling_price, reorder_level)
- [x] Warehouse model (name, location, is_active)
- [x] StockLevel model (item_id, warehouse_id, quantity, reserved)
- [x] StockMovement model (item_id, warehouse_id, type: in/out/transfer, quantity, reference, date)
- [x] PurchaseOrder model (supplier_id, date, status, total, expected_delivery)
- [x] PurchaseOrderLine model (po_id, item_id, quantity, unit_price)
- [x] Supplier model (name, email, phone, address, payment_terms)
- [x] StockAdjustment model (item_id, warehouse_id, old_qty, new_qty, reason, adjusted_by)
- [x] ItemVariant model (item_id, variant_name, sku, price_adjustment)
- [x] BatchNumber model (item_id, batch_no, manufacture_date, expiry_date, quantity)
- [x] InventoryCount model (warehouse_id, date, status, counted_by)

## API Endpoints (FastAPI)
- [x] GET/POST /inventory/items
- [x] GET/PUT/DELETE /inventory/items/{id}
- [x] GET/POST /inventory/warehouses
- [x] GET /inventory/stock-levels
- [x] GET/POST /inventory/stock-movements
- [x] GET/POST /inventory/purchase-orders
- [x] GET/PUT /inventory/purchase-orders/{id}
- [x] POST /inventory/purchase-orders/{id}/receive
- [x] GET /inventory/reorder-alerts
- [x] GET/POST /inventory/suppliers
- [x] GET/PUT/DELETE /inventory/suppliers/{id}
- [x] POST /inventory/stock-adjustments
- [x] GET /inventory/items/{id}/history (movement history)
- [x] GET /inventory/valuation (stock value by warehouse)
- [x] POST /inventory/counts (physical inventory count)
- [x] GET /inventory/reports/turnover
- [x] GET /inventory/reports/aging
- [x] POST /inventory/items/import (CSV bulk import)
- [x] GET /inventory/items/export

## Frontend Pages (React)
- [x] Inventory dashboard
- [x] Item list + detail
- [x] Warehouse management
- [x] Stock movements
- [x] Purchase orders + detail
- [x] Reorder alerts
- [x] Supplier management page
- [x] Stock adjustment form
- [x] Physical count workflow
- [x] Item movement history timeline
- [x] Stock valuation report
- [x] Inventory turnover report
- [x] Barcode/QR scanner integration — `BarcodeScanner.tsx` component listens for rapid keystrokes (barcode scanner input) + `ManualBarcodeInput` for manual entry, integrated in ItemsPage.tsx
- [x] Item variants editor
- [x] Batch/serial number tracking

## Integrations
- [x] Event bus: stock.low handler → notification
- [x] Event bus: po.received handler → stock update
- [x] AI tools: inventory forecasting
- [x] Inventory → Finance: stock valuation → balance sheet — `integration_handlers.py` `inventory.valuation.changed` creates journal entries (debit inventory asset, credit COGS)
- [x] Inventory → POS: real-time stock sync — `pos.py` directly queries & deducts `StockLevel.quantity_on_hand` per sale
- [x] Inventory → E-Commerce: product stock sync — `ecommerce_ext.py` checks & deducts stock via `inventory_item_id` on checkout + restores on refund
- [x] Inventory → Supply Chain: procurement integration — `integration_handlers.py` `supplychain.goods_received` creates stock movements + updates StockLevel
- [x] AI demand forecasting — `ai_features.py` `/inventory/items/{id}/ai-demand-forecast` + `ai_tools.py` `demand_forecast` tool
- [x] AI reorder point optimization — `ai_tools.py` `optimize_reorder_point` tool (analyzes 90-day stock movements, calculates safety stock/EOQ) + `ai_features.py` POST /inventory/items/{id}/ai-reorder-optimize endpoint

## Tests
- [x] Item CRUD tests
- [x] Stock movement tests
- [x] Purchase order lifecycle tests — `test_inventory_extended.py`: create, send, receive (stock created), cancel, update draft-only, double-receive rejection
- [x] Reorder alert tests — `test_inventory_extended.py`: `test_reorder_alerts_endpoint` verifies low-stock items returned
- [x] Stock valuation calculation tests — `test_inventory_extended.py`: `test_stock_valuation_report` + `test_stock_valuation_by_warehouse`

## Mobile / Responsive
- [x] Mobile stock check — `MobileStockCheck.tsx` component shown on small screens in InventoryDashboard.tsx
- [x] Barcode scanning (mobile camera-based) — BarcodeScanner.tsx has camera mode using BarcodeDetector API (EAN-13/8, Code 128, QR, UPC) + video overlay, auto-defaults to camera on touch devices, keyboard mode preserved for desktop
- [x] Mobile PO receipt — `MobilePOReceipt.tsx` component shown on small screens in PODetailPage.tsx
