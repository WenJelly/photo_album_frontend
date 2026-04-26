import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import { normalizeEntityId } from "@/lib/entity-id"
import { trimToUndefined } from "@/lib/text"

interface BackendUserProfile {
  id: string | number
  userName?: string
  userEmail?: string
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
  userEmail: string
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
  id: string
  userAvatar?: string
  userEmail?: string
  userName?: string
  userPassword?: string
  userProfile?: string
}

const FALLBACK_USER_NAME = "Unnamed User"
const FALLBACK_USER_ROLE = "user"
const AVATAR_UPLOAD_REQUEST_TIMEOUT = 60_000

function normalizeCount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function mapUserProfile(profile: BackendUserProfile): UserProfile {
  return {
    id: normalizeEntityId(profile.id, "User ID is invalid"),
    userName: trimToUndefined(profile.userName) ?? FALLBACK_USER_NAME,
    userEmail: trimToUndefined(profile.userEmail) ?? "",
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
  const { data } = await request.post<ApiEnvelope<BackendUserProfile>>("/api/user/get/detail", {})
  const result = unwrapApiResponse(data)

  return mapUserProfile(result.data)
}

export async function getUserProfile(id: string): Promise<UserProfile> {
  const { data } = await request.post<ApiEnvelope<BackendUserProfile>>("/api/user/get/detail", {
    id: normalizeEntityId(id, "User ID is invalid"),
  })
  const result = unwrapApiResponse(data)

  return mapUserProfile(result.data)
}

export async function updateMyProfile(params: UpdateMyProfileParams): Promise<MyUserProfile> {
  const payload: Record<string, unknown> = {
    id: normalizeEntityId(params.id, "User ID is invalid"),
  }

  const userAvatar = trimToUndefined(params.userAvatar)
  const userEmail = trimToUndefined(params.userEmail)
  const userName = trimToUndefined(params.userName)
  const userPassword = trimToUndefined(params.userPassword)
  const userProfile = trimToUndefined(params.userProfile)

  if (userAvatar) {
    payload.userAvatar = userAvatar
  }

  if (userEmail) {
    payload.userEmail = userEmail
  }

  if (userName) {
    payload.userName = userName
  }

  if (userPassword) {
    payload.userPassword = userPassword
  }

  if (userProfile) {
    payload.userProfile = userProfile
  }

  const { data } = await request.post<ApiEnvelope<BackendUserProfile>>("/api/user/update", payload)
  const result = unwrapApiResponse(data)

  return mapUserProfile(result.data)
}

export async function uploadMyAvatarFile(file: File): Promise<MyUserProfile> {
  const formData = new FormData()
  formData.append("file", file)

  const { data } = await request.post<ApiEnvelope<BackendUserProfile>>("/api/user/avatar/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: AVATAR_UPLOAD_REQUEST_TIMEOUT,
  })
  const result = unwrapApiResponse(data)

  return mapUserProfile(result.data)
}
