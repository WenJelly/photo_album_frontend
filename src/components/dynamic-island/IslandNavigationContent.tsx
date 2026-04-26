import { Gauge, LogOut, Upload, User } from "lucide-react"

import type { AuthUser } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

interface IslandNavigationContentProps {
  canRunStressDemo: boolean
  compact: boolean
  currentPage: "home" | "gallery" | "adminReview" | "me" | "user"
  isLoggedIn: boolean
  onAdminReviewClick: () => void
  onCompactToggle: () => void
  onGalleryClick: () => void
  onHomeClick: () => void
  onLoginClick: () => void
  onLogoutClick: () => void
  onMyProfileClick: () => void
  onRunStressDemo: () => void
  onUploadClick: () => void
  user: AuthUser | null
}

const navItemClass =
  "shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium tracking-[0.02em] text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
const navItemActiveClass = "bg-white/12 text-white"
const actionClass =
  "dynamic-island-geometry-lock inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/82 transition hover:bg-white/[0.10] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"

function IslandAvatar({
  className,
  user,
}: {
  className: string
  user: AuthUser
}) {
  if (user.userAvatar) {
    return (
      <span className={cn("dynamic-island-avatar-frame", className)}>
        <img
          src={user.userAvatar}
          alt=""
          className="dynamic-island-avatar-media dynamic-island-geometry-lock"
        />
      </span>
    )
  }

  return (
    <span className={cn("dynamic-island-avatar-frame", className)}>
      <span className="dynamic-island-avatar-fallback dynamic-island-geometry-lock">
        <User className="size-4" />
      </span>
    </span>
  )
}

function CompactAvatar({ isLoggedIn, user }: { isLoggedIn: boolean; user: AuthUser | null }) {
  if (!isLoggedIn) {
    return <span className="dynamic-island-login-chip">Login</span>
  }

  return <IslandAvatar className="size-9" user={user!} />
}

export function IslandNavigationContent({
  canRunStressDemo,
  compact,
  currentPage,
  isLoggedIn,
  onAdminReviewClick,
  onCompactToggle,
  onGalleryClick,
  onHomeClick,
  onLoginClick,
  onLogoutClick,
  onMyProfileClick,
  onRunStressDemo,
  onUploadClick,
  user,
}: IslandNavigationContentProps) {
  const isAdmin = user?.userRole === "admin"
  const showUploadAction = isLoggedIn && currentPage === "gallery"

  if (compact) {
    return (
      <button
        type="button"
        className="dynamic-island-compact-toggle dynamic-island-content-offset"
        onClick={onCompactToggle}
      >
        <span className="dynamic-island-brand">
          <span className="dynamic-island-brand__title dynamic-island-text-container">WenJelly</span>
          <span className="dynamic-island-brand__caption dynamic-island-text-container">Standby Capsule</span>
        </span>
        <CompactAvatar isLoggedIn={isLoggedIn} user={user} />
      </button>
    )
  }

  return (
    <div className="dynamic-island-nav dynamic-island-content-offset">
      <div className="min-w-0">
        <nav className="dynamic-island-nav__links" aria-label="Primary">
          <button
            type="button"
            onClick={onHomeClick}
            aria-current={currentPage === "home" ? "page" : undefined}
            className={cn(navItemClass, currentPage === "home" && navItemActiveClass)}
          >
            WenJelly
          </button>
          <button
            type="button"
            onClick={onGalleryClick}
            aria-current={currentPage === "gallery" ? "page" : undefined}
            className={cn(navItemClass, currentPage === "gallery" && navItemActiveClass)}
          >
            图库
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={onAdminReviewClick}
              aria-current={currentPage === "adminReview" ? "page" : undefined}
              className={cn(navItemClass, currentPage === "adminReview" && navItemActiveClass)}
            >
              审核管理
            </button>
          ) : null}
        </nav>
      </div>

      <div className="dynamic-island-nav__actions">
        {showUploadAction ? (
          <button type="button" onClick={onUploadClick} className={actionClass}>
            <Upload className="size-4" />
            <span>上传</span>
          </button>
        ) : null}
        {canRunStressDemo ? (
          <button type="button" onClick={onRunStressDemo} className={actionClass}>
            <Gauge className="size-4" />
            <span>一键压测</span>
          </button>
        ) : null}
        {isLoggedIn ? (
          <>
            <button type="button" onClick={onMyProfileClick} className={actionClass}>
              <IslandAvatar className="size-6" user={user!} />
              <span className="dynamic-island-text-container max-w-[8ch]">{user?.userName}</span>
            </button>
            <button type="button" onClick={onLogoutClick} className="dynamic-island-icon-button" aria-label="退出登录">
              <LogOut className="size-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={onLoginClick} className={actionClass}>
            登录
          </button>
        )}
      </div>
    </div>
  )
}
