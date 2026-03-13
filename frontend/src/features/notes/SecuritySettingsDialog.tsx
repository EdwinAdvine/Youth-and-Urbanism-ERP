import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface SensitivityLabel {
  id: string
  name: string
  level: number
  color: string
  restrictions: string
}

interface LabelsResponse {
  labels: SensitivityLabel[]
}

interface NoteData {
  id: string
  title: string
  retention_policy?: string
  sensitivity_label_id?: string
}

interface SecuritySettingsDialogProps {
  noteId: string
  currentLabelId?: string
  onClose: () => void
}

export default function SecuritySettingsDialog({ noteId, currentLabelId, onClose }: SecuritySettingsDialogProps) {
  const qc = useQueryClient()
  const [selectedLabelId, setSelectedLabelId] = useState(currentLabelId ?? '')
  const [saved, setSaved] = useState(false)

  const labelsQuery = useQuery<LabelsResponse>({
    queryKey: ['notes', 'security', 'labels'],
    queryFn: async () => {
      const { data } = await apiClient.get<LabelsResponse>('/notes/security/labels')
      return data
    },
  })

  const noteQuery = useQuery<NoteData>({
    queryKey: ['notes', noteId],
    queryFn: async () => {
      const { data } = await apiClient.get<NoteData>(`/notes/${noteId}`)
      return data
    },
    enabled: !!noteId,
  })

  const saveMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const { data } = await apiClient.put(`/notes/${noteId}/security`, {
        sensitivity_label_id: labelId,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', noteId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const labels = labelsQuery.data?.labels ?? []

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5L12 1z" stroke="#51459d" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>Security Settings</h2>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">×</button>
        </div>

        {/* Sensitivity Labels */}
        <div style={{ marginBottom: 20 }}>
          <div style={sectionLabelStyle}>Sensitivity Label</div>

          {labelsQuery.isLoading && (
            <div style={{ padding: '16px 0', color: '#6b7280', fontSize: 13 }}>Loading labels...</div>
          )}

          {labelsQuery.isError && (
            <div style={{ padding: '10px', background: '#fff0f3', borderRadius: 8, color: '#ff3a6e', fontSize: 13 }}>
              Failed to load labels.
            </div>
          )}

          {!labelsQuery.isLoading && labels.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {labels.map((label) => (
                <label
                  key={label.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    border: `1.5px solid ${selectedLabelId === label.id ? label.color : '#e5e7eb'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedLabelId === label.id ? `${label.color}12` : '#fff',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="sensitivity"
                    value={label.id}
                    checked={selectedLabelId === label.id}
                    onChange={() => setSelectedLabelId(label.id)}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: label.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{label.name}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: '#fff',
                        background: label.color,
                        borderRadius: 4,
                        padding: '1px 6px',
                        fontWeight: 600,
                      }}
                    >
                      Level {label.level}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label.restrictions}</div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Retention Policy */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabelStyle}>Retention Policy</div>
          <div
            style={{
              padding: '10px 14px',
              background: '#f3f4f6',
              borderRadius: 8,
              fontSize: 13,
              color: '#374151',
              fontStyle: noteQuery.data?.retention_policy ? 'normal' : 'italic',
            }}
          >
            {noteQuery.isLoading
              ? 'Loading...'
              : noteQuery.data?.retention_policy ?? 'No retention policy set'}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Retention policies are managed at the organization level.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={() => saveMutation.mutate(selectedLabelId)}
            disabled={!selectedLabelId || saveMutation.isPending}
            style={{
              ...saveBtnStyle,
              opacity: !selectedLabelId || saveMutation.isPending ? 0.7 : 1,
              cursor: !selectedLabelId || saveMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {saveMutation.isPending ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>

        {saveMutation.isError && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#ff3a6e', textAlign: 'center' }}>
            Failed to save. Please try again.
          </div>
        )}
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'Open Sans, sans-serif',
}

const dialogStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: 24,
  width: '100%',
  maxWidth: 448,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  maxHeight: '90vh',
  overflowY: 'auto',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 22,
  cursor: 'pointer',
  color: '#9ca3af',
  lineHeight: 1,
  padding: 0,
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 10,
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontFamily: 'Open Sans, sans-serif',
  color: '#374151',
}

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#51459d',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'Open Sans, sans-serif',
}
