import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import { normalizeEntityId, stringifyEntityId } from "@/lib/entity-id"
import { normalizePictureDeleteId } from "@/lib/picture-delete"
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

function buildListPayload(params: ListPicturesParams) {
  const payload: Record<string, unknown> = {
    pageNum: params.pageNum ?? DEFAULT_PAGE_NUM,
    pageSize: Math.min(params.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }

  const category = trimToUndefined(params.category)
  const searchText = trimToUndefined(params.searchText)
  const tags = normalizeTags(params.tags)
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
    list: result.data.list.map(mapPictureToPhoto),
  }
}

export async function getPictureDetail(id: number | string): Promise<Photo> {
  const { data } = await request.get<ApiEnvelope<BackendPicture>>("/api/picture/get/vo", {
    params: { id: normalizeEntityId(id, "图片 ID 非法") },
  })
  const result = unwrapApiResponse(data)

  return mapPictureToPhoto(result.data)
}

export async function uploadPictureFile(params: UploadPictureFileParams): Promise<Photo> {
  const formData = new FormData()
  const tags = normalizeTags(params.tags)

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
  })
  const result = unwrapApiResponse(data)

  return mapPictureToPhoto(result.data)
}

export async function uploadPictureByUrl(params: UploadPictureByUrlParams): Promise<Photo> {
  const payload: Record<string, unknown> = {
    fileUrl: params.fileUrl.trim(),
    tags: normalizeTags(params.tags),
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

  const { data } = await request.post<ApiEnvelope<BackendPicture>>("/api/picture/upload/url", payload)
  const result = unwrapApiResponse(data)

  return mapPictureToPhoto(result.data)
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
