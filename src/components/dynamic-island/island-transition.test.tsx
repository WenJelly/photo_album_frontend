import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"

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
  const props = {
    routeKey: options?.routeKey ?? "gallery",
    canRunStressDemo: false,
    currentPage: options?.currentPage ?? "gallery",
    onAdminReviewClick: vi.fn(),
    onDismissTask: vi.fn(),
    onGalleryClick: vi.fn(),
    onHomeClick: vi.fn(),
    onLoginClick: vi.fn(),
    onMyProfileClick: vi.fn(),
    onPreviewTaskPhoto: vi.fn(),
    onRunStressDemo: vi.fn(),
    onToggleTaskTerminal: vi.fn(),
    onUploadClick: vi.fn(),
    task: options?.task ?? null,
    variant: "solid" as const,
  }

  const result = render(
    <AuthContext.Provider value={authValue}>
      <ExhibitionHeader {...props} />
    </AuthContext.Provider>,
  )

  return {
    ...result,
    rerenderHeader(nextOptions?: {
      authValue?: AuthContextValue
      currentPage?: "home" | "gallery" | "adminReview" | "me" | "user"
      routeKey?: string
      task?: IslandTask | null
    }) {
      const nextAuthValue = nextOptions?.authValue ?? authValue

      result.rerender(
        <AuthContext.Provider value={nextAuthValue}>
          <ExhibitionHeader
            {...props}
            routeKey={nextOptions?.routeKey ?? props.routeKey}
            currentPage={nextOptions?.currentPage ?? props.currentPage}
            task={nextOptions?.task ?? props.task}
          />
        </AuthContext.Provider>,
      )
    },
  }
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

  it("remounts the shell when the route changes from a scrolled compact state", async () => {
    const { rerenderHeader } = renderHeader({
      currentPage: "gallery",
      routeKey: "/gallery",
    })

    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })

    const previousShell = screen.getByTestId("dynamic-island-shell")

    rerenderHeader({
      currentPage: "home",
      routeKey: "/",
    })

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")
    expect(screen.getByTestId("dynamic-island-shell")).not.toBe(previousShell)
  })

  it("releases focus-expanded mode after dismissing a finished task panel", async () => {
    function DismissibleHeader() {
      const [task, setTask] = useState<IslandTask | null>(createTask({ status: "success" }))

      return (
        <AuthContext.Provider value={createAuthValue(createUser())}>
          <ExhibitionHeader
            routeKey="/gallery"
            canRunStressDemo={false}
            currentPage="gallery"
            onAdminReviewClick={vi.fn()}
            onDismissTask={() => setTask(null)}
            onGalleryClick={vi.fn()}
            onHomeClick={vi.fn()}
            onLoginClick={vi.fn()}
            onMyProfileClick={vi.fn()}
            onPreviewTaskPhoto={vi.fn()}
            onRunStressDemo={vi.fn()}
            onToggleTaskTerminal={vi.fn()}
            onUploadClick={vi.fn()}
            task={task}
            variant="solid"
          />
        </AuthContext.Provider>
      )
    }

    render(<DismissibleHeader />)

    setScrollY(220)
    fireEvent.scroll(window)

    const dismissButton = screen.getByTestId("island-task-dismiss")
    dismissButton.focus()
    expect(dismissButton).toHaveFocus()
    fireEvent.click(dismissButton)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })
  })

  it("restores directly to compact when an auto-finished task was launched from hover-expanded compact mode", async () => {
    let finishTask = () => {}

    function AutoFinishedTaskHeader() {
      const [task, setTask] = useState<IslandTask | null>(null)
      finishTask = () => setTask(null)

      return (
        <AuthContext.Provider value={createAuthValue(createUser({ userRole: "admin" }))}>
          <ExhibitionHeader
            routeKey="/gallery"
            canRunStressDemo
            currentPage="gallery"
            onAdminReviewClick={vi.fn()}
            onDismissTask={() => setTask(null)}
            onGalleryClick={vi.fn()}
            onHomeClick={vi.fn()}
            onLoginClick={vi.fn()}
            onMyProfileClick={vi.fn()}
            onPreviewTaskPhoto={vi.fn()}
            onRunStressDemo={() => setTask(createTask({ type: "stress-demo", status: "success" }))}
            onToggleTaskTerminal={vi.fn()}
            onUploadClick={vi.fn()}
            task={task}
            variant="solid"
          />
        </AuthContext.Provider>
      )
    }

    render(<AutoFinishedTaskHeader />)

    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })

    fireEvent.mouseEnter(screen.getByTestId("dynamic-island"))

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")
    })

    fireEvent.click(screen.getByTestId("open-stress-demo"))

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "task")

    act(() => {
      finishTask()
    })

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
  })

  it("restores directly to compact when dismissing a task launched from hover-expanded compact mode", async () => {
    function DismissibleStressTaskHeader() {
      const [task, setTask] = useState<IslandTask | null>(null)

      return (
        <AuthContext.Provider value={createAuthValue(createUser({ userRole: "admin" }))}>
          <ExhibitionHeader
            routeKey="/gallery"
            canRunStressDemo
            currentPage="gallery"
            onAdminReviewClick={vi.fn()}
            onDismissTask={() => setTask(null)}
            onGalleryClick={vi.fn()}
            onHomeClick={vi.fn()}
            onLoginClick={vi.fn()}
            onMyProfileClick={vi.fn()}
            onPreviewTaskPhoto={vi.fn()}
            onRunStressDemo={() => setTask(createTask({ type: "stress-demo", status: "success" }))}
            onToggleTaskTerminal={vi.fn()}
            onUploadClick={vi.fn()}
            task={task}
            variant="solid"
          />
        </AuthContext.Provider>
      )
    }

    render(<DismissibleStressTaskHeader />)

    setScrollY(220)
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
    })

    fireEvent.mouseEnter(screen.getByTestId("dynamic-island"))

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "expanded")
    })

    fireEvent.click(screen.getByTestId("open-stress-demo"))

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "task")

    fireEvent.click(screen.getByTestId("island-task-dismiss"))

    expect(screen.getByTestId("dynamic-island")).toHaveAttribute("data-view", "compact")
  })
})
