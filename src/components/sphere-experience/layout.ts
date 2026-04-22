import { Quaternion, Vector3 } from "three"

import { createPlaceholderSphereRecord, SPHERE_COLS, SPHERE_ROWS } from "./constants"
import type { SphereCardPlacement, SphereImageRecord } from "./types"

const BASE_ROW_STEP_FACTOR = 0.854
const LATITUDE_SPACING_SCALE = 1.06 * 1.1 * 1.1
const ROW_STEP_FACTOR = BASE_ROW_STEP_FACTOR * LATITUDE_SPACING_SCALE
const STAGGER_FACTOR = 0.55
const CARD_FORWARD = new Vector3(0, 0, 1)
const X_AXIS = new Vector3(1, 0, 0)
const Y_AXIS = new Vector3(0, 1, 0)

export function buildSphereCardPlacements(records: SphereImageRecord[], radius: number): SphereCardPlacement[] {
  const pool = records.length ? records : [createPlaceholderSphereRecord()]
  const longitudeStepDeg = 360 / SPHERE_COLS
  const rowStepDeg = longitudeStepDeg * ROW_STEP_FACTOR
  const staggerDeg = rowStepDeg * STAGGER_FACTOR
  const startLatitudeDeg = ((SPHERE_ROWS - 1) * rowStepDeg) / 2

  return Array.from({ length: SPHERE_COLS }, (_, columnIndex) =>
    Array.from({ length: SPHERE_ROWS }, (_, rowIndex) => {
      const instanceId = columnIndex * SPHERE_ROWS + rowIndex
      const record = pool[instanceId % pool.length]
      const longitudeDeg = columnIndex * longitudeStepDeg
      const columnOffsetDeg = columnIndex % 2 === 0 ? 0 : -staggerDeg
      const latitudeDeg = startLatitudeDeg - rowIndex * rowStepDeg + columnOffsetDeg
      const latitudeRad = (latitudeDeg * Math.PI) / 180
      const longitudeRad = (longitudeDeg * Math.PI) / 180
      // Match the old CSS node transform: rotateY(lon) rotateX(lat) translateZ(radius).
      // CSS X rotation maps to the inverse mathematical X direction in Three's Y-up space.
      const rotateX = new Quaternion().setFromAxisAngle(X_AXIS, -latitudeRad)
      const rotateY = new Quaternion().setFromAxisAngle(Y_AXIS, longitudeRad)
      const quaternion = rotateY.clone().multiply(rotateX)
      const position = CARD_FORWARD.clone().applyQuaternion(quaternion).multiplyScalar(radius)

      return {
        instanceId,
        cardId: record.id,
        imageIndex: instanceId % pool.length,
        position: [position.x, position.y, position.z],
        quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      } satisfies SphereCardPlacement
    }),
  ).flat()
}
