import { forwardRef, useEffect, useMemo, useRef } from "react"
import { BufferGeometry, Float32BufferAttribute, NormalBlending, Points, ShaderMaterial } from "three"
import { useFrame, useThree } from "@react-three/fiber"

import { buildStarfieldAttributes } from "./starfield"
import type { SphereQualityProfile, SphereSceneMetrics } from "./types"

interface StarfieldLayerProps {
  quality: SphereQualityProfile
  sceneMetrics: SphereSceneMetrics
  isVisible: boolean
  reducedMotion: boolean
}

const VERTEX_SHADER = `
attribute vec3 color;
attribute float aBaseSize;
attribute float aBaseAlpha;
attribute float aTwinklePhase;
attribute float aTwinkleSpeed;
attribute float aTwinkleAmplitude;
attribute float aHeroMask;

uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkleEnabled;

varying vec3 vColor;
varying float vAlpha;
varying float vHeroMask;

void main() {
  float twinkleWave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
  float twinkleAmplitude = uTwinkleEnabled > 0.5 ? aTwinkleAmplitude : 0.0;
  float twinkleStrength = uTwinkleEnabled > 0.5 ? twinkleWave : 0.0;
  float heroPulse = 1.0 + aHeroMask * twinkleAmplitude * 0.45 * twinkleStrength;

  vColor = color;
  vHeroMask = aHeroMask;
  vAlpha = clamp(aBaseAlpha * (1.0 + twinkleAmplitude * twinkleStrength), 0.06, 1.0);

  gl_PointSize = max(aBaseSize * uPixelRatio * heroPulse, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;
varying float vHeroMask;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float dist = length(centered);

  if (dist > 0.5) {
    discard;
  }

  float core = smoothstep(0.24, 0.0, dist);
  float halo = smoothstep(0.5, 0.08, dist);
  float glowStrength = mix(0.28, 0.48, vHeroMask);
  float alpha = clamp(vAlpha * (core + halo * glowStrength), 0.0, 1.0);

  gl_FragColor = vec4(vColor, alpha);
  #include <colorspace_fragment>
}
`

export const StarfieldLayer = forwardRef<Points, StarfieldLayerProps>(function StarfieldLayer(
  { quality, sceneMetrics, isVisible, reducedMotion },
  ref,
) {
  const { gl, invalidate } = useThree()
  const timeRef = useRef(0)
  const attributes = useMemo(() => buildStarfieldAttributes(quality, sceneMetrics), [quality, sceneMetrics])
  const geometry = useMemo(() => {
    const nextGeometry = new BufferGeometry()

    nextGeometry.setAttribute("position", new Float32BufferAttribute(attributes.positions, 3))
    nextGeometry.setAttribute("color", new Float32BufferAttribute(attributes.colors, 3))
    nextGeometry.setAttribute("aBaseSize", new Float32BufferAttribute(attributes.baseSizes, 1))
    nextGeometry.setAttribute("aBaseAlpha", new Float32BufferAttribute(attributes.baseAlphas, 1))
    nextGeometry.setAttribute("aTwinklePhase", new Float32BufferAttribute(attributes.twinklePhases, 1))
    nextGeometry.setAttribute("aTwinkleSpeed", new Float32BufferAttribute(attributes.twinkleSpeeds, 1))
    nextGeometry.setAttribute("aTwinkleAmplitude", new Float32BufferAttribute(attributes.twinkleAmplitudes, 1))
    nextGeometry.setAttribute("aHeroMask", new Float32BufferAttribute(attributes.heroMasks, 1))
    nextGeometry.computeBoundingSphere()

    return nextGeometry
  }, [attributes])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uPixelRatio: { value: 1 },
          uTime: { value: 0 },
          uTwinkleEnabled: { value: reducedMotion ? 0 : 1 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: NormalBlending,
        toneMapped: false,
      }),
    [reducedMotion],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useEffect(() => {
    material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    invalidate()
  }, [gl, invalidate, material])

  useEffect(() => {
    material.uniforms.uTwinkleEnabled.value = reducedMotion ? 0 : 1

    if (reducedMotion) {
      timeRef.current = 0
      material.uniforms.uTime.value = 0
    }

    invalidate()
  }, [invalidate, material, reducedMotion])

  useFrame((_, delta) => {
    if (!isVisible || reducedMotion) {
      return
    }

    timeRef.current += Math.min(delta, 1 / 20)
    material.uniforms.uTime.value = timeRef.current
  })

  return <points ref={ref} geometry={geometry} material={material} renderOrder={0} frustumCulled={false} />
})
