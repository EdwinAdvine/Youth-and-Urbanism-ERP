import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const api = axios.create({ baseURL: "/api/v1" });

interface ProjectCostingData {
  project_id: string;
  revenue: number;
  direct_costs: number;
  expenses_by_category: Array<{ category: string; amount: number }>;
  overhead_rate_pct: number;
  overhead_allocated: number;
  total_costs: number;
  gross_margin: number;
  gross_margin_pct: number;
  budget_amount: number | null;
  budget_variance: number | null;
  status: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function JobCostingPage() {
  const [projectId, setProjectId] = useState("");
  const [searchId, setSearchId] = useState("");

  const { data, isLoading, error } = useQuery<ProjectCostingData>({
    queryKey: ["project-costing", searchId],
    queryFn: () =>
      api.get(`/finance/reports/project-costing/${searchId}`).then((r) => r.data),
    enabled: !!searchId,
  });

  const marginColor =
    !data ? "gray" :
    data.gross_margin_pct >= 20 ? "#6fd943" :
    data.gross_margin_pct >= 5 ? "#ffa21d" : "#ff3a6e";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Job Costing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Per-project P&L — revenue, direct costs, overhead allocation, margin
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-[10px] border border-gray-200 p-4 flex gap-3 items-end">
        <div className="flex-1 space-y-1">
          <Label>Project ID (UUID)</Label>
          <Input
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
        </div>
        <Button
          className="bg-[#51459d] hover:bg-[#41358d]"
          onClick={() => setSearchId(projectId.trim())}
          disabled={!projectId.trim()}
        >
          Load Project
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400">Loading project costing data…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[10px] p-4 text-red-600 text-sm">
          Project not found or error loading data.
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Revenue", value: fmt(data.revenue), color: "#6fd943" },
              { label: "Total Costs", value: fmt(data.total_costs), color: "#ff3a6e" },
              { label: "Gross Margin", value: fmt(data.gross_margin), color: marginColor },
              { label: "Margin %", value: pct(data.gross_margin_pct), color: marginColor },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-[10px] border border-gray-200 p-4">
                <div className="text-sm text-gray-500">{kpi.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: kpi.color }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-3">
            <Badge
              className={
                data.status === "on_budget"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }
            >
              {data.status === "on_budget" ? "On Budget" : "Over Budget"}
            </Badge>
            {data.budget_amount !== null && (
              <span className="text-sm text-gray-500">
                Budget: {fmt(data.budget_amount)}
                {data.budget_variance !== null && (
                  <span className={data.budget_variance >= 0 ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                    ({data.budget_variance >= 0 ? "under" : "over"} by {fmt(Math.abs(data.budget_variance))})
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Breakdown */}
            <div className="bg-white rounded-[10px] border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Cost Breakdown</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-gray-600">Direct Costs</span>
                  <span className="font-medium">{fmt(data.direct_costs)}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-gray-600">
                    Overhead ({data.overhead_rate_pct}%)
                  </span>
                  <span className="font-medium">{fmt(data.overhead_allocated)}</span>
                </div>
                <div className="flex justify-between text-sm py-2 font-semibold">
                  <span className="text-gray-900">Total Costs</span>
                  <span>{fmt(data.total_costs)}</span>
                </div>
              </div>
            </div>

            {/* Expenses by Category */}
            <div className="bg-white rounded-[10px] border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Direct Expenses by Category</h2>
              {data.expenses_by_category.length === 0 ? (
                <p className="text-sm text-gray-400">No direct expenses linked to this project.</p>
              ) : (
                <div className="space-y-3">
                  {data.expenses_by_category.map((cat) => {
                    const pctWidth = data.direct_costs > 0
                      ? (cat.amount / data.direct_costs) * 100
                      : 0;
                    return (
                      <div key={cat.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 capitalize">
                            {cat.category?.replace(/_/g, " ") || "Uncategorized"}
                          </span>
                          <span className="font-medium">{fmt(cat.amount)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-[#51459d] h-1.5 rounded-full"
                            style={{ width: `${pctWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* P&L Summary */}
          <div className="bg-white rounded-[10px] border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Project P&L Summary</h2>
            <table className="w-full text-sm">
              <tbody>
                {[
                  { label: "Revenue", value: data.revenue, indent: false },
                  { label: "Direct Costs", value: -data.direct_costs, indent: true },
                  { label: `Overhead (${data.overhead_rate_pct}%)`, value: -data.overhead_allocated, indent: true },
                  { label: "Gross Margin", value: data.gross_margin, indent: false, bold: true },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-gray-50 last:border-0">
                    <td className={`py-2 ${row.indent ? "pl-6 text-gray-500" : "font-medium text-gray-900"} ${row.bold ? "font-bold" : ""}`}>
                      {row.label}
                    </td>
                    <td className={`py-2 text-right ${row.value >= 0 ? "text-gray-900" : "text-red-500"} ${row.bold ? "font-bold" : ""}`}>
                      {fmt(Math.abs(row.value))}
                      {row.value < 0 && <span className="text-gray-400 ml-1">(cost)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!searchId && !isLoading && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-[10px] border border-gray-200">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-medium">Enter a Project ID to view job costing</p>
          <p className="text-sm mt-1">Revenue, direct costs, overhead allocation, and margin</p>
        </div>
      )}
    </div>
  );
}
