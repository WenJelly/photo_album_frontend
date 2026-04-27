import { Menu } from "@base-ui/react/menu"
import { ChevronRight, Gauge, LogOut, Upload, User } from "lucide-react"

import type { AuthUser } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

interface IslandNavigationContentProps {
  canRunStressDemo: boolean
  compact: boolean
  currentPage: "home" | "gallery" | "adminReview" | "me" | "user"
  isLoggedIn: boolean
  menuTone: "transparent" | "solid"
  onAdminReviewClick: () => void
  onCompactMouseEnter: () => void
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

function AccountAvatarMenu({
  tone,
  size,
  user,
  onLogoutClick,
  onMyProfileClick,
}: {
  tone: "transparent" | "solid"
  size: string
  user: AuthUser
  onLogoutClick: () => void
  onMyProfileClick: () => void
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        type="button"
        className="dynamic-island-avatar-trigger"
        style={{ width: size, height: size }}
        aria-label="打开账户菜单"
      >
        <span className="avatar-prism-ring">
          <IslandAvatar className="h-full w-full" user={user} />
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={12} align="end" className="dynamic-island-account-menu__positioner">
          <Menu.Popup className={cn("dynamic-island-account-menu", `dynamic-island-account-menu--${tone}`)}>
            <div className="dynamic-island-account-menu__header">
              <div className="dynamic-island-account-menu__eyebrow-row">
                <span className="dynamic-island-account-menu__eyebrow">ACCOUNT</span>
                <span className="dynamic-island-account-menu__eyebrow-glint" aria-hidden="true" />
              </div>
              <div className="dynamic-island-account-menu__identity">
                <span className="dynamic-island-account-menu__prism" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="dynamic-island-account-menu__name dynamic-island-text-container">{user.userName}</p>
                  {user.userEmail ? (
                    <p className="dynamic-island-account-menu__meta dynamic-island-text-container">{user.userEmail}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <Menu.Separator className="dynamic-island-account-menu__separator" />
            <Menu.Item
              className="dynamic-island-account-menu__item dynamic-island-account-menu__item--profile"
              onClick={onMyProfileClick}
            >
              <span className="dynamic-island-account-menu__item-icon" aria-hidden="true">
                <User className="size-4" />
              </span>
              <span className="dynamic-island-account-menu__item-label">个人信息</span>
              <ChevronRight className="dynamic-island-account-menu__item-trailing size-4" aria-hidden="true" />
            </Menu.Item>
            <Menu.Item
              className="dynamic-island-account-menu__item dynamic-island-account-menu__item--logout"
              onClick={onLogoutClick}
            >
              <span className="dynamic-island-account-menu__item-icon" aria-hidden="true">
                <LogOut className="size-4" />
              </span>
              <span className="dynamic-island-account-menu__item-label">退出登录</span>
              <ChevronRight className="dynamic-island-account-menu__item-trailing size-4" aria-hidden="true" />
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function IslandNavigationContent({
  canRunStressDemo,
  compact,
  currentPage,
  isLoggedIn,
  menuTone,
  onAdminReviewClick,
  onCompactMouseEnter,
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
      <div className="dynamic-island-compact-bar dynamic-island-content-offset">
        <button
          type="button"
          className="dynamic-island-compact-toggle"
          onClick={onCompactToggle}
          onMouseEnter={onCompactMouseEnter}
        >
          <span className="dynamic-island-brand">
            <span className="dynamic-island-brand__title dynamic-island-text-container">WenJelly</span>
            <span className="dynamic-island-brand__caption dynamic-island-text-container">Standby Capsule</span>
          </span>
        </button>
        {isLoggedIn ? (
          <AccountAvatarMenu
            tone={menuTone}
            size="2.6rem"
            user={user!}
            onMyProfileClick={onMyProfileClick}
            onLogoutClick={onLogoutClick}
          />
        ) : (
          <button type="button" onClick={onLoginClick} className="dynamic-island-compact-login-button">
            登录
          </button>
        )}
      </div>
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
          <AccountAvatarMenu
            tone={menuTone}
            size="2.5rem"
            user={user!}
            onMyProfileClick={onMyProfileClick}
            onLogoutClick={onLogoutClick}
          />
        ) : (
          <button type="button" onClick={onLoginClick} className={actionClass}>
            登录
          </button>
        )}
      </div>
    </div>
  )
}
