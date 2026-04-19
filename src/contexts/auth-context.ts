import { createContext, useContext } from "react"

import type { LoginResult } from "@/lib/auth-api"

export interface AuthUser {
  id: number
  userAccount: string
  userName: string
  userAvatar: string
  userProfile: string
  userRole: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoggedIn: boolean
  login: (result: LoginResult) => void
  logout: () => void
}

export const TOKEN_KEY = "token"
export const USER_KEY = "auth_user"

export const AuthContext = createContext<AuthContextValue | null>(null)

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
