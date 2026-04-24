import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import type { LoginResult } from "@/lib/auth-api"
import {
  AUTH_UNAUTHORIZED_EVENT,
  AuthContext,
  TOKEN_KEY,
  USER_KEY,
  type AuthUser,
  clearStoredAuth,
  readStoredUser,
  type AuthContextValue,
} from "@/contexts/auth-context"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(readStoredUser)

  const login = useCallback((result: LoginResult) => {
    localStorage.setItem(TOKEN_KEY, result.token)
    setUser({
      id: result.id,
      userEmail: result.userEmail,
      userName: result.userName,
      userAvatar: result.userAvatar,
      userProfile: result.userProfile,
      userRole: result.userRole,
    })
  }, [])

  const logout = useCallback(() => {
    clearStoredAuth()
    setUser(null)
  }, [])

  const updateUser = useCallback((nextUser: Partial<AuthUser>) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...nextUser } : currentUser))
  }, [])

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }, [user])

  useEffect(() => {
    const handleUnauthorized = () => {
      logout()
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)

    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [logout])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoggedIn: user !== null, login, logout, updateUser }),
    [user, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
