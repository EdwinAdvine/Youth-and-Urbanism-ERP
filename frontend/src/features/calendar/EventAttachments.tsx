import { useRef, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string
  event_id: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  minio_key: string | null
  uploaded_by: string
  created_at: string
  updated_at: string
}

interface DownloadUrlResponse {
  url: string
  file_name: string
  mime_type: string
  expires_in: number
}

interface EventAttachmentsProps {
  eventId: string
  canEdit: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const API_BASE = '/api/v1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ── File type icon config ─────────────────────────────────────────────────────

type IconVariant = 'pdf' | 'doc' | 'xls' | 'img' | 'other'

function getIconVariant(mimeType: string | null, fileName: string): IconVariant {
  const m = mimeType?.toLowerCase() ?? ''
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

  if (m === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (
    m.includes('word') ||
    m.includes('document') ||
    ['doc', 'docx', 'odt', 'rtf'].includes(ext)
  )
    return 'doc'
  if (
    m.includes('spreadsheet') ||
    m.includes('excel') ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  )
    return 'xls'
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
    return 'img'
  return 'other'
}

const ICON_STYLES: Record<IconVariant, { bg: string; label: string; color: string }> = {
  pdf:   { bg: 'bg-red-100',    color: 'text-red-600',    label: 'PDF' },
  doc:   { bg: 'bg-blue-100',   color: 'text-blue-600',   label: 'DOC' },
  xls:   { bg: 'bg-green-100',  color: 'text-green-600',  label: 'XLS' },
  img:   { bg: 'bg-purple-100', color: 'text-purple-600', label: 'IMG' },
  other: { bg: 'bg-gray-100',   color: 'text-gray-500',   label: 'FILE' },
}

function FileTypeIcon({ mimeType, fileName }: { mimeType: string | null; fileName: string }) {
  const variant = getIconVariant(mimeType, fileName)
  const { bg, color, label } = ICON_STYLES[variant]
  return (
    <span
      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold tracking-wide flex-shrink-0 ${bg} ${color}`}
    >
      {label}
    </span>
  )
}

// ── API functions ─────────────────────────────────────────────────────────────

async function fetchAttachments(eventId: string): Promise<Attachment[]> {
  const { data } = await axios.get<Attachment[]>(
    `${API_BASE}/calendar/events/${eventId}/attachments`
  )
  return data
}

async function uploadAttachment(eventId: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post<Attachment>(
    `${API_BASE}/calendar/events/${eventId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

async function deleteAttachment(eventId: string, attachmentId: string): Promise<void> {
  await axios.delete(
    `${API_BASE}/calendar/events/${eventId}/attachments/${attachmentId}`
  )
}

async function getDownloadUrl(
  eventId: string,
  attachmentId: string
): Promise<DownloadUrlResponse> {
  const { data } = await axios.get<DownloadUrlResponse>(
    `${API_BASE}/calendar/events/${eventId}/attachments/${attachmentId}/download`
  )
  return data
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UploadProgressBar({ progress }: { progress: number }) {
  return (
    <div className="mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${progress}%`, backgroundColor: '#51459d' }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventAttachments({ eventId, canEdit }: EventAttachmentsProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['calendar-attachments', eventId],
    queryFn: () => fetchAttachments(eventId),
    enabled: Boolean(eventId),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Client-side size guard
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error('File exceeds the 25 MB limit')
      }

      // Simulate granular progress using axios onUploadProgress
      return uploadAttachmentWithProgress(eventId, file, setUploadProgress)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-attachments', eventId] })
      setUploadProgress(null)
      setUploadError(null)
    },
    onError: (err: Error) => {
      setUploadProgress(null)
      setUploadError(err.message || 'Upload failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(eventId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-attachments', eventId] })
      setPendingDelete(null)
    },
    onError: () => {
      setPendingDelete(null)
    },
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      setUploadError(null)
      Array.from(files).forEach((file) => {
        uploadMutation.mutate(file)
      })
    },
    [uploadMutation]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => setDragActive(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (!canEdit) return
    handleFiles(e.dataTransfer.files)
  }

  const handleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id)
    try {
      const { url, file_name } = await getDownloadUrl(eventId, attachment.id)
      // Open in new tab — the presigned URL will trigger the browser download
      const link = document.createElement('a')
      link.href = url
      link.download = file_name
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      // silently fail — user sees no download
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Attachments
          {attachments.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({attachments.length})
            </span>
          )}
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#51459d', color: '#fff' }}
          >
            + Upload
          </button>
        )}
      </div>

      {/* Drag-and-drop zone (only when canEdit) */}
      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-1.5 p-5 rounded-xl
            border-2 border-dashed cursor-pointer select-none transition-colors
            ${dragActive
              ? 'border-[#51459d] bg-[#f5f3ff]'
              : 'border-gray-200 bg-gray-50 hover:border-[#51459d] hover:bg-[#f5f3ff]'
            }
          `}
        >
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16v-8m0 0-3 3m3-3 3 3M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5h-4.879a1.5 1.5 0 0 1-1.06-.44L12 5m0 0H9"
            />
          </svg>
          <p className="text-sm text-gray-500">
            Drag files here or{' '}
            <span style={{ color: '#51459d' }} className="font-medium">
              click to browse
            </span>
          </p>
          <p className="text-xs text-gray-400">Max 25 MB per file</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Upload progress */}
      {uploadMutation.isPending && uploadProgress !== null && (
        <div className="px-1">
          <p className="text-xs text-gray-500 mb-1">Uploading… {Math.round(uploadProgress)}%</p>
          <UploadProgressBar progress={uploadProgress} />
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="text-xs text-red-500 px-1">{uploadError}</p>
      )}

      {/* Attachment list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          No attachments yet
          {canEdit ? ' — upload one above' : ''}
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 group"
            >
              {/* Icon */}
              <FileTypeIcon
                mimeType={attachment.mime_type}
                fileName={attachment.file_name}
              />

              {/* File info */}
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => handleDownload(attachment)}
                  disabled={downloadingId === attachment.id}
                  className="block text-sm font-medium text-gray-800 truncate hover:underline text-left w-full disabled:opacity-60"
                  title={attachment.file_name}
                >
                  {downloadingId === attachment.id ? 'Opening…' : attachment.file_name}
                </button>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatBytes(attachment.file_size)} &middot; {formatDate(attachment.created_at)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Download button */}
                <button
                  type="button"
                  onClick={() => handleDownload(attachment)}
                  disabled={downloadingId === attachment.id}
                  title="Download"
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </button>

                {/* Delete button — only for editors */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(attachment.id)}
                    title="Delete"
                    className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4">
            <h4 className="text-base font-semibold text-gray-800">Delete Attachment?</h4>
            <p className="text-sm text-gray-500">
              This file will be permanently removed from MinIO and cannot be recovered.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
                disabled={deleteMutation.isPending}
                className="text-sm px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#ff3a6e' }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Upload with progress ───────────────────────────────────────────────────────

async function uploadAttachmentWithProgress(
  eventId: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)

  const { data } = await axios.post<Attachment>(
    `${API_BASE}/calendar/events/${eventId}/attachments`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      },
    }
  )
  return data
}
