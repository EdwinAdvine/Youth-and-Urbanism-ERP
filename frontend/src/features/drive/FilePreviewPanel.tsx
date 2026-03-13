import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge } from '../../components/ui'
import { useDriveFile, useDownloadFile, formatFileSize, getFileType } from '../../api/drive'
import { useLockFile, useUnlockFile } from '../../api/drive_ext'
import { useThreadedComments, useCreateComment, useResolveComment, useFilePresence } from '../../api/drive_phase2'
import AIInsightsPanel from './AIInsightsPanel'
import ModuleBadge from './ModuleBadge'
import RequestAccessDialog from './RequestAccessDialog'

interface Props {
  fileId: string
  onClose?: () => void
}

const EDITABLE_EXTENSIONS = new Set(['docx', 'doc', 'odt', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'odp', 'pdf'])

export default function FilePreviewPanel({ fileId, onClose }: Props) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'preview' | 'ai' | 'comments'>('preview')
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; user: string } | null>(null)
  const { data: file, isLoading } = useDriveFile(fileId)
  const downloadFile = useDownloadFile()
  const lockFile = useLockFile()
  const unlockFile = useUnlockFile()
  const { data: commentsData, isLoading: commentsLoading } = useThreadedComments(fileId)
  const createComment = useCreateComment()
  const resolveComment = useResolveComment()
  const { data: presenceData } = useFilePresence(fileId)

  const handlePostComment = async () => {
    if (!commentText.trim()) return
    await createComment.mutateAsync({
      fileId,
      content: commentText,
      parentId: replyTo?.id,
    })
    setCommentText('')
    setReplyTo(null)
  }

  const handleDownload = () => {
    downloadFile.mutate(fileId, {
      onSuccess: (data) => {
        window.open(data.download_url, '_blank')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="w-96 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!file) {
    return (
      <div className="w-96 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-400 text-sm">
        File not found
      </div>
    )
  }

  const fileType = getFileType(file.content_type, file.name)
  const isImage = file.content_type.startsWith('image/')
  const isPdf = file.content_type.includes('pdf')
  const isText = file.content_type.startsWith('text/') || file.content_type.includes('json') || file.content_type.includes('xml')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const isEditable = EDITABLE_EXTENSIONS.has(ext) || file.content_type.includes('word') || file.content_type.includes('spreadsheet') || file.content_type.includes('presentation')

  const handleOpenInDocs = () => {
    navigate('/docs', {
      state: {
        openDriveFile: {
          id: file.id,
          name: file.name,
          extension: ext || 'docx',
          content_type: file.content_type,
          size: file.size,
          minio_key: file.minio_key,
          folder_path: file.folder_path,
          is_public: file.is_public,
          created_at: file.created_at,
          updated_at: file.updated_at,
        },
      },
    })
  }

  return (
    <div className="w-96 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{file.name}</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleDownload} loading={downloadFile.isPending}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </Button>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Presence indicator */}
      {presenceData && presenceData.users.length > 1 && (
        <div className="px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-[10px] text-gray-500 shrink-0">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          {presenceData.users.length} viewing
          <span className="text-gray-400 ml-0.5">
            — {presenceData.users.slice(0, 2).map(u => u.name).join(', ')}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 text-xs py-2 font-medium transition-colors ${activeTab === 'preview' ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Preview
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 text-xs py-2 font-medium transition-colors ${activeTab === 'ai' ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          AI Insights
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 text-xs py-2 font-medium transition-colors relative ${activeTab === 'comments' ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Comments
          {commentsData && commentsData.total > 0 && (
            <span className="absolute top-1 right-2 text-[9px] bg-[#51459d]/10 text-[#51459d] px-1 rounded-full">
              {commentsData.total}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'ai' ? (
        <div className="flex-1 overflow-auto">
          <AIInsightsPanel fileId={fileId} />
        </div>
      ) : activeTab === 'comments' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {commentsLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : !commentsData?.threads.length ? (
              <p className="text-xs text-gray-400 text-center py-8">No comments yet. Start the conversation.</p>
            ) : (
              commentsData.threads.map((thread) => (
                <div key={thread.id} className={`rounded-[8px] border p-3 space-y-2 ${thread.is_resolved ? 'border-gray-100 dark:border-gray-800 opacity-60' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#51459d]/20 text-[#51459d] text-[10px] flex items-center justify-center font-medium shrink-0">
                      {thread.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{thread.user_name}</span>
                        <div className="flex items-center gap-1">
                          {thread.is_resolved ? (
                            <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Resolved</span>
                          ) : (
                            <button
                              onClick={() => resolveComment.mutate({ commentId: thread.id, fileId })}
                              className="text-[9px] text-gray-400 hover:text-green-600 transition-colors"
                              title="Mark resolved"
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{thread.content}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400">{new Date(thread.created_at).toLocaleDateString()}</span>
                        <button
                          onClick={() => setReplyTo({ id: thread.id, user: thread.user_name })}
                          className="text-[10px] text-[#51459d] hover:underline"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                  {thread.replies.length > 0 && (
                    <div className="ml-8 space-y-2 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
                      {thread.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-500 text-[9px] flex items-center justify-center font-medium shrink-0">
                            {reply.user_id.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-600 dark:text-gray-400">{reply.content}</p>
                            <span className="text-[10px] text-gray-400">{new Date(reply.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {/* Comment composer */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 shrink-0 space-y-2">
            {replyTo && (
              <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
                <span>Replying to {replyTo.user}</span>
                <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment... @mention someone"
                rows={2}
                className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] px-3 py-2 resize-none bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-[#51459d] focus:border-[#51459d] outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePostComment() }}
              />
              <Button size="sm" onClick={handlePostComment} loading={createComment.isPending} className="self-end shrink-0">Post</Button>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Preview */}
      <div className="flex-1 overflow-auto p-4">
        {isImage ? (
          <div className="rounded-[10px] overflow-hidden border border-gray-100 dark:border-gray-800">
            <img
              src={`/api/v1/drive/file/${file.id}/preview`}
              alt={file.name}
              className="w-full h-auto object-contain max-h-[400px]"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        ) : isPdf ? (
          <div className="rounded-[10px] overflow-hidden border border-gray-100 dark:border-gray-800 h-[500px]">
            <iframe
              src={`/api/v1/drive/file/${file.id}/preview`}
              className="w-full h-full"
              title={file.name}
            />
          </div>
        ) : isText ? (
          <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-950 max-h-[500px] overflow-auto">
            <p className="text-xs text-gray-400 mb-2">Text preview</p>
            <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
              Content preview requires loading from the server.
            </pre>
          </div>
        ) : isEditable ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="w-16 h-16 rounded-2xl bg-[#51459d]/10 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Open in Y&U Docs</p>
            <p className="text-xs text-gray-400 mt-1 mb-3">Edit this file with the built-in document editor</p>
            <Button size="sm" onClick={handleOpenInDocs} className="bg-[#51459d] hover:bg-[#3d3480] text-white">
              Open in Editor
            </Button>
            <Button size="sm" variant="outline" className="mt-2" onClick={handleDownload}>
              Download instead
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Preview not available for this file type</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={handleDownload}>
              Download to view
            </Button>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Size</span>
          <span className="text-gray-700 dark:text-gray-300">{formatFileSize(file.size)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Type</span>
          <Badge variant="default">{fileType.toUpperCase()}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Modified</span>
          <span className="text-gray-700 dark:text-gray-300">{new Date(file.updated_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Location</span>
          <span className="text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{file.folder_path || '/'}</span>
        </div>
        {file.source_module && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Source</span>
            <ModuleBadge module={file.source_module} size="md" />
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
