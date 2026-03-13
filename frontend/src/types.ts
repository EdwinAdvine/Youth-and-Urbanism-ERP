export interface User {
  id: string
  email: string
  full_name: string
  is_superadmin: boolean
  role: 'superadmin' | 'admin' | 'user'
  app_admin_scopes: string[]
  app_access: string[]       // apps this user has explicit access to (empty = no restrictions)
  permissions: string[]      // all resolved permission names via assigned roles
  is_active: boolean
  avatar_url?: string
  created_at: string
  last_login?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface AuditLog {
  id: string
  user_id: string
  user_email: string
  action: string
  resource: string
  resource_id?: string
  details?: Record<string, unknown>
  ip_address?: string
  created_at: string
}

// General admin audit log (new)
export interface GeneralAuditLog {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata_: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  app_scope: string | null
  is_system: boolean
  created_at: string
}

export interface Permission {
  id: string
  name: string
  description: string | null
  app_scope: string | null
  created_at: string
}

export interface AppAccessEntry {
  app_name: string
  granted: boolean
}

export interface AppAdmin {
  id: string
  user_id: string
  app_name: string
  granted_by: string | null
  granted_at: string
}

export interface AIConfig {
  provider: string
  model: string
  api_key?: string
  base_url?: string
}

export interface AdminStats {
  total_users: number
  active_sessions: number
  ai_requests_today: number
  modules_online: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface APIError {
  detail: string
}
