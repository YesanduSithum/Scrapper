import { createContext, useContext, useState, useCallback } from 'react'
import type { User } from '../types'
import { api } from '../services/api'

const TOKEN_KEY = 'pricepulse_token'
const USER_KEY = 'pricepulse_user'

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => void
  error: string | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function saveToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

function removeToken() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

function loadUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function saveUser(user: User) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.auth.login(email, password)
      saveToken(result.token)
      saveUser(result.user)
      setUser(result.user)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.auth.register(email, password, name)
      saveToken(result.token)
      saveUser(result.user)
      setUser(result.user)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    removeToken()
    setUser(null)
    setError(null)
  }, [])

  const value: AuthContextValue = { user, login, register, logout, error, isLoading }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
