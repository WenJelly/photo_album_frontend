import { loadSphereImageRecord } from "./image-loader"

describe("loadSphereImageRecord", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("falls back to the original image url when the thumbnail fails", async () => {
    const requestedUrls: string[] = []

    class MockImage {
      width = 320
      height = 320
      decoding = "async"
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin: string | null = null
      referrerPolicy = ""

      decode() {
        return Promise.resolve()
      }

      set src(value: string) {
        requestedUrls.push(value)

        if (value.includes("thumb")) {
          this.onerror?.()
          return
        }

        this.onload?.()
      }
    }

    vi.stubGlobal("Image", MockImage as unknown as typeof Image)

    await expect(
      loadSphereImageRecord({
        id: "1",
        imageUrl: "https://example.com/thumb.jpg",
        fallbackImageUrl: "https://example.com/photo.jpg",
        alt: "Photo",
      }),
    ).resolves.toBeInstanceOf(MockImage)

    expect(requestedUrls).toEqual(["https://example.com/thumb.jpg", "https://example.com/photo.jpg"])
  })

  it("loads the fallback image when the primary url is empty", async () => {
    const requestedUrls: string[] = []

    class MockImage {
      width = 320
      height = 320
      decoding = "async"
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin: string | null = null
      referrerPolicy = ""

      decode() {
        return Promise.resolve()
      }

      set src(value: string) {
        requestedUrls.push(value)
        this.onload?.()
      }
    }

    vi.stubGlobal("Image", MockImage as unknown as typeof Image)

    await expect(
      loadSphereImageRecord({
      id: "1",
      imageUrl: "   ",
      fallbackImageUrl: "https://example.com/photo-fallback.jpg",
      alt: "Photo",
    }),
    ).resolves.toMatchObject({ width: 320, height: 320 })

    expect(requestedUrls).toEqual(["https://example.com/photo-fallback.jpg"])
  })
})
