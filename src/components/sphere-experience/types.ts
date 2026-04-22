export interface SphereImageRecord {
  id: string
  imageUrl: string
  alt: string
}

export interface SphereDataSource {
  fetchImages(params: { limit: number }): Promise<SphereImageRecord[]>
}

export interface SphereExperienceSectionProps {
  dataSource: SphereDataSource
  onCardClick?: (cardId: string) => void
  className?: string
}

export type SphereInteractionPhase = "idle" | "dragging" | "settling"

export interface SphereQualityProfile {
  tier: "desktop" | "mobile"
  atlasTileSize: number
  starCount: number
  starHeroRatio: number
  starTwinkleRatio: number
  starTwinkleSpeedRange: [number, number]
  starTwinkleAmplitudeRange: [number, number]
  dpr: number
  hoverEnabled: boolean
}

export interface SphereSceneMetrics {
  diameter: number
  radius: number
  cardSize: number
  cameraDistance: number
  fov: number
}

export interface SphereCardPlacement {
  instanceId: number
  cardId: string
  imageIndex: number
  position: [number, number, number]
  quaternion: [number, number, number, number]
}
