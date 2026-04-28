import { memo, useEffect, useMemo, useState, type MouseEvent } from "react"

import { ProgressiveImage } from "@/components/ProgressiveImage"
import { buildVirtualRowMetrics, getVirtualRowsHeight, getVisibleRowRange } from "@/lib/gallery-virtualization"
import { buildJustifiedRows } from "@/lib/gallery-layout"
import { preloadImage } from "@/lib/image-preload"
import { PHOTO_CARD_TAG_LIMIT, getTagDisplay } from "@/lib/photo-tags"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"
import { toPhotoPreviewOriginRect, type PhotoPreviewOriginRect } from "@/types/photo-preview"

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo, originRect?: PhotoPreviewOriginRect) => void
  onPhotographerClick?: (photo: Photo) => void
}

function useContainerWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width)

      setWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth))
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [element])

  return { setElement, width }
}

function useWindowViewport(element: HTMLDivElement | null) {
  const [viewport, setViewport] = useState({ scrollTop: 0, viewportHeight: 0 })

  useEffect(() => {
    if (!element) return

    const updateViewport = () => {
      const rect = element.getBoundingClientRect()
      const nextViewport = {
        scrollTop: Math.max(0, -rect.top),
        viewportHeight: window.innerHeight,
      }

      setViewport((currentViewport) =>
        currentViewport.scrollTop === nextViewport.scrollTop &&
        currentViewport.viewportHeight === nextViewport.viewportHeight
          ? currentViewport
          : nextViewport,
      )
    }

    updateViewport()
    window.addEventListener("scroll", updateViewport, { passive: true })
    window.addEventListener("resize", updateViewport)

    return () => {
      window.removeEventListener("scroll", updateViewport)
      window.removeEventListener("resize", updateViewport)
    }
  }, [element])

  return viewport
}

export function PhotoGrid({ photos, onPhotoClick, onPhotographerClick }: PhotoGridProps) {
  const { setElement, width } = useContainerWidth()
  const gap = width < 768 ? 6 : 10
  const rowGap = 8
  const targetRowHeight = width < 640 ? 216 : width < 1024 ? 258 : 314
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null)
  const viewport = useWindowViewport(gridElement)

  const rows = useMemo(
    () =>
      buildJustifiedRows(photos, {
        containerWidth: width,
        gap,
        targetRowHeight,
        minRowHeight: Math.max(170, targetRowHeight - 60),
        maxRowHeight: targetRowHeight + 80,
      }),
    [gap, photos, targetRowHeight, width],
  )
  const virtualRows = useMemo(() => buildVirtualRowMetrics(rows, rowGap), [rowGap, rows])
  const visibleRange = useMemo(
    () =>
      getVisibleRowRange(virtualRows, {
        scrollTop: viewport.scrollTop,
        viewportHeight: viewport.viewportHeight,
        overscan: Math.max(900, viewport.viewportHeight),
      }),
    [viewport.scrollTop, viewport.viewportHeight, virtualRows],
  )
  const visibleRows = rows.slice(visibleRange.start, visibleRange.end)
  const totalRowsHeight = getVirtualRowsHeight(virtualRows)

  if (!photos.length) {
    return (
      <div className="border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center md:px-10">
        <p className="eyebrow-label">No Works Yet</p>
        <h4 className="mt-4 text-2xl font-medium tracking-[-0.04em]">The gallery is empty right now.</h4>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          New images will appear here once they are available.
        </p>
      </div>
    )
  }

  return (
    <div ref={setElement}>
      <div ref={setGridElement} className="relative" style={{ height: totalRowsHeight }}>
        {visibleRows.map((row, visibleIndex) => {
          const rowIndex = visibleRange.start + visibleIndex
          const virtualRow = virtualRows[rowIndex]

          if (!virtualRow) {
            return null
          }

          return (
            <div
              key={`${rowIndex}-${row.photos[0]?.id}-${row.photos.length}`}
              className={cn("absolute left-0 flex", row.isLastRow && "justify-start")}
              style={{ gap, height: row.height, transform: `translateY(${virtualRow.start}px)`, width: row.width }}
            >
              {row.photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onClick={onPhotoClick}
                  onPhotographerClick={onPhotographerClick}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PhotoCard = memo(function PhotoCard({
  photo,
  onClick,
  onPhotographerClick,
}: {
  photo: Photo
  onClick?: (photo: Photo, originRect?: PhotoPreviewOriginRect) => void
  onPhotographerClick?: (photo: Photo) => void
}) {
  const { visibleTags, hiddenCount } = useMemo(
    () => getTagDisplay(photo.tags, { maxVisible: PHOTO_CARD_TAG_LIMIT }),
    [photo.tags],
  )
  const canOpenPhotographer = Boolean(onPhotographerClick && photo.userId)
  const handleWarmPreview = () => {
    preloadImage(photo.src)
  }
  const handlePhotographerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onPhotographerClick?.(photo)
  }

  return (
    <article
      className="group relative overflow-hidden rounded-[0.7rem] bg-muted/60"
      style={{ flex: `${photo.width / photo.height} 0 0` }}
    >
      <button
        type="button"
        onClick={(event) => onClick?.(photo, toPhotoPreviewOriginRect(event.currentTarget.getBoundingClientRect()))}
        onMouseEnter={handleWarmPreview}
        onFocus={handleWarmPreview}
        className="absolute inset-0 z-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
      >
        <span className="sr-only">查看图片 {photo.alt}</span>
      </button>
      <ProgressiveImage
        src={photo.thumbnailSrc ?? photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        imageClassName="group-hover:scale-[1.015]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/54 via-black/12 to-transparent px-4 pb-4 pt-14 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-white/82">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="border border-white/18 bg-white/10 px-2.5 py-1 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span className="border border-white/18 bg-white/10 px-2.5 py-1 backdrop-blur-sm">+{hiddenCount}</span>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-medium text-white">{photo.alt}</p>
        {canOpenPhotographer ? (
          <button
            type="button"
            onClick={handlePhotographerClick}
            className="pointer-events-auto mt-1 text-xs text-white/70 underline-offset-2 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:text-white focus-visible:underline"
          >
            {photo.photographer}
          </button>
        ) : (
          <p className="mt-1 text-xs text-white/70">{photo.photographer}</p>
        )}
      </div>
    </article>
  )
})
