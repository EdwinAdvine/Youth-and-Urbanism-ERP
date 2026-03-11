import { useState, useEffect } from 'react'
import { Button, Input, Card, Badge, Spinner, toast } from '../../components/ui'
import { useProfile, useUpdateProfile, useChangePassword, useProfileActivity } from '../../api/profile'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${Math.floor(diffMonths / 12)}y ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function moduleIcon(module: string): string {
  const icons: Record<string, string> = {
    mail: '📧',
    calendar: '📅',
    finance: '💰',
    hr: '👥',
    crm: '🤝',
    projects: '📋',
    inventory: '📦',
  }
  return icons[module?.toLowerCase()] ?? '📌'
}

function roleBadgeVariant(role: string): 'primary' | 'warning' | 'success' | 'info' | 'default' {
  const map: Record<string, 'primary' | 'warning' | 'success' | 'info' | 'default'> = {
    superadmin: 'primary',
    admin: 'warning',
    user: 'default',
  }
  return map[role] ?? 'default'
}

// ─── Personal Info Card ───────────────────────────────────────────────────────

function PersonalInfoCard() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    if (profile) setFullName(profile.full_name)
  }, [profile])

  const handleSave = () => {
    updateProfile.mutate(
      { full_name: fullName },
      {
        onSuccess: () => toast('success', 'Profile updated successfully'),
        onError: () => toast('error', 'Failed to update profile'),
      }
    )
  }

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      </Card>
    )
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U'

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Personal Information</h2>
      <div className="flex items-start gap-5 mb-6">
        {/* Avatar */}
        <div className="shrink-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{profile?.full_name}</p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{profile?.email}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant={roleBadgeVariant(profile?.role ?? '')} className="capitalize">
              {profile?.role}
            </Badge>
            {profile?.is_active && <Badge variant="success">Active</Badge>}
          </div>
          {profile?.created_at && (
            <p className="text-xs text-gray-400 mt-2">
              Member since {formatDate(profile.created_at)}
            </p>
          )}
          {profile?.last_login && (
            <p className="text-xs text-gray-400">
              Last login {timeAgo(profile.last_login)}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 max-w-md">
        <Input
          label="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
        />
        <Input
          label="Email Address"
          value={profile?.email ?? ''}
          readOnly
          disabled
          className="bg-gray-50 dark:bg-gray-950 cursor-not-allowed opacity-70"
        />
        <Button
          onClick={handleSave}
          loading={updateProfile.isPending}
          disabled={updateProfile.isPending || fullName === profile?.full_name}
        >
          Save Changes
        </Button>
      </div>
    </Card>
  )
}

// ─── Password Card ────────────────────────────────────────────────────────────

function PasswordCard() {
  const changePassword = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({})

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (newPassword.length < 8) {
      errs.newPassword = 'Password must be at least 8 characters'
    }
    if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    changePassword.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          toast('success', 'Password changed successfully')
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
          setErrors({})
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status
          if (status === 400 || status === 401) {
            toast('error', 'Current password is incorrect')
          } else {
            toast('error', 'Failed to change password')
          }
        },
      }
    )
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <Input
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
          required
          autoComplete="current-password"
        />
        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          required
          minLength={8}
          error={errors.newPassword}
          autoComplete="new-password"
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat new password"
          required
          error={errors.confirmPassword}
          autoComplete="new-password"
        />
        <Button
          type="submit"
          loading={changePassword.isPending}
          disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
        >
          Update Password
        </Button>
      </form>
    </Card>
  )
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard() {
  const { data: activities, isLoading } = useProfileActivity()

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-5">Recent Activity</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">No recent activity</div>
      ) : (
        <div className="space-y-0 divide-y divide-gray-50">
          {activities.slice(0, 10).map((item) => (
            <div key={item.id} className="flex items-start gap-3 py-3">
              <span className="text-lg shrink-0 mt-0.5">{moduleIcon(item.module)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200">{item.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{timeAgo(item.created_at)}</span>
                  {item.module && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-500 capitalize">
                      {item.module}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your personal information and account security</p>
      </div>
      <PersonalInfoCard />
      <PasswordCard />
      <ActivityCard />
    </div>
  )
}
