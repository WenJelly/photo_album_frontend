import { computeSphereSceneMetrics, SPHERE_COLS, SPHERE_INSTANCE_COUNT, SPHERE_ROWS } from "./constants"
import { buildSphereCardPlacements } from "./layout"

describe("sphere-experience constants", () => {
  it("builds the expected 40 x 5 sphere layout and preserves radius", () => {
    const placements = buildSphereCardPlacements(
      [
        { id: "1", imageUrl: "https://example.com/1.jpg", alt: "One" },
        { id: "2", imageUrl: "https://example.com/2.jpg", alt: "Two" },
      ],
      320,
    )

    expect(placements).toHaveLength(SPHERE_INSTANCE_COUNT)
    expect(placements[0]?.cardId).toBe("1")
    expect(placements[1]?.cardId).toBe("2")
    expect(placements[2]?.cardId).toBe("1")

    const firstRadius = Math.hypot(...(placements[0]?.position ?? [0, 0, 0]))
    const lastRadius = Math.hypot(...(placements.at(-1)?.position ?? [0, 0, 0]))

    expect(firstRadius).toBeCloseTo(320, 5)
    expect(lastRadius).toBeCloseTo(320, 5)
  })

  it("keeps the existing diameter and card sizing rhythm", () => {
    const metrics = computeSphereSceneMetrics(1280, 720)

    expect(metrics).toMatchObject({
      diameter: 980,
      radius: 490,
      cameraDistance: 1600,
    })
    expect(metrics.cardSize).toBeCloseTo(70.96902001294993, 12)
  })

  it("keeps latitude staggering consistent across odd and even columns", () => {
    const placements = buildSphereCardPlacements([{ id: "1", imageUrl: "https://example.com/1.jpg", alt: "One" }], 320)

    Array.from({ length: SPHERE_ROWS }, (_, rowIndex) => {
      const firstEvenY = placements[rowIndex]?.position[1] ?? 0
      const firstOddY = placements[SPHERE_ROWS + rowIndex]?.position[1] ?? 0

      expect(firstOddY).not.toBeCloseTo(firstEvenY, 5)

      Array.from({ length: SPHERE_COLS }, (_, columnIndex) => {
        const placement = placements[columnIndex * SPHERE_ROWS + rowIndex]
        const expectedY = columnIndex % 2 === 0 ? firstEvenY : firstOddY
        expect(placement?.position[1]).toBeCloseTo(expectedY, 5)
      })
    })
  })
})
