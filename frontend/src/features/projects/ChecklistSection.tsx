import { useState } from 'react'
import {
  useChecklists,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
} from '@/api/projects_enhanced'

interface ChecklistSectionProps {
  projectId: string
  taskId: string
}

export default function ChecklistSection({ projectId, taskId }: ChecklistSectionProps) {
  const { data, isLoading } = useChecklists(projectId, taskId)
  const createItem = useCreateChecklistItem()
  const updateItem = useUpdateChecklistItem()
  const deleteItem = useDeleteChecklistItem()
  const [newTitle, setNewTitle] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const handleAdd = () => {
    if (!newTitle.trim()) return
    createItem.mutate(
      { project_id: projectId, task_id: taskId, title: newTitle.trim(), order: (data?.total || 0) },
      {
        onSuccess: () => {
          setNewTitle('')
          setShowAdd(false)
        },
      }
    )
  }

  const handleToggle = (itemId: string, currentState: boolean) => {
    updateItem.mutate({
      project_id: projectId,
      task_id: taskId,
      item_id: itemId,
      is_completed: !currentState,
    })
  }

  const handleDelete = (itemId: string) => {
    deleteItem.mutate({ project_id: projectId, task_id: taskId, item_id: itemId })
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-2">Loading checklist...</div>
  }

  const items = data?.items || []
  const progress = data?.progress || 0

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{data?.completed}/{data?.total}</span>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6fd943] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{progress}%</span>
        </div>
      )}

      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group py-1">
            <button
              onClick={() => handleToggle(item.id, item.is_completed)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                item.is_completed
                  ? 'bg-[#6fd943] border-[#6fd943] text-white'
                  : 'border-gray-300 hover:border-[#51459d]'
              }`}
            >
              {item.is_completed && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {item.title}
            </span>
            <button
              onClick={() => handleDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Checklist item..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={createItem.isPending}
            className="text-sm px-3 py-1.5 bg-[#51459d] text-white rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewTitle('') }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm text-[#51459d] hover:text-[#51459d]/80 font-medium"
        >
          + Add checklist item
        </button>
      )}
    </div>
  )
}
