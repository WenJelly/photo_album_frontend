import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import {
  type BackendPicture,
  type BackendPicturePage,
  mapBackendPictureToPhoto,
  normalizePictureTags,
} from "@/lib/backend-picture"
import { normalizeEntityId } from "@/lib/entity-id"
import { normalizePictureDeleteId } from "@/lib/picture-delete"
import { trimToUndefined } from "@/lib/text"
import type { Photo } from "@/types/photo"

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
const UPLOAD_REQUEST_TIMEOUT = 60_000

function buildListPayload(params: ListPicturesParams) {
  const payload: Record<string, unknown> = {
    pageNum: params.pageNum ?? DEFAULT_PAGE_NUM,
    pageSize: Math.min(params.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  }

  const category = trimToUndefined(params.category)
  const searchText = trimToUndefined(params.searchText)
  const tags = normalizePictureTags(params.tags)
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
    list: result.data.list.map(mapBackendPictureToPhoto),
  }
}

export async function getPictureDetail(id: number | string): Promise<Photo> {
  const { data } = await request.get<ApiEnvelope<BackendPicture>>("/api/picture/get/vo", {
    params: { id: normalizeEntityId(id, "图片 ID 非法") },
  })
  const result = unwrapApiResponse(data)

  return mapBackendPictureToPhoto(result.data)
}

export async function uploadPictureFile(params: UploadPictureFileParams): Promise<Photo> {
  const formData = new FormData()
  const tags = normalizePictureTags(params.tags)

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
    timeout: UPLOAD_REQUEST_TIMEOUT,
  })
  const result = unwrapApiResponse(data)

  return mapBackendPictureToPhoto(result.data)
}

export async function uploadPictureByUrl(params: UploadPictureByUrlParams): Promise<Photo> {
  const payload: Record<string, unknown> = {
    fileUrl: params.fileUrl.trim(),
    tags: normalizePictureTags(params.tags),
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

  const { data } = await request.post<ApiEnvelope<BackendPicture>>("/api/picture/upload/url", payload, {
    timeout: UPLOAD_REQUEST_TIMEOUT,
  })
  const result = unwrapApiResponse(data)

  return mapBackendPictureToPhoto(result.data)
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
