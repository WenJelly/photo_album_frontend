import { createContext, useContext } from "react"

import type { LoginResult } from "@/lib/auth-api"

export interface AuthUser {
  id: string
  userEmail: string
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
  updateUser: (nextUser: Partial<AuthUser>) => void
}

export const TOKEN_KEY = "token"
export const USER_KEY = "auth_user"
export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized"

export const AuthContext = createContext<AuthContextValue | null>(null)

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<AuthUser> & { userAccount?: string }

    if (!parsed.id || !parsed.userName || !parsed.userRole) {
      return null
    }

    return {
      id: parsed.id,
      userEmail: parsed.userEmail ?? parsed.userAccount ?? "",
      userName: parsed.userName,
      userAvatar: parsed.userAvatar ?? "",
      userProfile: parsed.userProfile ?? "",
      userRole: parsed.userRole,
    }
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
