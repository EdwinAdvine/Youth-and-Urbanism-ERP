import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const api = axios.create({ baseURL: "/api/v1" });

// ── Tab definitions ────────────────────────────────────────────────────────

type Tab = "forecast" | "anomalies" | "nlquery" | "categorize" | "taxopt";

const TABS: Array<{ id: Tab; label: string; emoji: string }> = [
  { id: "forecast", label: "Cash Flow Forecast", emoji: "📈" },
  { id: "anomalies", label: "Anomaly Detection", emoji: "🔍" },
  { id: "nlquery", label: "Natural Language Query", emoji: "💬" },
  { id: "categorize", label: "Bank Categorizer", emoji: "🏦" },
  { id: "taxopt", label: "Tax Optimizer", emoji: "💰" },
];

// ── Cash Flow Forecast Tab ─────────────────────────────────────────────────

function CashFlowForecast() {
  const [horizon, setHorizon] = useState(90);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cash-forecast", horizon],
    queryFn: () => api.get("/finance/ai/cash-flow-forecast", { params: { horizon_days: horizon } }).then((r) => r.data),
    enabled: false,
  });

  const buckets = data?.buckets || {};

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
            <SelectItem value="180">180 days</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => refetch()} disabled={isLoading} className="bg-[#51459d] hover:bg-[#41358d]">
          {isLoading ? "Forecasting…" : "Run Forecast"}
        </Button>
      </div>

      {data && (
        <div className="space-y-4">
          {/* AI Narrative */}
          {data.ai_narrative && (
            <div className="bg-gradient-to-r from-[#51459d]/10 to-[#51459d]/5 border border-[#51459d]/20 rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🤖</span>
                <span className="font-semibold text-[#51459d]">AI Analysis</span>
                <span className="text-xs text-gray-400">Powered by Ollama</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{data.ai_narrative}</p>
            </div>
          )}

          {/* Alerts */}
          {data.alerts?.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((alert: string, i: number) => (
                <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[10px] p-3 text-red-700 text-sm">
                  <span>⚠️</span> {alert}
                </div>
              ))}
            </div>
          )}

          {/* Buckets */}
          <div className="grid grid-cols-3 gap-4">
            {(["0-30", "31-60", "61-90"] as const).map((bucket) => {
              const b = buckets[bucket] || {};
              const net = b.net || 0;
              return (
                <div key={bucket} className="bg-white border border-gray-200 rounded-[10px] p-4">
                  <div className="text-sm font-medium text-gray-500 mb-3">Day {bucket}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#6fd943]">↑ Inflows</span>
                      <span className="font-semibold">${(b.inflow || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#ff3a6e]">↓ Outflows</span>
                      <span className="font-semibold">${(b.outflow || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    </div>
                    <div className={`flex justify-between border-t pt-2 font-bold ${net >= 0 ? "text-[#6fd943]" : "text-[#ff3a6e]"}`}>
                      <span>Net</span>
                      <span>{net >= 0 ? "+" : ""}${net.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collection rate */}
          <div className="text-sm text-gray-500">
            Historical collection rate: <strong>{((data.overall_collection_rate || 0) * 100).toFixed(0)}%</strong>
            &nbsp;·&nbsp; Pending invoices: <strong>{data.inflow_items?.length || 0}</strong>
            &nbsp;·&nbsp; Pending bills: <strong>{data.outflow_items?.length || 0}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Anomaly Detection Tab ──────────────────────────────────────────────────

function AnomalyDetection() {
  const [days, setDays] = useState(30);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["anomalies", days],
    queryFn: () => api.get("/finance/ai/anomaly-detection", { params: { days } }).then((r) => r.data),
    enabled: false,
  });

  const severityColor: Record<string, string> = {
    high: "border-red-300 bg-red-50 text-red-700",
    medium: "border-yellow-300 bg-yellow-50 text-yellow-700",
    low: "border-gray-200 bg-gray-50 text-gray-600",
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => refetch()} disabled={isLoading} className="bg-[#51459d] hover:bg-[#41358d]">
          {isLoading ? "Scanning…" : "Scan for Anomalies"}
        </Button>
      </div>

      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Found", value: data.anomaly_count, color: "text-gray-900" },
              { label: "High", value: data.high_severity, color: "text-red-600" },
              { label: "Medium", value: data.medium_severity, color: "text-yellow-600" },
              { label: "Low", value: data.low_severity, color: "text-gray-500" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-[10px] p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          {data.ai_summary && (
            <div className="bg-gradient-to-r from-[#51459d]/10 to-[#51459d]/5 border border-[#51459d]/20 rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>🤖</span>
                <span className="font-semibold text-[#51459d]">AI Summary</span>
              </div>
              <p className="text-sm text-gray-700">{data.ai_summary}</p>
            </div>
          )}

          {/* Anomaly list */}
          {data.anomalies?.length > 0 && (
            <div className="space-y-2">
              {data.anomalies.map((a: { type: string; severity: string; description: string; entity: string }, i: number) => (
                <div key={i} className={`border rounded-[10px] p-3 text-sm ${severityColor[a.severity] || ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{a.type.replace(/_/g, " ")}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-white/60 capitalize">{a.severity}</span>
                    <span className="text-xs opacity-70">{a.entity}</span>
                  </div>
                  <p className="mt-1 opacity-90">{a.description}</p>
                </div>
              ))}
            </div>
          )}
          {data.anomaly_count === 0 && (
            <div className="text-center py-8 text-gray-400">
              <span className="text-3xl">✅</span>
              <p className="mt-2">No anomalies detected in the review period</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Natural Language Query Tab ─────────────────────────────────────────────

function NLQueryTab() {
  const [query, setQuery] = useState("");
  const { data, isLoading, mutate } = useMutation({
    mutationFn: (q: string) => api.post("/finance/ai/nl-query", { query: q }).then((r) => r.data),
  });

  const EXAMPLES = [
    "Top 10 customers by revenue last 6 months",
    "Total expenses by category this year",
    "Overdue invoices over $5,000",
    "Monthly revenue trend for 2026",
    "Which vendor has the highest outstanding bills",
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="Ask anything about your finances…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query && mutate(query)}
        />
        <Button
          onClick={() => mutate(query)}
          disabled={isLoading || !query}
          className="bg-[#51459d] hover:bg-[#41358d]"
        >
          {isLoading ? "Querying…" : "Ask"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setQuery(ex); mutate(ex); }}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-full transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {data && (
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-[10px] p-3">
            <div className="text-xs text-gray-400 mb-1">Generated SQL</div>
            <code className="text-xs text-[#51459d] font-mono">{data.sql}</code>
          </div>
          <div className="text-sm text-gray-500">{data.row_count} rows returned</div>
          {data.data?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-gray-200 rounded-[10px] overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>{data.columns?.map((col: string) => (
                    <th key={col} className="text-left px-3 py-2 font-medium text-gray-600">{col}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.slice(0, 20).map((row: Record<string, unknown>, i: number) => (
                    <tr key={i}>
                      {data.columns?.map((col: string) => (
                        <td key={col} className="px-3 py-2 text-gray-700">{String(row[col] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tax Optimizer Tab ──────────────────────────────────────────────────────

function TaxOptimizerTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tax-optimizer", year],
    queryFn: () => api.get("/finance/ai/tax-optimizer", { params: { fiscal_year: year } }).then((r) => r.data),
    enabled: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => refetch()} disabled={isLoading} className="bg-[#51459d] hover:bg-[#41358d]">
          {isLoading ? "Analyzing…" : "Analyze Tax Position"}
        </Button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-[10px] p-4">
            <div className="text-sm text-gray-500">Total Revenue {data.fiscal_year}</div>
            <div className="text-2xl font-bold text-gray-900">${(data.total_revenue || 0).toLocaleString()}</div>
          </div>

          {data.ai_suggestions && (
            <div className="bg-gradient-to-r from-[#6fd943]/10 to-[#6fd943]/5 border border-[#6fd943]/30 rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span>🤖</span>
                <span className="font-semibold text-gray-900">AI Tax Optimization Suggestions</span>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {data.ai_suggestions}
              </div>
            </div>
          )}

          {data.expense_breakdown?.length > 0 && (
            <div>
              <div className="font-medium text-gray-700 mb-2">Expense Breakdown</div>
              <div className="grid grid-cols-2 gap-2">
                {data.expense_breakdown.map((e: { category: string; total: number; count: number }) => (
                  <div key={e.category} className="bg-white border border-gray-200 rounded-[10px] p-3 text-sm">
                    <div className="font-medium capitalize">{e.category}</div>
                    <div className="text-gray-500">${(e.total || 0).toLocaleString()} · {e.count} items</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">{data.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function FinanceAIPage() {
  const [activeTab, setActiveTab] = useState<Tab>("forecast");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance AI</h1>
        <p className="text-sm text-gray-500 mt-1">AI-powered financial intelligence — forecasting, anomaly detection, and natural language queries</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#51459d] text-[#51459d]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-[10px] p-6">
        {activeTab === "forecast" && <CashFlowForecast />}
        {activeTab === "anomalies" && <AnomalyDetection />}
        {activeTab === "nlquery" && <NLQueryTab />}
        {activeTab === "taxopt" && <TaxOptimizerTab />}
        {activeTab === "categorize" && (
          <div className="text-center py-8 text-gray-400">
            <span className="text-3xl">🏦</span>
            <p className="mt-2 font-medium">Bank Categorizer</p>
            <p className="text-sm">Go to Bank Reconciliation → Import Statement → AI Categorize</p>
          </div>
        )}
      </div>
    </div>
  );
}
