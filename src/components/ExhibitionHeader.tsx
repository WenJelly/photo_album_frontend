import { cn } from "@/lib/utils"

interface ExhibitionHeaderProps {
  currentPage: "home" | "gallery"
  onHomeClick: () => void
  onGalleryClick: () => void
  onLoginClick: () => void
}

export function ExhibitionHeader({
  currentPage,
  onHomeClick,
  onGalleryClick,
  onLoginClick,
}: ExhibitionHeaderProps) {
  const isHome = currentPage === "home"
  const navItemClass = (isActive: boolean) =>
    cn(
      "rounded-none px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      isHome
        ? isActive
          ? "text-white"
          : "text-white/78 hover:text-white"
        : isActive
          ? "text-foreground"
          : "text-foreground/68 hover:text-foreground"
    )

  return (
    <header
      className={cn(
        "inset-x-0 top-0 z-40 border-b border-white/22 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-2xl",
        isHome
          ? "absolute bg-white/18"
          : "sticky bg-white/55"
      )}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 md:px-8">
        <div className="space-y-1">
          <p className={cn("eyebrow-label", isHome ? "text-white/72" : undefined)}>在线影像档案</p>
          <h1
            className={cn(
              "font-heading text-[1.55rem] font-semibold leading-none tracking-[-0.03em]",
              isHome ? "text-white" : "text-foreground"
            )}
          >
            WenJelly
          </h1>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <button
            type="button"
            onClick={onHomeClick}
            aria-current={isHome ? "page" : undefined}
            className={navItemClass(isHome)}
          >
            首页
          </button>
          <button
            type="button"
            onClick={onGalleryClick}
            aria-current={currentPage === "gallery" ? "page" : undefined}
            className={navItemClass(currentPage === "gallery")}
          >
            图库
          </button>
          <button
            type="button"
            onClick={onLoginClick}
            className={cn(
              "rounded-md border px-4 py-2 text-sm font-medium shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isHome
                ? "border-white/28 bg-white/14 text-white hover:bg-white/22"
                : "border-white/60 bg-white/72 text-foreground hover:bg-white/88"
            )}
          >
            登录
          </button>
        </nav>
      </div>
    </header>
  )
}
