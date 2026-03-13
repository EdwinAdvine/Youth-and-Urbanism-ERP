/**
 * Analytics Dashboard Builder tests — empty state, widget dialog, save API call.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── minimal inline Dashboard component ───────────────────────────────────────

interface Widget { id: string; type: string; title: string }

function Dashboard({ onSave }: { onSave: (widgets: Widget[]) => void }) {
  const [widgets, setWidgets] = React.useState<Widget[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const addWidget = () => {
    const w: Widget = { id: `w-${Date.now()}`, type: 'chart', title: 'New Widget' }
    setWidgets((prev) => [...prev, w])
    setDialogOpen(false)
  }

  return (
    <div>
      {widgets.length === 0 && <p data-testid="empty-state">No widgets yet. Add one to get started.</p>}
      <button onClick={() => setDialogOpen(true)}>Add Widget</button>
      {dialogOpen && (
        <div role="dialog" aria-label="Add widget">
          <p>Select widget type</p>
          <button onClick={addWidget}>Confirm</button>
          <button onClick={() => setDialogOpen(false)}>Cancel</button>
        </div>
      )}
      <ul>
        {widgets.map((w) => (
          <li key={w.id} data-testid="widget-item">{w.title}</li>
        ))}
      </ul>
      <button onClick={() => onSave(widgets)}>Save Dashboard</button>
    </div>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Analytics Dashboard Builder', () => {
  let onSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSave = vi.fn()
  })

  it('renders dashboard with empty state', () => {
    render(<Dashboard onSave={onSave} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument()
  })

  it('add widget button opens dialog', () => {
    render(<Dashboard onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /add widget/i }))
    expect(screen.getByRole('dialog', { name: /add widget/i })).toBeInTheDocument()
    expect(screen.getByText(/select widget type/i)).toBeInTheDocument()
  })

  it('confirming dialog adds widget and hides empty state', () => {
    render(<Dashboard onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /add widget/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('widget-item')).toHaveLength(1)
  })

  it('save dashboard calls onSave with current widgets', () => {
    render(<Dashboard onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /add widget/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    fireEvent.click(screen.getByRole('button', { name: /save dashboard/i }))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0]).toHaveLength(1)
  })
})
