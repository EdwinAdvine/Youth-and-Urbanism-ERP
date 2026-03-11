import { useState, useRef } from 'react'
import {
  useVirtualBackgrounds,
  useUploadVirtualBackground,
  type VirtualBackground,
} from '../../api/meetings'

interface VirtualBackgroundsProps {
  selected: string | null
  onSelect: (bg: VirtualBackground | null) => void
}

export default function VirtualBackgrounds({ selected, onSelect }: VirtualBackgroundsProps) {
  const { data: backgrounds, isLoading } = useVirtualBackgrounds()
  const uploadBg = useUploadVirtualBackground()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    uploadBg.mutate(file, {
      onSettled: () => {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
          Virtual Background
        </p>
        <button
          onClick={() => onSelect(null)}
          className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
            !selected
              ? 'bg-[#51459d] text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          None
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-full aspect-video rounded-lg bg-gray-700 animate-pulse"
            />
          ))
        ) : (
          backgrounds?.map((bg) => (
            <button
              key={bg.id}
              onClick={() => onSelect(bg)}
              title={bg.name}
              className={`relative w-full aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                selected === bg.id
                  ? 'border-[#51459d] ring-1 ring-[#51459d]/50'
                  : 'border-transparent hover:border-gray-600'
              }`}
            >
              {bg.type === 'blur' ? (
                <div className="w-full h-full bg-gradient-to-br from-gray-500/50 to-gray-700/50 flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              ) : bg.type === 'color' ? (
                <div className="w-full h-full" style={{ backgroundColor: bg.url }} />
              ) : (
                <img
                  src={bg.url}
                  alt={bg.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              {selected === bg.id && (
                <div className="absolute inset-0 bg-[#51459d]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-black/50 text-[8px] text-white text-center py-0.5 truncate">
                {bg.name}
              </span>
            </button>
          ))
        )}

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-video rounded-lg border-2 border-dashed border-gray-600 hover:border-gray-500 flex flex-col items-center justify-center gap-1 transition-colors"
        >
          {uploading ? (
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <>
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[8px] text-gray-500">Upload</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  )
}
