import { useEffect, useMemo, useState } from "react"
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from "three"

import { createPlaceholderSphereRecord, normalizeSphereImageRecords } from "./constants"
import { loadSphereImageRecord, type ImageLoaderLike } from "./image-loader"
import type { SphereImageRecord } from "./types"

interface TexturePipelineOptions {
  tileSize: number
  onAtlasInvalidate?: () => void
}

export interface SphereAtlasTile {
  recordId: string
  offset: [number, number]
  scale: [number, number]
}

export interface SphereAtlasResource {
  texture: Texture
  tiles: SphereAtlasTile[]
}

interface AtlasLayout {
  columns: number
  rows: number
  textureWidth: number
  textureHeight: number
  tiles: SphereAtlasTile[]
}

interface AtlasBuildTarget {
  layout: AtlasLayout
  resource: SphereAtlasResource
  context: CanvasRenderingContext2D | null
  dispose: () => void
}

function configureTexture(texture: Texture) {
  texture.flipY = false
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
}

function createPlaceholderPixels(textureWidth: number, textureHeight: number) {
  const pixels = new Uint8Array(textureWidth * textureHeight * 4)

  for (let y = 0; y < textureHeight; y += 1) {
    for (let x = 0; x < textureWidth; x += 1) {
      const offset = (y * textureWidth + x) * 4
      const stripe = ((x + y) % 32) < 16 ? 1 : 0

      pixels[offset] = stripe ? 168 : 122
      pixels[offset + 1] = stripe ? 192 : 154
      pixels[offset + 2] = stripe ? 232 : 206
      pixels[offset + 3] = 255
    }
  }

  return pixels
}

function createPlaceholderDataTexture(textureWidth: number, textureHeight: number) {
  const texture = new DataTexture(
    createPlaceholderPixels(textureWidth, textureHeight),
    textureWidth,
    textureHeight,
    RGBAFormat,
    UnsignedByteType,
  )

  configureTexture(texture)

  return texture
}

function createAtlasLayout(records: SphereImageRecord[], tileSize: number): AtlasLayout {
  const safeRecords = records.length ? records : [createPlaceholderSphereRecord()]
  const atlasCount = Math.max(safeRecords.length, 1)
  const columns = Math.ceil(Math.sqrt(atlasCount))
  const rows = Math.ceil(atlasCount / columns)
  const textureWidth = columns * tileSize
  const textureHeight = rows * tileSize

  return {
    columns,
    rows,
    textureWidth,
    textureHeight,
    tiles: safeRecords.map((record, index) => ({
      recordId: record.id,
      offset: [(index % columns) * (tileSize / textureWidth), 1 - (Math.floor(index / columns) + 1) * (tileSize / textureHeight)],
      scale: [tileSize / textureWidth, tileSize / textureHeight],
    })) satisfies SphereAtlasTile[],
  }
}

function drawPlaceholderTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileSize: number,
  index: number,
) {
  const gradient = context.createLinearGradient(x, y, x + tileSize, y + tileSize)

  gradient.addColorStop(0, index % 2 === 0 ? "#c7d7f5" : "#d5ebff")
  gradient.addColorStop(1, index % 2 === 0 ? "#8ca2d7" : "#7aa7dc")

  context.fillStyle = gradient
  context.fillRect(x, y, tileSize, tileSize)

  context.fillStyle = "rgba(255, 255, 255, 0.18)"
  context.fillRect(x, y + tileSize * 0.58, tileSize, tileSize * 0.42)

  context.strokeStyle = "rgba(255, 255, 255, 0.55)"
  context.lineWidth = Math.max(2, tileSize * 0.02)
  context.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2)
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & ImageLoaderLike,
  x: number,
  y: number,
  tileSize: number,
) {
  const sourceWidth = image.width
  const sourceHeight = image.height
  const sourceAspect = sourceWidth / sourceHeight
  const destinationAspect = 1

  let cropWidth = sourceWidth
  let cropHeight = sourceHeight
  let cropX = 0
  let cropY = 0

  if (sourceAspect > destinationAspect) {
    cropWidth = sourceHeight * destinationAspect
    cropX = (sourceWidth - cropWidth) / 2
  } else {
    cropHeight = sourceWidth / destinationAspect
    cropY = (sourceHeight - cropHeight) / 2
  }

  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, x, y, tileSize, tileSize)
}

function createAtlasBuildTarget(records: SphereImageRecord[], tileSize: number): AtlasBuildTarget {
  const normalizedRecords = normalizeSphereImageRecords(records)
  const safeRecords = normalizedRecords.length ? normalizedRecords : [createPlaceholderSphereRecord()]
  const layout = createAtlasLayout(safeRecords, tileSize)

  if (typeof document === "undefined") {
    const texture = createPlaceholderDataTexture(layout.textureWidth, layout.textureHeight)

    return {
      layout,
      resource: {
        texture,
        tiles: layout.tiles,
      },
      context: null,
      dispose: () => {
        texture.dispose()
      },
    }
  }

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    const texture = createPlaceholderDataTexture(layout.textureWidth, layout.textureHeight)

    return {
      layout,
      resource: {
        texture,
        tiles: layout.tiles,
      },
      context: null,
      dispose: () => {
        texture.dispose()
      },
    }
  }

  canvas.width = layout.textureWidth
  canvas.height = layout.textureHeight

  for (let index = 0; index < safeRecords.length; index += 1) {
    const column = index % layout.columns
    const row = Math.floor(index / layout.columns)

    drawPlaceholderTile(context, column * tileSize, row * tileSize, tileSize, index)
  }

  const texture = new CanvasTexture(canvas)

  configureTexture(texture)

  return {
    layout,
    resource: {
      texture,
      tiles: layout.tiles,
    },
    context,
    dispose: () => {
      texture.dispose()
    },
  }
}

function createTextureUpdateScheduler(texture: Texture, onAtlasInvalidate?: () => void) {
  let frameId: number | null = null

  const flush = () => {
    frameId = null
    texture.needsUpdate = true
    onAtlasInvalidate?.()
  }

  return {
    schedule() {
      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        flush()
        return
      }

      if (frameId !== null) {
        return
      }

      frameId = window.requestAnimationFrame(flush)
    },
    flush,
    cancel() {
      if (frameId === null || typeof window === "undefined" || typeof window.cancelAnimationFrame !== "function") {
        frameId = null
        return
      }

      window.cancelAnimationFrame(frameId)
      frameId = null
    },
  }
}

function drawLoadedTile(
  context: CanvasRenderingContext2D,
  layout: AtlasLayout,
  image: CanvasImageSource & ImageLoaderLike,
  index: number,
  tileSize: number,
) {
  const column = index % layout.columns
  const row = Math.floor(index / layout.columns)
  const x = column * tileSize
  const y = row * tileSize

  drawCoverImage(context, image, x, y, tileSize)
}

export function useTexturePipeline(records: SphereImageRecord[], options: TexturePipelineOptions) {
  const normalizedRecords = useMemo(() => normalizeSphereImageRecords(records), [records])
  const [atlas, setAtlas] = useState<SphereAtlasResource | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    const buildTarget = createAtlasBuildTarget(normalizedRecords, options.tileSize)
    const updateScheduler = createTextureUpdateScheduler(buildTarget.resource.texture, options.onAtlasInvalidate)

    setAtlas(buildTarget.resource)
    setStatus(normalizedRecords.length ? "loading" : "ready")

    if (!normalizedRecords.length || !buildTarget.context) {
      updateScheduler.flush()
      setStatus("ready")

      return () => {
        cancelled = true
        updateScheduler.cancel()
        buildTarget.dispose()
      }
    }

    let completedCount = 0
    let successCount = 0

    normalizedRecords.forEach((record, index) => {
      void loadSphereImageRecord(record)
        .then((image) => {
          if (cancelled) {
            return
          }

          drawLoadedTile(buildTarget.context as CanvasRenderingContext2D, buildTarget.layout, image, index, options.tileSize)
          successCount += 1
          updateScheduler.schedule()
        })
        .catch(() => {})
        .finally(() => {
          if (cancelled) {
            return
          }

          completedCount += 1

          if (completedCount !== normalizedRecords.length) {
            return
          }

          updateScheduler.flush()
          setStatus(successCount > 0 ? "ready" : "error")
        })
    })

    return () => {
      cancelled = true
      updateScheduler.cancel()
      buildTarget.dispose()
    }
  }, [normalizedRecords, options.onAtlasInvalidate, options.tileSize])

  return {
    atlas,
    status,
  }
}
