import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react"
import { Canvas } from "@react-three/fiber"
import type { Group } from "three"

import { computeSphereSceneMetrics } from "./constants"
import { useMotionController } from "./MotionController"
import { useQualityManager } from "./QualityManager"
import { SceneController } from "./SceneController"
import { SphereInstances } from "./SphereInstances"
import { StarfieldLayer } from "./StarfieldLayer"
import { useTexturePipeline } from "./TexturePipeline"
import type { SphereImageRecord } from "./types"

interface SphereExperienceCanvasProps {
  imageRecords: SphereImageRecord[]
  isVisible: boolean
  onCardClick?: (cardId: string) => void
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => {
      setReducedMotion(mediaQuery.matches)
    }

    mediaQuery.addEventListener?.("change", update)

    return () => {
      mediaQuery.removeEventListener?.("change", update)
    }
  }, [])

  return reducedMotion
}

function useElementSize() {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 1280, height: 720 })

  useEffect(() => {
    const element = elementRef.current

    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      setSize({
        width: Math.max(entry.contentRect.width, 320),
        height: Math.max(entry.contentRect.height, 320),
      })
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  return {
    elementRef,
    size,
  }
}

function renderStatusLabel(label: string) {
  return <span className="sphere-experience-status-chip">{label}</span>
}

export default function SphereExperienceCanvas({
  imageRecords,
  isVisible,
  onCardClick,
}: SphereExperienceCanvasProps) {
  const quality = useQualityManager()
  const reducedMotion = useReducedMotion()
  const invalidateRef = useRef<(() => void) | null>(null)
  const sphereGroupRef = useRef<Group | null>(null)
  const { elementRef, size } = useElementSize()
  const sceneMetrics = useMemo(() => computeSphereSceneMetrics(size.width, size.height), [size.height, size.width])
  const [isContextLost, setIsContextLost] = useState(false)
  const requestRender = useCallback(() => {
    invalidateRef.current?.()
  }, [])
  const motion = useMotionController({
    isVisible,
    reducedMotion,
    requestRender,
  })
  const { atlas, status } = useTexturePipeline(imageRecords, {
    tileSize: quality.atlasTileSize,
    onAtlasInvalidate: requestRender,
  })

  useEffect(() => {
    requestRender()
  }, [atlas, requestRender, status])

  const shellStyle = {
    "--sphere-diameter": `${Math.round(sceneMetrics.diameter)}px`,
  } as CSSProperties

  let statusContent: ReactNode = null

  if (isContextLost) {
    statusContent = renderStatusLabel("WebGL 恢复中")
  } else if (status === "error") {
    statusContent = renderStatusLabel("已切换占位纹理")
  }

  return (
    <div
      ref={elementRef}
      className="sphere-experience-canvas-shell"
      data-atlas-status={status}
      data-interaction-phase={motion.phase}
      style={shellStyle}
      onPointerDown={motion.handlers.onPointerDown}
      onPointerMove={motion.handlers.onPointerMove}
      onPointerUp={motion.handlers.onPointerUp}
      onPointerCancel={motion.handlers.onPointerCancel}
      onPointerLeave={motion.handlers.onPointerLeave}
    >
      <Canvas
        className="sphere-experience-canvas"
        dpr={quality.dpr}
        frameloop="demand"
        eventSource={elementRef as RefObject<HTMLElement>}
        eventPrefix="client"
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <SceneController
          motion={motion}
          sceneMetrics={sceneMetrics}
          sphereGroupRef={sphereGroupRef}
          onContextLossChange={setIsContextLost}
          onInvalidateReady={(invalidate) => {
            invalidateRef.current = invalidate
          }}
        />
        <StarfieldLayer
          quality={quality}
          sceneMetrics={sceneMetrics}
          isVisible={isVisible}
          reducedMotion={reducedMotion}
        />
        {atlas ? (
          <SphereInstances
            ref={sphereGroupRef}
            atlas={atlas}
            imageRecords={imageRecords}
            interactionPhase={motion.phase}
            interactionPhaseRef={motion.phaseRef}
            quality={quality}
            sceneMetrics={sceneMetrics}
            requestRender={requestRender}
            onCardClick={onCardClick}
          />
        ) : null}
      </Canvas>
      {statusContent ? <div className="sphere-experience-status-layer">{statusContent}</div> : null}
    </div>
  )
}
