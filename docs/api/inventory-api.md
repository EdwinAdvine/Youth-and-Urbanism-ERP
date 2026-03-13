# Inventory — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 111


## Contents

- [inventory.py](#inventory) (24 endpoints)
- [inventory_automation.py](#inventory-automation) (7 endpoints)
- [inventory_costing.py](#inventory-costing) (6 endpoints)
- [inventory_ext.py](#inventory-ext) (23 endpoints)
- [inventory_kits.py](#inventory-kits) (9 endpoints)
- [inventory_replenishment.py](#inventory-replenishment) (9 endpoints)
- [inventory_serial_uom.py](#inventory-serial-uom) (19 endpoints)
- [inventory_wms.py](#inventory-wms) (14 endpoints)

---

## inventory.py

Inventory API — Items, Warehouses, Stock Levels, Movements, Purchase Orders.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/items` | `list_items` | — |
| `POST` | `/items` | `create_item` | — |
| `GET` | `/items/export` | `export_items` | Download all inventory items as a CSV file. |
| `GET` | `/items/{item_id}` | `get_item` | — |
| `PUT` | `/items/{item_id}` | `update_item` | — |
| `DELETE` | `/items/{item_id}` | `delete_item` | — |
| `GET` | `/warehouses` | `list_warehouses` | — |
| `POST` | `/warehouses` | `create_warehouse` | — |
| `GET` | `/warehouses/{warehouse_id}` | `get_warehouse` | — |
| `PUT` | `/warehouses/{warehouse_id}` | `update_warehouse` | — |
| `DELETE` | `/warehouses/{warehouse_id}` | `delete_warehouse` | — |
| `GET` | `/stock-levels` | `list_stock_levels` | — |
| `GET` | `/stock-levels/{item_id}` | `get_item_stock_levels` | — |
| `GET` | `/stock-movements` | `list_stock_movements` | — |
| `POST` | `/stock-movements` | `create_stock_movement` | — |
| `GET` | `/purchase-orders` | `list_purchase_orders` | — |
| `POST` | `/purchase-orders` | `create_purchase_order` | — |
| `GET` | `/purchase-orders/{po_id}` | `get_purchase_order` | — |
| `PUT` | `/purchase-orders/{po_id}` | `update_purchase_order` | — |
| `POST` | `/purchase-orders/{po_id}/send` | `send_purchase_order` | — |
| `POST` | `/purchase-orders/{po_id}/receive` | `receive_purchase_order` | — |
| `DELETE` | `/purchase-orders/{po_id}` | `cancel_purchase_order` | — |
| `GET` | `/dashboard/stats` | `inventory_dashboard` | — |
| `GET` | `/reorder-alerts` | `reorder_alerts` | — |

### `GET /items`

**Function:** `list_items` (line 267)

**Parameters:** `search`, `category`, `skip`, `limit`, `fields`

**Auth:** `current_user`


### `POST /items`

**Function:** `create_item` (line 308)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /items/export`

**Function:** `export_items` (line 346)

Download all inventory items as a CSV file.

**Auth:** `current_user`


### `GET /items/{item_id}`

**Function:** `get_item` (line 383)

**Parameters:** `item_id`

**Auth:** `current_user`


### `PUT /items/{item_id}`

**Function:** `update_item` (line 399)

**Parameters:** `item_id`, `payload`

**Auth:** `current_user`


### `DELETE /items/{item_id}`

**Function:** `delete_item` (line 424)

**Parameters:** `item_id`

**Auth:** `current_user`


### `GET /warehouses`

**Function:** `list_warehouses` (line 442)

**Auth:** `current_user`


### `POST /warehouses`

**Function:** `create_warehouse` (line 461)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /warehouses/{warehouse_id}`

**Function:** `get_warehouse` (line 480)

**Parameters:** `warehouse_id`

**Auth:** `current_user`


### `PUT /warehouses/{warehouse_id}`

**Function:** `update_warehouse` (line 496)

**Parameters:** `warehouse_id`, `payload`

**Auth:** `current_user`


### `DELETE /warehouses/{warehouse_id}`

**Function:** `delete_warehouse` (line 520)

**Parameters:** `warehouse_id`

**Auth:** `current_user`


### `GET /stock-levels`

**Function:** `list_stock_levels` (line 537)

**Parameters:** `item_id`, `warehouse_id`, `skip`, `limit`

**Auth:** `current_user`


### `GET /stock-levels/{item_id}`

**Function:** `get_item_stock_levels` (line 579)

**Parameters:** `item_id`

**Auth:** `current_user`


### `GET /stock-movements`

**Function:** `list_stock_movements` (line 612)

**Parameters:** `movement_type`, `item_id`, `warehouse_id`, `skip`, `limit`

**Auth:** `current_user`


### `POST /stock-movements`

**Function:** `create_stock_movement` (line 649)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /purchase-orders`

**Function:** `list_purchase_orders` (line 733)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /purchase-orders`

**Function:** `create_purchase_order` (line 764)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /purchase-orders/{po_id}`

**Function:** `get_purchase_order` (line 817)

**Parameters:** `po_id`

**Auth:** `current_user`


### `PUT /purchase-orders/{po_id}`

**Function:** `update_purchase_order` (line 838)

**Parameters:** `po_id`, `payload`

**Auth:** `current_user`


### `POST /purchase-orders/{po_id}/send`

**Function:** `send_purchase_order` (line 913)

**Parameters:** `po_id`

**Auth:** `current_user`


### `POST /purchase-orders/{po_id}/receive`

**Function:** `receive_purchase_order` (line 977)

**Parameters:** `po_id`

**Auth:** `current_user`


### `DELETE /purchase-orders/{po_id}`

**Function:** `cancel_purchase_order` (line 1102)

**Parameters:** `po_id`

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `inventory_dashboard` (line 1125)

**Auth:** `current_user`


### `GET /reorder-alerts`

**Function:** `reorder_alerts` (line 1207)

**Auth:** `current_user`


---

## inventory_automation.py

Inventory Phase 6 — Automation Rules, Demand Forecasting, AI Insights.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/automation-rules` | `list_automation_rules` | — |
| `POST` | `/automation-rules` | `create_automation_rule` | — |
| `PATCH` | `/automation-rules/{rule_id}` | `update_automation_rule` | — |
| `DELETE` | `/automation-rules/{rule_id}` | `delete_automation_rule` | — |
| `POST` | `/automation-rules/{rule_id}/test` | `test_automation_rule` | Dry-run an automation rule to see what it would do. |
| `GET` | `/forecast/insights` | `ai_inventory_insights` | Return AI-generated inventory insights based on current stock data. |
| `GET` | `/forecast/demand/{item_id}` | `demand_forecast` | Simple moving average demand forecast for an item. |

### `GET /automation-rules`

**Function:** `list_automation_rules` (line 50)

**Auth:** `_`


### `POST /automation-rules`

**Function:** `create_automation_rule` (line 55)

**Parameters:** `payload`

**Response model:** `AutomationRuleOut`

**Auth:** `current_user`


### `PATCH /automation-rules/{rule_id}`

**Function:** `update_automation_rule` (line 63)

**Parameters:** `rule_id`, `payload`

**Response model:** `AutomationRuleOut`

**Auth:** `_`


### `DELETE /automation-rules/{rule_id}`

**Function:** `delete_automation_rule` (line 74)

**Parameters:** `rule_id`

**Auth:** `_`


### `POST /automation-rules/{rule_id}/test`

**Function:** `test_automation_rule` (line 82)

Dry-run an automation rule to see what it would do.

**Parameters:** `rule_id`

**Auth:** `_`


### `GET /forecast/insights`

**Function:** `ai_inventory_insights` (line 99)

Return AI-generated inventory insights based on current stock data.

**Auth:** `_`


### `GET /forecast/demand/{item_id}`

**Function:** `demand_forecast` (line 137)

Simple moving average demand forecast for an item.

**Parameters:** `item_id`, `periods`

**Auth:** `_`


---

## inventory_costing.py

Inventory Phase 5 — Advanced Costing, Cost Layers, Audit Trail.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/costing-config` | `list_costing_configs` | — |
| `POST` | `/costing-config` | `create_costing_config` | — |
| `PATCH` | `/costing-config/{item_id}` | `update_costing_config` | — |
| `GET` | `/cost-layers` | `list_cost_layers` | — |
| `GET` | `/profitability` | `profitability_report` | Simple profitability report: selling_price - cost_price per item. |
| `GET` | `/audit-trail` | `list_audit_trail` | — |

### `GET /costing-config`

**Function:** `list_costing_configs` (line 66)

**Auth:** `_`


### `POST /costing-config`

**Function:** `create_costing_config` (line 76)

**Parameters:** `payload`

**Response model:** `CostingConfigOut`

**Auth:** `current_user`


### `PATCH /costing-config/{item_id}`

**Function:** `update_costing_config` (line 85)

**Parameters:** `item_id`, `method`, `standard_cost`

**Response model:** `CostingConfigOut`

**Auth:** `current_user`


### `GET /cost-layers`

**Function:** `list_cost_layers` (line 102)

**Parameters:** `item_id`, `warehouse_id`

**Auth:** `_`


### `GET /profitability`

**Function:** `profitability_report` (line 122)

Simple profitability report: selling_price - cost_price per item.

**Auth:** `_`


### `GET /audit-trail`

**Function:** `list_audit_trail` (line 144)

**Parameters:** `entity_type`, `entity_id`, `limit`

**Auth:** `_`


---

## inventory_ext.py

Inventory Extensions API — Suppliers, Adjustments, Variants, Batches, Counts, Reports.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/suppliers` | `list_suppliers` | — |
| `POST` | `/suppliers` | `create_supplier` | — |
| `GET` | `/suppliers/{supplier_id}` | `get_supplier` | — |
| `PUT` | `/suppliers/{supplier_id}` | `update_supplier` | — |
| `DELETE` | `/suppliers/{supplier_id}` | `delete_supplier` | — |
| `POST` | `/stock-adjustments` | `create_stock_adjustment` | — |
| `GET` | `/stock-adjustments` | `list_stock_adjustments` | — |
| `GET` | `/items/{item_id}/history` | `item_history` | — |
| `GET` | `/valuation` | `stock_valuation` | — |
| `POST` | `/counts` | `create_count` | — |
| `PUT` | `/counts/{count_id}` | `update_count` | — |
| `GET` | `/counts` | `list_counts` | — |
| `GET` | `/reports/turnover` | `turnover_report` | Turnover = total issued quantity / average stock on hand per item |
| `GET` | `/reports/aging` | `aging_report` | Shows how long stock has been sitting. Uses the last receipt date as proxy |
| `POST` | `/items/import` | `import_items` | CSV columns: sku, name, description, category, unit_of_measure, |
| `GET` | `/items/{item_id}/variants` | `list_variants` | — |
| `POST` | `/items/{item_id}/variants` | `create_variant` | — |
| `PUT` | `/variants/{variant_id}` | `update_variant` | — |
| `DELETE` | `/variants/{variant_id}` | `delete_variant` | — |
| `GET` | `/batches` | `list_all_batches` | — |
| `GET` | `/items/{item_id}/batches` | `list_batches` | — |
| `POST` | `/items/{item_id}/batches` | `create_batch` | — |
| `GET` | `/batches/{batch_id}` | `get_batch` | — |

### `GET /suppliers`

**Function:** `list_suppliers` (line 229)

**Parameters:** `search`, `skip`, `limit`

**Auth:** `current_user`


### `POST /suppliers`

**Function:** `create_supplier` (line 263)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /suppliers/{supplier_id}`

**Function:** `get_supplier` (line 283)

**Parameters:** `supplier_id`

**Auth:** `current_user`


### `PUT /suppliers/{supplier_id}`

**Function:** `update_supplier` (line 299)

**Parameters:** `supplier_id`, `payload`

**Auth:** `current_user`


### `DELETE /suppliers/{supplier_id}`

**Function:** `delete_supplier` (line 323)

**Parameters:** `supplier_id`

**Auth:** `current_user`


### `POST /stock-adjustments`

**Function:** `create_stock_adjustment` (line 345)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /stock-adjustments`

**Function:** `list_stock_adjustments` (line 437)

**Parameters:** `item_id`, `warehouse_id`, `skip`, `limit`

**Auth:** `current_user`


### `GET /items/{item_id}/history`

**Function:** `item_history` (line 484)

**Parameters:** `item_id`, `warehouse_id`, `skip`, `limit`

**Auth:** `current_user`


### `GET /valuation`

**Function:** `stock_valuation` (line 521)

**Parameters:** `warehouse_id`

**Auth:** `current_user`


### `POST /counts`

**Function:** `create_count` (line 591)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /counts/{count_id}`

**Function:** `update_count` (line 642)

**Parameters:** `count_id`, `payload`

**Auth:** `current_user`


### `GET /counts`

**Function:** `list_counts` (line 724)

**Parameters:** `warehouse_id`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `GET /reports/turnover`

**Function:** `turnover_report` (line 755)

Turnover = total issued quantity / average stock on hand per item
over the specified number of days.

**Parameters:** `days`, `warehouse_id`

**Auth:** `current_user`


### `GET /reports/aging`

**Function:** `aging_report` (line 845)

Shows how long stock has been sitting. Uses the last receipt date as proxy
for stock age. Buckets: 0-30 days, 31-60, 61-90, 90+ days.

**Parameters:** `warehouse_id`

**Auth:** `current_user`


### `POST /items/import`

**Function:** `import_items` (line 946)

CSV columns: sku, name, description, category, unit_of_measure,
cost_price, selling_price, reorder_level

**Parameters:** `file`

**Auth:** `current_user`


### `GET /items/{item_id}/variants`

**Function:** `list_variants` (line 1033)

**Parameters:** `item_id`

**Auth:** `current_user`


### `POST /items/{item_id}/variants`

**Function:** `create_variant` (line 1062)

**Parameters:** `item_id`, `payload`

**Auth:** `current_user`


### `PUT /variants/{variant_id}`

**Function:** `update_variant` (line 1100)

**Parameters:** `variant_id`, `payload`

**Auth:** `current_user`


### `DELETE /variants/{variant_id}`

**Function:** `delete_variant` (line 1134)

**Parameters:** `variant_id`

**Auth:** `current_user`


### `GET /batches`

**Function:** `list_all_batches` (line 1151)

**Parameters:** `item_id`, `warehouse_id`, `skip`, `limit`

**Auth:** `current_user`


### `GET /items/{item_id}/batches`

**Function:** `list_batches` (line 1192)

**Parameters:** `item_id`

**Auth:** `current_user`


### `POST /items/{item_id}/batches`

**Function:** `create_batch` (line 1217)

**Parameters:** `item_id`, `payload`

**Auth:** `current_user`


### `GET /batches/{batch_id}`

**Function:** `get_batch` (line 1256)

**Parameters:** `batch_id`

**Auth:** `current_user`


---

## inventory_kits.py

Inventory Phase 4 — Kits/Bundles, Supplier Pricing, Landed Costs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/kits` | `list_kits` | — |
| `POST` | `/kits` | `create_kit` | — |
| `GET` | `/kits/{kit_id}/check-availability` | `check_kit_availability` | Check if sufficient components are available to assemble the kit. |
| `GET` | `/supplier-prices` | `list_supplier_prices` | — |
| `POST` | `/supplier-prices` | `create_supplier_price` | — |
| `GET` | `/supplier-prices/best-price` | `best_price` | — |
| `GET` | `/landed-costs` | `list_landed_costs` | — |
| `POST` | `/landed-costs` | `create_landed_cost` | — |
| `POST` | `/landed-costs/{voucher_id}/apply` | `apply_landed_cost` | Allocate landed costs to PO line items and mark voucher as applied. |

### `GET /kits`

**Function:** `list_kits` (line 54)

**Auth:** `_`


### `POST /kits`

**Function:** `create_kit` (line 78)

**Parameters:** `payload`

**Response model:** `KitOut`

**Auth:** `_`


### `GET /kits/{kit_id}/check-availability`

**Function:** `check_kit_availability` (line 102)

Check if sufficient components are available to assemble the kit.

**Parameters:** `kit_id`, `warehouse_id`, `quantity`

**Auth:** `_`


### `GET /supplier-prices`

**Function:** `list_supplier_prices` (line 158)

**Parameters:** `item_id`, `supplier_id`

**Auth:** `_`


### `POST /supplier-prices`

**Function:** `create_supplier_price` (line 180)

**Parameters:** `payload`

**Response model:** `SupplierPriceOut`

**Auth:** `_`


### `GET /supplier-prices/best-price`

**Function:** `best_price` (line 195)

**Parameters:** `item_id`, `quantity`

**Auth:** `_`


### `GET /landed-costs`

**Function:** `list_landed_costs` (line 252)

**Auth:** `_`


### `POST /landed-costs`

**Function:** `create_landed_cost` (line 268)

**Parameters:** `payload`

**Response model:** `LandedCostVoucherOut`

**Auth:** `current_user`


### `POST /landed-costs/{voucher_id}/apply`

**Function:** `apply_landed_cost` (line 290)

Allocate landed costs to PO line items and mark voucher as applied.

**Parameters:** `voucher_id`, `allocation_method`

**Auth:** `current_user`


---

## inventory_replenishment.py

Inventory Phase 3 — Replenishment Rules, Purchase Suggestions, ABC/XYZ Analysis.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/purchase-suggestions` | `list_suggestions` | — |
| `POST` | `/purchase-suggestions/run` | `run_replenishment_check` | Scan all items and generate purchase suggestions for those below reorder level. |
| `POST` | `/purchase-suggestions/{suggestion_id}/accept` | `accept_suggestion` | — |
| `POST` | `/purchase-suggestions/{suggestion_id}/dismiss` | `dismiss_suggestion` | — |
| `POST` | `/purchase-suggestions/bulk-accept` | `bulk_accept_suggestions` | — |
| `GET` | `/abc-analysis` | `list_abc_analysis` | — |
| `POST` | `/abc-analysis/calculate` | `calculate_abc` | Calculate ABC classification based on annual consumption value. |
| `GET` | `/abc-analysis/summary` | `abc_summary` | — |
| `GET` | `/overstock-alerts` | `overstock_alerts` | Return items where quantity_on_hand > max_stock_level. |

### `GET /purchase-suggestions`

**Function:** `list_suggestions` (line 39)

**Parameters:** `status`

**Auth:** `_`


### `POST /purchase-suggestions/run`

**Function:** `run_replenishment_check` (line 56)

Scan all items and generate purchase suggestions for those below reorder level.

**Auth:** `current_user`


### `POST /purchase-suggestions/{suggestion_id}/accept`

**Function:** `accept_suggestion` (line 90)

**Parameters:** `suggestion_id`

**Auth:** `_`


### `POST /purchase-suggestions/{suggestion_id}/dismiss`

**Function:** `dismiss_suggestion` (line 99)

**Parameters:** `suggestion_id`

**Auth:** `_`


### `POST /purchase-suggestions/bulk-accept`

**Function:** `bulk_accept_suggestions` (line 108)

**Parameters:** `ids`

**Auth:** `_`


### `GET /abc-analysis`

**Function:** `list_abc_analysis` (line 134)

**Parameters:** `warehouse_id`

**Auth:** `_`


### `POST /abc-analysis/calculate`

**Function:** `calculate_abc` (line 152)

Calculate ABC classification based on annual consumption value.

**Parameters:** `warehouse_id`

**Auth:** `_`


### `GET /abc-analysis/summary`

**Function:** `abc_summary` (line 213)

**Auth:** `_`


### `GET /overstock-alerts`

**Function:** `overstock_alerts` (line 225)

Return items where quantity_on_hand > max_stock_level.

**Auth:** `_`


---

## inventory_serial_uom.py

Inventory Phase 1 — Serial Numbers, Units of Measure, Blanket Orders, Three-Way Match.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/uom` | `list_uom` | — |
| `POST` | `/uom` | `create_uom` | — |
| `PATCH` | `/uom/{uom_id}` | `update_uom` | — |
| `DELETE` | `/uom/{uom_id}` | `delete_uom` | — |
| `GET` | `/uom/conversions` | `list_uom_conversions` | — |
| `POST` | `/uom/conversions` | `create_uom_conversion` | — |
| `POST` | `/uom/convert` | `convert_value` | — |
| `GET` | `/serials` | `list_serials` | — |
| `POST` | `/serials` | `create_serial` | — |
| `GET` | `/serials/{serial_id}` | `get_serial` | — |
| `PATCH` | `/serials/{serial_id}` | `update_serial` | — |
| `GET` | `/serials/{serial_id}/trace` | `trace_serial` | Forward/backward traceability for a serial number. |
| `GET` | `/blanket-orders` | `list_blanket_orders` | — |
| `POST` | `/blanket-orders` | `create_blanket_order` | — |
| `GET` | `/blanket-orders/{bo_id}` | `get_blanket_order` | — |
| `PATCH` | `/blanket-orders/{bo_id}` | `update_blanket_order` | — |
| `POST` | `/blanket-orders/{bo_id}/release` | `release_blanket_order` | Record that a PO has been released against this blanket order. |
| `GET` | `/purchase-orders/{po_id}/match-status` | `get_match_status` | — |
| `POST` | `/purchase-orders/{po_id}/match` | `perform_match` | Run three-way match: PO qty vs received qty vs invoice. |

### `GET /uom`

**Function:** `list_uom` (line 70)

**Parameters:** `category`

**Auth:** `_`


### `POST /uom`

**Function:** `create_uom` (line 78)

**Parameters:** `payload`, `_`

**Response model:** `UoMOut`


### `PATCH /uom/{uom_id}`

**Function:** `update_uom` (line 86)

**Parameters:** `uom_id`, `payload`, `_`

**Response model:** `UoMOut`


### `DELETE /uom/{uom_id}`

**Function:** `delete_uom` (line 97)

**Parameters:** `uom_id`, `_`


### `GET /uom/conversions`

**Function:** `list_uom_conversions` (line 105)

**Parameters:** `item_id`

**Auth:** `_`


### `POST /uom/conversions`

**Function:** `create_uom_conversion` (line 124)

**Parameters:** `payload`, `_`

**Response model:** `UoMConversionOut`


### `POST /uom/convert`

**Function:** `convert_value` (line 132)

**Parameters:** `payload`

**Auth:** `_`


### `GET /serials`

**Function:** `list_serials` (line 186)

**Parameters:** `item_id`, `status`, `warehouse_id`

**Auth:** `_`


### `POST /serials`

**Function:** `create_serial` (line 213)

**Parameters:** `payload`

**Response model:** `SerialOut`

**Auth:** `current_user`


### `GET /serials/{serial_id}`

**Function:** `get_serial` (line 227)

**Parameters:** `serial_id`

**Response model:** `SerialOut`

**Auth:** `_`


### `PATCH /serials/{serial_id}`

**Function:** `update_serial` (line 240)

**Parameters:** `serial_id`, `payload`

**Response model:** `SerialOut`

**Auth:** `_`


### `GET /serials/{serial_id}/trace`

**Function:** `trace_serial` (line 257)

Forward/backward traceability for a serial number.

**Parameters:** `serial_id`

**Auth:** `_`


### `GET /blanket-orders`

**Function:** `list_blanket_orders` (line 327)

**Parameters:** `status`

**Auth:** `_`


### `POST /blanket-orders`

**Function:** `create_blanket_order` (line 336)

**Parameters:** `payload`

**Response model:** `BlanketOrderOut`

**Auth:** `current_user`


### `GET /blanket-orders/{bo_id}`

**Function:** `get_blanket_order` (line 344)

**Parameters:** `bo_id`

**Response model:** `BlanketOrderOut`

**Auth:** `_`


### `PATCH /blanket-orders/{bo_id}`

**Function:** `update_blanket_order` (line 351)

**Parameters:** `bo_id`, `payload`

**Response model:** `BlanketOrderOut`

**Auth:** `_`


### `POST /blanket-orders/{bo_id}/release`

**Function:** `release_blanket_order` (line 362)

Record that a PO has been released against this blanket order.

**Parameters:** `bo_id`, `release_value`

**Auth:** `current_user`


### `GET /purchase-orders/{po_id}/match-status`

**Function:** `get_match_status` (line 383)

**Parameters:** `po_id`

**Auth:** `_`


### `POST /purchase-orders/{po_id}/match`

**Function:** `perform_match` (line 411)

Run three-way match: PO qty vs received qty vs invoice.

**Parameters:** `po_id`

**Auth:** `_`


---

## inventory_wms.py

Inventory Phase 2 — Warehouse Management System (zones, bins, putaway, pick-pack-ship).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/warehouses/{warehouse_id}/zones` | `list_zones` | — |
| `POST` | `/warehouses/{warehouse_id}/zones` | `create_zone` | — |
| `PATCH` | `/zones/{zone_id}` | `update_zone` | — |
| `GET` | `/zones/{zone_id}/bins` | `list_bins` | — |
| `POST` | `/zones/{zone_id}/bins` | `create_bin` | — |
| `POST` | `/zones/{zone_id}/bins/bulk` | `bulk_create_bins` | — |
| `GET` | `/bins/{bin_id}/contents` | `get_bin_contents` | — |
| `GET` | `/putaway-rules` | `list_putaway_rules` | — |
| `POST` | `/putaway-rules` | `create_putaway_rule` | — |
| `POST` | `/putaway-rules/suggest` | `suggest_putaway` | Return the best bin for an incoming item based on putaway rules. |
| `GET` | `/pick-lists` | `list_pick_lists` | — |
| `POST` | `/pick-lists` | `create_pick_list` | — |
| `PATCH` | `/pick-lists/{pick_id}/status` | `update_pick_list_status` | — |
| `PATCH` | `/pick-lists/{pick_id}/lines/{line_id}/pick` | `record_pick` | — |

### `GET /warehouses/{warehouse_id}/zones`

**Function:** `list_zones` (line 133)

**Parameters:** `warehouse_id`

**Auth:** `_`


### `POST /warehouses/{warehouse_id}/zones`

**Function:** `create_zone` (line 138)

**Parameters:** `warehouse_id`, `payload`

**Response model:** `ZoneOut`

**Auth:** `_`


### `PATCH /zones/{zone_id}`

**Function:** `update_zone` (line 146)

**Parameters:** `zone_id`, `name`, `zone_type`, `is_active`

**Response model:** `ZoneOut`

**Auth:** `_`


### `GET /zones/{zone_id}/bins`

**Function:** `list_bins` (line 163)

**Parameters:** `zone_id`

**Auth:** `_`


### `POST /zones/{zone_id}/bins`

**Function:** `create_bin` (line 168)

**Parameters:** `zone_id`, `payload`

**Response model:** `BinOut`

**Auth:** `_`


### `POST /zones/{zone_id}/bins/bulk`

**Function:** `bulk_create_bins` (line 176)

**Parameters:** `zone_id`, `payload`

**Auth:** `_`


### `GET /bins/{bin_id}/contents`

**Function:** `get_bin_contents` (line 188)

**Parameters:** `bin_id`

**Auth:** `_`


### `GET /putaway-rules`

**Function:** `list_putaway_rules` (line 206)

**Parameters:** `warehouse_id`

**Auth:** `_`


### `POST /putaway-rules`

**Function:** `create_putaway_rule` (line 214)

**Parameters:** `payload`

**Response model:** `PutawayRuleOut`

**Auth:** `_`


### `POST /putaway-rules/suggest`

**Function:** `suggest_putaway` (line 222)

Return the best bin for an incoming item based on putaway rules.

**Parameters:** `item_id`, `warehouse_id`

**Auth:** `_`


### `GET /pick-lists`

**Function:** `list_pick_lists` (line 242)

**Parameters:** `warehouse_id`, `status`

**Auth:** `_`


### `POST /pick-lists`

**Function:** `create_pick_list` (line 270)

**Parameters:** `payload`

**Response model:** `PickListOut`

**Auth:** `current_user`


### `PATCH /pick-lists/{pick_id}/status`

**Function:** `update_pick_list_status` (line 304)

**Parameters:** `pick_id`, `status`

**Auth:** `current_user`


### `PATCH /pick-lists/{pick_id}/lines/{line_id}/pick`

**Function:** `record_pick` (line 321)

**Parameters:** `pick_id`, `line_id`, `quantity_picked`

**Auth:** `_`

