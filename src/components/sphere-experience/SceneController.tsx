import { useEffect } from "react"
import type { MutableRefObject } from "react"
import { Group, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from "three"
import { useFrame, useThree } from "@react-three/fiber"

import type { SphereSceneMetrics } from "./types"
import type { useMotionController } from "./MotionController"

interface SceneControllerProps {
  motion: ReturnType<typeof useMotionController>
  sceneMetrics: SphereSceneMetrics
  sphereGroupRef: MutableRefObject<Group | null>
  onContextLossChange: (isLost: boolean) => void
  onInvalidateReady: (invalidate: () => void) => void
}

const X_AXIS = new Vector3(1, 0, 0)
const Y_AXIS = new Vector3(0, 1, 0)
const rotateXQuaternion = new Quaternion()
const rotateYQuaternion = new Quaternion()

export function SceneController({
  motion,
  sceneMetrics,
  sphereGroupRef,
  onContextLossChange,
  onInvalidateReady,
}: SceneControllerProps) {
  const { camera, gl, invalidate } = useThree()
  const perspectiveCamera = camera as PerspectiveCamera

  useEffect(() => {
    onInvalidateReady(invalidate)
  }, [invalidate, onInvalidateReady])

  useEffect(() => {
    perspectiveCamera.position.set(0, 0, sceneMetrics.cameraDistance)
    perspectiveCamera.lookAt(0, 0, 0)
    perspectiveCamera.near = 0.1
    perspectiveCamera.far = sceneMetrics.cameraDistance + 3200
    perspectiveCamera.fov = sceneMetrics.fov
    perspectiveCamera.updateProjectionMatrix()

    gl.setClearAlpha(0)
    invalidate()
  }, [gl, invalidate, perspectiveCamera, sceneMetrics.cameraDistance, sceneMetrics.fov])

  useEffect(() => {
    const canvas = gl.domElement

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      onContextLossChange(true)
    }

    const handleContextRestored = () => {
      onContextLossChange(false)
      invalidate()
    }

    canvas.addEventListener("webglcontextlost", handleContextLost)
    canvas.addEventListener("webglcontextrestored", handleContextRestored)

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost)
      canvas.removeEventListener("webglcontextrestored", handleContextRestored)
    }
  }, [gl.domElement, invalidate, onContextLossChange])

  useFrame(() => {
    const frame = motion.advanceFrame()
    const sphereGroup = sphereGroupRef.current

    if (sphereGroup && frame.shouldRender) {
      rotateXQuaternion.setFromAxisAngle(X_AXIS, -MathUtils.degToRad(motion.rotationRef.current.x))
      rotateYQuaternion.setFromAxisAngle(Y_AXIS, MathUtils.degToRad(motion.rotationRef.current.y))
      sphereGroup.quaternion.copy(rotateXQuaternion).multiply(rotateYQuaternion)
    }

    if (frame.continueAnimating) {
      invalidate()
    }
  })

  return null
}
