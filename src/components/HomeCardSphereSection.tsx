import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { listPictures } from "@/lib/picture-api"
import type { Photo } from "@/types/photo"

interface SphereImageCard {
  id: string
  src: string
  alt: string
}

interface SpherePlacedCard extends SphereImageCard {
  latitudeDeg: number
  longitudeDeg: number
}

interface PointerState {
  dragging: boolean
  visible: boolean
  reducedMotion: boolean
  rotationX: number
  rotationY: number
  velocityX: number
  velocityY: number
  lastClientX: number
  lastClientY: number
  lastMoveAt: number
  pauseAutoUntil: number
}

const SPHERE_COLS = 40
const SPHERE_ROWS = 5
const CARD_GAP_PX = 6
const ROW_STEP_FACTOR = 1.02
const STAGGER_FACTOR = 0.55

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function buildSphereImageCards(photos: Photo[], totalCount: number) {
  if (!photos.length) {
    return []
  }

  return Array.from({ length: totalCount }, (_, index) => {
    const photo = photos[index % photos.length]

    return {
      id: photo.id,
      src: photo.thumbnailSrc ?? photo.src,
      alt: photo.alt,
    } satisfies SphereImageCard
  })
}

function buildOrderedSphereBelt(images: SphereImageCard[]) {
  if (!images.length) {
    return []
  }

  const longitudeStepDeg = 360 / SPHERE_COLS
  const rowStepDeg = longitudeStepDeg * ROW_STEP_FACTOR
  const staggerDeg = rowStepDeg * STAGGER_FACTOR
  const startLatitudeDeg = ((SPHERE_ROWS - 1) * rowStepDeg) / 2

  return Array.from({ length: SPHERE_COLS }, (_, columnIndex) =>
    Array.from({ length: SPHERE_ROWS }, (_, rowIndex) => {
      const image = images[columnIndex * SPHERE_ROWS + rowIndex]
      const columnOffsetDeg = columnIndex % 2 === 0 ? 0 : -staggerDeg

      return {
        ...image,
        id: `${image.id}-${columnIndex}-${rowIndex}`,
        latitudeDeg: startLatitudeDeg - rowIndex * rowStepDeg + columnOffsetDeg,
        longitudeDeg: columnIndex * longitudeStepDeg,
      } satisfies SpherePlacedCard
    }),
  ).flat()
}

export function HomeCardSphereSection() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const sphereRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [spherePhotos, setSpherePhotos] = useState<Photo[]>([])
  const sphereImages = useMemo(
    () => buildSphereImageCards(spherePhotos, SPHERE_COLS * SPHERE_ROWS),
    [spherePhotos],
  )
  const placedCards = useMemo(() => buildOrderedSphereBelt(sphereImages), [sphereImages])
  const pointerStateRef = useRef<PointerState>({
    dragging: false,
    visible: true,
    reducedMotion:
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    rotationX: 0,
    rotationY: 0,
    velocityX: 0,
    velocityY: 0.1,
    lastClientX: 0,
    lastClientY: 0,
    lastMoveAt: 0,
    pauseAutoUntil: 0,
  })

  useEffect(() => {
    let isCancelled = false

    const load = async () => {
      try {
        const result = await listPictures({ pageNum: 1, pageSize: 20 })

        if (isCancelled) {
          return
        }

        setSpherePhotos(result.list)
      } catch {
        if (!isCancelled) {
          setSpherePhotos([])
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [])

  const renderSphere = useCallback(() => {
    const sphere = sphereRef.current
    const state = pointerStateRef.current

    if (!sphere) {
      return
    }

    sphere.style.transform = `translate3d(-50%, -50%, 0) rotateX(${state.rotationX}deg) rotateY(${state.rotationY}deg)`
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const updateMetrics = (width: number, height: number) => {
      const diameter = clamp(Math.min(width * 0.893, height * 1.973), 504, 980)
      const radius = diameter / 2
      const columnArc = (Math.PI * 2 * radius) / SPHERE_COLS
      const cardSize = clamp(columnArc - CARD_GAP_PX, 64, 122)

      viewport.style.setProperty("--sphere-radius", `${Math.round(radius)}px`)
      viewport.style.setProperty("--sphere-diameter", `${Math.round(diameter)}px`)
      viewport.style.setProperty("--sphere-card-size", `${Math.round(cardSize)}px`)
    }

    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      updateMetrics(entry.contentRect.width, entry.contentRect.height)
    })

    observerRef.current.observe(viewport)
    renderSphere()

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [renderSphere])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    let intersectionObserver: IntersectionObserver | null = null

    if (typeof IntersectionObserver === "function") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          pointerStateRef.current.visible = entries[0]?.isIntersecting ?? true
        },
        { threshold: 0.08 },
      )

      intersectionObserver.observe(viewport)
    }

    const step = () => {
      const state = pointerStateRef.current
      const now = typeof performance !== "undefined" ? performance.now() : Date.now()
      let shouldRender = false

      if (state.visible && !state.dragging) {
        if (!state.reducedMotion && now >= state.pauseAutoUntil) {
          state.rotationY += 0.03
          shouldRender = true
        }

        if (Math.abs(state.velocityX) > 0.001 || Math.abs(state.velocityY) > 0.001) {
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
      }

      if (shouldRender) {
        renderSphere()
      }

      frameRef.current = window.requestAnimationFrame(step)
    }

    frameRef.current = window.requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }

      intersectionObserver?.disconnect()
    }
  }, [renderSphere])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current

    state.dragging = true
    state.velocityX = 0
    state.velocityY = 0
    state.lastClientX = event.clientX
    state.lastClientY = event.clientY
    state.lastMoveAt = typeof performance !== "undefined" ? performance.now() : Date.now()

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
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

    renderSphere()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current

    if (!state.dragging) {
      return
    }

    state.dragging = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return (
    <section data-testid="home-card-sphere" className="home-card-sphere-section relative overflow-hidden">
      <div
        ref={viewportRef}
        className="home-card-sphere-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div ref={sphereRef} className="home-card-sphere-orbit">
          {placedCards.map((item) => {
            const pointStyle = {
              "--sphere-lat": `${item.latitudeDeg.toFixed(3)}deg`,
              "--sphere-lon": `${item.longitudeDeg.toFixed(3)}deg`,
            } as CSSProperties

              return (
                <div key={item.id} className="home-card-sphere-node" style={pointStyle}>
                  <div className="home-card-sphere-card">
                    <div className="home-card-sphere-card-face home-card-sphere-card-face--front">
                      <img
                        src={item.src}
                        alt={item.alt}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="home-card-sphere-media"
                      />
                    </div>
                    <div className="home-card-sphere-card-face home-card-sphere-card-face--back" aria-hidden="true">
                      <img
                        src={item.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="home-card-sphere-media"
                      />
                    </div>
                  </div>
                </div>
              )
          })}
        </div>
      </div>
    </section>
  )
}
