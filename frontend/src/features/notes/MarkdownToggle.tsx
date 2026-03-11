interface MarkdownToggleProps {
  mode: 'wysiwyg' | 'markdown'
  onChange: (mode: 'wysiwyg' | 'markdown') => void
}

export default function MarkdownToggle({ mode, onChange }: MarkdownToggleProps) {
  return (
    <div className="flex items-center border border-gray-200 rounded-[8px] overflow-hidden">
      <button
        onClick={() => onChange('wysiwyg')}
        className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
          mode === 'wysiwyg'
            ? 'bg-[#51459d] text-white'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
        title="WYSIWYG editor"
      >
        <div className="flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Rich
        </div>
      </button>
      <button
        onClick={() => onChange('markdown')}
        className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
          mode === 'markdown'
            ? 'bg-[#51459d] text-white'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
        title="Markdown editor"
      >
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] font-bold">MD</span>
        </div>
      </button>
    </div>
  )
}

/** Markdown editor textarea for raw editing mode */
export function MarkdownEditor({
  content,
  onChange,
}: {
  content: string
  onChange: (content: string) => void
}) {
  // Convert HTML to rough markdown for editing
  const htmlToMarkdown = (html: string): string => {
    let md = html
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '__$1__')
    md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    md = md.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n')
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    md = md.replace(/<[^>]+>/g, '')
    md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    md = md.replace(/\n{3,}/g, '\n\n')
    return md.trim()
  }

  // Convert markdown back to HTML
  const markdownToHtml = (md: string): string => {
    let html = md
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/__(.+?)__/g, '<u>$1</u>')
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    html = html.replace(/\n/g, '<br>')
    return html
  }

  const mdText = htmlToMarkdown(content)

  return (
    <textarea
      value={mdText}
      onChange={(e) => onChange(markdownToHtml(e.target.value))}
      className="flex-1 w-full px-6 py-4 text-sm text-gray-700 font-mono leading-relaxed focus:outline-none resize-none bg-gray-50 min-h-0"
      placeholder="Write in Markdown..."
      spellCheck={false}
    />
  )
}
