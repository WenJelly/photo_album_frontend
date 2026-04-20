import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { AdminReviewPage } from "@/components/AdminReviewPage"
import { AuthDialog } from "@/components/AuthDialog"
import { CategoryFilter, type CategoryOption } from "@/components/CategoryFilter"
import { ExhibitionHeader } from "@/components/ExhibitionHeader"
import { HeroIntro } from "@/components/HeroIntro"
import { PhotoGrid } from "@/components/PhotoGrid"
import { PhotoPreviewOverlay } from "@/components/PhotoPreviewOverlay"
import { UploadDialog } from "@/components/UploadDialog"
import { UserProfilePage } from "@/components/UserProfilePage"
import { AuthProvider } from "@/contexts/AuthContext"
import { useAuth } from "@/contexts/auth-context"
import { normalizeEntityId } from "@/lib/entity-id"
import { preloadImage } from "@/lib/image-preload"
import { DELETE_PICTURE_CONFIRM_MESSAGE } from "@/lib/picture-delete"
import { canDeletePhoto } from "@/lib/photo-permissions"
import { deletePicture, getPictureDetail, listPictures } from "@/lib/picture-api"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

type Route =
  | { page: "home" }
  | { page: "gallery" }
  | { page: "adminReview" }
  | { page: "me" }
  | { page: "user"; userId: string }
type GalleryLoadState = "idle" | "loading" | "ready" | "error"

const GALLERY_PATH = "/gallery"
const ADMIN_REVIEW_PATH = "/admin/review"
const MY_PROFILE_PATH = "/me"
const USER_PROFILE_PATH_PREFIX = "/users"
const DEFAULT_GALLERY_ERROR = "图库暂时无法加载，请稍后重试。"

function getRouteFromPathname(pathname: string): Route {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/"

  if (normalizedPathname === GALLERY_PATH) {
    return { page: "gallery" }
  }

  if (normalizedPathname === ADMIN_REVIEW_PATH) {
    return { page: "adminReview" }
  }

  if (normalizedPathname === MY_PROFILE_PATH) {
    return { page: "me" }
  }

  const userRouteMatch = normalizedPathname.match(/^\/users\/([^/]+)$/)

  if (userRouteMatch) {
    try {
      return {
        page: "user",
        userId: normalizeEntityId(decodeURIComponent(userRouteMatch[1]), "用户 ID 非法"),
      }
    } catch {
      return { page: "home" }
    }
  }

  return { page: "home" }
}

function getPathFromRoute(route: Route) {
  switch (route.page) {
    case "gallery":
      return GALLERY_PATH
    case "adminReview":
      return ADMIN_REVIEW_PATH
    case "me":
      return MY_PROFILE_PATH
    case "user":
      return `${USER_PROFILE_PATH_PREFIX}/${encodeURIComponent(route.userId)}`
    case "home":
    default:
      return "/"
  }
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage
}

function AppShell() {
  const initialRoute = getRouteFromPathname(window.location.pathname)
  const pendingFocusPhotoIdRef = useRef<string | null>(null)
  const photoDetailCacheRef = useRef(new Map<string, Photo>())
  const { user, isLoggedIn } = useAuth()

  const [route, setRoute] = useState<Route>(initialRoute)
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([])
  const [galleryLoadState, setGalleryLoadState] = useState<GalleryLoadState>(
    initialRoute.page === "gallery" ? "loading" : "idle",
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
  const [isDeletingPreviewPhoto, setIsDeletingPreviewPhoto] = useState(false)

  const currentPage = route.page
  const routeUserId = route.page === "user" ? route.userId : null
  const isHome = currentPage === "home"
  const isAdmin = user?.userRole === "admin"
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
  const canDeletePreviewPhoto = canDeletePhoto(user, previewPhoto)
  const shouldShowGrid = galleryPhotos.length > 0 || galleryLoadState === "ready"

  const clearSelectedPhoto = useCallback(() => {
    setSelectedPhotoId(null)
    setSelectedPhotoDetail(null)
    setSelectedPhotoError(null)
    setIsPreviewLoading(false)
    setIsDeletingPreviewPhoto(false)
  }, [])

  const requestGalleryLoad = useCallback((focusPhotoId?: string) => {
    pendingFocusPhotoIdRef.current = focusPhotoId ?? null
    setGalleryError(null)
    setGalleryLoadState("loading")
  }, [])

  const openPhoto = useCallback((photo: Photo) => {
    const cachedPhotoDetail = photoDetailCacheRef.current.get(photo.id)

    setSelectedPhotoDetail(cachedPhotoDetail ?? photo)
    setSelectedPhotoError(null)
    setIsPreviewLoading(!cachedPhotoDetail)
    setSelectedPhotoId(photo.id)
    preloadImage(cachedPhotoDetail?.src ?? photo.src)
  }, [])

  const navigateToRoute = useCallback(
    (nextRoute: Route, options?: { replace?: boolean }) => {
      const nextPath = getPathFromRoute(nextRoute)

      if (window.location.pathname !== nextPath) {
        if (options?.replace) {
          window.history.replaceState({}, "", nextPath)
        } else {
          window.history.pushState({}, "", nextPath)
        }
      }

      setIsAuthDialogOpen(false)
      setIsUploadDialogOpen(false)
      clearSelectedPhoto()

      if (nextRoute.page === "home") {
        window.scrollTo({ top: 0, behavior: "auto" })
      } else if (nextRoute.page === "gallery" && !galleryPhotos.length) {
        requestGalleryLoad()
      }

      setRoute(nextRoute)
    },
    [clearSelectedPhoto, galleryPhotos.length, requestGalleryLoad],
  )

  const navigateToUserPage = useCallback(
    (userId: string) => {
      if (user && userId === user.id) {
        navigateToRoute({ page: "me" })
        return
      }

      navigateToRoute({ page: "user", userId })
    },
    [navigateToRoute, user],
  )

  const handlePhotographerNavigation = useCallback(
    (photo: Photo) => {
      if (photo.userId) {
        navigateToUserPage(photo.userId)
      }
    },
    [navigateToUserPage],
  )

  useEffect(() => {
    if (route.page !== "adminReview") {
      return
    }

    if (isAdmin) {
      return
    }

    startTransition(() => {
      if (!galleryPhotos.length) {
        pendingFocusPhotoIdRef.current = null
        setGalleryError(null)
        setGalleryLoadState("loading")
      }

      navigateToRoute({ page: "gallery" }, { replace: true })
      setGalleryNotice(isLoggedIn ? "仅管理员可访问审核管理。" : "请先登录管理员账号。")
      setIsAuthDialogOpen(!isLoggedIn)
    })
  }, [galleryPhotos.length, isAdmin, isLoggedIn, navigateToRoute, requestGalleryLoad, route.page])

  useEffect(() => {
    if (route.page !== "me" || isLoggedIn) {
      return
    }

    startTransition(() => {
      navigateToRoute({ page: "gallery" }, { replace: true })
      setGalleryNotice("请先登录后查看个人主页。")
      setIsAuthDialogOpen(true)
    })
  }, [isLoggedIn, navigateToRoute, route.page])

  useEffect(() => {
    if (route.page !== "user" || !user || route.userId !== user.id) {
      return
    }

    startTransition(() => {
      navigateToRoute({ page: "me" }, { replace: true })
    })
  }, [navigateToRoute, route, user])

  useEffect(() => {
    const handlePopState = () => {
      setIsAuthDialogOpen(false)
      setIsUploadDialogOpen(false)
      clearSelectedPhoto()

      const nextRoute = getRouteFromPathname(window.location.pathname)

      if (nextRoute.page === "home") {
        window.scrollTo({ top: 0, behavior: "auto" })
      } else if (nextRoute.page === "gallery" && !galleryPhotos.length) {
        requestGalleryLoad()
      }

      setRoute(nextRoute)
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [clearSelectedPhoto, galleryPhotos.length, requestGalleryLoad])

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
  }, [currentPage, galleryLoadState, openPhoto])

  useEffect(() => {
    if (currentPage !== "gallery" || !selectedPhotoId) {
      return
    }

    const cachedPhotoDetail = photoDetailCacheRef.current.get(selectedPhotoId)

    if (cachedPhotoDetail) {
      setSelectedPhotoDetail(cachedPhotoDetail)
      setIsPreviewLoading(false)
      return
    }

    let isCancelled = false

    const run = async () => {
      try {
        const nextPhoto = await getPictureDetail(selectedPhotoId)

        if (isCancelled) {
          return
        }

        photoDetailCacheRef.current.set(nextPhoto.id, nextPhoto)
        setSelectedPhotoDetail(nextPhoto)
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

  const handleUploadSuccess = useCallback((photo: Photo) => {
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
  }, [clearSelectedPhoto, requestGalleryLoad])

  const handleDeletePreviewPhoto = useCallback(async () => {
    if (!previewPhoto) {
      return
    }

    if (!window.confirm(DELETE_PICTURE_CONFIRM_MESSAGE)) {
      return
    }

    setIsDeletingPreviewPhoto(true)
    setSelectedPhotoError(null)

    try {
      const deletedPicture = await deletePicture(previewPhoto.id)
      photoDetailCacheRef.current.delete(deletedPicture.id)
      setGalleryPhotos((current) => current.filter((photo) => photo.id !== String(deletedPicture.id)))
      setGalleryNotice(`已删除图片 ${previewPhoto.alt}。`)
      clearSelectedPhoto()
    } catch (error) {
      setSelectedPhotoError(error instanceof Error ? error.message : "删除图片失败。")
      setIsDeletingPreviewPhoto(false)
    }
  }, [clearSelectedPhoto, previewPhoto])

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
        onHomeClick={() => navigateToRoute({ page: "home" })}
        onGalleryClick={() => navigateToRoute({ page: "gallery" })}
        onAdminReviewClick={() => navigateToRoute({ page: "adminReview" })}
        onLoginClick={() => setIsAuthDialogOpen(true)}
        onMyProfileClick={() => navigateToRoute({ page: "me" })}
        onUploadClick={() => setIsUploadDialogOpen(true)}
      />
      <main className={cn("flex-1", isHome && "min-h-0")}>
        {isHome ? (
          <HeroIntro />
        ) : currentPage === "adminReview" ? (
          <AdminReviewPage currentUserRole={user?.userRole} />
        ) : currentPage === "me" ? (
          <UserProfilePage key="me" mode="me" onNavigateToUser={navigateToUserPage} />
        ) : currentPage === "user" && routeUserId ? (
          <UserProfilePage
            key={`user:${routeUserId}`}
            mode="public"
            userId={routeUserId}
            onNavigateToUser={navigateToUserPage}
          />
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
                onPhotographerClick={handlePhotographerNavigation}
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
          canDelete={canDeletePreviewPhoto}
          isDeleting={isDeletingPreviewPhoto}
          isLoading={isPreviewLoading}
          errorMessage={selectedPhotoError}
          onClose={clearSelectedPhoto}
          onDelete={() => void handleDeletePreviewPhoto()}
          onPhotographerClick={handlePhotographerNavigation}
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
