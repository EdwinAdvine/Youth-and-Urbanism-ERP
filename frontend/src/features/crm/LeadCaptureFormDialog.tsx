import { useState } from 'react'
import { Button, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useCreateLeadCaptureForm } from '../../api/crm'

interface Props {
  open: boolean
  onClose: () => void
}

export default function LeadCaptureFormDialog({ open, onClose }: Props) {
  const mutation = useCreateLeadCaptureForm()
  const [formName, setFormName] = useState('')
  const [lastCreated, setLastCreated] = useState<{ id: string; form_url: string } | null>(null)

  const reset = () => {
    setFormName('')
    setLastCreated(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    try {
      const result = await mutation.mutateAsync({ form_name: formName.trim() })
      toast('success', `Lead capture form "${result.title}" created`)
      setLastCreated({ id: result.id, form_url: result.form_url })
    } catch {
      toast('error', 'Failed to create lead capture form')
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Lead Capture Form" size="md">
      {lastCreated ? (
        <div className="space-y-4">
          <div className="rounded-[10px] bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-medium text-green-800">Lead capture form created successfully.</p>
            <p className="text-xs text-green-700 mt-1">
              Form submissions will automatically create CRM leads with contact details.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Form URL:</span>
              <p className="font-mono text-xs bg-gray-50 dark:bg-gray-950 rounded px-2 py-1 mt-1 break-all">
                {lastCreated.form_url}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Default fields: Full Name, Email, Phone, Company, Message.
              Submissions auto-create leads + contacts in CRM.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Form Name"
            required
            placeholder="e.g. Website Contact Form"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            This creates a published form with standard lead capture fields (Name, Email, Phone, Company, Message).
            When submitted, it will automatically create a CRM lead and contact.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Create Form
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
