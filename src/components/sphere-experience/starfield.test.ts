import { computeSphereSceneMetrics } from "./constants"
import { buildStarfieldAttributes } from "./starfield"
import type { SphereQualityProfile } from "./types"

const DESKTOP_QUALITY: SphereQualityProfile = {
  tier: "desktop",
  atlasTileSize: 256,
  starCount: 2600,
  starHeroRatio: 0.08,
  starTwinkleRatio: 0.18,
  starTwinkleSpeedRange: [0.16, 0.48],
  starTwinkleAmplitudeRange: [0.08, 0.22],
  dpr: 1.5,
  hoverEnabled: true,
}

const MOBILE_QUALITY: SphereQualityProfile = {
  tier: "mobile",
  atlasTileSize: 192,
  starCount: 1300,
  starHeroRatio: 0.05,
  starTwinkleRatio: 0.1,
  starTwinkleSpeedRange: [0.12, 0.34],
  starTwinkleAmplitudeRange: [0.05, 0.14],
  dpr: 1,
  hoverEnabled: false,
}

function countMatches(values: Float32Array, predicate: (value: number, index: number) => boolean) {
  let count = 0

  values.forEach((value, index) => {
    if (predicate(value, index)) {
      count += 1
    }
  })

  return count
}

describe("starfield", () => {
  const sceneMetrics = computeSphereSceneMetrics(1280, 720)

  it("builds deterministic attributes for the same seed", () => {
    const first = buildStarfieldAttributes(DESKTOP_QUALITY, sceneMetrics, 20260422)
    const second = buildStarfieldAttributes(DESKTOP_QUALITY, sceneMetrics, 20260422)

    expect(Array.from(first.positions.slice(0, 12))).toEqual(Array.from(second.positions.slice(0, 12)))
    expect(Array.from(first.baseSizes.slice(0, 8))).toEqual(Array.from(second.baseSizes.slice(0, 8)))
    expect(Array.from(first.twinklePhases.slice(0, 8))).toEqual(Array.from(second.twinklePhases.slice(0, 8)))
  })

  it.each([
    ["desktop", DESKTOP_QUALITY],
    ["mobile", MOBILE_QUALITY],
  ])("matches attribute lengths for %s quality", (_label, quality) => {
    const attributes = buildStarfieldAttributes(quality, sceneMetrics)

    expect(attributes.positions).toHaveLength(quality.starCount * 3)
    expect(attributes.colors).toHaveLength(quality.starCount * 3)
    expect(attributes.baseSizes).toHaveLength(quality.starCount)
    expect(attributes.baseAlphas).toHaveLength(quality.starCount)
    expect(attributes.twinklePhases).toHaveLength(quality.starCount)
    expect(attributes.twinkleSpeeds).toHaveLength(quality.starCount)
    expect(attributes.twinkleAmplitudes).toHaveLength(quality.starCount)
    expect(attributes.heroMasks).toHaveLength(quality.starCount)
  })

  it.each([
    ["desktop", DESKTOP_QUALITY],
    ["mobile", MOBILE_QUALITY],
  ])("keeps star classes and twinkle bands within the configured ranges for %s quality", (_label, quality) => {
    const attributes = buildStarfieldAttributes(quality, sceneMetrics)
    const heroCount = countMatches(attributes.heroMasks, (value) => value === 1)
    const twinkleCount = countMatches(attributes.twinkleAmplitudes, (value) => value > 0)
    const heroRatio = heroCount / quality.starCount
    const twinkleRatio = twinkleCount / quality.starCount

    expect(heroRatio).toBeGreaterThan(quality.starHeroRatio - 0.04)
    expect(heroRatio).toBeLessThan(quality.starHeroRatio + 0.04)
    expect(twinkleRatio).toBeGreaterThan(quality.starTwinkleRatio - 0.05)
    expect(twinkleRatio).toBeLessThan(quality.starTwinkleRatio + 0.05)

    attributes.baseSizes.forEach((size, index) => {
      if (attributes.heroMasks[index] === 1) {
        expect(size).toBeGreaterThanOrEqual(4.4)
        expect(size).toBeLessThanOrEqual(7.2)
        expect(attributes.baseAlphas[index]).toBeGreaterThanOrEqual(0.82)
        expect(attributes.baseAlphas[index]).toBeLessThanOrEqual(1)
        return
      }

      expect(size).toBeGreaterThanOrEqual(1.8)
      expect(size).toBeLessThanOrEqual(3.4)
      expect(attributes.baseAlphas[index]).toBeGreaterThanOrEqual(0.46)
      expect(attributes.baseAlphas[index]).toBeLessThanOrEqual(0.9)
    })

    attributes.twinkleAmplitudes.forEach((amplitude, index) => {
      if (amplitude === 0) {
        expect(attributes.twinkleSpeeds[index]).toBe(0)
        return
      }

      expect(amplitude).toBeGreaterThanOrEqual(quality.starTwinkleAmplitudeRange[0])
      expect(amplitude).toBeLessThanOrEqual(quality.starTwinkleAmplitudeRange[1])
      expect(attributes.twinkleSpeeds[index]).toBeGreaterThanOrEqual(quality.starTwinkleSpeedRange[0] * Math.PI * 2)
      expect(attributes.twinkleSpeeds[index]).toBeLessThanOrEqual(quality.starTwinkleSpeedRange[1] * Math.PI * 2)
    })
  })
})
