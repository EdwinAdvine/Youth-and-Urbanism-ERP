import { useState } from 'react'
import { toast } from '../../components/ui'
import { useCreateTask, type TaskPriority } from '../../api/projects'

interface QuickTaskFABProps {
  projectId: string
}

export default function QuickTaskFAB({ projectId }: QuickTaskFABProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const createTask = useCreateTask()

  const handleCreate = async () => {
    if (!title.trim()) {
      toast('warning', 'Title is required')
      return
    }
    try {
      await createTask.mutateAsync({
        project_id: projectId,
        title: title.trim(),
        status: 'todo',
        priority: 'medium' as TaskPriority,
        assignee_id: assigneeId || null,
      })
      toast('success', 'Task created')
      setTitle('')
      setAssigneeId('')
      setOpen(false)
    } catch {
      toast('error', 'Failed to create task')
    }
  }

  return (
    <>
      {/* FAB button - mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[#51459d] text-white shadow-lg hover:bg-[#3d3480] active:scale-95 transition-all flex items-center justify-center"
        aria-label="Quick add task"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Quick task creation sheet */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Bottom sheet */}
          <div className="relative bg-white rounded-t-[16px] shadow-2xl p-5 pb-8 animate-slide-up">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Add Task</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full px-3 py-3 text-sm border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] min-h-[44px]"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assignee ID (optional)</label>
                <input
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  placeholder="User ID"
                  className="w-full px-3 py-3 text-sm border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] min-h-[44px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-3 text-sm text-gray-600 bg-gray-100 rounded-[10px] hover:bg-gray-200 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!title.trim() || createTask.isPending}
                  className="flex-1 px-4 py-3 text-sm text-white bg-[#51459d] rounded-[10px] hover:bg-[#3d3480] transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
                >
                  {createTask.isPending ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Create Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </>
  )
}
