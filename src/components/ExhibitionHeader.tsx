import { AnimatePresence, motion } from "framer-motion"
import { useLayoutEffect, useState } from "react"

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
  onMyProfileClick: () => void
  onRunStressDemo: () => void
  onToggleTaskTerminal: () => void
  onUploadClick: () => void
  routeKey: string
  task: IslandTask | null
  variant: ExhibitionHeaderVariant
}

const shellSpringTransition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9, bounce: 0 } as const
const reducedMotionTransition = { duration: 0.16 } as const
const contentTransition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const

function getIslandWidthClass(view: "expanded" | "compact" | "task") {
  if (view === "compact") {
    return "w-[min(22rem,calc(100vw-1.5rem))] sm:w-[22rem]"
  }

  if (view === "task") {
    return "w-[min(64rem,calc(100vw-1.5rem))]"
  }

  return "w-[min(60rem,calc(100vw-1.5rem))]"
}

function getContentFrameClass(view: "expanded" | "compact" | "task") {
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
  onMyProfileClick,
  onRunStressDemo,
  onToggleTaskTerminal,
  onUploadClick,
  routeKey,
  task,
  variant,
}: ExhibitionHeaderProps) {
  const { user, isLoggedIn, logout } = useAuth()
  const [layoutEnabled, setLayoutEnabled] = useState(true)
  const {
    onBlurCapture,
    onCompactToggle,
    onFocusCapture,
    onMouseEnter,
    onMouseLeave,
    prefersReducedMotion,
    rootRef,
    view,
  } = useIslandController({ hasTask: task !== null, routeKey })

  useLayoutEffect(() => {
    setLayoutEnabled(false)

    const frameId = window.requestAnimationFrame(() => {
      setLayoutEnabled(true)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [routeKey])

  const shellTransition = prefersReducedMotion ? reducedMotionTransition : shellSpringTransition
  const innerContentTransition = prefersReducedMotion ? reducedMotionTransition : contentTransition
  const contentAnimation = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 6, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -6, scale: 0.96 },
      }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:px-4 md:pt-4">
      <motion.header
        layoutRoot
        ref={rootRef}
        data-testid="dynamic-island"
        data-layout-root="true"
        data-reduced-motion={String(prefersReducedMotion)}
        data-shell-layout="false"
        data-testid-legacy="exhibition-header"
        data-variant={variant}
        data-view={view}
        onBlurCapture={onBlurCapture}
        onFocusCapture={onFocusCapture}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="pointer-events-auto"
      >
        <motion.div
          layout={layoutEnabled}
          data-testid="dynamic-island-shell"
          data-testid-legacy="exhibition-header"
          data-layout-enabled={String(layoutEnabled)}
          data-shell-layout="true"
          className={cn(
            getIslandWidthClass(view),
            "dynamic-island-shell",
            variant === "transparent" ? "dynamic-island-shell--transparent" : "dynamic-island-shell--solid",
            view === "task" && "dynamic-island-shell--task",
          )}
          transition={shellTransition}
        >
          {view !== "task" ? (
            <div className="dynamic-island-logo-anchor" data-testid="dynamic-island-logo-anchor">
              <div className="dynamic-island-logo-anchor__inner" data-testid="dynamic-island-logo-anchor-inner">
                <button
                  type="button"
                  className="dynamic-island-logo-anchor__button"
                  onClick={view === "compact" ? onCompactToggle : onHomeClick}
                  aria-label={view === "compact" ? "Expand navigation" : "Navigate home"}
                >
                  <BoluoLogo className="h-9 w-auto object-contain" />
                </button>
              </div>
            </div>
          ) : null}
          <div className="dynamic-island-content-stage" data-testid="dynamic-island-content-stage">
            <AnimatePresence mode="popLayout" initial={false}>
              {view === "task" && task ? (
                <motion.div
                  key="task"
                  {...contentAnimation}
                  className={getContentFrameClass(view)}
                  data-island-content-view="task"
                  data-testid="dynamic-island-content-frame"
                  transition={innerContentTransition}
                >
                  <IslandTaskPanel
                    onDismiss={onDismissTask}
                    task={task}
                    onToggleTerminal={onToggleTaskTerminal}
                    reducedMotion={prefersReducedMotion}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={view}
                  {...contentAnimation}
                  className={getContentFrameClass(view)}
                  data-island-content-view={view}
                  data-testid="dynamic-island-content-frame"
                  transition={innerContentTransition}
                >
                  <IslandNavigationContent
                    canRunStressDemo={canRunStressDemo}
                    compact={view === "compact"}
                    currentPage={currentPage}
                    isLoggedIn={isLoggedIn}
                    onAdminReviewClick={onAdminReviewClick}
                    onCompactToggle={onCompactToggle}
                    onGalleryClick={onGalleryClick}
                    onHomeClick={onHomeClick}
                    onLoginClick={onLoginClick}
                    onLogoutClick={logout}
                    onMyProfileClick={onMyProfileClick}
                    onRunStressDemo={onRunStressDemo}
                    onUploadClick={onUploadClick}
                    reducedMotion={prefersReducedMotion}
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
