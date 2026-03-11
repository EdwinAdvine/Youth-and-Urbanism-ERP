import { cn } from '@/components/ui'
import DealCard from './DealCard'

interface Stage {
  name: string
  probability: number
  color: string
  position: number
}

interface BoardItem {
  id: string
  title: string
  expected_value?: number
  value?: number
  probability?: number
  score?: number | null
  assigned_to?: string | null
  contact_name?: string | null
  [key: string]: any
}

interface SwimlaneBoardProps {
  stages: Stage[]
  /** board[stageName] = items[] */
  board: Record<string, BoardItem[]>
  /** Optional swimlanes: swimlanes[swimlaneName][stageName] = items[] */
  swimlanes?: Record<string, Record<string, BoardItem[]>> | null
  onCardClick?: (item: BoardItem) => void
  className?: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function StageColumn({
  stage,
  items,
  onCardClick,
}: {
  stage: Stage
  items: BoardItem[]
  onCardClick?: (item: BoardItem) => void
}) {
  const totalValue = items.reduce((sum, item) => sum + (item.expected_value ?? item.value ?? 0), 0)

  return (
    <div className="flex-shrink-0 w-[260px] sm:w-[280px] lg:flex-1 lg:w-auto lg:min-w-[200px]">
      {/* Column Header */}
      <div
        className="rounded-t-[10px] border-t-4 px-3 py-2.5"
        style={{ borderTopColor: stage.color, backgroundColor: `${stage.color}08` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {stage.name}
            </span>
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5">
              {items.length}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-medium">
          {formatCurrency(totalValue)}
        </p>
      </div>

      {/* Cards */}
      <div className="space-y-2 mt-2 min-h-[120px]">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
            No items
          </div>
        ) : (
          items.map((item) => (
            <DealCard
              key={item.id}
              title={item.title}
              expected_value={item.expected_value ?? item.value ?? 0}
              probability={item.probability ?? 0}
              score={item.score}
              assigned_to={item.assigned_to}
              contact_name={item.contact_name}
              onClick={onCardClick ? () => onCardClick(item) : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function SwimlaneBoard({
  stages,
  board,
  swimlanes,
  onCardClick,
  className,
}: SwimlaneBoardProps) {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position)

  if (swimlanes && Object.keys(swimlanes).length > 0) {
    return (
      <div className={cn('space-y-6', className)}>
        {Object.entries(swimlanes).map(([swimlaneName, swimlaneBoard]) => (
          <div key={swimlaneName}>
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3 px-1">
              {swimlaneName}
            </h3>
            <div className="overflow-x-auto pb-3 -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="flex gap-3 min-w-0 lg:min-w-[900px]">
                {sortedStages.map((stage) => (
                  <StageColumn
                    key={stage.name}
                    stage={stage}
                    items={swimlaneBoard[stage.name] ?? []}
                    onCardClick={onCardClick}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto pb-4 -mx-4 sm:mx-0 px-4 sm:px-0', className)}>
      <div className="flex gap-3 min-w-0 lg:min-w-[900px]">
        {sortedStages.map((stage) => (
          <StageColumn
            key={stage.name}
            stage={stage}
            items={board[stage.name] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </div>
  )
}
