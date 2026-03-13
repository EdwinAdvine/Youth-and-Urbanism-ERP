import { useState, useCallback } from 'react'
import { Button, Modal, Input, toast } from '../../../components/ui'
import { useExportDashboardXlsx, type ExportSection } from '../../../api/analytics_dashboards'

interface DashboardHeaderProps {
  title: string
  subtitle?: string
  exportSections?: ExportSection[]
}

export default function DashboardHeader({ title, subtitle, exportSections }: DashboardHeaderProps) {
  const [showExport, setShowExport] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const exportXlsx = useExportDashboardXlsx()

  const handleExportPDF = useCallback(() => {
    const printStyles = document.createElement('style')
    printStyles.textContent = `
      @media print {
        body * { visibility: hidden; }
        .p-6 { visibility: visible !important; position: absolute; left: 0; top: 0; width: 100%; }
        .p-6 * { visibility: visible !important; }
        button, .shrink-0 { display: none !important; }
      }
    `
    document.head.appendChild(printStyles)
    window.print()
    setTimeout(() => document.head.removeChild(printStyles), 500)
    setShowExport(false)
    toast('info', 'Print dialog opened - save as PDF')
  }, [])

  const handleExportCSV = useCallback(() => {
    if (!exportSections || exportSections.length === 0) {
      toast('info', 'No data available to export')
      setShowExport(false)
      return
    }

    const csvParts: string[] = []
    for (const section of exportSections) {
      if (!section.data || section.data.length === 0) continue
      csvParts.push(`"${section.title}"`)
      const cols = Object.keys(section.data[0])
      csvParts.push(cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      for (const row of section.data) {
        csvParts.push(
          cols.map((c) => {
            const val = row[c]
            return typeof val === 'number' ? String(val) : `"${String(val ?? '').replace(/"/g, '""')}"`
          }).join(',')
        )
      }
      csvParts.push('')
    }

    const csv = csvParts.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_export.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
    toast('success', 'CSV exported')
  }, [title, exportSections])

  const handleExportExcel = useCallback(async () => {
    if (!exportSections || exportSections.length === 0) {
      toast('info', 'No data available to export')
      setShowExport(false)
      return
    }

    try {
      const blob = await exportXlsx.mutateAsync({ title, sections: exportSections })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_export.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setShowExport(false)
      toast('success', 'Excel file exported')
    } catch {
      toast('error', 'Failed to generate Excel file')
    }
  }, [title, exportSections, exportXlsx])

  const handleShare = useCallback(async () => {
    if (!shareEmail.trim()) {
      toast('error', 'Enter at least one email address')
      return
    }
    const shareUrl = window.location.href
    const shareText = `${title}${shareMessage ? ': ' + shareMessage : ''}`
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl })
        toast('success', 'Dashboard shared')
      } catch {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
        toast('success', 'Share link copied to clipboard')
      }
    } else {
      const content = `${shareText}\n\nView dashboard: ${shareUrl}\n\nShared with: ${shareEmail}`
      await navigator.clipboard.writeText(content)
      toast('success', `Share link copied - send to ${shareEmail}`)
    }
    setShowShare(false)
    setShareEmail('')
    setShareMessage('')
  }, [shareEmail, shareMessage, title])

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast('success', 'Dashboard link copied to clipboard')
    setShowShare(false)
  }, [])

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share
          </Button>
        </div>
      </div>

      <Modal open={showExport} onClose={() => setShowExport(false)} title="Export Dashboard" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Choose an export format for this dashboard.</p>
          <button onClick={handleExportPDF} className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
            <div className="w-10 h-10 rounded-[8px] bg-red-50 flex items-center justify-center"><svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
            <div><span className="text-sm font-medium text-gray-900 dark:text-gray-100 block">PDF</span><span className="text-xs text-gray-400">Export via browser print</span></div>
          </button>
          <button onClick={handleExportCSV} className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
            <div className="w-10 h-10 rounded-[8px] bg-green-50 flex items-center justify-center"><svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
            <div><span className="text-sm font-medium text-gray-900 dark:text-gray-100 block">CSV</span><span className="text-xs text-gray-400">Comma-separated values</span></div>
          </button>
          <button onClick={handleExportExcel} disabled={exportXlsx.isPending} className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left disabled:opacity-50">
            <div className="w-10 h-10 rounded-[8px] bg-blue-50 flex items-center justify-center"><svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></div>
            <div><span className="text-sm font-medium text-gray-900 dark:text-gray-100 block">{exportXlsx.isPending ? 'Generating...' : 'Excel'}</span><span className="text-xs text-gray-400">Styled XLSX spreadsheet</span></div>
          </button>
        </div>
      </Modal>

      <Modal open={showShare} onClose={() => setShowShare(false)} title="Share Dashboard" size="sm">
        <div className="space-y-4">
          <Input label="Share with (email)" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="colleague@company.com" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message (optional)</label>
            <textarea className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 min-h-[60px]" value={shareMessage} onChange={(e) => setShareMessage(e.target.value)} placeholder="Check out this dashboard..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleCopyLink}><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>Copy Link</Button>
            <Button className="flex-1" onClick={handleShare}>Share</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
