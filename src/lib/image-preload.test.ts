import { warmImageSource } from "@/lib/image-preload"

describe("warmImageSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("ignores empty image sources", async () => {
    await expect(warmImageSource("   ")).resolves.toBeUndefined()
    await expect(warmImageSource(null)).resolves.toBeUndefined()
  })

  it("resolves even when image decoding fails", async () => {
    class MockImage {
      decoding = "async"
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        this.onload?.()
      }

      decode() {
        return Promise.reject(new Error("decode failed"))
      }
    }

    vi.stubGlobal("Image", MockImage as unknown as typeof Image)

    await expect(warmImageSource("https://example.com/prewarm.jpg")).resolves.toBeUndefined()
  })
})
