import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStorefrontLogin, useStorefrontRegister } from '../../api/storefront'

export default function CustomerAuthPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const login = useStorefrontLogin(storeSlug!)
  const register = useStorefrontRegister(storeSlug!)

  const onSuccess = () => navigate(`/store/${storeSlug}`)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password }, { onSuccess })
  }

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    register.mutate(
      { email, password, first_name: firstName || undefined, last_name: lastName || undefined },
      { onSuccess },
    )
  }

  const inputCls =
    'w-full border border-gray-300 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]'
  const error = login.isError || register.isError

  return (
    <div className="max-w-sm mx-auto mt-12">
      {/* Tab toggle */}
      <div className="flex border-b mb-6">
        {(['login', 'register'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 pb-2 text-sm font-medium capitalize transition ${
              tab === t
                ? 'text-[#51459d] border-b-2 border-[#51459d]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          {error && <p className="text-[#ff3a6e] text-xs">Invalid credentials.</p>}
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full bg-[#51459d] text-white py-2.5 rounded-[10px] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {login.isPending ? 'Logging in...' : 'Login'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            <input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
          </div>
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          <input type="password" placeholder="Password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          {error && <p className="text-[#ff3a6e] text-xs">Registration failed. Please try again.</p>}
          <button
            type="submit"
            disabled={register.isPending}
            className="w-full bg-[#51459d] text-white py-2.5 rounded-[10px] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {register.isPending ? 'Creating account...' : 'Register'}
          </button>
        </form>
      )}
    </div>
  )
}
