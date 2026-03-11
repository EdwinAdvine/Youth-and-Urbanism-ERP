import { Card, Button, Table, Badge, toast } from '../../components/ui'
import { useTrash, useRestoreFile, useEmptyTrash, type TrashItem } from '../../api/drive_ext'
import { formatFileSize } from '../../api/drive'

export default function TrashPage() {
  const { data, isLoading } = useTrash()
  const restoreFile = useRestoreFile()
  const emptyTrash = useEmptyTrash()

  const items = data?.items ?? []

  const handleRestore = (item: TrashItem) => {
    restoreFile.mutate(item.id, {
      onSuccess: () => toast('success', `"${item.name}" restored`),
      onError: () => toast('error', 'Failed to restore item'),
    })
  }

  const handleEmptyTrash = () => {
    if (!confirm('Permanently delete all items in trash? This cannot be undone.')) return
    emptyTrash.mutate(undefined, {
      onSuccess: () => toast('success', 'Trash emptied'),
      onError: () => toast('error', 'Failed to empty trash'),
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (item: TrashItem) => (
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {item.type === 'folder' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            )}
          </svg>
          <span className="text-sm font-medium text-gray-700">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (item: TrashItem) => <Badge variant="default">{item.type === 'folder' ? 'Folder' : item.content_type.split('/')[1] ?? 'File'}</Badge>,
    },
    {
      key: 'size',
      label: 'Size',
      render: (item: TrashItem) => <span className="text-sm text-gray-500">{item.type === 'file' ? formatFileSize(item.size) : '--'}</span>,
    },
    {
      key: 'original_path',
      label: 'Original Location',
      render: (item: TrashItem) => <span className="text-sm text-gray-400">{item.original_path || item.folder_path || '/'}</span>,
    },
    {
      key: 'deleted_at',
      label: 'Deleted',
      render: (item: TrashItem) => <span className="text-sm text-gray-400">{new Date(item.deleted_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (item: TrashItem) => (
        <Button size="sm" variant="outline" onClick={() => handleRestore(item)} loading={restoreFile.isPending}>
          Restore
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trash</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''} in trash
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="danger" onClick={handleEmptyTrash} loading={emptyTrash.isPending}>
            Empty Trash
          </Button>
        )}
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={items}
          loading={isLoading}
          emptyText="Trash is empty"
          keyExtractor={(item) => item.id}
        />
      </Card>
    </div>
  )
}
