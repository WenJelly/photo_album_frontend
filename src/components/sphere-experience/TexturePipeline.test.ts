import { buildAtlasFallbackAssignments } from "./TexturePipeline"

describe("TexturePipeline fallback assignments", () => {
  it("reuses successful tiles for failed slots", () => {
    expect(buildAtlasFallbackAssignments(6, [1, 4])).toEqual([1, 1, 4, 1, 4, 4])
  })

  it("returns null assignments when no tile loads successfully", () => {
    expect(buildAtlasFallbackAssignments(4, [])).toEqual([null, null, null, null])
  })
})
