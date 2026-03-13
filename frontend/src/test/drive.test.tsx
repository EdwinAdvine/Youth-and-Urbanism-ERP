/**
 * Drive upload + share tests — file list columns, upload trigger, share dialog permissions.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── types ─────────────────────────────────────────────────────────────────────

interface DriveFile { id: string; name: string; size: string; modified: string; type: string }

// ── inline components ─────────────────────────────────────────────────────────

function FileList({ files, onUpload }: { files: DriveFile[]; onUpload: (f: File) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div>
      <input ref={inputRef} type="file" data-testid="file-input" style={{ display: 'none' }} onChange={handleFileChange} />
      <button onClick={() => inputRef.current?.click()}>Upload</button>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id} data-testid="file-row">
              <td>{f.name}</td>
              <td>{f.type}</td>
              <td>{f.size}</td>
              <td>{f.modified}</td>
              <td><button aria-label={`Share ${f.name}`}>Share</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ShareDialog({ fileName, onClose }: { fileName: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-label={`Share ${fileName}`}>
      <h2>Share "{fileName}"</h2>
      <fieldset>
        <legend>Permission level</legend>
        <label><input type="radio" name="permission" value="view" defaultChecked /> View only</label>
        <label><input type="radio" name="permission" value="comment" /> Can comment</label>
        <label><input type="radio" name="permission" value="edit" /> Can edit</label>
      </fieldset>
      <input placeholder="Add people by email" aria-label="Invite by email" />
      <button onClick={onClose}>Done</button>
    </div>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

const SAMPLE_FILES: DriveFile[] = [
  { id: 'f1', name: 'Report Q1.pdf', type: 'PDF', size: '2.1 MB', modified: '2026-03-01' },
  { id: 'f2', name: 'Budget.xlsx', type: 'Spreadsheet', size: '450 KB', modified: '2026-03-10' },
]

describe('Drive upload + share', () => {
  it('file list renders with correct column headers', () => {
    render(<FileList files={SAMPLE_FILES} onUpload={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /size/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /modified/i })).toBeInTheDocument()
  })

  it('file rows are rendered for each file', () => {
    render(<FileList files={SAMPLE_FILES} onUpload={vi.fn()} />)
    expect(screen.getAllByTestId('file-row')).toHaveLength(2)
    expect(screen.getByText('Report Q1.pdf')).toBeInTheDocument()
    expect(screen.getByText('Budget.xlsx')).toBeInTheDocument()
  })

  it('upload button triggers hidden file input click', () => {
    render(<FileList files={[]} onUpload={vi.fn()} />)
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')
    fireEvent.click(screen.getByRole('button', { name: /upload/i }))
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('share dialog renders with permission options', () => {
    render(<ShareDialog fileName="Report Q1.pdf" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/view only/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/can comment/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/can edit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/invite by email/i)).toBeInTheDocument()
  })

  it('share dialog calls onClose when Done is clicked', () => {
    const onClose = vi.fn()
    render(<ShareDialog fileName="Budget.xlsx" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
