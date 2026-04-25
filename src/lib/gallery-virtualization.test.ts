import { getVisibleRowRange, type VirtualRowMetric } from "./gallery-virtualization"

function createRows(count: number, height = 100): VirtualRowMetric[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    start: index * height,
    height,
    end: (index + 1) * height,
  }))
}

describe("gallery row virtualization", () => {
  it("returns only rows inside the viewport plus overscan", () => {
    const range = getVisibleRowRange(createRows(20), {
      scrollTop: 450,
      viewportHeight: 300,
      overscan: 50,
    })

    expect(range).toEqual({ start: 4, end: 8 })
  })

  it("keeps the first row visible near the top boundary", () => {
    const range = getVisibleRowRange(createRows(20), {
      scrollTop: 0,
      viewportHeight: 240,
      overscan: 100,
    })

    expect(range).toEqual({ start: 0, end: 4 })
  })

  it("returns an empty range when there are no rows", () => {
    expect(
      getVisibleRowRange([], {
        scrollTop: 0,
        viewportHeight: 500,
        overscan: 100,
      }),
    ).toEqual({ start: 0, end: 0 })
  })
})
