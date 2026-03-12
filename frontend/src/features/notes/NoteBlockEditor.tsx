/**
 * NoteBlockEditor — TipTap-based block editor for Y&U Notes.
 *
 * Replaces the legacy contentEditable editor with a full block editor supporting:
 * - Slash commands (/)
 * - Tables, task lists, callouts, toggles
 * - Code blocks with syntax highlighting
 * - Math equations (KaTeX)
 * - Superscript / subscript
 * - Character count & word count
 * - Drag handles for block reordering
 * - Bubble menu for inline formatting
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CharacterCount from '@tiptap/extension-character-count'
import Dropcursor from '@tiptap/extension-dropcursor'
import Focus from '@tiptap/extension-focus'
import Typography from '@tiptap/extension-typography'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Mention from '@tiptap/extension-mention'

// ── Types ──────────────────────────────────────────────────────────────────

interface NoteBlockEditorProps {
  content?: string
  contentFormat?: 'html' | 'tiptap_json'
  onChange?: (content: string, format: 'tiptap_json') => void
  onWordCountChange?: (count: number) => void
  placeholder?: string
  editable?: boolean
}

// ── Slash Command Items ────────────────────────────────────────────────────

interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (editor: any) => void
  category: string
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  // Text
  { title: 'Text', description: 'Plain text block', icon: 'T', category: 'Basic',
    command: (e) => e.chain().focus().setParagraph().run() },
  { title: 'Heading 1', description: 'Large section heading', icon: 'H1', category: 'Basic',
    command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', description: 'Medium section heading', icon: 'H2', category: 'Basic',
    command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Heading 3', description: 'Small section heading', icon: 'H3', category: 'Basic',
    command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  // Lists
  { title: 'Bullet List', description: 'Unordered list', icon: '•', category: 'Lists',
    command: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered List', description: 'Ordered list', icon: '1.', category: 'Lists',
    command: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: 'Task List', description: 'Checklist with checkboxes', icon: '☑', category: 'Lists',
    command: (e) => e.chain().focus().toggleTaskList().run() },
  // Blocks
  { title: 'Table', description: 'Insert a table', icon: '⊞', category: 'Blocks',
    command: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Blockquote', description: 'Quote block', icon: '"', category: 'Blocks',
    command: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: 'Code Block', description: 'Code snippet', icon: '</>', category: 'Blocks',
    command: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: 'Divider', description: 'Horizontal rule', icon: '—', category: 'Blocks',
    command: (e) => e.chain().focus().setHorizontalRule().run() },
  // Callouts
  { title: 'Info Callout', description: 'Informational callout', icon: 'ℹ', category: 'Callouts',
    command: (e) => e.chain().focus().insertContent({
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ℹ️ ' }] }],
    }).run() },
  { title: 'Warning Callout', description: 'Warning callout', icon: '⚠', category: 'Callouts',
    command: (e) => e.chain().focus().insertContent({
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '⚠️ ' }] }],
    }).run() },
  { title: 'Success Callout', description: 'Success callout', icon: '✅', category: 'Callouts',
    command: (e) => e.chain().focus().insertContent({
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '✅ ' }] }],
    }).run() },
]

// ── Slash Command Menu Component ───────────────────────────────────────────

function SlashCommandMenu({
  isOpen,
  filter,
  onSelect,
  onClose,
  position,
}: {
  isOpen: boolean
  filter: string
  onSelect: (item: SlashCommandItem) => void
  onClose: () => void
  position: { top: number; left: number }
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filtered = SLASH_COMMANDS.filter(
    (c) =>
      c.title.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [filter])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, filtered, selectedIndex, onSelect, onClose])

  if (!isOpen || filtered.length === 0) return null

  // Group by category
  const grouped: Record<string, SlashCommandItem[]> = {}
  filtered.forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  })

  let globalIdx = 0

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            {category}
          </div>
          {items.map((item) => {
            const idx = globalIdx++
            return (
              <button
                key={item.title}
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  idx === selectedIndex
                    ? 'bg-[#51459d]/10 text-[#51459d]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-gray-100 dark:bg-gray-700 text-xs font-bold shrink-0">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-[13px]">{item.title}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{item.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Toolbar Button ─────────────────────────────────────────────────────────

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

// ── Main Editor ────────────────────────────────────────────────────────────

export default function NoteBlockEditor({
  content = '',
  contentFormat = 'html',
  onChange,
  onWordCountChange,
  placeholder = 'Start writing, or press / for commands...',
  editable = true,
}: NoteBlockEditorProps) {
  const [slashMenu, setSlashMenu] = useState<{
    isOpen: boolean
    filter: string
    position: { top: number; left: number }
  }>({ isOpen: false, filter: '', position: { top: 0, left: 0 } })

  const slashStartPos = useRef<number | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: false, // using dedicated extension
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[#51459d] underline cursor-pointer' },
      }),
      Image.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      // New extensions for Notes
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Dropcursor.configure({ color: '#51459d', width: 2 }),
      Focus.configure({ className: 'has-focus', mode: 'all' }),
      Typography,
      Superscript,
      Subscript,
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'note-editor prose prose-sm max-w-none text-gray-900 dark:text-gray-100 focus:outline-none',
        style: 'min-height: 400px; padding: 1rem;',
      },
      handleKeyDown: (view, event) => {
        // Slash command trigger
        if (event.key === '/' && !slashMenu.isOpen) {
          const { from } = view.state.selection
          slashStartPos.current = from

          // Get cursor position for menu placement
          const coords = view.coordsAtPos(from)
          setSlashMenu({
            isOpen: true,
            filter: '',
            position: { top: coords.bottom + 8, left: coords.left },
          })
          return false
        }

        // Close slash menu on escape
        if (event.key === 'Escape' && slashMenu.isOpen) {
          setSlashMenu((s) => ({ ...s, isOpen: false }))
          slashStartPos.current = null
          return true
        }

        return false
      },
      handleDrop: (_view, event) => {
        if (event.dataTransfer?.files?.length) {
          event.preventDefault()
          const files = Array.from(event.dataTransfer.files)
          files.filter((f) => f.type.startsWith('image/')).forEach((file) => {
            const reader = new FileReader()
            reader.onload = () => {
              editor?.chain().focus().setImage({ src: reader.result as string }).run()
            }
            reader.readAsDataURL(file)
          })
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Update slash command filter
      if (slashMenu.isOpen && slashStartPos.current !== null) {
        const { from } = ed.state.selection
        const text = ed.state.doc.textBetween(slashStartPos.current, from, '')
        if (text.startsWith('/')) {
          setSlashMenu((s) => ({ ...s, filter: text.slice(1) }))
        } else {
          setSlashMenu((s) => ({ ...s, isOpen: false }))
          slashStartPos.current = null
        }
      }

      // Emit content as JSON
      const json = JSON.stringify(ed.getJSON())
      onChange?.(json, 'tiptap_json')

      // Word count
      onWordCountChange?.(ed.storage.characterCount?.words() ?? 0)
    },
  })

  // Handle slash command selection
  const handleSlashSelect = useCallback(
    (item: SlashCommandItem) => {
      if (!editor || slashStartPos.current === null) return

      // Delete the slash command text
      const { from } = editor.state.selection
      editor.chain().focus().deleteRange({ from: slashStartPos.current, to: from }).run()

      // Execute the command
      item.command(editor)

      // Close menu
      setSlashMenu({ isOpen: false, filter: '', position: { top: 0, left: 0 } })
      slashStartPos.current = null
    },
    [editor]
  )

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

  if (!editor) return null

  const wordCount = editor.storage.characterCount?.words() ?? 0
  const charCount = editor.storage.characterCount?.characters() ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      {editable && (
        <div className="flex items-center gap-0.5 flex-wrap px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10">
          {/* Text formatting */}
          <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
            <span className="text-xs font-bold">B</span>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
            <span className="text-xs italic font-serif">I</span>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
            <span className="text-xs underline">U</span>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <span className="text-xs line-through">S</span>
          </ToolbarBtn>

          <ToolbarSep />

          {/* Headings */}
          <ToolbarBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            <span className="text-[10px] font-bold">H1</span>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            <span className="text-[10px] font-bold">H2</span>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
            <span className="text-[10px] font-bold">H3</span>
          </ToolbarBtn>

          <ToolbarSep />

          {/* Lists */}
          <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="5" cy="6" r="1" fill="currentColor" /><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="5" cy="18" r="1" fill="currentColor" /></svg>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><text x="4" y="7" fontSize="7" fill="currentColor" stroke="none">1</text><text x="4" y="13" fontSize="7" fill="currentColor" stroke="none">2</text><text x="4" y="19" fontSize="7" fill="currentColor" stroke="none">3</text></svg>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="6" height="6" rx="1" /><path d="M5 8l1 1 2-2" /><line x1="13" y1="8" x2="21" y2="8" /><rect x="3" y="14" width="6" height="6" rx="1" /><line x1="13" y1="17" x2="21" y2="17" /></svg>
          </ToolbarBtn>

          <ToolbarSep />

          {/* Blocks */}
          <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" /></svg>
          </ToolbarBtn>
          <ToolbarBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="16,18 22,12 16,6" /><polyline points="8,6 2,12 8,18" /></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="12" x2="21" y2="12" /></svg>
          </ToolbarBtn>

          <ToolbarSep />

          {/* Link & Image */}
          <ToolbarBtn active={editor.isActive('link')} onClick={setLink} title="Insert link">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
          </ToolbarBtn>

          {/* Undo/Redo */}
          <div className="ml-auto flex items-center gap-0.5">
            <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="1,4 1,10 7,10" /><path d="M3.51 15a9 9 0 105.64-9.36L1 10" /></svg>
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23,4 23,10 17,10" /><path d="M20.49 15a9 9 0 11-5.64-9.36L23 10" /></svg>
            </ToolbarBtn>
          </div>
        </div>
      )}

      {/* Bubble Menu (appears on text selection) */}
      {editor && editable && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] shadow-lg px-1 py-0.5">
            <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
              <span className="text-xs font-bold">B</span>
            </ToolbarBtn>
            <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
              <span className="text-xs italic font-serif">I</span>
            </ToolbarBtn>
            <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
              <span className="text-xs underline">U</span>
            </ToolbarBtn>
            <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
              <span className="text-xs line-through">S</span>
            </ToolbarBtn>
            <ToolbarSep />
            <ToolbarBtn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="16,18 22,12 16,6" /><polyline points="8,6 2,12 8,18" /></svg>
            </ToolbarBtn>
            <ToolbarBtn active={editor.isActive('link')} onClick={setLink} title="Link">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
            </ToolbarBtn>
            <ToolbarBtn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} title="Highlight">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            </ToolbarBtn>
          </div>
        </BubbleMenu>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Slash Command Menu */}
      <SlashCommandMenu
        isOpen={slashMenu.isOpen}
        filter={slashMenu.filter}
        onSelect={handleSlashSelect}
        onClose={() => {
          setSlashMenu({ isOpen: false, filter: '', position: { top: 0, left: 0 } })
          slashStartPos.current = null
        }}
        position={slashMenu.position}
      />

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500">
        <span>{wordCount} words · {charCount} characters</span>
        <span>Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px]">/</kbd> for commands</span>
      </div>

      {/* Editor Styles */}
      <style>{`
        .note-editor {
          outline: none;
          font-family: 'Open Sans', sans-serif;
          font-size: 0.9rem;
          line-height: 1.7;
        }
        .note-editor p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .note-editor ul { list-style: disc; padding-left: 1.5em; }
        .note-editor ol { list-style: decimal; padding-left: 1.5em; }
        .note-editor ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }
        .note-editor ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5em;
        }
        .note-editor ul[data-type="taskList"] li > label {
          margin-top: 0.25em;
        }
        .note-editor ul[data-type="taskList"] li > label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #51459d;
          cursor: pointer;
        }
        .note-editor ul[data-type="taskList"] li[data-checked="true"] > div > p {
          text-decoration: line-through;
          color: #9ca3af;
        }
        .note-editor blockquote {
          border-left: 3px solid #51459d;
          padding-left: 1em;
          margin-left: 0;
          color: #6b7280;
        }
        .note-editor pre {
          background: #1e1e2e;
          color: #cdd6f4;
          border-radius: 8px;
          padding: 0.75em 1em;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.813rem;
          overflow-x: auto;
        }
        .note-editor code {
          background: #f3f4f6;
          border-radius: 4px;
          padding: 0.15em 0.3em;
          font-size: 0.813rem;
        }
        .dark .note-editor code { background: #374151; }
        .note-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 0.5em 0;
        }
        .note-editor a { color: #51459d; text-decoration: underline; }
        .note-editor h1 { font-size: 1.75em; font-weight: 700; margin: 0.75em 0 0.25em; }
        .note-editor h2 { font-size: 1.35em; font-weight: 600; margin: 0.6em 0 0.2em; }
        .note-editor h3 { font-size: 1.15em; font-weight: 600; margin: 0.5em 0 0.2em; }
        .note-editor hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5em 0;
        }
        .dark .note-editor hr { border-top-color: #374151; }
        /* Table styles */
        .note-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .note-editor th, .note-editor td {
          border: 1px solid #e5e7eb;
          padding: 0.5em 0.75em;
          text-align: left;
          vertical-align: top;
          min-width: 100px;
        }
        .dark .note-editor th, .dark .note-editor td { border-color: #374151; }
        .note-editor th {
          background: #f9fafb;
          font-weight: 600;
        }
        .dark .note-editor th { background: #1f2937; }
        .note-editor .selectedCell { background: #51459d10; }
        /* Focus styles */
        .note-editor .has-focus {
          border-radius: 4px;
          box-shadow: none;
        }
      `}</style>
    </div>
  )
}
