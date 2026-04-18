import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PhotoPreviewOverlay } from "@/components/PhotoPreviewOverlay"
import { photos } from "@/data/photos"

describe("PhotoPreviewOverlay", () => {
  it("locks body scroll, compensates scrollbar width, and restores both on cleanup", () => {
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 })
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1184 })

    const { unmount } = render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(document.body.style.overflow).toBe("hidden")
    expect(document.body.style.paddingRight).toBe("16px")
    unmount()
    expect(document.body.style.overflow).toBe("")
    expect(document.body.style.paddingRight).toBe("")

    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth })
  })

  it("moves to the next photo with the arrow key", () => {
    const onSelect = vi.fn()

    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={onSelect}
      />
    )

    fireEvent.keyDown(document, { key: "ArrowRight" })

    expect(onSelect).toHaveBeenCalledWith(photos[1])
  })

  it("disables navigation at the edges instead of wrapping", () => {
    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(screen.getByRole("button", { name: /上一张图片/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /下一张图片/i })).toBeEnabled()
  })

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={onClose}
        onSelect={() => {}}
      />
    )

    await user.click(screen.getByTestId("preview-backdrop"))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("treats only the image-plus-sidebar body as the preview area", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={onClose}
        onSelect={() => {}}
      />
    )

    await user.click(screen.getByTestId("preview-stage"))
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    await user.click(screen.getByTestId("preview-body"))
    expect(onClose).toHaveBeenCalledTimes(0)
  })

  it("does not render a close button", () => {
    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(screen.queryByRole("button", { name: /关闭预览/i })).not.toBeInTheDocument()
  })

  it("centers the image-plus-sidebar body as one unit", () => {
    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(screen.getByTestId("preview-stage")).toHaveClass("items-center")
    expect(screen.getByTestId("preview-stage")).toHaveClass("justify-center")
    expect(screen.getByTestId("preview-body")).toHaveClass("w-fit")
  })

  it("caps the desktop preview body width so the whole composition can stay centered", () => {
    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(screen.getByTestId("preview-body")).toHaveClass("md:max-w-[1600px]")
    expect(screen.getByRole("img", { name: photos[0].alt })).toHaveClass(
      "md:max-w-[min(calc(100vw-440px),1240px)]"
    )
  })

  it("uses a subtle blurred backdrop behind the preview", () => {
    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(screen.getByTestId("preview-backdrop")).toHaveClass("backdrop-blur-[10px]")
  })

  it("uses the rendered image height for the sidebar height and keeps the desktop body gapless", () => {
    const imageRectSpy = vi
      .spyOn(HTMLImageElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => new DOMRect(100, 80, 720, 420))

    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    const image = screen.getByRole("img", { name: photos[0].alt })
    fireEvent.load(image)

    expect(screen.getByRole("complementary")).toHaveStyle({ height: "420px" })
    expect(screen.getByTestId("preview-body").className).not.toMatch(/\bgap-/)

    imageRectSpy.mockRestore()
  })

  it("does not render a thumbnail transition proxy or loading veil", () => {
    const { container } = render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(container.querySelector(".bg-cover")).toBeNull()
    expect(container.querySelector(".animate-pulse")).toBeNull()
    expect(screen.getByRole("img", { name: photos[0].alt })).not.toHaveClass("opacity-0")
  })

  it("keeps a mobile-first stacked layout with desktop row classes", () => {
    render(
      <PhotoPreviewOverlay
        photo={photos[0]}
        photos={photos.slice(0, 3)}
        onClose={() => {}}
        onSelect={() => {}}
      />
    )

    expect(screen.getByTestId("preview-body")).toHaveClass("flex-col")
    expect(screen.getByTestId("preview-body")).toHaveClass("md:flex-row")
  })
})
