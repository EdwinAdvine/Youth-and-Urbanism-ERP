export interface User {
  id: string
  email: string
  full_name: string
  is_superadmin: boolean
  role: 'superadmin' | 'admin' | 'user'
  app_admin_scopes: string[]
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

export interface AIConfig {
  provider: 'ollama' | 'openai' | 'anthropic' | 'grok'
  model: string
  api_key?: string
  ollama_url?: string
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
