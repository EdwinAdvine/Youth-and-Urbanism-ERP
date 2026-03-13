# Perf — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 6


## Contents

- [perf.py](#perf) (6 endpoints)

---

## perf.py

Performance monitoring endpoints for the Admin Performance Dashboard.

All endpoints require Super Admin access.

Endpoints:
    GET /perf/db-stats        — Top slow queries from pg_stat_statements
    GET /perf/db-pool         — SQLAlchemy engine pool stats
    GET /perf/cache-stats     — Redis memory + keyspace stats
    GET /perf/endpoint-timing — Per-endpoint p50/p95/p99 from Redis
    POST /perf/web-vitals     — Receive Core Web Vitals from frontend


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/db-stats` | `db_stats` | Return the slowest queries by mean execution time. |
| `GET` | `/db-pool` | `db_pool_stats` | Return current connection pool utilization. |
| `GET` | `/cache-stats` | `cache_stats` | Return Redis INFO for memory usage and keyspace hits/misses. |
| `GET` | `/endpoint-timing` | `endpoint_timing` | Return p50/p95/p99 response times per endpoint from Redis. |
| `POST` | `/web-vitals` | `store_web_vitals` | Store Core Web Vitals batch from frontend. |
| `GET` | `/web-vitals/summary` | `web_vitals_summary` | Return average Core Web Vitals grouped by metric name. |

### `GET /db-stats`

**Function:** `db_stats` (line 28)

Return the slowest queries by mean execution time.

**Parameters:** `limit`

**Auth:** `_admin`


### `GET /db-pool`

**Function:** `db_pool_stats` (line 69)

Return current connection pool utilization.

**Auth:** `_admin`


### `GET /cache-stats`

**Function:** `cache_stats` (line 84)

Return Redis INFO for memory usage and keyspace hits/misses.

**Auth:** `_admin`


### `GET /endpoint-timing`

**Function:** `endpoint_timing` (line 108)

Return p50/p95/p99 response times per endpoint from Redis.

**Auth:** `_admin`


### `POST /web-vitals`

**Function:** `store_web_vitals` (line 161)

Store Core Web Vitals batch from frontend.

Payload: { "metrics": [{"name": "LCP", "value": 1234, "rating": "good", "url": "..."}, ...] }

**Parameters:** `payload`


### `GET /web-vitals/summary`

**Function:** `web_vitals_summary` (line 195)

Return average Core Web Vitals grouped by metric name.

**Auth:** `_admin`

