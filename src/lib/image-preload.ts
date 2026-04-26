const preloadedImageSources = new Set<string>()
const inflightImageWarmups = new Map<string, Promise<void>>()

function normalizeImageSource(src?: string | null) {
  const normalizedSource = src?.trim()
  return normalizedSource ? normalizedSource : null
}

function warmImageSource(src?: string | null) {
  const normalizedSource = normalizeImageSource(src)

  if (!normalizedSource || typeof Image === "undefined") {
    return Promise.resolve()
  }

  if (preloadedImageSources.has(normalizedSource)) {
    return Promise.resolve()
  }

  const inflightWarmup = inflightImageWarmups.get(normalizedSource)

  if (inflightWarmup) {
    return inflightWarmup
  }

  const image = new Image()
  image.decoding = "async"

  const warmup = new Promise<void>((resolve) => {
    let settled = false

    const finish = () => {
      if (settled) {
        return
      }

      settled = true
      image.onload = null
      image.onerror = null
      preloadedImageSources.add(normalizedSource)
      inflightImageWarmups.delete(normalizedSource)
      resolve()
    }

    image.onload = finish
    image.onerror = finish
    image.src = normalizedSource

    if (typeof image.decode === "function") {
      try {
        void image.decode().catch(() => undefined).finally(finish)
      } catch {
        finish()
      }
    }
  })

  inflightImageWarmups.set(normalizedSource, warmup)

  return warmup
}

export function preloadImage(src?: string | null) {
  void warmImageSource(src)
}

export function preloadImages(sources: Array<string | null | undefined>) {
  for (const source of sources) {
    preloadImage(source)
  }
}
