import { lazy, Suspense, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import {
  normalizeSphereImageRecords,
  SPHERE_FETCH_LIMIT,
  SPHERE_PREFETCH_ROOT_MARGIN,
  SPHERE_PREFETCH_VIEWPORT_OFFSET_PX,
} from "./constants"
import { primeImageRecords } from "./image-loader"
import type { SphereExperienceSectionProps, SphereImageRecord } from "./types"

type SphereSectionLoadState = "idle" | "loading" | "ready" | "error"
const loadSphereExperienceCanvas = () => import("./SphereExperienceCanvas")
const SphereExperienceCanvas = lazy(loadSphereExperienceCanvas)

function SphereExperiencePlaceholder() {
  return <div className="sphere-experience-loading-shell" aria-hidden="true" />
}

function isSectionNearViewport(section: HTMLElement) {
  if (typeof window === "undefined") {
    return true
  }

  const rect = section.getBoundingClientRect()

  if (rect.height <= 0 && rect.width <= 0) {
    return false
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0

  return rect.bottom >= -SPHERE_PREFETCH_VIEWPORT_OFFSET_PX && rect.top <= viewportHeight + SPHERE_PREFETCH_VIEWPORT_OFFSET_PX
}

export function SphereExperienceSection({ dataSource, onCardClick, className }: SphereExperienceSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [imageRecords, setImageRecords] = useState<SphereImageRecord[]>([])
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof window !== "undefined" && typeof IntersectionObserver !== "function",
  )
  const [isVisible, setIsVisible] = useState(
    () => typeof window !== "undefined" && typeof IntersectionObserver !== "function",
  )
  const [loadState, setLoadState] = useState<SphereSectionLoadState>("loading")

  useEffect(() => {
    if (typeof navigator === "undefined" || !/\bjsdom\b/i.test(navigator.userAgent)) {
      void loadSphereExperienceCanvas()
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current

    if (!section) {
      return
    }

    if (typeof IntersectionObserver !== "function") {
      return
    }

    const syncNearViewportState = () => {
      if (isSectionNearViewport(section)) {
        setIsNearViewport(true)
      }
    }

    const prefetchObserver = new IntersectionObserver(
      (entries) => {
        if (!(entries[0]?.isIntersecting ?? false)) {
          return
        }

        setIsNearViewport(true)
        prefetchObserver.disconnect()
      },
      { rootMargin: SPHERE_PREFETCH_ROOT_MARGIN, threshold: 0.01 },
    )
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        setIsVisible(entries[0]?.isIntersecting ?? true)
      },
      { threshold: 0.08 },
    )

    prefetchObserver.observe(section)
    visibilityObserver.observe(section)
    syncNearViewportState()

    let frameId = 0

    if (typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(() => {
        syncNearViewportState()
      })
    }

    window.addEventListener("pageshow", syncNearViewportState)

    return () => {
      if (frameId && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId)
      }

      window.removeEventListener("pageshow", syncNearViewportState)
      prefetchObserver.disconnect()
      visibilityObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void dataSource
      .fetchImages({ limit: SPHERE_FETCH_LIMIT })
      .then((records) => {
        if (cancelled) {
          return
        }

        setImageRecords(normalizeSphereImageRecords(records))
        setLoadState("ready")
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setImageRecords([])
        setLoadState("error")
      })

    return () => {
      cancelled = true
    }
  }, [dataSource])

  useEffect(() => {
    if (!imageRecords.length) {
      return
    }

    primeImageRecords(imageRecords)
  }, [imageRecords])

  return (
    <section
      ref={sectionRef}
      data-testid="home-card-sphere"
      data-load-state={loadState}
      data-warm-state="warming"
      data-near-viewport={isNearViewport ? "true" : "false"}
      data-visible={isVisible ? "true" : "false"}
      className={cn("sphere-experience-section", className)}
    >
      {isNearViewport ? (
        <Suspense fallback={<SphereExperiencePlaceholder />}>
          <SphereExperienceCanvas imageRecords={imageRecords} isVisible={isVisible} onCardClick={onCardClick} />
        </Suspense>
      ) : (
        <SphereExperiencePlaceholder />
      )}
    </section>
  )
}
