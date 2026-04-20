import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import { normalizeEntityId, stringifyEntityId } from "@/lib/entity-id"

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
  createTime?: string
  updateTime?: string
}

interface BackendAdminPictureRecord extends Omit<AdminPictureRecord, "id" | "reviewerId" | "tags" | "userId"> {
  id: string | number
  reviewerId?: string | number
  tags?: string[] | string
  userId?: string | number
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

function mapAdminPictureRecord(picture: BackendAdminPictureRecord): AdminPictureRecord {
  return {
    ...picture,
    id: normalizeEntityId(picture.id, "图片 ID 非法"),
    reviewerId: picture.reviewerId !== undefined ? stringifyEntityId(picture.reviewerId) : undefined,
    tags: parseTags(picture.tags),
    userId: picture.userId !== undefined ? stringifyEntityId(picture.userId) : undefined,
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
