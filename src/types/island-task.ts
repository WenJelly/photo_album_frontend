import type { UploadProgressSnapshot } from "@/lib/upload-progress"
import type { Photo } from "@/types/photo"

export type IslandTaskType = "upload" | "stress-demo"
export type IslandTaskStatus = "running" | "success" | "error"
export type UploadTaskPhase = "transferring" | "processing" | "published" | "pendingReview" | "failed"
export type UploadTaskMode = "file" | "url"

export interface IslandTaskMetric {
  label: string
  value: string
}

export interface IslandTask {
  id: string
  type: IslandTaskType
  phase?: UploadTaskPhase
  status: IslandTaskStatus
  title: string
  summary: string
  progress: number | null
  logs: string[]
  metric?: IslandTaskMetric
  previewPhoto?: Photo
  terminalOpen: boolean
}

export type UploadTaskEvent =
  | {
      type: "start"
      mode: UploadTaskMode
      label: string
    }
  | {
      type: "progress"
      mode: UploadTaskMode
      progress: UploadProgressSnapshot
    }
  | {
      type: "success"
      mode: UploadTaskMode
      photo: Photo
    }
  | {
      type: "error"
      mode: UploadTaskMode
      message: string
    }
