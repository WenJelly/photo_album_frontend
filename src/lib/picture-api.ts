import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import {
  type BackendPicture,
  type BackendPicturePage,
  mapBackendPictureToPhoto,
  normalizePictureTags,
} from "@/lib/backend-picture"
import { normalizeEntityId } from "@/lib/entity-id"
import {
  cloneCompressPictureType,
  GALLERY_DETAIL_COMPRESS,
  GALLERY_LIST_COMPRESS,
  SPHERE_LIST_COMPRESS,
  type CompressPictureTypePayload,
} from "@/lib/picture-compress"
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
const SPHERE_PAGE_SIZE_MAX = 200
const UPLOAD_REQUEST_TIMEOUT = 60_000

function normalizePageSize(pageSize: number | undefined, maxPageSize: number) {
  if (typeof pageSize !== "number" || !Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(Math.max(1, Math.trunc(pageSize)), maxPageSize)
}

function buildListPayload(
  params: ListPicturesParams,
  maxPageSize = MAX_PAGE_SIZE,
  compressPictureType: CompressPictureTypePayload = GALLERY_LIST_COMPRESS,
) {
  const payload: Record<string, unknown> = {
    pageNum: params.pageNum ?? DEFAULT_PAGE_NUM,
    pageSize: normalizePageSize(params.pageSize, maxPageSize),
    compressPictureType: cloneCompressPictureType(compressPictureType),
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

function mapPicturePageToListResult(result: BackendPicturePage): ListPicturesResult {
  return {
    pageNum: result.pageNum,
    pageSize: result.pageSize,
    total: result.total,
    list: result.list.map(mapBackendPictureToPhoto),
  }
}

export async function listPictures(params: ListPicturesParams = {}): Promise<ListPicturesResult> {
  const { data } = await request.post<ApiEnvelope<BackendPicturePage>>(
    "/api/picture/list",
    buildListPayload(params, MAX_PAGE_SIZE, GALLERY_LIST_COMPRESS),
  )
  const result = unwrapApiResponse(data)

  return mapPicturePageToListResult(result.data)
}

export async function listSpherePictures(limit: number): Promise<ListPicturesResult> {
  const { data } = await request.post<ApiEnvelope<BackendPicturePage>>(
    "/api/picture/list",
    buildListPayload({ pageNum: DEFAULT_PAGE_NUM, pageSize: limit }, SPHERE_PAGE_SIZE_MAX, SPHERE_LIST_COMPRESS),
  )
  const result = unwrapApiResponse(data)

  return mapPicturePageToListResult(result.data)
}

export async function getPictureDetail(id: number | string): Promise<Photo> {
  const { data } = await request.post<ApiEnvelope<BackendPicture>>("/api/picture/vo", {
    id: normalizeEntityId(id, "图片 ID 非法"),
    compressPictureType: cloneCompressPictureType(GALLERY_DETAIL_COMPRESS),
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
