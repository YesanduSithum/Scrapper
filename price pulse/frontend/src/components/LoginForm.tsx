import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const inputBase =
  'w-full px-4 py-3 rounded-xl border bg-white/60 backdrop-blur-sm border-white/40 text-grey-900 placeholder-grey-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400/80 focus:border-primary-400 focus:bg-white/90 hover:bg-white/80'

export function LoginForm({
  onSwitchToRegister,
}: {
  onSwitchToRegister: () => void
}) {
  const { login, isLoading, error: authError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    
    if (!email.trim()) {
      setLocalError('Enter your email')
      return
    }
    
    if (!password.trim()) {
      setLocalError('Enter your password')
      return
    }

    const success = await login(email.trim(), password)
    if (!success) {
      setLocalError(authError || 'Login failed. Please try again.')
    }
  }

  const displayError = localError || authError

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-grey-800">Welcome back</h2>
        <p className="text-grey-500 text-sm mt-0.5">Sign in to continue to PricePulse</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {displayError && (
          <div
            className="text-sm text-danger bg-dangerLight/90 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-red-200/60"
            role="alert"
          >
            {displayError}
          </div>
        )}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-grey-700 mb-1.5">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className={inputBase}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-grey-700 mb-1.5">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className={inputBase}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500/90 text-white font-semibold shadow-lg shadow-primary-500/25 border border-primary-400/30 backdrop-blur-sm transition-all duration-300 hover:bg-primary-600 hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogIn className="w-5 h-5" />
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="text-center text-sm text-grey-500 mt-4">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          disabled={isLoading}
          className="text-primary-600 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary-400/50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Register
        </button>
      </p>
    </div>
  )
}
