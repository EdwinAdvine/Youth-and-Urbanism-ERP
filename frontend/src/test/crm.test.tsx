/**
 * CRM Pipeline tests — kanban columns, deal creation form validation, stage placement.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── types ─────────────────────────────────────────────────────────────────────

type Stage = 'lead' | 'qualified' | 'proposal' | 'won' | 'lost'
interface Deal { id: string; title: string; value: number; stage: Stage }

// ── inline components ─────────────────────────────────────────────────────────

const STAGES: Stage[] = ['lead', 'qualified', 'proposal', 'won', 'lost']

function KanbanBoard({ deals }: { deals: Deal[] }) {
  return (
    <div style={{ display: 'flex' }}>
      {STAGES.map((stage) => (
        <div key={stage} data-testid={`column-${stage}`}>
          <h3>{stage.charAt(0).toUpperCase() + stage.slice(1)}</h3>
          {deals
            .filter((d) => d.stage === stage)
            .map((d) => (
              <div key={d.id} data-testid="deal-card">{d.title}</div>
            ))}
        </div>
      ))}
    </div>
  )
}

function CreateDealForm({ onSubmit }: { onSubmit: (deal: Omit<Deal, 'id'>) => void }) {
  const [error, setError] = React.useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const title = (fd.get('title') as string).trim()
    const value = Number(fd.get('value'))
    const stage = fd.get('stage') as Stage

    if (!title) { setError('Title is required'); return }
    if (!value || value <= 0) { setError('Value must be positive'); return }
    setError('')
    onSubmit({ title, value, stage })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Deal title" aria-label="Deal title" />
      <input name="value" type="number" placeholder="Value" aria-label="Value" />
      <select name="stage" aria-label="Stage">
        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Create Deal</button>
    </form>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('CRM Pipeline', () => {
  it('renders pipeline kanban columns for all stages', () => {
    render(<KanbanBoard deals={[]} />)
    STAGES.forEach((stage) => {
      expect(screen.getByTestId(`column-${stage}`)).toBeInTheDocument()
    })
  })

  it('create deal form validates required title field', () => {
    render(<CreateDealForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/value/i), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /create deal/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/title is required/i)
  })

  it('create deal form validates positive value', () => {
    render(<CreateDealForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/deal title/i), { target: { value: 'New Deal' } })
    fireEvent.change(screen.getByLabelText(/value/i), { target: { value: '-100' } })
    fireEvent.click(screen.getByRole('button', { name: /create deal/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/value must be positive/i)
  })

  it('deal appears in correct stage column', () => {
    const deals: Deal[] = [
      { id: '1', title: 'Alpha Corp', value: 10000, stage: 'qualified' },
      { id: '2', title: 'Beta Ltd', value: 5000, stage: 'lead' },
    ]
    render(<KanbanBoard deals={deals} />)
    const qualifiedCol = screen.getByTestId('column-qualified')
    expect(qualifiedCol).toHaveTextContent('Alpha Corp')
    const leadCol = screen.getByTestId('column-lead')
    expect(leadCol).toHaveTextContent('Beta Ltd')
  })
})
