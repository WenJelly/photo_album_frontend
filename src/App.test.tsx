import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { mockedDeletePicture, mockedGetPictureDetail, mockedListPictures } = vi.hoisted(() => ({
  mockedDeletePicture: vi.fn(),
  mockedGetPictureDetail: vi.fn(),
  mockedListPictures: vi.fn(),
}))

vi.mock("@/components/AdminReviewPage", () => ({
  AdminReviewPage: () => <div data-testid="admin-review-page" />,
}))

vi.mock("@/components/AuthDialog", () => ({
  AuthDialog: () => <div data-testid="auth-dialog" />,
}))

vi.mock("@/components/ExhibitionHeader", () => ({
  ExhibitionHeader: ({
    onGalleryClick,
    onHomeClick,
    onMyProfileClick,
    onUploadClick,
    onDismissTask,
    suspendLayoutProjection,
    task,
  }: {
    onGalleryClick: () => void
    onHomeClick: () => void
    onMyProfileClick: () => void
    onUploadClick: () => void
    onDismissTask?: () => void
    suspendLayoutProjection?: boolean
    task?: { status: string; summary: string } | null
  }) => (
    <div data-testid="mock-header" data-route-transitioning={String(Boolean(suspendLayoutProjection))}>
      <button type="button" data-testid="nav-home" onClick={onHomeClick}>
        Home
      </button>
      <button type="button" data-testid="nav-gallery" onClick={onGalleryClick}>
        Gallery
      </button>
      <button type="button" data-testid="nav-profile" onClick={onMyProfileClick}>
        Profile
      </button>
      <button type="button" data-testid="open-upload-dialog" onClick={onUploadClick}>
        Upload
      </button>
      {task ? (
        <div data-testid="task-panel">
          <span data-testid="task-status">{task.status}</span>
          <span data-testid="task-summary">{task.summary}</span>
          {onDismissTask ? (
            <button type="button" data-testid="dismiss-task" onClick={onDismissTask}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  ),
}))

vi.mock("@/components/HeroIntro", () => ({
  HeroIntro: () => <section data-testid="hero-intro" />,
}))

vi.mock("@/components/PhotoGrid", () => ({
  PhotoGrid: () => <div data-testid="photo-grid" />,
}))

vi.mock("@/components/PhotoPreviewOverlay", () => ({
  PhotoPreviewOverlay: () => <div data-testid="preview-overlay" />,
}))

vi.mock("@/components/UploadDialog", () => ({
  UploadDialog: ({
    onUploadTaskEvent,
  }: {
    onClose: () => void
    onUploaded: (photo: unknown) => void
    onUploadTaskEvent?: (event: unknown) => void
  }) => (
    <div data-testid="upload-dialog">
      <button
        type="button"
        data-testid="start-upload"
        onClick={() =>
          onUploadTaskEvent?.({
            type: "start",
            mode: "file",
            label: "Demo upload",
          })
        }
      >
        Start upload
      </button>
      <button
        type="button"
        data-testid="start-and-fail-upload"
        onClick={() => {
          onUploadTaskEvent?.({
            type: "start",
            mode: "file",
            label: "Demo upload",
          })
          onUploadTaskEvent?.({
            type: "error",
            mode: "file",
            message: "Upload exploded",
          })
        }}
      >
        Start and fail
      </button>
      <button
        type="button"
        data-testid="start-and-success-upload"
        onClick={() => {
          onUploadTaskEvent?.({
            type: "start",
            mode: "file",
            label: "Demo upload",
          })
          onUploadTaskEvent?.({
            type: "success",
            mode: "file",
            photo: {
              id: "1",
              src: "https://example.com/photo.jpg",
              thumbnailSrc: "https://example.com/photo-thumb.jpg",
              width: 1200,
              height: 900,
              alt: "Uploaded photo",
              photographer: "User",
              category: "travel",
              summary: "",
              location: "",
              tags: [],
              reviewStatus: 1,
            },
          })
        }}
      >
        Start and succeed
      </button>
    </div>
  ),
}))

vi.mock("@/components/UserProfilePage", () => ({
  UserProfilePage: () => <div data-testid="user-profile-page" />,
}))

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: null,
    isLoggedIn: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}))

vi.mock("@/lib/picture-api", () => ({
  deletePicture: mockedDeletePicture,
  getPictureDetail: mockedGetPictureDetail,
  listPictures: mockedListPictures,
}))

import App from "./App"

function createPicturePage() {
  return {
    pageNum: 1,
    pageSize: 20,
    total: 0,
    list: [],
  }
}

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    writable: true,
    value,
  })
}

describe("App route scroll restoration", () => {
  beforeEach(() => {
    mockedDeletePicture.mockReset()
    mockedGetPictureDetail.mockReset()
    mockedListPictures.mockReset()
    mockedListPictures.mockResolvedValue(createPicturePage())
    window.history.replaceState({}, "", "/")
    setScrollY(240)
    window.scrollTo = vi.fn()
  })

  it("scrolls to the top when navigating to another top-level page", async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId("nav-gallery"))

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" })

    await waitFor(() => {
      expect(mockedListPictures).toHaveBeenCalledWith({ pageNum: 1, pageSize: 20 })
    })
  })

  it("freezes island layout projection before route-change scroll restoration runs", async () => {
    const user = userEvent.setup()
    window.scrollTo = vi.fn(() => {
      expect(screen.getByTestId("mock-header")).toHaveAttribute("data-route-transitioning", "true")
    })

    render(<App />)

    expect(screen.getByTestId("mock-header")).toHaveAttribute("data-route-transitioning", "false")

    await user.click(screen.getByTestId("nav-gallery"))

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" })
  })

  it("scrolls to the top for popstate navigation as well", async () => {
    render(<App />)

    window.history.pushState({}, "", "/gallery")
    setScrollY(180)
    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" })

    await waitFor(() => {
      expect(mockedListPictures).toHaveBeenCalledWith({ pageNum: 1, pageSize: 20 })
    })
  })

  it("does not render the gallery category filter toolbar anymore", async () => {
    window.history.replaceState({}, "", "/gallery")
    mockedListPictures.mockResolvedValue(createPicturePage())

    render(<App />)

    await waitFor(() => {
      expect(mockedListPictures).toHaveBeenCalledWith({ pageNum: 1, pageSize: 20 })
    })

    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument()
  })

  it("closes the upload dialog as soon as the global upload task starts", async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId("open-upload-dialog"))
    expect(screen.getByTestId("upload-dialog")).toBeInTheDocument()

    await user.click(screen.getByTestId("start-upload"))

    await waitFor(() => {
      expect(screen.queryByTestId("upload-dialog")).not.toBeInTheDocument()
    })

    expect(screen.getByTestId("task-status")).toHaveTextContent("running")
  })

  it("keeps failed upload tasks visible until the user dismisses them", async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId("open-upload-dialog"))
    await user.click(screen.getByTestId("start-and-fail-upload"))

    await waitFor(() => {
      expect(screen.queryByTestId("upload-dialog")).not.toBeInTheDocument()
    })

    expect(screen.getByTestId("task-status")).toHaveTextContent("error")
    expect(screen.getByTestId("task-summary")).toHaveTextContent("Upload exploded")
    expect(screen.getByTestId("dismiss-task")).toBeInTheDocument()

    await user.click(screen.getByTestId("dismiss-task"))

    await waitFor(() => {
      expect(screen.queryByTestId("task-panel")).not.toBeInTheDocument()
    })

    await user.click(screen.getByTestId("open-upload-dialog"))
    expect(screen.getByTestId("upload-dialog")).toBeInTheDocument()
  })

  it("keeps successful upload tasks briefly before auto-dismissing them", async () => {
    vi.useFakeTimers()

    try {
      render(<App />)

      fireEvent.click(screen.getByTestId("open-upload-dialog"))
      fireEvent.click(screen.getByTestId("start-and-success-upload"))

      expect(screen.getByTestId("task-status")).toHaveTextContent("success")

      act(() => {
        vi.advanceTimersByTime(2600)
      })

      expect(screen.queryByTestId("task-panel")).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
