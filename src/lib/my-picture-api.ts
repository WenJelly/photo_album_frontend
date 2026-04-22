import request, { unwrapApiResponse, type ApiEnvelope } from "@/lib/request"
import {
  type BackendPicturePage,
  mapBackendPictureToPhoto,
} from "@/lib/backend-picture"
import type { Photo } from "@/types/photo"

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
    list: result.data.list.map(mapBackendPictureToPhoto),
  }
}
