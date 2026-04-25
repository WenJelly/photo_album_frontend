import { fireEvent, render, screen } from "@testing-library/react"

import App from "./App"

const { mockListPictures } = vi.hoisted(() => ({
  mockListPictures: vi.fn(),
}))

vi.mock("@/components/ExhibitionHeader", () => ({
  ExhibitionHeader: ({
    currentPage,
    onGalleryClick,
    onHomeClick,
    suspendLayoutProjection,
  }: {
    currentPage: string
    onGalleryClick: () => void
    onHomeClick: () => void
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
  UploadDialog: () => <div data-testid="mock-upload-dialog" />,
}))

vi.mock("@/components/PhotoPreviewOverlay", () => ({
  PhotoPreviewOverlay: () => <div data-testid="mock-photo-preview" />,
}))

vi.mock("@/lib/picture-api", () => ({
  listPictures: mockListPictures,
  getPictureDetail: vi.fn(),
  deletePicture: vi.fn(),
}))

describe("App route transitions", () => {
  const requestAnimationFrameQueue: FrameRequestCallback[] = []

  beforeEach(() => {
    requestAnimationFrameQueue.length = 0
    mockListPictures.mockReturnValue(new Promise(() => {}))

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
    vi.restoreAllMocks()
  })

  it("does not enter a global header projection suspension window during route changes", () => {
    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Gallery" }))

    expect(screen.getByTestId("mock-header")).toHaveAttribute("data-current-page", "gallery")
    expect(screen.getByTestId("mock-header")).toHaveAttribute("data-suspend-layout-projection", "false")
  })
})
