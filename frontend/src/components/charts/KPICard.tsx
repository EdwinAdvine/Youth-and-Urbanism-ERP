interface KPICardProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  color?: string
  prefix?: string
  suffix?: string
}

export default function KPICard({
  label,
  value,
  change,
  changeLabel,
  icon,
  color = '#51459d',
  prefix = '',
  suffix = '',
}: KPICardProps) {
  const isPositive = change !== undefined && change >= 0
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        {icon ? (
          <div
            className="w-10 h-10 rounded-[8px] flex items-center justify-center text-lg"
            style={{ backgroundColor: color + '20', color }}
          >
            {icon}
          </div>
        ) : (
          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: color }} />
        )}
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
            isPositive ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30' : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
          }`}>
            <svg className={`h-3 w-3 ${isPositive ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {prefix}{displayValue}{suffix}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      {changeLabel && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{changeLabel}</p>
      )}
    </div>
  )
}
