import { Badge, cn } from '@/components/ui'
import LeadScoreIndicator from './LeadScoreIndicator'

interface DealCardProps {
  title: string
  expected_value: number
  probability: number
  score?: number | null
  assigned_to?: string | null
  contact_name?: string | null
  stage?: string
  onClick?: () => void
  className?: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function DealCard({
  title,
  expected_value,
  probability,
  score,
  assigned_to,
  contact_name,
  stage,
  onClick,
  className,
}: DealCardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 shadow-sm p-4 hover:shadow-md transition-shadow',
        onClick && 'cursor-pointer active:scale-[0.98]',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 leading-tight truncate flex-1">
          {title}
        </h3>
        {score != null && <LeadScoreIndicator score={score} />}
      </div>

      {contact_name && (
        <p className="text-xs text-gray-500 mt-1 truncate">{contact_name}</p>
      )}

      <div className="flex items-center justify-between mt-2">
        <p className="text-sm font-semibold text-primary">
          {formatCurrency(expected_value)}
        </p>
        <Badge variant="default">{probability}%</Badge>
      </div>

      <div className="flex items-center justify-between mt-2">
        {assigned_to && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
              {assigned_to[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[100px]">{assigned_to}</span>
          </div>
        )}
        {stage && (
          <span className="text-xs text-gray-400">{stage}</span>
        )}
      </div>
    </div>
  )
}
