export const categories = [
  "all",
  "nature",
  "architecture",
  "portrait",
  "street",
  "abstract",
] as const

export type Category = (typeof categories)[number]

export const categoryLabels: Record<Category, string> = {
  all: "全部",
  nature: "自然",
  architecture: "建筑",
  portrait: "人像",
  street: "街头",
  abstract: "抽象",
}
