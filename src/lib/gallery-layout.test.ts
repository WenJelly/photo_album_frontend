import { describe, expect, it } from "vitest"

import { buildJustifiedRows } from "@/lib/gallery-layout"

const landscapeSet = [
  { id: "a", width: 1800, height: 1200 },
  { id: "b", width: 2200, height: 1400 },
  { id: "c", width: 1600, height: 1200 },
  { id: "d", width: 1200, height: 1800 },
  { id: "e", width: 2400, height: 1600 },
]

const exhibitionSet = [
  { id: "a", width: 1800, height: 1200 },
  { id: "b", width: 2200, height: 1400 },
  { id: "c", width: 1600, height: 1200 },
  { id: "d", width: 1200, height: 1800 },
  { id: "e", width: 2400, height: 1600 },
  { id: "f", width: 1500, height: 1200 },
  { id: "g", width: 1400, height: 1200 },
  { id: "h", width: 1320, height: 1200 },
]

const portraitHeavySet = [
  { id: "a", width: 4000, height: 6000 },
  { id: "b", width: 3387, height: 5081 },
  { id: "c", width: 4928, height: 3264 },
  { id: "d", width: 5472, height: 3648 },
  { id: "e", width: 3456, height: 5184 },
  { id: "f", width: 4000, height: 6000 },
]

const wideMixedSet = [
  { id: "a", width: 3456, height: 5184 },
  { id: "b", width: 5472, height: 3648 },
  { id: "c", width: 3456, height: 5184 },
  { id: "d", width: 5184, height: 3456 },
  { id: "e", width: 4928, height: 3264 },
]

describe("buildJustifiedRows", () => {
  it("balances larger sets into multiple rows close to the target height", () => {
    const rows = buildJustifiedRows(exhibitionSet, {
      containerWidth: 1280,
      gap: 12,
      targetRowHeight: 280,
      minRowHeight: 220,
      maxRowHeight: 360,
    })

    expect(rows).toHaveLength(2)
    expect(rows[0].height).toBeGreaterThanOrEqual(220)
    expect(rows[0].height).toBeLessThanOrEqual(360)
    expect(rows[1].height).toBeGreaterThanOrEqual(220)
    expect(rows[1].height).toBeLessThanOrEqual(360)
    expect(rows[0].width).toBeCloseTo(1280, 1)
    expect(rows[1].width).toBeCloseTo(1280, 1)
  })

  it("lets the last row keep its natural width instead of force-filling", () => {
    const rows = buildJustifiedRows(landscapeSet.slice(0, 3), {
      containerWidth: 1440,
      gap: 12,
      targetRowHeight: 320,
      minRowHeight: 220,
      maxRowHeight: 380,
    })

    const lastRow = rows.at(-1)

    expect(lastRow).toBeDefined()
    expect(lastRow?.isLastRow).toBe(true)
    expect(lastRow?.width).toBeLessThan(1440)
  })

  it("recomputes row groups when the container becomes narrower", () => {
    const wideRows = buildJustifiedRows(exhibitionSet, {
      containerWidth: 1320,
      gap: 12,
      targetRowHeight: 290,
      minRowHeight: 220,
      maxRowHeight: 360,
    })
    const narrowRows = buildJustifiedRows(exhibitionSet, {
      containerWidth: 720,
      gap: 8,
      targetRowHeight: 250,
      minRowHeight: 180,
      maxRowHeight: 300,
    })

    expect(wideRows).toHaveLength(2)
    expect(narrowRows.length).toBeGreaterThan(wideRows.length)
    expect(narrowRows.every((row) => row.height >= 180)).toBe(true)
  })

  it("avoids oversized rows for portrait-heavy filtered sets", () => {
    const rows = buildJustifiedRows(portraitHeavySet, {
      containerWidth: 1280,
      gap: 12,
      targetRowHeight: 320,
      minRowHeight: 260,
      maxRowHeight: 400,
    })

    expect(rows.every((row) => row.height <= 400)).toBe(true)
    expect(rows.slice(0, -1).every((row) => row.width === 1280)).toBe(true)
  })

  it("splits small mixed-aspect filtered sets instead of collapsing into one thin row", () => {
    const rows = buildJustifiedRows(wideMixedSet, {
      containerWidth: 1280,
      gap: 12,
      targetRowHeight: 320,
      minRowHeight: 260,
      maxRowHeight: 400,
    })

    expect(rows.length).toBeGreaterThan(1)
    expect(rows.every((row) => row.height >= 260)).toBe(true)
  })

  it("fills every non-last row and lets the last row end naturally", () => {
    const rows = buildJustifiedRows(exhibitionSet, {
      containerWidth: 1280,
      gap: 12,
      targetRowHeight: 300,
      minRowHeight: 220,
      maxRowHeight: 380,
    })

    const nonLastRows = rows.slice(0, -1)
    const lastRow = rows.at(-1)

    expect(nonLastRows.length).toBeGreaterThan(0)
    expect(nonLastRows.every((row) => row.width === 1280)).toBe(true)
    expect(lastRow).toBeDefined()
    expect(lastRow?.isLastRow).toBe(true)
    expect(lastRow?.width).toBeLessThanOrEqual(1280)
  })
})
