import { useState, useRef, useEffect } from 'react'
import { Button, Input, toast } from '../../components/ui'
import { useAddTimeLog } from '../../api/projects'

interface TimeLogEntryProps {
  projectId: string
  taskId: string
  taskTitle: string
  onClose?: () => void
}

export default function TimeLogEntry({ projectId, taskId, taskTitle, onClose }: TimeLogEntryProps) {
  const addTimeLog = useAddTimeLog()

  // Manual entry
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')

  // Timer
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function startTimer() {
    startTimeRef.current = Date.now() - elapsedSeconds * 1000
    setIsRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }

  function pauseTimer() {
    setIsRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  function resetTimer() {
    setIsRunning(false)
    setElapsedSeconds(0)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  async function logTimerHours() {
    if (elapsedSeconds < 60) {
      toast('warning', 'Timer must run for at least 1 minute')
      return
    }
    const timerHours = parseFloat((elapsedSeconds / 3600).toFixed(2))
    try {
      await addTimeLog.mutateAsync({
        project_id: projectId,
        task_id: taskId,
        hours: timerHours,
        description: description || `Timer log for "${taskTitle}"`,
      })
      toast('success', `Logged ${timerHours}h`)
      resetTimer()
      setDescription('')
      onClose?.()
    } catch {
      toast('error', 'Failed to log time')
    }
  }

  async function handleManualLog() {
    const h = parseFloat(hours)
    if (!h || h <= 0) {
      toast('warning', 'Enter valid hours')
      return
    }
    try {
      await addTimeLog.mutateAsync({
        project_id: projectId,
        task_id: taskId,
        hours: h,
        description: description || undefined,
      })
      toast('success', `Logged ${h}h`)
      setHours('')
      setDescription('')
      onClose?.()
    } catch {
      toast('error', 'Failed to log time')
    }
  }

  const timerDisplay = formatTimer(elapsedSeconds)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Log time for: <span className="font-medium text-gray-900 dark:text-gray-100">{taskTitle}</span>
      </p>

      {/* Timer */}
      <div className="bg-gray-50 dark:bg-gray-950 rounded-[10px] p-4 text-center">
        <p className="text-3xl font-mono font-bold text-gray-900 dark:text-gray-100 mb-3">{timerDisplay}</p>
        <div className="flex items-center justify-center gap-2">
          {!isRunning ? (
            <Button size="sm" onClick={startTimer}>
              {elapsedSeconds > 0 ? 'Resume' : 'Start Timer'}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={pauseTimer}>Pause</Button>
          )}
          {elapsedSeconds > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={resetTimer}>Reset</Button>
              <Button size="sm" onClick={logTimerHours} loading={addTimeLog.isPending} disabled={isRunning}>
                Log Time
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Manual entry */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Or enter manually</p>
        <div className="flex items-end gap-3">
          <div className="w-24">
            <Input label="Hours" type="number" step="0.25" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1.5" />
          </div>
          <div className="flex-1">
            <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you work on?" />
          </div>
          <Button size="sm" onClick={handleManualLog} loading={addTimeLog.isPending}>Log</Button>
        </div>
      </div>
    </div>
  )
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
