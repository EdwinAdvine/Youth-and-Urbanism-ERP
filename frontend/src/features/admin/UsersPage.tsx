import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../../api/admin'
import { Card, Button, Input, Select, Badge, Table, Modal, Pagination } from '../../components/ui'
import type { User } from '../../types'

const createSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['superadmin', 'admin', 'user']),
})

const editSchema = createSchema.omit({ password: true }).extend({
  password: z.string().min(8).optional().or(z.literal('')),
  is_active: z.boolean(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
]

function roleVariant(role: string): 'primary' | 'info' | 'warning' | 'danger' | 'default' {
  const map: Record<string, 'primary' | 'info' | 'warning' | 'danger' | 'default'> = {
    superadmin: 'danger',
    admin: 'warning',
    user: 'primary',
  }
  return map[role] ?? 'default'
}

export default function UsersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  const { data, isLoading } = useUsers(page, search)
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()

  // Create form
  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  // Edit form
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  const handleCreate = async (data: CreateForm) => {
    await createMutation.mutateAsync(data)
    setCreateOpen(false)
    createForm.reset()
  }

  const handleEdit = async (data: EditForm) => {
    if (!editUser) return
    await updateMutation.mutateAsync({
      id: editUser.id,
      full_name: data.full_name,
      role: data.role,
      is_active: data.is_active,
    })
    setEditUser(null)
    editForm.reset()
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    await deleteMutation.mutateAsync(deleteUser.id)
    setDeleteUser(null)
  }

  const openEdit = (user: User) => {
    setEditUser(user)
    editForm.reset({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      password: '',
    })
  }

  const columns = [
    {
      key: 'full_name',
      label: 'Name',
      render: (user: User) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{user.full_name}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (user: User) => (
        <Badge variant={roleVariant(user.role)} className="capitalize">{user.role}</Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (user: User) => (
        <Badge variant={user.is_active ? 'success' : 'default'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (user: User) => (
        <span className="text-gray-500 text-sm">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (user: User) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/users/${user.id}/access`)}>
            Access
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-red-50" onClick={() => setDeleteUser(user)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage system users and permissions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New User
        </Button>
      </div>

      {/* Filters */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            className="max-w-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <Table
            columns={columns}
            data={data?.items ?? []}
            loading={isLoading}
            keyExtractor={(u) => u.id}
            emptyText="No users found"
          />
        </div>

        <Pagination
          page={page}
          pages={data?.pages ?? 1}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </Card>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create New User">
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="John Doe"
            error={createForm.formState.errors.full_name?.message}
            {...createForm.register('full_name')}
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@company.com"
            error={createForm.formState.errors.email?.message}
            {...createForm.register('email')}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            error={createForm.formState.errors.password?.message}
            {...createForm.register('password')}
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            error={createForm.formState.errors.role?.message}
            {...createForm.register('role')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create User</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
          <Input
            label="Full Name"
            error={editForm.formState.errors.full_name?.message}
            {...editForm.register('full_name')}
          />
          <Input
            label="Email"
            type="email"
            disabled
            {...editForm.register('email')}
          />
          <Input
            label="New Password (leave blank to keep)"
            type="password"
            placeholder="Leave blank to keep current"
            error={editForm.formState.errors.password?.message}
            {...editForm.register('password')}
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            {...editForm.register('role')}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...editForm.register('is_active')} className="rounded border-gray-300 text-primary" />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button type="submit" loading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteUser?.full_name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
