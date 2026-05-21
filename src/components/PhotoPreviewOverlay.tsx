import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"

import { preloadImages } from "@/lib/image-preload"
import { PHOTO_DETAIL_TAG_LIMIT, getTagDisplay } from "@/lib/photo-tags"
import { cn } from "@/lib/utils"
import type { Photo, PhotoExif } from "@/types/photo"
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
const OPENING_TRANSITION_MS = 520

function readMediaQueryMatch(query: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia(query).matches
}

function getPreviewSrc(photo: Photo) {
  return photo.thumbnailSrc ?? photo.src
}

function getPhotographerInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?"
}

const PLACEHOLDER_EXIF: PhotoExif = {
  aperture: "f/2.8",
  shutterSpeed: "1/250s",
  iso: 400,
  focalLength: "85mm",
  camera: "Sony A7IV",
  lens: "FE 85mm f/1.4 GM",
}

// PLACEHOLDER_CONTINUE

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
  const { visibleTags, hiddenCount } = getTagDisplay(contentPhoto.tags, { maxVisible: PHOTO_DETAIL_TAG_LIMIT })
  const photographerInitial = getPhotographerInitial(contentPhoto.photographer)
  const exif = contentPhoto.exif ?? PLACEHOLDER_EXIF

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
    const handleResize = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
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
    const timer = setTimeout(() => setIsBackdropEntered(true), 60)
    return () => clearTimeout(timer)
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
    setOpeningTransform(`translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY}) rotateY(1.2deg)`)
    setIsStageAtRest(false)
    hasAnimatedFromOriginRef.current = true
    const frame = window.requestAnimationFrame(() => setIsStageAtRest(true))
    return () => window.cancelAnimationFrame(frame)
  }, [originRect, prefersReducedMotion])

  useEffect(() => {
    if (photo.id === displayedPhotoState.id) return
    let isCancelled = false
    const token = transitionTokenRef.current + 1
    transitionTokenRef.current = token
    const preload = new Image()
    preload.decoding = "async"
    const finish = () => {
      if (isCancelled || transitionTokenRef.current !== token) return
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
      try { void preload.decode().catch(() => undefined).finally(finish) } catch { finish() }
    }
    return () => { isCancelled = true; preload.onload = null; preload.onerror = null }
  }, [displayedPhotoState.id, photo])

  useEffect(() => {
    const measureImageHeight = () => {
      if (!imageRef.current) return
      const nextHeight = imageRef.current.getBoundingClientRect().height
      setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
    }
    measureImageHeight()
    if (!imageRef.current) return
    const observer = new ResizeObserver(() => measureImageHeight())
    observer.observe(imageRef.current)
    return () => observer.disconnect()
  }, [displayedPhoto.id, isDesktop, isDisplayedImageReady])

  useEffect(() => {
    if (isDisplayedImageReady) return
    const imageElement = imageRef.current
    if (!imageElement || !imageElement.complete || imageElement.naturalWidth <= 0) return
    imageReadyFrameRef.current = window.requestAnimationFrame(() => {
      const nextHeight = imageRef.current?.getBoundingClientRect().height ?? 0
      setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
      setIsDisplayedImageReady(true)
      if (railRevealFrameRef.current !== null) window.cancelAnimationFrame(railRevealFrameRef.current)
      railRevealFrameRef.current = window.requestAnimationFrame(() => { setIsRailVisible(true); railRevealFrameRef.current = null })
      imageReadyFrameRef.current = null
    })
    return () => { if (imageReadyFrameRef.current !== null) { window.cancelAnimationFrame(imageReadyFrameRef.current); imageReadyFrameRef.current = null } }
  }, [displayedPhoto.id, isDisplayedImageReady])

  useEffect(() => { preloadImages([previewSrc, previousPhoto?.src, nextPhoto?.src]) }, [nextPhoto?.src, previousPhoto?.src, previewSrc])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowLeft" && previousPhoto && !isPhotoTransitionPending) onSelect(previousPhoto)
      if (event.key === "ArrowRight" && nextPhoto && !isPhotoTransitionPending) onSelect(nextPhoto)
    }
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isPhotoTransitionPending, nextPhoto, onClose, onSelect, previousPhoto])

  useEffect(() => {
    return () => {
      if (imageReadyFrameRef.current !== null) window.cancelAnimationFrame(imageReadyFrameRef.current)
      if (railRevealFrameRef.current !== null) window.cancelAnimationFrame(railRevealFrameRef.current)
    }
  }, [])

  const exifItems = [
    { label: "光圈", value: exif.aperture },
    { label: "快门", value: exif.shutterSpeed },
    { label: "ISO", value: exif.iso?.toString() },
    { label: "焦距", value: exif.focalLength },
    { label: "相机", value: exif.camera },
    { label: "镜头", value: exif.lens },
  ].filter((item) => item.value)

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
            aria-label="图片预览"
            onClick={(event) => event.stopPropagation()}
            style={{
              opacity: isStageAtRest ? 1 : 0.78,
              transform: !isStageAtRest && openingTransform ? openingTransform : "translate3d(0, 0, 0) scale(1) rotateY(0deg)",
              transformOrigin: "center center",
              boxShadow: isStageAtRest
                ? "0 32px 90px rgba(15,23,42,0.32)"
                : "0 4px 16px rgba(15,23,42,0.12)",
              transition: prefersReducedMotion
                ? "opacity 180ms ease-out"
                : `transform ${OPENING_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out, box-shadow ${OPENING_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            {/* Image area */}
            <div className="relative flex shrink-0 items-center justify-center">
              {isDesktop && (
                <button
                  type="button"
                  aria-label="上一张"
                  onClick={() => previousPhoto && !isPhotoTransitionPending && onSelect(previousPhoto)}
                  disabled={!previousPhoto || isPhotoTransitionPending}
                  className="absolute left-5 top-1/2 z-20 inline-flex -translate-y-1/2 rounded-full border border-white/14 bg-black/24 p-2.5 text-white transition hover:bg-black/36 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}
              {isDesktop && (
                <button
                  type="button"
                  aria-label="下一张"
                  onClick={() => nextPhoto && !isPhotoTransitionPending && onSelect(nextPhoto)}
                  disabled={!nextPhoto || isPhotoTransitionPending}
                  className="absolute right-5 top-1/2 z-20 inline-flex -translate-y-1/2 rounded-full border border-white/14 bg-black/24 p-2.5 text-white transition hover:bg-black/36 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronRight className="size-5" />
                </button>
              )}
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
                {!isDisplayedImageReady && (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.22))]" />
                )}
                {isPhotoTransitionPending && (
                  <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/14 bg-black/18 px-3 py-1.5 text-[0.68rem] tracking-[0.12em] text-white/72 backdrop-blur-md">
                    加载中
                  </div>
                )}
              </div>
            </div>

            {/* Info rail */}
            {isDisplayedImageReady && (
              <aside
                role="complementary"
                className={cn(
                  "flex w-full shrink-0 flex-col border-t border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,249,252,0.66))] p-5 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-[24px] transition-[opacity,transform] duration-300 md:w-[400px] md:border-l md:border-t-0 md:p-7",
                  isRailVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
                )}
                style={isDesktop && imageHeight ? { height: `${imageHeight}px` } : undefined}
              >
                {/* Section 1: Core — title + photographer + like */}
                <div className="space-y-4">
                  <h3
                    className="truncate text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-[rgba(11,15,24,0.96)]"
                    title={contentPhoto.alt}
                  >
                    {contentPhoto.alt}
                  </h3>

                  {contentPhoto.summary && (
                    <p
                      className="line-clamp-2 text-[0.88rem] leading-relaxed text-[rgba(31,38,52,0.76)]"
                      title={contentPhoto.summary}
                    >
                      {contentPhoto.summary}
                    </p>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/60 text-[rgba(18,24,38,0.84)] shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                      {contentPhoto.userAvatar ? (
                        <img src={contentPhoto.userAvatar} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold">{photographerInitial}</span>
                      )}
                    </span>
                    {onPhotographerClick && contentPhoto.userId ? (
                      <button
                        type="button"
                        onClick={() => onPhotographerClick(contentPhoto)}
                        className="truncate text-[0.88rem] font-medium text-[rgba(11,15,24,0.88)] transition hover:text-[rgba(58,73,130,0.92)]"
                      >
                        {contentPhoto.photographer}
                      </button>
                    ) : (
                      <span className="truncate text-[0.88rem] font-medium text-[rgba(11,15,24,0.88)]">
                        {contentPhoto.photographer}
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="my-5 h-px bg-[rgba(15,23,42,0.06)]" />

                {/* Section 2: EXIF */}
                {exifItems.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[0.7rem] font-medium tracking-[0.08em] text-[rgba(45,52,68,0.5)]">
                      拍摄参数
                    </h4>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
                      {exifItems.map((item) => (
                        <dl key={item.label} className="min-w-0">
                          <dt className="text-[0.66rem] text-[rgba(45,52,68,0.46)]">{item.label}</dt>
                          <dd
                            className="truncate text-[0.8rem] font-medium text-[rgba(11,15,24,0.82)]"
                            title={item.value}
                          >
                            {item.value}
                          </dd>
                        </dl>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="my-5 h-px bg-[rgba(15,23,42,0.06)]" />

                {/* Section 3: Metadata */}
                <div className="space-y-3">
                  {(visibleTags.length > 0 || hiddenCount > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {visibleTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[rgba(255,255,255,0.6)] bg-[rgba(255,255,255,0.5)] px-2.5 py-1 text-[0.68rem] text-[rgba(41,48,64,0.72)]"
                        >
                          {tag}
                        </span>
                      ))}
                      {hiddenCount > 0 && (
                        <span className="rounded-full border border-[rgba(255,255,255,0.6)] bg-[rgba(255,255,255,0.5)] px-2.5 py-1 text-[0.68rem] text-[rgba(41,48,64,0.72)]">
                          +{hiddenCount}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {contentPhoto.location && (
                      <dl className="col-span-2 min-w-0">
                        <dt className="text-[0.66rem] text-[rgba(45,52,68,0.46)]">地点</dt>
                        <dd className="truncate text-[0.8rem] text-[rgba(11,15,24,0.78)]" title={contentPhoto.location}>
                          {contentPhoto.location}
                        </dd>
                      </dl>
                    )}
                    <dl className="min-w-0">
                      <dt className="text-[0.66rem] text-[rgba(45,52,68,0.46)]">尺寸</dt>
                      <dd className="text-[0.8rem] tabular-nums text-[rgba(11,15,24,0.78)]">
                        {contentPhoto.width} × {contentPhoto.height}
                      </dd>
                    </dl>
                    {contentPhoto.format && (
                      <dl className="min-w-0">
                        <dt className="text-[0.66rem] text-[rgba(45,52,68,0.46)]">格式</dt>
                        <dd className="text-[0.8rem] text-[rgba(11,15,24,0.78)]">{contentPhoto.format}</dd>
                      </dl>
                    )}
                    {contentPhoto.createdAt && (
                      <dl className="min-w-0">
                        <dt className="text-[0.66rem] text-[rgba(45,52,68,0.46)]">上传</dt>
                        <dd className="truncate text-[0.8rem] text-[rgba(11,15,24,0.78)]" title={contentPhoto.createdAt}>
                          {contentPhoto.createdAt}
                        </dd>
                      </dl>
                    )}
                    <dl className="min-w-0">
                      <dt className="text-[0.66rem] text-[rgba(45,52,68,0.46)]">浏览</dt>
                      <dd className="text-[0.8rem] tabular-nums text-[rgba(11,15,24,0.78)]">
                        {contentPhoto.viewCount ?? 0}
                      </dd>
                    </dl>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-5">
                  {errorMessage && (
                    <p className="mb-3 rounded-xl border border-amber-500/24 bg-amber-500/10 px-3 py-2 text-[0.78rem] text-amber-900">
                      {errorMessage}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[0.72rem] tabular-nums text-[rgba(15,23,42,0.44)]">
                      {currentIndex + 1} / {photos.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isLoading && <span className="text-[0.72rem] text-[rgba(15,23,42,0.5)]">刷新中</span>}
                      <a
                        href={contentPhoto.src}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] px-2.5 text-[0.72rem] font-medium text-[rgba(15,23,42,0.64)] transition hover:border-[rgba(15,23,42,0.14)] hover:bg-[rgba(15,23,42,0.06)] hover:text-[rgba(15,23,42,0.82)]"
                        aria-label="下载原图"
                      >
                        <Download className="size-3.5" />
                        原图
                      </a>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={onDelete}
                          disabled={isDeleting}
                          className="inline-flex h-7 items-center rounded-md border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] px-2.5 text-[0.72rem] font-medium text-[rgba(15,23,42,0.64)] transition hover:border-[rgba(220,38,38,0.2)] hover:bg-[rgba(220,38,38,0.04)] hover:text-[rgba(220,38,38,0.8)] disabled:opacity-40 disabled:pointer-events-none"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                  {!isDesktop && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => previousPhoto && !isPhotoTransitionPending && onSelect(previousPhoto)}
                        disabled={!previousPhoto || isPhotoTransitionPending}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] text-[0.78rem] font-medium text-[rgba(15,23,42,0.7)] transition hover:bg-[rgba(15,23,42,0.06)] disabled:opacity-35 disabled:pointer-events-none"
                      >
                        上一张
                      </button>
                      <button
                        type="button"
                        onClick={() => nextPhoto && !isPhotoTransitionPending && onSelect(nextPhoto)}
                        disabled={!nextPhoto || isPhotoTransitionPending}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.03)] text-[0.78rem] font-medium text-[rgba(15,23,42,0.7)] transition hover:bg-[rgba(15,23,42,0.06)] disabled:opacity-35 disabled:pointer-events-none"
                      >
                        下一张
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
