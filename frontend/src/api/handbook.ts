/**
 * Handbook API client — user handbook articles, categories, and search.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/handbook`.
 *
 * Key exports:
 *   - useHandbookCategories()  — nested category tree (with article counts)
 *   - useHandbookArticles()    — list articles filtered by category, status, or module
 *   - useHandbookArticle()     — fetch a single article by ID or slug
 *   - useCreateArticle()       — create a new handbook article (draft or published)
 *   - useUpdateArticle()       — update article content, status, or category
 *   - useDeleteArticle()       — permanently remove an article
 *   - useHandbookSearch()      — full-text search across all published articles
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HandbookCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parent_id: string | null
  sort_order: number
  module: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  children?: HandbookCategory[]
  article_count?: number
}

export interface HandbookArticle {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category_id: string | null
  author_id: string
  status: 'draft' | 'published' | 'archived'
  article_type: 'guide' | 'quickstart' | 'faq' | 'release_note' | 'pro_tip'
  module: string | null
  tags: string[] | null
  sort_order: number
  featured_image_url: string | null
  video_url: string | null
  ai_shortcut_prompt: string | null
  estimated_read_time: number | null
  view_count: number
  helpful_count: number
  not_helpful_count: number
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface HandbookArticleDetail extends HandbookArticle {
  content_markdown: string
  content_html: string | null
  category: HandbookCategory | null
}

export interface HandbookFeedback {
  id: string
  article_id: string
  user_id: string
  is_helpful: boolean
  comment: string | null
  created_at: string
}

export interface HandbookProgress {
  read_article_ids: string[]
  total_read: number
  total_published: number
  completion_pct: number
}

export interface HandbookAnalytics {
  period_days: number
  status_counts: Record<string, number>
  total_views: number
  total_feedback: number
  most_viewed: HandbookArticle[]
  most_helpful: HandbookArticle[]
  least_helpful: HandbookArticle[]
}

export interface ArticleAnalytics {
  article: HandbookArticle
  period_days: number
  views_in_period: number
  unique_viewers: number
  total_views: number
  helpful_count: number
  not_helpful_count: number
  total_completions: number
  feedback: HandbookFeedback[]
}

interface ArticleListParams {
  page?: number
  limit?: number
  category?: string
  module?: string
  tag?: string
  article_type?: string
}

interface CreateCategoryPayload {
  name: string
  slug: string
  description?: string
  icon?: string
  parent_id?: string
  sort_order?: number
  module?: string
  is_active?: boolean
}

interface UpdateCategoryPayload extends Partial<CreateCategoryPayload> {
  id: string
}

interface CreateArticlePayload {
  title: string
  slug: string
  content_markdown?: string
  content_html?: string
  excerpt?: string
  category_id?: string
  status?: string
  article_type?: string
  module?: string
  tags?: string[]
  sort_order?: number
  featured_image_url?: string
  video_url?: string
  ai_shortcut_prompt?: string
  estimated_read_time?: number
  is_pinned?: boolean
}

interface UpdateArticlePayload extends Partial<CreateArticlePayload> {
  id: string
}

// ─── API Functions ───────────────────────────────────────────────────────────

const handbookApi = {
  // Public
  listCategories: () =>
    apiClient.get<HandbookCategory[]>('/handbook/categories').then((r) => r.data),
  getCategory: (slug: string, page = 1, limit = 20) =>
    apiClient.get<{ category: HandbookCategory; total: number; articles: HandbookArticle[] }>(
      `/handbook/categories/${slug}`, { params: { page, limit } }
    ).then((r) => r.data),
  listArticles: (params: ArticleListParams = {}) =>
    apiClient.get<{ total: number; articles: HandbookArticle[] }>(
      '/handbook/articles', { params }
    ).then((r) => r.data),
  getArticle: (slug: string) =>
    apiClient.get<HandbookArticleDetail>(`/handbook/articles/${slug}`).then((r) => r.data),
  getRelated: (id: string, limit = 5) =>
    apiClient.get<HandbookArticle[]>(`/handbook/articles/${id}/related`, { params: { limit } }).then((r) => r.data),
  search: (q: string, module?: string, page = 1, limit = 20) =>
    apiClient.get<{ total: number; query: string; articles: HandbookArticle[] }>(
      '/handbook/search', { params: { q, module, page, limit } }
    ).then((r) => r.data),
  submitFeedback: (articleId: string, data: { is_helpful: boolean; comment?: string }) =>
    apiClient.post<HandbookFeedback>(`/handbook/articles/${articleId}/feedback`, data).then((r) => r.data),
  markRead: (articleId: string) =>
    apiClient.post<{ status: string }>(`/handbook/articles/${articleId}/mark-read`).then((r) => r.data),
  unmarkRead: (articleId: string) =>
    apiClient.delete(`/handbook/articles/${articleId}/mark-read`),
  getProgress: () =>
    apiClient.get<HandbookProgress>('/handbook/progress').then((r) => r.data),
  gettingStarted: () =>
    apiClient.get<HandbookArticle[]>('/handbook/getting-started').then((r) => r.data),

  // Admin
  adminCreateCategory: (data: CreateCategoryPayload) =>
    apiClient.post<HandbookCategory>('/handbook/admin/categories', data).then((r) => r.data),
  adminUpdateCategory: (id: string, data: Partial<CreateCategoryPayload>) =>
    apiClient.put<HandbookCategory>(`/handbook/admin/categories/${id}`, data).then((r) => r.data),
  adminDeleteCategory: (id: string) =>
    apiClient.delete(`/handbook/admin/categories/${id}`),
  adminReorderCategories: (items: { id: string; sort_order: number }[]) =>
    apiClient.put('/handbook/admin/categories/reorder', { items }).then((r) => r.data),
  adminCreateArticle: (data: CreateArticlePayload) =>
    apiClient.post<HandbookArticle>('/handbook/admin/articles', data).then((r) => r.data),
  adminUpdateArticle: (id: string, data: Partial<CreateArticlePayload>) =>
    apiClient.put<HandbookArticle>(`/handbook/admin/articles/${id}`, data).then((r) => r.data),
  adminDeleteArticle: (id: string) =>
    apiClient.delete(`/handbook/admin/articles/${id}`),
  adminReorderArticles: (items: { id: string; sort_order: number }[]) =>
    apiClient.put('/handbook/admin/articles/reorder', { items }).then((r) => r.data),
  adminPublishArticle: (id: string) =>
    apiClient.post<HandbookArticle>(`/handbook/admin/articles/${id}/publish`).then((r) => r.data),
  adminArchiveArticle: (id: string) =>
    apiClient.post<HandbookArticle>(`/handbook/admin/articles/${id}/archive`).then((r) => r.data),
  adminUploadMedia: (articleId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<{ url: string; object_name: string }>(
      `/handbook/admin/articles/${articleId}/upload-media`, form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then((r) => r.data)
  },
  adminAnalytics: (days = 30) =>
    apiClient.get<HandbookAnalytics>('/handbook/admin/analytics', { params: { days } }).then((r) => r.data),
  adminArticleAnalytics: (id: string, days = 30) =>
    apiClient.get<ArticleAnalytics>(`/handbook/admin/analytics/articles/${id}`, { params: { days } }).then((r) => r.data),
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const keys = {
  all: ['handbook'] as const,
  categories: ['handbook', 'categories'] as const,
  category: (slug: string) => ['handbook', 'category', slug] as const,
  articles: (params?: ArticleListParams) => ['handbook', 'articles', params] as const,
  article: (slug: string) => ['handbook', 'article', slug] as const,
  related: (id: string) => ['handbook', 'related', id] as const,
  search: (q: string, module?: string) => ['handbook', 'search', q, module] as const,
  progress: ['handbook', 'progress'] as const,
  gettingStarted: ['handbook', 'getting-started'] as const,
  adminAnalytics: (days: number) => ['handbook', 'admin', 'analytics', days] as const,
  adminArticleAnalytics: (id: string, days: number) => ['handbook', 'admin', 'analytics', id, days] as const,
}

// ─── Public Hooks ────────────────────────────────────────────────────────────

export function useHandbookCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: handbookApi.listCategories })
}

export function useHandbookCategory(slug: string) {
  return useQuery({
    queryKey: keys.category(slug),
    queryFn: () => handbookApi.getCategory(slug),
    enabled: !!slug,
  })
}

export function useHandbookArticles(params: ArticleListParams = {}) {
  return useQuery({
    queryKey: keys.articles(params),
    queryFn: () => handbookApi.listArticles(params),
  })
}

export function useHandbookArticle(slug: string) {
  return useQuery({
    queryKey: keys.article(slug),
    queryFn: () => handbookApi.getArticle(slug),
    enabled: !!slug,
  })
}

export function useRelatedArticles(id: string) {
  return useQuery({
    queryKey: keys.related(id),
    queryFn: () => handbookApi.getRelated(id),
    enabled: !!id,
  })
}

export function useHandbookSearch(q: string, module?: string) {
  return useQuery({
    queryKey: keys.search(q, module),
    queryFn: () => handbookApi.search(q, module),
    enabled: q.trim().length >= 1,
  })
}

export function useHandbookProgress() {
  return useQuery({ queryKey: keys.progress, queryFn: handbookApi.getProgress })
}

export function useGettingStarted() {
  return useQuery({ queryKey: keys.gettingStarted, queryFn: handbookApi.gettingStarted })
}

export function useSubmitFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ articleId, ...data }: { articleId: string; is_helpful: boolean; comment?: string }) =>
      handbookApi.submitFeedback(articleId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useMarkArticleRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.progress }),
  })
}

export function useUnmarkArticleRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.unmarkRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.progress }),
  })
}

// ─── Admin Hooks ─────────────────────────────────────────────────────────────

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.adminCreateCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCategoryPayload) => handbookApi.adminUpdateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.adminDeleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  })
}

export function useCreateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.adminCreateArticle,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateArticlePayload) => handbookApi.adminUpdateArticle(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.adminDeleteArticle,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function usePublishArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.adminPublishArticle,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useArchiveArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: handbookApi.adminArchiveArticle,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUploadMedia() {
  return useMutation({
    mutationFn: ({ articleId, file }: { articleId: string; file: File }) =>
      handbookApi.adminUploadMedia(articleId, file),
  })
}

export function useHandbookAnalytics(days = 30) {
  return useQuery({
    queryKey: keys.adminAnalytics(days),
    queryFn: () => handbookApi.adminAnalytics(days),
  })
}

export function useArticleAnalytics(id: string, days = 30) {
  return useQuery({
    queryKey: keys.adminArticleAnalytics(id, days),
    queryFn: () => handbookApi.adminArticleAnalytics(id, days),
    enabled: !!id,
  })
}

export { handbookApi }
