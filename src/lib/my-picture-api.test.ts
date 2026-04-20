import request, { unwrapApiResponse } from "@/lib/request"
import { listMyPictures } from "@/lib/my-picture-api"

vi.mock("@/lib/request", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
  unwrapApiResponse: vi.fn((payload) => payload),
}))

describe("my-picture-api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("loads the current user's picture page", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: {
        data: {
          pageNum: 1,
          pageSize: 20,
          total: 1,
          list: [
            {
              id: "101",
              url: "https://example.com/cover.jpg",
              thumbnailUrl: "https://example.com/cover-thumb.jpg",
              name: "cover",
              introduction: "sunset",
              category: "travel",
              tags: ["travel"],
              picWidth: 1920,
              picHeight: 1080,
              userId: "7",
            },
          ],
        },
      },
    })

    await listMyPictures({
      pageNum: 1,
      pageSize: 20,
      reviewStatus: 0,
    })

    expect(request.post).toHaveBeenCalledWith("/api/picture/my/list/page", {
      pageNum: 1,
      pageSize: 20,
      reviewStatus: 0,
    })
    expect(unwrapApiResponse).toHaveBeenCalled()
  })
})
