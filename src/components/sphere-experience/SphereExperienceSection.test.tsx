import { act, render, screen, waitFor } from "@testing-library/react"

import type { SphereDataSource, SphereImageRecord } from "./types"

vi.mock("./SphereExperienceCanvas", () => ({
  default: function MockSphereExperienceCanvas({
    imageRecords,
    isVisible,
  }: {
    imageRecords: SphereImageRecord[]
    isVisible: boolean
  }) {
    return (
      <div
        data-testid="sphere-experience-canvas"
        data-image-count={String(imageRecords.length)}
        data-visible={String(isVisible)}
      />
    )
  },
}))

import { SphereExperienceSection } from "./SphereExperienceSection"

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

function createImageRecord(overrides: Partial<SphereImageRecord> = {}): SphereImageRecord {
  return {
    id: overrides.id ?? "1",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.jpg",
    alt: overrides.alt ?? "Photo",
  }
}

function getVisibilityObserver() {
  return IntersectionObserverMock.instances.find((observer) => observer.options?.threshold === 0.08)
}

function getPrefetchObserver() {
  return IntersectionObserverMock.instances.find((observer) => observer.options?.rootMargin === "0px")
}

describe("SphereExperienceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock as unknown as typeof IntersectionObserver)
    IntersectionObserverMock.instances = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("defers image loading and canvas mount until the section is near the viewport", async () => {
    const dataSource: SphereDataSource = {
      fetchImages: vi.fn().mockResolvedValue([
        createImageRecord({ id: "1" }),
        createImageRecord({ id: "2", imageUrl: "https://example.com/image-2.jpg" }),
      ]),
    }

    render(<SphereExperienceSection dataSource={dataSource} />)

    expect(dataSource.fetchImages).not.toHaveBeenCalled()
    expect(screen.getByTestId("home-card-sphere")).toHaveAttribute("data-near-viewport", "false")
    expect(screen.queryByTestId("sphere-experience-canvas")).not.toBeInTheDocument()

    act(() => {
      getPrefetchObserver()?.trigger(true)
    })

    await waitFor(() => {
      expect(dataSource.fetchImages).toHaveBeenCalledWith({ limit: 200 })
    })

    await waitFor(() => {
      expect(screen.getByTestId("home-card-sphere")).toHaveAttribute("data-near-viewport", "true")
      expect(screen.getByTestId("sphere-experience-canvas")).toHaveAttribute("data-image-count", "2")
    })
  })

  it("propagates visibility changes to the lazy canvas", async () => {
    const dataSource: SphereDataSource = {
      fetchImages: vi.fn().mockResolvedValue([createImageRecord()]),
    }

    render(<SphereExperienceSection dataSource={dataSource} />)

    act(() => {
      getPrefetchObserver()?.trigger(true)
    })

    await screen.findByTestId("sphere-experience-canvas")

    const visibilityObserver = getVisibilityObserver()
    expect(visibilityObserver).toBeDefined()

    act(() => {
      visibilityObserver?.trigger(false)
    })

    expect(screen.getByTestId("sphere-experience-canvas")).toHaveAttribute("data-visible", "false")

    act(() => {
      visibilityObserver?.trigger(true)
    })

    expect(screen.getByTestId("sphere-experience-canvas")).toHaveAttribute("data-visible", "true")
  })

  it("keeps the canvas mounted with placeholder data when image loading fails", async () => {
    const dataSource: SphereDataSource = {
      fetchImages: vi.fn().mockRejectedValue(new Error("network error")),
    }

    render(<SphereExperienceSection dataSource={dataSource} />)

    act(() => {
      getPrefetchObserver()?.trigger(true)
    })

    await screen.findByTestId("sphere-experience-canvas")

    await waitFor(() => {
      expect(screen.getByTestId("home-card-sphere")).toHaveAttribute("data-load-state", "error")
    })

    expect(screen.getByTestId("sphere-experience-canvas")).toHaveAttribute("data-image-count", "0")
  })
})
