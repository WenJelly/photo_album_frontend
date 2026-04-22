import { Color } from "three"

import type { SphereQualityProfile, SphereSceneMetrics } from "./types"

export interface StarfieldAttributes {
  positions: Float32Array
  colors: Float32Array
  baseSizes: Float32Array
  baseAlphas: Float32Array
  twinklePhases: Float32Array
  twinkleSpeeds: Float32Array
  twinkleAmplitudes: Float32Array
  heroMasks: Float32Array
}

const STARFIELD_SEED = 0x51f15e
const TWO_PI = Math.PI * 2
const NEAR_LAYER_RATIO = 0.22
const NEAR_LAYER_OFFSET = 560
const NEAR_LAYER_RANGE = 620
const FAR_LAYER_OFFSET = 980
const FAR_LAYER_RANGE = 1200
const COOL_WHITE = new Color("#f8fafc")
const COOL_BLUE = new Color("#dbeafe")
const WARM_GOLD = new Color("#fde68a")

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function mix(min: number, max: number, ratio: number) {
  return min + (max - min) * ratio
}

function hashUnitFloat(seed: number, index: number, channel: number) {
  let state = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b)) >>> 0

  state ^= state >>> 16
  state = Math.imul(state, 0x7feb352d) >>> 0
  state ^= state >>> 15
  state = Math.imul(state, 0x846ca68b) >>> 0
  state = (state ^ (state >>> 16)) >>> 0

  return state / 0x100000000
}

function pickStarColor(colorRoll: number) {
  if (colorRoll < 0.78) {
    return COOL_WHITE
  }

  if (colorRoll < 0.94) {
    return COOL_BLUE
  }

  return WARM_GOLD
}

export function buildStarfieldAttributes(
  quality: SphereQualityProfile,
  sceneMetrics: SphereSceneMetrics,
  seed = STARFIELD_SEED,
): StarfieldAttributes {
  const positions = new Float32Array(quality.starCount * 3)
  const colors = new Float32Array(quality.starCount * 3)
  const baseSizes = new Float32Array(quality.starCount)
  const baseAlphas = new Float32Array(quality.starCount)
  const twinklePhases = new Float32Array(quality.starCount)
  const twinkleSpeeds = new Float32Array(quality.starCount)
  const twinkleAmplitudes = new Float32Array(quality.starCount)
  const heroMasks = new Float32Array(quality.starCount)

  for (let index = 0; index < quality.starCount; index += 1) {
    const stride = index * 3
    const layerRoll = hashUnitFloat(seed, index, 0)
    const theta = hashUnitFloat(seed, index, 1) * TWO_PI
    const phi = Math.acos(1 - hashUnitFloat(seed, index, 2) * 2)
    const radiusBase = layerRoll < NEAR_LAYER_RATIO ? sceneMetrics.radius + NEAR_LAYER_OFFSET : sceneMetrics.radius + FAR_LAYER_OFFSET
    const radiusRange = layerRoll < NEAR_LAYER_RATIO ? NEAR_LAYER_RANGE : FAR_LAYER_RANGE
    const radius = radiusBase + hashUnitFloat(seed, index, 3) * radiusRange
    const color = pickStarColor(hashUnitFloat(seed, index, 4))
    const heroMask = hashUnitFloat(seed, index, 5) < quality.starHeroRatio ? 1 : 0
    const sizeRoll = hashUnitFloat(seed, index, 6)
    const alphaRoll = hashUnitFloat(seed, index, 7)
    const twinkleRoll = hashUnitFloat(seed, index, 8)
    const phase = hashUnitFloat(seed, index, 9) * TWO_PI
    const speedRoll = hashUnitFloat(seed, index, 10)
    const amplitudeRoll = hashUnitFloat(seed, index, 11)

    positions[stride] = radius * Math.sin(phi) * Math.cos(theta)
    positions[stride + 1] = radius * Math.cos(phi)
    positions[stride + 2] = radius * Math.sin(phi) * Math.sin(theta)

    colors[stride] = color.r
    colors[stride + 1] = color.g
    colors[stride + 2] = color.b

    baseSizes[index] = heroMask === 1 ? mix(4.4, 7.2, sizeRoll) : mix(1.8, 3.4, sizeRoll)
    baseAlphas[index] = clamp(heroMask === 1 ? mix(0.82, 1, alphaRoll) : mix(0.46, 0.9, alphaRoll), 0.08, 1)
    heroMasks[index] = heroMask
    twinklePhases[index] = phase

    if (twinkleRoll < quality.starTwinkleRatio) {
      twinkleSpeeds[index] = mix(quality.starTwinkleSpeedRange[0], quality.starTwinkleSpeedRange[1], speedRoll) * TWO_PI
      twinkleAmplitudes[index] = mix(
        quality.starTwinkleAmplitudeRange[0],
        quality.starTwinkleAmplitudeRange[1],
        amplitudeRoll,
      )
    }
  }

  return {
    positions,
    colors,
    baseSizes,
    baseAlphas,
    twinklePhases,
    twinkleSpeeds,
    twinkleAmplitudes,
    heroMasks,
  }
}
