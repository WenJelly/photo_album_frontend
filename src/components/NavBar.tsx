import { useEffect, useRef, useState, type MouseEvent } from "react"

import type { AuthUser } from "@/contexts/auth-context"

export type NavRoute =
  | { page: "home" }
  | { page: "gallery" }
  | { page: "adminReview" }
  | { page: "me" }
  | { page: "user"; userId: string }

interface NavBarProps {
  currentPage: NavRoute["page"]
  isHomeHeroVisible: boolean
  isAdmin: boolean
  isLoggedIn: boolean
  user: AuthUser | null
  onNavigate: (route: NavRoute, event: MouseEvent) => void
  onLoginClick: () => void
  onUploadClick: () => void
}

interface NavLinkConfig {
  route: NavRoute
  label: string
  visible: boolean
}

function getHref(route: NavRoute): string {
  switch (route.page) {
    case "home": return "/"
    case "gallery": return "/gallery"
    case "adminReview": return "/admin/review"
    case "me": return "/me"
    default: return "/"
  }
}

function getInitial(user: AuthUser | null): string {
  if (!user) {
    return "?"
  }

  const trimmed = user.userName.trim()

  if (!trimmed) {
    return user.userEmail?.charAt(0).toUpperCase() || "?"
  }

  return trimmed.charAt(0).toUpperCase()
}

export function NavBar({
  currentPage,
  isHomeHeroVisible,
  isAdmin,
  isLoggedIn,
  user,
  onNavigate,
  onLoginClick,
  onUploadClick,
}: NavBarProps) {
  const isHome = currentPage === "home"
  const opaque = !isHome

  const [compact, setCompact] = useState(false)
  const compactRef = useRef(false)

  useEffect(() => {
    if (isHome) {
      if (compactRef.current) {
        compactRef.current = false
        setCompact(false)
      }
      return
    }

    const onScroll = () => {
      const next = window.scrollY > 80
      if (next !== compactRef.current) {
        compactRef.current = next
        setCompact(next)
      }
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isHome])

  const links: NavLinkConfig[] = [
    { route: { page: "home" }, label: "首页", visible: true },
    { route: { page: "gallery" }, label: "画廊", visible: true },
    { route: { page: "adminReview" }, label: "审核", visible: isAdmin },
  ]

  const handleLinkClick = (route: NavRoute) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    onNavigate(route, event)
  }

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    onNavigate({ page: "home" }, event)
  }

  const handleAvatarClick = (event: MouseEvent<HTMLButtonElement>) => {
    onNavigate({ page: "me" }, event)
  }

  const handleMobileLinkClick = (route: NavRoute) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    onNavigate(route, event)
  }

  const isLinkActive = (route: NavRoute): boolean => {
    return route.page === currentPage
  }

  return (
    <>
      <nav className="nav-bar" data-opaque={opaque ? "true" : "false"} data-compact={compact ? "true" : "false"} aria-label="Main navigation">
        <div className="nav-bar__left">
          <a className="nav-bar__brand" href="/" onClick={handleBrandClick} aria-label="首页">
            WEN.
          </a>

          <div className="nav-bar__links">
            {links
              .filter((link) => link.visible)
              .map((link) => (
                <a
                  key={link.route.page}
                  className="nav-bar__link"
                  href={getHref(link.route)}
                  aria-current={isLinkActive(link.route) ? "page" : undefined}
                  onClick={handleLinkClick(link.route)}
                >
                  {link.label}
                </a>
              ))}
          </div>
        </div>

        <div className="nav-bar__actions">
          {isLoggedIn ? (
            <>
              {currentPage === "gallery" && (
                <button type="button" className="nav-bar__upload" onClick={onUploadClick} aria-label="上传作品">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="nav-bar__avatar"
                onClick={handleAvatarClick}
                aria-label="个人主页"
              >
                {user?.userAvatar ? (
                  <img src={user.userAvatar} alt="" />
                ) : (
                  <span aria-hidden="true">{getInitial(user)}</span>
                )}
              </button>
            </>
          ) : (
            <button type="button" className="nav-bar__action" onClick={onLoginClick}>
              登录
            </button>
          )}
        </div>
      </nav>

      <nav className="nav-bar-mobile" aria-label="Mobile navigation">
        {links
          .filter((link) => link.visible)
          .map((link) => (
            <a
              key={link.route.page}
              className="nav-bar-mobile__link"
              href={getHref(link.route)}
              aria-current={isLinkActive(link.route) ? "page" : undefined}
              onClick={handleMobileLinkClick(link.route)}
            >
              {link.label}
            </a>
          ))}
        {isLoggedIn ? (
          <a
            className="nav-bar-mobile__link"
            href="/me"
            aria-current={currentPage === "me" ? "page" : undefined}
            onClick={handleMobileLinkClick({ page: "me" })}
          >
            我的
          </a>
        ) : (
          <button type="button" className="nav-bar-mobile__link" onClick={onLoginClick}>
            登录
          </button>
        )}
      </nav>
    </>
  )
}
