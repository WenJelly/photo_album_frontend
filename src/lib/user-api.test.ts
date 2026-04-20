import request, { unwrapApiResponse } from "@/lib/request"
import { getMyProfile, getUserProfile, updateMyProfile } from "@/lib/user-api"

vi.mock("@/lib/request", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
  unwrapApiResponse: vi.fn((payload) => payload),
}))

describe("user-api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("loads the current user profile", async () => {
    vi.mocked(request.get).mockResolvedValue({
      data: {
        data: {
          id: "101",
          userName: "作者",
          userAvatar: "",
          userProfile: "简介",
          userRole: "user",
        },
      },
    })

    await expect(getMyProfile()).resolves.toEqual({
      id: "101",
      userName: "作者",
      userAvatar: "",
      userProfile: "简介",
      userRole: "user",
      createTime: undefined,
      updateTime: undefined,
      pictureCount: undefined,
      approvedPictureCount: undefined,
      pendingPictureCount: undefined,
      rejectedPictureCount: undefined,
    })

    expect(request.get).toHaveBeenCalledWith("/api/user/my")
    expect(unwrapApiResponse).toHaveBeenCalled()
  })

  test("loads a public user profile by id", async () => {
    vi.mocked(request.get).mockResolvedValue({
      data: {
        data: {
          id: "202",
          userName: "摄影师",
          userAvatar: "https://example.com/avatar.jpg",
          userProfile: "",
          userRole: "user",
          pictureCount: 4,
        },
      },
    })

    await getUserProfile("202")

    expect(request.get).toHaveBeenCalledWith("/api/user/get/vo", {
      params: { id: "202" },
    })
  })

  test("updates the current user profile", async () => {
    vi.mocked(request.patch).mockResolvedValue({
      data: {
        data: {
          id: "101",
          userName: "新名字",
          userAvatar: "https://example.com/new-avatar.jpg",
          userProfile: "新的简介",
          userRole: "user",
        },
      },
    })

    await updateMyProfile({
      userName: " 新名字 ",
      userAvatar: " https://example.com/new-avatar.jpg ",
      userProfile: " 新的简介 ",
    })

    expect(request.patch).toHaveBeenCalledWith("/api/user/my", {
      userName: "新名字",
      userAvatar: "https://example.com/new-avatar.jpg",
      userProfile: "新的简介",
    })
  })
})
