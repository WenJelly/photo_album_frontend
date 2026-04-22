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
