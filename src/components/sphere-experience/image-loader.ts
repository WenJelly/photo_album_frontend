import { normalizeSphereImageRecords } from "./constants"
import type { SphereImageRecord } from "./types"

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export interface ImageLoaderLike {
  width: number
  height: number
}

function loadImageUrl(url: string, priority: "auto" | "low") {
  const cached = imageCache.get(url)

  if (cached) {
    return cached
  }

  const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const priorityImage = image as HTMLImageElement & { fetchPriority?: "auto" | "high" | "low" }

    image.crossOrigin = "anonymous"
    image.decoding = "async"
    image.referrerPolicy = "no-referrer"
    priorityImage.fetchPriority = priority
    image.onload = async () => {
      try {
        await image.decode?.()
      } catch {
        // Ignore decode failures; the loaded image can still be used for atlas draw.
      }

      resolve(image)
    }
    image.onerror = () => {
      imageCache.delete(url)
      reject(new Error(`Failed to load ${url}`))
    }
    image.src = url
  })

  imageCache.set(url, imagePromise)

  return imagePromise
}

export function loadSphereImageRecord(record: SphereImageRecord, priority: "auto" | "low" = "auto") {
  if (typeof Image === "undefined") {
    return Promise.reject(new Error("Image loading unavailable"))
  }

  const primaryUrl = record.imageUrl.trim()
  const fallbackUrl = record.fallbackImageUrl?.trim()

  if (primaryUrl) {
    return loadImageUrl(primaryUrl, priority).catch((error) => {
      if (!fallbackUrl || fallbackUrl === primaryUrl) {
        throw error
      }

      return loadImageUrl(fallbackUrl, priority)
    })
  }

  if (fallbackUrl) {
    return loadImageUrl(fallbackUrl, priority)
  }

  return Promise.reject(new Error("Image loading unavailable"))
}

export function primeImageRecords(records: SphereImageRecord[]) {
  const normalizedRecords = normalizeSphereImageRecords(records)

  for (const record of normalizedRecords) {
    void loadSphereImageRecord(record, "low")
  }
}
