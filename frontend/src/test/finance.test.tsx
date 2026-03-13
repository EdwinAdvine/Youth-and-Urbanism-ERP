/**
 * Finance Invoice flow tests — form rendering, line-item total calculation, status badge colors.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
interface LineItem { description: string; qty: number; unit_price: number }

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:     'bg-gray-200',
  sent:      'bg-blue-200',
  paid:      'bg-green-200',
  overdue:   'bg-red-200',
  cancelled: 'bg-yellow-200',
}

// ── inline components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span data-testid="status-badge" className={STATUS_COLORS[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function InvoiceForm({ onSubmit }: { onSubmit: (data: { customer: string; items: LineItem[] }) => void }) {
  const [items, setItems] = React.useState<LineItem[]>([{ description: '', qty: 1, unit_price: 0 }])

  const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0)

  const updateItem = (idx: number, field: keyof LineItem, val: string | number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it)))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSubmit({ customer: fd.get('customer') as string, items })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="customer" placeholder="Customer name" aria-label="Customer name" />
      {items.map((item, idx) => (
        <div key={idx} data-testid="line-item">
          <input
            placeholder="Description"
            aria-label={`Item ${idx + 1} description`}
            value={item.description}
            onChange={(e) => updateItem(idx, 'description', e.target.value)}
          />
          <input
            type="number"
            placeholder="Qty"
            aria-label={`Item ${idx + 1} qty`}
            value={item.qty}
            onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))}
          />
          <input
            type="number"
            placeholder="Unit price"
            aria-label={`Item ${idx + 1} price`}
            value={item.unit_price}
            onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
          />
        </div>
      ))}
      <p data-testid="invoice-total">Total: {total.toFixed(2)}</p>
      <button type="submit">Create Invoice</button>
    </form>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Finance Invoice flow', () => {
  it('create invoice form renders customer field and line items', () => {
    render(<InvoiceForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/customer name/i)).toBeInTheDocument()
    expect(screen.getByTestId('line-item')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create invoice/i })).toBeInTheDocument()
  })

  it('invoice total calculated from line item qty and price', () => {
    render(<InvoiceForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/item 1 qty/i), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/item 1 price/i), { target: { value: '100' } })
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('300.00')
  })

  it('status badge shows correct color class per status', () => {
    const statuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled']
    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} />)
      const badge = screen.getByTestId('status-badge')
      expect(badge).toHaveClass(STATUS_COLORS[status])
      expect(badge).toHaveTextContent(status.charAt(0).toUpperCase() + status.slice(1))
      unmount()
    })
  })
})
