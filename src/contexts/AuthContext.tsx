import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import type { LoginResult } from "@/lib/auth-api"
import {
  AuthContext,
  TOKEN_KEY,
  USER_KEY,
  readStoredUser,
  type AuthContextValue,
} from "@/contexts/auth-context"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(readStoredUser)

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }, [user])

  const login = useCallback((result: LoginResult) => {
    localStorage.setItem(TOKEN_KEY, result.token)
    setUser({
      id: result.id,
      userAccount: result.userAccount,
      userName: result.userName,
      userAvatar: result.userAvatar,
      userProfile: result.userProfile,
      userRole: result.userRole,
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoggedIn: user !== null, login, logout }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
