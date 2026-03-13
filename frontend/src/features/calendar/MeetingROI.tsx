import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeetingCostItem {
  event_id: string;
  title: string;
  date: string;
  duration_hours: number;
  attendee_count: number;
  cost_usd: number;
  is_client_meeting: boolean;
}

interface MonthlyBreakdown {
  month: string;
  cost_usd: number;
}

interface ROIDashboard {
  period_days: number;
  total_meetings: number;
  total_cost_usd: number;
  client_meeting_cost_usd: number;
  internal_meeting_cost_usd: number;
  avg_cost_per_meeting_usd: number;
  most_expensive_meetings: MeetingCostItem[];
  by_month: MonthlyBreakdown[];
}

interface ClientAlert {
  client: string;
  trend: "declining" | "at_risk";
  recent_scores: number[];
  tip: string;
}

interface CoachReport {
  sentiment_trend: "positive" | "neutral" | "negative";
  avg_sentiment_score: number;
  meetings_analyzed: number;
  client_alerts: ClientAlert[];
  coaching_tips: string[];
  action_items: string[];
}

// ── API fetch helpers ─────────────────────────────────────────────────────────

async function fetchROIDashboard(days: number): Promise<ROIDashboard> {
  const { data } = await axios.get("/api/v1/calendar/roi-dashboard", {
    params: { days },
  });
  return data;
}

async function fetchCoachReport(): Promise<CoachReport> {
  const { data } = await axios.get("/api/v1/calendar/meeting-coach");
  return data;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[10px] bg-gray-200 ${className}`}
    />
  );
}

// ── Donut chart (CSS-only, no chart library) ──────────────────────────────────

interface DonutProps {
  clientCost: number;
  internalCost: number;
}

function CostDonut({ clientCost, internalCost }: DonutProps) {
  const total = clientCost + internalCost;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-400 text-sm">
        No data
      </div>
    );
  }

  const clientPct = Math.round((clientCost / total) * 100);
  const internalPct = 100 - clientPct;

  // Single CSS conic-gradient donut
  const gradient = `conic-gradient(
    #51459d 0% ${clientPct}%,
    #3ec9d6 ${clientPct}% 100%
  )`;

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: gradient,
          }}
        />
        {/* Donut hole */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 70,
            height: 70,
            borderRadius: "50%",
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <span className="text-xs font-bold text-gray-700">{clientPct}%</span>
          <span className="text-[10px] text-gray-400">client</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
            style={{ background: "#51459d" }}
          />
          <span className="text-gray-600">Client meetings</span>
          <span className="ml-auto font-semibold text-gray-800">
            {clientPct}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
            style={{ background: "#3ec9d6" }}
          />
          <span className="text-gray-600">Internal meetings</span>
          <span className="ml-auto font-semibold text-gray-800">
            {internalPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────

function SentimentBadge({ trend }: { trend: "positive" | "neutral" | "negative" }) {
  const config = {
    positive: {
      label: "Positive",
      bg: "bg-green-100",
      text: "text-green-700",
      dot: "bg-green-500",
    },
    neutral: {
      label: "Neutral",
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      dot: "bg-yellow-500",
    },
    negative: {
      label: "Negative",
      bg: "bg-red-100",
      text: "text-red-700",
      dot: "bg-red-500",
    },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Currency formatter ────────────────────────────────────────────────────────

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MeetingROI() {
  const dashboardQuery = useQuery<ROIDashboard>({
    queryKey: ["calendar-roi-dashboard", 30],
    queryFn: () => fetchROIDashboard(30),
    staleTime: 5 * 60 * 1000,
  });

  const coachQuery = useQuery<CoachReport>({
    queryKey: ["calendar-meeting-coach"],
    queryFn: fetchCoachReport,
    staleTime: 5 * 60 * 1000,
  });

  const dash = dashboardQuery.data;
  const coach = coachQuery.data;

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Meeting ROI & AI Coach
        </h1>
        <p className="text-gray-500 mt-1">
          ERP-linked cost analysis and sentiment coaching for your meetings.
        </p>
      </div>

      {/* ── ROI Dashboard ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          ROI Dashboard
          <span className="ml-2 text-sm font-normal text-gray-400">
            last 30 days
          </span>
        </h2>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Total meeting cost */}
          <div
            className="rounded-[10px] p-5 text-white"
            style={{ background: "#ff3a6e" }}
          >
            {dashboardQuery.isLoading ? (
              <Skeleton className="h-8 w-24 bg-red-400 mb-2" />
            ) : (
              <p className="text-2xl font-bold">
                {usd(dash?.total_cost_usd ?? 0)}
              </p>
            )}
            <p className="text-sm opacity-80 mt-1">Total Meeting Cost</p>
            <p className="text-xs opacity-60 mt-0.5">
              {dash?.total_meetings ?? "--"} meetings
            </p>
          </div>

          {/* Client meeting cost */}
          <div
            className="rounded-[10px] p-5 text-white"
            style={{ background: "#51459d" }}
          >
            {dashboardQuery.isLoading ? (
              <Skeleton className="h-8 w-24 bg-purple-400 mb-2" />
            ) : (
              <p className="text-2xl font-bold">
                {usd(dash?.client_meeting_cost_usd ?? 0)}
              </p>
            )}
            <p className="text-sm opacity-80 mt-1">Client Meeting Cost</p>
          </div>

          {/* Internal meeting cost */}
          <div
            className="rounded-[10px] p-5 text-white"
            style={{ background: "#3ec9d6" }}
          >
            {dashboardQuery.isLoading ? (
              <Skeleton className="h-8 w-24 bg-teal-400 mb-2" />
            ) : (
              <p className="text-2xl font-bold">
                {usd(dash?.internal_meeting_cost_usd ?? 0)}
              </p>
            )}
            <p className="text-sm opacity-80 mt-1">Internal Meeting Cost</p>
            <p className="text-xs opacity-60 mt-0.5">
              avg {usd(dash?.avg_cost_per_meeting_usd ?? 0)} / meeting
            </p>
          </div>
        </div>

        {/* Donut chart + top 5 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Donut */}
          <div className="bg-white rounded-[10px] border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">
              Client vs Internal Split
            </h3>
            {dashboardQuery.isLoading ? (
              <div className="flex gap-4 items-center">
                <Skeleton className="w-28 h-28 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ) : (
              <CostDonut
                clientCost={dash?.client_meeting_cost_usd ?? 0}
                internalCost={dash?.internal_meeting_cost_usd ?? 0}
              />
            )}
          </div>

          {/* Top 5 most expensive */}
          <div className="bg-white rounded-[10px] border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">
              Top 5 Most Expensive Meetings
            </h3>
            {dashboardQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : dash?.most_expensive_meetings.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No meetings found.</p>
            ) : (
              <ul className="space-y-2">
                {dash?.most_expensive_meetings.map((m) => (
                  <li
                    key={m.event_id}
                    className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {m.title}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {m.attendee_count} attendees &middot;{" "}
                        {m.duration_hours.toFixed(1)}h
                        {m.is_client_meeting && (
                          <span
                            className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                            style={{ background: "#51459d" }}
                          >
                            client
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="font-semibold text-red-500 ml-3 flex-shrink-0">
                      {usd(m.cost_usd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── AI Meeting Coach ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          AI Meeting Coach
        </h2>

        {/* Sentiment trend */}
        <div className="bg-white rounded-[10px] border border-gray-200 p-5 mb-4 flex items-center gap-4">
          {coachQuery.isLoading ? (
            <>
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </>
          ) : (
            <>
              <SentimentBadge trend={coach?.sentiment_trend ?? "neutral"} />
              <span className="text-sm text-gray-500">
                Overall sentiment across{" "}
                <strong>{coach?.meetings_analyzed ?? 0}</strong> analysed
                meetings
                {coach?.avg_sentiment_score !== undefined && (
                  <> &middot; score{" "}
                    <strong>
                      {(coach.avg_sentiment_score * 100).toFixed(0)}%
                    </strong>
                  </>
                )}
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client alerts */}
          <div className="bg-white rounded-[10px] border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">
              Relationship Alerts
            </h3>
            {coachQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !coach?.client_alerts.length ? (
              <div className="flex items-center gap-2 py-3 text-sm text-green-700">
                <span
                  className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"
                />
                All client relationships look healthy!
              </div>
            ) : (
              <ul className="space-y-3">
                {coach.client_alerts.map((alert, idx) => (
                  <li
                    key={idx}
                    className="rounded-[10px] border border-red-100 bg-red-50 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          alert.trend === "declining"
                            ? "bg-red-200 text-red-700"
                            : "bg-orange-200 text-orange-700"
                        }`}
                      >
                        {alert.trend === "declining"
                          ? "Declining"
                          : "At Risk"}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {alert.client}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      Recent scores:{" "}
                      {alert.recent_scores
                        .map((s) => `${(s * 100).toFixed(0)}%`)
                        .join(" → ")}
                    </p>
                    <p className="text-xs text-gray-600 italic">{alert.tip}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Coaching tips */}
          <div className="bg-white rounded-[10px] border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">
              Coaching Tips
            </h3>
            {coachQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !coach?.coaching_tips.length ? (
              <p className="text-sm text-gray-400 py-2">
                Add meeting notes to receive personalised coaching tips.
              </p>
            ) : (
              <ul className="space-y-2">
                {coach.coaching_tips.map((tip, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-700">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: "#51459d" }}
                    >
                      {idx + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Action items */}
        {(coachQuery.isLoading || (coach?.action_items.length ?? 0) > 0) && (
          <div className="mt-4 bg-white rounded-[10px] border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">
              Pending Action Items
            </h3>
            {coachQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {coach?.action_items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span
                      className="mt-1 w-4 h-4 rounded border-2 flex-shrink-0"
                      style={{ borderColor: "#51459d" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Error states */}
      {dashboardQuery.isError && (
        <div className="rounded-[10px] bg-red-50 border border-red-200 p-4 text-sm text-red-600">
          Failed to load ROI dashboard. Please try again.
        </div>
      )}
      {coachQuery.isError && (
        <div className="rounded-[10px] bg-red-50 border border-red-200 p-4 text-sm text-red-600">
          Failed to load coaching report. Please try again.
        </div>
      )}
    </div>
  );
}
