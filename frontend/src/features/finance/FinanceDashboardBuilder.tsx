/**
 * FinanceDashboardBuilder — configurable widget dashboard for Finance.
 *
 * Supports 20 pre-built widgets. Users can show/hide, resize (sm/md/lg),
 * and reorder widgets. Layout is persisted per-user in localStorage.
 * Uses CSS Grid — zero external dependencies.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
// Badge import removed (unused)
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const api = axios.create({ baseURL: "/api/v1" });

// ── Widget registry ────────────────────────────────────────────────────────────

type WidgetSize = "sm" | "md" | "lg";

interface WidgetDef {
  id: string;
  title: string;
  category: string;
  defaultSize: WidgetSize;
  defaultVisible: boolean;
}

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "revenue_mtd", title: "Revenue MTD", category: "revenue", defaultSize: "sm", defaultVisible: true },
  { id: "expenses_mtd", title: "Expenses MTD", category: "expenses", defaultSize: "sm", defaultVisible: true },
  { id: "net_income_mtd", title: "Net Income MTD", category: "revenue", defaultSize: "sm", defaultVisible: true },
  { id: "cash_position", title: "Cash Position", category: "cash", defaultSize: "sm", defaultVisible: true },
  { id: "ar_balance", title: "Accounts Receivable", category: "receivables", defaultSize: "sm", defaultVisible: true },
  { id: "ap_balance", title: "Accounts Payable", category: "payables", defaultSize: "sm", defaultVisible: true },
  { id: "overdue_invoices", title: "Overdue Invoices", category: "receivables", defaultSize: "sm", defaultVisible: true },
  { id: "pending_expenses", title: "Pending Approvals", category: "expenses", defaultSize: "sm", defaultVisible: true },
  { id: "revenue_trend", title: "Revenue Trend (6mo)", category: "revenue", defaultSize: "lg", defaultVisible: true },
  { id: "expense_breakdown", title: "Expense Breakdown", category: "expenses", defaultSize: "md", defaultVisible: true },
  { id: "ar_aging", title: "AR Aging Breakdown", category: "receivables", defaultSize: "md", defaultVisible: false },
  { id: "ap_aging", title: "AP Aging Breakdown", category: "payables", defaultSize: "md", defaultVisible: false },
  { id: "budget_burn", title: "Budget Utilization", category: "budgets", defaultSize: "md", defaultVisible: true },
  { id: "cash_forecast", title: "Cash Flow Forecast", category: "cash", defaultSize: "lg", defaultVisible: false },
  { id: "top_customers", title: "Top Customers", category: "revenue", defaultSize: "md", defaultVisible: false },
  { id: "recent_invoices", title: "Recent Invoices", category: "revenue", defaultSize: "md", defaultVisible: false },
  { id: "overdue_bills", title: "Overdue Bills", category: "payables", defaultSize: "sm", defaultVisible: false },
  { id: "profit_margin", title: "Profit Margin %", category: "revenue", defaultSize: "sm", defaultVisible: false },
  { id: "runway_months", title: "Cash Runway", category: "cash", defaultSize: "sm", defaultVisible: false },
  { id: "ytd_summary", title: "YTD Summary", category: "revenue", defaultSize: "lg", defaultVisible: false },
];

interface WidgetConfig {
  id: string;
  visible: boolean;
  size: WidgetSize;
  order: number;
}

const STORAGE_KEY = "finance_dashboard_layout_v1";

function loadLayout(): WidgetConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return WIDGET_REGISTRY.map((w, i) => ({
    id: w.id,
    visible: w.defaultVisible,
    size: w.defaultSize,
    order: i,
  }));
}

function saveLayout(layout: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

// ── Data hooks ─────────────────────────────────────────────────────────────────

function useKPIs() {
  return useQuery({
    queryKey: ["finance-kpis-dashboard"],
    queryFn: () => {
      const today = new Date();
      const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      const end = today.toISOString().slice(0, 10);
      return api.get("/finance/dashboard/kpis", { params: { start_date: start, end_date: end } })
        .then((r) => r.data);
    },
    staleTime: 300_000,
  });
}

function useRevenueTrend() {
  return useQuery({
    queryKey: ["finance-revenue-trend-dashboard"],
    queryFn: () => {
      const today = new Date();
      const end = today.toISOString().slice(0, 10);
      const start = new Date(today.setMonth(today.getMonth() - 6)).toISOString().slice(0, 10);
      return api.get("/finance/reports/revenue-streams", { params: { start_date: start, end_date: end } })
        .then((r) => r.data);
    },
    staleTime: 300_000,
  });
}

function useCashForecast() {
  return useQuery({
    queryKey: ["finance-cash-forecast-dashboard"],
    queryFn: () => api.get("/finance/ai/cash-flow-forecast", { params: { horizon_days: 90 } }).then((r) => r.data),
    staleTime: 600_000,
  });
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | undefined | null) {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ── Individual widgets ──────────────────────────────────────────────────────────

function KpiCard({ label, value, subtext, color = "#51459d" }: {
  label: string; value: string; subtext?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full flex flex-col justify-between">
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      <div className="text-2xl font-bold mt-2" style={{ color }}>{value}</div>
      {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
    </div>
  );
}

function RevenueTrendWidget({ data }: { data: any }) {
  const monthly = data?.monthly_trend || [];
  const max = Math.max(...monthly.map((m: any) => m.revenue), 1);
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
      <div className="text-sm font-semibold text-gray-900 mb-3">Revenue Trend (6 months)</div>
      {monthly.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-4">No data</div>
      ) : (
        <div className="flex items-end gap-1.5 h-24">
          {monthly.map((m: any) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-[#51459d] rounded-t-sm min-h-[2px]"
                style={{ height: `${Math.max(2, (m.revenue / max) * 80)}px` }}
              />
              <div className="text-xs text-gray-400">{m.month?.slice(5)}</div>
            </div>
          ))}
        </div>
      )}
      {data?.total_revenue != null && (
        <div className="text-sm text-gray-600 mt-2">
          Total: <span className="font-semibold text-gray-900">{fmt(data.total_revenue)}</span>
        </div>
      )}
    </div>
  );
}

function ExpenseBreakdownWidget({ kpis }: { kpis: any }) {
  const expenses = kpis?.expense_breakdown || [];
  const total = expenses.reduce((s: number, e: any) => s + (e.total || 0), 0);
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
      <div className="text-sm font-semibold text-gray-900 mb-3">Expense Breakdown</div>
      {expenses.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-4">No expenses this period</div>
      ) : (
        <div className="space-y-2">
          {expenses.slice(0, 5).map((e: any) => (
            <div key={e.category}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-600 capitalize">{e.category?.replace(/_/g, " ")}</span>
                <span className="font-medium">{fmt(e.total)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-[#ff3a6e] h-1.5 rounded-full"
                  style={{ width: `${total > 0 ? (e.total / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CashForecastWidget({ data }: { data: any }) {
  const buckets = data?.forecast_buckets || [];
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
      <div className="text-sm font-semibold text-gray-900 mb-3">Cash Flow Forecast (90 days)</div>
      {buckets.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-4">Forecast unavailable</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {buckets.map((b: any) => (
            <div key={b.period} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{b.period}</div>
              <div className={`font-bold text-sm ${b.net >= 0 ? "text-[#6fd943]" : "text-[#ff3a6e]"}`}>
                {fmt(b.net)}
              </div>
              <div className="text-xs text-gray-400">net</div>
            </div>
          ))}
        </div>
      )}
      {data?.narrative && (
        <div className="mt-3 text-xs text-gray-500 border-t pt-2 line-clamp-2">{data.narrative}</div>
      )}
    </div>
  );
}

function BudgetBurnWidget({ kpis }: { kpis: any }) {
  const used = kpis?.budget_utilization_pct ?? 0;
  const color = used >= 90 ? "#ff3a6e" : used >= 70 ? "#ffa21d" : "#6fd943";
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
      <div className="text-sm font-semibold text-gray-900 mb-2">Budget Utilization</div>
      <div className="text-3xl font-bold" style={{ color }}>{used.toFixed(1)}%</div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2">
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${Math.min(100, used)}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {used < 70 ? "On track" : used < 90 ? "Monitor closely" : "Over budget risk"}
      </div>
    </div>
  );
}

function YtdSummaryWidget({ kpis }: { kpis: any }) {
  const items = [
    { label: "Revenue", value: fmt(kpis?.revenue), color: "#6fd943" },
    { label: "Expenses", value: fmt(kpis?.total_expenses), color: "#ff3a6e" },
    { label: "Net Income", value: fmt(kpis?.profit), color: kpis?.profit >= 0 ? "#51459d" : "#ff3a6e" },
    { label: "Cash Position", value: fmt(kpis?.cash_position), color: "#3ec9d6" },
  ];
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
      <div className="text-sm font-semibold text-gray-900 mb-3">YTD Summary</div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-xs text-gray-500">{item.label}</div>
            <div className="text-lg font-bold mt-0.5" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget renderer ────────────────────────────────────────────────────────────

function WidgetRenderer({ id, kpis, revenueTrend, cashForecast }: {
  id: string; kpis: any; revenueTrend: any; cashForecast: any;
}) {
  const k = kpis || {};
  switch (id) {
    case "revenue_mtd":
      return <KpiCard label="Revenue MTD" value={fmt(k.revenue)} subtext="Paid invoices this month" color="#6fd943" />;
    case "expenses_mtd":
      return <KpiCard label="Expenses MTD" value={fmt(k.total_expenses)} subtext="Approved + reimbursed" color="#ff3a6e" />;
    case "net_income_mtd":
      return <KpiCard label="Net Income MTD" value={fmt(k.profit)} color={k.profit >= 0 ? "#51459d" : "#ff3a6e"} />;
    case "cash_position":
      return <KpiCard label="Cash Position" value={fmt(k.cash_position)} subtext="Revenue − Outflows" color="#3ec9d6" />;
    case "ar_balance":
      return <KpiCard label="Accounts Receivable" value={fmt(k.total_receivables)} subtext={`${k.invoices_paid ?? 0} invoices paid`} />;
    case "ap_balance":
      return <KpiCard label="Accounts Payable" value={fmt(k.total_payables)} subtext="Outstanding to vendors" color="#ffa21d" />;
    case "overdue_invoices":
      return <KpiCard label="Overdue Invoices" value={String(k.overdue_invoices ?? 0)} subtext="Require follow-up" color="#ff3a6e" />;
    case "pending_expenses":
      return <KpiCard label="Pending Approvals" value={String(k.pending_expense_approvals ?? 0)} subtext="Expenses awaiting review" color="#ffa21d" />;
    case "overdue_bills":
      return <KpiCard label="Overdue Bills" value={String(k.overdue_bills ?? 0)} subtext="Vendor bills past due" color="#ff3a6e" />;
    case "profit_margin":
      return <KpiCard label="Profit Margin" value={k.revenue > 0 ? fmtPct((k.profit / k.revenue) * 100) : "—"} color="#51459d" />;
    case "runway_months":
      return <KpiCard label="Cash Runway" value={k.total_expenses > 0 ? `${(k.cash_position / (k.total_expenses / 1)).toFixed(1)} mo` : "—"} subtext="At current burn rate" color="#3ec9d6" />;
    case "revenue_trend":
      return <RevenueTrendWidget data={revenueTrend} />;
    case "expense_breakdown":
      return <ExpenseBreakdownWidget kpis={k} />;
    case "budget_burn":
      return <BudgetBurnWidget kpis={k} />;
    case "cash_forecast":
      return <CashForecastWidget data={cashForecast} />;
    case "ytd_summary":
      return <YtdSummaryWidget kpis={k} />;
    case "top_customers":
      return (
        <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
          <div className="text-sm font-semibold text-gray-900 mb-2">Top Customers</div>
          {(revenueTrend?.by_customer || []).slice(0, 5).map((c: any) => (
            <div key={c.customer} className="flex justify-between text-sm py-1 border-b last:border-0">
              <span className="text-gray-700 truncate max-w-[150px]">{c.customer || "Unknown"}</span>
              <span className="font-medium">{fmt(c.revenue)}</span>
            </div>
          ))}
        </div>
      );
    case "recent_invoices":
      return (
        <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
          <div className="text-sm font-semibold text-gray-900 mb-2">Recent Activity</div>
          <div className="text-sm text-gray-400">Navigate to Invoices for details</div>
        </div>
      );
    case "ar_aging":
      return (
        <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
          <div className="text-sm font-semibold text-gray-900 mb-2">AR Aging</div>
          <div className="text-2xl font-bold text-[#51459d]">{fmt(k.total_receivables)}</div>
          <div className="text-xs text-gray-400 mt-1">Total outstanding receivables</div>
          <a href="/finance/aged-report" className="text-xs text-[#51459d] hover:underline mt-2 inline-block">View AR Aging Report →</a>
        </div>
      );
    case "ap_aging":
      return (
        <div className="bg-white rounded-[10px] border border-gray-200 p-4 h-full">
          <div className="text-sm font-semibold text-gray-900 mb-2">AP Aging</div>
          <div className="text-2xl font-bold text-[#ffa21d]">{fmt(k.total_payables)}</div>
          <div className="text-xs text-gray-400 mt-1">Total outstanding payables</div>
          <a href="/finance/aged-report" className="text-xs text-[#51459d] hover:underline mt-2 inline-block">View AP Aging Report →</a>
        </div>
      );
    default:
      return <div className="bg-white rounded-[10px] border border-gray-200 p-4 text-sm text-gray-400">Widget: {id}</div>;
  }
}

// ── Col span by size ───────────────────────────────────────────────────────────

const SIZE_COLS: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-2",
  lg: "col-span-3",
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function FinanceDashboardBuilder() {
  const [layout, setLayout] = useState<WidgetConfig[]>(loadLayout);
  const [showConfig, setShowConfig] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: kpis, isLoading: kpisLoading } = useKPIs();
  const { data: revenueTrend } = useRevenueTrend();
  const { data: cashForecast } = useCashForecast();

  useEffect(() => saveLayout(layout), [layout]);

  const visibleWidgets = [...layout]
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

  function toggleWidget(id: string) {
    setLayout((prev) => prev.map((w) => w.id === id ? { ...w, visible: !w.visible } : w));
  }

  function setSize(id: string, size: WidgetSize) {
    setLayout((prev) => prev.map((w) => w.id === id ? { ...w, size } : w));
  }

  function moveUp(id: string) {
    setLayout((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((w) => w.id === id);
      if (idx <= 0) return prev;
      const newLayout = [...prev];
      const thisOrder = newLayout.find((w) => w.id === id)!.order;
      const prevItem = sorted[idx - 1];
      newLayout.find((w) => w.id === id)!.order = prevItem.order;
      newLayout.find((w) => w.id === prevItem.id)!.order = thisOrder;
      return [...newLayout];
    });
  }

  function moveDown(id: string) {
    setLayout((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const visIdx = sorted.filter((w) => w.visible).findIndex((w) => w.id === id);
      const visibles = sorted.filter((w) => w.visible);
      if (visIdx < 0 || visIdx >= visibles.length - 1) return prev;
      const newLayout = [...prev];
      const nextItem = visibles[visIdx + 1];
      const thisOrder = newLayout.find((w) => w.id === id)!.order;
      newLayout.find((w) => w.id === id)!.order = nextItem.order;
      newLayout.find((w) => w.id === nextItem.id)!.order = thisOrder;
      return [...newLayout];
    });
  }

  function resetLayout() {
    const fresh = WIDGET_REGISTRY.map((w, i) => ({
      id: w.id, visible: w.defaultVisible, size: w.defaultSize, order: i,
    }));
    setLayout(fresh);
  }

  // Drag-and-drop reorder
  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    setLayout((prev) => {
      const newLayout = [...prev];
      const srcOrder = newLayout.find((w) => w.id === dragId)!.order;
      const tgtOrder = newLayout.find((w) => w.id === targetId)!.order;
      newLayout.find((w) => w.id === dragId)!.order = tgtOrder;
      newLayout.find((w) => w.id === targetId)!.order = srcOrder;
      return newLayout;
    });
    setDragId(null);
  }

  const categories = [...new Set(WIDGET_REGISTRY.map((w) => w.category))];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {visibleWidgets.length} of {WIDGET_REGISTRY.length} widgets visible
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetLayout}>Reset</Button>
          <Button className="bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowConfig(true)}>
            Customize Dashboard
          </Button>
        </div>
      </div>

      {/* Threshold alerts */}
      {kpis && (
        <div className="flex flex-wrap gap-2">
          {(kpis.overdue_invoices ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-[10px] px-3 py-1.5 text-xs text-red-700">
              ⚠ {kpis.overdue_invoices} overdue invoice{kpis.overdue_invoices !== 1 ? "s" : ""}
            </div>
          )}
          {(kpis.pending_expense_approvals ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-[10px] px-3 py-1.5 text-xs text-yellow-700">
              ⏳ {kpis.pending_expense_approvals} expense{kpis.pending_expense_approvals !== 1 ? "s" : ""} pending approval
            </div>
          )}
          {(kpis.profit ?? 0) < 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-[10px] px-3 py-1.5 text-xs text-red-700">
              📉 Net loss this period
            </div>
          )}
        </div>
      )}

      {/* Widget grid */}
      {kpisLoading ? (
        <div className="text-center py-16 text-gray-400">Loading dashboard data…</div>
      ) : (
        <div className="grid grid-cols-3 gap-4 auto-rows-[160px]">
          {visibleWidgets.map((wc) => {
            return (
              <div
                key={wc.id}
                className={`${SIZE_COLS[wc.size]} ${wc.size === "lg" ? "row-span-2" : wc.size === "md" ? "row-span-1" : "row-span-1"} cursor-grab active:cursor-grabbing`}
                draggable
                onDragStart={() => onDragStart(wc.id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(wc.id)}
                style={{ opacity: dragId === wc.id ? 0.5 : 1 }}
              >
                <WidgetRenderer
                  id={wc.id}
                  kpis={kpis}
                  revenueTrend={revenueTrend}
                  cashForecast={cashForecast}
                />
              </div>
            );
          })}
        </div>
      )}

      {visibleWidgets.length === 0 && !kpisLoading && (
        <div className="text-center py-16 bg-white rounded-[10px] border border-gray-200 text-gray-400">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-medium">No widgets visible</p>
          <Button className="mt-4 bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowConfig(true)}>
            Add Widgets
          </Button>
        </div>
      )}

      {/* Config dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {categories.map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </p>
                <div className="space-y-2">
                  {WIDGET_REGISTRY.filter((w) => w.category === cat).map((w) => {
                    const cfg = layout.find((l) => l.id === w.id)!;
                    return (
                      <div key={w.id} className="flex items-center justify-between bg-gray-50 rounded-[10px] p-3">
                        <div className="flex items-center gap-3">
                          <Switch checked={cfg.visible} onCheckedChange={() => toggleWidget(w.id)} />
                          <span className={`text-sm ${cfg.visible ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                            {w.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Size selector */}
                          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                            {(["sm", "md", "lg"] as WidgetSize[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => setSize(w.id, s)}
                                className={`px-2 py-1 ${cfg.size === s ? "bg-[#51459d] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                              >
                                {s.toUpperCase()}
                              </button>
                            ))}
                          </div>
                          {/* Move up/down */}
                          {cfg.visible && (
                            <div className="flex gap-1">
                              <button onClick={() => moveUp(w.id)} className="p-1 text-gray-400 hover:text-gray-700 rounded">▲</button>
                              <button onClick={() => moveDown(w.id)} className="p-1 text-gray-400 hover:text-gray-700 rounded">▼</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="text-xs text-gray-400 pt-2">
              Drag widgets on the dashboard to reorder. Size: SM = 1 col, MD = 2 col, LG = 3 col (full width).
              Layout is saved automatically in your browser.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
