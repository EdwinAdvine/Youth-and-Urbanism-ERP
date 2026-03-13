import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const portalApi = axios.create({ baseURL: '/api/v1/support' })

export default function CustomerPortalLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await portalApi.post('/portal/login', { email, password })
      // Store the portal token separately from the internal user token
      localStorage.setItem('portal_token', data.token ?? data.access_token)
      localStorage.setItem('portal_customer_id', data.customer_id ?? '')
      localStorage.setItem('portal_customer_name', data.customer_name ?? email)
      navigate('/portal/tickets')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Invalid email or password'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4"
      style={{ fontFamily: 'Open Sans, sans-serif' }}
    >
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-[10px] bg-[#51459d] mb-4">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to view and manage your support tickets</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-md border border-gray-100 dark:border-gray-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div className="space-y-1">
              <label
                htmlFor="portal-email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email Address
              </label>
              <input
                id="portal-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label
                htmlFor="portal-password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <input
                id="portal-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] transition-colors"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-[10px] bg-[#ff3a6e]/10 border border-[#ff3a6e]/20 px-3 py-2">
                <svg className="h-4 w-4 text-[#ff3a6e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-[#ff3a6e]">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] bg-[#51459d] hover:bg-[#453990] text-white text-sm font-semibold py-2.5 px-4 transition-colors focus:outline-none focus:ring-2 focus:ring-[#51459d]/50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Need help?{' '}
          <a href="mailto:support@urban-vibes-dynamics.local" className="text-[#51459d] hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  )
}
