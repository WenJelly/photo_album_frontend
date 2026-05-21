export type PhotoCategory = string

export interface PhotoExif {
  aperture?: string
  shutterSpeed?: string
  iso?: number
  focalLength?: string
  camera?: string
  lens?: string
}

export interface Photo {
  id: string
  src: string
  thumbnailSrc?: string
  width: number
  height: number
  alt: string
  photographer: string
  category: PhotoCategory
  categoryLabel?: string
  summary: string
  location: string
  tags: string[]
  format?: string
  viewCount?: number
  likeCount?: number
  createdAt?: string
  updatedAt?: string
  reviewStatus?: number
  reviewMessage?: string
  userId?: string
  userAvatar?: string
  exif?: PhotoExif
}
