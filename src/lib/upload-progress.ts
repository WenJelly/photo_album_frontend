export interface UploadProgressSnapshot {
  loaded: number
  total?: number
  progress: number | null
}

interface UploadProgressEventLike {
  loaded?: number
  total?: number
  progress?: number
}

export function buildUploadProgressSnapshot(event: UploadProgressEventLike): UploadProgressSnapshot {
  const loaded = typeof event.loaded === "number" && Number.isFinite(event.loaded) ? event.loaded : 0
  const total = typeof event.total === "number" && Number.isFinite(event.total) ? event.total : undefined
  const explicitProgress = typeof event.progress === "number" && Number.isFinite(event.progress) ? event.progress : undefined

  return {
    loaded,
    total,
    progress: explicitProgress ?? (typeof total === "number" && total > 0 ? loaded / total : null),
  }
}
