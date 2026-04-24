import { X } from "lucide-react"
import { motion } from "framer-motion"

import type { IslandTask } from "@/types/island-task"

import { MiniTerminal } from "./MiniTerminal"

interface IslandTaskPanelProps {
  onDismiss: () => void
  onToggleTerminal: () => void
  reducedMotion: boolean
  task: IslandTask
}

function getStatusLabel(task: IslandTask) {
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
  return task.type === "upload" ? "Transfer Control" : "Pipeline Console"
}

function getProgressLabel(progress: number | null) {
  if (progress === null) {
    return "Live"
  }

  return `${Math.round(progress * 100)}%`
}

export function IslandTaskPanel({ onDismiss, onToggleTerminal, reducedMotion, task }: IslandTaskPanelProps) {
  const progressValue = task.progress === null ? null : Math.min(Math.max(task.progress, 0), 1)
  const progressScale = progressValue === null ? 0.35 : progressValue

  return (
    <div className="dynamic-island-task-panel">
      <div className="dynamic-island-task-panel__summary">
        <div className="space-y-1">
          <p className="dynamic-island-eyebrow">{getTaskEyebrow(task)}</p>
          <div className="dynamic-island-task-panel__title-row">
            <h2 className="dynamic-island-task-panel__title">{task.title}</h2>
            <span className={getStatusTone(task)}>{getStatusLabel(task)}</span>
          </div>
          <p className="dynamic-island-task-panel__copy">{task.summary}</p>
        </div>
        <div className="dynamic-island-task-panel__controls">
          {task.metric ? (
            <div className="dynamic-island-metric">
              <span className="dynamic-island-metric__label">{task.metric.label}</span>
              <span className="dynamic-island-metric__value">{task.metric.value}</span>
            </div>
          ) : null}
          <button
            type="button"
            data-testid="island-task-terminal-toggle"
            className="dynamic-island-ghost-button"
            onClick={onToggleTerminal}
          >
            {task.terminalOpen ? "Hide Terminal" : "Mini Terminal"}
          </button>
          {task.status !== "running" ? (
            <button
              type="button"
              data-testid="island-task-dismiss"
              className="dynamic-island-icon-button"
              onClick={onDismiss}
              aria-label="Dismiss task panel"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="dynamic-island-progress">
        <div className="dynamic-island-progress__meta">
          <span>Task Flux</span>
          <span>{getProgressLabel(progressValue)}</span>
        </div>
        <div className="dynamic-island-progress__track">
          {progressValue === null ? (
            <div className="dynamic-island-progress__bar dynamic-island-progress__bar--indeterminate" />
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
