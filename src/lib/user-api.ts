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
