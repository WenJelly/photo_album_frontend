import { AnimatePresence, motion } from "framer-motion"
import { useLayoutEffect, useState } from "react"

import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import type { IslandTask } from "@/types/island-task"

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
  suspendLayoutProjection?: boolean
  task: IslandTask | null
  variant: ExhibitionHeaderVariant
}

const shellSpringTransition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 } as const
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
  suspendLayoutProjection = false,
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
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
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
          layout={layoutEnabled && !suspendLayoutProjection}
          data-testid="dynamic-island-shell"
          data-testid-legacy="exhibition-header"
          data-layout-enabled={String(layoutEnabled && !suspendLayoutProjection)}
          data-shell-layout="true"
          className={cn(
            getIslandWidthClass(view),
            "dynamic-island-shell",
            variant === "transparent" ? "dynamic-island-shell--transparent" : "dynamic-island-shell--solid",
            view === "task" && "dynamic-island-shell--task",
          )}
          transition={shellTransition}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {view === "task" && task ? (
              <motion.div
                key="task"
                {...contentAnimation}
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
        </motion.div>
      </motion.header>
    </div>
  )
}
