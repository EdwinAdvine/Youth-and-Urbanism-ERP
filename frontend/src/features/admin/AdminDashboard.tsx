import { useNavigate } from 'react-router-dom'
import { useAdminStats } from '../../api/admin'
import { Card, Spinner } from '../../components/ui'

interface StatCard {
  label: string
  value: string | number
  icon: string
  color: string
  bg: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useAdminStats()

  const statCards: StatCard[] = [
    { label: 'Total Users', value: stats?.total_users ?? '—', icon: '👥', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Sessions', value: stats?.active_sessions ?? '—', icon: '🟢', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'AI Requests Today', value: stats?.ai_requests_today ?? '—', icon: '🤖', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Modules Online', value: stats?.modules_online ?? '—', icon: '⚡', color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  const quickActions = [
    { label: 'Create User', icon: '➕', href: '/admin/users' },
    { label: 'Configure AI', icon: '🤖', href: '/admin/ai-config' },
    { label: 'View Audit Logs', icon: '📋', href: '/admin/audit-logs' },
    { label: 'Manage Roles', icon: '🔑', href: '/admin/roles' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">System overview and administration</p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((card) => (
            <Card key={card.label}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">{card.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${card.bg} flex items-center justify-center text-xl sm:text-2xl`}>
                  {card.icon}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.href)}
                className="flex items-center gap-3 p-3 rounded-[10px] border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left group min-h-[44px]"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* System Status */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="space-y-3">
            {[
              { name: 'PostgreSQL', status: 'healthy', detail: 'postgres:5432' },
              { name: 'Redis', status: 'healthy', detail: 'redis:6379' },
              { name: 'Celery Worker', status: 'healthy', detail: '3 workers active' },
              { name: 'MinIO Storage', status: 'healthy', detail: 'minio:9000' },
              { name: 'Ollama AI', status: 'healthy', detail: 'ollama:11434 · llama3.2' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${svc.status === 'healthy' ? 'bg-success' : 'bg-danger'}`} />
                  <span className="text-sm font-medium text-gray-700">{svc.name}</span>
                </div>
                <span className="text-xs text-gray-400">{svc.detail}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Admin navigation cards */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Administration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Users', desc: 'Manage system users and access', icon: '👤', href: '/admin/users', color: 'from-blue-400 to-blue-600' },
            { label: 'Roles & Permissions', desc: 'Configure role-based access', icon: '🔑', href: '/admin/roles', color: 'from-purple-400 to-purple-600' },
            { label: 'App Admins', desc: 'Module-level administrators', icon: '🛡️', href: '/admin/app-admins', color: 'from-emerald-400 to-emerald-600' },
            { label: 'AI Configuration', desc: 'LLM provider and model settings', icon: '🤖', href: '/admin/ai-config', color: 'from-pink-400 to-pink-600' },
            { label: 'Audit Logs', desc: 'System activity and changes', icon: '📋', href: '/admin/audit-logs', color: 'from-orange-400 to-orange-600' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-[10px] border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all text-left group min-h-[44px]"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl shrink-0 shadow-sm`}>
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
