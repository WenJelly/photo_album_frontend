import { PerspectiveCamera } from "three"

import type { SphereSceneMetrics } from "./types"

export function applySceneMetricsToCamera(camera: PerspectiveCamera, sceneMetrics: SphereSceneMetrics) {
  const configuredCamera = camera.clone()

  configuredCamera.position.set(0, 0, sceneMetrics.cameraDistance)
  configuredCamera.lookAt(0, 0, 0)
  configuredCamera.near = 0.1
  configuredCamera.far = sceneMetrics.cameraDistance + 3200
  configuredCamera.fov = sceneMetrics.fov
  configuredCamera.updateProjectionMatrix()

  camera.copy(configuredCamera)
}
