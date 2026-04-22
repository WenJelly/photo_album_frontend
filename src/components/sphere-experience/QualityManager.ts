import { useEffect, useState } from "react"

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

function resolveQualityProfile() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return DESKTOP_QUALITY
  }

  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches
  const isCompactViewport = window.matchMedia("(max-width: 780px)").matches
  const maxDpr = window.devicePixelRatio || 1

  if (isCoarsePointer || isCompactViewport) {
    return {
      ...MOBILE_QUALITY,
      dpr: Math.min(maxDpr, MOBILE_QUALITY.dpr),
    } satisfies SphereQualityProfile
  }

  return {
    ...DESKTOP_QUALITY,
    dpr: Math.min(maxDpr, DESKTOP_QUALITY.dpr),
  } satisfies SphereQualityProfile
}

export function useQualityManager() {
  const [profile, setProfile] = useState<SphereQualityProfile>(() => resolveQualityProfile())

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)")
    const compactViewportQuery = window.matchMedia("(max-width: 780px)")
    const updateProfile = () => {
      setProfile(resolveQualityProfile())
    }

    coarsePointerQuery.addEventListener?.("change", updateProfile)
    compactViewportQuery.addEventListener?.("change", updateProfile)
    window.addEventListener("resize", updateProfile)

    return () => {
      coarsePointerQuery.removeEventListener?.("change", updateProfile)
      compactViewportQuery.removeEventListener?.("change", updateProfile)
      window.removeEventListener("resize", updateProfile)
    }
  }, [])

  return profile
}
