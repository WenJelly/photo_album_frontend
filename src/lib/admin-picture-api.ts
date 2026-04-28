import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import { normalizeEntityId, stringifyEntityId } from "@/lib/entity-id"
import { ADMIN_REVIEW_LIST_COMPRESS, cloneCompressPictureType } from "@/lib/picture-compress"
import { normalizePictureTags } from "@/lib/backend-picture"
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
  picSize?: number
  picWidth?: number
  picHeight?: number
  picScale?: number
  picFormat?: string
  reviewStatus?: number
  reviewMessage?: string
  reviewerId?: string
  reviewTime?: string
  userId?: string
  user?: AdminPictureUserSummary
  createTime?: string
  editTime?: string
  updateTime?: string
  viewCount?: number
  likeCount?: number
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
  id?: string
  name?: string
  pageNum?: number
  pageSize?: number
  reviewStatus?: number
  category?: string
  tags?: string[]
  picSize?: number
  picWidth?: number
  picHeight?: number
  picScale?: number
  picFormat?: string
  userId?: string | number
  reviewerId?: string | number
  reviewMessage?: string
  searchText?: string
  editTimeStart?: string
  editTimeEnd?: string
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
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 300
const FALLBACK_USER_NAME = "Unnamed User"

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
    id: normalizeEntityId(user.id, "User ID is invalid"),
    userName: trimToUndefined(user.userName) ?? FALLBACK_USER_NAME,
    userAvatar: trimToUndefined(user.userAvatar),
    userProfile: trimToUndefined(user.userProfile),
    userRole: trimToUndefined(user.userRole),
  }
}

function mapAdminPictureRecord(picture: BackendAdminPictureRecord): AdminPictureRecord {
  return {
    ...picture,
    id: normalizeEntityId(picture.id, "Picture ID is invalid"),
    reviewerId: picture.reviewerId !== undefined ? stringifyEntityId(picture.reviewerId) : undefined,
    tags: parseTags(picture.tags),
    userId: picture.userId !== undefined ? stringifyEntityId(picture.userId) : undefined,
    user: mapAdminPictureUserSummary(picture.user),
  }
}

export async function listAdminPictures(params: ListAdminPicturesParams = {}): Promise<AdminPicturePage> {
  const payload: Record<string, unknown> = {
    pageNum: params.pageNum ?? DEFAULT_PAGE_NUM,
    pageSize: Math.min(params.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    compressPictureType: cloneCompressPictureType(ADMIN_REVIEW_LIST_COMPRESS),
  }

  const id = params.id ? normalizeEntityId(params.id, "Picture ID is invalid") : undefined
  const name = trimToUndefined(params.name)
  const category = trimToUndefined(params.category)
  const tags = normalizePictureTags(params.tags)
  const picFormat = trimToUndefined(params.picFormat)
  const reviewMessage = trimToUndefined(params.reviewMessage)
  const searchText = trimToUndefined(params.searchText)
  const editTimeStart = trimToUndefined(params.editTimeStart)
  const editTimeEnd = trimToUndefined(params.editTimeEnd)

  if (id) {
    payload.id = id
  }

  if (name) {
    payload.name = name
  }

  if (params.reviewStatus !== undefined) {
    payload.reviewStatus = params.reviewStatus
  }

  if (category) {
    payload.category = category
  }

  if (tags.length) {
    payload.tags = tags
  }

  if (typeof params.picSize === "number" && Number.isFinite(params.picSize)) {
    payload.picSize = params.picSize
  }

  if (typeof params.picWidth === "number" && Number.isFinite(params.picWidth)) {
    payload.picWidth = params.picWidth
  }

  if (typeof params.picHeight === "number" && Number.isFinite(params.picHeight)) {
    payload.picHeight = params.picHeight
  }

  if (typeof params.picScale === "number" && Number.isFinite(params.picScale)) {
    payload.picScale = params.picScale
  }

  if (picFormat) {
    payload.picFormat = picFormat
  }

  if (params.userId !== undefined) {
    payload.userId = stringifyEntityId(params.userId)
  }

  if (params.reviewerId !== undefined) {
    payload.reviewerId = stringifyEntityId(params.reviewerId)
  }

  if (reviewMessage) {
    payload.reviewMessage = reviewMessage
  }

  if (searchText) {
    payload.searchText = searchText
  }

  if (editTimeStart) {
    payload.editTimeStart = editTimeStart
  }

  if (editTimeEnd) {
    payload.editTimeEnd = editTimeEnd
  }

  const { data } = await request.post<ApiEnvelope<AdminPicturePageEnvelope>>("/api/admin/picture/list", payload)
  const result = unwrapApiResponse(data)

  return {
    pageNum: result.data.pageNum,
    pageSize: result.data.pageSize,
    total: result.data.total,
    list: result.data.list.map(mapAdminPictureRecord),
  }
}

export async function reviewPicture(params: ReviewPictureParams): Promise<AdminPictureRecord> {
  const { data } = await request.post<ApiEnvelope<BackendAdminPictureRecord>>("/api/picture/review", params)
  const result = unwrapApiResponse(data)

  return mapAdminPictureRecord(result.data)
}
