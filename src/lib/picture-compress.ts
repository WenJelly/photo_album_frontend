export interface CompressPictureTypePayload {
  compressType: 0 | 1 | 2
  cutWidth?: number
  CutHeight?: number
}

export const GALLERY_LIST_COMPRESS = {
  compressType: 1,
} satisfies CompressPictureTypePayload

export const GALLERY_DETAIL_COMPRESS = {
  compressType: 1,
} satisfies CompressPictureTypePayload

export const SPHERE_LIST_COMPRESS = {
  compressType: 2,
  cutWidth: 256,
  CutHeight: 256,
} satisfies CompressPictureTypePayload

export const ADMIN_REVIEW_LIST_COMPRESS = {
  compressType: 2,
  cutWidth: 192,
  CutHeight: 192,
} satisfies CompressPictureTypePayload

export function cloneCompressPictureType(
  compressPictureType: CompressPictureTypePayload,
): CompressPictureTypePayload {
  return {
    ...compressPictureType,
  }
}
