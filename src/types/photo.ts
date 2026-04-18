export type PhotoCategory = "nature" | "architecture" | "portrait" | "street" | "abstract"

export interface Photo {
  id: string
  src: string
  width: number
  height: number
  alt: string
  photographer: string
  category: PhotoCategory
  summary: string
  location: string
  tags: string[]
}
