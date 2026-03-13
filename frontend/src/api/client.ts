/**
 * Axios client — shared HTTP instance with JWT auth and automatic token-refresh interceptors.
 *
 * This is the single Axios instance used by every API client in `src/api/`.
 * It is NOT a React hook — import the default export directly.
 *
 * Behaviour:
 *   - `baseURL` is set to `/api/v1` (proxied to the backend container in dev).
 *   - Request interceptor reads the JWT from the Zustand auth store and injects
 *     `Authorization: Bearer <token>` on every outgoing request.
 *   - Response interceptor detects HTTP 401, attempts a silent token refresh via
 *     `/auth/refresh`, retries the original request, and logs out on failure.
 *   - Concurrent 401s are queued and replayed after the single refresh completes.
 *
 * Default export: `apiClient` (Axios instance).
 */
import axios from 'axios'
import { useAuthStore } from '../store/auth'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401 with token refresh
let isRefreshing = false
let failedQueue: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token)
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken })
        const newToken = data.access_token
        useAuthStore.setState({ token: newToken, refreshToken: data.refresh_token || refreshToken })
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
