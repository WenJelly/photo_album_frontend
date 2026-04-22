import type { SphereImageRecord, SphereSceneMetrics } from "./types"

export const SPHERE_COLS = 40
export const SPHERE_ROWS = 5
export const SPHERE_INSTANCE_COUNT = SPHERE_COLS * SPHERE_ROWS
export const SPHERE_FETCH_LIMIT = 20
export const SPHERE_PREFETCH_ROOT_MARGIN = "0px"

const CARD_GAP_PX = 6
const CSS_PERSPECTIVE_PX = 1600
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function sanitizeSphereImageRecord(record: SphereImageRecord) {
  return {
    id: record.id,
    imageUrl: record.imageUrl.trim(),
    alt: record.alt.trim() || "Gallery image",
  } satisfies SphereImageRecord
}

export function normalizeSphereImageRecords(records: SphereImageRecord[]) {
  return records
    .map(sanitizeSphereImageRecord)
    .filter((record, index, items) => record.imageUrl && items.findIndex((item) => item.id === record.id) === index)
}

export function createPlaceholderSphereRecord() {
  return {
    id: "placeholder",
    imageUrl: "",
    alt: "Placeholder image",
  } satisfies SphereImageRecord
}

export function computeSphereSceneMetrics(width: number, height: number): SphereSceneMetrics {
  const safeWidth = Math.max(width, 320)
  const safeHeight = Math.max(height, 320)
  const diameter = clamp(Math.min(safeWidth * 0.893, safeHeight * 1.973), 504, 980)
  const baseRadius = diameter / 2
  const radius = baseRadius
  const columnArc = (Math.PI * 2 * baseRadius) / SPHERE_COLS
  const cardSize = clamp(columnArc - CARD_GAP_PX, 64, 122)
  const fov = (2 * Math.atan(safeHeight / (2 * CSS_PERSPECTIVE_PX)) * 180) / Math.PI

  return {
    diameter,
    radius,
    cardSize,
    cameraDistance: CSS_PERSPECTIVE_PX,
    fov,
  }
}
