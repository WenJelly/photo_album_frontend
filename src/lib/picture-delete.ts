import { normalizeEntityId, type EntityId } from "@/lib/entity-id"

export const DELETE_PICTURE_CONFIRM_MESSAGE =
  "确认删除这张图片？\n删除后前台列表将不再展示，且无法继续查看该图片。"

export function normalizePictureDeleteId(id: number | string) {
  const normalizedId = normalizeEntityId(id, "图片参数错误")

  if (normalizedId === "0") {
    throw new Error("图片参数错误")
  }

  return normalizedId
}

export type PictureId = EntityId
