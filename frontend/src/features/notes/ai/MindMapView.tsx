import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'

interface MindMapNode {
  id: string
  label: string
  parent_id: string | null
  level: number
}

interface MindMapEdge {
  source: string
  target: string
}

interface MindMapData {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}

interface MindMapViewProps {
  noteId: string
  onClose: () => void
}

interface LayoutNode extends MindMapNode {
  x: number
  y: number
}

const WIDTH = 900
const HEIGHT = 600
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2
const NODE_RX = 60
const NODE_RY = 24

function buildLayout(nodes: MindMapNode[]): LayoutNode[] {
  const root = nodes.find((n) => n.level === 0)
  if (!root) return []

  const result: LayoutNode[] = []
  const byParent = new Map<string | null, MindMapNode[]>()
  for (const n of nodes) {
    const arr = byParent.get(n.parent_id) ?? []
    arr.push(n)
    byParent.set(n.parent_id, arr)
  }

  result.push({ ...root, x: CENTER_X, y: CENTER_Y })

  const level1 = byParent.get(root.id) ?? []
  const l1Count = level1.length
  const l1Radius = 180

  level1.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(l1Count, 1) - Math.PI / 2
    const x = CENTER_X + l1Radius * Math.cos(angle)
    const y = CENTER_Y + l1Radius * Math.sin(angle)
    result.push({ ...n, x, y })

    const level2 = byParent.get(n.id) ?? []
    const l2Count = level2.length
    const l2Radius = 110
    const spreadAngle = Math.PI / Math.max(l2Count + 1, 2)
    const baseAngle = angle - (spreadAngle * (l2Count - 1)) / 2

    level2.forEach((c, j) => {
      const ca = baseAngle + spreadAngle * j
      const cx = x + l2Radius * Math.cos(ca)
      const cy = y + l2Radius * Math.sin(ca)
      result.push({ ...c, x: cx, y: cy })
    })
  })

  return result
}

function nodeColor(level: number): string {
  if (level === 0) return '#51459d'
  if (level === 1) return '#3ec9d6'
  return '#6fd943'
}

function CurvedEdge({
  x1, y1, x2, y2,
}: { x1: number; y1: number; x2: number; y2: number }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <path
      d={`M ${x1} ${y1} Q ${mx} ${y1} ${mx} ${my} Q ${mx} ${y2} ${x2} ${y2}`}
      fill="none"
      stroke="#d1d5db"
      strokeWidth={1.5}
    />
  )
}

export default function MindMapView({ noteId, onClose }: MindMapViewProps) {
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery<MindMapData>({
    queryKey: ['notes', noteId, 'mindmap'],
    queryFn: async () => {
      const { data } = await apiClient.get<MindMapData>(`/notes/ai/${noteId}/mindmap`)
      return data
    },
    enabled: !!noteId,
  })

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<MindMapData>(`/notes/ai/${noteId}/mindmap`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', noteId, 'mindmap'] })
    },
  })

  const [svgPan, setSvgPan] = useState({ x: 0, y: 0, scale: 1 })

  const handleZoom = (dir: 1 | -1) => {
    setSvgPan((prev) => ({
      ...prev,
      scale: Math.min(2.5, Math.max(0.4, prev.scale + dir * 0.15)),
    }))
  }

  const layoutNodes = data ? buildLayout(data.nodes) : []
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Open Sans, sans-serif',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="#51459d" />
            <circle cx="4" cy="6" r="2" fill="#3ec9d6" />
            <circle cx="20" cy="6" r="2" fill="#3ec9d6" />
            <circle cx="4" cy="18" r="2" fill="#6fd943" />
            <circle cx="20" cy="18" r="2" fill="#6fd943" />
            <line x1="12" y1="12" x2="4" y2="6" stroke="#d1d5db" strokeWidth="1.5" />
            <line x1="12" y1="12" x2="20" y2="6" stroke="#d1d5db" strokeWidth="1.5" />
            <line x1="12" y1="12" x2="4" y2="18" stroke="#d1d5db" strokeWidth="1.5" />
            <line x1="12" y1="12" x2="20" y2="18" stroke="#d1d5db" strokeWidth="1.5" />
          </svg>
          <span style={{ fontWeight: 700, color: '#111827', fontSize: 16 }}>Mind Map</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => handleZoom(1)}
            style={toolbarBtnStyle}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => handleZoom(-1)}
            style={toolbarBtnStyle}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            style={{
              ...toolbarBtnStyle,
              background: '#51459d',
              color: '#fff',
              border: 'none',
              opacity: regenerateMutation.isPending ? 0.7 : 1,
            }}
          >
            {regenerateMutation.isPending ? 'Generating...' : 'Regenerate'}
          </button>
          <button onClick={onClose} style={{ ...toolbarBtnStyle, fontSize: 18 }} aria-label="Close">
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isLoading && (
          <div style={centerStyle}>
            <div style={spinnerStyle} />
            <span style={{ marginTop: 12, color: '#6b7280' }}>Loading mind map...</span>
          </div>
        )}

        {isError && (
          <div style={centerStyle}>
            <span style={{ color: '#ff3a6e', fontSize: 14 }}>
              Failed to load mind map.{' '}
              <button
                onClick={() => regenerateMutation.mutate()}
                style={{ color: '#51459d', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Generate now
              </button>
            </span>
          </div>
        )}

        {!isLoading && !isError && data && (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{
              transform: `scale(${svgPan.scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
            }}
          >
            {/* Edges */}
            {data.edges.map((edge, i) => {
              const src = nodeMap.get(edge.source)
              const tgt = nodeMap.get(edge.target)
              if (!src || !tgt) return null
              return <CurvedEdge key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} />
            })}

            {/* Nodes */}
            {layoutNodes.map((node) => {
              const color = nodeColor(node.level)
              const isRoot = node.level === 0
              return (
                <g key={node.id}>
                  <ellipse
                    cx={node.x}
                    cy={node.y}
                    rx={isRoot ? NODE_RX + 10 : NODE_RX}
                    ry={isRoot ? NODE_RY + 4 : NODE_RY}
                    fill={color}
                    opacity={0.15}
                    stroke={color}
                    strokeWidth={isRoot ? 2.5 : 1.5}
                  />
                  <ellipse
                    cx={node.x}
                    cy={node.y}
                    rx={isRoot ? NODE_RX + 10 : NODE_RX}
                    ry={isRoot ? NODE_RY + 4 : NODE_RY}
                    fill="none"
                    stroke={color}
                    strokeWidth={isRoot ? 2.5 : 1.5}
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isRoot ? 13 : 11}
                    fontWeight={isRoot ? 700 : 500}
                    fill={isRoot ? '#51459d' : '#1f2937'}
                    style={{ fontFamily: 'Open Sans, sans-serif' }}
                  >
                    {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          padding: '8px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 16,
          fontSize: 12,
          color: '#6b7280',
        }}
      >
        {[
          { color: '#51459d', label: 'Root' },
          { color: '#3ec9d6', label: 'Level 1' },
          { color: '#6fd943', label: 'Level 2+' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const toolbarBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontFamily: 'Open Sans, sans-serif',
  color: '#374151',
}

const centerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '3px solid #e5e7eb',
  borderTop: '3px solid #51459d',
  animation: 'spin 1s linear infinite',
}
