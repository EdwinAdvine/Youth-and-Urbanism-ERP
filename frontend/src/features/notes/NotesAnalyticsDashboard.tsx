import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface OverviewData {
  total_notes: number
  total_notebooks: number
  total_words: number
  ai_requests_this_month: number
  notes_created_this_week: number
  avg_words_per_note: number
}

interface CollaborationData {
  total_comments: number
  total_versions: number
  active_collaborators: number
  most_edited_notes: { id: string; title: string; edit_count: number }[]
}

function StatCard({
  icon, value, label,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        padding: '20px 24px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: 'rgba(81,69,157,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#51459d',
            lineHeight: 1.1,
          }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// Inline SVG icons
const Icons = {
  notes: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#51459d" strokeWidth="2" />
      <polyline points="14 2 14 8 20 8" stroke="#51459d" strokeWidth="2" />
      <line x1="8" y1="13" x2="16" y2="13" stroke="#51459d" strokeWidth="2" />
      <line x1="8" y1="17" x2="16" y2="17" stroke="#51459d" strokeWidth="2" />
    </svg>
  ),
  notebooks: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#3ec9d6" strokeWidth="2" />
      <line x1="9" y1="3" x2="9" y2="21" stroke="#3ec9d6" strokeWidth="2" />
      <line x1="13" y1="7" x2="17" y2="7" stroke="#3ec9d6" strokeWidth="2" />
      <line x1="13" y1="11" x2="17" y2="11" stroke="#3ec9d6" strokeWidth="2" />
    </svg>
  ),
  words: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h10M4 17h7" stroke="#6fd943" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  ai: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="#ffa21d" opacity="0.4" />
      <circle cx="12" cy="12" r="2" fill="#ffa21d" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="#ffa21d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  week: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="#ff3a6e" strokeWidth="2" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="#ff3a6e" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="#ff3a6e" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="#ff3a6e" strokeWidth="2" />
    </svg>
  ),
  avg: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  comments: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#3ec9d6" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  versions: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polyline points="12 5 12 12 16 14" stroke="#6fd943" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="#6fd943" strokeWidth="2" />
    </svg>
  ),
  collaborators: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="#ffa21d" strokeWidth="2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#ffa21d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2" stroke="#ffa21d" strokeWidth="2" />
      <path d="M20 20c0-2.2-1.3-4-3-5" stroke="#ffa21d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <polyline points="23 4 23 10 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20.5 15a9 9 0 1 1-2.8-9.6L23 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

export default function NotesAnalyticsDashboard() {
  const overviewQuery = useQuery<OverviewData>({
    queryKey: ['notes', 'analytics', 'overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<OverviewData>('/notes/analytics/overview')
      return data
    },
  })

  const collabQuery = useQuery<CollaborationData>({
    queryKey: ['notes', 'analytics', 'collaboration'],
    queryFn: async () => {
      const { data } = await apiClient.get<CollaborationData>('/notes/analytics/collaboration')
      return data
    },
  })

  const handleRefresh = () => {
    overviewQuery.refetch()
    collabQuery.refetch()
  }

  const isLoading = overviewQuery.isLoading || collabQuery.isLoading

  return (
    <div style={{ padding: 24, fontFamily: 'Open Sans, sans-serif', minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Notes Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Overview of your notes activity</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: '#51459d',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            fontFamily: 'Open Sans, sans-serif',
          }}
        >
          {Icons.refresh}
          Refresh
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #51459d',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}

      {/* Overview stats grid */}
      {!isLoading && overviewQuery.data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard icon={Icons.notes} value={overviewQuery.data.total_notes} label="Total Notes" />
          <StatCard icon={Icons.notebooks} value={overviewQuery.data.total_notebooks} label="Notebooks" />
          <StatCard icon={Icons.words} value={overviewQuery.data.total_words} label="Total Words" />
          <StatCard icon={Icons.ai} value={overviewQuery.data.ai_requests_this_month} label="AI Requests This Month" />
          <StatCard icon={Icons.week} value={overviewQuery.data.notes_created_this_week} label="Notes This Week" />
          <StatCard
            icon={Icons.avg}
            value={Math.round(overviewQuery.data.avg_words_per_note)}
            label="Avg Words per Note"
          />
        </div>
      )}

      {/* Collaboration stats */}
      {!isLoading && collabQuery.data && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <StatCard icon={Icons.comments} value={collabQuery.data.total_comments} label="Total Comments" />
            <StatCard icon={Icons.versions} value={collabQuery.data.total_versions} label="Total Versions" />
            <StatCard icon={Icons.collaborators} value={collabQuery.data.active_collaborators} label="Active Collaborators" />
          </div>

          {/* Most edited notes */}
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: 700,
                fontSize: 15,
                color: '#111827',
              }}
            >
              Most Edited Notes
            </div>

            {collabQuery.data.most_edited_notes.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No notes yet.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={thStyle}>Note Title</th>
                    <th style={{ ...thStyle, width: 120, textAlign: 'right' }}>Edit Count</th>
                    <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {collabQuery.data.most_edited_notes.map((note, idx) => (
                    <tr
                      key={note.id}
                      style={{
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <td style={tdStyle}>{note.title}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#51459d' }}>
                        {note.edit_count.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <a
                          href={`/notes/${note.id}`}
                          style={{ color: '#3ec9d6', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
                        >
                          Open →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Error states */}
      {(overviewQuery.isError || collabQuery.isError) && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fff0f3',
            border: '1px solid #ff3a6e',
            borderRadius: 8,
            color: '#ff3a6e',
            fontSize: 13,
            marginTop: 16,
          }}
        >
          Failed to load some analytics data. Please refresh.
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 20px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 20px',
  color: '#374151',
  fontSize: 14,
}
