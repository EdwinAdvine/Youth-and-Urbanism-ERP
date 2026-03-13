/**
 * EmbedViewer — stripped-down read-only dashboard viewer for embed tokens.
 * Accessed via /embed/dashboard/:token — no authentication required.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import ChartRenderer from '../../components/charts/ChartRenderer'
import { Spinner } from '../../components/ui'

interface EmbedWidget {
  id: string
  title: string
  type: string
  data: Record<string, unknown>[]
  config: Record<string, unknown>
}

interface EmbedDashboard {
  name: string
  widgets: EmbedWidget[]
}

type LoadState = 'loading' | 'error' | 'ready'

export default function EmbedViewer() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<LoadState>('loading')
  const [dashboard, setDashboard] = useState<EmbedDashboard | null>(null)

  useEffect(() => {
    if (!token) {
      setState('error')
      return
    }

    axios
      .get(`/api/v1/analytics/embed/${token}`)
      .then(res => {
        setDashboard(res.data)
        setState('ready')
      })
      .catch(() => {
        setState('error')
      })
  }, [token])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (state === 'error' || !dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <span className="text-2xl font-bold" style={{ color: '#51459d' }}>Y&amp;U ERP</span>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Invalid or expired embed link</p>
          <p className="text-sm text-gray-400 mt-1">This dashboard embed token is no longer valid.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 relative">
      {/* Minimal header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-3 flex items-center gap-3">
        <span className="text-lg font-bold" style={{ color: '#51459d' }}>Y&amp;U ERP</span>
        <span className="text-gray-300 dark:text-gray-600 select-none">|</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{dashboard.name}</span>
      </header>

      {/* Widget grid */}
      <main className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboard.widgets.map(widget => (
            <div
              key={widget.id}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] p-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{widget.title}</h3>
              <ChartRenderer
                type={widget.type as 'bar' | 'line' | 'area' | 'donut' | 'pie'}
                data={widget.data}
                config={widget.config as Parameters<typeof ChartRenderer>[0]['config']}
                height={200}
              />
            </div>
          ))}
        </div>
      </main>

      {/* Watermark */}
      <div className="fixed bottom-3 right-4 text-xs text-gray-300 dark:text-gray-700 select-none pointer-events-none">
        Powered by Y&amp;U ERP
      </div>
    </div>
  )
}
