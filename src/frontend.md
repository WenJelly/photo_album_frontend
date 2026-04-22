Project Path: src

Source Tree:

```txt
src
├── App.tsx
├── components
│   ├── AdminReviewPage.tsx
│   ├── AuthDialog.tsx
│   ├── CategoryFilter.tsx
│   ├── ExhibitionHeader.tsx
│   ├── GallerySummary.tsx
│   ├── HeroIntro.tsx
│   ├── HomeCardSphereSection.tsx
│   ├── PhotoGrid.tsx
│   ├── PhotoPreviewOverlay.tsx
│   ├── UploadDialog.tsx
│   ├── UserProfilePage.tsx
│   └── ui
│       └── button.tsx
├── contexts
│   ├── AuthContext.tsx
│   └── auth-context.ts
├── data
│   └── photos.ts
├── index.css
├── lib
│   ├── admin-picture-api.ts
│   ├── auth-api.ts
│   ├── backend-picture.ts
│   ├── entity-id.ts
│   ├── gallery-layout.ts
│   ├── image-preload.ts
│   ├── my-picture-api.ts
│   ├── photo-permissions.ts
│   ├── photo-tags.ts
│   ├── picture-api.ts
│   ├── picture-delete.ts
│   ├── request.ts
│   ├── text.ts
│   ├── user-api.ts
│   └── utils.ts
├── main.tsx
├── test
│   └── setup.ts
└── types
    └── photo.ts

```

`App.tsx`:

```tsx
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"

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
type HeaderVariant = "transparent" | "solid"

const GALLERY_PATH = "/gallery"
const ADMIN_REVIEW_PATH = "/admin/review"
const MY_PROFILE_PATH = "/me"
const USER_PROFILE_PATH_PREFIX = "/users"
const DEFAULT_GALLERY_ERROR = "图库暂时无法加载，请稍后重试。"
const HOME_HEADER_OBSERVER_OFFSET_PX = 56

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
  const homeHeroRef = useRef<HTMLElement | null>(null)
  const { user, isLoggedIn } = useAuth()

  const [route, setRoute] = useState<Route>(initialRoute)
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([])
  const [galleryLoadState, setGalleryLoadState] = useState<GalleryLoadState>(
    initialRoute.page === "gallery" ? "loading" : "idle",
  )
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("all")
  const [isHomeHeroVisible, setIsHomeHeroVisible] = useState(initialRoute.page === "home")
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
  const headerVariant: HeaderVariant = isHome && isHomeHeroVisible ? "transparent" : "solid"
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
        setIsHomeHeroVisible(true)
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
        setIsHomeHeroVisible(true)
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
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <ExhibitionHeader
        currentPage={currentPage}
        onHomeClick={() => navigateToRoute({ page: "home" })}
        onGalleryClick={() => navigateToRoute({ page: "gallery" })}
        onAdminReviewClick={() => navigateToRoute({ page: "adminReview" })}
        onLoginClick={() => setIsAuthDialogOpen(true)}
        onMyProfileClick={() => navigateToRoute({ page: "me" })}
        onUploadClick={() => setIsUploadDialogOpen(true)}
        variant={headerVariant}
      />
      <main className={cn("flex-1", !isHome && "pt-11 md:pt-12")}>
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

```

`components/AdminReviewPage.tsx`:

```tsx
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getAdminPictureDetail,
  listAdminPictures,
  reviewPicture,
  type AdminPictureRecord,
  type ListAdminPicturesParams,
  type ReviewPictureParams,
} from "@/lib/admin-picture-api"
import { DELETE_PICTURE_CONFIRM_MESSAGE } from "@/lib/picture-delete"
import { deletePicture } from "@/lib/picture-api"
import { cn } from "@/lib/utils"

interface AdminReviewPageProps {
  currentUserRole?: string
}

type ReviewPageState = "loading" | "ready" | "error"

const REVIEW_STATUS_LABELS: Record<number, string> = {
  0: "待审核",
  1: "已通过",
  2: "已拒绝",
}

const STATUS_FILTERS: Array<{ label: string; value?: number }> = [
  { label: "全部", value: undefined },
  { label: "待审核", value: 0 },
  { label: "已通过", value: 1 },
  { label: "已拒绝", value: 2 },
]

function getReviewStatusLabel(reviewStatus?: number) {
  if (reviewStatus === undefined) {
    return "未知状态"
  }

  return REVIEW_STATUS_LABELS[reviewStatus] ?? "未知状态"
}

function getStatusBadgeClass(reviewStatus?: number) {
  if (reviewStatus === 1) {
    return "bg-emerald-500/12 text-emerald-700"
  }

  if (reviewStatus === 2) {
    return "bg-rose-500/12 text-rose-700"
  }

  return "bg-amber-500/12 text-amber-700"
}

function matchesStatusFilter(record: AdminPictureRecord, reviewStatus?: number) {
  return reviewStatus === undefined || record.reviewStatus === reviewStatus
}

const ADMIN_THUMBNAIL_SIZE = 56
const ADMIN_DETAIL_PREVIEW_HEIGHT = 512

function getUploaderDisplay(record: Pick<AdminPictureRecord, "user" | "userId">) {
  const userName = record.user?.userName?.trim()
  const userId = record.userId ?? record.user?.id

  if (userName) {
    return {
      primaryLabel: userName,
      secondaryLabel: userId ? `#${userId}` : null,
    }
  }

  if (userId) {
    return {
      primaryLabel: `用户 #${userId}`,
      secondaryLabel: null,
    }
  }

  return {
    primaryLabel: "-",
    secondaryLabel: null,
  }
}

function mergeAdminPictureRecord(currentRecord: AdminPictureRecord, nextRecord: AdminPictureRecord): AdminPictureRecord {
  return {
    ...currentRecord,
    ...nextRecord,
    userId: nextRecord.userId ?? currentRecord.userId,
    user: nextRecord.user ?? currentRecord.user,
  }
}

function UploaderSummary({ record }: { record: Pick<AdminPictureRecord, "user" | "userId"> }) {
  const { primaryLabel, secondaryLabel } = getUploaderDisplay(record)

  return (
    <div className="space-y-1">
      <p className="text-foreground">{primaryLabel}</p>
      {secondaryLabel ? <p className="text-xs text-muted-foreground">{secondaryLabel}</p> : null}
    </div>
  )
}

interface AdminPictureRowProps {
  isSelected: boolean
  onOpenDetail: (record: AdminPictureRecord) => void
  onToggleSelect: (id: string, isChecked: boolean) => void
  record: AdminPictureRecord
}

const AdminPictureRow = memo(function AdminPictureRow({
  isSelected,
  onOpenDetail,
  onToggleSelect,
  record,
}: AdminPictureRowProps) {
  return (
    <tr key={record.id} className="align-top">
      <td className="px-4 py-4">
        <input
          type="checkbox"
          aria-label={`选择图片 ${record.id}`}
          checked={isSelected}
          onChange={(event) => onToggleSelect(record.id, event.target.checked)}
          className="size-4 rounded border-border/80"
        />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="size-14 overflow-hidden rounded-2xl bg-secondary/50">
            <img
              src={record.thumbnailUrl ?? record.url}
              alt={record.name ?? `picture-${record.id}`}
              width={ADMIN_THUMBNAIL_SIZE}
              height={ADMIN_THUMBNAIL_SIZE}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              draggable="false"
              className="size-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onOpenDetail(record)}
              className="text-left font-medium text-foreground transition hover:text-foreground/72"
              aria-label={`查看图片 ${record.name ?? record.id} 的审核详情`}
            >
              {record.name ?? `图片 ${record.id}`}
            </button>
            <p className="text-xs text-muted-foreground">#{record.id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{record.category || "未分类"}</td>
      <td className="px-4 py-4 align-middle">
        <UploaderSummary record={record} />
      </td>
      <td className="px-4 py-4">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            getStatusBadgeClass(record.reviewStatus),
          )}
        >
          {getReviewStatusLabel(record.reviewStatus)}
        </span>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{record.updateTime ?? "-"}</td>
    </tr>
  )
})

export function AdminReviewPage({ currentUserRole }: AdminReviewPageProps) {
  const detailCacheRef = useRef(new Map<string, AdminPictureRecord>())
  const [filters, setFilters] = useState<ListAdminPicturesParams>({
    pageNum: 1,
    pageSize: 20,
    reviewStatus: 0,
  })
  const [clientPageNum, setClientPageNum] = useState(1)
  const [isClientPaginating, setIsClientPaginating] = useState(false)
  const [pageState, setPageState] = useState<ReviewPageState>("loading")
  const [records, setRecords] = useState<AdminPictureRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedPicture, setSelectedPicture] = useState<AdminPictureRecord | null>(null)
  const [selectedPictureError, setSelectedPictureError] = useState<string | null>(null)
  const [detailReviewMessage, setDetailReviewMessage] = useState("")
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [isSubmittingDetailAction, setIsSubmittingDetailAction] = useState(false)
  const [isDeletingSelectedPicture, setIsDeletingSelectedPicture] = useState(false)
  const [isBatchRejectMode, setIsBatchRejectMode] = useState(false)
  const [batchReviewMessage, setBatchReviewMessage] = useState("")
  const [isSubmittingBatchAction, setIsSubmittingBatchAction] = useState(false)

  useEffect(() => {
    if (currentUserRole !== "admin") {
      return
    }

    let isCancelled = false

    const load = async () => {
      setPageState("loading")
      setErrorMessage(null)

      try {
        const result = await listAdminPictures(filters)
        const requestedPageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
        const shouldUseClientPagination = result.list.length > requestedPageSize

        if (isCancelled) {
          return
        }

        setClientPageNum((currentPageNum) =>
          shouldUseClientPagination ? Math.min(currentPageNum, Math.max(1, Math.ceil(result.list.length / requestedPageSize))) : 1,
        )
        setIsClientPaginating(shouldUseClientPagination)
        setRecords(result.list)
        setTotalRecords(shouldUseClientPagination ? result.list.length : result.total)
        const visibleIdSet = new Set(result.list.map((record) => record.id))
        setSelectedIds((current) => current.filter((id) => visibleIdSet.has(id)))
        setPageState("ready")
      } catch (error) {
        if (isCancelled) {
          return
        }

        setPageState("error")
        setErrorMessage(error instanceof Error ? error.message : "审核列表暂时无法加载。")
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [currentUserRole, filters])

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const currentPageNum = isClientPaginating ? clientPageNum : (filters.pageNum ?? 1)
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(Math.max(totalRecords, records.length) / pageSize)),
    [pageSize, records.length, totalRecords],
  )
  const visibleRecords = useMemo(() => {
    if (!isClientPaginating) {
      return records
    }

    const start = (currentPageNum - 1) * pageSize

    return records.slice(start, start + pageSize)
  }, [currentPageNum, isClientPaginating, pageSize, records])

  const summaryText = useMemo(() => {
    const effectiveTotal = Math.max(totalRecords, records.length)

    if (!effectiveTotal) {
      return "当前筛选下没有图片。"
    }

    return `共 ${effectiveTotal} 张图片`
  }, [records.length, totalRecords])

  const selectedCount = selectedIds.length
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const applyRecordUpdate = useCallback(
    (updatedRecord: AdminPictureRecord) => {
      const currentRecord =
        detailCacheRef.current.get(updatedRecord.id) ??
        (selectedPicture?.id === updatedRecord.id ? selectedPicture : undefined) ??
        records.find((record) => record.id === updatedRecord.id)
      const mergedRecord = currentRecord ? mergeAdminPictureRecord(currentRecord, updatedRecord) : updatedRecord

      detailCacheRef.current.set(mergedRecord.id, mergedRecord)
      setRecords((current) => {
        const nextRecords = current.map((record) =>
          record.id === updatedRecord.id ? mergeAdminPictureRecord(record, updatedRecord) : record,
        )

        return filters.reviewStatus === undefined
          ? nextRecords
          : nextRecords.filter((record) => matchesStatusFilter(record, filters.reviewStatus))
      })
      setSelectedPicture((current) =>
        current?.id === updatedRecord.id ? mergeAdminPictureRecord(current, updatedRecord) : current,
      )
    },
    [filters.reviewStatus, records, selectedPicture],
  )

  const handleStatusFilterChange = useCallback((reviewStatus?: number) => {
    setActionNotice(null)
    setClientPageNum(1)
    setIsClientPaginating(false)
    startTransition(() => {
      setFilters({
        pageNum: 1,
        pageSize: 20,
        reviewStatus,
      })
    })
  }, [])

  const handlePageChange = useCallback(
    (nextPageNum: number) => {
      const normalizedPageNum = Math.min(Math.max(1, nextPageNum), pageCount)

      if (normalizedPageNum === currentPageNum) {
        return
      }

      setActionNotice(null)

      if (isClientPaginating) {
        setClientPageNum(normalizedPageNum)
        return
      }

      startTransition(() => {
        setFilters((currentFilters) => ({
          ...currentFilters,
          pageNum: normalizedPageNum,
        }))
      })
    },
    [currentPageNum, isClientPaginating, pageCount],
  )

  const handleToggleSelect = useCallback((id: string, isChecked: boolean) => {
    setSelectedIds((current) => {
      if (isChecked) {
        return current.includes(id) ? current : [...current, id]
      }

      return current.filter((value) => value !== id)
    })
  }, [])

  const handleOpenDetail = useCallback(async (record: AdminPictureRecord) => {
    const cachedOrCurrentRecord = detailCacheRef.current.get(record.id) ?? record

    setSelectedPicture(cachedOrCurrentRecord)
    setSelectedPictureError(null)
    setDetailReviewMessage(cachedOrCurrentRecord.reviewMessage ?? "")
    setActionNotice(null)

    try {
      const cachedDetail = detailCacheRef.current.get(record.id)

      if (cachedDetail) {
        return
      }

      const detail = await getAdminPictureDetail(record.id)
      const mergedDetail = mergeAdminPictureRecord(cachedOrCurrentRecord, detail)

      detailCacheRef.current.set(mergedDetail.id, mergedDetail)
      setSelectedPicture(mergedDetail)
      setDetailReviewMessage(mergedDetail.reviewMessage ?? "")
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "图片详情暂时无法加载。")
    }
  }, [])

  const submitReviewAction = useCallback(
    async (params: ReviewPictureParams) => {
      const updatedRecord = await reviewPicture(params)
      applyRecordUpdate(updatedRecord)

      return updatedRecord
    },
    [applyRecordUpdate],
  )

  const handleDetailReview = useCallback(async (reviewStatus: 1 | 2) => {
    if (!selectedPicture) {
      return
    }

    const normalizedMessage = detailReviewMessage.trim()

    if (reviewStatus === 2 && !normalizedMessage) {
      setSelectedPictureError("拒绝时请填写审核意见。")
      return
    }

    setIsSubmittingDetailAction(true)
    setSelectedPictureError(null)
    setActionNotice(null)

    try {
      await submitReviewAction({
        id: selectedPicture.id,
        reviewStatus,
        reviewMessage: normalizedMessage || undefined,
      })

      setActionNotice(`已完成${reviewStatus === 1 ? "通过" : "拒绝"}审核。`)
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "审核操作失败。")
    } finally {
      setIsSubmittingDetailAction(false)
    }
  }, [detailReviewMessage, selectedPicture, submitReviewAction])

  const handleBatchReview = useCallback(async (reviewStatus: 1 | 2) => {
    if (!selectedIds.length) {
      return
    }

    const normalizedMessage = batchReviewMessage.trim()

    if (reviewStatus === 2 && !normalizedMessage) {
      setActionNotice("批量拒绝时请填写统一审核意见。")
      return
    }

    setIsSubmittingBatchAction(true)
    setActionNotice(null)

    let successCount = 0

    try {
      for (const id of selectedIds) {
        await submitReviewAction({
          id,
          reviewStatus,
          reviewMessage: normalizedMessage || undefined,
        })
        successCount += 1
      }

      setSelectedIds([])
      setBatchReviewMessage("")
      setIsBatchRejectMode(false)
      setActionNotice(`批量处理完成：成功 ${successCount} 张`)
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "批量审核失败。")
    } finally {
      setIsSubmittingBatchAction(false)
    }
  }, [selectedIds, batchReviewMessage, submitReviewAction])

  const handleDeleteSelectedPicture = useCallback(async () => {
    if (!selectedPicture) {
      return
    }

    if (!window.confirm(DELETE_PICTURE_CONFIRM_MESSAGE)) {
      return
    }

    setIsDeletingSelectedPicture(true)
    setSelectedPictureError(null)
    setActionNotice(null)

    try {
      const deletedPicture = await deletePicture(selectedPicture.id)
      const deletedId = deletedPicture.id

      detailCacheRef.current.delete(deletedId)
      setRecords((current) => current.filter((record) => record.id !== deletedId))
      setSelectedIds((current) => current.filter((id) => id !== deletedId))
      setSelectedPicture(null)
      setDetailReviewMessage("")
      setActionNotice(`已删除图片 ${deletedId}。`)
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "删除图片失败。")
    } finally {
      setIsDeletingSelectedPicture(false)
    }
  }, [selectedPicture])

  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="eyebrow-label">Admin Console</p>
          <h2 className="text-[2rem] font-medium tracking-[-0.05em] text-foreground">审核管理</h2>
          <p className="text-sm text-muted-foreground">
            支持状态切换、详情审核和批量处理，管理员可在这里集中完成审核工作。
          </p>
        </div>
        <div className="rounded-full border border-border/70 bg-white/82 px-4 py-2 text-sm text-muted-foreground">
          {summaryText}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter.value === filters.reviewStatus

          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => handleStatusFilterChange(filter.value)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-foreground text-background"
                  : "border border-border/70 bg-white text-foreground/74 hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      {selectedCount > 0 ? (
        <div className="mb-4 rounded-[1.5rem] border border-border/70 bg-white/92 px-4 py-4 shadow-[0_20px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-foreground">已选择 {selectedCount} 张图片</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void handleBatchReview(1)}
                disabled={isSubmittingBatchAction}
              >
                批量通过
              </Button>
              <Button
                variant="destructive"
                onClick={() => setIsBatchRejectMode((current) => !current)}
                disabled={isSubmittingBatchAction}
              >
                批量拒绝
              </Button>
            </div>
          </div>
          {isBatchRejectMode ? (
            <div className="mt-4 space-y-3 rounded-[1.25rem] border border-border/70 bg-secondary/26 p-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">批量审核意见</span>
                <textarea
                  value={batchReviewMessage}
                  onChange={(event) => setBatchReviewMessage(event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={() => void handleBatchReview(2)}
                  disabled={isSubmittingBatchAction}
                >
                  确认批量拒绝
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatchReviewMessage("")
                    setIsBatchRejectMode(false)
                  }}
                  disabled={isSubmittingBatchAction}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {actionNotice ? (
        <div className="mb-4 rounded-[1.5rem] border border-emerald-500/16 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88">
          {actionNotice}
        </div>
      ) : null}

      {pageState === "loading" ? (
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 px-6 py-16 text-center text-sm text-muted-foreground">
          正在加载审核列表...
        </div>
      ) : null}

      {pageState === "error" ? (
        <div className="rounded-[1.5rem] border border-destructive/16 bg-destructive/6 px-6 py-6 text-sm text-destructive">
          {errorMessage ?? "审核列表暂时无法加载。"}
        </div>
      ) : null}

      {pageState === "ready" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_380px]">
          <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-white/92 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
            <table className="min-w-full divide-y divide-border/70 text-left text-sm">
              <thead className="bg-secondary/36 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">选择</th>
                  <th className="px-4 py-3 font-medium">图片</th>
                  <th className="px-4 py-3 font-medium">分类</th>
                  <th className="px-4 py-3 font-medium">上传者</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleRecords.map((record) => (
                  <AdminPictureRow
                    key={record.id}
                    record={record}
                    isSelected={selectedIdSet.has(record.id)}
                    onOpenDetail={handleOpenDetail}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </tbody>
            </table>
            {pageCount > 1 ? (
              <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  第 {currentPageNum} / {pageCount} 页
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPageNum - 1)}
                    disabled={currentPageNum <= 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPageNum + 1)}
                    disabled={currentPageNum >= pageCount}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="rounded-[1.75rem] border border-border/70 bg-white/92 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
            {selectedPicture ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="eyebrow-label">Detail</p>
                  <h3 className="text-2xl font-medium tracking-[-0.04em] text-foreground">图片详情</h3>
                  <p className="text-sm text-muted-foreground">
                    可以对当前图片执行通过、拒绝和后续管理操作。
                  </p>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] bg-secondary/40">
                  <img
                    src={selectedPicture.url}
                    alt={selectedPicture.name ?? `picture-${selectedPicture.id}`}
                    width={selectedPicture.picWidth}
                    height={selectedPicture.picHeight ?? ADMIN_DETAIL_PREVIEW_HEIGHT}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    draggable="false"
                    className="max-h-64 w-full object-cover"
                  />
                </div>

                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">图片名</dt>
                    <dd className="mt-1 text-base text-foreground">{selectedPicture.name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">分类</dt>
                    <dd className="mt-1 text-base text-foreground">{selectedPicture.category ?? "未分类"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">上传者</dt>
                    <dd className="mt-1">
                      <UploaderSummary record={selectedPicture} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">当前状态</dt>
                    <dd className="mt-1 text-base text-foreground">
                      {getReviewStatusLabel(selectedPicture.reviewStatus)}
                    </dd>
                  </div>
                </dl>

                {selectedPictureError ? (
                  <div className="rounded-[1.25rem] border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {selectedPictureError}
                  </div>
                ) : null}

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">审核意见</span>
                  <textarea
                    value={detailReviewMessage}
                    onChange={(event) => setDetailReviewMessage(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleDetailReview(1)}
                    disabled={isSubmittingDetailAction}
                  >
                    通过审核
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDetailReview(2)}
                    disabled={isSubmittingDetailAction}
                  >
                    拒绝审核
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDeleteSelectedPicture()}
                    disabled={isDeletingSelectedPicture}
                  >
                    删除图片
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-[1.5rem] border border-dashed border-border/80 bg-secondary/22 px-6 text-center text-sm text-muted-foreground">
                从列表中选择一张图片，即可查看详情并执行审核操作。
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  )
}

```

`components/AuthDialog.tsx`:

```tsx
import { useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { login as loginApi, register as registerApi } from "@/lib/auth-api"
import { useAuth } from "@/contexts/auth-context"

type AuthMode = "login" | "register"
type SubmitState = "idle" | "submitting" | "register-success" | "error"

interface AuthDialogProps {
  open: boolean
  onClose: () => void
}

interface AuthFields {
  email: string
  password: string
  confirmPassword: string
}

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

interface FieldProps {
  autoComplete?: string
  autoFocus?: boolean
  error?: string
  label: string
  onChange: (value: string) => void
  type: string
  value: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COPY = {
  backToLogin: "去登录",
  closeLabel: "关闭登录卡片",
  confirmPassword: "确认密码",
  confirmPasswordRequired: "请确认密码",
  email: "邮箱",
  emailInvalid: "请输入有效的邮箱地址",
  emailRequired: "请输入邮箱",
  forgotPassword: "忘记密码?",
  hasAccount: "已有账号?",
  loginDescription: "使用邮箱和密码访问你的图库与后续上传能力。",
  loginFailed: "登录失败，请检查邮箱和密码",
  loginSubmit: "登录",
  loginSubmitting: "登录中...",
  loginTitle: "登录",
  noAccount: "没有账号?",
  password: "密码",
  passwordMismatch: "两次输入的密码不一致",
  passwordRequired: "请输入密码",
  registerDescription: "使用邮箱创建你的帐号，后续可用于管理图库与上传内容。",
  registerFailed: "注册失败，该邮箱可能已被注册",
  registerSubmit: "注册",
  registerSubmitting: "注册中...",
  registerSuccess: "注册成功",
  registerSuccessAlert: "注册成功，接下来使用刚才填写的邮箱与密码登录即可。",
  registerSuccessDescription: "账号已创建完成，现在可以回到登录继续使用。",
  successEyebrow: "账号已创建",
  switchEyebrow: "账号入口",
} as const

const INITIAL_FIELDS: AuthFields = {
  confirmPassword: "",
  email: "",
  password: "",
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const timeoutRef = useRef<number | null>(null)
  const shouldCloseFromBackdropRef = useRef(false)
  const [mode, setMode] = useState<AuthMode>("login")
  const [fields, setFields] = useState<AuthFields>(INITIAL_FIELDS)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { login: onLoginSuccess } = useAuth()

  const title =
    submitState === "register-success"
      ? COPY.registerSuccess
      : mode === "login"
        ? COPY.loginTitle
        : COPY.registerSubmit

  const description =
    submitState === "register-success"
      ? COPY.registerSuccessDescription
      : mode === "login"
        ? COPY.loginDescription
        : COPY.registerDescription

  const eyebrow = submitState === "register-success" ? COPY.successEyebrow : COPY.switchEyebrow

  const clearPendingTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const resetFieldsForMode = () => {
    setErrors({})
    setSubmitState("idle")
    setApiError(null)
    setSuccessMessage(null)
    setFields((current) => ({
      confirmPassword: "",
      email: current.email,
      password: "",
    }))
  }

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      clearPendingTimeout()
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  const setField = (field: keyof AuthFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    resetFieldsForMode()
  }

  const resetToLogin = () => {
    setMode("login")
    resetFieldsForMode()
  }

  const validate = () => {
    const nextErrors: FieldErrors = {}
    const email = fields.email.trim()

    if (!email) {
      nextErrors.email = COPY.emailRequired
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = COPY.emailInvalid
    }

    if (!fields.password) {
      nextErrors.password = COPY.passwordRequired
    }

    if (mode === "register") {
      if (!fields.confirmPassword) {
        nextErrors.confirmPassword = COPY.confirmPasswordRequired
      } else if (fields.confirmPassword !== fields.password) {
        nextErrors.confirmPassword = COPY.passwordMismatch
      }
    }

    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!validate()) {
      return
    }

    clearPendingTimeout()
    setApiError(null)
    setSuccessMessage(null)
    setSubmitState("submitting")

    const email = fields.email.trim()

    if (mode === "login") {
      loginApi({ userEmail: email, userPassword: fields.password })
        .then((result) => {
          onLoginSuccess(result.data)
          onClose()
        })
        .catch((err: unknown) => {
          setSubmitState("error")
          setApiError(err instanceof Error ? err.message : COPY.loginFailed)
        })
    } else {
      registerApi({
        userEmail: email,
        userPassword: fields.password,
        userCheckPassword: fields.confirmPassword,
      })
        .then((result) => {
          setSuccessMessage(result.message || COPY.registerSuccessAlert)
          setSubmitState("register-success")
        })
        .catch((err: unknown) => {
          setSubmitState("error")
          setApiError(err instanceof Error ? err.message : COPY.registerFailed)
        })
    }
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    shouldCloseFromBackdropRef.current = event.target === event.currentTarget
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    const shouldClose =
      shouldCloseFromBackdropRef.current && event.target === event.currentTarget

    shouldCloseFromBackdropRef.current = false

    if (shouldClose) {
      onClose()
    }
  }

  return (
    <div
      data-testid="auth-backdrop"
      className="fixed inset-0 z-[70] bg-[rgba(17,17,19,0.42)] backdrop-blur-[14px]"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-screen items-center justify-center p-4 md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="w-full max-w-[456px] rounded-[2rem] border border-black/10 bg-[#fbfaf7]/96 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:p-7"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="eyebrow-label">{eyebrow}</p>
              <h2 className="text-[1.9rem] font-medium tracking-[-0.05em] text-foreground">{title}</h2>
              <p className="max-w-[32ch] text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <button
              type="button"
              aria-label={COPY.closeLabel}
              className="inline-flex rounded-full border border-border/70 bg-background/82 p-2 text-foreground transition hover:bg-secondary"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          {submitState === "register-success" ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-[1.4rem] border border-emerald-500/18 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88">
                {successMessage ?? COPY.registerSuccessAlert}
              </div>
              <Button className="h-11 w-full rounded-2xl" onClick={resetToLogin}>
                {COPY.backToLogin}
              </Button>
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
              <Field
                label={COPY.email}
                type="email"
                value={fields.email}
                error={errors.email}
                autoComplete="email"
                autoFocus
                onChange={(value) => setField("email", value)}
              />
              <div className="space-y-2">
                <Field
                  label={COPY.password}
                  type="password"
                  value={fields.password}
                  error={errors.password}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  onChange={(value) => setField("password", value)}
                />
                {mode === "login" ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {COPY.forgotPassword}
                    </button>
                  </div>
                ) : null}
              </div>
              {mode === "register" ? (
                <Field
                  label={COPY.confirmPassword}
                  type="password"
                  value={fields.confirmPassword}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                  onChange={(value) => setField("confirmPassword", value)}
                />
              ) : null}
              {apiError ? (
                <div className="rounded-[1.4rem] border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {apiError}
                </div>
              ) : null}
              <Button
                type="submit"
                className="mt-2 h-11 w-full rounded-2xl"
                disabled={submitState === "submitting"}
              >
                {submitState === "submitting"
                  ? mode === "login"
                    ? COPY.loginSubmitting
                    : COPY.registerSubmitting
                  : mode === "login"
                    ? COPY.loginSubmit
                    : COPY.registerSubmit}
              </Button>
            </form>
          )}

          {submitState !== "register-success" ? (
            <div className="mt-6 border-t border-border/70 pt-4 text-sm text-muted-foreground">
              {mode === "login" ? COPY.noAccount : COPY.hasAccount}{" "}
              <button
                type="button"
                className="font-medium text-foreground transition hover:opacity-75"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? COPY.registerSubmit : COPY.loginSubmit}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Field({ autoComplete, autoFocus, error, label, onChange, type, value }: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={error ? "true" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-2xl border bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-foreground/28 focus:ring-2 focus:ring-ring/20",
          error ? "border-destructive/45" : "border-border/80"
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </label>
  )
}

```

`components/CategoryFilter.tsx`:

```tsx
import { cn } from "@/lib/utils"

export interface CategoryOption {
  value: string
  label: string
}

interface CategoryFilterProps {
  active: string
  categories: CategoryOption[]
  onChange: (category: string) => void
}

export function CategoryFilter({ active, categories, onChange }: CategoryFilterProps) {
  return (
    <div
      className="no-scrollbar flex max-w-full gap-2 overflow-x-auto rounded-full border border-border/70 bg-white/72 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.04)] backdrop-blur-xl"
      role="toolbar"
      aria-label="作品分类"
    >
      {categories.map((category) => {
        const pressed = active === category.value

        return (
          <button
            key={category.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(category.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[0.82rem] whitespace-nowrap transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              pressed
                ? "border-border/80 bg-background text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/72 hover:text-foreground",
            )}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}

```

`components/ExhibitionHeader.tsx`:

```tsx
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

```

`components/GallerySummary.tsx`:

```tsx
import { categoryLabels, type Category } from "@/data/photos"

interface GallerySummaryProps {
  totalCount: number
  categoryCount: number
  activeCategory: Category
  filteredCount: number
}

export function GallerySummary({
  totalCount,
  categoryCount,
  activeCategory,
  filteredCount,
}: GallerySummaryProps) {
  return (
    <section className="rounded-[28px] border border-border/70 bg-white/76 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl md:px-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="eyebrow-label">当前分类</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">
            {categoryLabels[activeCategory]}
          </p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow-label">作品总量</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">共 {totalCount} 幅</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow-label">当前显示</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">当前 {filteredCount} 幅</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow-label">专题数量</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">{categoryCount} 个主题</p>
        </div>
      </div>
    </section>
  )
}

```

`components/HeroIntro.tsx`:

```tsx
import type { Ref } from "react"

import { HomeCardSphereSection } from "@/components/HomeCardSphereSection"

const HOME_HERO_IMAGE_URL =
  "https://picture-storage-1325426290.cos.ap-guangzhou.myqcloud.com/public/1921565781396983809/2025-05-11_EsuDN34k9DzFdTajwebp"

interface HeroIntroProps {
  heroRef?: Ref<HTMLElement>
}

export function HeroIntro({ heroRef }: HeroIntroProps) {
  return (
    <>
      <section ref={heroRef} data-testid="home-hero-shell" className="w-full pb-0 pt-0">
        <div
          data-testid="home-hero"
          className="min-h-screen w-full bg-[#d8d3cb]"
          style={{
            backgroundImage: `url(${HOME_HERO_IMAGE_URL})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
      </section>
      <HomeCardSphereSection />
    </>
  )
}

```

`components/HomeCardSphereSection.tsx`:

```tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { listPictures } from "@/lib/picture-api"
import type { Photo } from "@/types/photo"

interface SphereImageCard {
  id: string
  src: string
  alt: string
}

interface SpherePlacedCard extends SphereImageCard {
  latitudeDeg: number
  longitudeDeg: number
}

interface PointerState {
  dragging: boolean
  visible: boolean
  reducedMotion: boolean
  rotationX: number
  rotationY: number
  velocityX: number
  velocityY: number
  lastClientX: number
  lastClientY: number
  lastMoveAt: number
  pauseAutoUntil: number
}

const SPHERE_COLS = 40
const SPHERE_ROWS = 5
const CARD_GAP_PX = 6
const ROW_STEP_FACTOR = 1.02
const STAGGER_FACTOR = 0.55

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function buildSphereImageCards(photos: Photo[], totalCount: number) {
  if (!photos.length) {
    return []
  }

  return Array.from({ length: totalCount }, (_, index) => {
    const photo = photos[index % photos.length]

    return {
      id: photo.id,
      src: photo.thumbnailSrc ?? photo.src,
      alt: photo.alt,
    } satisfies SphereImageCard
  })
}

function buildOrderedSphereBelt(images: SphereImageCard[]) {
  if (!images.length) {
    return []
  }

  const longitudeStepDeg = 360 / SPHERE_COLS
  const rowStepDeg = longitudeStepDeg * ROW_STEP_FACTOR
  const staggerDeg = rowStepDeg * STAGGER_FACTOR
  const startLatitudeDeg = ((SPHERE_ROWS - 1) * rowStepDeg) / 2

  return Array.from({ length: SPHERE_COLS }, (_, columnIndex) =>
    Array.from({ length: SPHERE_ROWS }, (_, rowIndex) => {
      const image = images[columnIndex * SPHERE_ROWS + rowIndex]
      const columnOffsetDeg = columnIndex % 2 === 0 ? 0 : -staggerDeg

      return {
        ...image,
        id: `${image.id}-${columnIndex}-${rowIndex}`,
        latitudeDeg: startLatitudeDeg - rowIndex * rowStepDeg + columnOffsetDeg,
        longitudeDeg: columnIndex * longitudeStepDeg,
      } satisfies SpherePlacedCard
    }),
  ).flat()
}

export function HomeCardSphereSection() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const sphereRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [spherePhotos, setSpherePhotos] = useState<Photo[]>([])
  const sphereImages = useMemo(
    () => buildSphereImageCards(spherePhotos, SPHERE_COLS * SPHERE_ROWS),
    [spherePhotos],
  )
  const placedCards = useMemo(() => buildOrderedSphereBelt(sphereImages), [sphereImages])
  const pointerStateRef = useRef<PointerState>({
    dragging: false,
    visible: true,
    reducedMotion:
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    rotationX: 0,
    rotationY: 0,
    velocityX: 0,
    velocityY: 0.1,
    lastClientX: 0,
    lastClientY: 0,
    lastMoveAt: 0,
    pauseAutoUntil: 0,
  })

  useEffect(() => {
    let isCancelled = false

    const load = async () => {
      try {
        const result = await listPictures({ pageNum: 1, pageSize: 20 })

        if (isCancelled) {
          return
        }

        setSpherePhotos(result.list)
      } catch {
        if (!isCancelled) {
          setSpherePhotos([])
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [])

  const renderSphere = useCallback(() => {
    const sphere = sphereRef.current
    const state = pointerStateRef.current

    if (!sphere) {
      return
    }

    sphere.style.transform = `translate3d(-50%, -50%, 0) rotateX(${state.rotationX}deg) rotateY(${state.rotationY}deg)`
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const updateMetrics = (width: number, height: number) => {
      const diameter = clamp(Math.min(width * 0.893, height * 1.973), 504, 980)
      const radius = diameter / 2
      const columnArc = (Math.PI * 2 * radius) / SPHERE_COLS
      const cardSize = clamp(columnArc - CARD_GAP_PX, 64, 122)

      viewport.style.setProperty("--sphere-radius", `${Math.round(radius)}px`)
      viewport.style.setProperty("--sphere-diameter", `${Math.round(diameter)}px`)
      viewport.style.setProperty("--sphere-card-size", `${Math.round(cardSize)}px`)
    }

    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      updateMetrics(entry.contentRect.width, entry.contentRect.height)
    })

    observerRef.current.observe(viewport)
    renderSphere()

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [renderSphere])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    let intersectionObserver: IntersectionObserver | null = null

    if (typeof IntersectionObserver === "function") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          pointerStateRef.current.visible = entries[0]?.isIntersecting ?? true
        },
        { threshold: 0.08 },
      )

      intersectionObserver.observe(viewport)
    }

    const step = () => {
      const state = pointerStateRef.current
      const now = typeof performance !== "undefined" ? performance.now() : Date.now()
      let shouldRender = false

      if (state.visible && !state.dragging) {
        if (!state.reducedMotion && now >= state.pauseAutoUntil) {
          state.rotationY += 0.03
          shouldRender = true
        }

        if (Math.abs(state.velocityX) > 0.001 || Math.abs(state.velocityY) > 0.001) {
          state.rotationX = clamp(state.rotationX + state.velocityX, -24, 24)
          state.rotationY += state.velocityY
          state.velocityX *= 0.94
          state.velocityY *= 0.94

          if (Math.abs(state.velocityX) < 0.001) {
            state.velocityX = 0
          }

          if (Math.abs(state.velocityY) < 0.001) {
            state.velocityY = 0
          }

          shouldRender = true
        }
      }

      if (shouldRender) {
        renderSphere()
      }

      frameRef.current = window.requestAnimationFrame(step)
    }

    frameRef.current = window.requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }

      intersectionObserver?.disconnect()
    }
  }, [renderSphere])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current

    state.dragging = true
    state.velocityX = 0
    state.velocityY = 0
    state.lastClientX = event.clientX
    state.lastClientY = event.clientY
    state.lastMoveAt = typeof performance !== "undefined" ? performance.now() : Date.now()

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current

    if (!state.dragging) {
      return
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now()
    const deltaX = event.clientX - state.lastClientX
    const deltaY = event.clientY - state.lastClientY
    const deltaTime = Math.max(now - state.lastMoveAt, 16)

    state.rotationY += deltaX * 0.24
    state.rotationX = clamp(state.rotationX - deltaY * 0.18, -24, 24)
    state.velocityY = (deltaX / deltaTime) * 1.25
    state.velocityX = (-deltaY / deltaTime) * 0.92
    state.lastClientX = event.clientX
    state.lastClientY = event.clientY
    state.lastMoveAt = now

    renderSphere()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current

    if (!state.dragging) {
      return
    }

    state.dragging = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return (
    <section data-testid="home-card-sphere" className="home-card-sphere-section relative overflow-hidden">
      <div
        ref={viewportRef}
        className="home-card-sphere-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div ref={sphereRef} className="home-card-sphere-orbit">
          {placedCards.map((item) => {
            const pointStyle = {
              "--sphere-lat": `${item.latitudeDeg.toFixed(3)}deg`,
              "--sphere-lon": `${item.longitudeDeg.toFixed(3)}deg`,
            } as CSSProperties

              return (
                <div key={item.id} className="home-card-sphere-node" style={pointStyle}>
                  <div className="home-card-sphere-card">
                    <div className="home-card-sphere-card-face home-card-sphere-card-face--front">
                      <img
                        src={item.src}
                        alt={item.alt}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="home-card-sphere-media"
                      />
                    </div>
                    <div className="home-card-sphere-card-face home-card-sphere-card-face--back" aria-hidden="true">
                      <img
                        src={item.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="home-card-sphere-media"
                      />
                    </div>
                  </div>
                </div>
              )
          })}
        </div>
      </div>
    </section>
  )
}

```

`components/PhotoGrid.tsx`:

```tsx
import { memo, useEffect, useMemo, useState, type MouseEvent } from "react"

import { buildJustifiedRows } from "@/lib/gallery-layout"
import { preloadImage } from "@/lib/image-preload"
import { PHOTO_CARD_TAG_LIMIT, getTagDisplay } from "@/lib/photo-tags"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo) => void
  onPhotographerClick?: (photo: Photo) => void
  onClearFilter?: () => void
}

function useContainerWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width)

      setWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth))
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [element])

  return { setElement, width }
}

export function PhotoGrid({ photos, onPhotoClick, onPhotographerClick, onClearFilter }: PhotoGridProps) {
  const { setElement, width } = useContainerWidth()
  const gap = width < 768 ? 6 : 10
  const targetRowHeight = width < 640 ? 216 : width < 1024 ? 258 : 314

  const rows = useMemo(
    () =>
      buildJustifiedRows(photos, {
        containerWidth: width,
        gap,
        targetRowHeight,
        minRowHeight: Math.max(170, targetRowHeight - 60),
        maxRowHeight: targetRowHeight + 80,
      }),
    [gap, photos, targetRowHeight, width],
  )

  if (!photos.length) {
    return (
      <div className="border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center md:px-10">
        <p className="eyebrow-label">暂无匹配作品</p>
        <h4 className="mt-4 text-2xl font-medium tracking-[-0.04em]">当前筛选条件下还没有可浏览的作品。</h4>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          回到全部分类后，可以继续浏览更完整的影像集合。
        </p>
        {onClearFilter ? (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-6 inline-flex rounded-full border border-border bg-background px-5 py-2.5 text-sm transition-colors hover:bg-secondary"
          >
            清除筛选
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={setElement} className="space-y-2">
      {rows.map((row) => (
        <div
          key={`${row.photos[0]?.id}-${row.photos.length}`}
          className={cn("flex", row.isLastRow && "justify-start")}
          style={{ gap, height: row.height, width: row.width }}
        >
          {row.photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onClick={onPhotoClick}
              onPhotographerClick={onPhotographerClick}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const PhotoCard = memo(function PhotoCard({
  photo,
  onClick,
  onPhotographerClick,
}: {
  photo: Photo
  onClick?: (photo: Photo) => void
  onPhotographerClick?: (photo: Photo) => void
}) {
  const { visibleTags, hiddenCount } = useMemo(
    () => getTagDisplay(photo.tags, { maxVisible: PHOTO_CARD_TAG_LIMIT }),
    [photo.tags],
  )
  const canOpenPhotographer = Boolean(onPhotographerClick && photo.userId)
  const handleWarmPreview = () => {
    preloadImage(photo.src)
  }
  const handlePhotographerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onPhotographerClick?.(photo)
  }

  return (
    <article
      className="group relative overflow-hidden rounded-none bg-muted/60"
      style={{ flex: `${photo.width / photo.height} 0 0` }}
    >
      <button
        type="button"
        onClick={() => onClick?.(photo)}
        onMouseEnter={handleWarmPreview}
        onFocus={handleWarmPreview}
        className="absolute inset-0 z-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
      >
        <span className="sr-only">查看图片 {photo.alt}</span>
      </button>
      <img
        src={photo.thumbnailSrc ?? photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        draggable="false"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/54 via-black/12 to-transparent px-4 pb-4 pt-14 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-white/82">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="border border-white/18 bg-white/10 px-2.5 py-1 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span className="border border-white/18 bg-white/10 px-2.5 py-1 backdrop-blur-sm">+{hiddenCount}</span>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-medium text-white">{photo.alt}</p>
        {canOpenPhotographer ? (
          <button
            type="button"
            onClick={handlePhotographerClick}
            className="pointer-events-auto mt-1 text-xs text-white/70 underline-offset-2 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:text-white focus-visible:underline"
          >
            {photo.photographer}
          </button>
        ) : (
          <p className="mt-1 text-xs text-white/70">{photo.photographer}</p>
        )}
      </div>
    </article>
  )
})

```

`components/PhotoPreviewOverlay.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { preloadImages } from "@/lib/image-preload"
import { PHOTO_DETAIL_TAG_LIMIT, getTagDisplay } from "@/lib/photo-tags"
import type { Photo } from "@/types/photo"

interface PhotoPreviewOverlayProps {
  photo: Photo
  photos: Photo[]
  onClose: () => void
  onSelect: (photo: Photo) => void
  onDelete?: () => void
  onPhotographerClick?: (photo: Photo) => void
  canDelete?: boolean
  isDeleting?: boolean
  isLoading?: boolean
  errorMessage?: string | null
}

const DESKTOP_BREAKPOINT = 768

function getPreviewSrc(photo: Photo) {
  return photo.src
}

export function PhotoPreviewOverlay({
  photo,
  photos,
  onClose,
  onSelect,
  onDelete,
  onPhotographerClick,
  canDelete = false,
  isDeleting = false,
  isLoading = false,
  errorMessage = null,
}: PhotoPreviewOverlayProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [imageHeight, setImageHeight] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT)
  const [isEntered, setIsEntered] = useState(false)

  const currentIndex = useMemo(() => photos.findIndex((item) => item.id === photo.id), [photo.id, photos])
  const previousPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null
  const nextPhoto = currentIndex >= 0 && currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null
  const previewSrc = getPreviewSrc(photo)
  const categoryLabel = photo.categoryLabel ?? photo.category
  const { visibleTags, hiddenCount } = getTagDisplay(photo.tags, { maxVisible: PHOTO_DETAIL_TAG_LIMIT })

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    }

    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsEntered(true))

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const measureImageHeight = () => {
      if (!imageRef.current) {
        return
      }

      const nextHeight = imageRef.current.getBoundingClientRect().height
      setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
    }

    measureImageHeight()

    if (!imageRef.current) {
      return
    }

    const observer = new ResizeObserver(() => {
      measureImageHeight()
    })

    observer.observe(imageRef.current)

    return () => observer.disconnect()
  }, [photo.id, isDesktop])

  useEffect(() => {
    preloadImages([previewSrc, previousPhoto?.src, nextPhoto?.src])
  }, [nextPhoto?.src, previousPhoto?.src, previewSrc])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
      if (event.key === "ArrowLeft" && previousPhoto) {
        onSelect(previousPhoto)
      }
      if (event.key === "ArrowRight" && nextPhoto) {
        onSelect(nextPhoto)
      }
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [nextPhoto, onClose, onSelect, previousPhoto])

  return (
    <div
      data-testid="preview-backdrop"
      className="fixed inset-0 z-50 bg-[oklch(0.22_0.01_84_/_0.16)] backdrop-blur-[10px]"
      onClick={onClose}
    >
      <div
        className={`mx-auto flex h-full w-full max-w-[1680px] flex-col ${
          isEntered ? "opacity-100" : "opacity-0"
        } transition-opacity duration-300`}
      >
        <div
          data-testid="preview-stage"
          className="relative flex min-h-[48vh] flex-1 items-center justify-center p-4 md:min-h-0 md:px-10 md:py-10"
        >
          <div
            data-testid="preview-body"
            className="relative flex w-fit max-w-full flex-col md:max-w-[1600px] md:flex-row md:items-start"
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex shrink-0 items-center justify-center">
              {isDesktop ? (
                <button
                  type="button"
                  data-testid="preview-prev"
                  aria-label="上一张图片"
                  onClick={() => previousPhoto && onSelect(previousPhoto)}
                  disabled={!previousPhoto}
                  className="absolute left-4 top-1/2 inline-flex -translate-y-1/2 rounded-full border border-white/12 bg-black/28 p-2 text-white transition hover:bg-black/40 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronLeft className="size-5" />
                </button>
              ) : null}
              {isDesktop ? (
                <button
                  type="button"
                  data-testid="preview-next"
                  aria-label="下一张图片"
                  onClick={() => nextPhoto && onSelect(nextPhoto)}
                  disabled={!nextPhoto}
                  className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 rounded-full border border-white/12 bg-black/28 p-2 text-white transition hover:bg-black/40 disabled:cursor-default disabled:opacity-35"
                >
                  <ChevronRight className="size-5" />
                </button>
              ) : null}
              <img
                ref={imageRef}
                src={previewSrc}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                draggable="false"
                onLoad={() => {
                  const nextHeight = imageRef.current?.getBoundingClientRect().height ?? 0
                  setImageHeight(nextHeight > 0 ? Math.round(nextHeight) : 0)
                }}
                className="block max-h-[56vh] w-auto max-w-[calc(100vw-40px)] object-contain transition duration-500 md:max-h-[calc(100vh-80px)] md:max-w-[min(calc(100vw-440px),1240px)]"
              />
            </div>
            <aside
              role="complementary"
              className="flex w-full shrink-0 flex-col justify-between overflow-y-auto border-t border-black/10 bg-white p-6 text-neutral-950 md:w-[360px] md:border-l md:border-t-0 md:p-8"
              style={isDesktop && imageHeight ? { height: `${imageHeight}px` } : undefined}
            >
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-neutral-600">
                    <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.18em]">
                      当前作品
                    </span>
                    <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.18em]">
                      {categoryLabel}
                    </span>
                    {visibleTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.12em]"
                      >
                        {tag}
                      </span>
                    ))}
                    {hiddenCount > 0 ? (
                      <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.12em]">
                        +{hiddenCount}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-2xl font-medium tracking-[-0.04em]">{photo.alt}</h3>
                  <p className="text-sm leading-6 text-neutral-600">{photo.summary}</p>
                  {errorMessage ? (
                    <p className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-900">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
                <dl className="grid gap-5 text-sm text-neutral-600">
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">摄影师</dt>
                    <dd className="mt-2 text-base text-neutral-950">
                      {onPhotographerClick && photo.userId ? (
                        <button
                          type="button"
                          onClick={() => onPhotographerClick(photo)}
                          className="transition hover:text-neutral-700 focus-visible:outline-none focus-visible:underline"
                        >
                          {photo.photographer}
                        </button>
                      ) : (
                        photo.photographer
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">分类</dt>
                    <dd className="mt-2 text-base text-neutral-950">{categoryLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">格式</dt>
                    <dd className="mt-2 text-base text-neutral-950">{photo.format ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">尺寸</dt>
                    <dd className="mt-2 text-base text-neutral-950">
                      {photo.width} × {photo.height}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">上传时间</dt>
                    <dd className="mt-2 text-base text-neutral-950">{photo.createdAt ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.72rem] tracking-[0.18em] text-neutral-500">浏览 / 点赞</dt>
                    <dd className="mt-2 text-base text-neutral-950">
                      {photo.viewCount ?? 0} / {photo.likeCount ?? 0}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-8 space-y-4 border-t border-black/10 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-500">
                    {currentIndex + 1} / {photos.length}
                  </p>
                  <div className="flex items-center gap-3">
                    {isLoading ? <p className="text-sm text-neutral-500">正在更新详情...</p> : null}
                    {canDelete ? (
                      <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
                        删除图片
                      </Button>
                    ) : null}
                  </div>
                </div>
                {!isDesktop ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      data-testid="preview-prev-mobile"
                      variant="secondary"
                      onClick={() => previousPhoto && onSelect(previousPhoto)}
                      disabled={!previousPhoto}
                    >
                      上一张
                    </Button>
                    <Button
                      data-testid="preview-next-mobile"
                      variant="secondary"
                      onClick={() => nextPhoto && onSelect(nextPhoto)}
                      disabled={!nextPhoto}
                    >
                      下一张
                    </Button>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

```

`components/UploadDialog.tsx`:

```tsx
import { useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { uploadPictureByUrl, uploadPictureFile } from "@/lib/picture-api"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

type UploadMode = "file" | "url"

interface UploadDialogProps {
  open: boolean
  onClose: () => void
  onUploaded: (photo: Photo) => void
}

interface TextFieldProps {
  autoFocus?: boolean
  label: string
  testId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const DEFAULT_ERROR_MESSAGE = "上传失败，请稍后再试。"

function normalizeTagsInput(value: string) {
  return [...new Set(value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))]
}

function trimText(value: string) {
  return value.trim()
}

export function UploadDialog({ open, onClose, onUploaded }: UploadDialogProps) {
  const shouldCloseFromBackdropRef = useRef(false)
  const [mode, setMode] = useState<UploadMode>("file")
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState("")
  const [picName, setPicName] = useState("")
  const [introduction, setIntroduction] = useState("")
  const [category, setCategory] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    shouldCloseFromBackdropRef.current = event.target === event.currentTarget
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    const shouldClose =
      shouldCloseFromBackdropRef.current && event.target === event.currentTarget

    shouldCloseFromBackdropRef.current = false

    if (shouldClose) {
      onClose()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const normalizedPicName = trimText(picName)
    const normalizedIntroduction = trimText(introduction)
    const normalizedCategory = trimText(category)
    const normalizedTags = normalizeTagsInput(tagsInput)

    if (mode === "file" && !file) {
      setErrorMessage("请选择图片文件。")
      return
    }

    if (mode === "url" && !trimText(fileUrl)) {
      setErrorMessage("请输入图片地址。")
      return
    }

    setIsSubmitting(true)

    try {
      const uploadedPhoto =
        mode === "file"
          ? await uploadPictureFile({
              file: file!,
              picName: normalizedPicName,
              introduction: normalizedIntroduction,
              category: normalizedCategory,
              tags: normalizedTags,
            })
          : await uploadPictureByUrl({
              fileUrl: trimText(fileUrl),
              picName: normalizedPicName,
              introduction: normalizedIntroduction,
              category: normalizedCategory,
              tags: normalizedTags,
            })

      onUploaded(uploadedPhoto)
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="upload-backdrop"
      className="fixed inset-0 z-[75] bg-[rgba(17,17,19,0.42)] backdrop-blur-[14px]"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-screen items-center justify-center p-4 md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="上传图片"
          className="w-full max-w-[520px] rounded-[2rem] border border-black/10 bg-[#fbfaf7]/96 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:p-7"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="eyebrow-label">图片上传</p>
              <h2 className="text-[1.9rem] font-medium tracking-[-0.05em] text-foreground">新增作品</h2>
              <p className="max-w-[36ch] text-sm leading-6 text-muted-foreground">
                支持本地文件上传和远程 URL 导入。普通用户上传后可能需要等待审核通过才会出现在公共图库中。
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭上传弹窗"
              className="inline-flex rounded-full border border-border/70 bg-background/82 p-2 text-foreground transition hover:bg-secondary"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-7 flex rounded-full border border-border/80 bg-white/80 p-1">
            <button
              type="button"
              data-testid="upload-mode-file"
              aria-pressed={mode === "file"}
              onClick={() => {
                setMode("file")
                setErrorMessage(null)
              }}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm transition",
                mode === "file" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              本地文件
            </button>
            <button
              type="button"
              data-testid="upload-mode-url"
              aria-pressed={mode === "url"}
              onClick={() => {
                setMode("url")
                setErrorMessage(null)
              }}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm transition",
                mode === "url" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              远程地址
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === "file" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">图片文件</span>
                <input
                  data-testid="upload-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setErrorMessage(null)
                  }}
                  className="block w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-background"
                />
                {file ? <p className="text-sm text-muted-foreground">{file.name}</p> : null}
              </label>
            ) : (
              <TextField
                autoFocus
                label="图片地址"
                testId="upload-url-input"
                value={fileUrl}
                placeholder="https://example.com/demo.webp"
                onChange={(value) => {
                  setFileUrl(value)
                  setErrorMessage(null)
                }}
              />
            )}

            <TextField
              label="图片名称"
              testId="upload-name-input"
              value={picName}
              onChange={setPicName}
              placeholder="可选"
            />
            <TextField
              label="简介"
              testId="upload-introduction-input"
              value={introduction}
              onChange={setIntroduction}
              placeholder="可选"
            />
            <TextField
              label="分类"
              testId="upload-category-input"
              value={category}
              onChange={setCategory}
              placeholder="例如 travel"
            />
            <TextField
              label="标签"
              testId="upload-tags-input"
              value={tagsInput}
              onChange={setTagsInput}
              placeholder="使用逗号分隔，例如 sea, sunset"
            />

            {errorMessage ? (
              <div className="rounded-[1.4rem] border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <Button
              type="submit"
              data-testid="upload-submit"
              className="mt-2 h-11 w-full rounded-2xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? "上传中..." : "开始上传"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

function TextField({ autoFocus, label, testId, value, onChange, placeholder }: TextFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        data-testid={testId}
        autoFocus={autoFocus}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-border/80 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
      />
    </label>
  )
}

```

`components/UserProfilePage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PencilLine, User as UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { preloadImage } from "@/lib/image-preload"
import { listMyPictures } from "@/lib/my-picture-api"
import { canDeletePhoto } from "@/lib/photo-permissions"
import { DELETE_PICTURE_CONFIRM_MESSAGE } from "@/lib/picture-delete"
import { deletePicture, getPictureDetail, listPictures } from "@/lib/picture-api"
import { getMyProfile, getUserProfile, updateMyProfile, type UserProfile } from "@/lib/user-api"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

import { PhotoGrid } from "./PhotoGrid"
import { PhotoPreviewOverlay } from "./PhotoPreviewOverlay"

type LoadState = "idle" | "loading" | "ready" | "error"
type UserProfileMode = "me" | "public"

interface UserProfilePageProps {
  mode: UserProfileMode
  userId?: string
  onNavigateToUser: (userId: string) => void
}

const PHOTO_PAGE_SIZE = 20
const PROFILE_DEFAULT_ERROR = "用户资料暂时无法加载。"
const PHOTOS_DEFAULT_ERROR = "作品列表暂时无法加载。"

const PRIVATE_REVIEW_FILTERS: Array<{ label: string; value?: number }> = [
  { label: "全部作品", value: undefined },
  { label: "待审核", value: 0 },
  { label: "已通过", value: 1 },
  { label: "已拒绝", value: 2 },
]

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage
}

function buildPublicStats(profile: UserProfile, photoCount: number) {
  return [
    { label: "公开作品", value: String(profile.approvedPictureCount ?? profile.pictureCount ?? photoCount) },
    { label: "用户身份", value: profile.userRole === "admin" ? "管理员" : "摄影师" },
    { label: "加入时间", value: profile.createTime?.slice(0, 10) ?? "-" },
  ]
}

function buildPrivateStats(profile: UserProfile, photoCount: number) {
  return [
    { label: "全部作品", value: String(profile.pictureCount ?? photoCount) },
    { label: "已通过", value: String(profile.approvedPictureCount ?? 0) },
    { label: "待审核", value: String(profile.pendingPictureCount ?? 0) },
    { label: "已拒绝", value: String(profile.rejectedPictureCount ?? 0) },
  ]
}

function decrementCount(value?: number) {
  return value !== undefined ? Math.max(0, value - 1) : undefined
}

function normalizePhotoOwner(photo: Photo, ownerId: string, ownerName?: string) {
  return {
    ...photo,
    photographer: photo.photographer === "Unknown" && ownerName ? ownerName : photo.photographer,
    userId: photo.userId ?? ownerId,
  }
}

export function UserProfilePage({ mode, userId, onNavigateToUser }: UserProfilePageProps) {
  const detailCacheRef = useRef(new Map<string, Photo>())
  const photosRequestIdRef = useRef(0)
  const { user, updateUser } = useAuth()
  const resolvedUserId = mode === "me" ? user?.id ?? null : userId ?? null
  const isMe = mode === "me"

  const [profileLoadState, setProfileLoadState] = useState<LoadState>("loading")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [photosLoadState, setPhotosLoadState] = useState<LoadState>("loading")
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPageNum, setPhotoPageNum] = useState(1)
  const [photoTotal, setPhotoTotal] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeReviewStatus, setActiveReviewStatus] = useState<number | undefined>(undefined)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [draftUserName, setDraftUserName] = useState("")
  const [draftUserAvatar, setDraftUserAvatar] = useState("")
  const [draftUserProfile, setDraftUserProfile] = useState("")
  const [profileFormError, setProfileFormError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [selectedPhotoDetail, setSelectedPhotoDetail] = useState<Photo | null>(null)
  const [selectedPhotoError, setSelectedPhotoError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isDeletingPreviewPhoto, setIsDeletingPreviewPhoto] = useState(false)
  const ownerFallbackName = isMe ? profile?.userName ?? user?.userName : profile?.userName
  const displayedPhotos = useMemo(
    () =>
      resolvedUserId
        ? photos.map((photo) => normalizePhotoOwner(photo, resolvedUserId, ownerFallbackName))
        : photos,
    [ownerFallbackName, photos, resolvedUserId],
  )

  const currentPhoto = useMemo(
    () => displayedPhotos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [displayedPhotos, selectedPhotoId],
  )
  const previewPhoto = selectedPhotoDetail ?? currentPhoto
  const canDeletePreviewPhoto = canDeletePhoto(user, previewPhoto)
  const normalizedDraftUserName = draftUserName.trim()
  const normalizedDraftUserAvatar = draftUserAvatar.trim()
  const normalizedDraftUserProfile = draftUserProfile.trim()
  const isProfileDirty =
    Boolean(profile) &&
    (normalizedDraftUserName !== profile.userName ||
      normalizedDraftUserAvatar !== profile.userAvatar ||
      normalizedDraftUserProfile !== profile.userProfile)
  const canLoadMore = photos.length < photoTotal
  const pageTitle = isMe ? "我的主页" : "摄影师主页"
  const pageDescription = isMe
    ? "在这里维护个人资料，查看作品状态，并继续管理你的影像档案。"
    : "浏览这位摄影师公开展示的作品与基础资料。"
  const stats = useMemo(
    () => (profile ? (isMe ? buildPrivateStats(profile, photoTotal) : buildPublicStats(profile, photoTotal)) : []),
    [isMe, photoTotal, profile],
  )

  const clearSelectedPhoto = useCallback(() => {
    setSelectedPhotoId(null)
    setSelectedPhotoDetail(null)
    setSelectedPhotoError(null)
    setIsPreviewLoading(false)
    setIsDeletingPreviewPhoto(false)
  }, [])

  const handlePhotographerNavigation = useCallback(
    (photo: Photo) => {
      if (photo.userId) {
        onNavigateToUser(photo.userId)
      }
    },
    [onNavigateToUser],
  )

  const updateProfileAfterDeletion = useCallback(
    (deletedPhoto: Photo) => {
      setProfile((currentProfile) => {
        if (!currentProfile) {
          return currentProfile
        }

        const nextProfile = {
          ...currentProfile,
          pictureCount: decrementCount(currentProfile.pictureCount),
          approvedPictureCount:
            deletedPhoto.reviewStatus === 1 ? decrementCount(currentProfile.approvedPictureCount) : currentProfile.approvedPictureCount,
        }

        if (isMe) {
          if (deletedPhoto.reviewStatus === 0) {
            nextProfile.pendingPictureCount = decrementCount(currentProfile.pendingPictureCount)
          }
          if (deletedPhoto.reviewStatus === 2) {
            nextProfile.rejectedPictureCount = decrementCount(currentProfile.rejectedPictureCount)
          }
        }

        return nextProfile
      })
    },
    [isMe],
  )

  const loadPhotosPage = useCallback(
    async ({ append, pageNum, reset = false }: { append: boolean; pageNum: number; reset?: boolean }) => {
      if (!resolvedUserId) {
        return
      }

      const requestId = ++photosRequestIdRef.current

      if (append) {
        setIsLoadingMore(true)
      } else {
        if (reset) {
          clearSelectedPhoto()
          setPhotos([])
          setPhotoPageNum(1)
          setPhotoTotal(0)
        }
        setPhotosLoadState("loading")
        setPhotoError(null)
      }

      try {
        const result = isMe
          ? await listMyPictures({
              pageNum,
              pageSize: PHOTO_PAGE_SIZE,
              reviewStatus: activeReviewStatus,
            })
          : await listPictures({
              pageNum,
              pageSize: PHOTO_PAGE_SIZE,
              userId: resolvedUserId,
            })

        if (photosRequestIdRef.current !== requestId) {
          return
        }

        const nextPhotos = result.list.map((photo) => normalizePhotoOwner(photo, resolvedUserId))

        setPhotos((currentPhotos) => {
          if (!append) {
            return nextPhotos
          }

          const existingIds = new Set(currentPhotos.map((photo) => photo.id))

          return [...currentPhotos, ...nextPhotos.filter((photo) => !existingIds.has(photo.id))]
        })
        setPhotoPageNum(result.pageNum)
        setPhotoTotal(result.total)
        setPhotosLoadState("ready")
      } catch (error) {
        if (photosRequestIdRef.current !== requestId) {
          return
        }

        setPhotosLoadState("error")
        setPhotoError(getErrorMessage(error, PHOTOS_DEFAULT_ERROR))
      } finally {
        if (photosRequestIdRef.current === requestId) {
          setIsLoadingMore(false)
        }
      }
    },
    [activeReviewStatus, clearSelectedPhoto, isMe, resolvedUserId],
  )

  const openPhoto = useCallback((photo: Photo) => {
    const cachedPhotoDetail = detailCacheRef.current.get(photo.id)

    setSelectedPhotoDetail(cachedPhotoDetail ?? photo)
    setSelectedPhotoError(null)
    setIsPreviewLoading(!cachedPhotoDetail)
    setSelectedPhotoId(photo.id)
    preloadImage(cachedPhotoDetail?.src ?? photo.src)
  }, [])

  useEffect(() => {
    if (!resolvedUserId) {
      return
    }

    let isCancelled = false

    const load = async () => {
      setProfileLoadState("loading")
      setProfileError(null)
      setActionNotice(null)
      setProfileFormError(null)

      try {
        const nextProfile = isMe ? await getMyProfile() : await getUserProfile(resolvedUserId)

        if (isCancelled) {
          return
        }

        setProfile(nextProfile)
        setDraftUserName(nextProfile.userName)
        setDraftUserAvatar(nextProfile.userAvatar)
        setDraftUserProfile(nextProfile.userProfile)
        setProfileLoadState("ready")
      } catch (error) {
        if (isCancelled) {
          return
        }

        setProfileLoadState("error")
        setProfileError(getErrorMessage(error, PROFILE_DEFAULT_ERROR))
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [isMe, resolvedUserId])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadPhotosPage({ append: false, pageNum: 1, reset: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [loadPhotosPage, resolvedUserId])

  useEffect(() => {
    if (!selectedPhotoId) {
      return
    }

    const cachedPhotoDetail = detailCacheRef.current.get(selectedPhotoId)

    if (cachedPhotoDetail) {
      setSelectedPhotoDetail(cachedPhotoDetail)
      setIsPreviewLoading(false)
      return
    }

    let isCancelled = false

    const load = async () => {
      try {
        const nextPhoto = await getPictureDetail(selectedPhotoId)

        if (isCancelled) {
          return
        }

        const normalizedPhoto = normalizePhotoOwner(
          nextPhoto,
          nextPhoto.userId ?? resolvedUserId ?? nextPhoto.id,
          profile?.userName,
        )

        detailCacheRef.current.set(normalizedPhoto.id, normalizedPhoto)
        setSelectedPhotoDetail(normalizedPhoto)
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

    void load()

    return () => {
      isCancelled = true
    }
  }, [profile?.userName, resolvedUserId, selectedPhotoId])

  const handleSaveProfile = useCallback(async () => {
    if (!normalizedDraftUserName) {
      setProfileFormError("昵称不能为空。")
      return
    }

    setIsSavingProfile(true)
    setProfileFormError(null)
    setActionNotice(null)

    try {
      const nextProfile = await updateMyProfile({
        userName: draftUserName,
        userAvatar: draftUserAvatar,
        userProfile: draftUserProfile,
      })

      setProfile(nextProfile)
      setDraftUserName(nextProfile.userName)
      setDraftUserAvatar(nextProfile.userAvatar)
      setDraftUserProfile(nextProfile.userProfile)
      updateUser({
        userAvatar: nextProfile.userAvatar,
        userName: nextProfile.userName,
        userProfile: nextProfile.userProfile,
      })
      setIsEditingProfile(false)
      setActionNotice("个人资料已更新。")
    } catch (error) {
      setProfileFormError(getErrorMessage(error, "更新资料失败。"))
    } finally {
      setIsSavingProfile(false)
    }
  }, [draftUserAvatar, draftUserName, draftUserProfile, normalizedDraftUserName, updateUser])

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

      detailCacheRef.current.delete(deletedPicture.id)
      setPhotos((currentPhotos) => currentPhotos.filter((photo) => photo.id !== deletedPicture.id))
      setPhotoTotal((currentTotal) => Math.max(0, currentTotal - 1))
      updateProfileAfterDeletion(previewPhoto)
      setActionNotice(`已删除图片 ${previewPhoto.alt}。`)
      clearSelectedPhoto()
    } catch (error) {
      setSelectedPhotoError(getErrorMessage(error, "删除图片失败。"))
      setIsDeletingPreviewPhoto(false)
    }
  }, [clearSelectedPhoto, previewPhoto, updateProfileAfterDeletion])

  const handleLoadMore = useCallback(() => {
    if (!canLoadMore || isLoadingMore) {
      return
    }

    void loadPhotosPage({ append: true, pageNum: photoPageNum + 1 })
  }, [canLoadMore, isLoadingMore, loadPhotosPage, photoPageNum])

  if (profileLoadState === "loading") {
    return (
      <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 px-6 py-16 text-center text-sm text-muted-foreground">
          正在加载用户资料...
        </div>
      </section>
    )
  }

  if (profileLoadState === "error" || !profile) {
    return (
      <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
        <div className="rounded-[1.5rem] border border-destructive/16 bg-destructive/6 px-6 py-16 text-center text-sm text-destructive">
          {profileError ?? "用户不存在或不可访问。"}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
      {actionNotice ? (
        <div className="mb-4 rounded-[1.5rem] border border-emerald-500/16 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88">
          {actionNotice}
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-border/70 bg-white/92 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border border-border/70 bg-secondary/35 text-muted-foreground shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              {profile.userAvatar ? (
                <img
                  src={profile.userAvatar}
                  alt=""
                  width={96}
                  height={96}
                  loading="eager"
                  decoding="async"
                  className="size-full object-cover"
                />
              ) : (
                <UserIcon className="size-10" />
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="eyebrow-label">{pageTitle}</p>
                <h2 className="text-[2.3rem] font-medium tracking-[-0.05em] text-foreground">{profile.userName}</h2>
                <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">{pageDescription}</p>
              </div>

              {isEditingProfile ? (
                <div className="grid gap-4 md:max-w-[640px]">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">昵称</span>
                    <input
                      type="text"
                      value={draftUserName}
                      onChange={(event) => setDraftUserName(event.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">头像地址</span>
                    <input
                      type="text"
                      value={draftUserAvatar}
                      onChange={(event) => setDraftUserAvatar(event.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">个人简介</span>
                    <textarea
                      value={draftUserProfile}
                      onChange={(event) => setDraftUserProfile(event.target.value)}
                      className="min-h-28 w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                    />
                  </label>
                  {profileFormError ? (
                    <div className="rounded-[1.25rem] border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                      {profileFormError}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="max-w-[60ch] space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-neutral-600">
                    <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.18em]">
                      {profile.userRole === "admin" ? "管理员" : "摄影师"}
                    </span>
                    {profile.createTime ? (
                      <span className="rounded-full border border-black/8 bg-neutral-950/[0.03] px-3 py-1 tracking-[0.12em]">
                        {profile.createTime.slice(0, 10)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {profile.userProfile || "这个用户暂时还没有填写个人简介。"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {isMe ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              {isEditingProfile ? (
                <>
                  <Button onClick={() => void handleSaveProfile()} disabled={isSavingProfile || !isProfileDirty}>
                    {isSavingProfile ? "保存中..." : "保存资料"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraftUserName(profile.userName)
                      setDraftUserAvatar(profile.userAvatar)
                      setDraftUserProfile(profile.userProfile)
                      setProfileFormError(null)
                      setIsEditingProfile(false)
                    }}
                    disabled={isSavingProfile}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
                  <PencilLine className="size-4" />
                  编辑资料
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[1.5rem] border border-border/70 bg-white/88 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]"
          >
            <p className="eyebrow-label">{stat.label}</p>
            <p className="mt-3 text-[1.55rem] font-medium tracking-[-0.04em] text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-white/88 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow-label">{isMe ? "作品管理" : "公开作品"}</p>
            <h3 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-foreground">
              {isMe ? "管理你的作品与状态" : "浏览这位摄影师的公开作品"}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            当前已加载 {displayedPhotos.length} / {photoTotal} 幅
          </p>
        </div>

        {isMe ? (
          <div className="flex flex-wrap gap-2">
            {PRIVATE_REVIEW_FILTERS.map((filter) => {
              const isActive = filter.value === activeReviewStatus

              return (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => setActiveReviewStatus(filter.value)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-foreground text-background"
                      : "border border-border/70 bg-white text-foreground/74 hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        ) : null}

        {photosLoadState === "loading" ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-card/70 px-6 py-16 text-center text-sm text-muted-foreground">
            正在加载作品...
          </div>
        ) : null}

        {photosLoadState === "error" ? (
          <div className="rounded-[1.5rem] border border-destructive/16 bg-destructive/6 px-6 py-10 text-center text-sm text-destructive">
            <p>{photoError ?? PHOTOS_DEFAULT_ERROR}</p>
            <Button className="mt-4" variant="outline" onClick={() => void loadPhotosPage({ append: false, pageNum: 1 })}>
              重新加载
            </Button>
          </div>
        ) : null}

        {photosLoadState === "ready" && !displayedPhotos.length ? (
          <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-secondary/20 px-6 py-16 text-center text-sm text-muted-foreground">
            {isMe ? "你还没有符合当前筛选条件的作品。" : "这位摄影师暂时还没有公开作品。"}
          </div>
        ) : null}

        {displayedPhotos.length ? (
          <PhotoGrid
            photos={displayedPhotos}
            onPhotoClick={openPhoto}
            onPhotographerClick={handlePhotographerNavigation}
          />
        ) : null}

        {photosLoadState === "ready" && canLoadMore ? (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? "加载中..." : "加载更多"}
            </Button>
          </div>
        ) : null}
      </div>

      {previewPhoto ? (
        <PhotoPreviewOverlay
          photo={previewPhoto}
          photos={displayedPhotos}
          onClose={clearSelectedPhoto}
          onDelete={() => void handleDeletePreviewPhoto()}
          onPhotographerClick={handlePhotographerNavigation}
          onSelect={openPhoto}
          canDelete={canDeletePreviewPhoto}
          isDeleting={isDeletingPreviewPhoto}
          isLoading={isPreviewLoading}
          errorMessage={selectedPhotoError}
        />
      ) : null}
    </section>
  )
}

```

`components/ui/button.tsx`:

```tsx
import {Button as ButtonPrimitive} from "@base-ui/react/button"
import {cva, type VariantProps} from "class-variance-authority"

import {cn} from "@/lib/utils"

const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
                outline:
                    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
                ghost:
                    "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
                destructive:
                    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default:
                    "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                icon: "size-8",
                "icon-xs":
                    "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
                "icon-sm":
                    "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
                "icon-lg": "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

function Button({
                    className,
                    variant = "default",
                    size = "default",
                    ...props
                }: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
    return (
        <ButtonPrimitive
            data-slot="button"
            className={cn(buttonVariants({variant, size, className}))}
            {...props}
        />
    )
}

export {Button}

```

`contexts/AuthContext.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import type { LoginResult } from "@/lib/auth-api"
import {
  AUTH_UNAUTHORIZED_EVENT,
  AuthContext,
  TOKEN_KEY,
  USER_KEY,
  type AuthUser,
  clearStoredAuth,
  readStoredUser,
  type AuthContextValue,
} from "@/contexts/auth-context"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(readStoredUser)

  const login = useCallback((result: LoginResult) => {
    localStorage.setItem(TOKEN_KEY, result.token)
    setUser({
      id: result.id,
      userAccount: result.userAccount,
      userName: result.userName,
      userAvatar: result.userAvatar,
      userProfile: result.userProfile,
      userRole: result.userRole,
    })
  }, [])

  const logout = useCallback(() => {
    clearStoredAuth()
    setUser(null)
  }, [])

  const updateUser = useCallback((nextUser: Partial<AuthUser>) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...nextUser } : currentUser))
  }, [])

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }, [user])

  useEffect(() => {
    const handleUnauthorized = () => {
      logout()
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)

    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [logout])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoggedIn: user !== null, login, logout, updateUser }),
    [user, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

```

`contexts/auth-context.ts`:

```ts
import { createContext, useContext } from "react"

import type { LoginResult } from "@/lib/auth-api"

export interface AuthUser {
  id: string
  userAccount: string
  userName: string
  userAvatar: string
  userProfile: string
  userRole: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoggedIn: boolean
  login: (result: LoginResult) => void
  logout: () => void
  updateUser: (nextUser: Partial<AuthUser>) => void
}

export const TOKEN_KEY = "token"
export const USER_KEY = "auth_user"
export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized"

export const AuthContext = createContext<AuthContextValue | null>(null)

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}

```

`data/photos.ts`:

```ts
export const categories = [
  "all",
  "nature",
  "architecture",
  "portrait",
  "street",
  "abstract",
] as const

export type Category = (typeof categories)[number]

export const categoryLabels: Record<Category, string> = {
  all: "全部",
  nature: "自然",
  architecture: "建筑",
  portrait: "人像",
  street: "街头",
  abstract: "抽象",
}

```

`index.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-display);
    --font-sans: 'Geist Variable', sans-serif;
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
    --font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
    --background: oklch(0.985 0.004 84);
    --foreground: oklch(0.19 0.008 84);
    --card: oklch(0.972 0.003 84);
    --card-foreground: oklch(0.19 0.008 84);
    --popover: oklch(0.985 0.004 84);
    --popover-foreground: oklch(0.19 0.008 84);
    --primary: oklch(0.21 0.012 84);
    --primary-foreground: oklch(0.985 0.004 84);
    --secondary: oklch(0.95 0.004 84);
    --secondary-foreground: oklch(0.21 0.012 84);
    --muted: oklch(0.945 0.003 84);
    --muted-foreground: oklch(0.46 0.008 84);
    --accent: oklch(0.77 0.028 76);
    --accent-foreground: oklch(0.18 0.012 84);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.88 0.004 84);
    --input: oklch(0.88 0.004 84);
    --ring: oklch(0.72 0.024 76);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --radius: 1.5rem;
    --sidebar: oklch(0.972 0.003 84);
    --sidebar-foreground: oklch(0.19 0.008 84);
    --sidebar-primary: oklch(0.21 0.012 84);
    --sidebar-primary-foreground: oklch(0.985 0.004 84);
    --sidebar-accent: oklch(0.95 0.004 84);
    --sidebar-accent-foreground: oklch(0.21 0.012 84);
    --sidebar-border: oklch(0.88 0.004 84);
    --sidebar-ring: oklch(0.72 0.024 76);
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    @apply font-sans;
    overflow-y: scroll;
    scroll-behavior: smooth;
    scrollbar-gutter: stable;
  }
  body {
    @apply bg-background text-foreground;
    min-height: 100vh;
    background:
      radial-gradient(circle at top, oklch(0.99 0.01 84), transparent 32%),
      linear-gradient(180deg, oklch(0.985 0.004 84), oklch(0.965 0.004 84));
    text-rendering: optimizeLegibility;
  }
  #root {
    min-height: 100vh;
  }
  button {
    cursor: pointer;
  }
  img {
    display: block;
  }
}

@utility no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

@utility eyebrow-label {
  color: color-mix(in oklab, var(--muted-foreground) 88%, white 12%);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  line-height: 1;
}

@utility surface-chip {
  border: 1px solid color-mix(in oklab, var(--border) 88%, white 12%);
  background: color-mix(in oklab, var(--background) 82%, white 18%);
  border-radius: 9999px;
  color: color-mix(in oklab, var(--muted-foreground) 90%, white 10%);
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.85rem;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

@utility tag-chip-muted {
  border: 1px solid color-mix(in oklab, var(--border) 85%, white 15%);
  background: color-mix(in oklab, var(--card) 82%, white 18%);
  border-radius: 9999px;
  color: color-mix(in oklab, var(--muted-foreground) 90%, white 10%);
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.8rem;
  font-size: 0.78rem;
  line-height: 1;
}

.home-card-sphere-section {
  position: relative;
  isolation: isolate;
  min-height: 60rem;
  padding-block: 6rem;
  --sphere-bg: oklch(0.968 0.007 84);
  background:
    linear-gradient(180deg, color-mix(in oklab, var(--sphere-bg) 94%, white 6%), color-mix(in oklab, var(--sphere-bg) 88%, black 12%));
}

.home-card-sphere-section::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(246, 242, 235, 0.78), transparent 10%, transparent 90%, rgba(246, 242, 235, 0.78));
  pointer-events: none;
}

.home-card-sphere-viewport {
  position: relative;
  min-height: 42rem;
  width: 100%;
  perspective: 1460px;
  perspective-origin: 50% 50%;
  transform-style: preserve-3d;
  touch-action: none;
  user-select: none;
  cursor: grab;
  isolation: isolate;
  --sphere-radius: 346px;
  --sphere-diameter: 692px;
  --sphere-card-size: 64px;
}

.home-card-sphere-viewport:active {
  cursor: grabbing;
}

.home-card-sphere-orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform: translate3d(-50%, -50%, 0);
  transform-style: preserve-3d;
  will-change: transform;
}

.home-card-sphere-node {
  position: absolute;
  top: calc(var(--sphere-card-size) * -0.5);
  left: calc(var(--sphere-card-size) * -0.5);
  width: var(--sphere-card-size);
  height: var(--sphere-card-size);
  transform-style: preserve-3d;
  transform: rotateY(var(--sphere-lon)) rotateX(var(--sphere-lat)) translateZ(var(--sphere-radius));
}

.home-card-sphere-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.home-card-sphere-card-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 0.72rem;
  border: 1px solid rgba(255, 255, 255, 0.46);
  background: rgba(255, 255, 255, 0.42);
  box-shadow: 0 8px 16px rgba(28, 24, 19, 0.06);
  backface-visibility: hidden;
  transform-style: preserve-3d;
  transition:
    transform 180ms ease-out,
    box-shadow 180ms ease-out,
    filter 180ms ease-out;
}

.home-card-sphere-card-face--back {
  transform: rotateY(180deg);
}

.home-card-sphere-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
}

.home-card-sphere-node:hover .home-card-sphere-card-face,
.home-card-sphere-node:focus-within .home-card-sphere-card-face {
  transform: scale(1.03);
  box-shadow: 0 10px 18px rgba(28, 24, 19, 0.09);
  filter: brightness(1.05);
}

.home-card-sphere-node:hover .home-card-sphere-card-face--back,
.home-card-sphere-node:focus-within .home-card-sphere-card-face--back {
  transform: rotateY(180deg) scale(1.03);
}

@media (max-width: 1100px) {
  .home-card-sphere-section {
    min-height: 52rem;
    padding-block: 5rem;
  }

  .home-card-sphere-viewport {
    min-height: 36rem;
  }
}

@media (max-width: 780px) {
  .home-card-sphere-section {
    min-height: 42rem;
    padding-block: 4rem;
  }

  .home-card-sphere-viewport {
    min-height: 28rem;
  }
}

@media (max-width: 640px) {
  .home-card-sphere-section {
    min-height: 34rem;
    padding-block: 3rem;
  }

  .home-card-sphere-viewport {
    min-height: 22rem;
  }
}

```

`lib/admin-picture-api.ts`:

```ts
import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import { normalizeEntityId, stringifyEntityId } from "@/lib/entity-id"
import { trimToUndefined } from "@/lib/text"

export interface AdminPictureUserSummary {
  id: string
  userName: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
}

export interface AdminPictureRecord {
  id: string
  url: string
  thumbnailUrl?: string
  name?: string
  introduction?: string
  category?: string
  tags: string[]
  picWidth?: number
  picHeight?: number
  reviewStatus?: number
  reviewMessage?: string
  reviewerId?: string
  reviewTime?: string
  userId?: string
  user?: AdminPictureUserSummary
  createTime?: string
  updateTime?: string
}

interface BackendAdminPictureUserSummary extends Omit<AdminPictureUserSummary, "id" | "userName"> {
  id: string | number
  userName?: string
}

interface BackendAdminPictureRecord
  extends Omit<AdminPictureRecord, "id" | "reviewerId" | "tags" | "userId" | "user"> {
  id: string | number
  reviewerId?: string | number
  tags?: string[] | string
  userId?: string | number
  user?: BackendAdminPictureUserSummary
}

interface AdminPicturePageEnvelope {
  pageNum: number
  pageSize: number
  total: number
  list: BackendAdminPictureRecord[]
}

export interface ListAdminPicturesParams {
  pageNum?: number
  pageSize?: number
  reviewStatus?: number
  category?: string
  userId?: string | number
  searchText?: string
}

export interface AdminPicturePage {
  pageNum: number
  pageSize: number
  total: number
  list: AdminPictureRecord[]
}

export interface ReviewPictureParams {
  id: string
  reviewStatus: 1 | 2
  reviewMessage?: string
}

const DEFAULT_PAGE_NUM = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 20
const FALLBACK_USER_NAME = "未命名用户"

function parseTags(tags?: string[] | string): string[] {
  if (Array.isArray(tags)) {
    return tags.filter(Boolean)
  }

  if (typeof tags !== "string" || !tags.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(tags) as unknown

    return Array.isArray(parsed) ? parsed.map((tag) => String(tag).trim()).filter(Boolean) : []
  } catch {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
}

function mapAdminPictureUserSummary(user?: BackendAdminPictureUserSummary): AdminPictureUserSummary | undefined {
  if (!user) {
    return undefined
  }

  return {
    id: normalizeEntityId(user.id, "用户 ID 非法"),
    userName: trimToUndefined(user.userName) ?? FALLBACK_USER_NAME,
    userAvatar: trimToUndefined(user.userAvatar),
    userProfile: trimToUndefined(user.userProfile),
    userRole: trimToUndefined(user.userRole),
  }
}

function mapAdminPictureRecord(picture: BackendAdminPictureRecord): AdminPictureRecord {
  return {
    ...picture,
    id: normalizeEntityId(picture.id, "图片 ID 非法"),
    reviewerId: picture.reviewerId !== undefined ? stringifyEntityId(picture.reviewerId) : undefined,
    tags: parseTags(picture.tags),
    userId: picture.userId !== undefined ? stringifyEntityId(picture.userId) : undefined,
    user: mapAdminPictureUserSummary(picture.user),
  }
}

export async function listAdminPictures(
  params: ListAdminPicturesParams = {},
): Promise<AdminPicturePage> {
  const payload: Record<string, unknown> = {
    pageNum: params.pageNum ?? DEFAULT_PAGE_NUM,
    pageSize: Math.min(params.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }

  if (params.reviewStatus !== undefined) {
    payload.reviewStatus = params.reviewStatus
  }

  if (params.category) {
    payload.category = params.category
  }

  if (params.userId !== undefined) {
    payload.userId = stringifyEntityId(params.userId)
  }

  if (params.searchText) {
    payload.searchText = params.searchText
  }

  const { data } = await request.post<ApiEnvelope<AdminPicturePageEnvelope>>("/api/picture/list/page", payload)
  const result = unwrapApiResponse(data)

  return {
    pageNum: result.data.pageNum,
    pageSize: result.data.pageSize,
    total: result.data.total,
    list: result.data.list.map(mapAdminPictureRecord),
  }
}

export async function getAdminPictureDetail(id: string | number): Promise<AdminPictureRecord> {
  const { data } = await request.get<ApiEnvelope<BackendAdminPictureRecord>>("/api/picture/get", {
    params: { id: normalizeEntityId(id, "图片 ID 非法") },
  })
  const result = unwrapApiResponse(data)

  return mapAdminPictureRecord(result.data)
}

export async function reviewPicture(params: ReviewPictureParams): Promise<AdminPictureRecord> {
  const { data } = await request.post<ApiEnvelope<BackendAdminPictureRecord>>("/api/picture/review", params)
  const result = unwrapApiResponse(data)

  return mapAdminPictureRecord(result.data)
}

```

`lib/auth-api.ts`:

```ts
import request, { unwrapApiResponse, type ApiEnvelope, type ApiResult } from "@/lib/request"

export interface LoginParams {
  userEmail: string
  userPassword: string
}

export interface RegisterParams {
  userEmail: string
  userPassword: string
  userCheckPassword: string
}

export interface LoginResult {
  token: string
  id: string
  userAccount: string
  userName: string
  userAvatar: string
  userProfile: string
  userRole: string
  createTime: string
  updateTime: string
}

export interface RegisterResult {
  id: string
}

export type AuthActionResult<T> = ApiResult<T>

export async function login(params: LoginParams): Promise<AuthActionResult<LoginResult>> {
  const { data } = await request.post<ApiEnvelope<LoginResult>>("/api/user/login", params)
  return unwrapApiResponse(data)
}

export async function register(params: RegisterParams): Promise<AuthActionResult<RegisterResult>> {
  const { data } = await request.post<ApiEnvelope<RegisterResult>>("/api/user/register", params)
  return unwrapApiResponse(data)
}

```

`lib/backend-picture.ts`:

```ts
import { normalizeEntityId, stringifyEntityId } from "@/lib/entity-id"
import { trimToUndefined } from "@/lib/text"
import type { Photo } from "@/types/photo"

export interface BackendPictureUser {
  id: string | number
  userName: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
}

export interface BackendPicture {
  id: string | number
  url: string
  thumbnailUrl?: string
  name?: string
  introduction?: string
  category?: string
  tags?: string[]
  picSize?: number
  picWidth?: number
  picHeight?: number
  picScale?: number
  picFormat?: string
  userId?: string | number
  user?: BackendPictureUser
  createTime?: string
  editTime?: string
  updateTime?: string
  reviewStatus?: number
  reviewMessage?: string
  reviewerId?: string | number
  reviewTime?: string
  picColor?: string
  viewCount?: number
  likeCount?: number
}

export interface BackendPicturePage {
  pageNum: number
  pageSize: number
  total: number
  list: BackendPicture[]
}

const FALLBACK_PHOTO_NAME = "Untitled"
const FALLBACK_USER_NAME = "Unknown"
const FALLBACK_CATEGORY = "uncategorized"
const FALLBACK_CATEGORY_LABEL = "未分类"
const FALLBACK_SUMMARY = "No description yet."

export function normalizePictureTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return []
  }

  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
}

function toPhotoCategory(category?: string | null) {
  return trimToUndefined(category) ?? FALLBACK_CATEGORY
}

function toPhotoCategoryLabel(category: string) {
  return category === FALLBACK_CATEGORY ? FALLBACK_CATEGORY_LABEL : category
}

export function mapBackendPictureToPhoto(picture: BackendPicture): Photo {
  const category = toPhotoCategory(picture.category)
  const url = trimToUndefined(picture.url) ?? trimToUndefined(picture.thumbnailUrl) ?? ""
  const thumbnailUrl = trimToUndefined(picture.thumbnailUrl) ?? url

  return {
    id: normalizeEntityId(picture.id, "图片 ID 非法"),
    src: url,
    thumbnailSrc: thumbnailUrl,
    width: picture.picWidth && picture.picWidth > 0 ? picture.picWidth : 1,
    height: picture.picHeight && picture.picHeight > 0 ? picture.picHeight : 1,
    alt: trimToUndefined(picture.name) ?? FALLBACK_PHOTO_NAME,
    photographer: trimToUndefined(picture.user?.userName) ?? FALLBACK_USER_NAME,
    category,
    categoryLabel: toPhotoCategoryLabel(category),
    summary: trimToUndefined(picture.introduction) ?? FALLBACK_SUMMARY,
    location: trimToUndefined(picture.createTime) ?? "",
    tags: normalizePictureTags(picture.tags),
    format: trimToUndefined(picture.picFormat)?.toUpperCase(),
    dominantColor: trimToUndefined(picture.picColor),
    viewCount: picture.viewCount ?? 0,
    likeCount: picture.likeCount ?? 0,
    createdAt: trimToUndefined(picture.createTime),
    updatedAt: trimToUndefined(picture.updateTime),
    reviewStatus: picture.reviewStatus,
    reviewMessage: trimToUndefined(picture.reviewMessage),
    userId: picture.userId !== undefined ? stringifyEntityId(picture.userId) : undefined,
  }
}

```

`lib/entity-id.ts`:

```ts
export type EntityId = string

function toTrimmedString(value: string | number) {
  return typeof value === "string" ? value.trim() : String(value)
}

export function stringifyEntityId(value: string | number) {
  return toTrimmedString(value)
}

export function normalizeEntityId(value: string | number, errorMessage = "参数错误"): EntityId {
  const normalizedValue = toTrimmedString(value)

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(errorMessage)
  }

  return normalizedValue
}

```

`lib/gallery-layout.ts`:

```ts
export interface LayoutPhoto {
  id: string
  width: number
  height: number
}

export interface LayoutOptions {
  containerWidth: number
  gap: number
  targetRowHeight: number
  minRowHeight: number
  maxRowHeight: number
}

export interface JustifiedRow<T extends LayoutPhoto> {
  photos: T[]
  height: number
  width: number
  isLastRow: boolean
}

function getAspectRatio(photo: LayoutPhoto) {
  return photo.width / photo.height
}

function getFittedHeight(photos: LayoutPhoto[], containerWidth: number, gap: number) {
  const ratioSum = photos.reduce((sum, photo) => sum + getAspectRatio(photo), 0)

  return (containerWidth - gap * (photos.length - 1)) / ratioSum
}

function getRenderedWidth(photos: LayoutPhoto[], height: number, gap: number) {
  const contentWidth = photos.reduce((sum, photo) => sum + getAspectRatio(photo) * height, 0)

  return contentWidth + gap * (photos.length - 1)
}

function getMaxItemsPerRow(containerWidth: number) {
  if (containerWidth < 768) return 2
  if (containerWidth < 1180) return 3
  return 5
}

function getLastRowMetrics(
  photos: LayoutPhoto[],
  containerWidth: number,
  gap: number,
  targetRowHeight: number
) {
  const naturalWidthAtTarget = getRenderedWidth(photos, targetRowHeight, gap)

  if (naturalWidthAtTarget <= containerWidth) {
    return {
      height: targetRowHeight,
      width: naturalWidthAtTarget,
    }
  }

  const fittedHeight = getFittedHeight(photos, containerWidth, gap)

  return {
    height: fittedHeight,
    width: containerWidth,
  }
}

export function buildJustifiedRows<T extends LayoutPhoto>(
  photos: T[],
  options: LayoutOptions
): JustifiedRow<T>[] {
  const { containerWidth, gap, targetRowHeight, minRowHeight, maxRowHeight } = options

  if (!photos.length || containerWidth <= 0) {
    return []
  }

  const maxItemsPerRow = getMaxItemsPerRow(containerWidth)
  const costs = new Array<number>(photos.length + 1).fill(Number.POSITIVE_INFINITY)
  const nextBreak = new Array<number>(photos.length).fill(photos.length)

  costs[photos.length] = 0

  for (let start = photos.length - 1; start >= 0; start -= 1) {
    const maxEnd = Math.min(photos.length, start + maxItemsPerRow)

    for (let end = start + 1; end <= maxEnd; end += 1) {
      const rowPhotos = photos.slice(start, end)
      const isLastRow = end === photos.length
      const filledHeight = getFittedHeight(rowPhotos, containerWidth, gap)
      const rowMetrics = isLastRow
        ? getLastRowMetrics(rowPhotos, containerWidth, gap, targetRowHeight)
        : { height: filledHeight, width: containerWidth }
      const rowHeight = rowMetrics.height
      const rowWidth = rowMetrics.width

      const rangePenalty =
        rowHeight < minRowHeight
          ? (minRowHeight - rowHeight) * (isLastRow ? 6 : 10)
          : rowHeight > maxRowHeight
            ? (rowHeight - maxRowHeight) * (isLastRow ? 1.5 : 10)
            : 0
      const targetPenalty = Math.abs(rowHeight - targetRowHeight) * (isLastRow ? 0.45 : 1.2)
      const widthPenalty = isLastRow ? Math.max(0, containerWidth - rowWidth) / 10 : 0
      const densityPenalty =
        rowPhotos.length === 1
          ? isLastRow
            ? 95
            : 180
          : rowPhotos.length === maxItemsPerRow && rowHeight < targetRowHeight
            ? 45
            : 0
      const orphanPenalty = photos.length - end === 1 ? 90 : 0
      const totalCost = targetPenalty + rangePenalty + widthPenalty + densityPenalty + orphanPenalty + costs[end]

      if (totalCost < costs[start]) {
        costs[start] = totalCost
        nextBreak[start] = end
      }
    }
  }

  const rows: JustifiedRow<T>[] = []
  let index = 0

  while (index < photos.length) {
    const next = nextBreak[index]
    const rowPhotos = photos.slice(index, next)
    const isLastRow = next === photos.length
    const filledHeight = getFittedHeight(rowPhotos, containerWidth, gap)
    const rowMetrics = isLastRow
      ? getLastRowMetrics(rowPhotos, containerWidth, gap, targetRowHeight)
      : { height: filledHeight, width: containerWidth }

    rows.push({
      photos: rowPhotos,
      height: rowMetrics.height,
      width: rowMetrics.width,
      isLastRow,
    })

    index = next
  }

  return rows
}

```

`lib/image-preload.ts`:

```ts
const preloadedImageSources = new Set<string>()

export function preloadImage(src?: string | null) {
  if (!src || typeof Image === "undefined" || preloadedImageSources.has(src)) {
    return
  }

  preloadedImageSources.add(src)

  const image = new Image()
  image.decoding = "async"
  image.src = src
}

export function preloadImages(sources: Array<string | null | undefined>) {
  for (const source of sources) {
    preloadImage(source)
  }
}

```

`lib/my-picture-api.ts`:

```ts
import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import {
  type BackendPicturePage,
  mapBackendPictureToPhoto,
} from "@/lib/backend-picture"
import type { Photo } from "@/types/photo"

export interface ListMyPicturesParams {
  pageNum?: number
  pageSize?: number
  reviewStatus?: number
}

export interface ListMyPicturesResult {
  pageNum: number
  pageSize: number
  total: number
  list: Photo[]
}

const DEFAULT_PAGE_NUM = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 20

export async function listMyPictures(params: ListMyPicturesParams = {}): Promise<ListMyPicturesResult> {
  const payload: Record<string, unknown> = {
    pageNum: params.pageNum ?? DEFAULT_PAGE_NUM,
    pageSize: Math.min(params.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }

  if (params.reviewStatus !== undefined) {
    payload.reviewStatus = params.reviewStatus
  }

  const { data } = await request.post<ApiEnvelope<BackendPicturePage>>("/api/picture/my/list/page", payload)
  const result = unwrapApiResponse(data)

  return {
    pageNum: result.data.pageNum,
    pageSize: result.data.pageSize,
    total: result.data.total,
    list: result.data.list.map(mapBackendPictureToPhoto),
  }
}

```

`lib/photo-permissions.ts`:

```ts
import type { AuthUser } from "@/contexts/auth-context"

interface OwnablePicture {
  userId?: string
}

export function canDeletePhoto(user: Pick<AuthUser, "id" | "userRole"> | null, photo: OwnablePicture | null) {
  if (!user || !photo) {
    return false
  }

  if (user.userRole === "admin") {
    return true
  }

  return photo.userId !== undefined && String(photo.userId) === String(user.id)
}

```

`lib/photo-tags.ts`:

```ts
export const PHOTO_CARD_TAG_LIMIT = 2
export const PHOTO_DETAIL_TAG_LIMIT = 3

interface TagDisplayOptions {
  maxVisible?: number
}

export interface TagDisplayResult {
  visibleTags: string[]
  hiddenCount: number
}

export function getTagDisplay(tags: string[], options: TagDisplayOptions = {}): TagDisplayResult {
  const maxVisible = options.maxVisible ?? PHOTO_DETAIL_TAG_LIMIT
  const normalizedTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))

  return {
    visibleTags: normalizedTags.slice(0, maxVisible),
    hiddenCount: Math.max(0, normalizedTags.length - maxVisible),
  }
}

```

`lib/picture-api.ts`:

```ts
import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import {
  type BackendPicture,
  type BackendPicturePage,
  mapBackendPictureToPhoto,
  normalizePictureTags,
} from "@/lib/backend-picture"
import { normalizeEntityId } from "@/lib/entity-id"
import { normalizePictureDeleteId } from "@/lib/picture-delete"
import { trimToUndefined } from "@/lib/text"
import type { Photo } from "@/types/photo"

export interface ListPicturesParams {
  pageNum?: number
  pageSize?: number
  category?: string
  tags?: string[]
  searchText?: string
  userId?: string
}

export interface ListPicturesResult {
  pageNum: number
  pageSize: number
  total: number
  list: Photo[]
}

export interface UploadPictureFileParams {
  file: File
  id?: number | string
  picName?: string
  introduction?: string
  category?: string
  tags?: string[]
}

export interface UploadPictureByUrlParams {
  fileUrl: string
  id?: number | string
  picName?: string
  introduction?: string
  category?: string
  tags?: string[]
}

export interface DeletePictureResult {
  id: string
}

const DEFAULT_PAGE_NUM = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 20
const UPLOAD_REQUEST_TIMEOUT = 60_000

function buildListPayload(params: ListPicturesParams) {
  const payload: Record<string, unknown> = {
    pageNum: params.pageNum ?? DEFAULT_PAGE_NUM,
    pageSize: Math.min(params.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }

  const category = trimToUndefined(params.category)
  const searchText = trimToUndefined(params.searchText)
  const tags = normalizePictureTags(params.tags)
  const userId = params.userId ? normalizeEntityId(params.userId, "用户 ID 非法") : undefined

  if (category) {
    payload.category = category
  }

  if (searchText) {
    payload.searchText = searchText
  }

  if (userId) {
    payload.userId = userId
  }

  if (tags.length) {
    payload.tags = tags
  }

  return payload
}

function appendOptionalText(formData: FormData, key: string, value?: string | null) {
  const normalizedValue = trimToUndefined(value)

  if (normalizedValue) {
    formData.append(key, normalizedValue)
  }
}

export async function listPictures(params: ListPicturesParams = {}): Promise<ListPicturesResult> {
  const { data } = await request.post<ApiEnvelope<BackendPicturePage>>(
    "/api/picture/list/page/vo",
    buildListPayload(params),
  )
  const result = unwrapApiResponse(data)

  return {
    pageNum: result.data.pageNum,
    pageSize: result.data.pageSize,
    total: result.data.total,
    list: result.data.list.map(mapBackendPictureToPhoto),
  }
}

export async function getPictureDetail(id: number | string): Promise<Photo> {
  const { data } = await request.get<ApiEnvelope<BackendPicture>>("/api/picture/get/vo", {
    params: { id: normalizeEntityId(id, "图片 ID 非法") },
  })
  const result = unwrapApiResponse(data)

  return mapBackendPictureToPhoto(result.data)
}

export async function uploadPictureFile(params: UploadPictureFileParams): Promise<Photo> {
  const formData = new FormData()
  const tags = normalizePictureTags(params.tags)

  formData.append("file", params.file)

  if (params.id !== undefined && params.id !== null) {
    formData.append("id", String(params.id))
  }

  appendOptionalText(formData, "picName", params.picName)
  appendOptionalText(formData, "introduction", params.introduction)
  appendOptionalText(formData, "category", params.category)

  if (tags.length) {
    formData.append("tags", JSON.stringify(tags))
  }

  const { data } = await request.post<ApiEnvelope<BackendPicture>>("/api/picture/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: UPLOAD_REQUEST_TIMEOUT,
  })
  const result = unwrapApiResponse(data)

  return mapBackendPictureToPhoto(result.data)
}

export async function uploadPictureByUrl(params: UploadPictureByUrlParams): Promise<Photo> {
  const payload: Record<string, unknown> = {
    fileUrl: params.fileUrl.trim(),
    tags: normalizePictureTags(params.tags),
  }

  if (params.id !== undefined && params.id !== null) {
    payload.id = params.id
  }

  const picName = trimToUndefined(params.picName)
  const introduction = trimToUndefined(params.introduction)
  const category = trimToUndefined(params.category)

  if (picName) {
    payload.picName = picName
  }

  if (introduction) {
    payload.introduction = introduction
  }

  if (category) {
    payload.category = category
  }

  const { data } = await request.post<ApiEnvelope<BackendPicture>>("/api/picture/upload/url", payload, {
    timeout: UPLOAD_REQUEST_TIMEOUT,
  })
  const result = unwrapApiResponse(data)

  return mapBackendPictureToPhoto(result.data)
}

export async function deletePicture(id: number | string): Promise<DeletePictureResult> {
  const normalizedId = normalizePictureDeleteId(id)
  const { data } = await request.post<ApiEnvelope<DeletePictureResult | boolean>>("/api/picture/delete", {
    id: normalizedId,
  })
  const result = unwrapApiResponse(data)

  if (typeof result.data === "boolean") {
    return { id: normalizedId }
  }

  return {
    id: normalizePictureDeleteId(result.data.id),
  }
}

```

`lib/picture-delete.ts`:

```ts
import { normalizeEntityId, type EntityId } from "@/lib/entity-id"

export const DELETE_PICTURE_CONFIRM_MESSAGE =
  "确认删除这张图片？\n删除后前台列表将不再展示，且无法继续查看该图片。"

export function normalizePictureDeleteId(id: number | string) {
  const normalizedId = normalizeEntityId(id, "图片参数错误")

  if (normalizedId === "0") {
    throw new Error("图片参数错误")
  }

  return normalizedId
}

export type PictureId = EntityId

```

`lib/request.ts`:

```ts
import axios from "axios"

import { AUTH_UNAUTHORIZED_EVENT, TOKEN_KEY, clearStoredAuth } from "@/contexts/auth-context"

export const DEFAULT_API_BASE_URL = "http://localhost:8888"
export const DEFAULT_ERROR_MESSAGE = "网络异常，请稍后重试"
export const DEFAULT_UNAUTHORIZED_MESSAGE = "登录已失效，请重新登录"

export interface ApiEnvelope<T> {
  code?: number
  data: T
  message?: string
}

export interface ApiResult<T> {
  data: T
  message: string
}

const SUCCESS_CODES = new Set([0, 200])
const LARGE_INTEGER_ID_FIELD_PATTERN = /"(id|userId|reviewerId)"\s*:\s*(-?\d{16,})/g
const STRINGIFIED_NUMERIC_ID_FIELD_PATTERN = /"(id|userId|reviewerId)"\s*:\s*"(\d+)"/g

export function formatAuthorizationHeader(token: string) {
  const normalizedToken = token.trim()

  if (/^Bearer\s+/i.test(normalizedToken)) {
    return normalizedToken
  }

  return `Bearer ${normalizedToken}`
}

function extractBackendMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    const candidate = record.message ?? record.msg ?? record.error

    if (typeof candidate === "string") {
      return candidate
    }
  }

  return ""
}

function isApiEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "data" in payload &&
      ("code" in payload || "message" in payload),
  )
}

export function parseApiJsonPayload(payload: string) {
  const normalizedPayload = payload.trim()

  if (!normalizedPayload || !/^[[{]/.test(normalizedPayload)) {
    return payload
  }

  const protectedPayload = normalizedPayload.replace(
    LARGE_INTEGER_ID_FIELD_PATTERN,
    (_, key: string, value: string) => `"${key}":"${value}"`,
  )

  return JSON.parse(protectedPayload) as unknown
}

export function stringifyApiJsonPayload(payload: unknown) {
  const jsonPayload = JSON.stringify(payload)

  return jsonPayload.replace(
    STRINGIFIED_NUMERIC_ID_FIELD_PATTERN,
    (_, key: string, value: string) => `"${key}":${value}`,
  )
}

function isFormDataPayload(data: unknown) {
  return typeof FormData !== "undefined" && data instanceof FormData
}

function handleUnauthorized() {
  clearStoredAuth()
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
}

function getApiErrorMessage(codeOrStatus: number | undefined, message: string) {
  if (codeOrStatus === 401) {
    handleUnauthorized()
    return message || DEFAULT_UNAUTHORIZED_MESSAGE
  }

  if (typeof codeOrStatus === "number" && codeOrStatus >= 500) {
    return DEFAULT_ERROR_MESSAGE
  }

  return message || DEFAULT_ERROR_MESSAGE
}

export function unwrapApiResponse<T>(payload: ApiEnvelope<T> | T): ApiResult<T> {
  if (!isApiEnvelope<T>(payload)) {
    return {
      data: payload,
      message: "",
    }
  }

  const message = extractBackendMessage(payload)

  if (typeof payload.code === "number" && !SUCCESS_CODES.has(payload.code)) {
    throw new Error(getApiErrorMessage(payload.code, message))
  }

  return {
    data: payload.data,
    message,
  }
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
  transformRequest: [
    (data) => {
      if (data === null || data === undefined || typeof data === "string") {
        return data
      }

      if (isFormDataPayload(data) || data instanceof URLSearchParams) {
        return data
      }

      if (typeof data === "object") {
        return stringifyApiJsonPayload(data)
      }

      return data
    },
  ],
  transformResponse: [
    (data) => {
      if (typeof data !== "string") {
        return data
      }

      try {
        return parseApiJsonPayload(data)
      } catch {
        return data
      }
    },
  ],
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && config.headers) {
    config.headers.Authorization = formatAuthorizationHeader(token)
  }
  return config
})

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const message = extractBackendMessage(error.response?.data)
      return Promise.reject(new Error(getApiErrorMessage(error.response?.status, message)))
    }

    return Promise.reject(new Error(DEFAULT_ERROR_MESSAGE))
  },
)

export default request

```

`lib/text.ts`:

```ts
export function trimToUndefined(value?: string | null) {
  const normalizedValue = typeof value === "string" ? value.trim() : ""

  return normalizedValue || undefined
}

```

`lib/user-api.ts`:

```ts
import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import { normalizeEntityId } from "@/lib/entity-id"
import { trimToUndefined } from "@/lib/text"

interface BackendUserProfile {
  id: string | number
  userName?: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
  createTime?: string
  updateTime?: string
  pictureCount?: number
  approvedPictureCount?: number
  pendingPictureCount?: number
  rejectedPictureCount?: number
}

export interface UserProfile {
  id: string
  userName: string
  userAvatar: string
  userProfile: string
  userRole: string
  createTime?: string
  updateTime?: string
  pictureCount?: number
  approvedPictureCount?: number
  pendingPictureCount?: number
  rejectedPictureCount?: number
}

export type MyUserProfile = UserProfile

export interface UpdateMyProfileParams {
  userAvatar: string
  userName: string
  userProfile: string
}

const FALLBACK_USER_NAME = "未命名用户"
const FALLBACK_USER_ROLE = "user"

function normalizeCount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function mapUserProfile(profile: BackendUserProfile): UserProfile {
  return {
    id: normalizeEntityId(profile.id, "用户 ID 非法"),
    userName: trimToUndefined(profile.userName) ?? FALLBACK_USER_NAME,
    userAvatar: trimToUndefined(profile.userAvatar) ?? "",
    userProfile: trimToUndefined(profile.userProfile) ?? "",
    userRole: trimToUndefined(profile.userRole) ?? FALLBACK_USER_ROLE,
    createTime: trimToUndefined(profile.createTime),
    updateTime: trimToUndefined(profile.updateTime),
    pictureCount: normalizeCount(profile.pictureCount),
    approvedPictureCount: normalizeCount(profile.approvedPictureCount),
    pendingPictureCount: normalizeCount(profile.pendingPictureCount),
    rejectedPictureCount: normalizeCount(profile.rejectedPictureCount),
  }
}

export async function getMyProfile(): Promise<MyUserProfile> {
  const { data } = await request.get<ApiEnvelope<BackendUserProfile>>("/api/user/my")
  const result = unwrapApiResponse(data)

  return mapUserProfile(result.data)
}

export async function getUserProfile(id: string): Promise<UserProfile> {
  const { data } = await request.get<ApiEnvelope<BackendUserProfile>>("/api/user/get/vo", {
    params: { id: normalizeEntityId(id, "用户 ID 非法") },
  })
  const result = unwrapApiResponse(data)

  return mapUserProfile(result.data)
}

export async function updateMyProfile(params: UpdateMyProfileParams): Promise<MyUserProfile> {
  const payload = {
    userAvatar: params.userAvatar.trim(),
    userName: params.userName.trim(),
    userProfile: params.userProfile.trim(),
  }

  const { data } = await request.patch<ApiEnvelope<BackendUserProfile>>("/api/user/my", payload)
  const result = unwrapApiResponse(data)

  return mapUserProfile(result.data)
}

```

`lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

`main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

```

`test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 1280,
            height: 720,
            x: 0,
            y: 0,
            top: 0,
            right: 1280,
            bottom: 720,
            left: 0,
            toJSON() {
              return this
            },
          },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    )
  }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver

```

`types/photo.ts`:

```ts
export type PhotoCategory = string

export interface Photo {
  id: string
  src: string
  thumbnailSrc?: string
  width: number
  height: number
  alt: string
  photographer: string
  category: PhotoCategory
  categoryLabel?: string
  summary: string
  location: string
  tags: string[]
  format?: string
  dominantColor?: string
  viewCount?: number
  likeCount?: number
  createdAt?: string
  updatedAt?: string
  reviewStatus?: number
  reviewMessage?: string
  userId?: string
}

```