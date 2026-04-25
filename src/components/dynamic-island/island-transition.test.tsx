import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { AuthContext, type AuthContextValue, type AuthUser } from "@/contexts/auth-context"
import type { IslandTask } from "@/types/island-task"

import { ExhibitionHeader } from "../ExhibitionHeader"

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
    title: "Uploading 3 hi-res images",
    summary: "Streaming archival originals through the image pipeline.",
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
        canRunStressDemo={false}
        currentPage={options?.currentPage ?? "gallery"}
        onAdminReviewClick={vi.fn()}
        onDismissTask={vi.fn()}
        onGalleryClick={vi.fn()}
        onHomeClick={vi.fn()}
        onLoginClick={vi.fn()}
        onMyProfileClick={vi.fn()}
        onRunStressDemo={vi.fn()}
        onToggleTaskTerminal={vi.fn()}
        onUploadClick={vi.fn()}
        task={options?.task ?? null}
        variant="solid"
      />
    </AuthContext.Provider>,
  )
}

function getContentFrame(view: "expanded" | "compact" | "task") {
  const frame = screen
    .getAllByTestId("dynamic-island-content-frame")
    .find((frame) => frame.getAttribute("data-island-content-view") === view)

  if (!frame) {
    throw new Error(`Missing content frame for ${view}`)
  }

  return frame
}

describe("dynamic island transition frames", () => {
  beforeEach(() => {
    installMatchMedia()
    setScrollY(0)
  })

  it("keeps expanded content inside an intrinsic frame so popLayout exits retain a physical width", () => {
    renderHeader()

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")
    expect(getContentFrame("expanded")).toHaveAttribute("data-island-content-view", "expanded")
    expect(getContentFrame("expanded")).toHaveClass(
      "dynamic-island-content-frame",
      "dynamic-island-content-frame--intrinsic",
    )
  })

  it("binds compact content to the shell width during collapse", async () => {
    renderHeader()

    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })

    expect(getContentFrame("compact")).toHaveAttribute("data-island-content-view", "compact")
    expect(getContentFrame("compact")).toHaveClass(
      "dynamic-island-content-frame",
      "dynamic-island-content-frame--shell",
    )
  })

  it("still compacts when downward scrolling arrives in single-pixel steps", async () => {
    renderHeader()

    for (let value = 1; value <= 96; value += 1) {
      setScrollY(value)
      fireEvent.scroll(window)
    }

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })
  })

  it("does not compact immediately when the page is already scrolled and the user only nudges downward", async () => {
    setScrollY(180)
    renderHeader()

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")

    setScrollY(188)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")
    })
  })

  it("does not let an existing hover state block scroll-driven compaction", async () => {
    renderHeader()

    fireEvent.mouseEnter(screen.getByTestId("dynamic-island"))
    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })
  })

  it("requires a fresh downward travel budget after the island expands again", async () => {
    renderHeader()

    setScrollY(140)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })

    setScrollY(112)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")
    })

    setScrollY(124)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")
    })
  })

  it("uses the same intrinsic width lock for task-panel exits", () => {
    renderHeader({
      task: createTask(),
    })

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "task")
    expect(getContentFrame("task")).toHaveAttribute("data-island-content-view", "task")
    expect(getContentFrame("task")).toHaveClass(
      "dynamic-island-content-frame",
      "dynamic-island-content-frame--intrinsic",
    )
  })

  it("renders content inside an isolated transition stage", () => {
    renderHeader()

    expect(screen.getByTestId("dynamic-island-content-stage")).toBeInTheDocument()
  })

  it("keeps the logo as a persistent absolute anchor on the shell during navigation views", () => {
    renderHeader()

    expect(screen.getByTestId("dynamic-island-logo-anchor")).toBeInTheDocument()
    expect(screen.getByTestId("dynamic-island-logo-anchor")).toHaveClass("dynamic-island-logo-anchor")
    expect(screen.getByTestId("dynamic-island-logo-anchor-inner")).toHaveClass("dynamic-island-logo-anchor__inner")
  })

  it("removes the shell logo anchor when the task panel takes over the island", () => {
    renderHeader({
      task: createTask(),
    })

    expect(screen.queryByTestId("dynamic-island-logo-anchor")).not.toBeInTheDocument()
  })
})
