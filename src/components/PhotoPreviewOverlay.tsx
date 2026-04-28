import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { preloadImages } from "@/lib/image-preload"
import { PHOTO_DETAIL_TAG_LIMIT, getTagDisplay } from "@/lib/photo-tags"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"
import type { PhotoPreviewOriginRect } from "@/types/photo-preview"

interface PhotoPreviewOverlayProps {
  photo: Photo
  photos: Photo[]
  originRect?: PhotoPreviewOriginRect | null
  onClose: () => void
  onSelect: (photo: Photo) => void
  onDelete?: () => void
  onPhotographerClick?: (photo: Photo) => void
  canDelete?: boolean
  isDeleting?: boolean
  isLoading?: boolean
  errorMessage?: string | null
}

const DESKTOP_BREAKPOINT = 768
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const OPENING_TRANSITION_MS = 460

function readMediaQueryMatch(query: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }

  return window.matchMedia(query).matches
}

function getPreviewSrc(photo: Photo) {
  return photo.src
}

function describeDimensions(photo: Photo) {
  return `${photo.width} \u00d7 ${photo.height}`
}

function getPhotographerInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?"
}

const RAIL_COPY = {
  format: "\u683c\u5f0f",
  size: "\u5c3a\u5bf8",
  uploaded: "\u4e0a\u4f20\u65f6\u95f4",
  views: "\u6d4f\u89c8",
  likes: "\u70b9\u8d5e",
} as const

const railTextToneClassNames = {
  eyebrow: "text-[rgba(45,52,68,0.58)]",
  title: "text-[rgba(11,15,24,0.96)]",
  body: "text-[rgba(31,38,52,0.82)]",
  chip: "text-[rgba(41,48,64,0.76)]",
  label: "text-[rgba(22,28,40,0.62)]",
  value: "text-[rgba(11,15,24,0.88)]",
  accent: "text-[rgba(9,12,20,0.96)]",
  footerEyebrow: "text-[rgba(15,23,42,0.46)]",
  footerPrimary: "text-[rgba(9,12,20,0.96)]",
  footerDivider: "text-[rgba(15,23,42,0.32)]",
  footerSecondary: "text-[rgba(15,23,42,0.8)]",
} as const

const railChipSurfaceClassName =
  "rounded-full border border-[rgba(255,255,255,0.62)] bg-[rgba(255,255,255,0.52)] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
const railHeroChipSurfaceClassName =
  "rounded-full border border-[rgba(255,255,255,0.66)] bg-[rgba(255,255,255,0.62)] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
const railAuthorAvatarClassName =
  "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,255,255,0.7)] bg-[rgba(255,255,255,0.66)] text-[rgba(18,24,38,0.84)] shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
const railDeleteButtonClassName =
  "rounded-full border border-[rgba(214,106,120,0.18)] bg-[rgba(214,106,120,0.08)] px-3.5 text-[rgba(120,30,49,0.92)] shadow-none hover:bg-[rgba(214,106,120,0.14)] focus-visible:border-[rgba(214,106,120,0.3)] focus-visible:ring-[rgba(214,106,120,0.18)]"

export function PhotoPreviewOverlay({
  photo,
  photos,
  originRect = null,
  onClose,
  onSelect,
  onDelete,
  onPhotographerClick,
  canDelete = false,
  isDeleting = false,
  isLoading = false,
  errorMessage = null,
}: PhotoPreviewOverlayProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const imageReadyFrameRef = useRef<number | null>(null)
  const railRevealFrameRef = useRef<number | null>(null)
  const transitionTokenRef = useRef(0)
  const hasAnimatedFromOriginRef = useRef(false)
  const [imageHeight, setImageHeight] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => readMediaQueryMatch(REDUCED_MOTION_QUERY))
  const [isBackdropEntered, setIsBackdropEntered] = useState(false)
  const [isStageAtRest, setIsStageAtRest] = useState(prefersReducedMotion || !originRect)
  const [openingTransform, setOpeningTransform] = useState<string | null>(null)
  const [displayedPhotoState, setDisplayedPhotoState] = useState(photo)
  const [isDisplayedImageReady, setIsDisplayedImageReady] = useState(false)
  const [isRailVisible, setIsRailVisible] = useState(false)

  const displayedPhoto = photo.id === displayedPhotoState.id ? photo : displayedPhotoState
  const isPhotoTransitionPending = photo.id !== displayedPhotoState.id
  const contentPhoto = isPhotoTransitionPending ? displayedPhoto : photo.id === displayedPhoto.id ? photo : displayedPhoto
  const activePhotoId = contentPhoto.id
  const currentIndex = useMemo(() => photos.findIndex((item) => item.id === activePhotoId), [activePhotoId, photos])
  const previousPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null
  const nextPhoto = currentIndex >= 0 && currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null
  const previewSrc = getPreviewSrc(displayedPhoto)
  const categoryLabel = contentPhoto.categoryLabel ?? contentPhoto.category
  const { visibleTags, hiddenCount } = getTagDisplay(contentPhoto.tags, { maxVisible: PHOTO_DETAIL_TAG_LIMIT })
  const photographerInitial = getPhotographerInitial(contentPhoto.photographer)
  const detailFacts = [
    { id: "format", label: RAIL_COPY.format, value: contentPhoto.format ?? "-" },
    { id: "size", label: RAIL_COPY.size, value: describeDimensions(contentPhoto) },
    { id: "uploaded", label: RAIL_COPY.uploaded, value: contentPhoto.createdAt ?? "-" },
  ]
  const detailStats = [
    { id: "views", label: RAIL_COPY.views, value: contentPhoto.viewCount ?? 0 },
    { id: "likes", label: RAIL_COPY.likes, value: contentPhoto.likeCount ?? 0 },
  ]

  const revealRail = () => {
    if (railRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(railRevealFrameRef.current)
    }

    railRevealFrameRef.current = window.requestAnimationFrame(() => {
      setIsRailVisible(true)
      railRevealFrameRef.current = null
    })
  }

  const markImageReady = () => {
    const nextHeight = imageRef.current?.getBoundingClientRect().height ?? 0
    setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
    setIsDisplayedImageReady(true)
    revealRail()
  }

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    }

    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsBackdropEntered(true))

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useLayoutEffect(() => {
    if (prefersReducedMotion || !originRect || !stageRef.current || hasAnimatedFromOriginRef.current) {
      setOpeningTransform(null)
      setIsStageAtRest(true)
      return
    }

    const finalRect = stageRef.current.getBoundingClientRect()

    if (!finalRect.width || !finalRect.height) {
      setOpeningTransform(null)
      setIsStageAtRest(true)
      return
    }

    const originCenterX = originRect.x + originRect.width / 2
    const originCenterY = originRect.y + originRect.height / 2
    const finalCenterX = finalRect.left + finalRect.width / 2
    const finalCenterY = finalRect.top + finalRect.height / 2
    const translateX = originCenterX - finalCenterX
    const translateY = originCenterY - finalCenterY
    const scaleX = Math.max(originRect.width / finalRect.width, 0.16)
    const scaleY = Math.max(originRect.height / finalRect.height, 0.16)

    setOpeningTransform(`translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`)
    setIsStageAtRest(false)
    hasAnimatedFromOriginRef.current = true

    const frame = window.requestAnimationFrame(() => {
      setIsStageAtRest(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [originRect, prefersReducedMotion])

  useEffect(() => {
    if (photo.id === displayedPhotoState.id) {
      return
    }

    let isCancelled = false
    const token = transitionTokenRef.current + 1
    transitionTokenRef.current = token

    const preload = new Image()
    preload.decoding = "async"

    const finish = () => {
      if (isCancelled || transitionTokenRef.current !== token) {
        return
      }

      if (railRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(railRevealFrameRef.current)
        railRevealFrameRef.current = null
      }

      setDisplayedPhotoState(photo)
      setIsDisplayedImageReady(false)
      setIsRailVisible(false)
    }

    preload.onload = finish
    preload.onerror = finish
    preload.src = photo.src

    if (typeof preload.decode === "function") {
      try {
        void preload.decode().catch(() => undefined).finally(finish)
      } catch {
        finish()
      }
    }

    return () => {
      isCancelled = true
      preload.onload = null
      preload.onerror = null
    }
  }, [displayedPhotoState.id, photo])

  useEffect(() => {
    const measureImageHeight = () => {
      if (!imageRef.current) {
        return
      }

      const nextHeight = imageRef.current.getBoundingClientRect().height
      setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
    }

    measureImageHeight()

    if (!imageRef.current) {
      return
    }

    const observer = new ResizeObserver(() => {
      measureImageHeight()
    })

    observer.observe(imageRef.current)

    return () => observer.disconnect()
  }, [displayedPhoto.id, isDesktop, isDisplayedImageReady])

  useEffect(() => {
    if (isDisplayedImageReady) {
      return
    }

    const imageElement = imageRef.current

    if (!imageElement || !imageElement.complete || imageElement.naturalWidth <= 0) {
      return
    }

    imageReadyFrameRef.current = window.requestAnimationFrame(() => {
      const nextHeight = imageRef.current?.getBoundingClientRect().height ?? 0
      setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
      setIsDisplayedImageReady(true)
      if (railRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(railRevealFrameRef.current)
      }
      railRevealFrameRef.current = window.requestAnimationFrame(() => {
        setIsRailVisible(true)
        railRevealFrameRef.current = null
      })
      imageReadyFrameRef.current = null
    })

    return () => {
      if (imageReadyFrameRef.current !== null) {
        window.cancelAnimationFrame(imageReadyFrameRef.current)
        imageReadyFrameRef.current = null
      }
    }
  }, [displayedPhoto.id, isDisplayedImageReady])

  useEffect(() => {
    preloadImages([previewSrc, previousPhoto?.src, nextPhoto?.src])
  }, [nextPhoto?.src, previousPhoto?.src, previewSrc])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
      if (event.key === "ArrowLeft" && previousPhoto && !isPhotoTransitionPending) {
        onSelect(previousPhoto)
      }
      if (event.key === "ArrowRight" && nextPhoto && !isPhotoTransitionPending) {
        onSelect(nextPhoto)
      }
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isPhotoTransitionPending, nextPhoto, onClose, onSelect, previousPhoto])

  useEffect(() => {
    return () => {
      if (imageReadyFrameRef.current !== null) {
        window.cancelAnimationFrame(imageReadyFrameRef.current)
      }
      if (railRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(railRevealFrameRef.current)
      }
    }
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 transition-[background-color,backdrop-filter] duration-300 ${
        isBackdropEntered
          ? "bg-[linear-gradient(180deg,rgba(15,23,42,0.28),rgba(15,23,42,0.22))] backdrop-blur-[16px]"
          : "bg-transparent backdrop-blur-0"
      }`}
      onClick={onClose}
    >
      <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col">
        <div className="relative flex min-h-[48vh] flex-1 items-center justify-center p-4 md:min-h-0 md:px-10 md:py-10">
          <div
            ref={stageRef}
            className="relative flex w-full max-w-[1600px] flex-col overflow-hidden rounded-[1.35rem] border border-white/14 bg-[linear-gradient(160deg,rgba(241,245,249,0.12),rgba(15,23,42,0.2))] shadow-[0_32px_90px_rgba(15,23,42,0.32)] md:w-fit md:max-w-[1620px] md:flex-row md:items-stretch"
            role="dialog"
            aria-modal="true"
            aria-label="\u56fe\u7247\u9884\u89c8"
            onClick={(event) => event.stopPropagation()}
            style={{
              opacity: isStageAtRest ? 1 : 0.78,
              transform: !isStageAtRest && openingTransform ? openingTransform : "translate3d(0, 0, 0) scale(1)",
              transformOrigin: "center center",
              transition: prefersReducedMotion
                ? "opacity 180ms ease-out"
                : `transform ${OPENING_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out`,
            }}
          >
            <div className="relative flex shrink-0 items-center justify-center">
              {isDesktop ? (
                <button
                  type="button"
                  aria-label="\u4e0a\u4e00\u5f20\u56fe\u7247"
                  onClick={() => previousPhoto && !isPhotoTransitionPending && onSelect(previousPhoto)}
                  disabled={!previousPhoto || isPhotoTransitionPending}
                  className="absolute left-5 top-1/2 z-20 inline-flex -translate-y-1/2 rounded-full border border-white/14 bg-black/24 p-2.5 text-white transition hover:bg-black/36 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronLeft className="size-5" />
                </button>
              ) : null}
              {isDesktop ? (
                <button
                  type="button"
                  aria-label="\u4e0b\u4e00\u5f20\u56fe\u7247"
                  onClick={() => nextPhoto && !isPhotoTransitionPending && onSelect(nextPhoto)}
                  disabled={!nextPhoto || isPhotoTransitionPending}
                  className="absolute right-5 top-1/2 z-20 inline-flex -translate-y-1/2 rounded-full border border-white/14 bg-black/24 p-2.5 text-white transition hover:bg-black/36 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronRight className="size-5" />
                </button>
              ) : null}
              <div className="relative overflow-hidden bg-[linear-gradient(160deg,rgba(241,245,249,0.12),rgba(15,23,42,0.2))]">
                <img
                  ref={imageRef}
                  src={previewSrc}
                  alt={displayedPhoto.alt}
                  width={displayedPhoto.width}
                  height={displayedPhoto.height}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  draggable="false"
                  onLoad={markImageReady}
                  className={`block max-h-[58vh] w-auto max-w-[calc(100vw-40px)] object-contain transition-[opacity,transform,filter] duration-500 md:max-h-[calc(100vh-82px)] md:max-w-[min(calc(100vw-472px),1240px)] ${
                    isDisplayedImageReady ? "scale-100 opacity-100 blur-0" : "scale-[1.02] opacity-0 blur-sm"
                  }`}
                />
                {!isDisplayedImageReady ? (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.22))]" />
                ) : null}
                {isPhotoTransitionPending ? (
                  <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/14 bg-black/18 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.18em] text-white/72 backdrop-blur-md">
                    Loading next work
                  </div>
                ) : null}
              </div>
            </div>
            {isDisplayedImageReady ? (
              <aside
                role="complementary"
                className={`flex w-full shrink-0 flex-col justify-between overflow-y-auto border-t border-[rgba(255,255,255,0.52)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,249,252,0.62))] p-6 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-[24px] transition-[opacity,transform] duration-300 md:w-[388px] md:border-l md:border-t-0 md:p-8 ${
                  isRailVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                }`}
                style={isDesktop && imageHeight ? { height: `${imageHeight}px` } : undefined}
              >
                <div className="space-y-9">
                  <div className="space-y-5">
                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-2 text-[0.72rem] font-medium tracking-[0.08em]",
                        railTextToneClassNames.eyebrow,
                      )}
                    >
                      <span className={railHeroChipSurfaceClassName}>
                        {"\u5f53\u524d\u4f5c\u54c1"}
                      </span>
                      <span className={railChipSurfaceClassName}>
                        {categoryLabel}
                      </span>
                    </div>
                    <div className="space-y-3.5">
                      <h3
                        className={cn(
                          "max-w-[11ch] text-[2.05rem] font-medium leading-[1.02] tracking-[-0.058em] md:text-[2.18rem]",
                          railTextToneClassNames.title,
                        )}
                      >
                        {contentPhoto.alt}
                      </h3>
                      <p className={cn("max-w-[30ch] text-[0.95rem] leading-7", railTextToneClassNames.body)}>
                        {contentPhoto.summary}
                      </p>
                    </div>

                    {(visibleTags.length > 0 || hiddenCount > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {visibleTags.map((tag) => (
                          <span key={tag} className={cn(railChipSurfaceClassName, "text-[0.72rem] tracking-[0.12em]", railTextToneClassNames.chip)}>
                            {tag}
                          </span>
                        ))}
                        {hiddenCount > 0 ? (
                          <span className={cn(railChipSurfaceClassName, "text-[0.72rem] tracking-[0.12em]", railTextToneClassNames.chip)}>
                            +{hiddenCount}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {errorMessage ? (
                      <p className="rounded-[1.25rem] border border-amber-500/24 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>

                  <div data-testid="photo-info-flow" className="space-y-7">
                    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-1">
                      <dl className="space-y-2">
                        <dt className={cn("text-[0.74rem] font-medium tracking-[0.06em]", railTextToneClassNames.label)}>
                          {"\u6444\u5f71\u5e08"}
                        </dt>
                        <dd className="flex items-center gap-3">
                          <span className={railAuthorAvatarClassName}>
                            {contentPhoto.userAvatar ? (
                              <img
                                data-testid="photo-author-avatar-image"
                                src={contentPhoto.userAvatar}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="size-full object-cover"
                              />
                            ) : (
                              <span
                                data-testid="photo-author-avatar-fallback"
                                className="text-sm font-semibold tracking-[0.02em]"
                              >
                                {photographerInitial}
                              </span>
                            )}
                          </span>
                          <div className="min-w-0 space-y-1">
                            {onPhotographerClick && contentPhoto.userId ? (
                              <button
                                type="button"
                                onClick={() => onPhotographerClick(contentPhoto)}
                                className={cn(
                                  "w-fit max-w-full text-left text-[1rem] font-medium tracking-[-0.02em] transition hover:text-[rgba(58,73,130,0.92)] focus-visible:outline-none focus-visible:underline",
                                  railTextToneClassNames.title,
                                )}
                              >
                                {contentPhoto.photographer}
                              </button>
                            ) : (
                              <p className={cn("text-[1rem] font-medium tracking-[-0.02em]", railTextToneClassNames.title)}>
                                {contentPhoto.photographer}
                              </p>
                            )}
                          </div>
                        </dd>
                      </dl>
                      <dl className="space-y-2">
                        <dt className={cn("text-[0.74rem] font-medium tracking-[0.06em]", railTextToneClassNames.label)}>
                          {"\u62cd\u6444\u5730\u70b9"}
                        </dt>
                        <dd className={cn("text-[0.96rem] leading-7", railTextToneClassNames.body)}>
                          {contentPhoto.location || "\u5730\u70b9\u4fe1\u606f\u6682\u7f3a"}
                        </dd>
                      </dl>
                    </div>

                    <dl className={cn("space-y-3.5 text-sm leading-6", railTextToneClassNames.body)}>
                      {detailFacts.map((fact) => (
                        <div
                          key={fact.id}
                          className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-x-4"
                        >
                          <dt className={cn("text-[0.74rem] font-medium tracking-[0.04em]", railTextToneClassNames.value)}>
                            {fact.label}
                          </dt>
                          <dd className={cn("text-right text-[0.98rem] leading-6", railTextToneClassNames.value)}>
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <div data-testid="photo-stats-row" className="grid gap-3 sm:grid-cols-2 sm:gap-x-6">
                      {detailStats.map((stat) => (
                        <dl
                          key={stat.id}
                          data-testid={`photo-stat-${stat.id}`}
                          className="flex items-end justify-between gap-3"
                        >
                          <dt className={cn("text-[0.74rem] font-medium tracking-[0.04em]", railTextToneClassNames.value)}>
                            {stat.label}
                          </dt>
                          <dd className={cn("tabular-nums text-[1.12rem] font-semibold tracking-[-0.02em]", railTextToneClassNames.accent)}>
                            {stat.value}
                          </dd>
                        </dl>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-10 space-y-4 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                      <span className={cn("text-[0.68rem] uppercase tracking-[0.16em]", railTextToneClassNames.footerEyebrow)}>
                        {"\u5f53\u524d\u67e5\u770b"}
                      </span>
                      <span className={cn("font-medium", railTextToneClassNames.footerPrimary)}>{"\u7b2c "}{currentIndex + 1}{" \u5f20"}</span>
                      <span className={railTextToneClassNames.footerDivider}>/</span>
                      <span className={railTextToneClassNames.footerSecondary}>{"\u5171 "}{photos.length}{" \u5f20"}</span>
                    </p>
                    <div className="flex items-center gap-3">
                      {isLoading ? <p className={cn("text-sm", railTextToneClassNames.footerSecondary)}>{"\u6b63\u5728\u5237\u65b0\u8be6\u60c5"}</p> : null}
                      {canDelete ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className={railDeleteButtonClassName}
                          onClick={onDelete}
                          disabled={isDeleting}
                        >
                          {"\u5220\u9664\u4f5c\u54c1"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {!isDesktop ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => previousPhoto && !isPhotoTransitionPending && onSelect(previousPhoto)}
                        disabled={!previousPhoto || isPhotoTransitionPending}
                      >
                        {"\u4e0a\u4e00\u5f20"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => nextPhoto && !isPhotoTransitionPending && onSelect(nextPhoto)}
                        disabled={!nextPhoto || isPhotoTransitionPending}
                      >
                        {"\u4e0b\u4e00\u5f20"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

