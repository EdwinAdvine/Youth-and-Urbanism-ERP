Ready for review
Select text to add comments on the plan
Inventory Module Upgrade Plan
Context
The Urban ERP Inventory module already has a solid foundation: 11 models (6 migrated, 5 not), ~50 API endpoints across inventory.py and inventory_ext.py, and 18 frontend pages. The Supply Chain module adds another 12 models and ~40 endpoints. However, the user's feature list (inspired by NetSuite + Odoo + Katana) reveals significant gaps in warehouse management, tracking, costing, forecasting, and automation. This plan addresses those gaps in 6 phases.

Critical blocker: 5 existing models (ItemVariant, BatchNumber, StockAdjustment, InventoryCount, InventorySupplier) have never been migrated -- their tables don't exist in the database.

Phase 0: Foundation Fix (Week 1)
Goal: Migrate the 5 existing-but-unusable models and enrich core models with missing fields.

Alembic Migration 1: Create unmigrated tables
inventory_suppliers
inventory_stock_adjustments
inventory_item_variants
inventory_batch_numbers
inventory_counts
No model changes needed -- just generate migration from existing definitions.

Alembic Migration 2: Enrich core models
StockLevel -- add columns:

quantity_committed (Integer, default=0) -- reserved for confirmed orders/deals
quantity_incoming (Integer, default=0) -- expected from open POs
bin_location (String(100), nullable) -- simple bin reference
Warehouse -- add columns:

address (Text, nullable)
warehouse_type (String(30), default="standard") -- standard, transit, drop_ship, consignment
manager_id (UUID FK users, nullable)
InventoryItem -- add columns:

item_type (String(30), default="stockable") -- stockable, consumable, service, kit
tracking_type (String(20), default="none") -- none, batch, serial
weight (Numeric(10,3), nullable)
dimensions (JSON, nullable)
barcode (String(100), nullable, indexed)
min_order_qty (Integer, default=1)
lead_time_days (Integer, default=0)
preferred_supplier_id (UUID FK inventory_suppliers, nullable)
custom_fields (JSON, nullable)
max_stock_level (Integer, nullable)
Backend: Fix receive_purchase_order endpoint to update quantity_incoming on StockLevel.
Files to modify:
backend/app/models/inventory.py (add columns)
backend/app/api/v1/inventory.py (update PO receive logic + dashboard stats)
Phase 1: Serial Numbers, UoM Conversions, Enhanced Purchasing (Weeks 2-4)
New models in inventory.py:
SerialNumber (inventory_serial_numbers)

item_id, serial_no (unique), warehouse_id (nullable), batch_id (nullable)
status: available/reserved/sold/returned/scrapped
purchase_order_id, sold_to_reference, notes
UnitOfMeasure (inventory_uom)

name (unique), abbreviation, category (weight/length/volume/count), is_base
UoMConversion (inventory_uom_conversions)

from_uom_id, to_uom_id, factor (Numeric(18,6)), item_id (nullable = global)
BlanketOrder (inventory_blanket_orders)

bo_number, supplier_id, start/end_date, total_value_limit, released_value, status, terms
Modify PurchaseOrder:
Add supplier_id FK (proper reference vs current string), blanket_order_id FK, warehouse_id FK, three_way_match_status
New API endpoints:
Serial numbers: CRUD + /trace (forward/backward traceability)
UoM: CRUD + /convert utility
Blanket orders: CRUD + /release (creates PO)
Three-way matching: /match + /match-status on POs
New frontend pages:
SerialTrackingPage.tsx, SerialTracePage.tsx
UoMSettingsPage.tsx
BlanketOrdersPage.tsx, BlanketOrderDetailPage.tsx
Update PODetailPage.tsx for match status + serial input
New API hooks in frontend/src/api/inventory.ts
Phase 2: Warehouse Zones, Bins, Pick-Pack-Ship (Weeks 5-7)
New models:
WarehouseZone (inventory_warehouse_zones)

warehouse_id, name, zone_type (receiving/storage/picking/packing/shipping/quality)
WarehouseBin (inventory_warehouse_bins)

zone_id, warehouse_id, bin_code (unique per WH), bin_type, max_weight, max_volume
BinContent (inventory_bin_contents)

bin_id, item_id, variant_id, batch_id, serial_id, quantity
UniqueConstraint(bin_id, item_id, variant_id, batch_id)
PutawayRule (inventory_putaway_rules)

item_id (nullable), category (nullable), warehouse_id, zone_id, bin_id, priority
PickList + PickListLine (inventory_pick_lists, inventory_pick_list_lines)

pick_number, warehouse_id, status (pending/in_progress/picked/packed/shipped)
pick_strategy (fifo/fefo/lifo/zone_priority), assigned_to
Lines: item_id, bin_id, quantity_requested, quantity_picked, serial/batch refs
Modify StockMovement: Add from_bin_id, to_bin_id, serial_id
New API file: inventory_wms.py
Zones/bins CRUD, bulk-create bins, bin contents
Putaway rules + /suggest endpoint
Pick lists: create (auto-generates lines from bins), pick/pack/ship workflow
New frontend pages:
WarehouseDetailPage.tsx (zones/bins visualization)
BinManagementPage.tsx, PutawayRulesPage.tsx
PickListsPage.tsx, PickListDetailPage.tsx, MobilePickPage.tsx
Phase 3: Intelligent Replenishment & ABC Analysis (Weeks 8-10)
New models:
ReplenishmentRule (inventory_replenishment_rules)

item_id, warehouse_id, rule_type (reorder_point/min_max/eoq)
reorder_point, reorder_qty, max_stock_level, safety_stock, lead_time_override
preferred_supplier_id, auto_generate_po, is_active
PurchaseSuggestion (inventory_purchase_suggestions)

item_id, warehouse_id, supplier_id, suggested_qty, reason, status (pending/accepted/dismissed)
ItemClassification (inventory_item_classifications)

item_id, warehouse_id, abc_class (A/B/C), xyz_class (X/Y/Z), combined_class
annual_consumption_value, demand_variability, calculated_at
New API file: inventory_replenishment.py
Rules CRUD, /run (trigger check), purchase suggestions (list/accept/dismiss/bulk-accept)
ABC/XYZ: /calculate, list, /summary
Overstock alerts, cycle count scheduling by ABC class
Celery tasks in tasks/inventory_tasks.py:
run_replenishment_check (daily), calculate_abc_xyz (monthly), check_overstock (daily)
New frontend pages:
ReplenishmentRulesPage.tsx, PurchaseSuggestionsPage.tsx
ABCAnalysisPage.tsx, OverstockAlertsPage.tsx
Update InventoryDashboard.tsx with overstock card + ABC widget
Phase 4: Kits/Bundles, Supplier Pricing, Landed Cost (Weeks 11-13)
New models:
Kit + KitComponent (inventory_kits, inventory_kit_components)

kit_item_id -> InventoryItem, components with quantity and optional flag
SupplierPriceList (inventory_supplier_prices)

supplier_id, item_id, unit_price, min_order_qty, lead_time_days, currency, valid_from/to
LandedCostVoucher + Lines + Allocations (inventory_landed_cost_*)

voucher linked to PO/GRN, cost lines (freight/insurance/duty), allocation by value/qty/weight
New API files: inventory_kits.py, inventory_pricing.py, inventory_landed_cost.py
Kit CRUD + /check-availability + /assemble
Supplier prices + /best-price lookup
Landed cost voucher create + /apply (updates item costs, emits inventory.valuation.changed)
New frontend pages:
KitsPage.tsx, SupplierPricingPage.tsx, LandedCostPage.tsx
Phase 5: Advanced Costing & Audit Trail (Weeks 14-16)
New models:
CostingConfig (inventory_costing_config) -- per-item method: fifo/lifo/average/standard/specific CostLayer (inventory_cost_layers) -- FIFO/LIFO layer tracking (quantity_remaining, unit_cost) AuditTrail (inventory_audit_trail) -- field-level change log (entity_type, field, old/new value, user)

New service: services/inventory_costing.py
CostingService: on receipt -> create layer; on issue -> consume layers (FIFO/LIFO/avg)
New API file: inventory_costing.py, inventory_audit.py
Costing config, recalculate, profitability reports (by item/location/project)
Audit trail with entity/date/user filters
Frontend: CostingSettingsPage.tsx, CostLayersPage.tsx, ProfitabilityReportPage.tsx, AuditTrailPage.tsx
Phase 6: AI Forecasting & Automation (Weeks 17-19)
New models:
DemandForecast (inventory_demand_forecasts)

item_id, warehouse_id, period, forecasted_demand, confidence_level, model_used, actual_demand
InventoryAutomationRule (inventory_automation_rules)

trigger_event, conditions (JSON), action_type, action_config (JSON)
New API: inventory_forecast.py, inventory_automation.py
Forecast generation (Celery + Ollama), what-if scenarios
Automation rules CRUD + test/dry-run
AI insights endpoint (Ollama analyzes inventory data)
New AI tools in services/ai_tools.py:
inventory_stock_lookup, inventory_reorder_check, inventory_create_po, inventory_forecast_query
Frontend: ForecastDashboardPage.tsx, AutomationRulesPage.tsx, AIInsightsPage.tsx
Enhanced InventoryDashboard.tsx with configurable widget grid
Phase Dependencies
Phase 0 ──> Phase 1 ──> Phase 2 (serial tracking in picks)
                    ──> Phase 3 (supplier_id on PO)
                              ──> Phase 4 (suggestions use supplier pricing)
                                        ──> Phase 5 (landed cost creates cost layers)
                                                  ──> Phase 6 (needs rich data)
Phases 2 and 3 can run in parallel. Phases 4 and 5 can partially overlap.

Key Architectural Decisions
Serial numbers are separate from variants -- a serial is one physical unit; a variant is a product config
Kits are separate from manufacturing BOMs -- kits are inventory-level assembly, not production planning
Cost layers are immutable -- only quantity_remaining decreases for audit integrity
ReplenishmentRule extends (doesn't replace) item.reorder_level -- simple trigger stays, rules add sophistication
Bin tracking supplements (doesn't replace) StockLevel -- StockLevel stays as fast aggregate; BinContent tracks physical location
Audit trail is inventory-specific -- scoped compliance, not a system-wide rewrite
Critical Files
Purpose	Path
Core inventory models	backend/app/models/inventory.py
Main inventory API	backend/app/api/v1/inventory.py
Extended inventory API	backend/app/api/v1/inventory_ext.py
Router registration	backend/app/api/v1/__init__.py
Model registration	backend/app/models/__init__.py
Event handlers	backend/app/main.py (lifespan)
Frontend API client	frontend/src/api/inventory.ts
Frontend routes	frontend/src/App.tsx
Inventory dashboard	frontend/src/features/inventory/InventoryDashboard.tsx
Celery tasks	backend/app/tasks/celery_app.py
AI tools	backend/app/services/ai_tools.py
Verification
After each phase:

Run docker compose exec backend alembic upgrade head -- migration applies cleanly
Run docker compose exec backend pytest -- no regressions
Check Swagger at localhost:8010/docs -- new endpoints appear and return correct responses
Check frontend at localhost:3010 -- new pages load, CRUD works, dashboard reflects new data
Verify cross-module events fire correctly (check backend logs for event emissions)