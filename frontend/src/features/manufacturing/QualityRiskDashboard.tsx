import { useState } from 'react'
import { Card, Badge, Select } from '../../components/ui'
import { useQualityRiskAnalysis } from '../../api/manufacturing_ai'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const riskColors: Record<string, BadgeVariant> = { high: 'danger', medium: 'warning', low: 'success' }

export default function QualityRiskDashboard() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useQualityRiskAnalysis(days)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Quality Risk Dashboard</h1>
          {data && (
            <Badge variant={riskColors[data.overall_risk] || 'default'} className="text-sm capitalize">
              {data.overall_risk} Risk
            </Badge>
          )}
        </div>
        <Select value={String(days)} onChange={e => setDays(Number(e.target.value))} className="w-36">
          <option value="7">7 Days</option>
          <option value="30">30 Days</option>
          <option value="90">90 Days</option>
        </Select>
      </div>

      {isLoading && <Card className="p-8 text-center">Analyzing quality risks...</Card>}

      {data && (
        <div className="space-y-6">
          {/* NCR Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs text-gray-500">Total NCRs</div>
              <div className="text-2xl font-bold">{data.total_ncrs}</div>
            </Card>
            {(['critical', 'major', 'minor'] as const).map(sev => (
              <Card key={sev} className="p-4">
                <div className="text-xs text-gray-500 capitalize">{sev}</div>
                <div className={`text-2xl font-bold ${sev === 'critical' ? 'text-red-600' : sev === 'major' ? 'text-orange-500' : 'text-yellow-500'}`}>
                  {data.ncr_by_severity[sev] || 0}
                </div>
              </Card>
            ))}
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <Card className="p-4 space-y-2">
              <h2 className="font-semibold">AI Recommendations</h2>
              <ul className="space-y-1">
                {data.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm">{rec}</li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SPC At-Risk Items */}
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">SPC At-Risk Items</h2>
              {data.spc_at_risk_items.length === 0 ? (
                <div className="text-gray-500 text-sm">All SPC measurements within control limits ✓</div>
              ) : (
                <div className="space-y-2">
                  {data.spc_at_risk_items.map(item => (
                    <div key={item.inspection_plan_item_id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <div className="font-mono text-xs">{item.inspection_plan_item_id.slice(0, 8)}...</div>
                        <div className="text-xs text-gray-500">{item.total_measurements} measurements</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${item.risk_level === 'high' ? 'text-red-600' : 'text-yellow-500'}`}>
                          {item.ooc_rate_percent}% OOC
                        </div>
                        <Badge variant={riskColors[item.risk_level] || 'default'} className="text-xs">{item.risk_level}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Low Pass-Rate Workstations */}
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">Low Pass-Rate Workstations</h2>
              {data.low_pass_rate_workstations.length === 0 ? (
                <div className="text-gray-500 text-sm">All workstations above 90% pass rate ✓</div>
              ) : (
                <div className="space-y-2">
                  {data.low_pass_rate_workstations.map(ws => (
                    <div key={ws.workstation_id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <div className="font-mono text-xs">{ws.workstation_id.slice(0, 8)}...</div>
                        <div className="text-xs text-gray-500">{ws.inspected} inspected, {ws.failed} failed</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${ws.risk_level === 'high' ? 'text-red-600' : 'text-yellow-500'}`}>
                          {ws.pass_rate_percent}%
                        </div>
                        <Badge variant={riskColors[ws.risk_level] || 'default'} className="text-xs">{ws.risk_level}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
