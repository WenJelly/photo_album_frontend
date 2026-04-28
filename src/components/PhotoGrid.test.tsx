import { fireEvent, render, screen } from "@testing-library/react"

import { PhotoGrid } from "@/components/PhotoGrid"
import type { Photo } from "@/types/photo"

const galleryPhoto: Photo = {
  id: "photo-1",
  src: "https://example.com/photo-1.jpg",
  thumbnailSrc: "https://example.com/photo-1-thumb.jpg",
  width: 1200,
  height: 800,
  alt: "Glass Lake",
  photographer: "Avery Stone",
  category: "Landscape",
  categoryLabel: "Landscape",
  summary: "Still water under a bright sky.",
  location: "Alaska",
  tags: ["Lake"],
}

describe("PhotoGrid", () => {
  test("reports the clicked card rect together with the selected photo", () => {
    const onPhotoClick = vi.fn()

    render(<PhotoGrid photos={[galleryPhoto]} onPhotoClick={onPhotoClick} />)

    const openButton = screen.getByRole("button", { name: "查看图片 Glass Lake" })

    Object.defineProperty(openButton, "getBoundingClientRect", {
      value: () => ({
        x: 18,
        y: 24,
        width: 240,
        height: 160,
        top: 24,
        left: 18,
        right: 258,
        bottom: 184,
        toJSON() {
          return this
        },
      }),
    })

    fireEvent.click(openButton)

    expect(onPhotoClick).toHaveBeenCalledTimes(1)
    expect(onPhotoClick).toHaveBeenCalledWith(
      galleryPhoto,
      expect.objectContaining({
        x: 18,
        y: 24,
        width: 240,
        height: 160,
      }),
    )
  })

  test("does not render dominant-color or blurhash placeholders for waterfall cards", () => {
    const { container } = render(<PhotoGrid photos={[galleryPhoto]} />)

    const image = screen.getByRole("img", { name: "Glass Lake" })
    const imageFrame = image.parentElement

    expect(container.querySelector("canvas")).not.toBeInTheDocument()
    expect(imageFrame).not.toBeNull()
    expect(imageFrame?.style.backgroundColor).toBe("")
  })
})
