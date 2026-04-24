import { PerspectiveCamera, Vector3 } from "three"

import { applySceneMetricsToCamera } from "./scene-camera"
import type { SphereSceneMetrics } from "./types"

describe("applySceneMetricsToCamera", () => {
  it("applies the scene metrics without replacing the active camera instance", () => {
    const camera = new PerspectiveCamera(60, 16 / 9, 0.5, 2400)
    const sceneMetrics: SphereSceneMetrics = {
      diameter: 920,
      radius: 460,
      cardSize: 108,
      cameraDistance: 1600,
      fov: 27,
    }

    applySceneMetricsToCamera(camera, sceneMetrics)

    expect(camera.position.toArray()).toEqual([0, 0, 1600])
    expect(camera.near).toBe(0.1)
    expect(camera.far).toBe(4800)
    expect(camera.fov).toBe(27)
    const direction = camera.getWorldDirection(new Vector3())

    expect(direction.x).toBeCloseTo(0)
    expect(direction.y).toBeCloseTo(0)
    expect(direction.z).toBeCloseTo(-1)
  })
})
