/**
 * Projects Board tests — kanban columns, task creation, task count badge.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'done'
interface Task { id: string; title: string; status: TaskStatus }

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
]

// ── inline components ─────────────────────────────────────────────────────────

function ProjectBoard({ initialTasks = [] }: { initialTasks?: Task[] }) {
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks)
  const [newTitle, setNewTitle] = React.useState('')

  const addTask = () => {
    if (!newTitle.trim()) return
    setTasks((prev) => [...prev, { id: `t-${Date.now()}`, title: newTitle.trim(), status: 'todo' }])
    setNewTitle('')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id)
          return (
            <div key={col.id} data-testid={`column-${col.id}`}>
              <h3>
                {col.label}
                <span data-testid={`badge-${col.id}`}>{colTasks.length}</span>
              </h3>
              {colTasks.map((t) => (
                <div key={t.id} data-testid="task-card">{t.title}</div>
              ))}
            </div>
          )
        })}
      </div>
      <input
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="New task title"
        aria-label="New task title"
      />
      <button onClick={addTask}>Add Task</button>
    </div>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Projects Board', () => {
  it('renders kanban columns for todo, in_progress and done', () => {
    render(<ProjectBoard />)
    expect(screen.getByTestId('column-todo')).toBeInTheDocument()
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('column-done')).toBeInTheDocument()
  })

  it('create task adds card to todo column', () => {
    render(<ProjectBoard />)
    fireEvent.change(screen.getByLabelText(/new task title/i), { target: { value: 'Build API' } })
    fireEvent.click(screen.getByRole('button', { name: /add task/i }))
    const todoCol = screen.getByTestId('column-todo')
    expect(todoCol).toHaveTextContent('Build API')
  })

  it('task count badge updates when task is added', () => {
    render(<ProjectBoard />)
    expect(screen.getByTestId('badge-todo')).toHaveTextContent('0')
    fireEvent.change(screen.getByLabelText(/new task title/i), { target: { value: 'Task A' } })
    fireEvent.click(screen.getByRole('button', { name: /add task/i }))
    expect(screen.getByTestId('badge-todo')).toHaveTextContent('1')
  })

  it('initial tasks are distributed to correct columns', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Done task', status: 'done' },
      { id: '2', title: 'WIP task', status: 'in_progress' },
    ]
    render(<ProjectBoard initialTasks={tasks} />)
    expect(screen.getByTestId('badge-done')).toHaveTextContent('1')
    expect(screen.getByTestId('badge-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('badge-todo')).toHaveTextContent('0')
  })

  it('empty title input is ignored and does not add a task', () => {
    render(<ProjectBoard />)
    fireEvent.click(screen.getByRole('button', { name: /add task/i }))
    expect(screen.getByTestId('badge-todo')).toHaveTextContent('0')
  })
})
