import { useState } from 'react'
import { Button, Card, Modal, Input, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import { useSkillsMatrix, useCreateSkill } from '../../api/manufacturing_labor'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const proficiencyColors: Record<string, BadgeVariant> = {
  trainee: 'default',
  operator: 'info',
  senior: 'success',
  expert: 'primary',
}

export default function SkillsMatrixPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ employee_id: '', skill_name: '', proficiency_level: 'operator', expiry_date: '' })

  const { data: matrix, isLoading } = useSkillsMatrix()
  const createSkill = useCreateSkill()
  
  const handleAdd = async () => {
    if (!form.employee_id || !form.skill_name) return toast('error', 'Employee ID and skill required')
    try {
      await createSkill.mutateAsync({
        employee_id: form.employee_id,
        skill_name: form.skill_name,
        proficiency_level: form.proficiency_level,
        expiry_date: form.expiry_date || undefined,
      })
      toast('success', 'Skill added')
      setAddOpen(false)
      setForm({ employee_id: '', skill_name: '', proficiency_level: 'operator', expiry_date: '' })
    } catch {
      toast('error', 'Failed to add skill')
    }
  }

  const employees = Object.keys(matrix?.employees || {})
  const skills = matrix?.skills || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skills Matrix</h1>
        <Button onClick={() => setAddOpen(true)}>+ Add Skill</Button>
      </div>

      {isLoading && <Card className="p-8 text-center">Loading...</Card>}

      {!isLoading && employees.length === 0 && (
        <Card className="p-8 text-center text-gray-500">No skills recorded. Add operator skills to build the matrix.</Card>
      )}

      {employees.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-semibold">Employee</th>
                {skills.map(skill => (
                  <th key={skill} className="px-3 py-3 text-center font-medium text-xs text-gray-600 whitespace-nowrap">
                    {skill}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map(empId => (
                <tr key={empId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{empId.slice(0, 8)}...</td>
                  {skills.map(skill => {
                    const cellData = matrix?.employees[empId]?.[skill]
                    return (
                      <td key={skill} className="px-3 py-3 text-center">
                        {cellData ? (
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={proficiencyColors[cellData.proficiency_level] || 'default'} className="text-xs">
                              {cellData.proficiency_level.slice(0, 3).toUpperCase()}
                            </Badge>
                            {cellData.expiry_date && (
                              <div className="text-xs text-gray-400">{cellData.expiry_date}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Operator Skill">
        <div className="space-y-4">
          <Input label="Employee ID" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} placeholder="HR Employee UUID" />
          <Input label="Skill Name" value={form.skill_name} onChange={e => setForm({ ...form, skill_name: e.target.value })} placeholder="e.g. CNC Operation, Welding" />
          <div>
            <label className="text-sm font-medium">Proficiency Level</label>
            <select className="mt-1 block w-full border rounded px-3 py-2 text-sm" value={form.proficiency_level} onChange={e => setForm({ ...form, proficiency_level: e.target.value })}>
              {['trainee', 'operator', 'senior', 'expert'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <Input label="Certification Expiry" type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={createSkill.isPending}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
