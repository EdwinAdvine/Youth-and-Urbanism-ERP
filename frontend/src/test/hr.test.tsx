/**
 * HR Leave request tests — form rendering, submission confirmation, leave balance display.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── inline components ─────────────────────────────────────────────────────────

interface LeaveBalance { annual: number; sick: number; used: number }

function LeaveBalanceCard({ balance }: { balance: LeaveBalance }) {
  return (
    <div data-testid="leave-balance">
      <span data-testid="annual-balance">Annual: {balance.annual} days</span>
      <span data-testid="sick-balance">Sick: {balance.sick} days</span>
      <span data-testid="used-balance">Used: {balance.used} days</span>
    </div>
  )
}

function LeaveRequestForm({ onSubmit }: { onSubmit: (data: Record<string, string>) => Promise<void> }) {
  const [submitted, setSubmitted] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await onSubmit(Object.fromEntries(fd.entries()) as Record<string, string>)
    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return <p data-testid="confirmation">Leave request submitted successfully.</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Start date
        <input name="start_date" type="date" aria-label="Start date" />
      </label>
      <label>
        End date
        <input name="end_date" type="date" aria-label="End date" />
      </label>
      <select name="leave_type" aria-label="Leave type">
        <option value="annual">Annual</option>
        <option value="sick">Sick</option>
        <option value="unpaid">Unpaid</option>
      </select>
      <textarea name="reason" placeholder="Reason (optional)" aria-label="Reason" />
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit Request'}
      </button>
    </form>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('HR Leave request', () => {
  it('leave request form renders date pickers and leave type selector', () => {
    render(<LeaveRequestForm onSubmit={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/leave type/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument()
  })

  it('submitting leave request shows confirmation message', async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined)
    render(<LeaveRequestForm onSubmit={mockSubmit} />)

    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-04-05' } })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() =>
      expect(screen.getByTestId('confirmation')).toBeInTheDocument()
    )
    expect(mockSubmit).toHaveBeenCalledOnce()
  })

  it('leave balance card displays annual, sick and used days', () => {
    const balance: LeaveBalance = { annual: 21, sick: 10, used: 5 }
    render(<LeaveBalanceCard balance={balance} />)
    expect(screen.getByTestId('annual-balance')).toHaveTextContent('21 days')
    expect(screen.getByTestId('sick-balance')).toHaveTextContent('10 days')
    expect(screen.getByTestId('used-balance')).toHaveTextContent('5 days')
  })
})
