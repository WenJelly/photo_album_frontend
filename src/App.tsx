import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AdminReviewPage } from "@/components/AdminReviewPage"
import { AuthDialog } from "@/components/AuthDialog"
import { HeroIntro } from "@/components/HeroIntro"
import { NavBar } from "@/components/NavBar"
import type { NavRoute } from "@/components/NavBar"
import { PhotoGrid } from "@/components/PhotoGrid"
import { PhotoPreviewOverlay } from "@/components/PhotoPreviewOverlay"
import { UploadDialog } from "@/components/UploadDialog"
import { UserProfilePage } from "@/components/UserProfilePage"
import { AuthProvider } from "@/contexts/AuthContext"
import { useAuth } from "@/contexts/auth-context"
import { TransitionProvider, usePageTransition } from "@/contexts/TransitionProvider"
import { normalizeEntityId } from "@/lib/entity-id"
import { preloadImage } from "@/lib/image-preload"
import { DELETE_PICTURE_CONFIRM_MESSAGE } from "@/lib/picture-delete"
import { canDeletePhoto } from "@/lib/photo-permissions"
import { deletePicture, getPictureDetail, listPicturesCursor } from "@/lib/picture-api"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"
import type { PhotoPreviewOriginRect } from "@/types/photo-preview"

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
const DEFAULT_GALLERY_ERROR = "Gallery is temporarily unavailable. Please try again later."
const HOME_HEADER_OBSERVER_OFFSET_PX = 56
const GALLERY_CURSOR_PAGE_SIZE = 30

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
        userId: normalizeEntityId(decodeURIComponent(userRouteMatch[1]), "Invalid user id"),
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
  const homeHeroRef = useRef<HTMLElement | null>(null)
  const galleryMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const { user, isLoggedIn } = useAuth()

  const [route, setRoute] = useState<Route>(initialRoute)
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([])
  const [galleryLoadState, setGalleryLoadState] = useState<GalleryLoadState>(
    initialRoute.page === "gallery" ? "loading" : "idle",
  )
  const [galleryNextCursor, setGalleryNextCursor] = useState("")
  const [galleryHasMore, setGalleryHasMore] = useState(false)
  const [isGalleryLoadingMore, setIsGalleryLoadingMore] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null)
  const [isHomeHeroVisible, setIsHomeHeroVisible] = useState(initialRoute.page === "home")
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [selectedPhotoDetail, setSelectedPhotoDetail] = useState<Photo | null>(null)
  const [selectedPhotoError, setSelectedPhotoError] = useState<string | null>(null)
  const [selectedPhotoOriginRect, setSelectedPhotoOriginRect] = useState<PhotoPreviewOriginRect | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isDeletingPreviewPhoto, setIsDeletingPreviewPhoto] = useState(false)

  const currentPage = route.page
  const routeUserId = route.page === "user" ? route.userId : null
  const isHome = currentPage === "home"
  const isAdmin = user?.userRole === "admin"
  const selectedPhoto = useMemo(
    () => galleryPhotos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [galleryPhotos, selectedPhotoId],
  )
  const previewPhoto = selectedPhotoDetail ?? selectedPhoto
  const previewPhotos = selectedPhoto ? galleryPhotos : previewPhoto ? [previewPhoto] : galleryPhotos
  const canDeletePreviewPhoto = canDeletePhoto(user, previewPhoto)
  const shouldShowGrid = galleryPhotos.length > 0 || galleryLoadState === "ready"

  const clearSelectedPhoto = useCallback(() => {
    setSelectedPhotoId(null)
    setSelectedPhotoDetail(null)
    setSelectedPhotoError(null)
    setSelectedPhotoOriginRect(null)
    setIsPreviewLoading(false)
    setIsDeletingPreviewPhoto(false)
  }, [])

  const requestGalleryLoad = useCallback((focusPhotoId?: string) => {
    pendingFocusPhotoIdRef.current = focusPhotoId ?? null
    setGalleryError(null)
    setGalleryNextCursor("")
    setGalleryHasMore(false)
    setIsGalleryLoadingMore(false)
    setGalleryLoadState("loading")
  }, [])

  const openPhoto = useCallback((photo: Photo, originRect?: PhotoPreviewOriginRect) => {
    const cachedPhotoDetail = photoDetailCacheRef.current.get(photo.id)

    setSelectedPhotoDetail(cachedPhotoDetail ?? photo)
    setSelectedPhotoError(null)
    setSelectedPhotoOriginRect(originRect ?? null)
    setIsPreviewLoading(!cachedPhotoDetail)
    setSelectedPhotoId(photo.id)
    preloadImage(cachedPhotoDetail?.src ?? photo.src)
  }, [])

  const prepareRouteEntry = useCallback(
    (nextRoute: Route) => {
      const currentPath = getPathFromRoute(route)
      const nextPath = getPathFromRoute(nextRoute)
      const isRouteChange = currentPath !== nextPath

      setIsAuthDialogOpen(false)
      setIsUploadDialogOpen(false)
      clearSelectedPhoto()
      setIsHomeHeroVisible(nextRoute.page === "home")

      if (isRouteChange) {
        window.scrollTo({ top: 0, behavior: "auto" })
      }

      if (nextRoute.page === "gallery" && !galleryPhotos.length) {
        requestGalleryLoad()
      }
    },
    [clearSelectedPhoto, galleryPhotos.length, requestGalleryLoad, route],
  )

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

      prepareRouteEntry(nextRoute)
      setRoute(nextRoute)
    },
    [prepareRouteEntry],
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

  const { startTransition: startPageTransition, reveal: revealPage, phase: transitionPhase } = usePageTransition()

  const handleNavigateWithTransition = useCallback(
    async (nextRoute: NavRoute, event: React.MouseEvent) => {
      const currentPath = getPathFromRoute(route)
      const nextPath = getPathFromRoute(nextRoute)

      if (currentPath === nextPath) {
        return
      }

      await startPageTransition()
      navigateToRoute(nextRoute)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          revealPage()
        })
      })
    },
    [navigateToRoute, revealPage, route, startPageTransition],
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
      setGalleryNotice(isLoggedIn ? "Admins only can access review management." : "Please sign in with an admin account first.")
      setIsAuthDialogOpen(!isLoggedIn)
    })
  }, [galleryPhotos.length, isAdmin, isLoggedIn, navigateToRoute, requestGalleryLoad, route.page])

  useEffect(() => {
    if (route.page !== "me" || isLoggedIn) {
      return
    }

    startTransition(() => {
      navigateToRoute({ page: "gallery" }, { replace: true })
      setGalleryNotice("Please sign in before viewing your profile page.")
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
      const nextRoute = getRouteFromPathname(window.location.pathname)

      prepareRouteEntry(nextRoute)
      setRoute(nextRoute)
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [prepareRouteEntry])

  useEffect(() => {
    if (currentPage !== "gallery" || galleryLoadState !== "loading") {
      return
    }

    let isCancelled = false

    const run = async () => {
      try {
        const result = await listPicturesCursor({ pageSize: GALLERY_CURSOR_PAGE_SIZE })

        if (isCancelled) {
          return
        }

        setGalleryPhotos(result.list)
        setGalleryNextCursor(result.nextCursor)
        setGalleryHasMore(result.hasMore)
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
    if (
      currentPage !== "gallery" ||
      galleryLoadState !== "ready" ||
      !galleryHasMore ||
      !galleryNextCursor ||
      isGalleryLoadingMore
    ) {
      return
    }

    const sentinel = galleryMoreSentinelRef.current
    if (!sentinel) {
      return
    }

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setIsGalleryLoadingMore(true))

      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsGalleryLoadingMore(true)
        }
      },
      { rootMargin: "1200px 0px" },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [currentPage, galleryHasMore, galleryLoadState, galleryNextCursor, isGalleryLoadingMore])

  useEffect(() => {
    if (currentPage !== "gallery" || !isGalleryLoadingMore || !galleryNextCursor) {
      return
    }

    let isCancelled = false

    const run = async () => {
      try {
        const result = await listPicturesCursor({
          cursor: galleryNextCursor,
          pageSize: GALLERY_CURSOR_PAGE_SIZE,
        })

        if (isCancelled) {
          return
        }

        setGalleryPhotos((currentPhotos) => {
          const seenIds = new Set(currentPhotos.map((photo) => photo.id))
          const nextPhotos = result.list.filter((photo) => !seenIds.has(photo.id))

          return [...currentPhotos, ...nextPhotos]
        })
        setGalleryNextCursor(result.nextCursor)
        setGalleryHasMore(result.hasMore)
        setGalleryError(null)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setGalleryError(getErrorMessage(error, DEFAULT_GALLERY_ERROR))
      } finally {
        if (!isCancelled) {
          setIsGalleryLoadingMore(false)
        }
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [currentPage, galleryNextCursor, isGalleryLoadingMore])

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

        setSelectedPhotoError(getErrorMessage(error, "Photo details could not be refreshed right now."))
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

  useEffect(() => {
    if (!isHome) {
      return
    }

    const heroElement = homeHeroRef.current

    if (!heroElement || typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHomeHeroVisible(entry?.isIntersecting ?? true)
      },
      {
        root: null,
        rootMargin: `-${HOME_HEADER_OBSERVER_OFFSET_PX}px 0px 0px 0px`,
        threshold: 0,
      },
    )

    observer.observe(heroElement)

    return () => observer.disconnect()
  }, [isHome])

  const handleUploadSuccess = useCallback((photo: Photo) => {
    setGalleryNotice(
      photo.reviewStatus === 1
        ? "Upload complete. The work is now live in the gallery."
        : "Upload complete. The work has been submitted for review and will appear after approval.",
    )
    clearSelectedPhoto()

    if (photo.reviewStatus === 1) {
      requestGalleryLoad()
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
      setGalleryNotice(`Deleted photo ${previewPhoto.alt}.`)
      clearSelectedPhoto()
    } catch (error) {
      setSelectedPhotoError(error instanceof Error ? error.message : "Deleting the photo failed.")
      setIsDeletingPreviewPhoto(false)
    }
  }, [clearSelectedPhoto, previewPhoto])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavBar
        currentPage={currentPage}
        isHomeHeroVisible={isHomeHeroVisible}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
        user={user}
        onNavigate={handleNavigateWithTransition}
        onLoginClick={() => setIsAuthDialogOpen(true)}
        onUploadClick={() => setIsUploadDialogOpen(true)}
      />
      <main className={cn("flex-1 page-transition", !isHome && "pt-24 md:pt-28")} data-phase={transitionPhase}>
        {isHome ? (
          <HeroIntro heroRef={homeHeroRef} />
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
          <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-4 md:px-6 md:pb-16 md:pt-6">
            {galleryNotice ? (
              <div className="mb-4 rounded-[1.5rem] border border-emerald-500/16 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88">
                {galleryNotice}
              </div>
            ) : null}
            {galleryLoadState === "error" ? (
              <div className="mb-4 flex flex-col gap-3 rounded-[1.5rem] border border-destructive/16 bg-destructive/6 px-4 py-4 text-sm text-destructive md:flex-row md:items-center md:justify-between">
                <p>{galleryError ?? DEFAULT_GALLERY_ERROR}</p>
                <button
                  type="button"
                  onClick={() => requestGalleryLoad()}
                  className="rounded-full border border-destructive/20 bg-white px-4 py-2 text-sm transition hover:bg-destructive/4"
                >
                  重试
                </button>
              </div>
            ) : null}
            {galleryLoadState === "loading" && !galleryPhotos.length ? (
              <div className="rounded-[1.5rem] border border-border/70 bg-card/70 px-6 py-16 text-center text-sm text-muted-foreground">
                濠殿喗绻愮徊钘夛耿椤忓牆绀夐柣妯煎劋缁佷即鏌涢妷锕€鍔ょ紒?..
              </div>
            ) : null}
            {shouldShowGrid ? (
              <>
                <PhotoGrid
                  photos={galleryPhotos}
                  onPhotoClick={openPhoto}
                  onPhotographerClick={handlePhotographerNavigation}
                />
                {galleryHasMore || isGalleryLoadingMore ? (
                  <div
                    ref={galleryMoreSentinelRef}
                    className="py-8 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {isGalleryLoadingMore ? "Loading more works" : "More works"}
                  </div>
                ) : null}
              </>
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
      {currentPage === "gallery" && previewPhoto ? (
        <PhotoPreviewOverlay
          photo={previewPhoto}
          photos={previewPhotos}
          originRect={selectedPhotoOriginRect}
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
      <TransitionProvider>
        <AppShell />
      </TransitionProvider>
    </AuthProvider>
  )
}

export default App
