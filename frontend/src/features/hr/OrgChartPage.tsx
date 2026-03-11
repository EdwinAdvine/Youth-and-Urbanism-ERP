import { useState } from 'react'
import { Card, Spinner } from '../../components/ui'
import { useOrgChart, type OrgChartNode } from '../../api/hr'

function OrgNode({ node, depth = 0, isMobile = false }: { node: OrgChartNode; depth?: number; isMobile?: boolean }) {
  const [expanded, setExpanded] = useState(depth < (isMobile ? 1 : 2))
  const hasChildren = node.children && node.children.length > 0

  if (isMobile) {
    // Mobile: vertical list layout with indentation
    return (
      <div className="w-full">
        <button
          className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] shadow-sm px-4 py-3 active:bg-gray-50 transition-colors min-h-[56px] flex items-center gap-3"
          style={{ marginLeft: depth * 16 }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
            {node.avatar_url ? (
              <img src={node.avatar_url} alt={node.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              node.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{node.name}</p>
            <p className="text-xs text-gray-500 truncate">{node.job_title}</p>
            {node.department_name && (
              <p className="text-xs text-primary/70 truncate">{node.department_name}</p>
            )}
          </div>
          {hasChildren && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-400">{node.children.length}</span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </button>

        {hasChildren && expanded && (
          <div className="space-y-2 mt-2">
            {node.children.map((child) => (
              <OrgNode key={child.id} node={child} depth={depth + 1} isMobile />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Desktop: horizontal tree layout
  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] shadow-sm px-5 py-4 min-w-[200px] cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
            {node.avatar_url ? (
              <img src={node.avatar_url} alt={node.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              node.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{node.name}</p>
            <p className="text-xs text-gray-500 truncate">{node.job_title}</p>
            {node.department_name && (
              <p className="text-xs text-primary/70 truncate">{node.department_name}</p>
            )}
          </div>
          {hasChildren && (
            <span className="ml-auto text-gray-400 text-xs shrink-0">
              {expanded ? '\u2212' : '+'} {node.children.length}
            </span>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <>
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex gap-8 relative">
            {node.children.length > 1 && (
              <div
                className="absolute top-0 border-t-2 border-gray-300"
                style={{
                  left: '50%',
                  right: '50%',
                  marginLeft: `-${(node.children.length - 1) * 68}px`,
                  marginRight: `-${(node.children.length - 1) * 68}px`,
                }}
              />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-6 bg-gray-300" />
                <OrgNode node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function OrgChartPage() {
  const { data: nodes, isLoading } = useOrgChart()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Organization Chart</h1>
        <p className="text-sm text-gray-500 mt-1">Visual hierarchy of your organization</p>
      </div>

      {/* Desktop: horizontal tree with scroll */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto py-8">
          <div className="flex flex-col items-center gap-4 min-w-[600px]">
            {nodes && nodes.length > 0 ? (
              nodes.map((node) => (
                <OrgNode key={node.id} node={node} />
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg font-medium">No organization data</p>
                <p className="text-sm mt-1">Add employees with manager relationships to build the org chart</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Mobile: collapsible vertical list */}
      <div className="block md:hidden space-y-2">
        {nodes && nodes.length > 0 ? (
          nodes.map((node) => (
            <OrgNode key={node.id} node={node} isMobile />
          ))
        ) : (
          <Card className="text-center py-8">
            <p className="text-sm text-gray-400">No organization data</p>
            <p className="text-xs text-gray-300 mt-1">Add employees with manager relationships to build the org chart</p>
          </Card>
        )}
      </div>
    </div>
  )
}
