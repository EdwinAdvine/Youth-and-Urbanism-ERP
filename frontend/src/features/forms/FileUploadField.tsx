import { useState, useRef } from 'react'
import { useUploadFile, formatFileSize } from '../../api/drive'

interface FileUploadFieldProps {
  label: string
  required?: boolean
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean
  accept?: string
  maxSizeMB?: number
  folderId?: string
}

interface UploadedFile {
  id: string
  name: string
  size: number
}

export default function FileUploadField({
  label,
  required,
  value: _initValue,
  onChange,
  multiple = false,
  accept,
  maxSizeMB = 50,
  folderId,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadFile = useUploadFile()

  const handleFiles = async (fileList: FileList) => {
    setError(null)
    const files = Array.from(fileList)

    // Validate size
    for (const f of files) {
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`File "${f.name}" exceeds the ${maxSizeMB}MB limit`)
        return
      }
    }

    setUploading(true)
    const newUploaded: UploadedFile[] = []

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await uploadFile.mutateAsync({
          file: files[i],
          folder_id: folderId,
          onProgress: (pct) => {
            setProgress(Math.round(((i + pct / 100) / files.length) * 100))
          },
        })
        newUploaded.push({
          id: result.id,
          name: result.name,
          size: result.size,
        })
      } catch {
        setError(`Failed to upload "${files[i].name}"`)
      }
    }

    setUploading(false)
    setProgress(0)

    const allUploaded = [...uploadedFiles, ...newUploaded]
    setUploadedFiles(allUploaded)

    // Update value with file IDs
    if (multiple) {
      onChange(allUploaded.map((f) => f.id))
    } else if (newUploaded.length > 0) {
      onChange(newUploaded[0].id)
    }

    // Reset input
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeFile = (fileId: string) => {
    const updated = uploadedFiles.filter((f) => f.id !== fileId)
    setUploadedFiles(updated)
    if (multiple) {
      onChange(updated.map((f) => f.id))
    } else {
      onChange('')
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-[#ff3a6e] ml-1">*</span>}
      </label>

      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-[10px] p-4 text-center transition-colors cursor-pointer ${ uploading ? 'border-[#51459d]/30 bg-[#51459d]/5' : 'border-gray-200 dark:border-gray-700 hover:border-[#51459d]/40 hover:bg-gray-50 dark:hover:bg-gray-800' }`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files.length && !uploading) handleFiles(e.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {uploading ? (
          <div className="space-y-2">
            <svg className="animate-spin h-5 w-5 text-[#51459d] mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs text-gray-600 dark:text-gray-400">Uploading... {progress}%</p>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[200px] mx-auto">
              <div
                className="h-full bg-[#51459d] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <svg className="h-6 w-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Drop file{multiple ? 's' : ''} here or <span className="text-[#51459d] font-medium">browse</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Max {maxSizeMB}MB per file
              {accept && ` · ${accept}`}
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-[#ff3a6e]">{error}</p>
      )}

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-[8px] px-3 py-2"
            >
              <svg className="h-4 w-4 text-[#51459d] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
