import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import type { SphereInteractionPhase } from "./types"

interface PointerState {
  dragging: boolean
  rotationX: number
  rotationY: number
  velocityX: number
  velocityY: number
  lastClientX: number
  lastClientY: number
  lastMoveAt: number
  pauseAutoUntil: number
}

interface MotionControllerOptions {
  isVisible: boolean
  reducedMotion: boolean
  requestRender: () => void
}

interface FrameStepResult {
  shouldRender: boolean
  continueAnimating: boolean
}

const SETTLING_DURATION_MS = 320
const AUTO_ROTATION_STEP = 0.035

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function useMotionController({ isVisible, reducedMotion, requestRender }: MotionControllerOptions) {
  const pointerStateRef = useRef<PointerState>({
    dragging: false,
    rotationX: 0,
    rotationY: 0,
    velocityX: 0,
    velocityY: 0.1,
    lastClientX: 0,
    lastClientY: 0,
    lastMoveAt: 0,
    pauseAutoUntil: 0,
  })
  const rotationRef = useRef({ x: 0, y: 0 })
  const phaseRef = useRef<SphereInteractionPhase>("idle")
  const visibilityRef = useRef(isVisible)
  const reducedMotionRef = useRef(reducedMotion)
  const dirtyRef = useRef(true)
  const settlingTimeoutRef = useRef<number | null>(null)
  const [phase, setPhase] = useState<SphereInteractionPhase>("idle")

  const setInteractionPhase = useCallback((nextPhase: SphereInteractionPhase) => {
    if (phaseRef.current === nextPhase) {
      return
    }

    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const syncRotationRef = useCallback(() => {
    rotationRef.current.x = pointerStateRef.current.rotationX
    rotationRef.current.y = pointerStateRef.current.rotationY
  }, [])

  const clearSettlingTimer = useCallback(() => {
    if (settlingTimeoutRef.current !== null) {
      window.clearTimeout(settlingTimeoutRef.current)
      settlingTimeoutRef.current = null
    }
  }, [])

  const requestFrame = useCallback(() => {
    dirtyRef.current = true
    requestRender()
  }, [requestRender])

  useEffect(() => {
    visibilityRef.current = isVisible

    if (isVisible) {
      requestFrame()
    }
  }, [isVisible, requestFrame])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
    requestFrame()
  }, [reducedMotion, requestFrame])

  useEffect(() => {
    return () => {
      clearSettlingTimer()
    }
  }, [clearSettlingTimer])

  const advanceFrame = useCallback((): FrameStepResult => {
    const state = pointerStateRef.current
    const now = typeof performance !== "undefined" ? performance.now() : Date.now()
    let shouldRender = dirtyRef.current

    if (visibilityRef.current && !state.dragging && !reducedMotionRef.current && now >= state.pauseAutoUntil) {
      state.rotationY += AUTO_ROTATION_STEP
      shouldRender = true
    }

    if (!state.dragging && (Math.abs(state.velocityX) > 0.001 || Math.abs(state.velocityY) > 0.001)) {
      state.rotationX = clamp(state.rotationX + state.velocityX, -24, 24)
      state.rotationY += state.velocityY
      state.velocityX *= 0.94
      state.velocityY *= 0.94

      if (Math.abs(state.velocityX) < 0.001) {
        state.velocityX = 0
      }

      if (Math.abs(state.velocityY) < 0.001) {
        state.velocityY = 0
      }

      shouldRender = true
    }

    if (shouldRender) {
      syncRotationRef()
      dirtyRef.current = false
    }

    const hasMomentum = Math.abs(state.velocityX) > 0.001 || Math.abs(state.velocityY) > 0.001
    const autoRotationEnabled = visibilityRef.current && !reducedMotionRef.current
    const waitingForAutoResume = !state.dragging && autoRotationEnabled && now < state.pauseAutoUntil
    const autoRotationActive = !state.dragging && autoRotationEnabled && now >= state.pauseAutoUntil

    return {
      shouldRender,
      continueAnimating: state.dragging || hasMomentum || waitingForAutoResume || autoRotationActive,
    }
  }, [syncRotationRef])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }

      const state = pointerStateRef.current
      const now = typeof performance !== "undefined" ? performance.now() : Date.now()

      clearSettlingTimer()
      setInteractionPhase("dragging")

      state.dragging = true
      state.velocityX = 0
      state.velocityY = 0
      state.lastClientX = event.clientX
      state.lastClientY = event.clientY
      state.lastMoveAt = now
      state.pauseAutoUntil = now + SETTLING_DURATION_MS

      requestFrame()
    },
    [clearSettlingTimer, requestFrame, setInteractionPhase],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = pointerStateRef.current

      if (!state.dragging) {
        return
      }

      const now = typeof performance !== "undefined" ? performance.now() : Date.now()
      const deltaX = event.clientX - state.lastClientX
      const deltaY = event.clientY - state.lastClientY
      const deltaTime = Math.max(now - state.lastMoveAt, 16)

      state.rotationY += deltaX * 0.24
      state.rotationX = clamp(state.rotationX - deltaY * 0.18, -24, 24)
      state.velocityY = (deltaX / deltaTime) * 1.25
      state.velocityX = (-deltaY / deltaTime) * 0.92
      state.lastClientX = event.clientX
      state.lastClientY = event.clientY
      state.lastMoveAt = now
      state.pauseAutoUntil = now + SETTLING_DURATION_MS

      requestFrame()
    },
    [requestFrame],
  )

  const handlePointerUp = useCallback(
    (_event: ReactPointerEvent<HTMLDivElement>) => {
      const state = pointerStateRef.current
      const now = typeof performance !== "undefined" ? performance.now() : Date.now()

      if (!state.dragging) {
        return
      }

      state.dragging = false
      state.pauseAutoUntil = now + SETTLING_DURATION_MS

      clearSettlingTimer()
      setInteractionPhase("settling")
      requestFrame()

      settlingTimeoutRef.current = window.setTimeout(() => {
        settlingTimeoutRef.current = null
        setInteractionPhase("idle")
        requestFrame()
      }, SETTLING_DURATION_MS)
    },
    [clearSettlingTimer, requestFrame, setInteractionPhase],
  )

  return {
    phase,
    phaseRef,
    rotationRef,
    requestFrame,
    advanceFrame,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onPointerLeave: handlePointerUp,
    },
  }
}
