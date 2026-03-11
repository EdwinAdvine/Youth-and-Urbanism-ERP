import { useState } from 'react'
import { Button, Spinner, Modal, Input, toast } from '../../components/ui'
import {
  useNoteFolders,
  useCreateNoteFolder,
  useUpdateNoteFolder,
  useDeleteNoteFolder,
  type NoteFolder,
} from '../../api/notes_ext'

interface Props {
  selectedFolderId?: string | null
  onSelectFolder: (folderId: string | null) => void
  className?: string
}

export default function FolderSidebar({ selectedFolderId, onSelectFolder, className }: Props) {
  const { data: folders, isLoading } = useNoteFolders()
  const createFolder = useCreateNoteFolder()
  const updateFolder = useUpdateNoteFolder()
  const deleteFolder = useDeleteNoteFolder()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<NoteFolder | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#51459d')

  const openCreate = () => {
    setEditing(null)
    setName('')
    setColor('#51459d')
    setShowModal(true)
  }

  const openEdit = (folder: NoteFolder, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(folder)
    setName(folder.name)
    setColor(folder.color ?? '#51459d')
    setShowModal(true)
  }

  const handleSave = () => {
    if (!name.trim()) return toast('error', 'Name is required')
    if (editing) {
      updateFolder.mutate(
        { id: editing.id, name, color },
        {
          onSuccess: () => { toast('success', 'Folder updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update folder'),
        }
      )
    } else {
      createFolder.mutate(
        { name, color },
        {
          onSuccess: () => { toast('success', 'Folder created'); setShowModal(false) },
          onError: () => toast('error', 'Failed to create folder'),
        }
      )
    }
  }

  const handleDelete = (folder: NoteFolder, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete folder "${folder.name}"? Notes inside will be moved to root.`)) return
    deleteFolder.mutate(folder.id, {
      onSuccess: () => {
        toast('success', 'Folder deleted')
        if (selectedFolderId === folder.id) onSelectFolder(null)
      },
      onError: () => toast('error', 'Failed to delete folder'),
    })
  }

  return (
    <div className={`w-56 shrink-0 ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Folders</h3>
        <button onClick={openCreate} className="text-gray-400 hover:text-primary transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Spinner size="sm" /></div>
      ) : (
        <div className="space-y-0.5">
          {/* All Notes */}
          <button
            onClick={() => onSelectFolder(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedFolderId === null ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            All Notes
          </button>

          {/* Folders */}
          {(folders ?? []).map((folder) => (
            <div key={folder.id} className="group relative">
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFolderId === folder.id ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: folder.color ?? '#51459d' }}
                />
                <span className="truncate flex-1 text-left">{folder.name}</span>
                <span className="text-xs text-gray-400">{folder.note_count}</span>
              </button>
              <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={(e) => openEdit(folder, e)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => handleDelete(folder, e)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Folder' : 'New Folder'} size="sm">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} loading={createFolder.isPending || updateFolder.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
