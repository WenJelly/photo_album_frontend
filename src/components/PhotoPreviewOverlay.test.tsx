import type { ComponentProps } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { PhotoPreviewOverlay } from "@/components/PhotoPreviewOverlay"
import type { Photo } from "@/types/photo"

const COPY = {
  photographer: "\u6444\u5f71\u5e08",
  location: "\u62cd\u6444\u5730\u70b9",
  format: "\u683c\u5f0f",
  uploaded: "\u4e0a\u4f20\u65f6\u95f4",
  views: "\u6d4f\u89c8",
  likes: "\u70b9\u8d5e",
  currentView: "\u5f53\u524d\u67e5\u770b",
  currentSlide: "\u7b2c 1 \u5f20",
  totalSlides: "\u5171 1 \u5f20",
  deleteWork: "\u5220\u9664\u4f5c\u54c1",
  refreshing: "\u6b63\u5728\u5237\u65b0\u8be6\u60c5",
} as const

const basePhoto: Photo = {
  id: "photo-1",
  src: "https://example.com/photo-1.jpg",
  thumbnailSrc: "https://example.com/photo-1-thumb.jpg",
  width: 1600,
  height: 1000,
  alt: "Misty Waterfall",
  photographer: "Avery Stone",
  category: "Landscape",
  categoryLabel: "Landscape",
  summary: "Cold spray drifting over the rocks at sunrise.",
  location: "Iceland",
  tags: ["Waterfall", "Morning"],
  format: "JPG",
  viewCount: 42,
  likeCount: 7,
  createdAt: "2026-04-28",
  userId: "user-1",
  userAvatar: "https://example.com/avery-avatar.jpg",
}

function renderOverlay(overrides?: Partial<ComponentProps<typeof PhotoPreviewOverlay>>) {
  return render(
    <PhotoPreviewOverlay
      photo={basePhoto}
      photos={[basePhoto]}
      onClose={() => undefined}
      onSelect={() => undefined}
      {...overrides}
    />,
  )
}

describe("PhotoPreviewOverlay", () => {
  test("keeps the information rail hidden until the preview image finishes loading", () => {
    renderOverlay({ isLoading: true })

    expect(screen.queryByLabelText("Preview loading")).not.toBeInTheDocument()
    expect(screen.queryByText("Preparing preview")).not.toBeInTheDocument()
    expect(screen.queryByText("Lissajous Drift")).not.toBeInTheDocument()
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    expect(screen.getByRole("complementary")).toBeInTheDocument()
    expect(screen.getByText("Misty Waterfall")).toBeInTheDocument()
  })

  test("surfaces loading text inside the information rail after the image is ready", () => {
    renderOverlay({ isLoading: true })

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    expect(screen.getByText(COPY.refreshing)).toBeInTheDocument()
  })

  test("reveals the information rail when the preview image is already complete from cache", () => {
    const completeSpy = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true)
    const naturalWidthSpy = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1600)

    renderOverlay({ isLoading: true })

    expect(screen.getByRole("img", { name: "Misty Waterfall" })).toBeInTheDocument()

    return waitFor(() => {
      expect(screen.getByRole("complementary")).toBeInTheDocument()
    }).finally(() => {
      completeSpy.mockRestore()
      naturalWidthSpy.mockRestore()
    })
  })

  test("renders photographer and facts without an inner framed card", () => {
    renderOverlay()

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    const photographerLabel = screen.getByText(COPY.photographer)
    const factsWrapperClassName = photographerLabel.parentElement?.parentElement?.className ?? ""

    expect(factsWrapperClassName).not.toContain("rounded-[1.5rem]")
    expect(factsWrapperClassName).not.toContain("bg-white/24")
    expect(factsWrapperClassName).not.toContain("border")
  })

  test("tints the information rail with a white frosted-glass surface", () => {
    renderOverlay()

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    expect(screen.getByRole("complementary").className).toContain("rgba(255,255,255,0.78)")
  })

  test("lays out supporting details as a continuous editorial metadata flow", () => {
    renderOverlay()

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    const infoFlow = screen.getByTestId("photo-info-flow")

    expect(infoFlow.className).not.toContain("border-t")
    expect(screen.getByText(COPY.photographer).closest("dl")).not.toBeNull()
    expect(screen.getByText(COPY.location).closest("dl")).not.toBeNull()
    expect(screen.getByText(COPY.format).closest("dl")).not.toBeNull()
    expect(screen.getByText(COPY.uploaded).closest("dl")).not.toBeNull()
  })

  test("renders the photographer avatar when available and falls back gracefully when missing", () => {
    const { unmount } = renderOverlay()

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    expect(screen.getByTestId("photo-author-avatar-image")).toHaveAttribute("src", basePhoto.userAvatar)

    unmount()

    render(
      <PhotoPreviewOverlay
        photo={{ ...basePhoto, id: "photo-2", userAvatar: undefined }}
        photos={[{ ...basePhoto, id: "photo-2", userAvatar: undefined }]}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    )

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    expect(screen.queryByTestId("photo-author-avatar-image")).not.toBeInTheDocument()
    expect(screen.getByTestId("photo-author-avatar-fallback")).toBeInTheDocument()
  })

  test("renders view and like counts as separate emphasized stats", () => {
    renderOverlay()

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    expect(screen.getByTestId("photo-stats-row")).toBeInTheDocument()
    expect(screen.getByTestId("photo-stat-views").className).toContain("items-end")
    expect(screen.getByTestId("photo-stat-likes").className).toContain("items-end")
    expect(screen.queryByText("Views / Likes")).not.toBeInTheDocument()
    expect(screen.getByText(COPY.views)).toBeInTheDocument()
    expect(screen.getByText(COPY.likes)).toBeInTheDocument()
    expect(screen.getByText("42").className).toContain("font-semibold")
    expect(screen.getByText("42").className).toContain("tabular-nums")
    expect(screen.getByText("7").className).toContain("font-semibold")
    expect(screen.getByText("7").className).toContain("tabular-nums")
  })

  test("refines information-rail typography colors and footer copy", () => {
    renderOverlay({ canDelete: true, onDelete: () => undefined })

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    expect(screen.getByText("Misty Waterfall").className).toContain("text-[rgba(11,15,24,0.96)]")
    expect(screen.getByText("Iceland").className).toContain("text-[rgba(31,38,52,0.82)]")
    expect(screen.getByText(COPY.views).className).toContain("text-[rgba(11,15,24,0.88)]")
    expect(screen.getByText(COPY.currentView).className).toContain("text-[rgba(15,23,42,0.46)]")
    expect(screen.getByText(COPY.currentSlide).className).toContain("text-[rgba(9,12,20,0.96)]")
    expect(screen.getByText(COPY.totalSlides).className).toContain("text-[rgba(15,23,42,0.8)]")
    expect(screen.getByRole("button", { name: COPY.deleteWork }).className).toContain("bg-[rgba(214,106,120,0.08)]")
  })

  test("makes the information rail visible after the image load completes", async () => {
    renderOverlay()

    fireEvent.load(screen.getByRole("img", { name: "Misty Waterfall" }))

    await waitFor(() => {
      const railClassName = screen.getByRole("complementary").className

      expect(railClassName).toContain("opacity-100")
      expect(railClassName).not.toContain("opacity-0")
    })
  })
})
