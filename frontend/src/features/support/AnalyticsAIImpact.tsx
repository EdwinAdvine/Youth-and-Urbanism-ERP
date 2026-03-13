import { useState } from 'react';
import { useAnalyticsAIImpact, useAnalyticsForecast } from '@/api/support_phase3';

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

interface CompareBarProps {
  label: string;
  aiValue: number;
  manualValue: number;
  color: string;
}

function CompareBar({ label, aiValue, manualValue, color }: CompareBarProps) {
  const total = aiValue + manualValue || 1;
  const aiPct = Math.round((aiValue / total) * 100);
  const manualPct = 100 - aiPct;
  return (
    <div className="mb-6">
      <div className="flex justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">{aiPct}% AI</span>
      </div>
      <div className="h-8 flex rounded-lg overflow-hidden">
        <div
          className="flex items-center justify-center text-white text-xs font-semibold transition-all duration-700"
          style={{ width: `${aiPct}%`, backgroundColor: color, minWidth: aiPct > 0 ? '32px' : '0' }}
        >
          {aiPct > 8 && `${aiPct}%`}
        </div>
        <div
          className="flex items-center justify-center text-gray-600 text-xs font-semibold bg-gray-100 transition-all duration-700"
          style={{ width: `${manualPct}%`, minWidth: manualPct > 0 ? '32px' : '0' }}
        >
          {manualPct > 8 && `${manualPct}%`}
        </div>
      </div>
      <div className="flex gap-4 mt-1.5">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, display: 'inline-block' }} />
          AI: {aiValue}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />
          Manual: {manualValue}
        </span>
      </div>
    </div>
  );
}

interface ForecastPoint {
  date: string;
  predicted_volume: number;
  confidence_lower?: number;
  confidence_upper?: number;
}

export default function AnalyticsAIImpact() {
  const [days, setDays] = useState(30);
  const { start, end } = getDateRange(days);
  const { data: impact, isLoading: loadingImpact } = useAnalyticsAIImpact(start, end);
  const { data: forecast, isLoading: loadingForecast } = useAnalyticsForecast();

  const totalTickets = (impact?.ai_classified ?? 0) + (impact?.manual_classified ?? 0) || 1;
  const totalResponded = (impact?.ai_responded ?? 0) + (impact?.manual_responded ?? 0) || 1;
  const totalDeflected = (impact?.ai_deflected ?? 0) + ((totalTickets) - (impact?.ai_deflected ?? 0)) || 1;

  const classifiedPct = impact ? Math.round(((impact.ai_classified ?? 0) / totalTickets) * 100) : 0;
  const respondedPct = impact ? Math.round(((impact.ai_responded ?? 0) / totalResponded) * 100) : 0;
  const deflectedPct = impact ? Math.round(((impact.ai_deflected ?? 0) / totalDeflected) * 100) : 0;

  const forecastPoints: ForecastPoint[] = forecast ?? [];
  const maxForecast = Math.max(...forecastPoints.map((f) => f.predicted_volume), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Impact Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Measure how AI is accelerating your support operations</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                days === d ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#51459d]'
              }`}
              style={days === d ? { backgroundColor: '#51459d' } : {}}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'AI Classified', pct: classifiedPct, color: '#51459d', desc: 'Tickets auto-classified by AI' },
          { label: 'AI Auto-Responded', pct: respondedPct, color: '#3ec9d6', desc: 'Tickets with AI-generated first reply' },
          { label: 'AI Deflected', pct: deflectedPct, color: '#6fd943', desc: 'Tickets resolved without agent' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{item.label}</p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold" style={{ color: item.color }}>
                {loadingImpact ? '—' : `${item.pct}%`}
              </span>
            </div>
            <p className="text-xs text-gray-400">{item.desc}</p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${item.pct}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Bars */}
      {!loadingImpact && impact && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-5">AI vs Manual Comparison</h2>
          <CompareBar
            label="Classification"
            aiValue={impact.ai_classified ?? 0}
            manualValue={impact.manual_classified ?? 0}
            color="#51459d"
          />
          <CompareBar
            label="Auto-Response"
            aiValue={impact.ai_responded ?? 0}
            manualValue={impact.manual_responded ?? 0}
            color="#3ec9d6"
          />
          <CompareBar
            label="Deflection"
            aiValue={impact.ai_deflected ?? 0}
            manualValue={Math.max(0, totalDeflected - (impact.ai_deflected ?? 0))}
            color="#6fd943"
          />
        </div>
      )}

      {/* Forecast Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-1">7-Day Volume Forecast</h2>
        <p className="text-xs text-gray-400 mb-5">Predicted ticket volumes for the next 7 days</p>
        {loadingForecast ? (
          <div className="text-center py-10 text-gray-400">Loading forecast…</div>
        ) : forecastPoints.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No forecast data available.</div>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {forecastPoints.map((pt, i) => {
              const h = Math.max(16, (pt.predicted_volume / maxForecast) * 144);
              const dayLabel = new Date(pt.date).toLocaleDateString('en-US', { weekday: 'short' });
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-700">{pt.predicted_volume}</span>
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 relative group"
                    style={{ height: `${h}px`, backgroundColor: '#51459d', opacity: 0.75 + i * 0.03 }}
                  >
                    {pt.confidence_upper && (
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-lg opacity-20"
                        style={{
                          height: `${Math.max(0, ((pt.confidence_upper - pt.predicted_volume) / maxForecast) * 144)}px`,
                          backgroundColor: '#51459d',
                        }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Time Saved Estimate */}
      {!loadingImpact && impact && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Estimated Time Saved</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Classification Time Saved', value: `${Math.round((impact.ai_classified ?? 0) * 2)} min`, color: '#51459d' },
              { label: 'Response Time Saved', value: `${Math.round((impact.ai_responded ?? 0) * 5)} min`, color: '#3ec9d6' },
              { label: 'Tickets Deflected', value: impact.ai_deflected ?? 0, color: '#6fd943' },
              {
                label: 'Total Hours Saved',
                value: `${(((impact.ai_classified ?? 0) * 2 + (impact.ai_responded ?? 0) * 5 + (impact.ai_deflected ?? 0) * 15) / 60).toFixed(1)}h`,
                color: '#ffa21d',
              },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-lg bg-gray-50">
                <p className="text-xl font-bold" style={{ color: item.color }}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
