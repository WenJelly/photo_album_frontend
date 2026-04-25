import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import App from "./App"

const { mockListPicturesCursor, mockUploadDialogController } = vi.hoisted(() => ({
  mockListPicturesCursor: vi.fn(),
  mockUploadDialogController: {
    props: null as null | {
      onUploadTaskEvent?: (event: unknown) => void
      onUploaded?: (photo: unknown) => void
    },
  },
}))

vi.mock("@/components/ExhibitionHeader", () => ({
  ExhibitionHeader: ({
    currentPage,
    onGalleryClick,
    onHomeClick,
    onPreviewTaskPhoto,
    onUploadClick,
    task,
    suspendLayoutProjection,
  }: {
    currentPage: string
    onGalleryClick: () => void
    onHomeClick: () => void
    onPreviewTaskPhoto?: () => void
    onUploadClick: () => void
    task: {
      phase?: string
      previewPhoto?: unknown
      status: string
      title: string
      summary: string
      progress: number | null
    } | null
    suspendLayoutProjection?: boolean
  }) => (
    <div
      data-testid="mock-header"
      data-current-page={currentPage}
      data-suspend-layout-projection={String(Boolean(suspendLayoutProjection))}
    >
      <button type="button" onClick={onHomeClick}>
        Home
      </button>
      <button type="button" onClick={onGalleryClick}>
        Gallery
      </button>
      <button type="button" onClick={onUploadClick}>
        Upload
      </button>
      {task ? (
        <div data-testid="mock-task" data-phase={task.phase} data-status={task.status}>
          <span data-testid="mock-task-title">{task.title}</span>
          <span data-testid="mock-task-summary">{task.summary}</span>
          <span data-testid="mock-task-progress">
            {task.progress === null ? "Live" : `${Math.round(task.progress * 100)}%`}
          </span>
          {task.previewPhoto ? (
            <button type="button" data-testid="mock-task-preview" onClick={onPreviewTaskPhoto}>
              Preview uploaded photo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  ),
}))

vi.mock("@/components/HeroIntro", () => ({
  HeroIntro: ({ heroRef }: { heroRef: { current: HTMLElement | null } }) => (
    <section
      ref={(node) => {
        heroRef.current = node
      }}
      data-testid="mock-hero"
    />
  ),
}))

vi.mock("@/components/PhotoGrid", () => ({
  PhotoGrid: () => <div data-testid="mock-photo-grid" />,
}))

vi.mock("@/components/AdminReviewPage", () => ({
  AdminReviewPage: () => <div data-testid="mock-admin-review" />,
}))

vi.mock("@/components/UserProfilePage", () => ({
  UserProfilePage: () => <div data-testid="mock-user-profile" />,
}))

vi.mock("@/components/AuthDialog", () => ({
  AuthDialog: () => <div data-testid="mock-auth-dialog" />,
}))

vi.mock("@/components/UploadDialog", () => ({
  UploadDialog: (props: {
    onUploadTaskEvent?: (event: unknown) => void
    onUploaded?: (photo: unknown) => void
  }) => {
    mockUploadDialogController.props = props
    return <div data-testid="mock-upload-dialog" />
  },
}))

vi.mock("@/components/PhotoPreviewOverlay", () => ({
  PhotoPreviewOverlay: () => <div data-testid="mock-photo-preview" />,
}))

vi.mock("@/lib/picture-api", () => ({
  listPicturesCursor: mockListPicturesCursor,
  getPictureDetail: vi.fn(),
  deletePicture: vi.fn(),
}))

describe("App route transitions", () => {
  const requestAnimationFrameQueue: FrameRequestCallback[] = []
  const uploadedPhoto = {
    id: "uploaded-photo",
    src: "https://example.com/uploaded.jpg",
    thumbnailSrc: "https://example.com/uploaded-thumb.jpg",
    width: 1200,
    height: 800,
    alt: "Uploaded photo",
    photographer: "Uploader",
    category: "travel",
    summary: "Uploaded summary",
    location: "Shanghai",
    tags: ["upload"],
    reviewStatus: 0,
  }

  beforeEach(() => {
    requestAnimationFrameQueue.length = 0
    mockListPicturesCursor.mockResolvedValue({
      pageSize: 30,
      hasMore: false,
      nextCursor: "",
      list: [],
    })
    mockUploadDialogController.props = null

    window.history.replaceState({}, "", "/")
    window.localStorage.clear()
    window.scrollTo = vi.fn()

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      requestAnimationFrameQueue.push(callback)
      return requestAnimationFrameQueue.length
    })

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("does not enter a global header projection suspension window during route changes", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Gallery" }))

    expect(screen.getByTestId("mock-header")).toHaveAttribute("data-current-page", "gallery")
    expect(screen.getByTestId("mock-header")).toHaveAttribute("data-suspend-layout-projection", "false")
  })

  it("loads the gallery through the cursor picture endpoint", async () => {
    window.history.replaceState({}, "", "/gallery")

    render(<App />)

    await waitFor(() => {
      expect(mockListPicturesCursor).toHaveBeenCalledWith({ pageSize: 30 })
    })
  })

  it("shows a readable retry action when gallery loading fails", async () => {
    mockListPicturesCursor.mockRejectedValue(new Error("Network failed"))
    window.history.replaceState({}, "", "/gallery")

    render(<App />)

    expect(await screen.findByRole("button", { name: "重试" })).toBeInTheDocument()
  })

  it("moves upload tasks through explicit transfer, processing, and review phases", () => {
    vi.useFakeTimers()
    window.history.replaceState({}, "", "/gallery")

    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Upload" }))

    expect(screen.getByTestId("mock-upload-dialog")).toBeInTheDocument()
    expect(mockUploadDialogController.props).not.toBeNull()

    act(() => {
      mockUploadDialogController.props?.onUploadTaskEvent?.({
        type: "start",
        mode: "file",
        label: "demo.png",
      })
    })

    expect(screen.getByTestId("mock-task")).toHaveAttribute("data-phase", "transferring")
    expect(screen.getByTestId("mock-task-title")).toHaveTextContent("发送文件")
    expect(screen.getByTestId("mock-task-progress")).toHaveTextContent("0%")

    act(() => {
      mockUploadDialogController.props?.onUploadTaskEvent?.({
        type: "progress",
        mode: "file",
        progress: {
          loaded: 1024,
          total: 1024,
          progress: 1,
        },
      })
    })

    expect(screen.getByTestId("mock-task")).toHaveAttribute("data-phase", "processing")
    expect(screen.getByTestId("mock-task-title")).toHaveTextContent("服务器处理中")
    expect(screen.getByTestId("mock-task-summary")).toHaveTextContent("等待服务器确认")
    expect(screen.getByTestId("mock-task-progress")).toHaveTextContent("Live")

    act(() => {
      mockUploadDialogController.props?.onUploadTaskEvent?.({
        type: "success",
        mode: "file",
        photo: uploadedPhoto,
      })
      mockUploadDialogController.props?.onUploaded?.(uploadedPhoto)
    })

    expect(screen.getByTestId("mock-task")).toHaveAttribute("data-phase", "pendingReview")
    expect(screen.getByTestId("mock-task-title")).toHaveTextContent("等待审核")
    expect(screen.getByTestId("mock-task-progress")).toHaveTextContent("100%")

    act(() => {
      vi.advanceTimersByTime(7000)
    })

    expect(screen.queryByTestId("mock-task")).not.toBeInTheDocument()
  })

  it("marks upload failures as a failed phase without keeping the previous progress illusion", () => {
    vi.useFakeTimers()
    window.history.replaceState({}, "", "/gallery")

    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Upload" }))

    expect(mockUploadDialogController.props).not.toBeNull()

    act(() => {
      mockUploadDialogController.props?.onUploadTaskEvent?.({
        type: "start",
        mode: "file",
        label: "broken.png",
      })
      mockUploadDialogController.props?.onUploadTaskEvent?.({
        type: "error",
        mode: "file",
        message: "Upload failed on the server.",
      })
    })

    expect(screen.getByTestId("mock-task")).toHaveAttribute("data-phase", "failed")
    expect(screen.getByTestId("mock-task-title")).toHaveTextContent("上传失败")
    expect(screen.getByTestId("mock-task-summary")).toHaveTextContent("上传未完成：Upload failed on the server.")
    expect(screen.getByTestId("mock-task-progress")).toHaveTextContent("Live")

    act(() => {
      vi.advanceTimersByTime(5500)
    })

    expect(screen.queryByTestId("mock-task")).not.toBeInTheDocument()
  })

  it("waits for the island preview action before opening a successful upload preview", () => {
    vi.useFakeTimers()
    window.history.replaceState({}, "", "/gallery")

    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Upload" }))

    expect(mockUploadDialogController.props).not.toBeNull()

    act(() => {
      mockUploadDialogController.props?.onUploadTaskEvent?.({
        type: "start",
        mode: "file",
        label: "preview.png",
      })
      mockUploadDialogController.props?.onUploadTaskEvent?.({
        type: "success",
        mode: "file",
        photo: uploadedPhoto,
      })
      mockUploadDialogController.props?.onUploaded?.(uploadedPhoto)
    })

    expect(screen.queryByTestId("mock-photo-preview")).not.toBeInTheDocument()
    expect(screen.getByTestId("mock-task")).toHaveAttribute("data-phase", "pendingReview")

    fireEvent.click(screen.getByTestId("mock-task-preview"))

    expect(screen.getByTestId("mock-photo-preview")).toBeInTheDocument()
  })
})
