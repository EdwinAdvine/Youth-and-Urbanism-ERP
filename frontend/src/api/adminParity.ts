/**
 * Admin — Parity Audit API
 *
 * Fetches the backend parity audit results shown on Admin → Parity dashboard.
 * Checks that all SQLAlchemy model files are imported, all routers are
 * registered, Alembic revisions have no duplicates, and no router files
 * use `from __future__ import annotations` (which breaks FastAPI).
 *
 * Endpoint: GET /api/v1/admin/parity
 */
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

export interface CheckResult {
  pass: boolean;
  [key: string]: unknown;
}

export interface ParityData {
  all_pass: boolean;
  checks: {
    model_registration: CheckResult & {
      total_model_files: number;
      imported: number;
      missing_files: string[];
    };
    router_registration: CheckResult & {
      total_router_files: number;
      registered: number;
      missing_files: string[];
    };
    alembic_revisions: CheckResult & {
      total_revisions: number;
      duplicates: { revision: string; files: string[] }[];
    };
    future_annotations: CheckResult & {
      violations: string[];
    };
  };
}

async function fetchParity(): Promise<ParityData> {
  const { data } = await axios.get("/api/v1/admin/parity");
  return data;
}

export function useParity() {
  return useQuery({ queryKey: ["admin", "parity"], queryFn: fetchParity });
}
