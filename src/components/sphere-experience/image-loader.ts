import { normalizeSphereImageRecords } from "./constants"
import type { SphereImageRecord } from "./types"

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export interface ImageLoaderLike {
  width: number
  height: number
}

export function loadSphereImageRecord(record: SphereImageRecord, priority: "auto" | "low" = "auto") {
  if (!record.imageUrl || typeof Image === "undefined") {
    return Promise.reject(new Error("Image loading unavailable"))
  }

  const cached = imageCache.get(record.imageUrl)

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
      imageCache.delete(record.imageUrl)
      reject(new Error(`Failed to load ${record.imageUrl}`))
    }
    image.src = record.imageUrl
  })

  imageCache.set(record.imageUrl, imagePromise)

  return imagePromise
}

export function primeImageRecords(records: SphereImageRecord[]) {
  const normalizedRecords = normalizeSphereImageRecords(records)

  for (const record of normalizedRecords) {
    void loadSphereImageRecord(record, "low")
  }
}
