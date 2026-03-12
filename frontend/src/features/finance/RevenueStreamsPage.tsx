import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const api = axios.create({ baseURL: "/api/v1" });

interface RevenueStreamsData {
  period: { start_date: string; end_date: string };
  total_revenue: number;
  by_account: Array<{ account: string; code: string; amount: number }>;
  by_customer: Array<{ customer: string; invoice_count: number; revenue: number }>;
  monthly_trend: Array<{ month: string; revenue: number }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function RevenueStreamsPage() {
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [params, setParams] = useState({ start_date: startDate, end_date: endDate });

  const { data, isLoading } = useQuery<RevenueStreamsData>({
    queryKey: ["revenue-streams", params],
    queryFn: () =>
      api.get("/finance/reports/revenue-streams", { params }).then((r) => r.data),
  });

  const maxAmount = Math.max(...(data?.by_account.map((a) => a.amount) || [1]));
  const maxRevenue = Math.max(...(data?.by_customer.map((c) => c.revenue) || [1]));
  const maxMonthly = Math.max(...(data?.monthly_trend.map((m) => m.revenue) || [1]));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Streams</h1>
          <p className="text-sm text-gray-500 mt-1">
            Breakdown by account, customer, and monthly trend
          </p>
        </div>
        <a
          href={`/api/v1/finance/reports/pl/export-xlsx?start_date=${params.start_date}&end_date=${params.end_date}`}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-[10px] text-sm font-medium hover:bg-gray-50"
        >
          Export XLSX
        </a>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[10px] border border-gray-200 p-4 flex gap-4 items-end">
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button
          className="bg-[#51459d] hover:bg-[#41358d]"
          onClick={() => setParams({ start_date: startDate, end_date: endDate })}
        >
          Apply
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
      ) : data ? (
        <>
          {/* KPI card */}
          <div className="bg-[#51459d] rounded-[10px] p-6 text-white">
            <div className="text-sm opacity-80">Total Revenue</div>
            <div className="text-4xl font-bold mt-1">{fmt(data.total_revenue)}</div>
            <div className="text-sm opacity-70 mt-1">
              {params.start_date} → {params.end_date}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Account */}
            <div className="bg-white rounded-[10px] border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">By Revenue Account</h2>
              <div className="space-y-3">
                {data.by_account.length === 0 ? (
                  <p className="text-sm text-gray-400">No data</p>
                ) : (
                  data.by_account.map((a) => (
                    <div key={a.code}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{a.account}</span>
                        <span className="font-medium text-gray-900">{fmt(a.amount)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-[#51459d] h-2 rounded-full"
                          style={{ width: `${(a.amount / maxAmount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-[10px] border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Top Customers by Revenue</h2>
              <div className="space-y-3">
                {data.by_customer.length === 0 ? (
                  <p className="text-sm text-gray-400">No data</p>
                ) : (
                  data.by_customer.slice(0, 10).map((c) => (
                    <div key={c.customer}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 truncate max-w-[180px]">
                          {c.customer || "Unknown"}
                        </span>
                        <div className="flex gap-3 items-center shrink-0">
                          <span className="text-gray-400 text-xs">{c.invoice_count} inv</span>
                          <span className="font-medium text-gray-900">{fmt(c.revenue)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-[#6fd943] h-2 rounded-full"
                          style={{ width: `${(c.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-[10px] border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Monthly Revenue Trend</h2>
            {data.monthly_trend.length === 0 ? (
              <p className="text-sm text-gray-400">No monthly data</p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {data.monthly_trend.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-gray-500">{fmt(m.revenue)}</div>
                    <div
                      className="w-full bg-[#51459d] rounded-t-sm min-h-[4px]"
                      style={{ height: `${Math.max(4, (m.revenue / maxMonthly) * 120)}px` }}
                    />
                    <div className="text-xs text-gray-400">{m.month?.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
