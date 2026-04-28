import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PencilLine, User as UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { preloadImage } from "@/lib/image-preload"
import { canDeletePhoto } from "@/lib/photo-permissions"
import { DELETE_PICTURE_CONFIRM_MESSAGE } from "@/lib/picture-delete"
import { deletePicture, getPictureDetail, listPictures } from "@/lib/picture-api"
import { getMyProfile, getUserProfile, updateMyProfile, uploadMyAvatarFile, type UserProfile } from "@/lib/user-api"
import type { Photo } from "@/types/photo"
import type { PhotoPreviewOriginRect } from "@/types/photo-preview"

import { PhotoGrid } from "./PhotoGrid"
import { PhotoPreviewOverlay } from "./PhotoPreviewOverlay"

type LoadState = "loading" | "ready" | "error"
type UserProfileMode = "me" | "public"

interface UserProfilePageProps {
  mode: UserProfileMode
  userId?: string
  onNavigateToUser: (userId: string) => void
}

const PHOTO_PAGE_SIZE = 20
const PROFILE_DEFAULT_ERROR = "用户资料暂时无法加载。"
const PHOTOS_DEFAULT_ERROR = "作品列表暂时无法加载。"

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
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [draftUserName, setDraftUserName] = useState("")
  const [draftUserAvatar, setDraftUserAvatar] = useState("")
  const [draftUserProfile, setDraftUserProfile] = useState("")
  const [profileFormError, setProfileFormError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [selectedPhotoDetail, setSelectedPhotoDetail] = useState<Photo | null>(null)
  const [selectedPhotoError, setSelectedPhotoError] = useState<string | null>(null)
  const [selectedPhotoOriginRect, setSelectedPhotoOriginRect] = useState<PhotoPreviewOriginRect | null>(null)
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
  const syncDraftProfile = useCallback((nextProfile: UserProfile) => {
    setDraftUserName(nextProfile.userName)
    setDraftUserAvatar(nextProfile.userAvatar)
    setDraftUserProfile(nextProfile.userProfile)
  }, [])
  const isProfileDirty =
    profile !== null &&
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
    setSelectedPhotoOriginRect(null)
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
        const result = await listPictures({
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
    [clearSelectedPhoto, resolvedUserId],
  )

  const openPhoto = useCallback((photo: Photo, originRect?: PhotoPreviewOriginRect) => {
    const cachedPhotoDetail = detailCacheRef.current.get(photo.id)

    setSelectedPhotoDetail(cachedPhotoDetail ?? photo)
    setSelectedPhotoError(null)
    setSelectedPhotoOriginRect(originRect ?? null)
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
        syncDraftProfile(nextProfile)
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
  }, [isMe, resolvedUserId, syncDraftProfile])

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

    if (!profile) {
      setProfileFormError("Profile is unavailable")
      return
    }

    setIsSavingProfile(true)
    setProfileFormError(null)
    setActionNotice(null)

    try {
      const nextProfile = await updateMyProfile({
        id: profile.id,
        userName: draftUserName,
        userAvatar: draftUserAvatar,
        userProfile: draftUserProfile,
      })

      setProfile(nextProfile)
      syncDraftProfile(nextProfile)
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
  }, [draftUserAvatar, draftUserName, draftUserProfile, normalizedDraftUserName, profile, syncDraftProfile, updateUser])

  const handleAvatarUpload = useCallback(
    async (file: File | null) => {
      if (!file) {
        return
      }

      setIsUploadingAvatar(true)
      setProfileFormError(null)
      setActionNotice(null)

      try {
        const nextProfile = await uploadMyAvatarFile(file)

        setProfile(nextProfile)
        setDraftUserAvatar(nextProfile.userAvatar)
        updateUser({
          userAvatar: nextProfile.userAvatar,
          userName: nextProfile.userName,
          userProfile: nextProfile.userProfile,
        })
        setActionNotice("头像已更新。")
      } catch (error) {
        setProfileFormError(getErrorMessage(error, "头像上传失败。"))
      } finally {
        setIsUploadingAvatar(false)
      }
    },
    [updateUser],
  )

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
                    <span className="text-sm font-medium text-foreground">上传头像</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isUploadingAvatar || isSavingProfile}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        void handleAvatarUpload(file)
                        event.target.value = ""
                      }}
                      className="block w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-background disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      仅支持 jpg、jpeg、png、webp，上传后会立即更新你自己的头像。
                    </p>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">头像地址（可选）</span>
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
                  <Button onClick={() => void handleSaveProfile()} disabled={isSavingProfile || isUploadingAvatar || !isProfileDirty}>
                    {isSavingProfile ? "保存中..." : "保存资料"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      syncDraftProfile(profile)
                      setProfileFormError(null)
                      setIsEditingProfile(false)
                    }}
                    disabled={isSavingProfile || isUploadingAvatar}
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
          originRect={selectedPhotoOriginRect}
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
