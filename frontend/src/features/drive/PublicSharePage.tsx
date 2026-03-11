import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  useSharedLink,
  useDownloadShareLink,
  useFileDropUpload,
  formatFileSize,
} from '../../api/drive'
import { Button, Spinner } from '../../components/ui'

export default function PublicSharePage() {
  const { link } = useParams<{ link: string }>()
  const { data: share, isLoading, error } = useSharedLink(link ?? '')
  const downloadLink = useDownloadShareLink()
  const fileDropUpload = useFileDropUpload()

  const [password, setPassword] = useState('')
  const [passwordSubmitted, setPasswordSubmitted] = useState(false)
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Detect password requirement from error
  const needsPassword = !passwordSubmitted && (requiresPassword || (error && (error as { response?: { status?: number } })?.response?.status === 403))

  const handleDownload = async () => {
    if (!link) return
    try {
      const result = await downloadLink.mutateAsync({ link, password: password || undefined })
      window.open(result.download_url, '_blank')
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        setRequiresPassword(true)
        setPasswordSubmitted(false)
      } else {
        alert('Failed to download file.')
      }
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSubmitted(true)
    setRequiresPassword(false)
    handleDownload()
  }

  const handleFileDrop = useCallback(
    async (file: File) => {
      if (!link) return
      try {
        await fileDropUpload.mutateAsync({ link, file })
        setUploadSuccess(true)
      } catch {
        alert('Failed to upload file.')
      }
    },
    [link, fileDropUpload]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFileDrop(file)
    },
    [handleFileDrop]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileDrop(file)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!share && !needsPassword) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm text-center">
          <svg className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Link not found</h2>
          <p className="text-sm text-gray-500 mt-1">This shared link may have expired or been revoked.</p>
        </div>
      </div>
    )
  }

  // Password gate
  if (needsPassword) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <svg className="h-12 w-12 mx-auto text-[#51459d] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Password Required</h2>
            <p className="text-sm text-gray-500 mt-1">Enter the password to access this shared file.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
              autoFocus
            />
            {downloadLink.error && (
              <p className="text-xs text-[#ff3a6e]">Incorrect password. Please try again.</p>
            )}
            <Button type="submit" variant="primary" className="w-full" loading={downloadLink.isPending}>
              Access File
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // Type guard: share is typed as DriveFile from useSharedLink.
  // Check if this is a file-drop share by looking for is_file_drop on the response.
  const isFileDrop = (share as unknown as { is_file_drop?: boolean })?.is_file_drop === true

  // File-drop upload zone
  if (isFileDrop) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <svg className="h-12 w-12 mx-auto text-[#51459d] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">File Drop</h2>
          <p className="text-sm text-gray-500 mb-6">Upload a file to this shared folder.</p>

          {uploadSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-[10px] p-4 text-sm text-green-700">
              File uploaded successfully.
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-[10px] p-8 transition-colors cursor-pointer ${
                dragActive ? 'border-[#51459d] bg-purple-50' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onClick={() => document.getElementById('filedrop-input')?.click()}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {fileDropUpload.isPending
                  ? 'Uploading...'
                  : 'Drag and drop a file here, or click to browse'}
              </p>
              <input
                id="filedrop-input"
                type="file"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Normal file share - show info + download
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <svg className="h-12 w-12 mx-auto text-[#51459d] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>

        {share && (
          <>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{share.name}</h2>
            <div className="text-sm text-gray-500 space-y-1 mb-6">
              <p>{share.content_type}</p>
              <p>{formatFileSize(share.size)}</p>
            </div>
          </>
        )}

        <Button
          variant="primary"
          className="w-full"
          loading={downloadLink.isPending}
          onClick={handleDownload}
        >
          Download
        </Button>

        {downloadLink.error && (
          <p className="text-xs text-[#ff3a6e] mt-2">Failed to generate download link.</p>
        )}
      </div>
    </div>
  )
}
