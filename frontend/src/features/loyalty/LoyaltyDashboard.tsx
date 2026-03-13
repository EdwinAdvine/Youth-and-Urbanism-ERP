import { useState, useMemo } from 'react'
import { Button, Card, Badge, Spinner, Input, Modal, toast } from '../../components/ui'
import {
  useLoyaltyPrograms,
  useCreateLoyaltyProgram,
  useLoyaltyMembers,
  type LoyaltyProgram,
} from '@/api/loyalty'

interface ProgramFormState {
  name: string
  description: string
  points_per_unit_currency: string
}

const EMPTY_FORM: ProgramFormState = {
  name: '',
  description: '',
  points_per_unit_currency: '',
}

export default function LoyaltyDashboard() {
  const { data: programs, isLoading } = useLoyaltyPrograms()
  const { data: allMembers } = useLoyaltyMembers()
  const createProgram = useCreateLoyaltyProgram()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ProgramFormState>({ ...EMPTY_FORM })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Summary stats
  const stats = useMemo(() => {
    const totalPrograms = programs?.length ?? 0
    const totalMembers = allMembers?.length ?? 0
    const totalPoints = allMembers?.reduce((sum, m) => sum + m.lifetime_points, 0) ?? 0
    return { totalPrograms, totalMembers, totalPoints }
  }, [programs, allMembers])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setForm({ ...EMPTY_FORM })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('error', 'Program name is required')
      return
    }
    const ppu = parseFloat(form.points_per_unit_currency)
    if (!ppu || ppu <= 0) {
      toast('error', 'Points per unit currency must be greater than 0')
      return
    }

    try {
      await createProgram.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        points_per_unit_currency: ppu,
      })
      toast('success', 'Loyalty program created')
      closeModal()
    } catch {
      toast('error', 'Failed to create loyalty program')
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Loyalty Programs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage customer loyalty programs, tiers, and rewards
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} className="w-full sm:w-auto">
          + Create Program
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Programs
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#51459d' }}>
              {stats.totalPrograms}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Members
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#51459d' }}>
              {stats.totalMembers.toLocaleString()}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Points Issued
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#6fd943' }}>
              {stats.totalPoints.toLocaleString()}
            </p>
          </div>
        </Card>
      </div>

      {/* Program Cards */}
      {(!programs || programs.length === 0) ? (
        <Card>
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg font-medium">No loyalty programs yet</p>
            <p className="text-sm mt-1">Create your first program to start rewarding customers.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              expanded={expandedId === program.id}
              onToggle={() => toggleExpand(program.id)}
            />
          ))}
        </div>
      )}

      {/* Create Program Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Create Loyalty Program"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Program Name"
            placeholder="e.g. Gold Rewards"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />

          <Input
            label="Description"
            placeholder="Optional description"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
          />

          <Input
            label="Points per Unit Currency"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1.0"
            value={form.points_per_unit_currency}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, points_per_unit_currency: e.target.value }))
            }
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createProgram.isPending}
              onClick={handleSave}
            >
              Create Program
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ─── Program Card Sub-Component ──────────────────────────────────────────── */

function ProgramCard({
  program,
  expanded,
  onToggle,
}: {
  program: LoyaltyProgram
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Card>
      <div className="space-y-3">
        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {program.name}
            </h3>
            {program.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                {program.description}
              </p>
            )}
          </div>
          <Badge variant={program.is_active ? 'success' : 'warning'}>
            {program.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div
            className="rounded-lg py-2 px-1"
            style={{ backgroundColor: 'rgba(81, 69, 157, 0.08)' }}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">Pts/Currency</p>
            <p className="text-sm font-bold" style={{ color: '#51459d' }}>
              {parseFloat(program.points_per_unit_currency).toFixed(1)}
            </p>
          </div>
          <div
            className="rounded-lg py-2 px-1"
            style={{ backgroundColor: 'rgba(111, 217, 67, 0.08)' }}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">Tiers</p>
            <p className="text-sm font-bold" style={{ color: '#6fd943' }}>
              {program.tiers?.length ?? 0}
            </p>
          </div>
          <div
            className="rounded-lg py-2 px-1"
            style={{ backgroundColor: 'rgba(62, 201, 214, 0.08)' }}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">Rewards</p>
            <p className="text-sm font-bold" style={{ color: '#3ec9d6' }}>
              {program.rewards?.length ?? 0}
            </p>
          </div>
        </div>

        {/* Expand/Collapse Toggle */}
        <button
          type="button"
          className="w-full text-center text-sm font-medium transition-colors hover:underline"
          style={{ color: '#51459d' }}
          onClick={onToggle}
        >
          {expanded ? 'Hide Details' : 'View Details'}
        </button>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            {/* Tiers */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tiers
              </h4>
              {(!program.tiers || program.tiers.length === 0) ? (
                <p className="text-xs text-gray-400">No tiers configured.</p>
              ) : (
                <div className="space-y-1">
                  {program.tiers
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((tier) => (
                      <div
                        key={tier.id}
                        className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {tier.name}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>{tier.min_points.toLocaleString()} pts min</span>
                          <span>{parseFloat(tier.discount_percentage)}% off</span>
                          <span>{parseFloat(tier.points_multiplier)}x pts</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Rewards */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Rewards
              </h4>
              {(!program.rewards || program.rewards.length === 0) ? (
                <p className="text-xs text-gray-400">No rewards configured.</p>
              ) : (
                <div className="space-y-1">
                  {program.rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {reward.name}
                        </span>
                        <Badge variant={reward.is_active ? 'success' : 'warning'}>
                          {reward.reward_type}
                        </Badge>
                      </div>
                      <span className="text-sm font-bold" style={{ color: '#51459d' }}>
                        {reward.points_cost.toLocaleString()} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
