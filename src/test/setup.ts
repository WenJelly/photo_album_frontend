import "@testing-library/jest-dom/vitest"

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 1280,
            height: 720,
            x: 0,
            y: 0,
            top: 0,
            right: 1280,
            bottom: 720,
            left: 0,
            toJSON() {
              return this
            },
          },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    )
  }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
