import { describe, expect, it } from "vitest"

import { getTagDisplay, PHOTO_CARD_TAG_LIMIT, PHOTO_DETAIL_TAG_LIMIT } from "@/lib/photo-tags"

describe("getTagDisplay", () => {
  it("shows up to the requested number of visible tags and aggregates the rest", () => {
    expect(
      getTagDisplay(["自然光", "远景", "薄雾", "山脊"], { maxVisible: PHOTO_DETAIL_TAG_LIMIT })
    ).toEqual({
      visibleTags: ["自然光", "远景", "薄雾"],
      hiddenCount: 1,
    })
  })

  it("uses a tighter limit for card-sized contexts", () => {
    expect(
      getTagDisplay(["几何", "结构", "材质"], { maxVisible: PHOTO_CARD_TAG_LIMIT })
    ).toEqual({
      visibleTags: ["几何", "结构"],
      hiddenCount: 1,
    })
  })

  it("trims empty tags and deduplicates repeated values", () => {
    expect(
      getTagDisplay(["  夜景  ", "", "夜景", "反光", " "], { maxVisible: PHOTO_DETAIL_TAG_LIMIT })
    ).toEqual({
      visibleTags: ["夜景", "反光"],
      hiddenCount: 0,
    })
  })
})
