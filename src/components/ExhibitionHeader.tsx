import { useEffect, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"

import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import type { IslandTask } from "@/types/island-task"

import { BoluoLogo } from "./dynamic-island/BoluoLogo"
import { IslandNavigationContent } from "./dynamic-island/IslandNavigationContent"
import { IslandTaskPanel } from "./dynamic-island/IslandTaskPanel"
import { useIslandController } from "./dynamic-island/useIslandController"

export type ExhibitionHeaderVariant = "transparent" | "solid"

interface ExhibitionHeaderProps {
  canRunStressDemo: boolean
  currentPage: "home" | "gallery" | "adminReview" | "me" | "user"
  onAdminReviewClick: () => void
  onDismissTask: () => void
  onGalleryClick: () => void
  onHomeClick: () => void
  onLoginClick: () => void
  onLogoutClick: () => void
  onMyProfileClick: () => void
  onPreviewTaskPhoto: () => void
  onRunStressDemo: () => void
  onToggleTaskTerminal: () => void
  onUploadClick: () => void
  task: IslandTask | null
  variant: ExhibitionHeaderVariant
}

const shellSpringTransition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9, bounce: 0 } as const
const reducedMotionTransition = { duration: 0.16 } as const
const contentTransition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const

const VIEWPORT_MARGIN_REM = 1.5
const VIEW_WIDTHS_REM: Record<"expanded" | "compact" | "task", number> = {
  compact: 22,
  expanded: 60,
  task: 64,
}

function readViewportWidth() {
  if (typeof window === "undefined") {
    return 1280
  }

  return window.innerWidth || document.documentElement.clientWidth || 1280
}

function readRootFontSize() {
  if (typeof window === "undefined") {
    return 16
  }

  const parsedFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : 16
}

function resolveIslandWidth(view: "expanded" | "compact" | "task", viewportWidth: number) {
  const rootFontSize = readRootFontSize()
  const viewportBoundWidth = Math.max(viewportWidth - VIEWPORT_MARGIN_REM * rootFontSize, 0)
  const preferredWidth = VIEW_WIDTHS_REM[view] * rootFontSize

  return Math.min(preferredWidth, viewportBoundWidth)
}

function getContentFrameClass(view: "expanded" | "compact" | "task") {
  if (view === "task") {
    return "dynamic-island-content-frame dynamic-island-content-frame--shell"
  }

  return view === "compact"
    ? "dynamic-island-content-frame dynamic-island-content-frame--shell"
    : "dynamic-island-content-frame dynamic-island-content-frame--intrinsic"
}

export function ExhibitionHeader({
  canRunStressDemo,
  currentPage,
  onAdminReviewClick,
  onDismissTask,
  onGalleryClick,
  onHomeClick,
  onLoginClick,
  onLogoutClick,
  onMyProfileClick,
  onPreviewTaskPhoto,
  onRunStressDemo,
  onToggleTaskTerminal,
  onUploadClick,
  task,
  variant,
}: ExhibitionHeaderProps) {
  const { user, isLoggedIn } = useAuth()
  const [viewportWidth, setViewportWidth] = useState(readViewportWidth)
  const {
    onBlurCapture,
    onCompactMouseEnter,
    onCompactToggle,
    onMouseLeave,
    prefersReducedMotion,
    rootRef,
    view,
  } = useIslandController({ hasTask: task !== null })
  const islandWidth = resolveIslandWidth(view, viewportWidth)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleResize = () => setViewportWidth(readViewportWidth())

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const shellTransition = prefersReducedMotion ? reducedMotionTransition : shellSpringTransition
  const innerContentTransition = prefersReducedMotion ? reducedMotionTransition : contentTransition
  const contentAnimation = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:px-4 md:pt-4">
      <motion.header
        layoutRoot
        ref={rootRef}
        onBlurCapture={onBlurCapture}
        onMouseLeave={onMouseLeave}
        className="pointer-events-auto"
      >
        <motion.div
          animate={{ width: islandWidth }}
          className={cn(
            "dynamic-island-shell",
            variant === "transparent" ? "dynamic-island-shell--transparent" : "dynamic-island-shell--solid",
            view === "task" && "dynamic-island-shell--task",
          )}
          style={{ width: islandWidth }}
          transition={shellTransition}
        >
          {view !== "task" ? (
            <div className="dynamic-island-logo-anchor">
              <div className="dynamic-island-logo-anchor__inner">
                <button
                  type="button"
                  className="dynamic-island-logo-anchor__button"
                  onClick={view === "compact" ? onCompactToggle : onHomeClick}
                  onMouseEnter={view === "compact" ? onCompactMouseEnter : undefined}
                  aria-label={view === "compact" ? "Expand navigation" : "Navigate home"}
                >
                  <BoluoLogo className="h-9 w-auto object-contain" />
                </button>
              </div>
            </div>
          ) : null}
          <div className="dynamic-island-content-stage">
            <AnimatePresence initial={false}>
              {view === "task" && task ? (
                <motion.div
                  key="task"
                  {...contentAnimation}
                  className={getContentFrameClass(view)}
                  transition={innerContentTransition}
                >
                  <IslandTaskPanel
                    onDismiss={onDismissTask}
                    onPreviewPhoto={onPreviewTaskPhoto}
                    task={task}
                    onToggleTerminal={onToggleTaskTerminal}
                    reducedMotion={prefersReducedMotion}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="nav"
                  {...contentAnimation}
                  className={getContentFrameClass(view)}
                  transition={innerContentTransition}
                >
                  <IslandNavigationContent
                    canRunStressDemo={canRunStressDemo}
                    compact={view === "compact"}
                    currentPage={currentPage}
                    isLoggedIn={isLoggedIn}
                    menuTone={variant}
                    onAdminReviewClick={onAdminReviewClick}
                    onCompactMouseEnter={onCompactMouseEnter}
                    onCompactToggle={onCompactToggle}
                    onGalleryClick={onGalleryClick}
                    onHomeClick={onHomeClick}
                    onLoginClick={onLoginClick}
                    onLogoutClick={onLogoutClick}
                    onMyProfileClick={onMyProfileClick}
                    onRunStressDemo={onRunStressDemo}
                    onUploadClick={onUploadClick}
                    user={user}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.header>
    </div>
  )
}
