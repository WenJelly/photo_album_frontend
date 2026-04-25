import { decodeBlurHashToPixels, isValidBlurHash } from "./blurhash"

describe("blurhash helpers", () => {
  it("accepts a minimal one-component blur hash", () => {
    expect(isValidBlurHash("00TI:j")).toBe(true)
  })

  it("decodes a one-component blur hash into a stable pixel buffer", () => {
    const pixels = decodeBlurHashToPixels("00TI:j", 2, 2)

    expect(pixels).toHaveLength(16)
    expect(Array.from(pixels.slice(0, 4))).toEqual(Array.from(pixels.slice(4, 8)))
  })

  it("rejects malformed blur hashes without throwing", () => {
    expect(isValidBlurHash("bad")).toBe(false)
    expect(decodeBlurHashToPixels("bad", 2, 2)).toBeNull()
  })
})
