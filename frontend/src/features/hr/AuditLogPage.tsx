import { useState } from 'react'
import { Card, Button, Table, Input, Select, Badge, Pagination } from '../../components/ui'
import {
  useAuditChanges,
  useSensitiveAccessLog,
  type AuditFieldChange,
  type PaginatedResponse,
} from '../../api/hr_phase1'

const TABLE_OPTIONS = [
  { value: '', label: 'All Tables' },
  { value: 'hr_employees', label: 'Employees' },
  { value: 'hr_leave_requests', label: 'Leave Requests' },
  { value: 'hr_payslips', label: 'Payslips' },
  { value: 'hr_attendance', label: 'Attendance' },
  { value: 'hr_departments', label: 'Departments' },
  { value: 'hr_performance_reviews', label: 'Performance Reviews' },
  { value: 'hr_trainings', label: 'Trainings' },
  { value: 'hr_onboarding', label: 'Onboarding' },
]

const LIMIT = 25

export default function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<'changes' | 'sensitive'>('changes')

  // Filters for changes tab
  const [tableName, setTableName] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [changedBy, setChangedBy] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  // Filters for sensitive access tab
  const [sensStartDate, setSensStartDate] = useState('')
  const [sensEndDate, setSensEndDate] = useState('')
  const [sensPage, setSensPage] = useState(1)

  const { data: changesData, isLoading: changesLoading } = useAuditChanges({
    table_name: tableName || undefined,
    field_name: fieldName || undefined,
    changed_by: changedBy || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    page,
    limit: LIMIT,
  })

  const { data: sensitiveData, isLoading: sensitiveLoading } = useSensitiveAccessLog({
    start_date: sensStartDate || undefined,
    end_date: sensEndDate || undefined,
    page: sensPage,
    limit: LIMIT,
  })

  const changes = changesData as PaginatedResponse<AuditFieldChange> | AuditFieldChange[] | undefined
  const changesItems = Array.isArray(changes) ? changes : changes?.items ?? []
  const changesTotal = Array.isArray(changes) ? changes.length : changes?.total ?? 0
  const changesPages = Math.max(1, Math.ceil(changesTotal / LIMIT))

  const sensitive = sensitiveData as PaginatedResponse<AuditFieldChange> | AuditFieldChange[] | undefined
  const sensitiveItems = Array.isArray(sensitive) ? sensitive : sensitive?.items ?? []
  const sensitiveTotal = Array.isArray(sensitive) ? sensitive.length : sensitive?.total ?? 0
  const sensitivePages = Math.max(1, Math.ceil(sensitiveTotal / LIMIT))

  const auditColumns = [
    {
      key: 'table_name',
      label: 'Table',
      render: (r: AuditFieldChange) => (
        <Badge variant="info">{r.table_name.replace('hr_', '')}</Badge>
      ),
    },
    {
      key: 'record_id',
      label: 'Record ID',
      render: (r: AuditFieldChange) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{r.record_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'field_name',
      label: 'Field',
      render: (r: AuditFieldChange) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.field_name}</span>
      ),
    },
    {
      key: 'old_value',
      label: 'Old Value',
      render: (r: AuditFieldChange) => (
        <span className="text-sm text-red-600 dark:text-red-400 max-w-[150px] truncate block">
          {r.old_value ?? <span className="text-gray-400 italic">null</span>}
        </span>
      ),
    },
    {
      key: 'new_value',
      label: 'New Value',
      render: (r: AuditFieldChange) => (
        <span className="text-sm text-green-600 dark:text-green-400 max-w-[150px] truncate block">
          {r.new_value ?? <span className="text-gray-400 italic">null</span>}
        </span>
      ),
    },
    {
      key: 'changed_by',
      label: 'Changed By',
      render: (r: AuditFieldChange) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{r.changed_by}</span>
      ),
    },
    {
      key: 'change_reason',
      label: 'Reason',
      render: (r: AuditFieldChange) => (
        <span className="text-xs text-gray-500 max-w-[120px] truncate block">{r.change_reason ?? '-'}</span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP Address',
      render: (r: AuditFieldChange) => (
        <span className="text-xs text-gray-500 font-mono">{r.ip_address ?? '-'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (r: AuditFieldChange) => (
        <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>
      ),
    },
  ]

  function resetFilters() {
    setTableName('')
    setFieldName('')
    setChangedBy('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">HR Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">Track all field-level changes and sensitive data access</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'changes'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('changes')}
        >
          All Changes
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'sensitive'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('sensitive')}
        >
          Sensitive Access
        </button>
      </div>

      {activeTab === 'changes' && (
        <>
          {/* Filters */}
          <Card>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-44">
                <Select
                  label="Table"
                  options={TABLE_OPTIONS}
                  value={tableName}
                  onChange={(e) => { setTableName(e.target.value); setPage(1) }}
                />
              </div>
              <div className="w-36">
                <Input
                  label="Field"
                  placeholder="e.g., salary"
                  value={fieldName}
                  onChange={(e) => { setFieldName(e.target.value); setPage(1) }}
                />
              </div>
              <div className="w-36">
                <Input
                  label="Changed By"
                  placeholder="User ID"
                  value={changedBy}
                  onChange={(e) => { setChangedBy(e.target.value); setPage(1) }}
                />
              </div>
              <div className="w-36">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                />
              </div>
              <div className="w-36">
                <Input
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                />
              </div>
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear
              </Button>
            </div>
          </Card>

          {/* Table */}
          <Card padding={false}>
            <Table
              columns={auditColumns}
              data={changesItems}
              loading={changesLoading}
              keyExtractor={(r) => r.id}
              emptyText="No audit records found."
            />
            <Pagination
              page={page}
              pages={changesPages}
              total={changesTotal}
              onChange={setPage}
            />
          </Card>
        </>
      )}

      {activeTab === 'sensitive' && (
        <>
          {/* Filters */}
          <Card>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-36">
                <Input
                  label="Start Date"
                  type="date"
                  value={sensStartDate}
                  onChange={(e) => { setSensStartDate(e.target.value); setSensPage(1) }}
                />
              </div>
              <div className="w-36">
                <Input
                  label="End Date"
                  type="date"
                  value={sensEndDate}
                  onChange={(e) => { setSensEndDate(e.target.value); setSensPage(1) }}
                />
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setSensStartDate(''); setSensEndDate(''); setSensPage(1) }}>
                Clear
              </Button>
            </div>
          </Card>

          {/* Table */}
          <Card padding={false}>
            <Table
              columns={auditColumns}
              data={sensitiveItems}
              loading={sensitiveLoading}
              keyExtractor={(r) => r.id}
              emptyText="No sensitive access records found."
            />
            <Pagination
              page={sensPage}
              pages={sensitivePages}
              total={sensitiveTotal}
              onChange={setSensPage}
            />
          </Card>
        </>
      )}
    </div>
  )
}
