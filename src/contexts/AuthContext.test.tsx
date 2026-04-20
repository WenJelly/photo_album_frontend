import { render, screen, waitFor } from "@testing-library/react"

import { AuthProvider } from "@/contexts/AuthContext"
import {
  AUTH_UNAUTHORIZED_EVENT,
  TOKEN_KEY,
  USER_KEY,
  useAuth,
} from "@/contexts/auth-context"

function AuthStatus() {
  const { isLoggedIn, user } = useAuth()

  return <p>{isLoggedIn ? user?.userName : "guest"}</p>
}

describe("AuthProvider", () => {
  afterEach(() => {
    localStorage.clear()
  })

  test("clears auth state when the unauthorized event is dispatched", async () => {
    localStorage.setItem(TOKEN_KEY, "jwt-token")
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: 7,
        userAccount: "owner@example.com",
        userName: "作者",
        userAvatar: "",
        userProfile: "",
        userRole: "user",
      }),
    )

    render(
      <AuthProvider>
        <AuthStatus />
      </AuthProvider>,
    )

    expect(screen.getByText("作者")).toBeInTheDocument()

    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))

    await waitFor(() => {
      expect(screen.getByText("guest")).toBeInTheDocument()
    })

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
  })
})
