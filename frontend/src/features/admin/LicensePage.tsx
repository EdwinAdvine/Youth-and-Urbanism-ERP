import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useLicense,
  useLicenseStatus,
  useActivateLicense,
  useUpdateLicense,
} from '../../api/license'
import { Card, Button, Input, Select, Badge, Spinner } from '../../components/ui'

// ── Constants ────────────────────────────────────────────────────────────────

const LICENSE_TYPE_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'standard', label: 'Standard' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
]

const ALL_MODULES = [
  'mail',
  'docs',
  'drive',
  'calendar',
  'notes',
  'forms',
  'projects',
  'meetings',
  'finance',
  'hr',
  'crm',
  'inventory',
  'pos',
  'ecommerce',
  'analytics',
  'support',
  'manufacturing',
  'supplychain',
]

// ── Schema ───────────────────────────────────────────────────────────────────

const activateSchema = z.object({
  license_key: z.string().min(8, 'License key must be at least 8 characters'),
  license_type: z.enum(['trial', 'standard', 'professional', 'enterprise']),
  max_users: z.coerce.number().min(1, 'At least 1 user'),
  features: z.array(z.string()).default([]),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
})

type ActivateForm = z.infer<typeof activateSchema>

// ── Helpers ──────────────────────────────────────────────────────────────────

function typeVariant(type: string): 'default' | 'info' | 'warning' | 'primary' {
  const map: Record<string, 'default' | 'info' | 'warning' | 'primary'> = {
    trial: 'default',
    standard: 'info',
    professional: 'warning',
    enterprise: 'primary',
  }
  return map[type] ?? 'default'
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LicensePage() {
  const { data: license, isLoading: licLoading } = useLicense()
  const { data: licenseStatus, isLoading: statusLoading } = useLicenseStatus()
  const activateMutation = useActivateLicense()
  const updateMutation = useUpdateLicense()
  const [showForm, setShowForm] = useState(false)

  const form = useForm<ActivateForm>({
    resolver: zodResolver(activateSchema),
    defaultValues: {
      license_type: 'trial',
      max_users: 10,
      features: [],
    },
  })

  const selectedFeatures = form.watch('features') || []

  const toggleFeature = (mod: string) => {
    const current = form.getValues('features') || []
    if (current.includes(mod)) {
      form.setValue(
        'features',
        current.filter((f) => f !== mod),
        { shouldDirty: true }
      )
    } else {
      form.setValue('features', [...current, mod], { shouldDirty: true })
    }
  }

  const handleActivate = async (data: ActivateForm) => {
    await activateMutation.mutateAsync({
      license_key: data.license_key,
      license_type: data.license_type,
      max_users: data.max_users,
      features: data.features,
      expires_at: data.expires_at || null,
      notes: data.notes || null,
    })
    setShowForm(false)
    form.reset()
  }

  const handleToggle = async () => {
    if (!license) return
    await updateMutation.mutateAsync({ id: license.id, is_active: !license.is_active })
  }

  if (licLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const usagePercent =
    licenseStatus && licenseStatus.max_users > 0
      ? Math.round((licenseStatus.current_users / licenseStatus.max_users) * 100)
      : 0

  const isExpiringSoon =
    licenseStatus?.days_remaining !== null &&
    licenseStatus?.days_remaining !== undefined &&
    licenseStatus.days_remaining <= 30 &&
    licenseStatus.is_active

  const isExpired =
    licenseStatus?.days_remaining !== null &&
    licenseStatus?.days_remaining !== undefined &&
    licenseStatus.days_remaining <= 0

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">License Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            View and manage your Urban Vibes Dynamics license and subscription
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto">
          {showForm ? 'Cancel' : license ? 'Change License' : 'Activate License'}
        </Button>
      </div>

      {/* Warning banner — expired */}
      {isExpired && (
        <div
          className="rounded-[10px] border border-red-200 bg-red-50 px-5 py-4"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-semibold text-red-800">License Expired</p>
              <p className="text-sm text-red-600">
                Your license has expired. Please renew to continue using all features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning banner — expiring within 30 days */}
      {isExpiringSoon && !isExpired && (
        <div
          className="rounded-[10px] border border-yellow-200 bg-yellow-50 px-5 py-4"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-yellow-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-semibold text-yellow-800">License Expiring Soon</p>
              <p className="text-sm text-yellow-700">
                Your license expires in{' '}
                <span className="font-bold">{licenseStatus?.days_remaining}</span> day
                {licenseStatus?.days_remaining !== 1 ? 's' : ''}. Please renew to avoid
                service interruption.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* License status cards */}
      {license ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                License Type
              </p>
              <div className="mt-2">
                <Badge
                  variant={typeVariant(license.license_type)}
                  className="capitalize text-base px-3 py-1"
                >
                  {license.license_type}
                </Badge>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={license.is_active ? 'success' : 'danger'}>
                  {license.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggle}
                  loading={updateMutation.isPending}
                >
                  {license.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Expires
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {license.expires_at
                  ? new Date(license.expires_at).toLocaleDateString()
                  : 'Never'}
              </p>
              {licenseStatus?.days_remaining !== null &&
                licenseStatus?.days_remaining !== undefined && (
                  <p
                    className={`text-xs mt-1 ${ licenseStatus.days_remaining <= 30 ? 'text-red-500 font-medium' : 'text-gray-400' }`}
                  >
                    {licenseStatus.days_remaining} day
                    {licenseStatus.days_remaining !== 1 ? 's' : ''} remaining
                  </p>
                )}
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Users
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {licenseStatus?.current_users ?? 0} / {license.max_users}
              </p>
              <p className="text-xs text-gray-400 mt-1">{usagePercent}% capacity</p>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No License Activated</h3>
            <p className="text-gray-500 text-sm mt-1">
              Activate a license to enforce user limits and track your subscription.
            </p>
          </div>
        </Card>
      )}

      {/* User usage progress bar */}
      {licenseStatus && licenseStatus.max_users > 0 && (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">User Usage</p>
              <p className="text-sm text-gray-500">
                {licenseStatus.current_users} / {licenseStatus.max_users} users (
                {Math.max(0, licenseStatus.max_users - licenseStatus.current_users)}{' '}
                remaining)
              </p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${ usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-[#6fd943]' }`}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {usagePercent}% of licensed capacity used
            </p>
          </div>
        </Card>
      )}

      {/* Enabled features / modules list */}
      {license && license.features && license.features.length > 0 && (
        <Card>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Enabled Modules</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map((mod) => {
                const enabled = license.features.includes(mod)
                return (
                  <span
                    key={mod}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-sm font-medium ${ enabled ? 'bg-[#51459d]/10 text-[#51459d] border border-[#51459d]/20' : 'bg-gray-50 dark:bg-gray-950 text-gray-400 border border-gray-100 dark:border-gray-800' }`}
                  >
                    {enabled ? (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                    <span className="capitalize">{mod}</span>
                  </span>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* License key and details */}
      {license && (
        <Card>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">License Key</p>
              <code className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-[10px] text-sm font-mono">
                {license.license_key}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Issued</p>
              <p className="text-sm text-gray-500">
                {new Date(license.issued_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Max Users</p>
              <p className="text-sm text-gray-500">{license.max_users}</p>
            </div>
            {license.notes && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</p>
                <p className="text-sm text-gray-500">{license.notes}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Activate / Update form */}
      {showForm && (
        <Card>
          <div className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {license ? 'Activate New License' : 'Activate License'}
            </h3>
            <form onSubmit={form.handleSubmit(handleActivate)} className="space-y-4">
              <Input
                label="License Key"
                placeholder="URBAN-XXXX-XXXX-XXXX"
                error={form.formState.errors.license_key?.message}
                {...form.register('license_key')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="License Type"
                  options={LICENSE_TYPE_OPTIONS}
                  error={form.formState.errors.license_type?.message}
                  {...form.register('license_type')}
                />
                <Input
                  label="Max Users"
                  type="number"
                  min={1}
                  error={form.formState.errors.max_users?.message}
                  {...form.register('max_users')}
                />
              </div>
              <Input
                label="Expiration Date (optional)"
                type="datetime-local"
                {...form.register('expires_at')}
              />

              {/* Features multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enabled Modules
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {ALL_MODULES.map((mod) => {
                    const checked = selectedFeatures.includes(mod)
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleFeature(mod)}
                        className={`px-3 py-2 rounded-[10px] text-sm font-medium border transition-colors ${ checked ? 'bg-[#51459d] text-white border-[#51459d]' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#51459d]/40' }`}
                      >
                        <span className="capitalize">{mod}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      form.setValue('features', [...ALL_MODULES], { shouldDirty: true })
                    }
                    className="text-xs text-[#51459d] hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setValue('features', [], { shouldDirty: true })}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/40 focus:border-[#51459d]"
                  rows={3}
                  placeholder="Internal notes about this license..."
                  {...form.register('notes')}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={activateMutation.isPending}>
                  Activate License
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  )
}
