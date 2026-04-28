import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface ProgressiveImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  imageClassName?: string
}

const IMAGE_PREFETCH_ROOT_MARGIN = "800px 0px"

function createImageState(src: string) {
  return {
    src,
    shouldLoad: typeof IntersectionObserver === "undefined",
    isLoaded: false,
  }
}

export function ProgressiveImage({
  src,
  alt,
  width,
  height,
  className,
  imageClassName,
}: ProgressiveImageProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [imageState, setImageState] = useState(() => createImageState(src))

  if (imageState.src !== src) {
    setImageState(createImageState(src))
  }

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || imageState.shouldLoad) {
      return
    }

    if (typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setImageState((currentState) =>
            currentState.src === src ? { ...currentState, shouldLoad: true } : currentState,
          )
          observer.disconnect()
        }
      },
      { rootMargin: IMAGE_PREFETCH_ROOT_MARGIN },
    )

    observer.observe(frame)

    return () => observer.disconnect()
  }, [imageState.shouldLoad, src])

  return (
    <div
      ref={frameRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{
        aspectRatio: `${width} / ${height}`,
      }}
    >
      <img
        src={imageState.shouldLoad ? src : undefined}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        draggable="false"
        data-loaded={String(imageState.isLoaded)}
        onLoad={() =>
          setImageState((currentState) =>
            currentState.src === src ? { ...currentState, isLoaded: true } : currentState,
          )
        }
        className={cn(
          "relative z-[1] h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-500 ease-out",
          imageState.isLoaded && "opacity-100",
          imageClassName,
        )}
      />
    </div>
  )
}
