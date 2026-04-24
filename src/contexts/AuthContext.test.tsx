import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AuthProvider } from "./AuthContext"
import { USER_KEY, useAuth } from "./auth-context"

function LoginProbe() {
  const { login, user } = useAuth()

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          login({
            token: "jwt-token",
            id: "1",
            userEmail: "test@example.com",
            userName: "User",
            userAvatar: "",
            userProfile: "",
            userRole: "user",
            createTime: "2026-04-23 10:00:00",
            updateTime: "2026-04-23 10:00:00",
          })
        }
      >
        login
      </button>
      <span>{user?.userEmail ?? ""}</span>
    </div>
  )
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("stores the documented userEmail field after login", async () => {
    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    )

    await userEvent.click(screen.getByRole("button", { name: "login" }))

    await waitFor(() => {
      expect(screen.getByText("test@example.com")).toBeInTheDocument()
    })

    expect(JSON.parse(localStorage.getItem(USER_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        userEmail: "test@example.com",
      }),
    )
  })
})
