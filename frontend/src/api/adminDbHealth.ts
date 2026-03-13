/**
 * Admin — Database Health API
 *
 * Fetches real-time PostgreSQL health metrics for the Super Admin dashboard:
 * cluster mode (single-node vs Patroni HA), replication lag per replica,
 * connection pool stats, backup age, and disk usage.
 *
 * Endpoint: GET /api/v1/admin/db-health
 * Poll interval: 15 seconds (auto-refreshed via useQuery refetchInterval)
 */
import { useQuery } from "@tanstack/react-query";
import apiClient from "./client";

export interface ReplicaStatus {
  name: string;
  state: string;
  sync_state: string;
  write_lag_s: number;
  replay_lag_s: number;
  lag_mb: number;
}

export interface ConnectionStats {
  active: number;
  idle: number;
  idle_in_transaction: number;
  waiting: number;
}

export interface BackupInfo {
  type?: string;
  completed_at?: string;
  age_seconds?: number;
  size_mb?: number;
  backup_count?: number;
  archive_status?: string;
  status?: string;
  note?: string;
}

export interface DiskInfo {
  db_size_bytes: number;
  db_size_pretty: string;
}

export interface DbHealthResponse {
  cluster_mode: "single-node" | "patroni-ha" | "unknown";
  replication: ReplicaStatus[];
  connections: ConnectionStats;
  backup: BackupInfo;
  disk?: DiskInfo;
  postgres_version?: string;
  checked_at: string;
}

async function fetchDbHealth(): Promise<DbHealthResponse> {
  const { data } = await apiClient.get<DbHealthResponse>("/admin/db-health");
  return data;
}

export function useDbHealth() {
  return useQuery<DbHealthResponse>({
    queryKey: ["admin", "db-health"],
    queryFn: fetchDbHealth,
    refetchInterval: 15_000, // poll every 15s
    staleTime: 10_000,
  });
}

function formatAge(seconds?: number): string {
  if (seconds == null) return "unknown";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export { formatAge };
