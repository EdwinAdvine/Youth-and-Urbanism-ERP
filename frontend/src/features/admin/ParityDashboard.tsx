import { useParity } from "@/api/adminParity";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        background: ok ? "#e8f9e0" : "#ffe4eb",
        color: ok ? "#3a7d18" : "#c0143c",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: ok ? "#6fd943" : "#ff3a6e",
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function CheckCard({
  title,
  pass: ok,
  children,
}: {
  title: string;
  pass: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        border: `1px solid ${ok ? "#d4edda" : "#f5c6cb"}`,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h3>
        <StatusBadge ok={ok} label={ok ? "PASS" : "FAIL"} />
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <span style={{ fontSize: 13, color: "#555" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>
        {value}
      </span>
    </div>
  );
}

export default function ParityDashboard() {
  const { data, isLoading, isError } = useParity();

  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#888" }}>
        Loading parity data...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#ff3a6e" }}>
        Failed to load parity data.
      </div>
    );
  }

  const { checks } = data;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 32 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          System Parity Dashboard
        </h1>
        <StatusBadge
          ok={data.all_pass}
          label={data.all_pass ? "ALL CHECKS PASS" : "GAPS DETECTED"}
        />
      </div>

      <CheckCard title="Model Registration" pass={checks.model_registration.pass}>
        <Metric
          label="Model files"
          value={checks.model_registration.total_model_files}
        />
        <Metric label="Imported" value={checks.model_registration.imported} />
        {checks.model_registration.missing_files.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#c0143c" }}>
            Missing:{" "}
            {checks.model_registration.missing_files.join(", ")}
          </div>
        )}
      </CheckCard>

      <CheckCard
        title="Router Registration"
        pass={checks.router_registration.pass}
      >
        <Metric
          label="Router files"
          value={checks.router_registration.total_router_files}
        />
        <Metric
          label="Registered"
          value={checks.router_registration.registered}
        />
        {checks.router_registration.missing_files.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#c0143c" }}>
            Missing:{" "}
            {checks.router_registration.missing_files.join(", ")}
          </div>
        )}
      </CheckCard>

      <CheckCard
        title="Alembic Revisions"
        pass={checks.alembic_revisions.pass}
      >
        <Metric
          label="Total revisions"
          value={checks.alembic_revisions.total_revisions}
        />
        {checks.alembic_revisions.duplicates.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#c0143c" }}>
            {checks.alembic_revisions.duplicates.map((d) => (
              <div key={d.revision}>
                Duplicate <code>{d.revision}</code>: {d.files.join(", ")}
              </div>
            ))}
          </div>
        )}
      </CheckCard>

      <CheckCard
        title="No from __future__ in Routers"
        pass={checks.future_annotations.pass}
      >
        {checks.future_annotations.violations.length > 0 ? (
          <div style={{ fontSize: 13, color: "#c0143c" }}>
            Violations: {checks.future_annotations.violations.join(", ")}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#3a7d18" }}>
            All router files are clean.
          </div>
        )}
      </CheckCard>
    </div>
  );
}
