import { useState } from 'react'
import { Card, Table, Badge, Select } from '../../components/ui'
import { useExpiringCertifications } from '../../api/manufacturing_labor'

export default function CertificationTracker() {
  const [days, setDays] = useState(30)
  const { data: certs, isLoading } = useExpiringCertifications(days)

  const expired = certs?.filter(c => c.expired) || []
  const expiring = certs?.filter(c => !c.expired) || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Certification Tracker</h1>
        <Select value={String(days)} onChange={e => setDays(Number(e.target.value))} className="w-40">
          <option value="7">Next 7 Days</option>
          <option value="30">Next 30 Days</option>
          <option value="60">Next 60 Days</option>
          <option value="90">Next 90 Days</option>
        </Select>
      </div>

      {expired.length > 0 && (
        <Card className="border-red-200">
          <div className="px-4 py-3 border-b font-semibold text-red-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Expired ({expired.length})
          </div>
          <Table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Skill</th>
                <th>Level</th>
                <th>Expired On</th>
                <th>Cert #</th>
              </tr>
            </thead>
            <tbody>
              {expired.map(c => (
                <tr key={c.id} className="bg-red-50">
                  <td className="font-mono text-xs">{c.employee_id.slice(0, 8)}...</td>
                  <td className="font-medium">{c.skill_name}</td>
                  <td><Badge variant="red">{c.proficiency_level}</Badge></td>
                  <td className="text-red-600 font-medium">{c.expiry_date}</td>
                  <td className="text-xs text-gray-500">{c.certification_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <div className="px-4 py-3 border-b font-semibold text-orange-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          Expiring Within {days} Days ({expiring.length})
        </div>
        {isLoading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : expiring.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No certifications expiring in this window.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Skill</th>
                <th>Level</th>
                <th>Expiry Date</th>
                <th>Days Left</th>
                <th>Cert #</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.employee_id.slice(0, 8)}...</td>
                  <td className="font-medium">{c.skill_name}</td>
                  <td><Badge variant="yellow">{c.proficiency_level}</Badge></td>
                  <td className="text-sm">{c.expiry_date}</td>
                  <td>
                    <span className={`text-sm font-medium ${(c.days_until_expiry ?? 99) <= 7 ? 'text-red-600' : 'text-orange-500'}`}>
                      {c.days_until_expiry} days
                    </span>
                  </td>
                  <td className="text-xs text-gray-500">{c.certification_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
