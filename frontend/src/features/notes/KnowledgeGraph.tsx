import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface KGNode {
  id: string
  label: string
  type: string
  entity_type: string
}

interface KGEdge {
  source: string
  target: string
  label: string
}

interface KnowledgeGraphData {
  nodes: KGNode[]
  edges: KGEdge[]
}

interface KnowledgeGraphProps {
  noteId: string
  onClose: () => void
}

const ENTITY_COLORS: Record<string, string> = {
  note: '#51459d',
  invoice: '#6fd943',
  project: '#3ec9d6',
  deal: '#ffa21d',
  contact: '#ff3a6e',
  ticket: '#9333ea',
  employee: '#f97316',
}

const SVG_WIDTH = 1000
const SVG_HEIGHT = 680
const NODE_RADIUS = 30
const CENTER_X = SVG_WIDTH / 2
const CENTER_Y = SVG_HEIGHT / 2

interface PositionedNode extends KGNode {
  x: number
  y: number
}

function layoutNodes(nodes: KGNode[]): PositionedNode[] {
  if (nodes.length === 0) return []

  // Group nodes by entity_type
  const byType = new Map<string, KGNode[]>()
  for (const node of nodes) {
    const arr = byType.get(node.entity_type) ?? []
    arr.push(node)
    byType.set(node.entity_type, arr)
  }

  const typeList = Array.from(byType.keys())
  const result: PositionedNode[] = []

  // Place each type cluster in a radial arrangement
  const typeCount = typeList.length
  const clusterRadius = Math.min(230, 80 + typeCount * 30)

  typeList.forEach((type, ti) => {
    const typeAngle = (2 * Math.PI * ti) / Math.max(typeCount, 1) - Math.PI / 2
    const clusterCx = CENTER_X + clusterRadius * Math.cos(typeAngle)
    const clusterCy = CENTER_Y + clusterRadius * Math.sin(typeAngle)
    const groupNodes = byType.get(type) ?? []
    const spreadR = Math.min(60, 20 + groupNodes.length * 15)

    groupNodes.forEach((n, ni) => {
      if (groupNodes.length === 1) {
        result.push({ ...n, x: clusterCx, y: clusterCy })
      } else {
        const a = (2 * Math.PI * ni) / groupNodes.length
        result.push({
          ...n,
          x: clusterCx + spreadR * Math.cos(a),
          y: clusterCy + spreadR * Math.sin(a),
        })
      }
    })
  })

  return result
}

function truncLabel(label: string, max = 12): string {
  return label.length > max ? label.slice(0, max - 1) + '…' : label
}

export default function KnowledgeGraph({ noteId, onClose }: KnowledgeGraphProps) {
  const [scale, setScale] = useState(1)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery<KnowledgeGraphData>({
    queryKey: ['notes', noteId, 'knowledge-graph'],
    queryFn: async () => {
      const { data } = await apiClient.get<KnowledgeGraphData>(`/notes/${noteId}/knowledge-graph`)
      return data
    },
    enabled: !!noteId,
  })

  const handleZoom = useCallback((dir: 1 | -1) => {
    setScale((s) => Math.min(2.5, Math.max(0.3, s + dir * 0.15)))
  }, [])

  const layouted = data ? layoutNodes(data.nodes) : []
  const nodeMap = new Map(layouted.map((n) => [n.id, n]))

  const highlightedEdges = selectedNodeId
    ? new Set(
        (data?.edges ?? [])
          .filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
          .map((e) => `${e.source}-${e.target}`)
      )
    : null

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
            <circle cx="12" cy="5" r="3" stroke="#51459d" strokeWidth="2" />
            <circle cx="4" cy="19" r="2" stroke="#3ec9d6" strokeWidth="2" />
            <circle cx="20" cy="19" r="2" stroke="#ffa21d" strokeWidth="2" />
            <line x1="12" y1="8" x2="4" y2="17" stroke="#9ca3af" strokeWidth="1.5" />
            <line x1="12" y1="8" x2="20" y2="17" stroke="#9ca3af" strokeWidth="1.5" />
          </svg>
          <span style={{ fontWeight: 700, color: '#111827', fontSize: 16 }}>Knowledge Graph</span>
          {selectedNodeId && (
            <button
              onClick={() => setSelectedNodeId(null)}
              style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear selection
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => handleZoom(1)} style={toolbarBtnStyle} aria-label="Zoom in">+</button>
          <button onClick={() => handleZoom(-1)} style={toolbarBtnStyle} aria-label="Zoom out">−</button>
          <button onClick={onClose} style={{ ...toolbarBtnStyle, fontSize: 18 }} aria-label="Close">×</button>
        </div>
      </div>

      {/* SVG */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#f9fafb' }}>
        {isLoading && (
          <div style={centerStyle}>
            <div style={spinnerStyle} />
            <span style={{ marginTop: 12, color: '#6b7280' }}>Building knowledge graph...</span>
          </div>
        )}

        {isError && (
          <div style={centerStyle}>
            <span style={{ color: '#ff3a6e', fontSize: 14 }}>Failed to load knowledge graph.</span>
          </div>
        )}

        {!isLoading && !isError && data && (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
            }}
            onClick={() => setSelectedNodeId(null)}
          >
            {/* Background */}
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#f9fafb" />

            {/* Edges */}
            {data.edges.map((edge, i) => {
              const src = nodeMap.get(edge.source)
              const tgt = nodeMap.get(edge.target)
              if (!src || !tgt) return null

              const edgeKey = `${edge.source}-${edge.target}`
              const highlighted = highlightedEdges ? highlightedEdges.has(edgeKey) : false
              const dimmed = highlightedEdges ? !highlighted : false

              const mx = (src.x + tgt.x) / 2
              const my = (src.y + tgt.y) / 2

              return (
                <g key={i} opacity={dimmed ? 0.15 : 1}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={highlighted ? '#51459d' : '#d1d5db'}
                    strokeWidth={highlighted ? 2 : 1.2}
                  />
                  {edge.label && (
                    <text
                      x={mx}
                      y={my - 5}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#9ca3af"
                      style={{ fontFamily: 'Open Sans, sans-serif', pointerEvents: 'none' }}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {layouted.map((node) => {
              const color = ENTITY_COLORS[node.entity_type] ?? '#6b7280'
              const isSelected = node.id === selectedNodeId
              const dimmed = selectedNodeId && !isSelected

              return (
                <g
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedNodeId(isSelected ? null : node.id)
                  }}
                  style={{ cursor: 'pointer' }}
                  opacity={dimmed ? 0.3 : 1}
                >
                  {/* Glow when selected */}
                  {isSelected && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={NODE_RADIUS + 8}
                      fill={color}
                      opacity={0.2}
                    />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_RADIUS}
                    fill={`${color}22`}
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.8}
                  />
                  <text
                    x={node.x}
                    y={node.y - 3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight={600}
                    fill={color}
                    style={{ fontFamily: 'Open Sans, sans-serif', pointerEvents: 'none' }}
                  >
                    {truncLabel(node.label)}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 12}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#9ca3af"
                    style={{ fontFamily: 'Open Sans, sans-serif', pointerEvents: 'none' }}
                  >
                    {node.entity_type}
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
          gap: 14,
          fontSize: 11,
          color: '#6b7280',
          flexWrap: 'wrap',
          background: '#fafafa',
        }}
      >
        {Object.entries(ENTITY_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span style={{ textTransform: 'capitalize' }}>{type}</span>
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
