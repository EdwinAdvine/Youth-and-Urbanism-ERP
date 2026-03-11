import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useSSOProviders,
  useCreateSSOProvider,
  useUpdateSSOProvider,
  useDeleteSSOProvider,
} from '../../api/sso'
import type { SSOProvider } from '../../api/sso'
import { Card, Button, Input, Select, Badge, Modal, Spinner } from '../../components/ui'

const providerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  provider_type: z.enum(['google', 'microsoft', 'github', 'custom_oidc']),
  client_id: z.string().min(1, 'Client ID is required'),
  client_secret: z.string().min(1, 'Client Secret is required'),
  authorization_url: z.string().url('Must be a valid URL'),
  token_url: z.string().url('Must be a valid URL'),
  userinfo_url: z.string().url('Must be a valid URL'),
  redirect_uri: z.string().url('Must be a valid URL'),
  scopes: z.string().optional(),
  is_active: z.boolean().optional(),
})

type ProviderForm = z.infer<typeof providerSchema>

const PROVIDER_TYPE_OPTIONS = [
  { value: 'google', label: 'Google' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'github', label: 'GitHub' },
  { value: 'custom_oidc', label: 'Custom OIDC' },
]

const PROVIDER_DEFAULTS: Record<string, Partial<ProviderForm>> = {
  google: {
    authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: 'openid email profile',
  },
  microsoft: {
    authorization_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfo_url: 'https://graph.microsoft.com/oidc/userinfo',
    scopes: 'openid email profile',
  },
  github: {
    authorization_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    userinfo_url: 'https://api.github.com/user',
    scopes: 'read:user user:email',
  },
  custom_oidc: {
    scopes: 'openid email profile',
  },
}

function providerIcon(type: string) {
  switch (type) {
    case 'google':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )
    case 'microsoft':
      return (
        <svg className="w-5 h-5" viewBox="0 0 23 23">
          <path fill="#f35325" d="M1 1h10v10H1z" />
          <path fill="#81bc06" d="M12 1h10v10H12z" />
          <path fill="#05a6f0" d="M1 12h10v10H1z" />
          <path fill="#ffba08" d="M12 12h10v10H12z" />
        </svg>
      )
    case 'github':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      )
    default:
      return (
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
  }
}

export default function SSOConfigPage() {
  const { data: providers, isLoading } = useSSOProviders()
  const createMutation = useCreateSSOProvider()
  const updateMutation = useUpdateSSOProvider()
  const deleteMutation = useDeleteSSOProvider()

  const [formOpen, setFormOpen] = useState(false)
  const [editProvider, setEditProvider] = useState<SSOProvider | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<SSOProvider | null>(null)

  const form = useForm<ProviderForm>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      scopes: 'openid email profile',
      is_active: true,
    },
  })

  const handleTypeChange = (type: string) => {
    const defaults = PROVIDER_DEFAULTS[type]
    if (defaults && !editProvider) {
      Object.entries(defaults).forEach(([key, val]) => {
        form.setValue(key as keyof ProviderForm, val as any)
      })
    }
  }

  const openCreate = () => {
    setEditProvider(null)
    form.reset({
      scopes: 'openid email profile',
      is_active: true,
    })
    setFormOpen(true)
  }

  const openEdit = (provider: SSOProvider) => {
    setEditProvider(provider)
    form.reset({
      name: provider.name,
      provider_type: provider.provider_type,
      client_id: provider.client_id,
      client_secret: '', // don't expose secret
      authorization_url: provider.authorization_url,
      token_url: provider.token_url,
      userinfo_url: provider.userinfo_url,
      redirect_uri: provider.redirect_uri,
      scopes: provider.scopes,
      is_active: provider.is_active,
    })
    setFormOpen(true)
  }

  const handleSubmit = async (data: ProviderForm) => {
    if (editProvider) {
      await updateMutation.mutateAsync({
        id: editProvider.id,
        ...data,
        client_secret: data.client_secret || undefined,
      })
    } else {
      await createMutation.mutateAsync(data)
    }
    setFormOpen(false)
    setEditProvider(null)
    form.reset()
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    await deleteMutation.mutateAsync(deleteConfirm.id)
    setDeleteConfirm(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SSO Configuration</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Configure Single Sign-On providers for OAuth2/OIDC authentication
          </p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Provider
        </Button>
      </div>

      {/* Providers List */}
      {!providers?.length ? (
        <Card>
          <div className="p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No SSO Providers</h3>
            <p className="text-gray-500 text-sm mt-1">Add an OAuth2/OIDC provider to enable single sign-on.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                    {providerIcon(provider.provider_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                      <Badge variant={provider.is_active ? 'success' : 'default'} className="capitalize">
                        {provider.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {provider.provider_type.replace('_', ' ')} &middot; Client ID: {provider.client_id.slice(0, 20)}...
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Callback: {provider.redirect_uri}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(provider)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-red-50"
                    onClick={() => setDeleteConfirm(provider)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditProvider(null) }}
        title={editProvider ? 'Edit SSO Provider' : 'Add SSO Provider'}
        size="lg"
      >
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Provider Name"
              placeholder="e.g. Google Workspace"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Select
              label="Provider Type"
              options={PROVIDER_TYPE_OPTIONS}
              error={form.formState.errors.provider_type?.message}
              {...form.register('provider_type', {
                onChange: (e) => handleTypeChange(e.target.value),
              })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Client ID"
              placeholder="Your OAuth2 client ID"
              error={form.formState.errors.client_id?.message}
              {...form.register('client_id')}
            />
            <Input
              label={editProvider ? 'Client Secret (leave blank to keep)' : 'Client Secret'}
              type="password"
              placeholder={editProvider ? 'Leave blank to keep current' : 'Your OAuth2 client secret'}
              error={form.formState.errors.client_secret?.message}
              {...form.register('client_secret')}
            />
          </div>

          <Input
            label="Authorization URL"
            placeholder="https://provider.com/oauth2/authorize"
            error={form.formState.errors.authorization_url?.message}
            {...form.register('authorization_url')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Token URL"
              placeholder="https://provider.com/oauth2/token"
              error={form.formState.errors.token_url?.message}
              {...form.register('token_url')}
            />
            <Input
              label="User Info URL"
              placeholder="https://provider.com/userinfo"
              error={form.formState.errors.userinfo_url?.message}
              {...form.register('userinfo_url')}
            />
          </div>

          <Input
            label="Redirect URI (Callback URL)"
            placeholder="http://localhost:3010/api/v1/sso/{provider_id}/callback"
            error={form.formState.errors.redirect_uri?.message}
            {...form.register('redirect_uri')}
          />

          <Input
            label="Scopes"
            placeholder="openid email profile"
            {...form.register('scopes')}
          />

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...form.register('is_active')} className="rounded border-gray-300 text-primary" />
            Active
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setFormOpen(false); setEditProvider(null) }}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editProvider ? 'Save Changes' : 'Create Provider'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete SSO Provider"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
            Users who signed in with this provider will need to use password login.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>
              Delete Provider
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
