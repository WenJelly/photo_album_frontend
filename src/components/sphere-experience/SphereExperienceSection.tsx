import { lazy, Suspense, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import { normalizeSphereImageRecords, SPHERE_FETCH_LIMIT, SPHERE_PREFETCH_ROOT_MARGIN } from "./constants"
import { primeImageRecords } from "./image-loader"
import type { SphereExperienceSectionProps, SphereImageRecord } from "./types"

type SphereSectionLoadState = "idle" | "loading" | "ready" | "error"
const loadSphereExperienceCanvas = () => import("./SphereExperienceCanvas")
const SphereExperienceCanvas = lazy(loadSphereExperienceCanvas)

function SphereExperiencePlaceholder() {
  return <div className="sphere-experience-loading-shell" aria-hidden="true" />
}

function queueIdleWork(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 1800 })

    return () => {
      window.cancelIdleCallback(idleId)
    }
  }

  const timeoutId = globalThis.setTimeout(callback, 1200)

  return () => {
    globalThis.clearTimeout(timeoutId)
  }
}

export function SphereExperienceSection({ dataSource, onCardClick, className }: SphereExperienceSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [imageRecords, setImageRecords] = useState<SphereImageRecord[]>([])
  const [shouldWarmResources, setShouldWarmResources] = useState(false)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [loadState, setLoadState] = useState<SphereSectionLoadState>("idle")

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    let cancelIdleWork = () => {}

    const scheduleWarmup = () => {
      cancelIdleWork = queueIdleWork(() => {
        setShouldWarmResources(true)
        void loadSphereExperienceCanvas()
      })
    }

    if (document.readyState === "complete") {
      scheduleWarmup()
    } else {
      window.addEventListener("load", scheduleWarmup, { once: true })
    }

    return () => {
      window.removeEventListener("load", scheduleWarmup)
      cancelIdleWork()
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current

    if (!section) {
      return
    }

    if (typeof IntersectionObserver !== "function") {
      setIsNearViewport(true)
      setIsVisible(true)
      return
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

    return () => {
      prefetchObserver.disconnect()
      visibilityObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if ((!shouldWarmResources && !isNearViewport) || loadState === "loading" || loadState === "ready") {
      return
    }

    if (loadState === "error" && !isNearViewport) {
      return
    }

    let cancelled = false

    setLoadState("loading")

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
  }, [dataSource, isNearViewport, shouldWarmResources])

  useEffect(() => {
    if (!imageRecords.length || (!shouldWarmResources && !isNearViewport)) {
      return
    }

    primeImageRecords(imageRecords)
  }, [imageRecords, isNearViewport, shouldWarmResources])

  return (
    <section
      ref={sectionRef}
      data-testid="home-card-sphere"
      data-load-state={loadState}
      data-warm-state={shouldWarmResources ? "warming" : "idle"}
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
