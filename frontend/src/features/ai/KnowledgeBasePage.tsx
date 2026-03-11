import { useRef } from 'react'
import { Button, Badge, Card, Table, toast } from '../../components/ui'
import {
  useKnowledgeBases,
  useCreateKnowledgeBase,
  useDeleteKnowledgeBase,
  useUploadToKB,
  type AIKnowledgeBase,
} from '../../api/ai_ext'
import { useState } from 'react'
import { Modal, Input } from '../../components/ui'

const STATUS_BADGE: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  active: 'success',
  indexing: 'warning',
  error: 'danger',
}

export default function KnowledgeBasePage() {
  const { data: kbs, isLoading } = useKnowledgeBases()
  const createKB = useCreateKnowledgeBase()
  const deleteKB = useDeleteKnowledgeBase()
  const uploadToKB = useUploadToKB()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)

  const handleCreate = () => {
    if (!name.trim()) return toast('error', 'Name is required')
    createKB.mutate(
      { name, description: description || undefined },
      {
        onSuccess: () => {
          toast('success', 'Knowledge base created')
          setShowCreate(false)
          setName('')
          setDescription('')
        },
        onError: () => toast('error', 'Failed to create knowledge base'),
      }
    )
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this knowledge base? All documents will be removed.')) return
    deleteKB.mutate(id, {
      onSuccess: () => toast('success', 'Knowledge base deleted'),
      onError: () => toast('error', 'Failed to delete knowledge base'),
    })
  }

  const handleUploadClick = (kbId: string) => {
    setUploadTarget(kbId)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !uploadTarget) return
    for (let i = 0; i < files.length; i++) {
      uploadToKB.mutate(
        { kbId: uploadTarget, file: files[i] },
        {
          onSuccess: () => toast('success', `Uploaded ${files[i].name}`),
          onError: () => toast('error', `Failed to upload ${files[i].name}`),
        }
      )
    }
    e.target.value = ''
  }

  const totalDocs = (kbs ?? []).reduce((s, kb) => s + kb.document_count, 0)
  const totalChunks = (kbs ?? []).reduce((s, kb) => s + kb.total_chunks, 0)

  const columns = [
    {
      key: 'name',
      label: 'Knowledge Base',
      render: (row: AIKnowledgeBase) => (
        <div>
          <span className="font-medium text-gray-900 text-sm">{row.name}</span>
          {row.description && <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'document_count',
      label: 'Documents',
      render: (row: AIKnowledgeBase) => <span className="text-gray-600">{row.document_count}</span>,
    },
    {
      key: 'total_chunks',
      label: 'Chunks',
      render: (row: AIKnowledgeBase) => <span className="text-gray-600">{row.total_chunks}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: AIKnowledgeBase) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      render: (row: AIKnowledgeBase) => (
        <span className="text-gray-400 text-xs">{new Date(row.updated_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: AIKnowledgeBase) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => handleUploadClick(row.id)} loading={uploadToKB.isPending}>
            Upload
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(row.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-1">Manage document collections for AI-powered retrieval</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.md,.txt,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button onClick={() => setShowCreate(true)}>New Knowledge Base</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Knowledge Bases</p>
          <p className="text-2xl font-bold text-gray-900">{(kbs ?? []).length}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Documents</p>
          <p className="text-2xl font-bold text-primary">{totalDocs}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Chunks</p>
          <p className="text-2xl font-bold text-cyan-600">{totalChunks}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {(kbs ?? []).filter((kb) => kb.status === 'active').length}
          </p>
        </Card>
      </div>

      <Card padding={false}>
        <Table<AIKnowledgeBase>
          columns={columns}
          data={kbs ?? []}
          loading={isLoading}
          emptyText="No knowledge bases. Create one and upload documents."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <div className="mt-4 p-4 rounded-[10px] bg-primary/5 border border-primary/10">
        <p className="text-xs text-gray-600">
          <span className="font-semibold">Supported formats:</span> PDF, DOCX, DOC, Markdown, TXT, CSV.
          Documents are split into chunks and embedded using pgvector for semantic search.
          The AI assistant uses these embeddings for RAG (Retrieval Augmented Generation) to provide context-aware responses.
        </p>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Knowledge Base">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Company Policies" />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createKB.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
