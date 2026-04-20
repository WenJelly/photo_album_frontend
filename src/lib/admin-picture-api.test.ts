import request, { unwrapApiResponse } from "@/lib/request"
import {
  getAdminPictureDetail,
  listAdminPictures,
  reviewPicture,
} from "@/lib/admin-picture-api"

vi.mock("@/lib/request", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  unwrapApiResponse: vi.fn((payload) => payload),
}))

describe("admin-picture-api", () => {
  test("requests admin picture pages from the management endpoint", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: {
        data: {
          pageNum: 1,
          pageSize: 20,
          total: 1,
          list: [],
        },
      },
    })

    await listAdminPictures({
      pageNum: 1,
      pageSize: 20,
      reviewStatus: 0,
      category: "travel",
      userId: "9",
      searchText: "sunset",
    })

    expect(request.post).toHaveBeenCalledWith("/api/picture/list/page", {
      pageNum: 1,
      pageSize: 20,
      reviewStatus: 0,
      category: "travel",
      userId: "9",
      searchText: "sunset",
    })
    expect(unwrapApiResponse).toHaveBeenCalled()
  })

  test("loads raw admin picture detail without increasing view count", async () => {
    vi.mocked(request.get).mockResolvedValue({
      data: {
        data: {
          id: "101",
          name: "cover",
        },
      },
    })

    await getAdminPictureDetail("101")

    expect(request.get).toHaveBeenCalledWith("/api/picture/get", {
      params: { id: "101" },
    })
  })

  test("submits review decisions to the admin review endpoint", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: {
        data: {
          id: "101",
          reviewStatus: 2,
          reviewMessage: "内容不符合要求",
        },
      },
    })

    await reviewPicture({
      id: "101",
      reviewStatus: 2,
      reviewMessage: "内容不符合要求",
    })

    expect(request.post).toHaveBeenCalledWith("/api/picture/review", {
      id: "101",
      reviewStatus: 2,
      reviewMessage: "内容不符合要求",
    })
  })
})
