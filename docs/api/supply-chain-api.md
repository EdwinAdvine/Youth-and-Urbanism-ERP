# Supply Chain — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 152


## Contents

- [supplychain.py](#supplychain) (24 endpoints)
- [supplychain_ext.py](#supplychain-ext) (18 endpoints)
- [supplychain_logistics.py](#supplychain-logistics) (23 endpoints)
- [supplychain_ops.py](#supplychain-ops) (48 endpoints)
- [supplychain_planning.py](#supplychain-planning) (22 endpoints)
- [supplychain_risk.py](#supplychain-risk) (17 endpoints)

---

## supplychain.py

Supply Chain API — Suppliers, Requisitions, GRNs, Returns, Dashboard.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/suppliers` | `list_suppliers` | — |
| `POST` | `/suppliers` | `create_supplier` | — |
| `GET` | `/suppliers/export` | `export_suppliers` | Download all suppliers as a CSV file. |
| `GET` | `/suppliers/{supplier_id}` | `get_supplier` | — |
| `PUT` | `/suppliers/{supplier_id}` | `update_supplier` | — |
| `DELETE` | `/suppliers/{supplier_id}` | `delete_supplier` | — |
| `GET` | `/requisitions` | `list_requisitions` | — |
| `POST` | `/requisitions` | `create_requisition` | — |
| `GET` | `/requisitions/{req_id}` | `get_requisition` | — |
| `PUT` | `/requisitions/{req_id}` | `update_requisition` | — |
| `POST` | `/requisitions/{req_id}/submit` | `submit_requisition` | — |
| `POST` | `/requisitions/{req_id}/approve` | `approve_requisition` | — |
| `POST` | `/requisitions/{req_id}/convert-to-po` | `convert_requisition_to_po` | — |
| `GET` | `/grn` | `list_grns` | — |
| `POST` | `/grn` | `create_grn` | — |
| `GET` | `/grn/{grn_id}` | `get_grn` | — |
| `POST` | `/grn/{grn_id}/accept` | `accept_grn` | — |
| `POST` | `/grn/{grn_id}/reject` | `reject_grn` | — |
| `GET` | `/returns` | `list_returns` | — |
| `POST` | `/returns` | `create_return` | — |
| `GET` | `/returns/{return_id}` | `get_return` | — |
| `POST` | `/returns/{return_id}/approve` | `approve_return` | — |
| `POST` | `/returns/{return_id}/complete` | `complete_return` | — |
| `GET` | `/dashboard/stats` | `supply_chain_dashboard` | — |

### `GET /suppliers`

**Function:** `list_suppliers` (line 286)

**Parameters:** `search`, `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /suppliers`

**Function:** `create_supplier` (line 325)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /suppliers/export`

**Function:** `export_suppliers` (line 354)

Download all suppliers as a CSV file.

**Auth:** `current_user`


### `GET /suppliers/{supplier_id}`

**Function:** `get_supplier` (line 385)

**Parameters:** `supplier_id`

**Auth:** `current_user`


### `PUT /suppliers/{supplier_id}`

**Function:** `update_supplier` (line 401)

**Parameters:** `supplier_id`, `payload`

**Auth:** `current_user`


### `DELETE /suppliers/{supplier_id}`

**Function:** `delete_supplier` (line 425)

**Parameters:** `supplier_id`

**Auth:** `current_user`


### `GET /requisitions`

**Function:** `list_requisitions` (line 444)

**Parameters:** `status_filter`, `priority`, `skip`, `limit`

**Auth:** `current_user`


### `POST /requisitions`

**Function:** `create_requisition` (line 478)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /requisitions/{req_id}`

**Function:** `get_requisition` (line 534)

**Parameters:** `req_id`

**Auth:** `current_user`


### `PUT /requisitions/{req_id}`

**Function:** `update_requisition` (line 555)

**Parameters:** `req_id`, `payload`

**Auth:** `current_user`


### `POST /requisitions/{req_id}/submit`

**Function:** `submit_requisition` (line 628)

**Parameters:** `req_id`

**Auth:** `current_user`


### `POST /requisitions/{req_id}/approve`

**Function:** `approve_requisition` (line 654)

**Parameters:** `req_id`, `action`

**Auth:** `current_user`


### `POST /requisitions/{req_id}/convert-to-po`

**Function:** `convert_requisition_to_po` (line 689)

**Parameters:** `req_id`

**Auth:** `current_user`


### `GET /grn`

**Function:** `list_grns` (line 782)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /grn`

**Function:** `create_grn` (line 813)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /grn/{grn_id}`

**Function:** `get_grn` (line 878)

**Parameters:** `grn_id`

**Auth:** `current_user`


### `POST /grn/{grn_id}/accept`

**Function:** `accept_grn` (line 899)

**Parameters:** `grn_id`

**Auth:** `current_user`


### `POST /grn/{grn_id}/reject`

**Function:** `reject_grn` (line 1008)

**Parameters:** `grn_id`

**Auth:** `current_user`


### `GET /returns`

**Function:** `list_returns` (line 1034)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /returns`

**Function:** `create_return` (line 1065)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /returns/{return_id}`

**Function:** `get_return` (line 1126)

**Parameters:** `return_id`

**Auth:** `current_user`


### `POST /returns/{return_id}/approve`

**Function:** `approve_return` (line 1147)

**Parameters:** `return_id`

**Auth:** `current_user`


### `POST /returns/{return_id}/complete`

**Function:** `complete_return` (line 1173)

**Parameters:** `return_id`

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `supply_chain_dashboard` (line 1243)

**Auth:** `current_user`


---

## supplychain_ext.py

Supply Chain Extensions — Shipments, Returns, Quality Inspections, Ratings, Contracts, Reports.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/shipments` | `list_shipments` | — |
| `POST` | `/shipments` | `create_shipment` | — |
| `GET` | `/shipments/{shipment_id}` | `get_shipment` | — |
| `PUT` | `/shipments/{shipment_id}/track` | `update_shipment_tracking` | — |
| `GET` | `/returns` | `list_return_orders` | — |
| `POST` | `/returns` | `create_return_order` | — |
| `GET` | `/returns/{return_id}` | `get_return_order` | — |
| `PUT` | `/returns/{return_id}` | `update_return_order` | — |
| `GET` | `/quality-inspections` | `list_quality_inspections` | — |
| `POST` | `/quality-inspections` | `create_quality_inspection` | — |
| `GET` | `/supplier-ratings` | `list_supplier_ratings` | — |
| `POST` | `/supplier-ratings` | `create_supplier_rating` | — |
| `GET` | `/contracts` | `list_contracts` | — |
| `POST` | `/contracts` | `create_contract` | — |
| `GET` | `/contracts/{contract_id}` | `get_contract` | — |
| `PUT` | `/contracts/{contract_id}` | `update_contract` | — |
| `GET` | `/reports/lead-times` | `report_lead_times` | Calculate average lead times from shipment creation to delivery per carrier. |
| `GET` | `/reports/supplier-performance` | `report_supplier_performance` | Aggregate supplier ratings into an overall performance view. |

### `GET /shipments`

**Function:** `list_shipments` (line 177)

**Parameters:** `status_filter`, `order_id`, `skip`, `limit`

**Auth:** `current_user`


### `POST /shipments`

**Function:** `create_shipment` (line 210)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /shipments/{shipment_id}`

**Function:** `get_shipment` (line 237)

**Parameters:** `shipment_id`

**Auth:** `current_user`


### `PUT /shipments/{shipment_id}/track`

**Function:** `update_shipment_tracking` (line 253)

**Parameters:** `shipment_id`, `payload`

**Auth:** `current_user`


### `GET /returns`

**Function:** `list_return_orders` (line 283)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /returns`

**Function:** `create_return_order` (line 313)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /returns/{return_id}`

**Function:** `get_return_order` (line 330)

**Parameters:** `return_id`

**Auth:** `current_user`


### `PUT /returns/{return_id}`

**Function:** `update_return_order` (line 346)

**Parameters:** `return_id`, `payload`

**Auth:** `current_user`


### `GET /quality-inspections`

**Function:** `list_quality_inspections` (line 369)

**Parameters:** `goods_receipt_id`, `result_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /quality-inspections`

**Function:** `create_quality_inspection` (line 402)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /supplier-ratings`

**Function:** `list_supplier_ratings` (line 437)

**Parameters:** `supplier_id`, `period`, `skip`, `limit`

**Auth:** `current_user`


### `POST /supplier-ratings`

**Function:** `create_supplier_rating` (line 470)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /contracts`

**Function:** `list_contracts` (line 498)

**Parameters:** `supplier_id`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /contracts`

**Function:** `create_contract` (line 531)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /contracts/{contract_id}`

**Function:** `get_contract` (line 562)

**Parameters:** `contract_id`

**Auth:** `current_user`


### `PUT /contracts/{contract_id}`

**Function:** `update_contract` (line 578)

**Parameters:** `contract_id`, `payload`

**Auth:** `current_user`


### `GET /reports/lead-times`

**Function:** `report_lead_times` (line 601)

Calculate average lead times from shipment creation to delivery per carrier.

**Auth:** `current_user`


### `GET /reports/supplier-performance`

**Function:** `report_supplier_performance` (line 638)

Aggregate supplier ratings into an overall performance view.

**Auth:** `current_user`


---

## supplychain_logistics.py

supplychain_logistics.py — Supply Chain Phase 2 Logistics router.

Endpoints (~18) covering:
  - Carriers          CRUD + soft-delete
  - Routes            CRUD + hard-delete
  - Transport Orders  list / create / get / status-update / tracking-event / freight costs
  - Dock Schedules    list / create / update (with dock-door conflict check)
  - Yard Slots        list / assign / release


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/logistics/carriers` | `list_carriers` | List all carriers with optional filters. |
| `POST` | `/logistics/carriers` | `create_carrier` | Create a new carrier. |
| `GET` | `/logistics/carriers/{carrier_id}` | `get_carrier` | Get a single carrier by ID. |
| `PUT` | `/logistics/carriers/{carrier_id}` | `update_carrier` | Update carrier fields. |
| `DELETE` | `/logistics/carriers/{carrier_id}` | `delete_carrier` | Soft-delete a carrier by setting is_active=False. |
| `GET` | `/logistics/routes` | `list_routes` | List shipping routes with optional filters. |
| `POST` | `/logistics/routes` | `create_route` | Create a new shipping route. |
| `GET` | `/logistics/routes/{route_id}` | `get_route` | Get a single route by ID. |
| `PUT` | `/logistics/routes/{route_id}` | `update_route` | Update route fields. |
| `DELETE` | `/logistics/routes/{route_id}` | `delete_route` | Hard-delete a route. |
| `GET` | `/logistics/transport-orders` | `list_transport_orders` | List transport orders with optional filters. |
| `POST` | `/logistics/transport-orders` | `create_transport_order` | Create a transport order with an auto-generated reference (TO-YYYYMMDD-xxxxxx... |
| `GET` | `/logistics/transport-orders/{order_id}` | `get_transport_order` | Get a single transport order by ID. |
| `PUT` | `/logistics/transport-orders/{order_id}/status` | `update_transport_order_status` | Update transport order status (validated transitions only). |
| `POST` | `/logistics/transport-orders/{order_id}/tracking-event` | `append_tracking_event` | Append a new tracking event to the order's tracking_events JSON array. |
| `GET` | `/logistics/transport-orders/{order_id}/freight-costs` | `list_freight_costs` | List all freight cost lines for a transport order. |
| `POST` | `/logistics/transport-orders/{order_id}/freight-costs` | `add_freight_cost` | Add a freight cost line to a transport order. |
| `GET` | `/logistics/dock-schedules` | `list_dock_schedules` | List dock appointments with optional direction, status, and date-range filters. |
| `POST` | `/logistics/dock-schedules` | `create_dock_schedule` | Create a dock appointment. No conflict check on creation (use update to resol... |
| `PUT` | `/logistics/dock-schedules/{schedule_id}` | `update_dock_schedule` | Update a dock schedule. Checks for dock-door time-window conflicts. |
| `GET` | `/logistics/yard-slots` | `list_yard_slots` | List all yard slots with their current status. |
| `PUT` | `/logistics/yard-slots/{slot_id}/assign` | `assign_yard_slot` | Assign a transport order to a yard slot (slot must be available). |
| `PUT` | `/logistics/yard-slots/{slot_id}/release` | `release_yard_slot` | Release an occupied yard slot back to available. |

### `GET /logistics/carriers`

**Function:** `list_carriers` (line 190)

List all carriers with optional filters.

**Parameters:** `is_active`, `carrier_type`

**Auth:** `user`


### `POST /logistics/carriers`

**Function:** `create_carrier` (line 209)

Create a new carrier.

**Parameters:** `body`

**Auth:** `user`


### `GET /logistics/carriers/{carrier_id}`

**Function:** `get_carrier` (line 219)

Get a single carrier by ID.

**Parameters:** `carrier_id`

**Auth:** `user`


### `PUT /logistics/carriers/{carrier_id}`

**Function:** `update_carrier` (line 226)

Update carrier fields.

**Parameters:** `carrier_id`, `body`

**Auth:** `user`


### `DELETE /logistics/carriers/{carrier_id}`

**Function:** `delete_carrier` (line 237)

Soft-delete a carrier by setting is_active=False.

**Parameters:** `carrier_id`

**Auth:** `user`


### `GET /logistics/routes`

**Function:** `list_routes` (line 250)

List shipping routes with optional filters.

**Parameters:** `carrier_id`, `origin_country`, `destination_country`

**Auth:** `user`


### `POST /logistics/routes`

**Function:** `create_route` (line 272)

Create a new shipping route.

**Parameters:** `body`

**Auth:** `user`


### `GET /logistics/routes/{route_id}`

**Function:** `get_route` (line 282)

Get a single route by ID.

**Parameters:** `route_id`

**Auth:** `user`


### `PUT /logistics/routes/{route_id}`

**Function:** `update_route` (line 289)

Update route fields.

**Parameters:** `route_id`, `body`

**Auth:** `user`


### `DELETE /logistics/routes/{route_id}`

**Function:** `delete_route` (line 300)

Hard-delete a route.

**Parameters:** `route_id`

**Auth:** `user`


### `GET /logistics/transport-orders`

**Function:** `list_transport_orders` (line 313)

List transport orders with optional filters.

**Parameters:** `status`, `carrier_id`

**Auth:** `user`


### `POST /logistics/transport-orders`

**Function:** `create_transport_order` (line 332)

Create a transport order with an auto-generated reference (TO-YYYYMMDD-xxxxxxxx).

**Parameters:** `body`

**Auth:** `user`


### `GET /logistics/transport-orders/{order_id}`

**Function:** `get_transport_order` (line 351)

Get a single transport order by ID.

**Parameters:** `order_id`

**Auth:** `user`


### `PUT /logistics/transport-orders/{order_id}/status`

**Function:** `update_transport_order_status` (line 358)

Update transport order status (validated transitions only).

**Parameters:** `order_id`, `body`

**Auth:** `user`


### `POST /logistics/transport-orders/{order_id}/tracking-event`

**Function:** `append_tracking_event` (line 382)

Append a new tracking event to the order's tracking_events JSON array.

**Parameters:** `order_id`, `body`

**Auth:** `user`


### `GET /logistics/transport-orders/{order_id}/freight-costs`

**Function:** `list_freight_costs` (line 406)

List all freight cost lines for a transport order.

**Parameters:** `order_id`

**Auth:** `user`


### `POST /logistics/transport-orders/{order_id}/freight-costs`

**Function:** `add_freight_cost` (line 416)

Add a freight cost line to a transport order.

**Parameters:** `order_id`, `body`

**Auth:** `user`


### `GET /logistics/dock-schedules`

**Function:** `list_dock_schedules` (line 436)

List dock appointments with optional direction, status, and date-range filters.

**Parameters:** `direction`, `status`, `date_from`, `date_to`

**Auth:** `user`


### `POST /logistics/dock-schedules`

**Function:** `create_dock_schedule` (line 461)

Create a dock appointment. No conflict check on creation (use update to resolve).

**Parameters:** `body`

**Auth:** `user`


### `PUT /logistics/dock-schedules/{schedule_id}`

**Function:** `update_dock_schedule` (line 471)

Update a dock schedule. Checks for dock-door time-window conflicts.

**Parameters:** `schedule_id`, `body`

**Auth:** `user`


### `GET /logistics/yard-slots`

**Function:** `list_yard_slots` (line 520)

List all yard slots with their current status.

**Parameters:** `zone`, `status`

**Auth:** `user`


### `PUT /logistics/yard-slots/{slot_id}/assign`

**Function:** `assign_yard_slot` (line 534)

Assign a transport order to a yard slot (slot must be available).

**Parameters:** `slot_id`, `body`

**Auth:** `user`


### `PUT /logistics/yard-slots/{slot_id}/release`

**Function:** `release_yard_slot` (line 553)

Release an occupied yard slot back to available.

**Parameters:** `slot_id`

**Auth:** `user`


---

## supplychain_ops.py

Supply Chain Ops API — Control Tower, RFx, Risks, Replenishment, Workflows, Compliance, ESG, Analytics.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/control-tower/dashboard` | `control_tower_dashboard` | — |
| `GET` | `/control-tower/alerts` | `list_alerts` | — |
| `POST` | `/control-tower/alerts` | `create_alert` | — |
| `PUT` | `/control-tower/alerts/{alert_id}` | `update_alert` | — |
| `GET` | `/control-tower/kpis` | `list_kpis` | — |
| `POST` | `/control-tower/kpis/calculate` | `calculate_kpis` | Calculate key SC KPIs for the current period. |
| `GET` | `/control-tower/events` | `list_events` | — |
| `GET` | `/control-tower/health` | `sc_health` | — |
| `GET` | `/rfx` | `list_rfx` | — |
| `POST` | `/rfx` | `create_rfx` | — |
| `GET` | `/rfx/{rfx_id}` | `get_rfx` | — |
| `PUT` | `/rfx/{rfx_id}` | `update_rfx` | — |
| `POST` | `/rfx/{rfx_id}/publish` | `publish_rfx` | — |
| `POST` | `/rfx/{rfx_id}/close` | `close_rfx` | — |
| `POST` | `/rfx/{rfx_id}/award/{response_id}` | `award_rfx` | — |
| `GET` | `/rfx/{rfx_id}/responses` | `list_rfx_responses` | — |
| `POST` | `/rfx/{rfx_id}/responses` | `submit_rfx_response` | — |
| `PUT` | `/rfx/{rfx_id}/responses/{response_id}/score` | `score_rfx_response` | — |
| `GET` | `/supplier-risks` | `list_supplier_risks` | — |
| `POST` | `/supplier-risks` | `create_supplier_risk` | — |
| `GET` | `/replenishment-rules` | `list_replenishment_rules` | — |
| `POST` | `/replenishment-rules` | `create_replenishment_rule` | — |
| `PUT` | `/replenishment-rules/{rule_id}` | `update_replenishment_rule` | — |
| `DELETE` | `/replenishment-rules/{rule_id}` | `delete_replenishment_rule` | — |
| `POST` | `/replenishment-rules/check` | `check_replenishment` | — |
| `GET` | `/safety-stock` | `list_safety_stock` | — |
| `POST` | `/safety-stock/calculate` | `calculate_safety_stock` | Recalculate safety stock using demand variability method. |
| `PUT` | `/safety-stock/{config_id}` | `update_safety_stock` | — |
| `GET` | `/stock-health` | `list_stock_health` | — |
| `POST` | `/stock-health/analyze` | `analyze_stock_health` | Scan all stock levels and classify health status. |
| `GET` | `/workflows/templates` | `list_workflow_templates` | — |
| `POST` | `/workflows/templates` | `create_workflow_template` | — |
| `PUT` | `/workflows/templates/{template_id}` | `update_workflow_template` | — |
| `DELETE` | `/workflows/templates/{template_id}` | `deactivate_workflow_template` | — |
| `GET` | `/workflows/runs` | `list_workflow_runs` | — |
| `GET` | `/workflows/runs/{run_id}` | `get_workflow_run` | — |
| `POST` | `/workflows/trigger` | `trigger_workflow` | — |
| `POST` | `/workflows/runs/{run_id}/cancel` | `cancel_workflow_run` | — |
| `GET` | `/compliance` | `list_compliance` | — |
| `POST` | `/compliance` | `create_compliance` | — |
| `PUT` | `/compliance/{record_id}` | `update_compliance` | — |
| `GET` | `/esg-metrics` | `list_esg_metrics` | — |
| `POST` | `/esg-metrics` | `create_esg_metric` | — |
| `GET` | `/esg-metrics/summary` | `esg_summary` | — |
| `GET` | `/analytics/cost-to-serve` | `cost_to_serve` | — |
| `GET` | `/analytics/carbon-footprint` | `carbon_footprint` | — |
| `GET` | `/analytics/risk-heatmap` | `risk_heatmap` | — |
| `GET` | `/analytics/ai-summary` | `ai_summary` | — |

### `GET /control-tower/dashboard`

**Function:** `control_tower_dashboard` (line 393)

**Auth:** `current_user`


### `GET /control-tower/alerts`

**Function:** `list_alerts` (line 436)

**Parameters:** `severity`, `status_filter`, `alert_type`, `skip`, `limit`

**Auth:** `current_user`


### `POST /control-tower/alerts`

**Function:** `create_alert` (line 467)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /control-tower/alerts/{alert_id}`

**Function:** `update_alert` (line 497)

**Parameters:** `alert_id`, `payload`

**Auth:** `current_user`


### `GET /control-tower/kpis`

**Function:** `list_kpis` (line 519)

**Parameters:** `kpi_name`, `period`, `skip`, `limit`

**Auth:** `current_user`


### `POST /control-tower/kpis/calculate`

**Function:** `calculate_kpis` (line 547)

Calculate key SC KPIs for the current period.

**Auth:** `current_user`


### `GET /control-tower/events`

**Function:** `list_events` (line 588)

**Parameters:** `event_type`, `skip`, `limit`

**Auth:** `current_user`


### `GET /control-tower/health`

**Function:** `sc_health` (line 609)

**Auth:** `current_user`


### `GET /rfx`

**Function:** `list_rfx` (line 642)

**Parameters:** `rfx_type`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /rfx`

**Function:** `create_rfx` (line 670)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /rfx/{rfx_id}`

**Function:** `get_rfx` (line 692)

**Parameters:** `rfx_id`

**Auth:** `current_user`


### `PUT /rfx/{rfx_id}`

**Function:** `update_rfx` (line 713)

**Parameters:** `rfx_id`, `payload`

**Auth:** `current_user`


### `POST /rfx/{rfx_id}/publish`

**Function:** `publish_rfx` (line 735)

**Parameters:** `rfx_id`

**Auth:** `current_user`


### `POST /rfx/{rfx_id}/close`

**Function:** `close_rfx` (line 760)

**Parameters:** `rfx_id`

**Auth:** `current_user`


### `POST /rfx/{rfx_id}/award/{response_id}`

**Function:** `award_rfx` (line 779)

**Parameters:** `rfx_id`, `response_id`

**Auth:** `current_user`


### `GET /rfx/{rfx_id}/responses`

**Function:** `list_rfx_responses` (line 815)

**Parameters:** `rfx_id`

**Auth:** `current_user`


### `POST /rfx/{rfx_id}/responses`

**Function:** `submit_rfx_response` (line 834)

**Parameters:** `rfx_id`, `payload`

**Auth:** `current_user`


### `PUT /rfx/{rfx_id}/responses/{response_id}/score`

**Function:** `score_rfx_response` (line 865)

**Parameters:** `rfx_id`, `response_id`, `payload`

**Auth:** `current_user`


### `GET /supplier-risks`

**Function:** `list_supplier_risks` (line 894)

**Parameters:** `supplier_id`, `risk_type`, `severity`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /supplier-risks`

**Function:** `create_supplier_risk` (line 928)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /replenishment-rules`

**Function:** `list_replenishment_rules` (line 952)

**Parameters:** `item_id`, `warehouse_id`, `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /replenishment-rules`

**Function:** `create_replenishment_rule` (line 981)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /replenishment-rules/{rule_id}`

**Function:** `update_replenishment_rule` (line 1008)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /replenishment-rules/{rule_id}`

**Function:** `delete_replenishment_rule` (line 1033)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `POST /replenishment-rules/check`

**Function:** `check_replenishment` (line 1053)

**Auth:** `current_user`


### `GET /safety-stock`

**Function:** `list_safety_stock` (line 1098)

**Parameters:** `item_id`, `skip`, `limit`

**Auth:** `current_user`


### `POST /safety-stock/calculate`

**Function:** `calculate_safety_stock` (line 1121)

Recalculate safety stock using demand variability method.

**Parameters:** `item_ids`

**Auth:** `current_user`


### `PUT /safety-stock/{config_id}`

**Function:** `update_safety_stock` (line 1152)

**Parameters:** `config_id`, `payload`

**Auth:** `current_user`


### `GET /stock-health`

**Function:** `list_stock_health` (line 1176)

**Parameters:** `health_status`, `skip`, `limit`

**Auth:** `current_user`


### `POST /stock-health/analyze`

**Function:** `analyze_stock_health` (line 1201)

Scan all stock levels and classify health status.

**Auth:** `current_user`


### `GET /workflows/templates`

**Function:** `list_workflow_templates` (line 1270)

**Parameters:** `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /workflows/templates`

**Function:** `create_workflow_template` (line 1295)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /workflows/templates/{template_id}`

**Function:** `update_workflow_template` (line 1317)

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `DELETE /workflows/templates/{template_id}`

**Function:** `deactivate_workflow_template` (line 1340)

**Parameters:** `template_id`

**Auth:** `current_user`


### `GET /workflows/runs`

**Function:** `list_workflow_runs` (line 1357)

**Parameters:** `template_id`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `GET /workflows/runs/{run_id}`

**Function:** `get_workflow_run` (line 1381)

**Parameters:** `run_id`

**Auth:** `current_user`


### `POST /workflows/trigger`

**Function:** `trigger_workflow` (line 1406)

**Parameters:** `template_id`, `trigger_data`

**Auth:** `current_user`


### `POST /workflows/runs/{run_id}/cancel`

**Function:** `cancel_workflow_run` (line 1449)

**Parameters:** `run_id`

**Auth:** `current_user`


### `GET /compliance`

**Function:** `list_compliance` (line 1473)

**Parameters:** `entity_type`, `compliance_type`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /compliance`

**Function:** `create_compliance` (line 1504)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /compliance/{record_id}`

**Function:** `update_compliance` (line 1527)

**Parameters:** `record_id`, `payload`

**Auth:** `current_user`


### `GET /esg-metrics`

**Function:** `list_esg_metrics` (line 1550)

**Parameters:** `supplier_id`, `metric_type`, `period`, `skip`, `limit`

**Auth:** `current_user`


### `POST /esg-metrics`

**Function:** `create_esg_metric` (line 1581)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /esg-metrics/summary`

**Function:** `esg_summary` (line 1602)

**Parameters:** `period`

**Auth:** `current_user`


### `GET /analytics/cost-to-serve`

**Function:** `cost_to_serve` (line 1628)

**Auth:** `current_user`


### `GET /analytics/carbon-footprint`

**Function:** `carbon_footprint` (line 1645)

**Auth:** `current_user`


### `GET /analytics/risk-heatmap`

**Function:** `risk_heatmap` (line 1663)

**Auth:** `current_user`


### `GET /analytics/ai-summary`

**Function:** `ai_summary` (line 1685)

**Auth:** `current_user`


---

## supplychain_planning.py

Supply Chain Planning API — Demand Forecasting, S&OP, Supply Plans, Capacity.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/forecasts` | `list_forecasts` | — |
| `POST` | `/forecasts/generate` | `generate_forecasts` | — |
| `GET` | `/forecasts/{forecast_id}` | `get_forecast` | — |
| `DELETE` | `/forecasts/{forecast_id}` | `delete_forecast` | — |
| `POST` | `/forecasts/what-if` | `what_if_simulation` | Run what-if simulation — returns projected forecasts without persisting. |
| `GET` | `/forecast-scenarios` | `list_scenarios` | — |
| `POST` | `/forecast-scenarios` | `create_scenario` | — |
| `PUT` | `/forecast-scenarios/{scenario_id}` | `update_scenario` | — |
| `GET` | `/demand-signals` | `list_demand_signals` | — |
| `POST` | `/demand-signals` | `create_demand_signal` | — |
| `GET` | `/sop-plans` | `list_sop_plans` | — |
| `POST` | `/sop-plans` | `create_sop_plan` | — |
| `GET` | `/sop-plans/{sop_id}` | `get_sop_plan` | — |
| `PUT` | `/sop-plans/{sop_id}` | `update_sop_plan` | — |
| `POST` | `/sop-plans/{sop_id}/approve` | `approve_sop_plan` | — |
| `GET` | `/supply-plans` | `list_supply_plans` | — |
| `POST` | `/supply-plans/generate` | `generate_supply_plan` | — |
| `GET` | `/supply-plans/{plan_id}` | `get_supply_plan` | — |
| `PUT` | `/supply-plans/{plan_id}/lines/{line_id}` | `update_supply_plan_line` | — |
| `POST` | `/supply-plans/{plan_id}/execute` | `execute_supply_plan` | — |
| `GET` | `/capacity-plans` | `list_capacity_plans` | — |
| `POST` | `/capacity-plans` | `create_capacity_plan` | — |

### `GET /forecasts`

**Function:** `list_forecasts` (line 293)

**Parameters:** `item_id`, `scenario_id`, `period_type`, `skip`, `limit`

**Auth:** `current_user`


### `POST /forecasts/generate`

**Function:** `generate_forecasts` (line 326)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /forecasts/{forecast_id}`

**Function:** `get_forecast` (line 359)

**Parameters:** `forecast_id`

**Auth:** `current_user`


### `DELETE /forecasts/{forecast_id}`

**Function:** `delete_forecast` (line 379)

**Parameters:** `forecast_id`

**Auth:** `current_user`


### `POST /forecasts/what-if`

**Function:** `what_if_simulation` (line 395)

Run what-if simulation — returns projected forecasts without persisting.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /forecast-scenarios`

**Function:** `list_scenarios` (line 441)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /forecast-scenarios`

**Function:** `create_scenario` (line 466)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /forecast-scenarios/{scenario_id}`

**Function:** `update_scenario` (line 487)

**Parameters:** `scenario_id`, `payload`

**Auth:** `current_user`


### `GET /demand-signals`

**Function:** `list_demand_signals` (line 509)

**Parameters:** `signal_type`, `source_module`, `skip`, `limit`

**Auth:** `current_user`


### `POST /demand-signals`

**Function:** `create_demand_signal` (line 537)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /sop-plans`

**Function:** `list_sop_plans` (line 562)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /sop-plans`

**Function:** `create_sop_plan` (line 587)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /sop-plans/{sop_id}`

**Function:** `get_sop_plan` (line 609)

**Parameters:** `sop_id`

**Auth:** `current_user`


### `PUT /sop-plans/{sop_id}`

**Function:** `update_sop_plan` (line 627)

**Parameters:** `sop_id`, `payload`

**Auth:** `current_user`


### `POST /sop-plans/{sop_id}/approve`

**Function:** `approve_sop_plan` (line 651)

**Parameters:** `sop_id`

**Auth:** `current_user`


### `GET /supply-plans`

**Function:** `list_supply_plans` (line 678)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /supply-plans/generate`

**Function:** `generate_supply_plan` (line 704)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /supply-plans/{plan_id}`

**Function:** `get_supply_plan` (line 754)

**Parameters:** `plan_id`

**Auth:** `current_user`


### `PUT /supply-plans/{plan_id}/lines/{line_id}`

**Function:** `update_supply_plan_line` (line 777)

**Parameters:** `plan_id`, `line_id`, `payload`

**Auth:** `current_user`


### `POST /supply-plans/{plan_id}/execute`

**Function:** `execute_supply_plan` (line 804)

**Parameters:** `plan_id`

**Auth:** `current_user`


### `GET /capacity-plans`

**Function:** `list_capacity_plans` (line 840)

**Parameters:** `sop_id`, `resource_type`, `skip`, `limit`

**Auth:** `current_user`


### `POST /capacity-plans`

**Function:** `create_capacity_plan` (line 866)

**Parameters:** `payload`

**Auth:** `current_user`


---

## supplychain_risk.py

supplychain_risk.py — Supply Chain Risk Management & MRP (Material Requirements Planning).

Endpoints:
  Risk Assessments  — CRUD + nested scenarios / mitigation plans
  Risk Scenarios    — list + create per assessment
  Mitigation Plans  — list + create per assessment, status update
  MRP Runs          — list, create+trigger (simplified MRP calculation), get summary, get lines
  Production Schedules — list, create, update


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/supply-chain/risk/assessments` | `list_risk_assessments` | List risk assessments with optional filters. |
| `POST` | `/supply-chain/risk/assessments` | `create_risk_assessment` | Create a new risk assessment. Auto-computes risk_score = probability * impact... |
| `GET` | `/supply-chain/risk/assessments/{assessment_id}` | `get_risk_assessment` | Get a single risk assessment with nested scenarios and mitigation plan count. |
| `PUT` | `/supply-chain/risk/assessments/{assessment_id}` | `update_risk_assessment` | Update a risk assessment. Recomputes risk_score if probability or impact_scor... |
| `DELETE` | `/supply-chain/risk/assessments/{assessment_id}` | `delete_risk_assessment` | Delete a risk assessment (cascades to scenarios and mitigation plans). |
| `GET` | `/supply-chain/risk/assessments/{risk_id}/scenarios` | `list_risk_scenarios` | List all scenarios for a given risk assessment. |
| `POST` | `/supply-chain/risk/assessments/{risk_id}/scenarios` | `create_risk_scenario` | Create a what-if scenario for a risk assessment. |
| `GET` | `/supply-chain/risk/assessments/{risk_id}/mitigation-plans` | `list_mitigation_plans` | List all mitigation plans for a given risk assessment. |
| `POST` | `/supply-chain/risk/assessments/{risk_id}/mitigation-plans` | `create_mitigation_plan` | Create a mitigation plan for a risk assessment. |
| `PUT` | `/supply-chain/risk/mitigation-plans/{plan_id}/status` | `update_mitigation_plan_status` | Update the status of a mitigation plan. |
| `GET` | `/supply-chain/mrp/runs` | `list_mrp_runs` | List MRP runs, optionally filtered by status. |
| `POST` | `/supply-chain/mrp/runs` | `create_mrp_run` | Create and execute a simplified MRP run. |
| `GET` | `/supply-chain/mrp/runs/{run_id}` | `get_mrp_run` | Get a single MRP run with summary statistics. |
| `GET` | `/supply-chain/mrp/runs/{run_id}/lines` | `get_mrp_lines` | Get all MRP lines for a run, with optional filtering. |
| `GET` | `/supply-chain/production/schedules` | `list_production_schedules` | List production schedules with optional filters. |
| `POST` | `/supply-chain/production/schedules` | `create_production_schedule` | Create a new production schedule entry. |
| `PUT` | `/supply-chain/production/schedules/{schedule_id}` | `update_production_schedule` | Update a production schedule (status, confirmed_qty, actual start/end, etc.). |

### `GET /supply-chain/risk/assessments`

**Function:** `list_risk_assessments` (line 287)

List risk assessments with optional filters.

**Parameters:** `status`, `risk_level`, `risk_category`, `skip`, `limit`

**Auth:** `current_user`


### `POST /supply-chain/risk/assessments`

**Function:** `create_risk_assessment` (line 325)

Create a new risk assessment. Auto-computes risk_score = probability * impact_score.

**Parameters:** `payload`

**Response model:** `RiskAssessmentOut`

**Auth:** `current_user`


### `GET /supply-chain/risk/assessments/{assessment_id}`

**Function:** `get_risk_assessment` (line 363)

Get a single risk assessment with nested scenarios and mitigation plan count.

**Parameters:** `assessment_id`

**Response model:** `RiskAssessmentOut`

**Auth:** `current_user`


### `PUT /supply-chain/risk/assessments/{assessment_id}`

**Function:** `update_risk_assessment` (line 397)

Update a risk assessment. Recomputes risk_score if probability or impact_score changes.

**Parameters:** `assessment_id`, `payload`

**Response model:** `RiskAssessmentOut`

**Auth:** `current_user`


### `DELETE /supply-chain/risk/assessments/{assessment_id}`

**Function:** `delete_risk_assessment` (line 438)

Delete a risk assessment (cascades to scenarios and mitigation plans).

**Parameters:** `assessment_id`

**Auth:** `current_user`


### `GET /supply-chain/risk/assessments/{risk_id}/scenarios`

**Function:** `list_risk_scenarios` (line 460)

List all scenarios for a given risk assessment.

**Parameters:** `risk_id`

**Auth:** `current_user`


### `POST /supply-chain/risk/assessments/{risk_id}/scenarios`

**Function:** `create_risk_scenario` (line 487)

Create a what-if scenario for a risk assessment.

**Parameters:** `risk_id`, `payload`

**Response model:** `RiskScenarioOut`

**Auth:** `current_user`


### `GET /supply-chain/risk/assessments/{risk_id}/mitigation-plans`

**Function:** `list_mitigation_plans` (line 524)

List all mitigation plans for a given risk assessment.

**Parameters:** `risk_id`

**Auth:** `current_user`


### `POST /supply-chain/risk/assessments/{risk_id}/mitigation-plans`

**Function:** `create_mitigation_plan` (line 551)

Create a mitigation plan for a risk assessment.

**Parameters:** `risk_id`, `payload`

**Response model:** `MitigationPlanOut`

**Auth:** `current_user`


### `PUT /supply-chain/risk/mitigation-plans/{plan_id}/status`

**Function:** `update_mitigation_plan_status` (line 585)

Update the status of a mitigation plan.

**Parameters:** `plan_id`, `payload`

**Response model:** `MitigationPlanOut`

**Auth:** `current_user`


### `GET /supply-chain/mrp/runs`

**Function:** `list_mrp_runs` (line 612)

List MRP runs, optionally filtered by status.

**Parameters:** `status`, `skip`, `limit`

**Auth:** `current_user`


### `POST /supply-chain/mrp/runs`

**Function:** `create_mrp_run` (line 630)

Create and execute a simplified MRP run.

The MRP calculation:
1. Queries the inventory_items table for on-hand stock (via text() since the model lives in a
   different module).
2. For each product found (scoped to payload.product_ids when provided), generates MRPLine
   records across the planning horizon bucketed by week (or the requested bucket_size).
3. Sets action_type = 'new_po' when net_demand > 0.
4. Updates run summary stats and marks status = 'completed'.

**Parameters:** `payload`

**Response model:** `MRPRunOut`

**Auth:** `current_user`


### `GET /supply-chain/mrp/runs/{run_id}`

**Function:** `get_mrp_run` (line 763)

Get a single MRP run with summary statistics.

**Parameters:** `run_id`

**Response model:** `MRPRunOut`

**Auth:** `current_user`


### `GET /supply-chain/mrp/runs/{run_id}/lines`

**Function:** `get_mrp_lines` (line 789)

Get all MRP lines for a run, with optional filtering.

**Parameters:** `run_id`, `action_type`, `product_sku`, `skip`, `limit`

**Auth:** `current_user`


### `GET /supply-chain/production/schedules`

**Function:** `list_production_schedules` (line 820)

List production schedules with optional filters.

**Parameters:** `status`, `work_center`, `skip`, `limit`

**Auth:** `current_user`


### `POST /supply-chain/production/schedules`

**Function:** `create_production_schedule` (line 844)

Create a new production schedule entry.

**Parameters:** `payload`

**Response model:** `ProductionScheduleOut`

**Auth:** `current_user`


### `PUT /supply-chain/production/schedules/{schedule_id}`

**Function:** `update_production_schedule` (line 880)

Update a production schedule (status, confirmed_qty, actual start/end, etc.).

**Parameters:** `schedule_id`, `payload`

**Response model:** `ProductionScheduleOut`

**Auth:** `current_user`

