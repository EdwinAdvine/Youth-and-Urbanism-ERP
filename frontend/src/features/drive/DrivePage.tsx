import React, { useState, useRef, useCallback } from 'react'
import {
  useDriveFiles,
  useDriveFolders,
  useUploadFile,
  useDownloadFile,
  useDeleteFile,
  useCreateFolder,
  useSharedWithMe,
  useSharedFolders,
  useTeamFolders,
  useCreateTeamFolder,
  useOpenInEditor,
  useFileAsAttachment,
  useLinkFileToTask,
  formatFileSize,
  getFileType,
  type DriveFile,
  type DriveFolder,
} from '../../api/drive'
import ShareDialog from '../../components/drive/ShareDialog'
import BulkActionsToolbar from './BulkActionsToolbar'
import FavoritesView, { FavoriteToggle } from './FavoritesView'
import FileVersionsPanel from './FileVersionsPanel'
import FilePreviewPanel from './FilePreviewPanel'
import { useSmartFolders, useSmartFolderFiles, useCreateSmartFolder, useDeleteSmartFolder, type SmartFolder } from '../../api/drive_ext'

// ─── File type config ─────────────────────────────────────────────────────────

type FileType = 'folder' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'video' | 'zip' | 'other'

const FILE_ICONS: Record<FileType, { icon: string; color: string; bg: string }> = {
  folder: { icon: '📁', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  pdf:    { icon: '📕', color: 'text-red-600',    bg: 'bg-red-50' },
  docx:   { icon: '📘', color: 'text-blue-600',   bg: 'bg-blue-50' },
  xlsx:   { icon: '📗', color: 'text-green-600',  bg: 'bg-green-50' },
  pptx:   { icon: '📙', color: 'text-orange-600', bg: 'bg-orange-50' },
  image:  { icon: '🖼️', color: 'text-pink-600',   bg: 'bg-pink-50' },
  video:  { icon: '🎬', color: 'text-purple-600', bg: 'bg-purple-50' },
  zip:    { icon: '🗜️', color: 'text-gray-600',   bg: 'bg-gray-50' },
  other:  { icon: '📄', color: 'text-gray-500',   bg: 'bg-gray-50' },
}

// ─── Unified display item ────────────────────────────────────────────────────

interface DisplayItem {
  id: string
  name: string
  fileType: FileType
  size: string
  modified: string
  isFolder: boolean
  isPublic: boolean
  raw?: DriveFile
}

function filesToDisplayItems(files: DriveFile[]): DisplayItem[] {
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    fileType: getFileType(f.content_type, f.name) as FileType,
    size: formatFileSize(f.size),
    modified: new Date(f.updated_at).toLocaleDateString(),
    isFolder: false,
    isPublic: f.is_public,
    raw: f,
  }))
}

function foldersToDisplayItems(folders: DriveFolder[]): DisplayItem[] {
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    fileType: 'folder' as FileType,
    size: '—',
    modified: new Date(f.created_at).toLocaleDateString(),
    isFolder: true,
    isPublic: false,
  }))
}

// ─── Long press hook for touch context menu ──────────────────────────────────

function useLongPress(callback: (e: React.TouchEvent) => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchRef = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    timerRef.current = setTimeout(() => {
      callback(e)
    }, delay)
  }, [callback, delay])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return
    const dx = Math.abs(e.touches[0].clientX - touchRef.current.x)
    const dy = Math.abs(e.touches[0].clientY - touchRef.current.y)
    if (dx > 10 || dy > 10) {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    touchRef.current = null
  }, [])

  return { onTouchStart, onTouchMove, onTouchEnd }
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({ x, y, item, onClose, onAction }: {
  x: number; y: number; item: DisplayItem;
  onClose: () => void;
  onAction: (action: string, item: DisplayItem) => void;
}) {
  const menuItems = item.isFolder
    ? [
        { label: 'Open', icon: '→', action: 'open' },
        { label: 'Share', icon: '⤴', action: 'share' },
        null,
        { label: 'Delete', icon: '🗑', action: 'delete', danger: true },
      ]
    : [
        { label: 'Open', icon: '→', action: 'open' },
        { label: 'Open in Editor', icon: '✏', action: 'open-in-editor' },
        { label: 'Download', icon: '↓', action: 'download' },
        { label: 'Share', icon: '⤴', action: 'share' },
        { label: 'Attach to Mail', icon: '✉', action: 'attach-to-mail' },
        { label: 'Link to Task', icon: '☑', action: 'link-to-task' },
        { label: 'AI Insights', icon: '✨', action: 'ai-preview' },
        { label: 'Version History', icon: '⏱', action: 'versions' },
        { label: 'Move', icon: '↗', action: 'move' },
        null,
        { label: 'Delete', icon: '🗑', action: 'delete', danger: true },
      ]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] shadow-xl py-1 w-44"
        style={{ left: Math.min(x, window.innerWidth - 180), top: Math.min(y, window.innerHeight - 200) }}
      >
        {menuItems.map((item2, i) =>
          item2 === null ? (
            <div key={i} className="my-1 border-t border-gray-100 dark:border-gray-800" />
          ) : (
            <button
              key={item2.action}
              onClick={() => { onAction(item2.action, item); onClose() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${'danger' in item2 && item2.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 dark:text-gray-300'}`}
            >
              <span className="w-4 text-center opacity-60">{item2.icon}</span>
              {item2.label}
            </button>
          )
        )}
      </div>
    </>
  )
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({ onUpload }: { onUpload: (files: FileList) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files) }}
      className={`border-2 border-dashed rounded-[10px] p-8 text-center transition-colors cursor-pointer ${dragging ? 'border-[#51459d] bg-[#51459d]/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files)} />
      <div className="text-2xl mb-2">☁️</div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop files here or click to upload</p>
      <p className="text-xs text-gray-400 mt-1">Any file type · Max 500 MB per file</p>
    </div>
  )
}

// ─── File Grid Item with long-press for touch ────────────────────────────────

function FileGridItem({ item, cfg, isSelected, onSelect, onContextMenu, onOpen }: {
  item: DisplayItem
  cfg: { icon: string; color: string; bg: string }
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onContextMenu: (x: number, y: number) => void
  onOpen: () => void
}) {
  const longPressHandlers = useLongPress((e) => {
    const touch = e.touches[0]
    onContextMenu(touch.clientX, touch.clientY)
  }, 500)

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      {...longPressHandlers}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/drive-file-id', item.id); e.dataTransfer.effectAllowed = 'move' }}
      className={`relative group flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border rounded-[10px] hover:border-[#51459d]/30 hover:shadow-sm transition-all text-center cursor-pointer min-h-[88px] ${isSelected ? 'border-[#51459d] ring-2 ring-[#51459d]/20' : 'border-gray-100 dark:border-gray-800'}`}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 sm:transition-opacity touch-device:opacity-100">
        <FavoriteToggle fileId={item.id} />
      </div>
      <span className="text-3xl">{cfg.icon}</span>
      <div className="w-full">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{item.name}</p>
        <p className="text-[10px] text-gray-400">{item.size}</p>
      </div>
      {item.isPublic && <span className="text-[10px] text-[#51459d] bg-[#51459d]/10 px-1.5 rounded">Public</span>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DrivePage() {
  const [activeSection, setActiveSection] = useState<string>('my-files')
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(window.innerWidth < 768 ? 'list' : 'grid')
  const [search, setSearch] = useState('')
  const [breadcrumbs, setBreadcrumbs] = useState<{ label: string; folderId?: string }[]>([{ label: 'My Files' }])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: DisplayItem } | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDept, setNewTeamDept] = useState('')
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [versionsFile, setVersionsFile] = useState<{ id: string; name: string } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  // globalDragging state removed - can be re-added for drag UX
  const [linkTaskTarget, setLinkTaskTarget] = useState<{ id: string; name: string } | null>(null)
  const [linkTaskId, setLinkTaskId] = useState('')
  const [linkProjectId, setLinkProjectId] = useState('')
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const [activeSmartFolder, setActiveSmartFolder] = useState<string | null>(null)
  const [showNewSmartFolder, setShowNewSmartFolder] = useState(false)
  const [newSmartFolderName, setNewSmartFolderName] = useState('')

  // ─── API hooks ──────────────────────────────────────────────────────────────
  const isSharedView = activeSection === 'shared'
  const isTeamView = activeSection === 'team-folders'

  const { data: filesData, isError: filesError } = useDriveFiles(
    isSharedView || isTeamView ? undefined : { folder_id: activeFolderId }
  )
  const { data: sharedData } = useSharedWithMe()
  const { data: sharedFoldersData } = useSharedFolders()
  const { data: foldersData } = useDriveFolders(activeFolderId)
  const { data: teamFoldersData } = useTeamFolders()

  const uploadFile = useUploadFile()
  const downloadFile = useDownloadFile()
  const deleteFile = useDeleteFile()
  const createFolder = useCreateFolder()
  const createTeamFolder = useCreateTeamFolder()
  const openInEditor = useOpenInEditor()
  const fileAsAttachment = useFileAsAttachment()
  const linkFileToTask = useLinkFileToTask()
  const { data: smartFoldersData } = useSmartFolders()
  const { data: smartFolderFiles } = useSmartFolderFiles(activeSmartFolder || '')
  const createSmartFolder = useCreateSmartFolder()
  const deleteSmartFolder = useDeleteSmartFolder()

  // ─── Build display items ───────────────────────────────────────────────────

  const folderItems = isSharedView
    ? foldersToDisplayItems(sharedFoldersData?.folders ?? [])
    : isTeamView
      ? []
      : foldersToDisplayItems(foldersData?.folders ?? [])

  const fileItems = isSharedView
    ? filesToDisplayItems(sharedData?.files ?? [])
    : isTeamView
      ? []
      : filesToDisplayItems(filesData?.files ?? [])

  const allItems = [...folderItems, ...fileItems]

  const items = allItems.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  )

  // ─── Upload handler (one file at a time) ────────────────────────────────────

  const handleUpload = async (fileList: FileList) => {
    const filesToUpload = Array.from(fileList)
    for (let i = 0; i < filesToUpload.length; i++) {
      await uploadFile.mutateAsync({
        file: filesToUpload[i],
        folder_id: activeFolderId,
        onProgress: (pct) => {
          const overallPct = Math.round(((i + pct / 100) / filesToUpload.length) * 100)
          setUploadProgress(overallPct)
        },
      })
    }
    setUploadProgress(null)
    setShowUpload(false)
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleAction = async (action: string, item: DisplayItem) => {
    if (action === 'download' && !item.isFolder) {
      try {
        const result = await downloadFile.mutateAsync(item.id)
        window.open(result.download_url, '_blank')
      } catch {
        alert('Download failed.')
      }
    } else if (action === 'open' && !item.isFolder) {
      try {
        const result = await downloadFile.mutateAsync(item.id)
        window.open(result.download_url, '_blank')
      } catch {
        alert('Cannot open file.')
      }
    } else if (action === 'open' && item.isFolder) {
      setBreadcrumbs((prev) => [...prev, { label: item.name, folderId: item.id }])
      setActiveFolderId(item.id)
    } else if (action === 'delete') {
      if (confirm(`Delete "${item.name}"?`)) {
        try {
          await deleteFile.mutateAsync(item.id)
        } catch {
          alert('Delete failed.')
        }
      }
    } else if (action === 'share') {
      setShareTarget({
        id: item.id,
        name: item.name,
        type: item.isFolder ? 'folder' : 'file',
      })
    } else if (action === 'versions' && !item.isFolder) {
      setVersionsFile({ id: item.id, name: item.name })
    } else if (action === 'open-in-editor' && !item.isFolder) {
      try {
        const result = await openInEditor.mutateAsync(item.id)
        // Open the ONLYOFFICE editor in a new tab/window with the config
        const configParam = encodeURIComponent(JSON.stringify(result.config))
        window.open(`${result.editor_url}?config=${configParam}`, '_blank')
      } catch {
        alert('Cannot open this file type in the editor.')
      }
    } else if (action === 'attach-to-mail' && !item.isFolder) {
      try {
        const meta = await fileAsAttachment.mutateAsync(item.id)
        // Copy the attachment info to clipboard for pasting into mail compose
        await navigator.clipboard.writeText(JSON.stringify({
          file_id: meta.file_id,
          name: meta.name,
          content_type: meta.content_type,
          size: meta.size,
          download_url: meta.download_url,
        }))
        alert(`Attachment info for "${meta.name}" copied to clipboard. Paste in mail compose.`)
      } catch {
        alert('Failed to get attachment info.')
      }
    } else if (action === 'link-to-task' && !item.isFolder) {
      setLinkTaskTarget({ id: item.id, name: item.name })
    } else if (action === 'ai-preview' && !item.isFolder) {
      setPreviewFileId(item.id)
    }
  }

  const handleLinkToTask = async () => {
    if (!linkTaskTarget || !linkTaskId.trim() || !linkProjectId.trim()) return
    try {
      await linkFileToTask.mutateAsync({
        fileId: linkTaskTarget.id,
        taskId: linkTaskId.trim(),
        projectId: linkProjectId.trim(),
      })
      alert(`"${linkTaskTarget.name}" linked to task successfully.`)
      setLinkTaskTarget(null)
      setLinkTaskId('')
      setLinkProjectId('')
    } catch {
      alert('Failed to link file to task. Check the Task ID and Project ID.')
    }
  }

  // ─── Create folder handler ──────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    await createFolder.mutateAsync({
      name: newFolderName.trim(),
      parent_id: activeFolderId,
    })
    setNewFolderName('')
    setShowNewFolder(false)
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    await createTeamFolder.mutateAsync({
      name: newTeamName.trim(),
      department: newTeamDept.trim() || undefined,
    })
    setNewTeamName('')
    setNewTeamDept('')
    setShowCreateTeam(false)
  }

  // ─── Sidebar ────────────────────────────────────────────────────────────────

  const sidebarLinks = [
    { id: 'my-files', label: 'My Files',       icon: '🗂️' },
    { id: 'shared',   label: 'Shared with Me', icon: '🔗' },
    { id: 'team-folders', label: 'Team Folders', icon: '👥' },
    { id: 'recent',   label: 'Recent',         icon: '🕐' },
    { id: 'starred',  label: 'Starred',        icon: '⭐' },
    { id: 'trash',    label: 'Trash',          icon: '🗑️' },
  ]

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-52 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800 flex-col">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
          <button
            onClick={() => setShowUpload(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#51459d] hover:bg-[#3d3480] text-white text-sm font-medium rounded-[8px] px-4 py-2.5 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Upload
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-[8px] px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Folder
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {sidebarLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => {
                setActiveSection(link.id)
                setActiveFolderId(undefined)
                setBreadcrumbs([{ label: link.label }])
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm transition-colors mb-0.5 ${
                activeSection === link.id && !activeFolderId ? 'bg-[#51459d]/10 text-[#51459d] font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </button>
          ))}

          {/* Team Folders list */}
          {activeSection === 'team-folders' && teamFoldersData?.team_folders && (
            <div className="mt-2 ml-2 space-y-0.5">
              {teamFoldersData.team_folders.map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => {
                    if (tf.drive_folder_id) {
                      setActiveSection('my-files')
                      setActiveFolderId(tf.drive_folder_id)
                      setBreadcrumbs([{ label: 'My Files' }, { label: tf.name, folderId: tf.drive_folder_id }])
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-sm">{tf.is_company_wide ? '🏢' : '👥'}</span>
                  <span className="truncate">{tf.name}</span>
                  {tf.department && (
                    <span className="ml-auto text-[10px] text-gray-400 shrink-0">{tf.department}</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setShowCreateTeam(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-xs text-[#51459d] hover:bg-[#51459d]/5 transition-colors"
              >
                <span>+</span> New Team Folder
              </button>
            </div>
          )}

          {/* Smart Folders */}
          {smartFoldersData?.smart_folders && smartFoldersData.smart_folders.length > 0 && (
            <div className="mt-3 px-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-2">Smart Folders</p>
              {smartFoldersData.smart_folders.map((sf: SmartFolder) => (
                <button
                  key={sf.id}
                  onClick={() => {
                    setActiveSmartFolder(sf.id)
                    setActiveSection('smart-folder')
                    setBreadcrumbs([{ label: sf.name }])
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-xs transition-colors mb-0.5 ${
                    activeSmartFolder === sf.id ? 'bg-[#51459d]/10 text-[#51459d] font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-sm">{sf.icon || '🔍'}</span>
                  <span className="truncate">{sf.name}</span>
                </button>
              ))}
              <button
                onClick={() => setShowNewSmartFolder(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-xs text-[#51459d] hover:bg-[#51459d]/5 transition-colors"
              >
                <span>+</span> New Smart Folder
              </button>
            </div>
          )}

          <div className="mt-4 px-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Storage</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Used</span><span>12.4 GB / 100 GB</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                <div className="h-full bg-[#51459d] rounded-full" style={{ width: '12.4%' }} />
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        {filesError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
            <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <p className="text-xs text-amber-700">Drive API not available — check backend connection.</p>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm min-w-0">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <svg className="h-3.5 w-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                <button
                  onClick={() => {
                    const newCrumbs = breadcrumbs.slice(0, i + 1)
                    setBreadcrumbs(newCrumbs)
                    setActiveFolderId(crumb.folderId)
                    if (i === 0) setActiveSection(activeSection)
                  }}
                  className={`text-sm truncate ${i === breadcrumbs.length - 1 ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'}`}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex-1" />

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…" className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none w-44" />
          </div>

          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-[8px] overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 sm:p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 sm:p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
          </div>

          <button onClick={() => setShowUpload(true)} className="flex items-center justify-center gap-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px] min-w-[44px]">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className="px-5 py-2 bg-[#51459d]/5 border-b border-[#51459d]/10 shrink-0">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-4 w-4 text-[#51459d] shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>Uploading…</span><span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-[#51459d] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk actions toolbar */}
        <BulkActionsToolbar
          selectedIds={selectedFileIds}
          onClearSelection={() => setSelectedFileIds([])}
        />

        {/* New folder dialog */}
        {showNewFolder && (
          <div className="px-5 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 shrink-0">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="Folder name"
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] w-56"
            />
            <button
              onClick={handleCreateFolder}
              disabled={createFolder.isPending}
              className="text-xs bg-[#51459d] text-white px-3 py-1.5 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              Create
            </button>
            <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              Cancel
            </button>
          </div>
        )}

        {/* Create team folder dialog */}
        {showCreateTeam && (
          <div className="px-5 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 shrink-0">
            <input
              autoFocus
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
              placeholder="Team folder name"
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] w-44"
            />
            <input
              value={newTeamDept}
              onChange={(e) => setNewTeamDept(e.target.value)}
              placeholder="Department (optional)"
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] w-36"
            />
            <button
              onClick={handleCreateTeam}
              disabled={createTeamFolder.isPending}
              className="text-xs bg-[#51459d] text-white px-3 py-1.5 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              Create
            </button>
            <button onClick={() => { setShowCreateTeam(false); setNewTeamName(''); setNewTeamDept('') }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              Cancel
            </button>
          </div>
        )}

        {/* File area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5" onContextMenu={(e) => { e.preventDefault() }}>
          {showUpload && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Upload Files</h3>
                <button onClick={() => setShowUpload(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
              </div>
              <UploadZone onUpload={(fl) => handleUpload(fl)} />
            </div>
          )}

          {/* Team folders grid view */}
          {isTeamView && teamFoldersData?.team_folders && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Team Folders</p>
                <button
                  onClick={() => setShowCreateTeam(true)}
                  className="text-xs text-[#51459d] hover:underline"
                >
                  + New Team Folder
                </button>
              </div>
              {teamFoldersData.team_folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No team folders yet</p>
                  <button onClick={() => setShowCreateTeam(true)} className="mt-3 text-xs text-[#51459d] hover:underline">Create one →</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  {teamFoldersData.team_folders.map((tf) => (
                    <button
                      key={tf.id}
                      onDoubleClick={() => {
                        if (tf.drive_folder_id) {
                          setActiveSection('my-files')
                          setActiveFolderId(tf.drive_folder_id)
                          setBreadcrumbs([{ label: 'My Files' }, { label: tf.name, folderId: tf.drive_folder_id }])
                        }
                      }}
                      className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] hover:border-[#51459d]/30 hover:shadow-sm transition-all text-center"
                    >
                      <span className="text-3xl">{tf.is_company_wide ? '🏢' : '👥'}</span>
                      <div className="w-full">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{tf.name}</p>
                        {tf.department && (
                          <p className="text-[10px] text-gray-400">{tf.department}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Favorites view */}
          {activeSection === 'starred' && (
            <FavoritesView />
          )}

          {/* Smart folder files view */}
          {activeSection === 'smart-folder' && activeSmartFolder && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Smart Folder Results</p>
                <button
                  onClick={() => {
                    if (confirm('Delete this smart folder?')) {
                      deleteSmartFolder.mutate(activeSmartFolder)
                      setActiveSmartFolder(null)
                      setActiveSection('my-files')
                      setBreadcrumbs([{ label: 'My Files' }])
                    }
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
              {!smartFolderFiles?.files?.length ? (
                <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400">
                  <p className="text-sm">No files match this smart folder's criteria</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  {smartFolderFiles.files.map((file: DriveFile) => {
                    const cfg = FILE_ICONS[(getFileType(file.content_type, file.name) as FileType)] ?? FILE_ICONS.other
                    return (
                      <FileGridItem
                        key={file.id}
                        item={{
                          id: file.id, name: file.name,
                          fileType: getFileType(file.content_type, file.name) as FileType,
                          size: formatFileSize(file.size), modified: new Date(file.updated_at).toLocaleDateString(),
                          isFolder: false, isPublic: file.is_public, raw: file,
                        }}
                        cfg={cfg}
                        isSelected={selectedFileIds.includes(file.id)}
                        onSelect={() => {}}
                        onOpen={() => setPreviewFileId(file.id)}
                        onContextMenu={(x, y) => setContextMenu({ x, y, item: {
                          id: file.id, name: file.name,
                          fileType: getFileType(file.content_type, file.name) as FileType,
                          size: formatFileSize(file.size), modified: new Date(file.updated_at).toLocaleDateString(),
                          isFolder: false, isPublic: file.is_public, raw: file,
                        }})}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeSection === 'starred' ? null : activeSection === 'smart-folder' ? null : !isTeamView && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isSharedView ? 'No files shared with you' : 'This folder is empty'}
              </p>
              {!isSharedView && (
                <button onClick={() => setShowUpload(true)} className="mt-3 text-xs text-[#51459d] hover:underline">Upload files →</button>
              )}
            </div>
          ) : !isTeamView && viewMode === 'grid' ? (
            <>
              {/* Folders first */}
              {items.some((f) => f.isFolder) && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Folders</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    {items.filter((f) => f.isFolder).map((item) => (
                      <button
                        key={item.id}
                        onDoubleClick={() => { setBreadcrumbs((p) => [...p, { label: item.name, folderId: item.id }]); setActiveFolderId(item.id) }}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }) }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(item.id) }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDragOverFolderId(null)
                          // File drag-and-drop into folder handled elsewhere if needed
                        }}
                        className={`flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border rounded-[10px] hover:border-yellow-300 hover:shadow-sm transition-all text-center ${dragOverFolderId === item.id ? 'border-[#51459d] bg-[#51459d]/5 border-dashed border-2' : 'border-gray-100 dark:border-gray-800'}`}
                      >
                        <span className="text-3xl">📁</span>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full">{item.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {items.some((f) => !f.isFolder) && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Files</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    {items.filter((f) => !f.isFolder).map((item) => {
                      const cfg = FILE_ICONS[item.fileType] ?? FILE_ICONS.other
                      const isSelected = selectedFileIds.includes(item.id)
                      return (
                        <FileGridItem
                          key={item.id}
                          item={item}
                          cfg={cfg}
                          isSelected={isSelected}
                          onSelect={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              setSelectedFileIds((prev) =>
                                prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                              )
                            }
                          }}
                          onOpen={() => handleAction('open', item)}
                          onContextMenu={(x, y) => setContextMenu({ x, y, item })}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : !isTeamView && items.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Modified</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Size</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Share</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const cfg = FILE_ICONS[item.fileType] ?? FILE_ICONS.other
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onDoubleClick={() => handleAction('open', item)}
                        onClick={() => {
                          // On touch devices, single tap opens folders/files
                          if ('ontouchstart' in window) handleAction('open', item)
                        }}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }) }}
                      >
                        <td className="px-4 py-3 min-h-[48px]">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{cfg.icon}</span>
                            <div>
                              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{item.name}</p>
                              {item.isPublic && <span className="text-[10px] text-[#51459d] bg-[#51459d]/10 px-1.5 rounded">Public</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{item.modified}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 text-right hidden sm:table-cell">{item.size}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShareTarget({ id: item.id, name: item.name, type: item.isFolder ? 'folder' : 'file' }) }}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[#51459d]/10 rounded-[4px] text-gray-400 hover:text-[#51459d] transition-colors"
                            title="Share"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, item }) }}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[4px] text-gray-400"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() => setContextMenu(null)}
          onAction={handleAction}
        />
      )}

      {shareTarget && (
        <ShareDialog
          itemId={shareTarget.id}
          itemName={shareTarget.name}
          itemType={shareTarget.type}
          onClose={() => setShareTarget(null)}
        />
      )}

      {versionsFile && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setVersionsFile(null)} />
          <FileVersionsPanel
            fileId={versionsFile.id}
            fileName={versionsFile.name}
            onClose={() => setVersionsFile(null)}
          />
        </div>
      )}

      {/* Preview panel */}
      {previewFileId && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setPreviewFileId(null)} />
          <FilePreviewPanel fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
        </div>
      )}

      {/* New Smart Folder dialog */}
      {showNewSmartFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewSmartFolder(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-xl w-96 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">New Smart Folder</h3>
            <p className="text-xs text-gray-400 mb-4">Auto-collects files matching your criteria.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                <input
                  autoFocus
                  value={newSmartFolderName}
                  onChange={(e) => setNewSmartFolderName(e.target.value)}
                  placeholder="e.g. All Finance PDFs"
                  className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    if (!newSmartFolderName.trim()) return
                    createSmartFolder.mutate({
                      name: newSmartFolderName.trim(),
                      filter_json: { content_type: 'application/pdf' },
                    })
                    setNewSmartFolderName('')
                    setShowNewSmartFolder(false)
                  }}
                  disabled={createSmartFolder.isPending}
                  className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewSmartFolder(false); setNewSmartFolderName('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link to Task dialog */}
      {linkTaskTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setLinkTaskTarget(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-xl w-96 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Link to Task</h3>
            <p className="text-xs text-gray-400 mb-4">Link "{linkTaskTarget.name}" to a project task.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Project ID</label>
                <input
                  value={linkProjectId}
                  onChange={(e) => setLinkProjectId(e.target.value)}
                  placeholder="Enter project UUID"
                  className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Task ID</label>
                <input
                  value={linkTaskId}
                  onChange={(e) => setLinkTaskId(e.target.value)}
                  placeholder="Enter task UUID"
                  className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleLinkToTask}
                  disabled={linkFileToTask.isPending || !linkTaskId.trim() || !linkProjectId.trim()}
                  className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
                >
                  {linkFileToTask.isPending ? 'Linking...' : 'Link to Task'}
                </button>
                <button
                  onClick={() => { setLinkTaskTarget(null); setLinkTaskId(''); setLinkProjectId('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
