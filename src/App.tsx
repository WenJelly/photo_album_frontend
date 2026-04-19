import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { AuthDialog } from "@/components/AuthDialog"
import { CategoryFilter, type CategoryOption } from "@/components/CategoryFilter"
import { ExhibitionHeader } from "@/components/ExhibitionHeader"
import { HeroIntro } from "@/components/HeroIntro"
import { PhotoGrid } from "@/components/PhotoGrid"
import { PhotoPreviewOverlay } from "@/components/PhotoPreviewOverlay"
import { UploadDialog } from "@/components/UploadDialog"
import { AuthProvider } from "@/contexts/AuthContext"
import { getPictureDetail, listPictures } from "@/lib/picture-api"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

type Page = "home" | "gallery"
type GalleryLoadState = "idle" | "loading" | "ready" | "error"

const GALLERY_PATH = "/gallery"
const DEFAULT_GALLERY_ERROR = "图库暂时无法加载，请稍后重试。"

function getPageFromPathname(pathname: string): Page {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/"

  return normalizedPathname === GALLERY_PATH ? "gallery" : "home"
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage
}

function AppShell() {
  const initialPage = getPageFromPathname(window.location.pathname)
  const pendingFocusPhotoIdRef = useRef<string | null>(null)

  const [currentPage, setCurrentPage] = useState<Page>(initialPage)
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([])
  const [galleryLoadState, setGalleryLoadState] = useState<GalleryLoadState>(
    initialPage === "gallery" ? "loading" : "idle",
  )
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("all")
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [selectedPhotoDetail, setSelectedPhotoDetail] = useState<Photo | null>(null)
  const [selectedPhotoError, setSelectedPhotoError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  const isHome = currentPage === "home"
  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const items = new Map<string, string>()

    for (const photo of galleryPhotos) {
      if (photo.category) {
        items.set(photo.category, photo.categoryLabel ?? photo.category)
      }
    }

    return [{ value: "all", label: "全部" }, ...Array.from(items, ([value, label]) => ({ value, label }))]
  }, [galleryPhotos])
  const effectiveCategory =
    activeCategory === "all" || categoryOptions.some((item) => item.value === activeCategory)
      ? activeCategory
      : "all"
  const filteredPhotos = useMemo(
    () =>
      effectiveCategory === "all"
        ? galleryPhotos
        : galleryPhotos.filter((photo) => photo.category === effectiveCategory),
    [effectiveCategory, galleryPhotos],
  )
  const selectedPhoto = useMemo(
    () => filteredPhotos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [filteredPhotos, selectedPhotoId],
  )
  const previewPhoto = selectedPhotoDetail ?? selectedPhoto
  const shouldShowGrid = galleryPhotos.length > 0 || galleryLoadState === "ready"

  const clearSelectedPhoto = () => {
    setSelectedPhotoId(null)
    setSelectedPhotoDetail(null)
    setSelectedPhotoError(null)
    setIsPreviewLoading(false)
  }

  const requestGalleryLoad = (focusPhotoId?: string) => {
    pendingFocusPhotoIdRef.current = focusPhotoId ?? null
    setGalleryError(null)
    setGalleryLoadState("loading")
  }

  const openPhoto = (photo: Photo) => {
    setSelectedPhotoDetail(photo)
    setSelectedPhotoError(null)
    setIsPreviewLoading(true)
    setSelectedPhotoId(photo.id)
  }

  useEffect(() => {
    const handlePopState = () => {
      setIsAuthDialogOpen(false)
      setIsUploadDialogOpen(false)
      clearSelectedPhoto()

      const nextPage = getPageFromPathname(window.location.pathname)

      if (nextPage === "home") {
        window.scrollTo({ top: 0, behavior: "auto" })
      } else if (!galleryPhotos.length) {
        requestGalleryLoad()
      }

      setCurrentPage(nextPage)
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [galleryPhotos.length])

  useEffect(() => {
    if (currentPage !== "gallery" || galleryLoadState !== "loading") {
      return
    }

    let isCancelled = false

    const run = async () => {
      try {
        const result = await listPictures({ pageNum: 1, pageSize: 20 })

        if (isCancelled) {
          return
        }

        setGalleryPhotos(result.list)
        setGalleryLoadState("ready")

        const focusPhotoId = pendingFocusPhotoIdRef.current
        pendingFocusPhotoIdRef.current = null

        if (focusPhotoId) {
          const focusPhoto = result.list.find((photo) => photo.id === focusPhotoId)

          if (focusPhoto) {
            openPhoto(focusPhoto)
          }
        }
      } catch (error) {
        if (isCancelled) {
          return
        }

        setGalleryLoadState("error")
        setGalleryError(getErrorMessage(error, DEFAULT_GALLERY_ERROR))
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [currentPage, galleryLoadState])

  useEffect(() => {
    if (currentPage !== "gallery" || !selectedPhotoId) {
      return
    }

    let isCancelled = false

    const run = async () => {
      try {
        const nextPhoto = await getPictureDetail(selectedPhotoId)

        if (isCancelled) {
          return
        }

        setSelectedPhotoDetail(nextPhoto)
        setGalleryPhotos((current) => current.map((photo) => (photo.id === nextPhoto.id ? nextPhoto : photo)))
      } catch (error) {
        if (isCancelled) {
          return
        }

        setSelectedPhotoError(getErrorMessage(error, "图片详情暂时无法更新。"))
      } finally {
        if (!isCancelled) {
          setIsPreviewLoading(false)
        }
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [currentPage, selectedPhotoId])

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
    setIsUploadDialogOpen(false)
    clearSelectedPhoto()

    if (page === "home") {
      window.scrollTo({ top: 0, behavior: "auto" })
    } else if (!galleryPhotos.length) {
      requestGalleryLoad()
    }

    setCurrentPage(page)
  }

  const handleUploadSuccess = (photo: Photo) => {
    setGalleryNotice(
      photo.reviewStatus === 1
        ? "上传成功，作品已加入图库。"
        : "上传成功，作品已提交审核，审核通过后会显示在公共图库中。",
    )
    setActiveCategory("all")
    clearSelectedPhoto()

    if (photo.reviewStatus === 1) {
      requestGalleryLoad(photo.id)
    }
  }

  return (
    <div
      data-testid="app-shell"
      className={cn(
        "flex flex-col bg-background text-foreground",
        isHome ? "relative h-screen overflow-hidden" : "min-h-screen",
      )}
    >
      <ExhibitionHeader
        currentPage={currentPage}
        onHomeClick={() => navigateTo("home")}
        onGalleryClick={() => navigateTo("gallery")}
        onLoginClick={() => setIsAuthDialogOpen(true)}
        onUploadClick={() => setIsUploadDialogOpen(true)}
      />
      <main className={cn("flex-1", isHome && "min-h-0")}>
        {isHome ? (
          <HeroIntro />
        ) : (
          <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
            {galleryNotice ? (
              <div className="mb-4 rounded-[1.5rem] border border-emerald-500/16 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88">
                {galleryNotice}
              </div>
            ) : null}
            <div className="mb-4">
              <CategoryFilter
                active={effectiveCategory}
                categories={categoryOptions}
                onChange={setActiveCategory}
              />
            </div>
            {galleryLoadState === "error" ? (
              <div className="mb-4 flex flex-col gap-3 rounded-[1.5rem] border border-destructive/16 bg-destructive/6 px-4 py-4 text-sm text-destructive md:flex-row md:items-center md:justify-between">
                <p>{galleryError ?? DEFAULT_GALLERY_ERROR}</p>
                <button
                  type="button"
                  onClick={() => requestGalleryLoad()}
                  className="rounded-full border border-destructive/20 bg-white px-4 py-2 text-sm transition hover:bg-destructive/4"
                >
                  重新加载
                </button>
              </div>
            ) : null}
            {galleryLoadState === "loading" && !galleryPhotos.length ? (
              <div className="rounded-[1.5rem] border border-border/70 bg-card/70 px-6 py-16 text-center text-sm text-muted-foreground">
                正在加载图库...
              </div>
            ) : null}
            {shouldShowGrid ? (
              <PhotoGrid
                photos={filteredPhotos}
                onPhotoClick={openPhoto}
                onClearFilter={() => setActiveCategory("all")}
              />
            ) : null}
          </section>
        )}
      </main>
      {isAuthDialogOpen ? <AuthDialog open={isAuthDialogOpen} onClose={() => setIsAuthDialogOpen(false)} /> : null}
      {isUploadDialogOpen ? (
        <UploadDialog
          open={isUploadDialogOpen}
          onClose={() => setIsUploadDialogOpen(false)}
          onUploaded={handleUploadSuccess}
        />
      ) : null}
      {currentPage === "gallery" && selectedPhoto && previewPhoto ? (
        <PhotoPreviewOverlay
          photo={previewPhoto}
          photos={filteredPhotos}
          isLoading={isPreviewLoading}
          errorMessage={selectedPhotoError}
          onClose={clearSelectedPhoto}
          onSelect={openPhoto}
        />
      ) : null}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
