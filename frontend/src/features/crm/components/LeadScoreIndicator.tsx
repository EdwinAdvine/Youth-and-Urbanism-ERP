import { cn } from '@/components/ui'

interface LeadScoreIndicatorProps {
  score: number
  className?: string
}

function getScoreConfig(score: number): { label: string; bgClass: string; textClass: string } {
  if (score >= 80) {
    return { label: 'Hot', bgClass: 'bg-green-100', textClass: 'text-green-700' }
  }
  if (score >= 60) {
    return { label: 'Warm', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' }
  }
  if (score >= 40) {
    return { label: 'Cool', bgClass: 'bg-orange-100', textClass: 'text-orange-700' }
  }
  return { label: 'Cold', bgClass: 'bg-red-100', textClass: 'text-red-700' }
}

export default function LeadScoreIndicator({ score, className }: LeadScoreIndicatorProps) {
  const config = getScoreConfig(score)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        config.bgClass,
        config.textClass,
        className
      )}
      title={`Lead score: ${score} (${config.label})`}
    >
      {score}
      <span className="text-[10px] font-medium opacity-75">{config.label}</span>
    </span>
  )
}
