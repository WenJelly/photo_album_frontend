import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PHOTO_DETAIL_TAG_LIMIT, getTagDisplay } from "@/lib/photo-tags"
import type { Photo } from "@/types/photo"

interface PhotoPreviewOverlayProps {
  photo: Photo
  photos: Photo[]
  onClose: () => void
  onSelect: (photo: Photo) => void
  isLoading?: boolean
  errorMessage?: string | null
}

const DESKTOP_BREAKPOINT = 768

function getPreviewSrc(photo: Photo) {
  return photo.src
}

export function PhotoPreviewOverlay({
  photo,
  photos,
  onClose,
  onSelect,
  isLoading = false,
  errorMessage = null,
}: PhotoPreviewOverlayProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [imageHeight, setImageHeight] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT)
  const [isEntered, setIsEntered] = useState(false)

  const currentIndex = useMemo(() => photos.findIndex((item) => item.id === photo.id), [photo.id, photos])
  const previousPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null
  const nextPhoto = currentIndex >= 0 && currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null
  const previewSrc = getPreviewSrc(photo)
  const categoryLabel = photo.categoryLabel ?? photo.category
  const { visibleTags, hiddenCount } = getTagDisplay(photo.tags, { maxVisible: PHOTO_DETAIL_TAG_LIMIT })

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    }

    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsEntered(true))

    return () => window.cancelAnimationFrame(frame)
  }, [])

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
  }, [photo.id, isDesktop])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
      if (event.key === "ArrowLeft" && previousPhoto) {
        onSelect(previousPhoto)
      }
      if (event.key === "ArrowRight" && nextPhoto) {
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
  }, [nextPhoto, onClose, onSelect, previousPhoto])

  return (
    <div
      data-testid="preview-backdrop"
      className="fixed inset-0 z-50 bg-[oklch(0.22_0.01_84_/_0.16)] backdrop-blur-[10px]"
      onClick={onClose}
    >
      <div
        className={`mx-auto flex h-full w-full max-w-[1680px] flex-col ${
          isEntered ? "opacity-100" : "opacity-0"
        } transition-opacity duration-300`}
      >
        <div
          data-testid="preview-stage"
          className="relative flex min-h-[48vh] flex-1 items-center justify-center p-4 md:min-h-0 md:px-10 md:py-10"
        >
          <div
            data-testid="preview-body"
            className="relative flex w-fit max-w-full flex-col md:max-w-[1600px] md:flex-row md:items-start"
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex shrink-0 items-center justify-center">
              {isDesktop ? (
                <button
                  type="button"
                  data-testid="preview-prev"
                  aria-label="上一张图片"
                  onClick={() => previousPhoto && onSelect(previousPhoto)}
                  disabled={!previousPhoto}
                  className="absolute left-4 top-1/2 inline-flex -translate-y-1/2 rounded-full border border-white/12 bg-black/28 p-2 text-white transition hover:bg-black/40 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronLeft className="size-5" />
                </button>
              ) : null}
              {isDesktop ? (
                <button
                  type="button"
                  data-testid="preview-next"
                  aria-label="下一张图片"
                  onClick={() => nextPhoto && onSelect(nextPhoto)}
                  disabled={!nextPhoto}
                  className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 rounded-full border border-white/12 bg-black/28 p-2 text-white transition hover:bg-black/40 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronRight className="size-5" />
                </button>
              ) : null}
              <img
                ref={imageRef}
                src={previewSrc}
                alt={photo.alt}
                onLoad={() => {
                  const nextHeight = imageRef.current?.getBoundingClientRect().height ?? 0
                  setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
                }}
                className="block max-h-[56vh] w-auto max-w-[calc(100vw-40px)] object-contain transition duration-500 md:max-h-[calc(100vh-80px)] md:max-w-[min(calc(100vw-440px),1240px)]"
              />
            </div>
            <aside
              role="complementary"
              className="flex w-full shrink-0 flex-col justify-between overflow-y-auto border-t border-black/10 bg-white p-6 text-neutral-950 md:w-[360px] md:border-l md:border-t-0 md:p-8"
              style={isDesktop && imageHeight ? { height: `${imageHeight}px` } : undefined}
            >
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-neutral-600">
                    <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.18em]">
                      当前作品
                    </span>
                    <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.18em]">
                      {categoryLabel}
                    </span>
                    {visibleTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.12em]"
                      >
                        {tag}
                      </span>
                    ))}
                    {hiddenCount > 0 ? (
                      <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.12em]">
                        +{hiddenCount}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-2xl font-medium tracking-[-0.04em]">{photo.alt}</h3>
                  <p className="text-sm leading-6 text-neutral-600">{photo.summary}</p>
                  {errorMessage ? (
                    <p className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-900">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
                <dl className="grid gap-5 text-sm text-neutral-600">
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">摄影师</dt>
                    <dd className="mt-2 text-base text-neutral-950">{photo.photographer}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">分类</dt>
                    <dd className="mt-2 text-base text-neutral-950">{categoryLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">格式</dt>
                    <dd className="mt-2 text-base text-neutral-950">{photo.format ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">尺寸</dt>
                    <dd className="mt-2 text-base text-neutral-950">
                      {photo.width} × {photo.height}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">上传时间</dt>
                    <dd className="mt-2 text-base text-neutral-950">{photo.createdAt ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">浏览 / 点赞</dt>
                    <dd className="mt-2 text-base text-neutral-950">
                      {photo.viewCount ?? 0} / {photo.likeCount ?? 0}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-8 space-y-4 border-t border-black/10 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-500">
                    {currentIndex + 1} / {photos.length}
                  </p>
                  {isLoading ? <p className="text-sm text-neutral-500">正在更新详情...</p> : null}
                </div>
                {!isDesktop ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      data-testid="preview-prev-mobile"
                      variant="secondary"
                      onClick={() => previousPhoto && onSelect(previousPhoto)}
                      disabled={!previousPhoto}
                    >
                      上一张
                    </Button>
                    <Button
                      data-testid="preview-next-mobile"
                      variant="secondary"
                      onClick={() => nextPhoto && onSelect(nextPhoto)}
                      disabled={!nextPhoto}
                    >
                      下一张
                    </Button>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
