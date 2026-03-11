import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Spinner, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import { useProject } from '../../api/projects'
import {
  useLinkDriveFolder,
  useProjectFiles,
  useCreateProjectDocument,
  useProjectDocuments,
  useLinkDeal,
  useLinkedDeals,
  useUnlinkDeal,
  useProjectCosts,
  useLinkExpense,
  useUnlinkExpense,
  type ProjectCostSummary,
} from '../../api/projects_ext'

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabKey = 'files' | 'documents' | 'deals' | 'costs'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: 'files',
    label: 'Files',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    key: 'documents',
    label: 'Documents',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: 'deals',
    label: 'Linked Deals',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'costs',
    label: 'Budget / Costs',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function ProjectIntegrations() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = id ?? ''
  const [activeTab, setActiveTab] = useState<TabKey>('files')

  const { data: project, isLoading } = useProject(projectId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Project not found</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/projects/${projectId}`)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {project.color && (
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
          <p className="text-sm text-gray-500">Cross-module integrations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'files' && <FilesTab projectId={projectId} />}
      {activeTab === 'documents' && <DocumentsTab projectId={projectId} />}
      {activeTab === 'deals' && <DealsTab projectId={projectId} />}
      {activeTab === 'costs' && <CostsTab projectId={projectId} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function FilesTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectFiles(projectId)
  const linkDrive = useLinkDriveFolder()

  async function handleLinkDrive() {
    try {
      const result = await linkDrive.mutateAsync(projectId)
      if (result.created) {
        toast('success', 'Drive folder created and linked')
      } else {
        toast('info', 'Drive folder already linked')
      }
    } catch {
      toast('error', 'Failed to link Drive folder')
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  const hasFolder = data?.folder_id !== null && data?.folder_id !== undefined
  const files = data?.files ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Project Files</h2>
        <div className="flex gap-2">
          {!hasFolder && (
            <Button size="sm" onClick={handleLinkDrive} loading={linkDrive.isPending}>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Link Drive Folder
            </Button>
          )}
          {hasFolder && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/drive?folder=${data?.folder_id}`, '_blank')}>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Drive
            </Button>
          )}
        </div>
      </div>

      {!hasFolder ? (
        <Card>
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-gray-500 text-sm">No Drive folder linked yet.</p>
            <p className="text-gray-400 text-xs mt-1">Click "Link Drive Folder" to create a dedicated folder for this project's files.</p>
          </div>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No files in the project folder yet.</p>
            <p className="text-gray-400 text-xs mt-1">Upload files to the project folder in Drive.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file) => (
            <Card key={file.id} className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                <FileIcon contentType={file.content_type} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentsTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectDocuments(projectId)
  const createDoc = useCreateProjectDocument()
  const [showCreate, setShowCreate] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docType, setDocType] = useState('document')

  async function handleCreate() {
    if (!docTitle.trim()) {
      toast('warning', 'Title is required')
      return
    }
    try {
      await createDoc.mutateAsync({ projectId, title: docTitle.trim(), doc_type: docType })
      toast('success', 'Document created')
      setShowCreate(false)
      setDocTitle('')
      setDocType('document')
    } catch {
      toast('error', 'Failed to create document')
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  const docs = data?.documents ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Project Documents</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Document
        </Button>
      </div>

      {docs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-sm">No documents yet.</p>
            <p className="text-gray-400 text-xs mt-1">Create documents from the project context.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <Card key={doc.id} className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-[10px] bg-blue-50 flex items-center justify-center shrink-0">
                <DocTypeIcon docType={doc.doc_type} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{doc.title}</p>
                <p className="text-xs text-gray-400 capitalize">{doc.doc_type} &middot; {new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.open(`/docs?file=${doc.file_id}`, '_blank')}>
                Open
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Create Document Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Project Document">
        <div className="space-y-4">
          <Input label="Title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title" autoFocus />
          <Select
            label="Type"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            options={[
              { value: 'document', label: 'Document (Word)' },
              { value: 'spreadsheet', label: 'Spreadsheet (Excel)' },
              { value: 'presentation', label: 'Presentation (PowerPoint)' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createDoc.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEALS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DealsTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useLinkedDeals(projectId)
  const linkDeal = useLinkDeal()
  const unlinkDeal = useUnlinkDeal()
  const [showLink, setShowLink] = useState(false)
  const [dealId, setDealId] = useState('')
  const [linkNotes, setLinkNotes] = useState('')

  async function handleLink() {
    if (!dealId.trim()) {
      toast('warning', 'Deal ID is required')
      return
    }
    try {
      await linkDeal.mutateAsync({ projectId, deal_id: dealId.trim(), notes: linkNotes || undefined })
      toast('success', 'Deal linked')
      setShowLink(false)
      setDealId('')
      setLinkNotes('')
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to link deal'
      toast('error', msg)
    }
  }

  async function handleUnlink(dealIdToUnlink: string) {
    try {
      await unlinkDeal.mutateAsync({ projectId, dealId: dealIdToUnlink })
      toast('success', 'Deal unlinked')
    } catch {
      toast('error', 'Failed to unlink deal')
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  const deals = data?.deals ?? []
  const totalValue = data?.total_deal_value ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Linked Deals</h2>
          {deals.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {deals.length} deal{deals.length !== 1 ? 's' : ''} &middot; Total value: ${totalValue.toLocaleString()}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowLink(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Link Deal
        </Button>
      </div>

      {deals.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 text-sm">No deals linked yet.</p>
            <p className="text-gray-400 text-xs mt-1">Link CRM deals to track revenue associated with this project.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => (
            <Card key={deal.id} className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-[10px] bg-green-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{deal.deal_title || 'Untitled Deal'}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-sm text-gray-600 dark:text-gray-400">${(deal.deal_value ?? 0).toLocaleString()}</span>
                  <Badge variant={deal.deal_status === 'active' ? 'success' : 'default'} className="text-xs">
                    {deal.deal_status}
                  </Badge>
                </div>
                {deal.notes && <p className="text-xs text-gray-400 mt-1">{deal.notes}</p>}
              </div>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleUnlink(deal.deal_id)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Link Deal Modal */}
      <Modal open={showLink} onClose={() => setShowLink(false)} title="Link CRM Deal">
        <div className="space-y-4">
          <Input label="Deal ID" value={dealId} onChange={(e) => setDealId(e.target.value)} placeholder="Paste the Deal UUID" autoFocus />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
            <textarea
              value={linkNotes}
              onChange={(e) => setLinkNotes(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Why is this deal linked?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowLink(false)}>Cancel</Button>
            <Button size="sm" onClick={handleLink} loading={linkDeal.isPending}>Link Deal</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COSTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function CostsTab({ projectId }: { projectId: string }) {
  const [hourlyRate, setHourlyRate] = useState(50)
  const { data, isLoading } = useProjectCosts(projectId, hourlyRate)
  const linkExpense = useLinkExpense()
  const unlinkExpense = useUnlinkExpense()
  const [showLinkExpense, setShowLinkExpense] = useState(false)
  const [expenseId, setExpenseId] = useState('')

  async function handleLinkExpense() {
    if (!expenseId.trim()) {
      toast('warning', 'Expense ID is required')
      return
    }
    try {
      await linkExpense.mutateAsync({ projectId, expense_id: expenseId.trim() })
      toast('success', 'Expense linked')
      setShowLinkExpense(false)
      setExpenseId('')
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to link expense'
      toast('error', msg)
    }
  }

  async function handleUnlinkExpense(eid: string) {
    try {
      await unlinkExpense.mutateAsync({ projectId, expenseId: eid })
      toast('success', 'Expense unlinked')
    } catch {
      toast('error', 'Failed to unlink expense')
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>

  const costs = data as ProjectCostSummary | undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Budget / Costs</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Hourly Rate:</label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
              className="w-20 rounded-[10px] border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-center"
              min={0}
            />
          </div>
          <Button size="sm" onClick={() => setShowLinkExpense(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Link Expense
          </Button>
        </div>
      </div>

      {!costs ? (
        <Card><div className="text-center py-12 text-gray-400">No cost data available</div></Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CostCard label="Labor Cost" value={`$${costs.labor_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`${costs.total_hours.toFixed(1)} hrs @ $${costs.hourly_rate}/hr`} color="text-primary" />
            <CostCard label="Expenses" value={`$${costs.total_expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`${costs.expenses.length} linked expense(s)`} color="text-orange-600" />
            <CostCard label="Grand Total" value={`$${costs.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="Labor + Expenses" color="text-green-600" />
            <CostCard label="Hours Logged" value={costs.total_hours.toFixed(1)} sub={`by ${costs.time_by_user.length} team member(s)`} color="text-cyan-600" />
          </div>

          {/* Time by User */}
          {costs.time_by_user.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Labor Breakdown</h3>
              <div className="space-y-2">
                {costs.time_by_user.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-900 last:border-0">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{u.user_id.slice(0, 8)}...</span>
                    <div className="text-sm text-right">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{u.hours.toFixed(1)} hrs</span>
                      <span className="text-gray-400 ml-2">(${u.cost.toFixed(2)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Linked Expenses */}
          {costs.expenses.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Linked Expenses</h3>
              <div className="space-y-2">
                {costs.expenses.map((exp) => (
                  <div key={exp.expense_id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-900 last:border-0">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{exp.description}</p>
                      <p className="text-xs text-gray-400">
                        {exp.category} &middot; {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString() : ''}
                        {exp.status && (
                          <Badge variant={exp.status === 'approved' ? 'success' : 'default'} className="ml-2 text-xs">{exp.status}</Badge>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <button
                        onClick={() => handleUnlinkExpense(exp.expense_id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Unlink expense"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Link Expense Modal */}
      <Modal open={showLinkExpense} onClose={() => setShowLinkExpense(false)} title="Link Expense">
        <div className="space-y-4">
          <Input label="Expense ID" value={expenseId} onChange={(e) => setExpenseId(e.target.value)} placeholder="Paste the Expense UUID" autoFocus />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowLinkExpense(false)}>Cancel</Button>
            <Button size="sm" onClick={handleLinkExpense} loading={linkExpense.isPending}>Link</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CostCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </Card>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function FileIcon({ contentType }: { contentType: string }) {
  const color = contentType.includes('image') ? 'text-pink-500'
    : contentType.includes('pdf') ? 'text-red-500'
    : contentType.includes('spreadsheet') || contentType.includes('excel') ? 'text-green-600'
    : 'text-primary'

  return (
    <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function DocTypeIcon({ docType }: { docType: string }) {
  if (docType === 'spreadsheet') {
    return (
      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }
  if (docType === 'presentation') {
    return (
      <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
