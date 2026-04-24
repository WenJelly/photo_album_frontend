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

import { getPictureDetail, listPictures, listSpherePictures, uploadPictureFile } from "./picture-api"

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

  it("keeps gallery listing capped at the documented 300 items", async () => {
    mockedPost.mockResolvedValue({ data: createPicturePage(300) })

    await listPictures({ pageNum: 1, pageSize: 400 })

    expect(mockedPost).toHaveBeenCalledWith("/api/picture/list", {
      pageNum: 1,
      pageSize: 300,
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

  it("passes documented public list filter fields through unchanged", async () => {
    mockedPost.mockResolvedValue({ data: createPicturePage(10) })

    await listPictures({
      id: "7",
      name: "Sunset",
      userId: "9",
      picFormat: "jpg",
      editTimeStart: "2026-04-01",
      editTimeEnd: "2026-04-23",
      pageNum: 2,
      pageSize: 10,
    })

    expect(mockedPost).toHaveBeenCalledWith("/api/picture/list", {
      id: "7",
      name: "Sunset",
      userId: "9",
      picFormat: "jpg",
      editTimeStart: "2026-04-01",
      editTimeEnd: "2026-04-23",
      pageNum: 2,
      pageSize: 10,
      compressPictureType: {
        compressType: 1,
      },
    })
  })

  it("treats delete responses without a data field as success for the requested id", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        message: "success",
      },
    })

    const { deletePicture } = await import("./picture-api")
    const result = await deletePicture("9")

    expect(mockedPost).toHaveBeenCalledWith("/api/picture/delete", {
      id: "9",
    })
    expect(result).toEqual({
      id: "9",
    })
  })

  it("passes normalized upload progress through the file upload helper", async () => {
    const onProgress = vi.fn()

    mockedPost.mockImplementation(async (_url, _formData, config) => {
      config?.onUploadProgress?.({
        loaded: 512,
        total: 1024,
        progress: 0.5,
      })

      return {
        data: {
          code: 200,
          data: {
            id: "1",
            url: "https://example.com/photo.jpg",
            thumbnailUrl: "https://example.com/photo-thumb.jpg",
            name: "Photo",
          },
        },
      }
    })

    await uploadPictureFile({
      file: new File(["binary"], "demo.png", { type: "image/png" }),
      picName: "Demo",
      onProgress,
    })

    expect(onProgress).toHaveBeenCalledWith({
      loaded: 512,
      total: 1024,
      progress: 0.5,
    })
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/picture/upload",
      expect.any(FormData),
      expect.objectContaining({
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 60_000,
        onUploadProgress: expect.any(Function),
      }),
    )
  })
})
