import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ImageIcon, PencilLine, User as UserIcon } from "lucide-react"

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
type ProfileStatTone = "total" | "approved" | "pending" | "rejected" | "meta"
type MeteredProfileStatTone = Exclude<ProfileStatTone, "total" | "meta">

interface ProfileStat {
  label: string
  value: string
  count?: number
  tone: ProfileStatTone
}

interface UserProfilePageProps {
  mode: UserProfileMode
  userId?: string
  onNavigateToUser: (userId: string) => void
}

const PHOTO_PAGE_SIZE = 20
const PROFILE_DEFAULT_ERROR = "用户资料暂时无法加载。"
const PHOTOS_DEFAULT_ERROR = "作品列表暂时无法加载。"
const PROFILE_MOTION_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] } as const
const PROFILE_REDUCED_MOTION_TRANSITION = { duration: 0.12 } as const
const PROFILE_STATUS_COLORS: Record<ProfileStatTone, string> = {
  total: "oklch(0.28 0.012 84)",
  approved: "oklch(0.53 0.09 154)",
  pending: "oklch(0.64 0.1 76)",
  rejected: "oklch(0.58 0.11 28)",
  meta: "oklch(0.48 0.01 84)",
}
const PROFILE_STATUS_GRADIENTS: Record<MeteredProfileStatTone, string> = {
  approved: "linear-gradient(90deg, oklch(0.67 0.16 164), oklch(0.74 0.13 205))",
  pending: "linear-gradient(90deg, oklch(0.82 0.14 84), oklch(0.78 0.13 42))",
  rejected: "linear-gradient(90deg, oklch(0.68 0.17 24), oklch(0.64 0.15 330))",
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage
}

function buildPublicStats(profile: UserProfile, photoCount: number): ProfileStat[] {
  const approvedCount = profile.approvedPictureCount ?? profile.pictureCount ?? photoCount

  return [
    { label: "已展出", value: String(approvedCount), count: approvedCount, tone: "approved" },
    { label: "身份", value: profile.userRole === "admin" ? "管理员" : "摄影师", tone: "meta" },
    { label: "加入时间", value: profile.createTime?.slice(0, 10) ?? "-", tone: "meta" },
  ]
}

function buildPrivateStats(profile: UserProfile, photoCount: number): ProfileStat[] {
  const totalCount = profile.pictureCount ?? photoCount
  const approvedCount = profile.approvedPictureCount ?? 0
  const pendingCount = profile.pendingPictureCount ?? 0
  const rejectedCount = profile.rejectedPictureCount ?? 0

  return [
    { label: "全部", value: String(totalCount), count: totalCount, tone: "total" },
    { label: "已展出", value: String(approvedCount), count: approvedCount, tone: "approved" },
    { label: "待审核", value: String(pendingCount), count: pendingCount, tone: "pending" },
    { label: "已退回", value: String(rejectedCount), count: rejectedCount, tone: "rejected" },
  ]
}

function getProfileRoleLabel(profile: UserProfile) {
  return profile.userRole === "admin" ? "管理员" : "摄影师"
}

function getProfileJoinedLabel(profile: UserProfile) {
  return profile.createTime?.slice(0, 10) ?? "未记录加入时间"
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

function isMeteredProfileStat(stat: ProfileStat): stat is ProfileStat & { count: number; tone: MeteredProfileStatTone } {
  return stat.tone !== "total" && stat.tone !== "meta" && typeof stat.count === "number"
}

function ProfileStatusMeter({ stats, showMeter }: { stats: ProfileStat[]; showMeter: boolean }) {
  if (!stats.length) {
    return null
  }

  const primaryStat = stats[0]
  const totalCount = stats.find((stat) => stat.tone === "total")?.count ?? 0
  const meteredStats = stats.filter(isMeteredProfileStat)
  const activeSegments = meteredStats.filter((stat) => stat.count > 0)

  return (
    <section aria-labelledby="profile-status-title" className="mt-5 border-y border-border/70 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="profile-status-title" className="eyebrow-label">
            作品状态
          </h2>
          <p className="mt-2 max-w-[13rem] text-xs leading-5 text-muted-foreground">
            {showMeter ? "从上传到展出的当前分布" : "公开展示信息"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-medium leading-none tracking-normal text-foreground">{primaryStat.value}</p>
          <p className="mt-1 text-[0.68rem] text-muted-foreground">{primaryStat.label}</p>
        </div>
      </div>

      {showMeter && totalCount > 0 ? (
        <div
          aria-hidden="true"
          className="profile-status-meter-track relative mt-4 h-3 overflow-hidden rounded-full bg-secondary/65 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08),0_8px_22px_rgba(15,23,42,0.08)]"
          data-testid="profile-status-meter-track"
        >
          <span className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.68_0.17_164_/_0.2),oklch(0.78_0.14_84_/_0.18),oklch(0.66_0.16_330_/_0.18))]" />
          <div className="relative flex h-full gap-px">
            {activeSegments.map((stat) => (
              <span
                key={stat.label}
                className="relative h-full min-w-1 origin-left overflow-hidden rounded-full shadow-[0_0_14px_oklch(0.55_0.11_120_/_0.16)]"
                style={{
                  width: `${Math.max((stat.count / totalCount) * 100, 4)}%`,
                  background: PROFILE_STATUS_GRADIENTS[stat.tone],
                }}
              >
                <span className="profile-status-meter-shine absolute inset-y-0 -left-1/2 w-1/2 bg-[linear-gradient(90deg,transparent,oklch(0.99_0.02_86_/_0.55),transparent)]" />
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <dl className="mt-3 divide-y divide-border/55">
        {stats.map((stat) => (
          <div key={stat.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2.5">
            <dt className="flex min-w-0 items-center gap-2 text-[0.72rem] text-muted-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PROFILE_STATUS_COLORS[stat.tone] }}
                aria-hidden="true"
              />
              <span className="truncate">{stat.label}</span>
            </dt>
            <dd className="text-sm font-medium tracking-normal text-foreground">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function UserProfilePage({ mode, userId, onNavigateToUser }: UserProfilePageProps) {
  const detailCacheRef = useRef(new Map<string, Photo>())
  const photosRequestIdRef = useRef(0)
  const prefersReducedMotion = useReducedMotion()
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
  const profileRoleLabel = profile ? getProfileRoleLabel(profile) : "摄影师"
  const joinedLabel = profile ? getProfileJoinedLabel(profile) : "-"
  const pageDescription = isMe ? "" : "浏览这位摄影师公开展示的作品、个人简介与创作节奏。"
  const heroMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: PROFILE_REDUCED_MOTION_TRANSITION }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: PROFILE_MOTION_TRANSITION,
      }
  const panelMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: PROFILE_REDUCED_MOTION_TRANSITION }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: PROFILE_MOTION_TRANSITION,
      }
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
    <section className="relative mx-auto max-w-[1440px] px-4 pb-12 pt-2 md:px-6 md:pb-16 md:pt-4">
      <AnimatePresence>
        {actionNotice ? (
          <motion.div
            {...panelMotion}
            role="status"
            className="mb-4 border border-emerald-500/18 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88 shadow-[0_14px_34px_rgba(5,150,105,0.06)]"
          >
            {actionNotice}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div {...heroMotion} className="grid gap-6 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:items-start">
        <aside
          aria-label="摄影师资料"
          className={`border-y border-border/70 py-5 lg:sticky lg:top-28 ${
            isEditingProfile ? "no-scrollbar lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain" : ""
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-[0.7rem] border border-border/70 bg-secondary/50 text-muted-foreground shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
              {profile.userAvatar ? (
                <img
                  src={profile.userAvatar}
                  alt=""
                  width={72}
                  height={72}
                  loading="eager"
                  decoding="async"
                  className="size-full object-cover"
                />
              ) : (
                <UserIcon className="size-8" />
              )}
            </div>
            <div className="min-w-0">
              <p className="eyebrow-label">摄影师作品集</p>
              <h1 className="mt-2 break-words text-[2rem] font-medium leading-none tracking-normal text-foreground">
                {profile.userName}
              </h1>
            </div>
          </div>

          {profile.userProfile || pageDescription ? (
            <p className="mt-5 text-sm leading-7 text-muted-foreground">{profile.userProfile || pageDescription}</p>
          ) : null}

          <ProfileStatusMeter stats={stats} showMeter={isMe} />

          {isMe ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="surface-chip normal-case tracking-normal">{profileRoleLabel}</span>
              <span className="surface-chip normal-case tracking-normal">{joinedLabel}</span>
            </div>
          ) : null}

          {isMe ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {isEditingProfile ? (
                <>
                  <Button
                    className="h-9 rounded-full px-4"
                    onClick={() => void handleSaveProfile()}
                    disabled={isSavingProfile || isUploadingAvatar || !isProfileDirty}
                  >
                    {isSavingProfile ? "保存中..." : "保存资料"}
                  </Button>
                  <Button
                    className="h-9 rounded-full px-4"
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
                <Button className="h-9 rounded-full px-4" variant="outline" onClick={() => setIsEditingProfile(true)}>
                  <PencilLine className="size-4" />
                  编辑资料
                </Button>
              )}
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {isEditingProfile ? (
              <motion.div {...panelMotion} className="mt-5 border-t border-border/70 pt-5">
                <p className="eyebrow-label">资料维护</p>
                <div className="mt-4 grid gap-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">昵称</span>
                    <input
                      type="text"
                      value={draftUserName}
                      onChange={(event) => setDraftUserName(event.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
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
                      className="block w-full rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-background disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      支持 jpg、jpeg、png、webp，上传后会立即更新头像。
                    </p>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">头像地址（可选）</span>
                    <input
                      type="text"
                      value={draftUserAvatar}
                      onChange={(event) => setDraftUserAvatar(event.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">个人简介</span>
                    <textarea
                      value={draftUserProfile}
                      onChange={(event) => setDraftUserProfile(event.target.value)}
                      className="min-h-28 w-full rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                    />
                  </label>
                </div>
                {profileFormError ? (
                  <div className="mt-4 border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {profileFormError}
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 border-y border-border/70 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow-label">展出作品</p>
              <h2 className="mt-2 text-3xl font-medium tracking-normal text-foreground">作品墙</h2>
            </div>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="size-4" />
              {displayedPhotos.length} / {photoTotal} 幅
            </p>
          </div>

          {photosLoadState === "loading" ? (
            <div className="border border-border/70 bg-card/68 px-6 py-16 text-center text-sm text-muted-foreground">
              正在加载作品...
            </div>
          ) : null}

          {photosLoadState === "error" ? (
            <div className="border border-destructive/16 bg-destructive/6 px-6 py-10 text-center text-sm text-destructive">
              <p>{photoError ?? PHOTOS_DEFAULT_ERROR}</p>
              <Button className="mt-4 rounded-full" variant="outline" onClick={() => void loadPhotosPage({ append: false, pageNum: 1 })}>
                重新加载
              </Button>
            </div>
          ) : null}

          {photosLoadState === "ready" && !displayedPhotos.length ? (
            <div className="border border-dashed border-border/80 bg-secondary/18 px-6 py-16 text-center text-sm text-muted-foreground">
              {isMe ? "你还没有可展示的作品。" : "这位摄影师暂时还没有公开作品。"}
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
            <div className="flex justify-center pt-6">
              <Button className="rounded-full px-4" variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? "加载中..." : "加载更多"}
              </Button>
            </div>
          ) : null}
        </div>
      </motion.div>

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
