import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useContact, useUpdateContact, type ContactType, type CreateContactPayload } from '../../api/crm'
import { Button, Spinner, Modal, Input, Badge, Card, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import ScheduleFollowupDialog from './ScheduleFollowupDialog'
import ScheduleMeetingDialog from './ScheduleMeetingDialog'
import { SyncToEcommerceDialog } from './EcommerceSyncDialog'
import { useContactPurchaseHistory, type PurchaseHistoryTransaction } from '../../api/cross_module_links'
import QuickActivityLog from './QuickActivityLog'

const STATUS_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  new: 'info',
  contacted: 'primary',
  qualified: 'success',
  unqualified: 'danger',
  converted: 'warning',
}

const STAGE_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  prospecting: 'info',
  proposal: 'primary',
  negotiation: 'warning',
  closed_won: 'success',
  closed_lost: 'danger',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: contact, isLoading } = useContact(id ?? '')
  const updateMutation = useUpdateContact()
  const { data: purchaseHistory } = useContactPurchaseHistory(id ?? '')
  const [editOpen, setEditOpen] = useState(false)
  const [followupOpen, setFollowupOpen] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [ecomSyncOpen, setEcomSyncOpen] = useState(false)
  const [infoExpanded, setInfoExpanded] = useState(true)
  const [leadsExpanded, setLeadsExpanded] = useState(true)
  const [oppsExpanded, setOppsExpanded] = useState(true)
  const [form, setForm] = useState<CreateContactPayload>({
    name: '',
    email: '',
    phone: '',
    company: '',
    contact_type: 'person',
    notes: '',
  })

  const openEdit = () => {
    if (!contact) return
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? '',
      company: contact.company ?? '',
      contact_type: contact.contact_type,
      notes: contact.notes ?? '',
    })
    setEditOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contact) return
    try {
      await updateMutation.mutateAsync({ id: contact.id, ...form })
      toast('success', 'Contact updated')
      setEditOpen(false)
    } catch {
      toast('error', 'Failed to update contact')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-20 text-gray-400">
        Contact not found
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/crm/contacts')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{contact.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{contact.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={contact.contact_type === 'company' ? 'primary' : 'info'}>
              {contact.contact_type}
            </Badge>
            <Badge variant={contact.is_active ? 'success' : 'default'}>
              {contact.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setFollowupOpen(true)} className="min-h-[44px] sm:min-h-0">
            Schedule Follow-up
          </Button>
          <Button variant="secondary" onClick={() => setMeetingOpen(true)} className="min-h-[44px] sm:min-h-0">
            Schedule Meeting
          </Button>
          <Button variant="secondary" onClick={() => setEcomSyncOpen(true)} className="min-h-[44px] sm:min-h-0">
            Sync to E-Commerce
          </Button>
          <Button onClick={openEdit} className="min-h-[44px] sm:min-h-0">Edit Contact</Button>
        </div>
      </div>

      {/* Contact Info - Collapsible on mobile */}
      <Card>
        <button
          className="w-full flex items-center justify-between md:cursor-default min-h-[44px]"
          onClick={() => setInfoExpanded(!infoExpanded)}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Contact Information</h2>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform md:hidden ${infoExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className={`${infoExpanded ? 'block' : 'hidden md:block'} mt-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Email</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{contact.email}</p>
            </div>
            <div>
              <span className="text-gray-500">Phone</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{contact.phone || '---'}</p>
            </div>
            <div>
              <span className="text-gray-500">Company</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{contact.company || '---'}</p>
            </div>
            <div>
              <span className="text-gray-500">Created</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{new Date(contact.created_at).toLocaleDateString()}</p>
            </div>
            {contact.notes && (
              <div className="md:col-span-2">
                <span className="text-gray-500">Notes</span>
                <p className="font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Related Leads - Collapsible on mobile */}
      <Card padding={false}>
        <button
          className="w-full flex items-center justify-between p-6 pb-0 md:cursor-default min-h-[44px]"
          onClick={() => setLeadsExpanded(!leadsExpanded)}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Related Leads
            {contact.leads?.length ? (
              <span className="ml-2 text-xs text-gray-400 font-normal">({contact.leads.length})</span>
            ) : null}
          </h2>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform md:hidden ${leadsExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className={`${leadsExpanded ? 'block' : 'hidden md:block'}`}>
          {contact.leads?.length ? (
            <>
              {/* Desktop table */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. Value</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contact.leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-50 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="py-3 px-6 font-medium text-gray-900 dark:text-gray-100">{lead.title}</td>
                        <td className="py-3 px-6">
                          <Badge variant={STATUS_BADGE[lead.status] ?? 'default'}>{lead.status}</Badge>
                        </td>
                        <td className="py-3 px-6 text-right text-gray-700 dark:text-gray-300">
                          {lead.estimated_value != null ? formatCurrency(lead.estimated_value) : '---'}
                        </td>
                        <td className="py-3 px-6 text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-900 px-4 pb-4 pt-3">
                {contact.leads.map((lead) => (
                  <div key={lead.id} className="py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{lead.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(lead.created_at).toLocaleDateString()}
                        {lead.estimated_value != null && ` | ${formatCurrency(lead.estimated_value)}`}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[lead.status] ?? 'default'}>{lead.status}</Badge>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">No leads for this contact</p>
          )}
        </div>
      </Card>

      {/* Related Opportunities - Collapsible on mobile */}
      <Card padding={false}>
        <button
          className="w-full flex items-center justify-between p-6 pb-0 md:cursor-default min-h-[44px]"
          onClick={() => setOppsExpanded(!oppsExpanded)}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Related Opportunities
            {contact.opportunities?.length ? (
              <span className="ml-2 text-xs text-gray-400 font-normal">({contact.opportunities.length})</span>
            ) : null}
          </h2>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform md:hidden ${oppsExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className={`${oppsExpanded ? 'block' : 'hidden md:block'}`}>
          {contact.opportunities?.length ? (
            <>
              {/* Desktop table */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                      <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                      <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Probability</th>
                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contact.opportunities.map((opp) => (
                      <tr key={opp.id} className="border-b border-gray-50 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="py-3 px-6 font-medium text-gray-900 dark:text-gray-100">{opp.title}</td>
                        <td className="py-3 px-6">
                          <Badge variant={STAGE_BADGE[opp.stage] ?? 'default'}>{opp.stage.replace('_', ' ')}</Badge>
                        </td>
                        <td className="py-3 px-6 text-right text-gray-700 dark:text-gray-300">{formatCurrency(opp.value)}</td>
                        <td className="py-3 px-6 text-right text-gray-700 dark:text-gray-300">{opp.probability}%</td>
                        <td className="py-3 px-6 text-gray-500">
                          {opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString() : '---'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-900 px-4 pb-4 pt-3">
                {contact.opportunities.map((opp) => (
                  <div key={opp.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{opp.title}</p>
                      <Badge variant={STAGE_BADGE[opp.stage] ?? 'default'}>{opp.stage.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="font-semibold text-primary">{formatCurrency(opp.value)}</span>
                      <span>{opp.probability}%</span>
                      {opp.expected_close_date && (
                        <span>Close: {new Date(opp.expected_close_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">No opportunities for this contact</p>
          )}
        </div>
      </Card>

      {/* Purchase History (POS) */}
      {purchaseHistory && purchaseHistory.total_transactions > 0 && (
        <Card padding={false}>
          <div className="p-6 pb-0 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Purchase History (POS)</h2>
            <div className="text-sm text-gray-500">
              {purchaseHistory.total_transactions} transaction{purchaseHistory.total_transactions !== 1 ? 's' : ''} &middot; Total: {formatCurrency(Number(purchaseHistory.total_spent))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Transaction #</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchaseHistory.transactions.map((txn: PurchaseHistoryTransaction) => (
                  <tr key={txn.id} className="border-b border-gray-50 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="py-3 px-6 font-mono text-xs text-primary">{txn.transaction_number}</td>
                    <td className="py-3 px-6 text-gray-500">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="py-3 px-6">
                      <Badge variant={txn.status === 'completed' ? 'success' : 'default'}>{txn.status}</Badge>
                    </td>
                    <td className="py-3 px-6 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Number(txn.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Contact" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={form.phone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Company"
              value={form.company ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </div>
          <Select
            label="Contact Type"
            options={[
              { value: 'person', label: 'Person' },
              { value: 'company', label: 'Company' },
            ]}
            value={form.contact_type}
            onChange={(e) => setForm((f) => ({ ...f, contact_type: e.target.value as ContactType }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* CRM Cross-Module Dialogs */}
      <ScheduleFollowupDialog
        open={followupOpen}
        onClose={() => setFollowupOpen(false)}
        entityType="contact"
        entityId={contact.id}
        entityName={contact.name}
      />
      <ScheduleMeetingDialog
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        entityType="contact"
        entityId={contact.id}
        entityName={contact.name}
      />
      <SyncToEcommerceDialog
        open={ecomSyncOpen}
        onClose={() => setEcomSyncOpen(false)}
        contactId={contact.id}
        contactName={contact.name}
      />

      {/* Quick Activity FAB for mobile */}
      <QuickActivityLog contactId={contact.id} contactName={contact.name} />
    </div>
  )
}
