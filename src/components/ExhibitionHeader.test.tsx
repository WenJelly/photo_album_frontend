import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { AuthContext, type AuthContextValue, type AuthUser } from "@/contexts/auth-context"
import type { IslandTask } from "@/types/island-task"

import { ExhibitionHeader } from "./ExhibitionHeader"

function installMatchMedia(options?: { canHover?: boolean; reducedMotion?: boolean }) {
  const canHover = options?.canHover ?? true
  const reducedMotion = options?.reducedMotion ?? false

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches:
        query === "(hover: hover) and (pointer: fine)"
          ? canHover
          : query === "(prefers-reduced-motion: reduce)"
            ? reducedMotion
            : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    writable: true,
    value,
  })
}

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: "7",
    userEmail: "user@example.com",
    userName: "User",
    userAvatar: "https://example.com/avatar.jpg",
    userProfile: "",
    userRole: "user",
    ...overrides,
  }
}

function createAuthValue(user: AuthUser | null): AuthContextValue {
  return {
    user,
    isLoggedIn: user !== null,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }
}

function createTask(overrides?: Partial<IslandTask>): IslandTask {
  return {
    id: "task-1",
    type: "upload",
    status: "running",
    title: "Uploading",
    summary: "Processing image payload",
    progress: 0.45,
    logs: ["[upload] preparing asset", "[upload] streaming bytes"],
    metric: {
      label: "Demo QPS",
      value: "312/s",
    },
    terminalOpen: false,
    ...overrides,
  }
}

function renderHeader(options?: {
  authValue?: AuthContextValue
  canRunStressDemo?: boolean
  currentPage?: "home" | "gallery" | "adminReview" | "me" | "user"
  routeKey?: string
  task?: IslandTask | null
}) {
  const authValue = options?.authValue ?? createAuthValue(createUser())

  return render(
    <AuthContext.Provider value={authValue}>
      <ExhibitionHeader
        {...({
          routeKey: options?.routeKey ?? "gallery",
        } as { routeKey: string })}
        currentPage={options?.currentPage ?? "gallery"}
        onHomeClick={vi.fn()}
        onGalleryClick={vi.fn()}
        onAdminReviewClick={vi.fn()}
        onDismissTask={vi.fn()}
        onLoginClick={vi.fn()}
        onMyProfileClick={vi.fn()}
        onUploadClick={vi.fn()}
        onRunStressDemo={vi.fn()}
        onToggleTaskTerminal={vi.fn()}
        canRunStressDemo={options?.canRunStressDemo ?? false}
        task={options?.task ?? null}
        variant="solid"
      />
    </AuthContext.Provider>,
  )
}

describe("ExhibitionHeader dynamic island", () => {
  beforeEach(() => {
    installMatchMedia()
    setScrollY(0)
  })

  it("compacts after downward scroll and expands again on hover", async () => {
    renderHeader()

    const island = screen.getByTestId("dynamic-island")

    expect(island).toHaveAttribute("data-view", "expanded")

    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "compact")
    })

    fireEvent.mouseEnter(island)

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "expanded")
    })
  })

  it("compacts after small downward scroll steps once the threshold is crossed", async () => {
    renderHeader()

    const island = screen.getByTestId("dynamic-island")

    for (const value of [24, 48, 72, 88, 96]) {
      setScrollY(value)
      fireEvent.scroll(window)
    }

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "compact")
    })
  })

  it("stays compact on tiny upward nudges and expands after the full upward release distance", async () => {
    renderHeader()

    const island = screen.getByTestId("dynamic-island")

    setScrollY(140)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "compact")
    })

    for (const value of [132, 124, 116]) {
      setScrollY(value)
      fireEvent.scroll(window)
    }

    expect(island).toHaveAttribute("data-view", "compact")

    setScrollY(112)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "expanded")
    })
  })

  it("gives task panels priority over compact navigation", async () => {
    renderHeader({
      task: createTask(),
    })

    const island = screen.getByTestId("dynamic-island")

    setScrollY(280)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "task")
    })

    expect(screen.getByText("45%")).toBeInTheDocument()
    expect(screen.getByTestId("island-task-terminal-toggle")).toBeInTheDocument()
  })

  it("shows the stress demo action only when enabled for admin or development use", () => {
    const adminAuth = createAuthValue(createUser({ userRole: "admin" }))
    const { rerender } = renderHeader({
      authValue: adminAuth,
      canRunStressDemo: true,
    })

    expect(screen.getByTestId("open-stress-demo")).toBeInTheDocument()

    rerender(
      <AuthContext.Provider value={createAuthValue(createUser({ userRole: "user" }))}>
        <ExhibitionHeader
          currentPage="gallery"
          onHomeClick={vi.fn()}
          onGalleryClick={vi.fn()}
          onAdminReviewClick={vi.fn()}
          onDismissTask={vi.fn()}
          onLoginClick={vi.fn()}
          onMyProfileClick={vi.fn()}
          onUploadClick={vi.fn()}
          onRunStressDemo={vi.fn()}
          onToggleTaskTerminal={vi.fn()}
          canRunStressDemo={false}
          task={null}
          variant="solid"
        />
      </AuthContext.Provider>,
    )

    expect(screen.queryByTestId("open-stress-demo")).not.toBeInTheDocument()
  })

  it("uses tap toggles instead of hover on coarse pointers", async () => {
    installMatchMedia({ canHover: false })

    renderHeader()

    const island = screen.getByTestId("dynamic-island")

    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "compact")
    })

    fireEvent.click(screen.getByTestId("dynamic-island-toggle"))

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "expanded")
    })
  })

  it("resets compact state on route changes before the next page paints", async () => {
    const { rerender } = renderHeader({
      currentPage: "gallery",
      routeKey: "/gallery",
    })

    const island = screen.getByTestId("dynamic-island")
    const shell = screen.getByTestId("dynamic-island-shell")

    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(island).toHaveAttribute("data-view", "compact")
    })

    setScrollY(0)

    rerender(
      <AuthContext.Provider value={createAuthValue(createUser())}>
        <ExhibitionHeader
          {...({
            routeKey: "/",
          } as { routeKey: string })}
          currentPage="home"
          onHomeClick={vi.fn()}
          onGalleryClick={vi.fn()}
          onAdminReviewClick={vi.fn()}
          onDismissTask={vi.fn()}
          onLoginClick={vi.fn()}
          onMyProfileClick={vi.fn()}
          onUploadClick={vi.fn()}
          onRunStressDemo={vi.fn()}
          onToggleTaskTerminal={vi.fn()}
          canRunStressDemo={false}
          task={null}
          variant="transparent"
        />
      </AuthContext.Provider>,
    )

    expect(shell).toHaveAttribute("data-layout-enabled", "false")
    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island-shell")).toHaveAttribute("data-layout-enabled", "true")
    })
  })

  it("keeps the outer header as a layout root and the inner shell as the only morphing shell", () => {
    renderHeader()

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-layout-root", "true")
    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-shell-layout", "false")
    expect(screen.getByTestId("dynamic-island-shell")).toHaveAttribute("data-shell-layout", "true")
  })

  it("exposes reduced motion state for accessible animation fallbacks", () => {
    installMatchMedia({ reducedMotion: true })

    renderHeader()

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-reduced-motion", "true")
  })
})
