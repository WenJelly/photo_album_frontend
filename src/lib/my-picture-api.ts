import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import { normalizeEntityId, stringifyEntityId } from "@/lib/entity-id"
import type { Photo } from "@/types/photo"

interface BackendPictureUser {
  id: string | number
  userName: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
}

interface BackendPicture {
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

interface BackendPicturePage {
  pageNum: number
  pageSize: number
  total: number
  list: BackendPicture[]
}

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
const FALLBACK_PHOTO_NAME = "Untitled"
const FALLBACK_USER_NAME = "Unknown"
const FALLBACK_CATEGORY = "uncategorized"
const FALLBACK_CATEGORY_LABEL = "未分类"
const FALLBACK_SUMMARY = "No description yet."

function trimToUndefined(value?: string | null) {
  const normalizedValue = typeof value === "string" ? value.trim() : ""

  return normalizedValue || undefined
}

function normalizeTags(tags?: string[] | null) {
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

function mapPictureToPhoto(picture: BackendPicture): Photo {
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
    tags: normalizeTags(picture.tags),
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
    list: result.data.list.map(mapPictureToPhoto),
  }
}
