const { mockedGet, mockedPost } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
}))

vi.mock("./request", async () => {
  const actual = await vi.importActual<typeof import("./request")>("./request")

  return {
    ...actual,
    default: {
      post: mockedPost,
      get: mockedGet,
    },
  }
})

import { getPictureDetail, listPictures, listSpherePictures } from "./picture-api"

function createPicturePage(pageSize: number) {
  return {
    code: 0,
    data: {
      pageNum: 1,
      pageSize,
      total: 1,
      list: [
        {
          id: "1",
          url: "https://example.com/photo.jpg",
          thumbnailUrl: "https://example.com/photo-thumb.jpg",
          name: "Photo",
        },
      ],
    },
  }
}

describe("picture-api list helpers", () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
  })

  it("keeps gallery listing capped at 20 items", async () => {
    mockedPost.mockResolvedValue({ data: createPicturePage(20) })

    await listPictures({ pageNum: 1, pageSize: 200 })

    expect(mockedPost).toHaveBeenCalledWith("/api/picture/list", {
      pageNum: 1,
      pageSize: 20,
      compressPictureType: {
        compressType: 1,
      },
    })
  })

  it("allows the home sphere to request up to 200 items", async () => {
    mockedPost.mockResolvedValue({ data: createPicturePage(200) })

    const result = await listSpherePictures(200)

    expect(mockedPost).toHaveBeenCalledWith("/api/picture/list", {
      pageNum: 1,
      pageSize: 200,
      compressPictureType: {
        compressType: 2,
        cutWidth: 256,
        CutHeight: 256,
      },
    })
    expect(result.list).toHaveLength(1)
    expect(result.list[0]?.thumbnailSrc).toBe("https://example.com/photo-thumb.jpg")
  })

  it("loads picture detail through the documented POST endpoint", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 0,
        data: {
          id: "1",
          url: "https://example.com/photo.jpg",
          thumbnailUrl: "https://example.com/photo-thumb.jpg",
          name: "Photo",
        },
      },
    })

    await getPictureDetail("1")

    expect(mockedPost).toHaveBeenCalledWith("/api/picture/vo", {
      id: "1",
      compressPictureType: {
        compressType: 1,
      },
    })
    expect(mockedGet).not.toHaveBeenCalled()
  })
})
