import { useFavoriteFiles, useToggleFavorite, useDownloadFile, formatFileSize, getFileType } from '../../api/drive'

type FileType = 'folder' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'video' | 'zip' | 'other'

const FILE_ICONS: Record<FileType, string> = {
  folder: '📁', pdf: '📕', docx: '📘', xlsx: '📗', pptx: '📙',
  image: '🖼️', video: '🎬', zip: '🗜️', other: '📄',
}

export default function FavoritesView() {
  const { data: favData, isLoading } = useFavoriteFiles()
  const toggleFavorite = useToggleFavorite()
  const downloadFile = useDownloadFile()
  const files = favData?.files ?? []

  const handleDownload = async (fileId: string) => {
    try {
      const result = await downloadFile.mutateAsync(fileId)
      window.open(result.download_url, '_blank')
    } catch {
      alert('Download failed.')
    }
  }

  const handleUnfavorite = (fileId: string) => {
    toggleFavorite.mutate(fileId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin h-6 w-6 text-[#51459d]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">⭐</div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No favorites yet</h3>
        <p className="text-xs text-gray-400 mt-1">
          Star files and folders to quickly access them here
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Favorites ({files.length})
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {files.map((file) => {
          const fileType = getFileType(file.content_type, file.name) as FileType
          const icon = FILE_ICONS[fileType] ?? FILE_ICONS.other
          return (
            <div
              key={file.id}
              className="relative group flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] hover:border-[#51459d]/30 hover:shadow-sm transition-all text-center"
            >
              {/* Favorite star button */}
              <button
                onClick={() => handleUnfavorite(file.id)}
                className="absolute top-2 right-2 text-yellow-400 hover:text-yellow-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove from favorites"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>

              <span className="text-3xl">{icon}</span>
              <div className="w-full">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
              </div>

              {/* Hover actions */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(file.id)}
                  className="p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                  title="Download"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Small star toggle button to add to file items elsewhere */
export function FavoriteToggle({
  fileId,
  isFavorited,
  className,
}: {
  fileId: string
  isFavorited?: boolean
  className?: string
}) {
  const toggleFavorite = useToggleFavorite()

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleFavorite.mutate(fileId)
      }}
      className={`p-1 transition-colors ${ isFavorited ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-400' } ${className ?? ''}`}
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isFavorited ? 0 : 2}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  )
}
