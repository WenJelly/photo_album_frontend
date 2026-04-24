const { mockedPost } = vi.hoisted(() => ({
  mockedPost: vi.fn(),
}))

vi.mock("./request", async () => {
  const actual = await vi.importActual<typeof import("./request")>("./request")

  return {
    ...actual,
    default: {
      post: mockedPost,
      get: vi.fn(),
    },
  }
})

import { listAdminPictures } from "./admin-picture-api"

describe("admin-picture-api", () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it("uses the admin review list endpoint and centered crop preset", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 0,
        data: {
          pageNum: 1,
          pageSize: 20,
          total: 1,
          list: [
            {
              id: "1",
              url: "https://example.com/photo.jpg",
              thumbnailUrl: "https://example.com/photo-thumb.jpg",
              name: "Pending photo",
              reviewStatus: 0,
              userId: "9",
              user: {
                id: "9",
                userName: "Admin",
              },
            },
          ],
        },
      },
    })

    const result = await listAdminPictures({ pageNum: 1, pageSize: 50, reviewStatus: 0 })

    expect(mockedPost).toHaveBeenCalledWith("/api/admin/picture/list", {
      pageNum: 1,
      pageSize: 50,
      reviewStatus: 0,
      compressPictureType: {
        compressType: 2,
        cutWidth: 192,
        CutHeight: 192,
      },
    })
    expect(result.list[0]?.user?.id).toBe("9")
    expect(result.list[0]?.reviewStatus).toBe(0)
  })

  it("does not force the all-status sentinel when reviewStatus is omitted", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        data: {
          pageNum: 1,
          pageSize: 20,
          total: 0,
          list: [],
        },
      },
    })

    await listAdminPictures({ pageNum: 1, pageSize: 20 })

    expect(mockedPost).toHaveBeenCalledWith("/api/admin/picture/list", {
      pageNum: 1,
      pageSize: 20,
      compressPictureType: {
        compressType: 2,
        cutWidth: 192,
        CutHeight: 192,
      },
    })
  })

  it("passes documented admin review filter fields through unchanged", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        data: {
          pageNum: 1,
          pageSize: 20,
          total: 0,
          list: [],
        },
      },
    })

    await listAdminPictures({
      id: "1",
      userId: "9",
      reviewerId: "3",
      tags: ["sunset", "sea"],
      reviewMessage: "needs review",
      pageNum: 2,
      pageSize: 30,
    })

    expect(mockedPost).toHaveBeenCalledWith("/api/admin/picture/list", {
      id: "1",
      userId: "9",
      reviewerId: "3",
      tags: ["sunset", "sea"],
      reviewMessage: "needs review",
      pageNum: 2,
      pageSize: 30,
      compressPictureType: {
        compressType: 2,
        cutWidth: 192,
        CutHeight: 192,
      },
    })
  })
})
