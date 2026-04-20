const preloadedImageSources = new Set<string>()

export function preloadImage(src?: string | null) {
  if (!src || typeof Image === "undefined" || preloadedImageSources.has(src)) {
    return
  }

  preloadedImageSources.add(src)

  const image = new Image()
  image.decoding = "async"
  image.src = src
}

export function preloadImages(sources: Array<string | null | undefined>) {
  for (const source of sources) {
    preloadImage(source)
  }
}
