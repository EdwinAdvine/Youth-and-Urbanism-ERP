import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Badge, Spinner, Modal, Input, Select, toast } from '../../components/ui'
import {
  useLoyaltyPrograms,
  useLoyaltyRewards,
  useCreateReward,
  type LoyaltyReward,
} from '../../api/loyalty'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

// ─── Toggle Hook ─────────────────────────────────────────────────────────────

function useToggleReward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ rewardId, is_active }: { rewardId: string; is_active: boolean }) => {
      const { data } = await apiClient.patch(`/loyalty/rewards/${rewardId}`, { is_active })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] }),
  })
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REWARD_TYPES = [
  { value: 'discount', label: 'Discount' },
  { value: 'free_item', label: 'Free Item' },
  { value: 'store_credit', label: 'Store Credit' },
  { value: 'gift_card', label: 'Gift Card' },
  { value: 'custom', label: 'Custom' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const { programId: routeProgramId } = useParams<{ programId: string }>()
  const { data: programs, isLoading: programsLoading } = useLoyaltyPrograms()
  const [selectedProgramId, setSelectedProgramId] = useState(routeProgramId ?? '')
  const { data: rewards, isLoading: rewardsLoading } = useLoyaltyRewards(selectedProgramId)
  const createReward = useCreateReward()
  const toggleReward = useToggleReward()

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pointsCost, setPointsCost] = useState('')
  const [rewardType, setRewardType] = useState('discount')

  // Auto-select first program if no route param
  if (!selectedProgramId && programs && programs.length > 0) {
    setSelectedProgramId(programs[0].id)
  }

  function resetForm() {
    setName('')
    setDescription('')
    setPointsCost('')
    setRewardType('discount')
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast('warning', 'Reward name is required')
      return
    }
    const cost = parseInt(pointsCost)
    if (!cost || cost <= 0) {
      toast('warning', 'Points cost must be greater than 0')
      return
    }
    try {
      await createReward.mutateAsync({
        programId: selectedProgramId,
        name: name.trim(),
        description: description.trim() || undefined,
        points_cost: cost,
        reward_type: rewardType,
      })
      toast('success', 'Reward created')
      setModalOpen(false)
      resetForm()
    } catch {
      toast('error', 'Failed to create reward')
    }
  }

  async function handleToggle(reward: LoyaltyReward) {
    try {
      await toggleReward.mutateAsync({ rewardId: reward.id, is_active: !reward.is_active })
      toast('success', `Reward ${reward.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Failed to toggle reward')
    }
  }

  const programOptions = (programs ?? []).map((p) => ({ value: p.id, label: p.name }))

  if (programsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loyalty Rewards</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage the rewards catalog for your loyalty programs.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true) }} disabled={!selectedProgramId}>
          New Reward
        </Button>
      </div>

      {/* Program Selector */}
      {programs && programs.length > 0 ? (
        <Card>
          <Select
            label="Program"
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            options={programOptions}
          />
        </Card>
      ) : (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No loyalty programs found. Create a program first.</p>
          </div>
        </Card>
      )}

      {/* Rewards Grid */}
      {selectedProgramId && (
        <>
          {rewardsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : rewards && rewards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => (
                <RewardCard key={reward.id} reward={reward} onToggle={() => handleToggle(reward)} />
              ))}
            </div>
          ) : (
            <Card>
              <div className="text-center py-12">
                <p className="text-gray-400">No rewards in this program yet.</p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title="New Reward"
      >
        <div className="space-y-4">
          <Input
            label="Reward Name"
            placeholder="e.g. Free Coffee, 10% Off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Description (optional)"
            placeholder="Brief description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Points Cost"
            type="number"
            placeholder="500"
            value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value)}
          />
          <Select
            label="Reward Type"
            value={rewardType}
            onChange={(e) => setRewardType(e.target.value)}
            options={REWARD_TYPES}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createReward.isPending}>
              Create Reward
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Reward Card Sub-Component ───────────────────────────────────────────────

function RewardCard({ reward, onToggle }: { reward: LoyaltyReward; onToggle: () => void }) {
  const typeColors: Record<string, string> = {
    discount: 'bg-[#51459d]/10 text-[#51459d]',
    free_item: 'bg-[#6fd943]/10 text-[#6fd943]',
    store_credit: 'bg-[#3ec9d6]/10 text-[#3ec9d6]',
    gift_card: 'bg-[#ffa21d]/10 text-[#ffa21d]',
    custom: 'bg-gray-100 text-gray-600',
  }

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[reward.reward_type] ?? typeColors.custom}`}>
            {reward.reward_type.replace('_', ' ')}
          </span>
          <Badge variant={reward.is_active ? 'success' : 'default'}>
            {reward.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-2">{reward.name}</h3>
        {reward.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{reward.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-xl font-bold text-[#51459d]">{reward.points_cost.toLocaleString()}</p>
          <p className="text-xs text-gray-400">points</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          {reward.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </Card>
  )
}
