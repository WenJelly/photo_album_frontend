import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from "react"

export type IslandView = "expanded" | "compact" | "task"

interface UseIslandControllerOptions {
  hasTask: boolean
  routeKey: string
}

const HOVER_MEDIA_QUERY = "(hover: hover) and (pointer: fine)"
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const COMPACT_ENTER_SCROLL_PX = 96
const EXPANDED_TOP_SCROLL_PX = 40
const UPWARD_RELEASE_PX = 28

function readMediaQueryMatch(query: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }

  return window.matchMedia(query).matches
}

export function useIslandController({ hasTask, routeKey }: UseIslandControllerOptions) {
  const rootRef = useRef<HTMLElement | null>(null)
  const lastScrollYRef = useRef(0)
  const upwardReleaseStartRef = useRef<number | null>(null)
  const compactEnterAnchorRef = useRef(0)
  const compactPreferenceRef = useRef(false)
  const scrollFrameRef = useRef<number | null>(null)
  const [canHover, setCanHover] = useState(() => readMediaQueryMatch(HOVER_MEDIA_QUERY))
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => readMediaQueryMatch(REDUCED_MOTION_QUERY))
  const [prefersCompact, setPrefersCompact] = useState(false)
  const [isHoverExpanded, setIsHoverExpanded] = useState(false)
  const [isFocusExpanded, setIsFocusExpanded] = useState(false)
  const [isManualExpanded, setIsManualExpanded] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia(HOVER_MEDIA_QUERY)
    const update = () => setCanHover(mediaQuery.matches)

    update()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update)
      return () => mediaQuery.removeEventListener("change", update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = () => setPrefersReducedMotion(mediaQuery.matches)

    update()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update)
      return () => mediaQuery.removeEventListener("change", update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  const syncCompactPreference = useCallback((nextScrollY: number, options?: { reset?: boolean }) => {
    const previousCompactPreference = compactPreferenceRef.current
    const previousScrollY = options?.reset ? nextScrollY : lastScrollYRef.current
    const delta = nextScrollY - previousScrollY

    if (options?.reset) {
      upwardReleaseStartRef.current = null
      compactEnterAnchorRef.current = nextScrollY
    } else if (compactPreferenceRef.current) {
      if (delta > 0) {
        upwardReleaseStartRef.current = null
      } else if (delta < 0 && upwardReleaseStartRef.current === null) {
        upwardReleaseStartRef.current = previousScrollY
      }
    } else if (delta < 0 || nextScrollY < compactEnterAnchorRef.current) {
      compactEnterAnchorRef.current = nextScrollY
    }

    let nextCompactPreference = compactPreferenceRef.current

    if (nextScrollY <= EXPANDED_TOP_SCROLL_PX) {
      nextCompactPreference = false
      upwardReleaseStartRef.current = null
      compactEnterAnchorRef.current = nextScrollY
    } else if (!nextCompactPreference) {
      const downwardTravel = nextScrollY - compactEnterAnchorRef.current

      if (downwardTravel >= COMPACT_ENTER_SCROLL_PX) {
        nextCompactPreference = true
      }
    } else {
      const upwardReleaseDistance =
        upwardReleaseStartRef.current === null ? 0 : upwardReleaseStartRef.current - nextScrollY

      if (upwardReleaseDistance >= UPWARD_RELEASE_PX) {
        nextCompactPreference = false
        upwardReleaseStartRef.current = null
        compactEnterAnchorRef.current = nextScrollY
      }
    }

    compactPreferenceRef.current = nextCompactPreference
    setPrefersCompact(nextCompactPreference)

    if (nextCompactPreference && !previousCompactPreference) {
      setIsHoverExpanded(false)
    }

    if (!nextCompactPreference) {
      setIsManualExpanded(false)
    }

    lastScrollYRef.current = nextScrollY
  }, [])

  useLayoutEffect(() => {
    const nextScrollY = typeof window !== "undefined" ? window.scrollY : 0

    setIsHoverExpanded(false)
    setIsFocusExpanded(false)
    setIsManualExpanded(false)
    compactPreferenceRef.current = false
    compactEnterAnchorRef.current = nextScrollY
    lastScrollYRef.current = nextScrollY
    upwardReleaseStartRef.current = null
    syncCompactPreference(nextScrollY, { reset: true })
  }, [routeKey, syncCompactPreference])

  useLayoutEffect(() => {
    if (!hasTask) {
      return
    }

    setIsHoverExpanded(false)
    setIsFocusExpanded(false)
    setIsManualExpanded(false)
  }, [hasTask])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const scheduleSync = () => {
      if (scrollFrameRef.current !== null) {
        return
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null
        syncCompactPreference(window.scrollY)
      })
    }

    window.addEventListener("scroll", scheduleSync, { passive: true })
    return () => {
      window.removeEventListener("scroll", scheduleSync)

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [routeKey, syncCompactPreference])

  const isInteractionExpanded = canHover
    ? isHoverExpanded || isFocusExpanded
    : isManualExpanded || isFocusExpanded
  const view: IslandView = hasTask ? "task" : prefersCompact && !isInteractionExpanded ? "compact" : "expanded"

  return {
    canHover,
    prefersReducedMotion,
    rootRef,
    view,
    onBlurCapture(event: FocusEvent<HTMLElement>) {
      if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
        setIsFocusExpanded(false)
      }
    },
    onCompactToggle() {
      if (hasTask || canHover) {
        return
      }

      setIsManualExpanded((current) => !current)
    },
    onFocusCapture() {
      if (hasTask) {
        return
      }

      setIsFocusExpanded(true)
    },
    onMouseEnter() {
      if (!hasTask && canHover && compactPreferenceRef.current) {
        setIsHoverExpanded(true)
      }
    },
    onMouseLeave() {
      if (canHover) {
        setIsHoverExpanded(false)
      }
    },
  }
}
