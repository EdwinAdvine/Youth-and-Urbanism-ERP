/**
 * Forms builder tests — field palette, adding fields to preview, editable form title.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── types ─────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox'

interface FormField { id: string; type: FieldType; label: string }

const PALETTE_FIELDS: { type: FieldType; label: string }[] = [
  { type: 'text', label: 'Text input' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date picker' },
  { type: 'select', label: 'Dropdown' },
  { type: 'checkbox', label: 'Checkbox' },
]

// ── inline component ──────────────────────────────────────────────────────────

function FormBuilder({ onSave }: { onSave: (title: string, fields: FormField[]) => void }) {
  const [title, setTitle] = React.useState('Untitled Form')
  const [fields, setFields] = React.useState<FormField[]>([])

  const addField = (type: FieldType, label: string) => {
    setFields((prev) => [...prev, { id: `f-${Date.now()}-${type}`, type, label: `${label} field` }])
  }

  return (
    <div>
      {/* Editable title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Form title"
        data-testid="form-title-input"
      />

      {/* Field palette */}
      <aside aria-label="Field palette" data-testid="field-palette">
        {PALETTE_FIELDS.map((p) => (
          <button key={p.type} onClick={() => addField(p.type, p.label)} aria-label={`Add ${p.label}`}>
            {p.label}
          </button>
        ))}
      </aside>

      {/* Form preview */}
      <section aria-label="Form preview" data-testid="form-preview">
        {fields.length === 0 && <p data-testid="preview-empty">Drop fields here</p>}
        {fields.map((f) => (
          <div key={f.id} data-testid="preview-field" data-type={f.type}>
            {f.label}
          </div>
        ))}
      </section>

      <button onClick={() => onSave(title, fields)}>Save Form</button>
    </div>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Forms builder', () => {
  it('blank form renders field palette with all field types', () => {
    render(<FormBuilder onSave={vi.fn()} />)
    expect(screen.getByTestId('field-palette')).toBeInTheDocument()
    PALETTE_FIELDS.forEach((p) => {
      expect(screen.getByRole('button', { name: `Add ${p.label}` })).toBeInTheDocument()
    })
  })

  it('blank form shows empty preview state', () => {
    render(<FormBuilder onSave={vi.fn()} />)
    expect(screen.getByTestId('preview-empty')).toBeInTheDocument()
  })

  it('clicking a field type adds it to the form preview', () => {
    render(<FormBuilder onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /add text input/i }))
    expect(screen.queryByTestId('preview-empty')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('preview-field')).toHaveLength(1)
    expect(screen.getByTestId('preview-field')).toHaveTextContent(/text input/i)
  })

  it('adding multiple fields grows the preview', () => {
    render(<FormBuilder onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /add text input/i }))
    fireEvent.click(screen.getByRole('button', { name: /add number/i }))
    fireEvent.click(screen.getByRole('button', { name: /add date picker/i }))
    expect(screen.getAllByTestId('preview-field')).toHaveLength(3)
  })

  it('form title is editable', () => {
    render(<FormBuilder onSave={vi.fn()} />)
    const titleInput = screen.getByLabelText(/form title/i)
    expect(titleInput).toHaveValue('Untitled Form')
    fireEvent.change(titleInput, { target: { value: 'Customer Feedback' } })
    expect(titleInput).toHaveValue('Customer Feedback')
  })

  it('save form calls onSave with current title and fields', () => {
    const onSave = vi.fn()
    render(<FormBuilder onSave={onSave} />)
    fireEvent.change(screen.getByLabelText(/form title/i), { target: { value: 'Survey 2026' } })
    fireEvent.click(screen.getByRole('button', { name: /add text input/i }))
    fireEvent.click(screen.getByRole('button', { name: /save form/i }))
    expect(onSave).toHaveBeenCalledWith('Survey 2026', expect.arrayContaining([expect.objectContaining({ type: 'text' })]))
  })
})
