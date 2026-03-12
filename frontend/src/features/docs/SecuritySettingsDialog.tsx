import { useState, useEffect } from 'react'
import { useDocSecurity, useUpdateDocSecurity, useDocAuditLog } from '../../api/docs'

interface SecuritySettingsDialogProps {
  open: boolean
  fileId: string | null
  onClose: () => void
}

const CLASSIFICATIONS = [
  { value: 'public', label: 'Public', color: 'text-green-600 bg-green-50', desc: 'Anyone can access' },
  { value: 'internal', label: 'Internal', color: 'text-blue-600 bg-blue-50', desc: 'Organization members only' },
  { value: 'confidential', label: 'Confidential', color: 'text-amber-600 bg-amber-50', desc: 'Restricted sharing' },
  { value: 'restricted', label: 'Restricted', color: 'text-red-600 bg-red-50', desc: 'Strictly need-to-know' },
]

export default function SecuritySettingsDialog({ open, fileId, onClose }: SecuritySettingsDialogProps) {
  const { data: security } = useDocSecurity(fileId || '')
  const { data: auditData } = useDocAuditLog(fileId || '')
  const updateSecurity = useUpdateDocSecurity()
  const [tab, setTab] = useState<'settings' | 'audit'>('settings')

  const [classification, setClassification] = useState('internal')
  const [preventDownload, setPreventDownload] = useState(false)
  const [preventPrint, setPreventPrint] = useState(false)
  const [preventCopy, setPreventCopy] = useState(false)
  const [watermarkEnabled, setWatermarkEnabled] = useState(false)
  const [watermarkText, setWatermarkText] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    if (security) {
      setClassification(security.classification || 'internal')
      setPreventDownload(security.prevent_download)
      setPreventPrint(security.prevent_print)
      setPreventCopy(security.prevent_copy)
      setWatermarkEnabled(security.watermark_enabled)
      setWatermarkText(security.watermark_text || '')
      setExpiresAt(security.expires_at ? security.expires_at.slice(0, 16) : '')
    }
  }, [security])

  if (!open || !fileId) return null

  const handleSave = async () => {
    await updateSecurity.mutateAsync({
      fileId,
      classification,
      prevent_download: preventDownload,
      prevent_print: preventPrint,
      prevent_copy: preventCopy,
      watermark_enabled: watermarkEnabled,
      watermark_text: watermarkText || null,
      expires_at: expiresAt || null,
    })
    onClose()
  }

  const auditLogs = (auditData?.logs || []) as { action: string; created_at: string; ip_address?: string; details?: Record<string, unknown> }[]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-red-50 flex items-center justify-center">
              <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Security & Compliance</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={() => setTab('settings')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${tab === 'settings' ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-500'}`}
          >
            Security Settings
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${tab === 'audit' ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-500'}`}
          >
            Audit Log
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'settings' ? (
            <div className="space-y-5">
              {/* Classification */}
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  {CLASSIFICATIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setClassification(c.value)}
                      className={`p-2 rounded-[8px] border text-left transition-all ${
                        classification === c.value
                          ? 'border-[#51459d] ring-1 ring-[#51459d]/30'
                          : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.color}`}>{c.label}</span>
                      <p className="text-[10px] text-gray-400 mt-1">{c.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Access Controls */}
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">Access Controls</label>
                <div className="space-y-2">
                  {[
                    { label: 'Prevent Download', value: preventDownload, set: setPreventDownload },
                    { label: 'Prevent Print', value: preventPrint, set: setPreventPrint },
                    { label: 'Prevent Copy', value: preventCopy, set: setPreventCopy },
                  ].map((item) => (
                    <label key={item.label} className="flex items-center gap-2 p-2 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.value}
                        onChange={(e) => item.set(e.target.checked)}
                        className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Watermark */}
              <div>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={watermarkEnabled}
                    onChange={(e) => setWatermarkEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
                  />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Watermark</span>
                </label>
                {watermarkEnabled && (
                  <input
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Watermark text (e.g. CONFIDENTIAL)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                  />
                )}
              </div>

              {/* Expiry */}
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">Document Expiry</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                />
                <p className="text-[10px] text-gray-400 mt-1">Leave empty for no expiry</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No audit entries yet</p>
              ) : (
                auditLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-[6px] bg-gray-50 dark:bg-gray-950">
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <span className="text-[8px] font-bold text-gray-500">
                        {log.action?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300 capitalize">{log.action}</p>
                      <p className="text-[10px] text-gray-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                        {log.ip_address ? ` from ${log.ip_address}` : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'settings' && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateSecurity.isPending}
              className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
            >
              {updateSecurity.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
