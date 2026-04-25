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
  blurHash?: string
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
    blurHash: trimToUndefined(picture.blurHash),
    viewCount: picture.viewCount ?? 0,
    likeCount: picture.likeCount ?? 0,
    createdAt: trimToUndefined(picture.createTime),
    updatedAt: trimToUndefined(picture.updateTime),
    reviewStatus: picture.reviewStatus,
    reviewMessage: trimToUndefined(picture.reviewMessage),
    userId: picture.userId !== undefined ? stringifyEntityId(picture.userId) : undefined,
  }
}
