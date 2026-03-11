import { type Document } from '../../api/docs'

const FILE_CONFIG: Record<string, { color: string; label: string }> = {
  docx: { color: '#2B579A', label: 'Word Document' },
  xlsx: { color: '#217346', label: 'Excel Spreadsheet' },
  pptx: { color: '#D24726', label: 'PowerPoint Presentation' },
  pdf:  { color: '#B30B00', label: 'PDF Document' },
}

interface PrintPreviewProps {
  file: Document
  onClose: () => void
}

export default function PrintPreview({ file, onClose }: PrintPreviewProps) {
  const ext = file.extension.replace(/^\./, '')
  const cfg = FILE_CONFIG[ext] ?? FILE_CONFIG.docx

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-900 overflow-auto">
      {/* Toolbar (hidden in print) */}
      <div className="print:hidden sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-3 z-10 shadow-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to document
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.color }} />
          <span>{file.name}</span>
          <span className="text-gray-300">|</span>
          <span>{cfg.label}</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
          </svg>
          Print
        </button>
        <button
          onClick={() => {
            // In production, this downloads the file via the backend
            window.open(`/api/v1/docs/file/${file.id}/download`, '_blank')
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download
        </button>
      </div>

      {/* Preview area */}
      <div className="max-w-[816px] mx-auto my-8 print:my-0 print:max-w-none">
        {/* Page mock */}
        <div className="bg-white dark:bg-gray-800 shadow-lg print:shadow-none min-h-[1056px] p-16 print:p-8">
          {/* Document header */}
          <div className="border-b-2 pb-4 mb-6" style={{ borderColor: cfg.color }}>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: 'Open Sans, sans-serif' }}>
              {file.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{cfg.label}</span>
              <span>Last modified: {new Date(file.updated_at).toLocaleString()}</span>
              <span>Created: {new Date(file.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Content placeholder */}
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[10px] p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center mx-auto mb-3">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">
                Document content will be rendered by ONLYOFFICE.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                For full preview, open the document in the editor and use the built-in print function.
              </p>
            </div>

            {/* File metadata */}
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">File Information</h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div>
                  <dt className="text-gray-400">File Name</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium">{file.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Type</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium">{cfg.label}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Size</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium">
                    {file.size < 1024
                      ? `${file.size} B`
                      : file.size < 1048576
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : `${(file.size / 1048576).toFixed(1)} MB`}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400">Content Type</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium">{file.content_type}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Created</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium">
                    {new Date(file.created_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400">Last Modified</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium">
                    {new Date(file.updated_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400">Storage Path</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium truncate">{file.folder_path}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Visibility</dt>
                  <dd className="text-gray-700 dark:text-gray-300 font-medium">
                    {file.is_public ? 'Public' : 'Private'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-[9px] text-gray-400">
              Printed from Urban ERP Documents on {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
