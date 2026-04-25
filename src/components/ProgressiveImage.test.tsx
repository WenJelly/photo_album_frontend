import { act, fireEvent, render, screen } from "@testing-library/react"

import { ProgressiveImage } from "./ProgressiveImage"

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = []

  readonly callback: IntersectionObserverCallback
  readonly options?: IntersectionObserverInit
  observedTarget: Element | null = null

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
    IntersectionObserverMock.instances.push(this)
  }

  observe(target: Element) {
    this.observedTarget = target
  }

  disconnect() {}

  unobserve() {}

  trigger(isIntersecting: boolean) {
    if (!this.observedTarget) {
      return
    }

    this.callback(
      [
        {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          target: this.observedTarget,
          time: 0,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    )
  }
}

describe("ProgressiveImage", () => {
  beforeEach(() => {
    IntersectionObserverMock.instances = []
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock as unknown as typeof IntersectionObserver)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(32 * 32 * 4) })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("reserves image space while delaying the network source until near viewport", () => {
    render(
      <ProgressiveImage
        src="https://example.com/full.webp"
        alt="Example"
        width={1200}
        height={800}
        dominantColor="#A1B2C3"
      />,
    )

    const frame = screen.getByTestId("progressive-image-frame")
    const image = screen.getByRole("img", { name: "Example" })

    expect(frame).toHaveStyle({ aspectRatio: "1200 / 800" })
    expect(image).not.toHaveAttribute("src")

    act(() => {
      IntersectionObserverMock.instances[0]?.trigger(true)
    })

    expect(image).toHaveAttribute("src", "https://example.com/full.webp")
    expect(image).toHaveAttribute("data-loaded", "false")

    fireEvent.load(image)

    expect(image).toHaveAttribute("data-loaded", "true")
  })

  it("renders a canvas placeholder when a blur hash is available", () => {
    render(
      <ProgressiveImage
        src="https://example.com/full.webp"
        alt="Example"
        width={1200}
        height={800}
        dominantColor="#A1B2C3"
        blurHash="00TI:j"
      />,
    )

    expect(screen.getByTestId("progressive-image-blurhash")).toBeInTheDocument()
  })
})
