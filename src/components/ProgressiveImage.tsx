import { useEffect, useRef, useState } from "react"

import { decodeBlurHashToPixels, isValidBlurHash } from "@/lib/blurhash"
import { cn } from "@/lib/utils"

interface ProgressiveImageProps {
  src: string
  alt: string
  width: number
  height: number
  dominantColor?: string
  blurHash?: string
  className?: string
  imageClassName?: string
}

const BLURHASH_CANVAS_SIZE = 32
const IMAGE_PREFETCH_ROOT_MARGIN = "800px 0px"

function createImageState(src: string) {
  return {
    src,
    shouldLoad: typeof IntersectionObserver === "undefined",
    isLoaded: false,
  }
}

function BlurHashCanvas({ blurHash }: { blurHash: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const pixels = decodeBlurHashToPixels(blurHash, BLURHASH_CANVAS_SIZE, BLURHASH_CANVAS_SIZE)
    if (!pixels) {
      return
    }

    try {
      const context = canvas.getContext("2d")
      if (!context) {
        return
      }

      const imageData = context.createImageData(BLURHASH_CANVAS_SIZE, BLURHASH_CANVAS_SIZE)
      imageData.data.set(pixels)
      context.putImageData(imageData, 0, 0)
    } catch {
      // jsdom and older browsers can lack a real canvas context; the color fallback remains visible.
    }
  }, [blurHash])

  return (
    <canvas
      ref={canvasRef}
      width={BLURHASH_CANVAS_SIZE}
      height={BLURHASH_CANVAS_SIZE}
      aria-hidden="true"
      data-testid="progressive-image-blurhash"
      className="absolute inset-0 h-full w-full scale-105 object-cover blur-2xl"
    />
  )
}

export function ProgressiveImage({
  src,
  alt,
  width,
  height,
  dominantColor,
  blurHash,
  className,
  imageClassName,
}: ProgressiveImageProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [imageState, setImageState] = useState(() => createImageState(src))
  const canRenderBlurHash = isValidBlurHash(blurHash)

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
      data-testid="progressive-image-frame"
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundColor: dominantColor || "#ece9e3",
      }}
    >
      {canRenderBlurHash && blurHash ? <BlurHashCanvas blurHash={blurHash} /> : null}
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
