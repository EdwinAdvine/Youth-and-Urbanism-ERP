/**
 * Rich Text Editor for Era Mail Compose — TipTap (ProseMirror-based)
 *
 * Features: Bold, Italic, Underline, Strikethrough, Link, Image, Lists,
 * Blockquote, Code, Text Align, Text Color, Highlight, Placeholder.
 * Emoji picker via @emoji-mart/react.
 */
import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'

// ── Types ────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  content?: string
  onChange?: (html: string) => void
  placeholder?: string
  minHeight?: string
  onAttachFiles?: (files: File[]) => void
}

interface UploadedAttachment {
  storage_key: string
  filename: string
  size: number
  content_type: string
}

// ── Toolbar Button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-[4px] transition-colors ${
        active
          ? 'bg-[#51459d]/15 text-[#51459d]'
          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

function ToolbarSep() {
  return <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
}

// ── Color Picker Popover ─────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#51459d', '#ff3a6e', '#6fd943',
]

function ColorPickerPopover({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean
  onClose: () => void
  onSelect: (color: string) => void
}) {
  if (!isOpen) return null
  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] shadow-lg p-2">
      <div className="grid grid-cols-5 gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { onSelect(c); onClose() }}
            className="w-6 h-6 rounded-[4px] border border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  )
}

// ── Emoji Picker Button ──────────────────────────────────────────────────────

function EmojiPickerButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Common emoji quick-access grid (no heavy emoji-mart for initial load)
  const QUICK_EMOJIS = [
    '😊', '👍', '🎉', '❤️', '🔥', '✅', '⭐', '💡',
    '📌', '🚀', '💪', '🤝', '📧', '📎', '🏷️', '⚡',
    '😂', '🤔', '👏', '🙏', '😍', '🎯', '💯', '🌟',
  ]

  return (
    <div className="relative" ref={pickerRef}>
      <ToolbarBtn
        onClick={() => setOpen(!open)}
        title="Insert emoji"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </ToolbarBtn>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] shadow-lg p-2 w-[220px]">
          <div className="grid grid-cols-8 gap-1">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onSelect(e); setOpen(false) }}
                className="w-6 h-6 flex items-center justify-center text-base hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[4px] transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Editor ──────────────────────────────────────────────────────────────

export default function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Compose your message...',
  minHeight = '200px',
  onAttachFiles,
}: RichTextEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[#51459d] underline cursor-pointer' },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none text-gray-900 dark:text-gray-100 focus:outline-none',
        style: `min-height: ${minHeight}`,
      },
      handleDrop: (view, event) => {
        if (event.dataTransfer?.files?.length) {
          event.preventDefault()
          const files = Array.from(event.dataTransfer.files)
          const imageFiles = files.filter((f) => f.type.startsWith('image/'))
          const otherFiles = files.filter((f) => !f.type.startsWith('image/'))

          // Insert images inline
          imageFiles.forEach((file) => {
            const reader = new FileReader()
            reader.onload = () => {
              const src = reader.result as string
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({ src })
                )
              )
            }
            reader.readAsDataURL(file)
          })

          // Attach non-image files
          if (otherFiles.length && onAttachFiles) {
            onAttachFiles(otherFiles)
          }
          return true
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (items) {
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault()
              const file = item.getAsFile()
              if (file) {
                const reader = new FileReader()
                reader.onload = () => {
                  const src = reader.result as string
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src })
                    )
                  )
                }
                reader.readAsDataURL(file)
              }
              return true
            }
          }
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = prompt('Enter URL:', previousUrl ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return
    const url = prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFilesChosen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length && onAttachFiles) {
      onAttachFiles(files)
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onAttachFiles])

  if (!editor) return null

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        {/* Text formatting */}
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4h4l-2 16H8l2-16z M14 4h4M6 20h4" /></svg>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="4" y1="12" x2="20" y2="12" /><path d="M17.5 7.5c0-2-1.5-3.5-5.5-3.5S6.5 5.5 6.5 7.5c0 4 11 4 11 8 0 2-1.5 3.5-5.5 3.5s-5.5-1.5-5.5-3.5" /></svg>
        </ToolbarBtn>

        <ToolbarSep />

        {/* Lists */}
        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="5" cy="6" r="1" fill="currentColor" /><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="5" cy="18" r="1" fill="currentColor" /></svg>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><text x="4" y="7" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><text x="4" y="13" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><text x="4" y="19" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text></svg>
        </ToolbarBtn>

        <ToolbarSep />

        {/* Block formatting */}
        <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" /></svg>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="16,18 22,12 16,6" /><polyline points="8,6 2,12 8,18" /></svg>
        </ToolbarBtn>

        <ToolbarSep />

        {/* Alignment */}
        <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
        </ToolbarBtn>

        <ToolbarSep />

        {/* Text color */}
        <div className="relative">
          <ToolbarBtn onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false) }} title="Text color">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11 2L5.5 16h2.25l1.12-3h6.25l1.13 3h2.25L13 2h-2zm-1.38 9L12 4.67 14.38 11H9.62z" /><rect x="3" y="18" width="18" height="3" rx="1" fill={editor.getAttributes('textStyle').color ?? '#51459d'} /></svg>
          </ToolbarBtn>
          <ColorPickerPopover
            isOpen={showColorPicker}
            onClose={() => setShowColorPicker(false)}
            onSelect={(color) => editor.chain().focus().setColor(color).run()}
          />
        </div>

        {/* Highlight */}
        <div className="relative">
          <ToolbarBtn active={editor.isActive('highlight')} onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false) }} title="Highlight">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          </ToolbarBtn>
          <ColorPickerPopover
            isOpen={showHighlightPicker}
            onClose={() => setShowHighlightPicker(false)}
            onSelect={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
          />
        </div>

        <ToolbarSep />

        {/* Link */}
        <ToolbarBtn active={editor.isActive('link')} onClick={setLink} title="Insert link">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
        </ToolbarBtn>

        {/* Image */}
        <ToolbarBtn onClick={addImage} title="Insert image from URL">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21,15 16,10 5,21" /></svg>
        </ToolbarBtn>

        {/* Emoji */}
        <EmojiPickerButton onSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()} />

        <ToolbarSep />

        {/* Attach file */}
        <ToolbarBtn onClick={handleFileSelect} title="Attach file">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
        </ToolbarBtn>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFilesChosen}
          className="hidden"
        />

        {/* Undo / Redo */}
        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="1,4 1,10 7,10" /><path d="M3.51 15a9 9 0 105.64-9.36L1 10" /></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23,4 23,10 17,10" /><path d="M20.49 15a9 9 0 11-5.64-9.36L23 10" /></svg>
          </ToolbarBtn>
        </div>
      </div>

      {/* Editor content area */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Hidden style for placeholder */}
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap {
          outline: none;
          font-family: 'Open Sans', sans-serif;
          font-size: 0.875rem;
          line-height: 1.6;
        }
        .tiptap ul { list-style: disc; padding-left: 1.5em; }
        .tiptap ol { list-style: decimal; padding-left: 1.5em; }
        .tiptap blockquote {
          border-left: 3px solid #51459d;
          padding-left: 1em;
          margin-left: 0;
          color: #6b7280;
        }
        .tiptap pre {
          background: #1e1e2e;
          color: #cdd6f4;
          border-radius: 8px;
          padding: 0.75em 1em;
          font-family: monospace;
          font-size: 0.813rem;
        }
        .tiptap code {
          background: #f3f4f6;
          border-radius: 4px;
          padding: 0.15em 0.3em;
          font-size: 0.813rem;
        }
        .dark .tiptap code { background: #374151; }
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 0.5em 0;
        }
        .tiptap a { color: #51459d; text-decoration: underline; }
        .tiptap h1 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; }
        .tiptap h2 { font-size: 1.25em; font-weight: 600; margin: 0.5em 0; }
        .tiptap h3 { font-size: 1.1em; font-weight: 600; margin: 0.5em 0; }
      `}</style>
    </div>
  )
}

// ── Attachment chip component ────────────────────────────────────────────────

export function AttachmentChip({
  filename,
  size,
  uploading,
  onRemove,
}: {
  filename: string
  size: number
  uploading?: boolean
  onRemove: () => void
}) {
  const sizeStr = size < 1024
    ? `${size} B`
    : size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-[8px] px-2.5 py-1.5 text-xs">
      <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <span className="text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{filename}</span>
      <span className="text-gray-400 shrink-0">{sizeStr}</span>
      {uploading ? (
        <svg className="animate-spin h-3 w-3 text-[#51459d] shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
          title="Remove attachment"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  )
}

export type { UploadedAttachment }
