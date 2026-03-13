import { formatAge, useDbHealth } from "@/api/adminDbHealth";

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        background: ok ? "#e8f9e0" : "#ffe4eb",
        color: ok ? "#3a7d18" : "#c0143c",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? "#6fd943" : "#ff3a6e", display: "inline-block" }} />
      {label}
    </span>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Metric row ────────────────────────────────────────────────────────────────
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontSize: 13, color: "#555" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{value}</span>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function DatabaseHealthWidget() {
  const { data, isLoading, isError } = useDbHealth();

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    minWidth: 320,
  };

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <div style={{ color: "#888", fontSize: 14 }}>Loading database health...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={cardStyle}>
        <div style={{ color: "#ff3a6e", fontSize: 14 }}>Failed to load database health.</div>
      </div>
    );
  }

  const isHA = data.cluster_mode === "patroni-ha";
  const backupOk = !!data.backup.completed_at && (data.backup.age_seconds ?? Infinity) < 86400;
  const hasReplicas = data.replication.length > 0;

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#51459d" }}>Database Health</span>
        <StatusBadge ok={true} label={isHA ? "HA Cluster" : "Single Node"} />
      </div>

      {/* Cluster mode & version */}
      <Section title="Cluster">
        <Metric label="Mode" value={isHA ? "Patroni 3-Node HA" : "Single PostgreSQL"} />
        {data.postgres_version && (
          <Metric label="Version" value={data.postgres_version.split(" ").slice(0, 2).join(" ")} />
        )}
        {data.disk && (
          <Metric label="Database Size" value={data.disk.db_size_pretty} />
        )}
      </Section>

      {/* Replication */}
      {isHA && (
        <Section title="Replication">
          {data.replication.length === 0 ? (
            <div style={{ fontSize: 13, color: "#888" }}>No replicas connected</div>
          ) : (
            data.replication.map((r) => (
              <div key={r.name} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#333" }}>{r.name}</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <StatusBadge ok={r.state === "streaming"} label={r.state} />
                    <StatusBadge ok={r.sync_state === "sync" || r.sync_state === "quorum"} label={r.sync_state} />
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                  Lag: {r.lag_mb.toFixed(2)} MB · replay delay: {r.replay_lag_s}s
                </div>
              </div>
            ))
          )}
        </Section>
      )}

      {/* Connections */}
      {data.connections && (
        <Section title="Connections">
          <Metric label="Active" value={data.connections.active} />
          <Metric label="Idle" value={data.connections.idle} />
          {data.connections.waiting > 0 && (
            <Metric label="Waiting" value={<span style={{ color: "#ffa21d" }}>{data.connections.waiting}</span>} />
          )}
        </Section>
      )}

      {/* Backup */}
      <Section title="Last Backup">
        {data.backup.status === "pgbackrest_not_installed" ? (
          <div style={{ fontSize: 13, color: "#888" }}>pg_dump mode — {data.backup.note}</div>
        ) : data.backup.completed_at ? (
          <>
            <Metric label="Type" value={data.backup.type?.toUpperCase()} />
            <Metric label="Completed" value={<StatusBadge ok={backupOk} label={formatAge(data.backup.age_seconds)} />} />
            {data.backup.size_mb != null && (
              <Metric label="Size" value={`${data.backup.size_mb.toFixed(1)} MB`} />
            )}
            {data.backup.backup_count != null && (
              <Metric label="Total Backups" value={data.backup.backup_count} />
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: "#ff3a6e" }}>No backups found</div>
        )}
      </Section>

      {/* Footer */}
      <div style={{ fontSize: 11, color: "#bbb", marginTop: 8, textAlign: "right" }}>
        Updated {new Date(data.checked_at).toLocaleTimeString()}
      </div>
    </div>
  );
}
