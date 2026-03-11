import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { Button, Card, Spinner, toast } from '../../components/ui'

interface Backup {
  filename: string
  size_bytes: number
  last_modified: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export default function BackupsPage() {
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'backups'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ backups: Backup[] }>('/backups')
      return data.backups
    },
  })

  const createBackup = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/backups')
      return data
    },
    onSuccess: () => {
      toast('success', 'Backup created successfully')
      qc.invalidateQueries({ queryKey: ['admin', 'backups'] })
    },
    onError: () => toast('error', 'Failed to create backup'),
  })

  const deleteBackup = useMutation({
    mutationFn: async (filename: string) => {
      await apiClient.delete(`/backups/${filename}`)
    },
    onSuccess: () => {
      toast('success', 'Backup deleted')
      qc.invalidateQueries({ queryKey: ['admin', 'backups'] })
      setDeleting(null)
    },
    onError: () => {
      toast('error', 'Failed to delete backup')
      setDeleting(null)
    },
  })

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>

  const backups = data ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Database Backups</h1>
          <p className="text-sm text-gray-500 mt-1">Manage PostgreSQL backups stored in MinIO</p>
        </div>
        <Button onClick={() => createBackup.mutate()} loading={createBackup.isPending}>
          Create Backup
        </Button>
      </div>

      <Card className="p-5">
        {backups.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No backups found. Create your first backup above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500">
                  <th className="pb-2 pr-4">Filename</th>
                  <th className="pb-2 pr-4 text-right">Size</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2 pr-4 font-mono text-xs">{b.filename}</td>
                    <td className="py-2 pr-4 text-right">{formatBytes(b.size_bytes)}</td>
                    <td className="py-2 pr-4 text-gray-500">{formatDate(b.last_modified)}</td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (deleting === b.filename) {
                            deleteBackup.mutate(b.filename)
                          } else {
                            setDeleting(b.filename)
                            setTimeout(() => setDeleting(null), 3000)
                          }
                        }}
                        loading={deleteBackup.isPending && deleting === b.filename}
                      >
                        {deleting === b.filename ? 'Confirm Delete' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-blue-50 border-blue-100">
        <p className="text-sm text-blue-700">
          Automatic daily backups run at 2:00 AM UTC via Celery Beat.
          Retention: 7 daily, 4 weekly, 12 monthly backups.
        </p>
      </Card>
    </div>
  )
}
