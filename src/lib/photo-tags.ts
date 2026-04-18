export const PHOTO_CARD_TAG_LIMIT = 2
export const PHOTO_DETAIL_TAG_LIMIT = 3

interface TagDisplayOptions {
  maxVisible?: number
}

export interface TagDisplayResult {
  visibleTags: string[]
  hiddenCount: number
}

export function getTagDisplay(tags: string[], options: TagDisplayOptions = {}): TagDisplayResult {
  const maxVisible = options.maxVisible ?? PHOTO_DETAIL_TAG_LIMIT
  const normalizedTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))

  return {
    visibleTags: normalizedTags.slice(0, maxVisible),
    hiddenCount: Math.max(0, normalizedTags.length - maxVisible),
  }
}
