/**
 * Contact Card Popover — shows rich contact intelligence on sender hover.
 * Displays CRM data, deal pipeline, support tickets, email stats.
 */
import { useState, useRef, useEffect } from 'react'
import { useContactProfile, useContactRelationship } from '../../api/mail'

interface ContactCardProps {
  email: string
  name?: string
  children: React.ReactNode
}

export default function ContactCard({ email, name, children }: ContactCardProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const { data: profileData } = useContactProfile(open ? email : '')
  const { data: relationship } = useContactRelationship(open ? email : '')

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setPosition({
          top: rect.bottom + 8,
          left: Math.min(rect.left, window.innerWidth - 340),
        })
      }
      setOpen(true)
    }, 400)
  }

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 300)
  }

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const profile = profileData?.profile
  const crm = profileData?.crm
  const tickets = profileData?.tickets

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block cursor-pointer"
      >
        {children}
      </div>

      {open && (
        <div
          ref={cardRef}
          onMouseEnter={() => clearTimeout(timerRef.current)}
          onMouseLeave={handleMouseLeave}
          className="fixed z-50 w-[320px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ top: position.top, left: position.left }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#51459d] to-[#413780] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold">
                {(name || email)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {profile?.display_name || name || email.split('@')[0]}
                </p>
                <p className="text-white/70 text-xs truncate">{email}</p>
                {profile?.title && (
                  <p className="text-white/60 text-[10px] truncate">
                    {profile.title}
                    {profile.company ? ` at ${profile.company}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700">
            <div className="p-2.5 text-center">
              <p className="text-lg font-bold text-[#51459d]">{profile?.email_count ?? 0}</p>
              <p className="text-[10px] text-gray-400">Emails</p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-lg font-bold text-[#3ec9d6]">{relationship?.thread_count ?? 0}</p>
              <p className="text-[10px] text-gray-400">Threads</p>
            </div>
            <div className="p-2.5 text-center">
              <p className="text-lg font-bold text-[#6fd943]">
                {profile?.avg_response_time_minutes
                  ? `${Math.round(profile.avg_response_time_minutes)}m`
                  : '--'}
              </p>
              <p className="text-[10px] text-gray-400">Avg Reply</p>
            </div>
          </div>

          {/* CRM Section */}
          {crm?.contact && (
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">CRM</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Contact: {crm.contact.name}
                </p>
                {crm.deals?.slice(0, 3).map((deal: { id: string; name: string; stage: string; value: number | null }) => (
                  <div key={deal.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-[180px]">
                      {deal.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#51459d]/10 text-[#51459d] font-medium">
                        {deal.stage}
                      </span>
                      {deal.value != null && (
                        <span className="text-gray-400 text-[10px]">
                          ${(deal.value / 1000).toFixed(0)}K
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support Tickets */}
          {tickets && tickets.length > 0 && (
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Support</p>
              <div className="space-y-1">
                {tickets.slice(0, 3).map((t: { id: string; subject: string; status: string; priority: string }) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                      {t.subject}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        t.status === 'open'
                          ? 'bg-[#ffa21d]/10 text-[#ffa21d]'
                          : t.status === 'resolved'
                            ? 'bg-[#6fd943]/10 text-[#6fd943]'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last contact */}
          {profile?.last_email_at && (
            <div className="px-4 py-2 text-[10px] text-gray-400">
              Last email: {new Date(profile.last_email_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </>
  )
}
