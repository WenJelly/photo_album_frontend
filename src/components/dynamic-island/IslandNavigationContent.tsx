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
  reducedMotion: boolean
  user: AuthUser | null
}

const navItemClass =
  "rounded-full px-3 py-2 text-[13px] font-medium tracking-[0.02em] text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
const navItemActiveClass = "bg-white/12 text-white"
const actionClass =
  "inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/82 transition hover:bg-white/[0.10] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"

function CompactAvatar({ isLoggedIn, user }: { isLoggedIn: boolean; user: AuthUser | null }) {
  if (!isLoggedIn) {
    return <span className="dynamic-island-login-chip">Login</span>
  }

  if (user?.userAvatar) {
    return <img src={user.userAvatar} alt="" className="size-9 rounded-full object-cover" />
  }

  return (
    <span className="dynamic-island-avatar-fallback">
      <User className="size-4" />
    </span>
  )
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
  reducedMotion,
  user,
}: IslandNavigationContentProps) {
  const isAdmin = user?.userRole === "admin"
  const showUploadAction = isLoggedIn && currentPage === "gallery"

  if (compact) {
    return (
      <button
        type="button"
        data-testid="dynamic-island-toggle"
        className="dynamic-island-compact-toggle"
        data-reduced-motion={String(reducedMotion)}
        onClick={onCompactToggle}
      >
        <span className="flex items-center gap-3">
          <img src="/boluo.svg" alt="" aria-hidden="true" className="h-9 w-auto object-contain" />
          <span className="dynamic-island-brand">
            <span className="dynamic-island-brand__title">WenJelly</span>
            <span className="dynamic-island-brand__caption">Standby Capsule</span>
          </span>
        </span>
        <CompactAvatar isLoggedIn={isLoggedIn} user={user} />
      </button>
    )
  }

  return (
    <div className="dynamic-island-nav">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onHomeClick}
          className="dynamic-island-logo-button"
          aria-label="Navigate home"
        >
          <img src="/boluo.svg" alt="" aria-hidden="true" className="h-9 w-auto object-contain md:h-10" />
        </button>
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
          <button type="button" data-testid="open-upload-dialog" onClick={onUploadClick} className={actionClass}>
            <Upload className="size-4" />
            <span>上传</span>
          </button>
        ) : null}
        {canRunStressDemo ? (
          <button type="button" data-testid="open-stress-demo" onClick={onRunStressDemo} className={actionClass}>
            <Gauge className="size-4" />
            <span>一键压测</span>
          </button>
        ) : null}
        {isLoggedIn ? (
          <>
            <button type="button" onClick={onMyProfileClick} className={actionClass}>
              {user?.userAvatar ? (
                <img src={user.userAvatar} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <User className="size-4" />
              )}
              <span className="max-w-[8ch] truncate">{user?.userName}</span>
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
