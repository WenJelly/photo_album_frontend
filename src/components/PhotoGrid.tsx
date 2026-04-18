import { useEffect, useState } from "react"

import { buildJustifiedRows } from "@/lib/gallery-layout"
import { PHOTO_CARD_TAG_LIMIT, getTagDisplay } from "@/lib/photo-tags"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo) => void
  onClearFilter?: () => void
}

function useContainerWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [element])

  return { setElement, width }
}

export function PhotoGrid({ photos, onPhotoClick, onClearFilter }: PhotoGridProps) {
  const { setElement, width } = useContainerWidth()
  const gap = width < 768 ? 6 : 10
  const targetRowHeight = width < 640 ? 216 : width < 1024 ? 258 : 314

  const rows = buildJustifiedRows(photos, {
    containerWidth: width,
    gap,
    targetRowHeight,
    minRowHeight: Math.max(170, targetRowHeight - 60),
    maxRowHeight: targetRowHeight + 80,
  })

  if (!photos.length) {
    return (
      <div className="border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center md:px-10">
        <p className="eyebrow-label">暂无匹配作品</p>
        <h4 className="mt-4 text-2xl font-medium tracking-[-0.04em]">当前筛选条件下还没有可浏览的作品。</h4>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          回到全部分类后，可以继续浏览更完整的影像集合。
        </p>
        {onClearFilter ? (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-6 inline-flex rounded-full border border-border bg-background px-5 py-2.5 text-sm transition-colors hover:bg-secondary"
          >
            清除筛选
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={setElement} className="space-y-2">
      {rows.map((row) => (
        <div
          key={`${row.photos[0]?.id}-${row.photos.length}`}
          className={cn("flex", row.isLastRow && "justify-start")}
          style={{ gap, height: row.height, width: row.width }}
        >
          {row.photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} onClick={onPhotoClick} />
          ))}
        </div>
      ))}
    </div>
  )
}

function PhotoCard({
  photo,
  onClick,
}: {
  photo: Photo
  onClick?: (photo: Photo) => void
}) {
  const { visibleTags, hiddenCount } = getTagDisplay(photo.tags, { maxVisible: PHOTO_CARD_TAG_LIMIT })

  return (
    <button
      type="button"
      onClick={() => onClick?.(photo)}
      className="group relative overflow-hidden rounded-none bg-muted/60 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
      style={{ flex: `${photo.width / photo.height} 0 0` }}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/54 via-black/12 to-transparent px-4 pb-4 pt-14 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
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
        <p className="mt-1 text-xs text-white/70">{photo.photographer}</p>
      </div>
    </button>
  )
}
