import { Card, Button, Spinner, Badge } from '../../components/ui'
import { useDriveFile, useDownloadFile, formatFileSize, getFileType } from '../../api/drive'

interface Props {
  fileId: string
  onClose?: () => void
}

export default function FilePreviewPanel({ fileId, onClose }: Props) {
  const { data: file, isLoading } = useDriveFile(fileId)
  const downloadFile = useDownloadFile()

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
      </div>
    </div>
  )
}
