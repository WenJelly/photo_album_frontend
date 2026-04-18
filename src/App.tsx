import { useEffect, useLayoutEffect, useMemo, useState } from "react"

import { CategoryFilter } from "@/components/CategoryFilter"
import { AuthDialog } from "@/components/AuthDialog"
import { ExhibitionHeader } from "@/components/ExhibitionHeader"
import { HeroIntro } from "@/components/HeroIntro"
import { PhotoGrid } from "@/components/PhotoGrid"
import { PhotoPreviewOverlay } from "@/components/PhotoPreviewOverlay"
import { photos, type Category } from "@/data/photos"
import type { Photo } from "@/types/photo"
import { cn } from "@/lib/utils"

type Page = "home" | "gallery"

const GALLERY_PATH = "/gallery"

function getPageFromPathname(pathname: string): Page {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/"

  return normalizedPathname === GALLERY_PATH ? "gallery" : "home"
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => getPageFromPathname(window.location.pathname))
  const [activeCategory, setActiveCategory] = useState<Category>("all")
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)

  const filteredPhotos = useMemo(
    () => (activeCategory === "all" ? photos : photos.filter((photo) => photo.category === activeCategory)),
    [activeCategory]
  )
  const selectedPhoto = useMemo(
    () => filteredPhotos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [filteredPhotos, selectedPhotoId]
  )

  const isHome = currentPage === "home"

  useEffect(() => {
    const handlePopState = () => {
      setIsAuthDialogOpen(false)
      setSelectedPhotoId(null)
      const nextPage = getPageFromPathname(window.location.pathname)

      if (nextPage === "home") {
        window.scrollTo({ top: 0, behavior: "auto" })
      }

      setCurrentPage(nextPage)
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useLayoutEffect(() => {
    document.documentElement.style.scrollbarGutter = isHome ? "" : "stable both-edges"

    return () => {
      document.documentElement.style.scrollbarGutter = ""
    }
  }, [isHome])

  const navigateTo = (page: Page) => {
    const nextPath = page === "gallery" ? GALLERY_PATH : "/"

    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath)
    }

    setIsAuthDialogOpen(false)
    setSelectedPhotoId(null)
    if (page === "home") {
      window.scrollTo({ top: 0, behavior: "auto" })
    }
    setCurrentPage(page)
  }

  const openHome = () => navigateTo("home")
  const openGallery = () => navigateTo("gallery")
  const clearFilter = () => setActiveCategory("all")
  const handlePhotoClick = (photo: Photo) => setSelectedPhotoId(photo.id)

  return (
    <div
      data-testid="app-shell"
      className={cn(
        "flex flex-col bg-background text-foreground",
        isHome ? "relative h-screen overflow-hidden" : "min-h-screen"
      )}
    >
      <ExhibitionHeader
        currentPage={currentPage}
        onHomeClick={openHome}
        onGalleryClick={openGallery}
        onLoginClick={() => setIsAuthDialogOpen(true)}
      />
      <main className={cn("flex-1", isHome && "min-h-0")}>
        {isHome ? (
          <HeroIntro />
        ) : (
          <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
            <div className="mb-4">
              <CategoryFilter active={activeCategory} onChange={setActiveCategory} />
            </div>
            <PhotoGrid photos={filteredPhotos} onPhotoClick={handlePhotoClick} onClearFilter={clearFilter} />
          </section>
        )}
      </main>
      {isAuthDialogOpen ? (
        <AuthDialog open={isAuthDialogOpen} onClose={() => setIsAuthDialogOpen(false)} />
      ) : null}
      {currentPage === "gallery" && selectedPhoto ? (
        <PhotoPreviewOverlay
          photo={selectedPhoto}
          photos={filteredPhotos}
          onClose={() => setSelectedPhotoId(null)}
          onSelect={(photo) => setSelectedPhotoId(photo.id)}
        />
      ) : null}
    </div>
  )
}

export default App
