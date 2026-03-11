import { useState } from 'react'
import { Modal, Button, Input, Select, Badge, toast } from '../../components/ui'
import { useShareNoteExt, useUnshareNote } from '../../api/notes_ext'

interface Props {
  open: boolean
  onClose: () => void
  noteId: string
  sharedWith?: { user_id: string; user_name: string; permission: string }[]
}

export default function ShareDialog({ open, onClose, noteId, sharedWith = [] }: Props) {
  const shareNote = useShareNoteExt()
  const unshareNote = useUnshareNote()

  const [userId, setUserId] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')

  const handleShare = () => {
    if (!userId.trim()) return toast('error', 'User ID or email is required')
    shareNote.mutate(
      { note_id: noteId, user_id: userId, permission },
      {
        onSuccess: () => {
          toast('success', 'Note shared')
          setUserId('')
        },
        onError: () => toast('error', 'Failed to share note'),
      }
    )
  }

  const handleUnshare = (uid: string) => {
    unshareNote.mutate(
      { noteId, userId: uid },
      {
        onSuccess: () => toast('success', 'Access removed'),
        onError: () => toast('error', 'Failed to remove access'),
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Share Note" size="md">
      <div className="space-y-5">
        {/* Add person */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Share with</label>
          <div className="flex gap-2">
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID or email"
              onKeyDown={(e) => e.key === 'Enter' && handleShare()}
            />
            <Select
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
              options={[
                { value: 'view', label: 'Can view' },
                { value: 'edit', label: 'Can edit' },
              ]}
              className="w-32"
            />
            <Button onClick={handleShare} loading={shareNote.isPending} className="shrink-0">Share</Button>
          </div>
        </div>

        {/* Current shares */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">People with access</h3>
          {sharedWith.length === 0 ? (
            <p className="text-sm text-gray-400">Not shared with anyone yet</p>
          ) : (
            <div className="space-y-2">
              {sharedWith.map((share) => (
                <div key={share.user_id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {share.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{share.user_name}</p>
                      <Badge variant={share.permission === 'edit' ? 'info' : 'default'} className="mt-0.5">
                        {share.permission === 'edit' ? 'Can edit' : 'Can view'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUnshare(share.user_id)}
                    loading={unshareNote.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
