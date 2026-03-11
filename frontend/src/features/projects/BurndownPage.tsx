import { useState, useMemo } from 'react'
import { Card, Spinner, Select } from '../../components/ui'
import { useProjects } from '../../api/projects'
import { useProjectReport, type BurndownPoint } from '../../api/projects_ext'

export default function BurndownPage() {
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const [selectedProject, setSelectedProject] = useState('')
  const projectId = selectedProject || (projects?.[0]?.id ?? '')

  const { data: report, isLoading } = useProjectReport(projectId)

  if (loadingProjects) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  const burndown = report?.burndown ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Burndown Chart</h1>
          <p className="text-sm text-gray-500 mt-1">Track task completion over time</p>
        </div>
        <div className="w-64">
          <Select
            value={projectId}
            onChange={(e) => setSelectedProject(e.target.value)}
            options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>

      {/* Stats summary */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={report.total_tasks} color="text-primary" />
          <StatCard label="Completed" value={report.completed_tasks} color="text-green-600" />
          <StatCard label="In Progress" value={report.in_progress_tasks} color="text-cyan-600" />
          <StatCard label="Overdue" value={report.overdue_tasks} color="text-red-600" />
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-24"><Spinner /></div>
        ) : burndown.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            No burndown data available. Tasks need start dates and completion status to generate this chart.
          </div>
        ) : (
          <BurndownChart data={burndown} />
        )}
      </Card>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </Card>
  )
}

function BurndownChart({ data }: { data: BurndownPoint[] }) {
  const CHART_W = 800
  const CHART_H = 300
  const PAD = { top: 20, right: 30, bottom: 40, left: 50 }
  const W = CHART_W - PAD.left - PAD.right
  const H = CHART_H - PAD.top - PAD.bottom

  const maxVal = useMemo(() => {
    return Math.max(...data.map((d) => Math.max(d.remaining, d.ideal, d.completed)), 1)
  }, [data])

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * W
  const yScale = (v: number) => PAD.top + H - (v / maxVal) * H

  const remainingPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.remaining)}`).join(' ')
  const idealPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.ideal)}`).join(' ')
  const completedPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.completed)}`).join(' ')

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i))
  const xLabels = data.length <= 10 ? data : data.filter((_, i) => i % Math.ceil(data.length / 8) === 0 || i === data.length - 1)

  return (
    <div>
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-red-500" />
          <span className="text-xs text-gray-500">Remaining</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-gray-300" style={{ borderTop: '2px dashed #d1d5db' }} />
          <span className="text-xs text-gray-500">Ideal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-500" />
          <span className="text-xs text-gray-500">Completed</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yScale(v)} x2={CHART_W - PAD.right} y2={yScale(v)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" className="text-[10px] fill-gray-400">{v}</text>
          </g>
        ))}
        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + H} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + H} x2={CHART_W - PAD.right} y2={PAD.top + H} stroke="#e2e8f0" strokeWidth="1" />
        {/* X labels */}
        {xLabels.map((d) => {
          const idx = data.indexOf(d)
          return (
            <text key={d.date} x={xScale(idx)} y={CHART_H - 8} textAnchor="middle" className="text-[9px] fill-gray-400">
              {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </text>
          )
        })}
        {/* Ideal line */}
        <path d={idealPath} fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="6 3" />
        {/* Remaining line */}
        <path d={remainingPath} fill="none" stroke="#ef4444" strokeWidth="2" />
        {/* Completed line */}
        <path d={completedPath} fill="none" stroke="#22c55e" strokeWidth="2" />
        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xScale(i)} cy={yScale(d.remaining)} r="3" fill="#ef4444" />
            <circle cx={xScale(i)} cy={yScale(d.completed)} r="3" fill="#22c55e" />
          </g>
        ))}
      </svg>
    </div>
  )
}
