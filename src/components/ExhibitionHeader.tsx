import { LogOut, User } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

export type ExhibitionHeaderVariant = "transparent" | "solid"

interface ExhibitionHeaderProps {
  currentPage: "home" | "gallery" | "adminReview" | "me" | "user"
  onHomeClick: () => void
  onGalleryClick: () => void
  onAdminReviewClick: () => void
  onLoginClick: () => void
  onMyProfileClick: () => void
  onUploadClick: () => void
  variant: ExhibitionHeaderVariant
}

export function ExhibitionHeader({
  currentPage,
  onHomeClick,
  onGalleryClick,
  onAdminReviewClick,
  onLoginClick,
  onMyProfileClick,
  onUploadClick,
  variant,
}: ExhibitionHeaderProps) {
  const { user, isLoggedIn, logout } = useAuth()
  const isHome = currentPage === "home"
  const isAdmin = user?.userRole === "admin"
  const showUploadAction = isLoggedIn && currentPage === "gallery"
  const isTransparent = variant === "transparent"

  const navItemClass = (isActive: boolean) =>
    cn(
      "relative px-2.5 py-1.5 text-[13px] font-medium tracking-[0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      isTransparent
        ? isActive
          ? "text-white"
          : "text-white/62 hover:text-white/84"
        : isActive
          ? "text-foreground"
          : "text-foreground/52 hover:text-foreground/76",
      isActive &&
        "after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-px after:rounded-full after:bg-current",
    )

  const actionClass = cn(
    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isTransparent ? "text-white border-white/18 hover:bg-white/10" : "text-foreground border-foreground/14 hover:bg-foreground/[0.05]",
  )

  return (
    <header
      data-testid="exhibition-header"
      data-variant={variant}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,box-shadow] duration-200",
        isTransparent
          ? "bg-transparent"
          : "border-b border-black/8 bg-white/92 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl",
      )}
    >
      <div className="w-full px-[5vw] py-3 md:py-3.5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={onHomeClick}
            className="group inline-flex shrink-0 items-center text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-auto bg-transparent object-contain transition-transform group-hover:scale-[1.03] md:h-10"
            />
          </button>

          <nav
            className="no-scrollbar ml-5 flex min-w-0 items-center justify-start gap-2 overflow-x-auto sm:ml-7 sm:gap-3"
            aria-label="Primary"
          >
            <button
              type="button"
              onClick={onHomeClick}
              aria-current={isHome ? "page" : undefined}
              className={navItemClass(isHome)}
            >
              WenJelly
            </button>
            <button
              type="button"
              onClick={onGalleryClick}
              aria-current={currentPage === "gallery" ? "page" : undefined}
              className={navItemClass(currentPage === "gallery")}
            >
              图库
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={onAdminReviewClick}
                aria-current={currentPage === "adminReview" ? "page" : undefined}
                className={navItemClass(currentPage === "adminReview")}
              >
                审核管理
              </button>
            ) : null}
          </nav>

          <div className="flex shrink-0 items-center justify-end gap-2">
            {isLoggedIn ? (
              <>
                {showUploadAction ? (
                  <button
                    type="button"
                    data-testid="open-upload-dialog"
                    onClick={onUploadClick}
                    className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", actionClass)}
                  >
                    上传
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onMyProfileClick}
                  aria-current={currentPage === "me" ? "page" : undefined}
                  className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-sm", actionClass)}
                >
                  {user?.userAvatar ? (
                    <img src={user.userAvatar} alt="" className="size-6 rounded-full object-cover" />
                  ) : (
                    <User className="size-4" />
                  )}
                  <span className="max-w-[8ch] truncate font-medium">{user?.userName}</span>
                </button>
                <button type="button" onClick={logout} className={cn("rounded-full p-2", actionClass)} aria-label="退出登录">
                  <LogOut className="size-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", actionClass)}
              >
                登录
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
