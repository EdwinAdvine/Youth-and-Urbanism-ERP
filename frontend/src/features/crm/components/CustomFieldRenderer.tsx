import { Input, Select, cn } from '@/components/ui'
import type { CustomFieldDefinition } from '@/api/crm_v2'

interface CustomFieldRendererProps {
  fields: CustomFieldDefinition[]
  values: Record<string, any>
  onChange: (fieldName: string, value: any) => void
  className?: string
  disabled?: boolean
}

export default function CustomFieldRenderer({
  fields,
  values,
  onChange,
  className,
  disabled = false,
}: CustomFieldRendererProps) {
  if (fields.length === 0) {
    return null
  }

  const sortedFields = [...fields].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <div className={cn('space-y-4', className)}>
      {sortedFields.map((field) => {
        const value = values[field.field_name]

        switch (field.field_type) {
          case 'text':
            return (
              <Input
                key={field.id}
                label={field.field_label}
                required={field.is_required}
                value={value ?? ''}
                onChange={(e) => onChange(field.field_name, e.target.value)}
                disabled={disabled}
                placeholder={field.default_value ?? undefined}
              />
            )

          case 'number':
            return (
              <Input
                key={field.id}
                label={field.field_label}
                type="number"
                required={field.is_required}
                value={value ?? ''}
                onChange={(e) => onChange(field.field_name, e.target.value ? parseFloat(e.target.value) : null)}
                disabled={disabled}
              />
            )

          case 'date':
            return (
              <Input
                key={field.id}
                label={field.field_label}
                type="date"
                required={field.is_required}
                value={value ?? ''}
                onChange={(e) => onChange(field.field_name, e.target.value || null)}
                disabled={disabled}
              />
            )

          case 'dropdown': {
            const choices: string[] = field.options?.choices ?? []
            return (
              <Select
                key={field.id}
                label={field.field_label}
                required={field.is_required}
                value={value ?? ''}
                onChange={(e) => onChange(field.field_name, e.target.value || null)}
                disabled={disabled}
                options={[
                  { value: '', label: `Select ${field.field_label}...` },
                  ...choices.map((c) => ({ value: c, label: c })),
                ]}
              />
            )
          }

          case 'boolean':
            return (
              <div key={field.id} className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => onChange(field.field_name, e.target.checked)}
                    disabled={disabled}
                    className="rounded"
                  />
                  {field.field_label}
                  {field.is_required && <span className="text-danger">*</span>}
                </label>
              </div>
            )

          case 'url':
            return (
              <Input
                key={field.id}
                label={field.field_label}
                type="url"
                required={field.is_required}
                value={value ?? ''}
                onChange={(e) => onChange(field.field_name, e.target.value)}
                disabled={disabled}
                placeholder="https://..."
              />
            )

          case 'email':
            return (
              <Input
                key={field.id}
                label={field.field_label}
                type="email"
                required={field.is_required}
                value={value ?? ''}
                onChange={(e) => onChange(field.field_name, e.target.value)}
                disabled={disabled}
                placeholder="name@example.com"
              />
            )

          default:
            return (
              <Input
                key={field.id}
                label={`${field.field_label} (${field.field_type})`}
                required={field.is_required}
                value={value ?? ''}
                onChange={(e) => onChange(field.field_name, e.target.value)}
                disabled={disabled}
              />
            )
        }
      })}
    </div>
  )
}
