import { X } from "lucide-react"
import { motion } from "framer-motion"

import type { IslandTask } from "@/types/island-task"

import { MiniTerminal } from "./MiniTerminal"

interface IslandTaskPanelProps {
  onDismiss: () => void
  onPreviewPhoto: () => void
  onToggleTerminal: () => void
  reducedMotion: boolean
  task: IslandTask
}

function getStatusLabel(task: IslandTask) {
  if (task.type === "upload") {
    switch (task.phase) {
      case "transferring":
        return "上传中"
      case "processing":
        return "处理中"
      case "published":
        return "已发布"
      case "pendingReview":
        return "待审核"
      case "failed":
        return "失败"
      default:
        break
    }
  }

  if (task.status === "success") {
    return "Synced"
  }

  if (task.status === "error") {
    return "Fault"
  }

  return "Live"
}

function getStatusTone(task: IslandTask) {
  if (task.status === "success") {
    return "dynamic-island-status dynamic-island-status--success"
  }

  if (task.status === "error") {
    return "dynamic-island-status dynamic-island-status--error"
  }

  return "dynamic-island-status dynamic-island-status--running"
}

function getTaskEyebrow(task: IslandTask) {
  return task.type === "upload" ? "上传任务" : "Pipeline Console"
}

function getProgressMetaLabel(task: IslandTask) {
  return task.type === "upload" ? "阶段" : "Task Flux"
}

function getProgressLabel(task: IslandTask, progress: number | null) {
  if (task.type === "upload" && progress === null) {
    if (task.phase === "processing") {
      return "处理中..."
    }

    if (task.phase === "failed") {
      return "已停止"
    }

    return "进行中"
  }

  if (progress === null) {
    return "Live"
  }

  return `${Math.round(progress * 100)}%`
}

function shouldShowPreviewAction(task: IslandTask) {
  return (
    task.type === "upload" &&
    (task.phase === "published" || task.phase === "pendingReview") &&
    task.status === "success" &&
    Boolean(task.previewPhoto)
  )
}

export function IslandTaskPanel({ onDismiss, onPreviewPhoto, onToggleTerminal, reducedMotion, task }: IslandTaskPanelProps) {
  const progressValue = task.progress === null ? null : Math.min(Math.max(task.progress, 0), 1)
  const progressScale = progressValue === null ? 0.35 : progressValue
  const isFailedUpload = task.type === "upload" && task.phase === "failed"

  return (
    <div className="dynamic-island-task-panel">
      <div className="dynamic-island-task-panel__summary">
        <div className="dynamic-island-task-panel__text space-y-1">
          <p className="dynamic-island-eyebrow">{getTaskEyebrow(task)}</p>
          <div className="dynamic-island-task-panel__title-row">
            <h2 className="dynamic-island-task-panel__title dynamic-island-text-container">{task.title}</h2>
            <span className={`${getStatusTone(task)} dynamic-island-geometry-lock`}>{getStatusLabel(task)}</span>
          </div>
          <p className="dynamic-island-task-panel__copy dynamic-island-text-container">{task.summary}</p>
        </div>
        <div className="dynamic-island-task-panel__controls">
          {task.metric ? (
            <div className="dynamic-island-metric dynamic-island-geometry-lock">
              <span className="dynamic-island-metric__label">{task.metric.label}</span>
              <span className="dynamic-island-metric__value">{task.metric.value}</span>
            </div>
          ) : null}
          {shouldShowPreviewAction(task) ? (
            <button
              type="button"
              className="dynamic-island-ghost-button dynamic-island-geometry-lock"
              onClick={onPreviewPhoto}
            >
              预览作品
            </button>
          ) : null}
          <button
            type="button"
            className="dynamic-island-ghost-button dynamic-island-geometry-lock"
            onClick={onToggleTerminal}
          >
            {task.terminalOpen ? "Hide Terminal" : "Mini Terminal"}
          </button>
          {task.status !== "running" ? (
            <button
              type="button"
              className="dynamic-island-icon-button dynamic-island-geometry-lock"
              onClick={(event) => {
                event.currentTarget.blur()
                onDismiss()
              }}
              aria-label="Dismiss task panel"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="dynamic-island-progress">
        <div className="dynamic-island-progress__meta">
          <span>{getProgressMetaLabel(task)}</span>
          <span>{getProgressLabel(task, progressValue)}</span>
        </div>
        <div className="dynamic-island-progress__track">
          {isFailedUpload ? (
            <div
              className="dynamic-island-progress__bar dynamic-island-progress__bar--stopped"
            />
          ) : progressValue === null ? (
            <div
              className="dynamic-island-progress__bar dynamic-island-progress__bar--indeterminate"
            />
          ) : (
            <motion.div
              className="dynamic-island-progress__bar"
              style={{ transformOrigin: "left center" }}
              animate={{ scaleX: progressScale }}
              transition={reducedMotion ? { duration: 0.16 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </div>
      </div>

      <MiniTerminal logs={task.logs} open={task.terminalOpen} reducedMotion={reducedMotion} />
    </div>
  )
}
