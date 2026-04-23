import { forwardRef, useCallback, useEffect, useMemo, useRef } from "react"
import type { MutableRefObject } from "react"
import { DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial } from "three"
import type { ThreeEvent } from "@react-three/fiber"

import { buildSphereCardPlacements } from "./layout"
import type { SphereInteractionPhase, SphereQualityProfile, SphereSceneMetrics, SphereImageRecord } from "./types"
import type { SphereAtlasResource } from "./TexturePipeline"

interface SphereInstancesProps {
  atlas: SphereAtlasResource
  imageRecords: SphereImageRecord[]
  interactionPhase: SphereInteractionPhase
  interactionPhaseRef: MutableRefObject<SphereInteractionPhase>
  quality: SphereQualityProfile
  sceneMetrics: SphereSceneMetrics
  requestRender: () => void
  onCardClick?: (cardId: string) => void
}

type InstanceAwareEvent = {
  instanceId?: number | null
}

const VERTEX_SHADER = `
attribute vec2 instanceUvOffset;
attribute vec2 instanceUvScale;
attribute float instanceHover;

varying vec2 vFaceUv;
varying vec2 vAtlasOffset;
varying vec2 vAtlasScale;
varying float vHover;
varying float vDepthShade;

void main() {
  vFaceUv = uv;
  vAtlasOffset = instanceUvOffset;
  vAtlasScale = instanceUvScale;
  vHover = instanceHover;

  float scale = mix(1.0, 1.035, instanceHover);
  vec3 transformed = vec3(position.xy * scale, position.z);
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);

  vDepthShade = clamp((-mvPosition.z - 260.0) / 2200.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

const FRAGMENT_SHADER = `
#include <common>

uniform sampler2D uAtlas;

varying vec2 vFaceUv;
varying vec2 vAtlasOffset;
varying vec2 vAtlasScale;
varying float vHover;
varying float vDepthShade;

float roundedBoxSdf(vec2 point, vec2 bounds, float radius) {
  vec2 query = abs(point) - bounds + vec2(radius);
  return length(max(query, 0.0)) + min(max(query.x, query.y), 0.0) - radius;
}

void main() {
  float adjustedX = gl_FrontFacing ? vFaceUv.x : (1.0 - vFaceUv.x);
  vec2 faceUv = vec2(adjustedX, 1.0 - vFaceUv.y);
  vec2 atlasUv = vAtlasOffset + faceUv * vAtlasScale;
  vec4 texel = texture2D(uAtlas, atlasUv);

  vec2 point = faceUv * 2.0 - 1.0;
  float sdf = roundedBoxSdf(point, vec2(0.93, 0.93), 0.08);
  float antialias = 0.018;
  float mask = 1.0 - smoothstep(0.0, antialias, sdf);
  float border = 1.0 - smoothstep(-0.026, 0.016, sdf);
  vec3 color = texel.rgb;
  color = mix(color, texel.rgb * 1.015, vHover);
  color = mix(color, vec3(1.0), border * 0.015);

  float alpha = mask;

  if (alpha < 0.08) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`

export const SphereInstances = forwardRef<Group, SphereInstancesProps>(function SphereInstances(
  { atlas, imageRecords, interactionPhase, interactionPhaseRef, quality, sceneMetrics, requestRender, onCardClick },
  ref,
) {
  const meshRef = useRef<InstancedMesh<PlaneGeometry, ShaderMaterial> | null>(null)
  const hoveredInstanceRef = useRef<number | null>(null)
  const cardIdsRef = useRef<string[]>([])
  const placements = useMemo(() => buildSphereCardPlacements(imageRecords, sceneMetrics.radius), [imageRecords, sceneMetrics.radius])
  const geometry = useMemo(() => {
    const nextGeometry = new PlaneGeometry(1, 1, 1, 1)

    nextGeometry.setAttribute(
      "instanceUvOffset",
      new InstancedBufferAttribute(new Float32Array(placements.length * 2), 2),
    )
    nextGeometry.setAttribute(
      "instanceUvScale",
      new InstancedBufferAttribute(new Float32Array(placements.length * 2), 2),
    )
    nextGeometry.setAttribute("instanceHover", new InstancedBufferAttribute(new Float32Array(placements.length), 1))

    return nextGeometry
  }, [placements.length])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uAtlas: { value: atlas.texture },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        // Treat the cards as alpha-cutout surfaces instead of blended transparency.
        // Instanced transparent meshes are not sorted per-card, which can produce false holes.
        transparent: false,
        depthWrite: true,
        alphaTest: 0.08,
        side: DoubleSide,
      }),
    [atlas.texture],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useEffect(() => {
    material.uniforms.uAtlas.value = atlas.texture
    material.needsUpdate = true
  }, [atlas.texture, material])

  const applyHover = useCallback(
    (instanceId: number | null) => {
      const mesh = meshRef.current

      if (!mesh) {
        return
      }

      const hoverAttribute = mesh.geometry.getAttribute("instanceHover") as InstancedBufferAttribute
      const previousHoveredInstance = hoveredInstanceRef.current

      if (previousHoveredInstance === instanceId) {
        return
      }

      if (previousHoveredInstance !== null) {
        hoverAttribute.setX(previousHoveredInstance, 0)
      }

      if (instanceId !== null) {
        hoverAttribute.setX(instanceId, 1)
      }

      hoveredInstanceRef.current = instanceId
      hoverAttribute.needsUpdate = true
      requestRender()
    },
    [requestRender],
  )

  useEffect(() => {
    if (interactionPhase === "dragging") {
      applyHover(null)
    }
  }, [applyHover, interactionPhase])

  useEffect(() => {
    const mesh = meshRef.current

    if (!mesh) {
      return
    }

    const dummy = new Object3D()
    const uvOffsetAttribute = mesh.geometry.getAttribute("instanceUvOffset") as InstancedBufferAttribute
    const uvScaleAttribute = mesh.geometry.getAttribute("instanceUvScale") as InstancedBufferAttribute
    const hoverAttribute = mesh.geometry.getAttribute("instanceHover") as InstancedBufferAttribute

    cardIdsRef.current = placements.map((placement) => placement.cardId)
    mesh.count = placements.length

    for (const placement of placements) {
      const tile = atlas.tiles[placement.imageIndex % atlas.tiles.length]

      dummy.position.set(...placement.position)
      dummy.quaternion.set(...placement.quaternion)
      dummy.scale.set(sceneMetrics.cardSize, sceneMetrics.cardSize, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(placement.instanceId, dummy.matrix)
      uvOffsetAttribute.setXY(placement.instanceId, tile.offset[0], tile.offset[1])
      uvScaleAttribute.setXY(placement.instanceId, tile.scale[0], tile.scale[1])
      hoverAttribute.setX(placement.instanceId, 0)
    }

    hoveredInstanceRef.current = null
    mesh.frustumCulled = false
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    uvOffsetAttribute.needsUpdate = true
    uvScaleAttribute.needsUpdate = true
    hoverAttribute.needsUpdate = true
    requestRender()
  }, [atlas.tiles, placements, requestRender, sceneMetrics.cardSize])

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const instanceId = (event as ThreeEvent<PointerEvent> & InstanceAwareEvent).instanceId

      if (!quality.hoverEnabled || interactionPhaseRef.current === "dragging") {
        applyHover(null)
        return
      }

      if (typeof instanceId !== "number") {
        applyHover(null)
        return
      }

      event.stopPropagation()
      applyHover(instanceId)
    },
    [applyHover, interactionPhaseRef, quality.hoverEnabled],
  )

  const handlePointerOut = useCallback(() => {
    applyHover(null)
  }, [applyHover])

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const instanceId = (event as ThreeEvent<MouseEvent> & InstanceAwareEvent).instanceId

      if (interactionPhaseRef.current === "dragging" || typeof instanceId !== "number") {
        return
      }

      event.stopPropagation()
      onCardClick?.(cardIdsRef.current[instanceId] ?? "")
    },
    [interactionPhaseRef, onCardClick],
  )

  return (
    <group ref={ref}>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, placements.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        renderOrder={1}
      />
    </group>
  )
})
