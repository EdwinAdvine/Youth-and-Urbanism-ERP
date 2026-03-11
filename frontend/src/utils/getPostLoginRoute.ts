import type { User } from '../types'

export function getPostLoginRoute(user: User): string {
  if (!user.role) return '/'

  if (user.role === 'superadmin') return '/admin'

  if (user.role === 'admin') {
    if (user.app_admin_scopes?.length === 1) return `/${user.app_admin_scopes[0]}`
    if (user.app_admin_scopes?.length > 1) return '/admin/my-modules'
    return '/'
  }

  return '/'
}
