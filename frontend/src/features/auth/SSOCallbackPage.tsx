import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { meRequest } from '../../api/auth'
import apiClient from '../../api/client'
import { getPostLoginRoute } from '../../utils/getPostLoginRoute'

export default function SSOCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [firstName, setFirstName] = useState<string>('')

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const fullName = searchParams.get('name') || ''
    const errorParam = searchParams.get('error')

    if (errorParam || !accessToken || !refreshToken) {
      navigate('/login?error=sso_failed', { replace: true })
      return
    }

    setFirstName(fullName.split(' ')[0] || '')

    // Inject the token so meRequest can authenticate
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`

    const finish = async () => {
      try {
        const user = await meRequest()
        setAuth(user, accessToken, refreshToken)
        setTimeout(() => {
          navigate(getPostLoginRoute(user), { replace: true })
        }, 1600)
      } catch {
        navigate('/login?error=sso_failed', { replace: true })
      }
    }

    finish()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#51459d] via-[#3d3480] to-[#2a2560] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl shadow-lg mb-4">
            <span className="text-primary font-black text-2xl">Y</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Urban Vibes Dynamics</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-5">
          {/* Microsoft logo */}
          <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <svg className="w-8 h-8" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          </div>

          {/* Animated checkmark + greeting */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#51459d] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {firstName ? `Welcome, ${firstName}!` : 'Signing you in…'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {firstName
                ? 'Microsoft sign-in successful. Setting up your session…'
                : 'Verifying your Microsoft account…'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
