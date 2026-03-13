/**
 * LineageGraph.tsx — Data lineage visualization for Analytics dashboards.
 *
 * Renders a directed acyclic graph showing which source tables/queries/transforms
 * feed each widget. Uses a simple SVG-based layout (no external graph library needed).
 *
 * Usage:
 *   <LineageGraph dashboardId="..." />
 *   <LineageGraph widgetId="..." />
 */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import apiClient from '@/api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineageNode {
  id: string
  type: 'widget' | 'transform' | 'table' | 'query' | string
  label: string
  source_type?: string | null
}

interface LineageEdge {
  id: string
  source: string
  target: string
  label?: string | null
}

interface LineageGraph {
  nodes: LineageNode[]
  edges: LineageEdge[]
}

// ── API hooks ─────────────────────────────────────────────────────────────────

function useWidgetLineage(widgetId: string | undefined) {
  return useQuery<LineageGraph>({
    queryKey: ['analytics', 'lineage', 'widget', widgetId],
    queryFn: () => apiClient.get(`/analytics/lineage/widget/${widgetId}`).then(r => r.data),
    enabled: !!widgetId,
  })
}

function useDashboardLineage(dashboardId: string | undefined) {
  return useQuery<LineageGraph>({
    queryKey: ['analytics', 'lineage', 'dashboard', dashboardId],
    queryFn: () => apiClient.get(`/analytics/lineage/dashboard/${dashboardId}`).then(r => r.data),
    enabled: !!dashboardId,
  })
}

// ── Layout helpers ────────────────────────────────────────────────────────────

const NODE_W = 160
const NODE_H = 50
const COL_GAP = 220
const ROW_GAP = 80

type LayoutNode = LineageNode & { x: number; y: number }

function layoutNodes(nodes: LineageNode[], edges: LineageEdge[]): LayoutNode[] {
  // Simple layered layout: tables/queries on left, transforms in middle, widgets on right
  const typeOrder: Record<string, number> = { table: 0, query: 0, transform: 1, widget: 2 }
  const cols: Map<number, LineageNode[]> = new Map()

  for (const n of nodes) {
    const col = typeOrder[n.type] ?? 0
    if (!cols.has(col)) cols.set(col, [])
    cols.get(col)!.push(n)
  }

  const positioned: LayoutNode[] = []
  for (const [col, colNodes] of Array.from(cols.entries()).sort((a, b) => a[0] - b[0])) {
    colNodes.forEach((n, i) => {
      positioned.push({ ...n, x: col * COL_GAP + 40, y: i * (NODE_H + ROW_GAP) + 40 })
    })
  }
  return positioned
}

// ── Node color by type ────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  widget: '#51459d',
  transform: '#3ec9d6',
  table: '#6fd943',
  query: '#ffa21d',
}

function nodeColor(type: string) {
  return NODE_COLORS[type] ?? '#9ca3af'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LineageGraphProps {
  dashboardId?: string
  widgetId?: string
}

export default function LineageGraph({ dashboardId, widgetId }: LineageGraphProps) {
  const dashboardQuery = useDashboardLineage(dashboardId)
  const widgetQuery = useWidgetLineage(widgetId)
  const query = dashboardId ? dashboardQuery : widgetQuery
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const { data, isLoading, isError } = query

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading lineage graph…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-48 text-red-400 text-sm">
        Failed to load lineage data.
      </div>
    )
  }

  if (data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400 text-sm">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span>No lineage data recorded yet.</span>
        <span className="text-xs">Lineage is tracked automatically when transforms run.</span>
      </div>
    )
  }

  const layouted = layoutNodes(data.nodes, data.edges)
  const nodeMap = new Map(layouted.map(n => [n.id, n]))

  const svgW = Math.max(...layouted.map(n => n.x + NODE_W)) + 60
  const svgH = Math.max(...layouted.map(n => n.y + NODE_H)) + 60

  return (
    <div className="relative w-full overflow-auto border border-gray-200 rounded-xl bg-gray-50">
      {/* Legend */}
      <div className="flex gap-4 px-4 pt-3 pb-1 text-xs text-gray-500">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="block"
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {data.edges.map(edge => {
          const src = nodeMap.get(edge.source)
          const tgt = nodeMap.get(edge.target)
          if (!src || !tgt) return null
          const x1 = src.x + NODE_W
          const y1 = src.y + NODE_H / 2
          const x2 = tgt.x
          const y2 = tgt.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          return (
            <g key={edge.id}>
              <path
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              {edge.label && (
                <text
                  x={mx}
                  y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#6b7280"
                >
                  {edge.label.length > 20 ? edge.label.slice(0, 20) + '…' : edge.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {layouted.map(node => (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => setTooltip({ text: node.label, x: node.x + NODE_W / 2, y: node.y })}
            onMouseLeave={() => setTooltip(null)}
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill={nodeColor(node.type)}
              opacity={0.9}
            />
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={600}
              fill="#fff"
            >
              {node.label.length > 18 ? node.label.slice(0, 18) + '…' : node.label}
            </text>
            <text
              x={NODE_W / 2}
              y={NODE_H - 8}
              textAnchor="middle"
              fontSize={9}
              fill="rgba(255,255,255,0.7)"
            >
              {node.type}
            </text>
          </g>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <g transform={`translate(${tooltip.x},${tooltip.y - 30})`}>
            <rect x={-70} y={-16} width={140} height={22} rx={4} fill="#1f2937" opacity={0.9} />
            <text textAnchor="middle" y={0} fontSize={11} fill="#f9fafb">
              {tooltip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
