import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLogin, useRegister, useVerifyMFA, isMFARequired } from '../../api/auth'
import { useSSOProviders } from '../../api/sso'
import { Button, Input } from '../../components/ui'
import { getPostLoginRoute } from '../../utils/getPostLoginRoute'
import SSOLoginButton from './SSOLoginButton'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().optional(),
})

const registerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type LoginFormData = z.infer<typeof loginSchema>
type RegisterFormData = z.infer<typeof registerSchema>

const mfaSchema = z.object({
  code: z.string().min(6, 'Enter the 6-digit code').max(8),
})
type MFAFormData = z.infer<typeof mfaSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()
  const verifyMFA = useVerifyMFA()
  const registerMutation = useRegister()
  const { data: ssoProviders } = useSSOProviders()
  const [showPassword, setShowPassword] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [searchParams] = useSearchParams()

  // Show error message when redirected back from a failed SSO attempt
  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'sso_not_registered') {
      setLoginError('Your Microsoft account is not registered in this organisation. Please ask your administrator to create your account first.')
    } else if (error === 'sso_failed') {
      setLoginError('Microsoft sign-in failed. Please try again or use email & password.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })
  const mfaForm = useForm<MFAFormData>({ resolver: zodResolver(mfaSchema) })

  const {
    register: registerLogin,
    handleSubmit,
    formState: { errors },
    setError,
  } = loginForm

  const isMFAStep = mfaToken !== null

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(null)
    try {
      const result = await login.mutateAsync({ email: data.email, password: data.password })
      if (isMFARequired(result)) {
        setMfaToken(result.mfa_token)
        return
      }
      navigate(getPostLoginRoute(result.user), { replace: true })
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: string } } })?.response
      let message: string
      if (resp?.status === 429) {
        message = 'Too many login attempts. Please wait a minute and try again.'
      } else if (resp?.status === 423) {
        message = resp?.data?.detail || 'Account temporarily locked. Please try again later.'
      } else {
        message = resp?.data?.detail || 'Invalid email or password'
      }
      setLoginError(message)
      setError('password', { message })
    }
  }

  const onMFASubmit = async (data: MFAFormData) => {
    if (!mfaToken) return
    try {
      const user = await verifyMFA.mutateAsync({ mfa_token: mfaToken, code: data.code })
      navigate(getPostLoginRoute(user), { replace: true })
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: string } } })?.response
      mfaForm.setError('code', { message: resp?.data?.detail || 'Invalid code. Please try again.' })
    }
  }

  const onRegisterSubmit = async (data: RegisterFormData) => {
    try {
      await registerMutation.mutateAsync({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      })
      navigate('/', { replace: true })
    } catch {
      registerForm.setError('email', { message: 'Registration failed. Email may already be in use.' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#51459d] via-[#3d3480] to-[#2a2560] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/3" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.webp" alt="Youth & Urbanism" className="h-16 object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">Urban Vibes Dynamics</h1>
          <p className="text-white/60 text-sm mt-1">Enterprise Resource Planning</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          {isMFAStep ? (
            <>
              <div className="mb-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-3">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Two-factor authentication</h2>
                <p className="text-gray-500 text-sm mt-1">Enter the 6-digit code from your authenticator app</p>
              </div>

              <form onSubmit={mfaForm.handleSubmit(onMFASubmit)} className="space-y-4">
                <div className="space-y-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    autoFocus
                    placeholder="000000"
                    className={`w-full rounded-[10px] border px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${mfaForm.formState.errors.code ? 'border-danger' : 'border-gray-200'}`}
                    {...mfaForm.register('code')}
                  />
                  {mfaForm.formState.errors.code && (
                    <p className="text-xs text-danger text-center">{mfaForm.formState.errors.code.message}</p>
                  )}
                </div>

                <Button type="submit" variant="primary" className="w-full" loading={verifyMFA.isPending}>
                  Verify
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-4">
                <button
                  type="button"
                  onClick={() => { setMfaToken(null); mfaForm.reset() }}
                  className="text-primary font-medium hover:underline"
                >
                  Back to sign in
                </button>
              </p>
            </>
          ) : !isRegistering ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Welcome back</h2>
                <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...registerLogin('email')}
                  leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                />

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={`w-full rounded-[10px] border pl-10 pr-10 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${errors.password ? 'border-danger' : 'border-gray-200'}`}
                      {...registerLogin('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input type="checkbox" {...registerLogin('remember')} className="rounded border-gray-300 text-primary focus:ring-primary" />
                    Remember me
                  </label>
                  <button type="button" className="text-sm text-primary hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>

                {loginError && (
                  <div className="bg-red-50 border border-red-200 rounded-[8px] px-3 py-2 text-sm text-red-700">
                    {loginError}
                  </div>
                )}

                <Button type="submit" variant="primary" className="w-full" loading={login.isPending}>
                  Sign in
                </Button>
              </form>

              {/* SSO Providers */}
              {ssoProviders && ssoProviders.length > 0 && (
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-white dark:bg-gray-800 text-gray-400">or continue with</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {ssoProviders.map((provider) => (
                      <SSOLoginButton
                        key={provider.id}
                        providerId={provider.id}
                        providerName={provider.name}
                        providerType={provider.provider_type}
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-center text-sm text-gray-500 mt-6">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="text-primary font-medium hover:underline"
                >
                  Sign up
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create account</h2>
                <p className="text-gray-500 text-sm mt-1">Sign up for a new account</p>
              </div>

              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <Input
                  label="Full name"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  error={registerForm.formState.errors.full_name?.message}
                  {...registerForm.register('full_name')}
                  leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                />

                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  error={registerForm.formState.errors.email?.message}
                  {...registerForm.register('email')}
                  leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                />

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`w-full rounded-[10px] border pl-10 pr-10 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${registerForm.formState.errors.password ? 'border-danger' : 'border-gray-200'}`}
                      {...registerForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-xs text-danger">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`w-full rounded-[10px] border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${registerForm.formState.errors.confirm_password ? 'border-danger' : 'border-gray-200'}`}
                    {...registerForm.register('confirm_password')}
                  />
                  {registerForm.formState.errors.confirm_password && (
                    <p className="text-xs text-danger">{registerForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>

                {registerMutation.error && (
                  <div className="bg-red-50 border border-red-200 rounded-[8px] px-3 py-2 text-sm text-red-700">
                    Registration failed. Please try again.
                  </div>
                )}

                <Button type="submit" variant="primary" className="w-full" loading={registerMutation.isPending}>
                  Create account
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Y&U Enterprise. All rights reserved.
        </p>
      </div>
    </div>
  )
}
