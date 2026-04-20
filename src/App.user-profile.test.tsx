import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import App from "@/App"
import { listMyPictures } from "@/lib/my-picture-api"
import { listPictures } from "@/lib/picture-api"
import { getMyProfile, getUserProfile, updateMyProfile } from "@/lib/user-api"

vi.mock("@/lib/admin-picture-api", () => ({
  getAdminPictureDetail: vi.fn(),
  listAdminPictures: vi.fn(),
  reviewPicture: vi.fn(),
}))

vi.mock("@/lib/my-picture-api", () => ({
  listMyPictures: vi.fn(),
}))

vi.mock("@/lib/picture-api", () => ({
  deletePicture: vi.fn(),
  getPictureDetail: vi.fn(),
  listPictures: vi.fn(),
  uploadPictureByUrl: vi.fn(),
  uploadPictureFile: vi.fn(),
}))

vi.mock("@/lib/user-api", () => ({
  getMyProfile: vi.fn(),
  getUserProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}))

describe("App user profile routes", () => {
  afterEach(() => {
    localStorage.clear()
    window.history.pushState({}, "", "/")
  })

  test("navigates to my profile from the header and syncs saved profile changes back to the header", async () => {
    const user = userEvent.setup()

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "7",
        userAccount: "owner@example.com",
        userName: "作者",
        userAvatar: "",
        userProfile: "原简介",
        userRole: "user",
      }),
    )
    localStorage.setItem("token", "jwt-token")
    window.history.pushState({}, "", "/gallery")

    vi.mocked(listPictures).mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 0,
      list: [],
    })
    vi.mocked(getMyProfile).mockResolvedValue({
      id: "7",
      userName: "作者",
      userAvatar: "",
      userProfile: "原简介",
      userRole: "user",
      createTime: "2026-04-18 20:00:00",
      updateTime: "2026-04-18 20:00:00",
      pictureCount: 3,
      approvedPictureCount: 2,
      pendingPictureCount: 1,
      rejectedPictureCount: 0,
    })
    vi.mocked(listMyPictures).mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 0,
      list: [],
    })
    vi.mocked(updateMyProfile).mockResolvedValue({
      id: "7",
      userName: "新的作者",
      userAvatar: "",
      userProfile: "新的简介",
      userRole: "user",
      createTime: "2026-04-18 20:00:00",
      updateTime: "2026-04-19 09:30:00",
      pictureCount: 3,
      approvedPictureCount: 2,
      pendingPictureCount: 1,
      rejectedPictureCount: 0,
    })

    render(<App />)

    await user.click(screen.getByRole("button", { name: "作者" }))

    expect(await screen.findByText("我的主页")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "作者" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/me")

    await user.click(screen.getByRole("button", { name: "编辑资料" }))
    await user.clear(screen.getByLabelText("昵称"))
    await user.type(screen.getByLabelText("昵称"), "新的作者")
    await user.clear(screen.getByLabelText("个人简介"))
    await user.type(screen.getByLabelText("个人简介"), "新的简介")
    await user.click(screen.getByRole("button", { name: "保存资料" }))

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith({
        userName: "新的作者",
        userAvatar: "",
        userProfile: "新的简介",
      })
    })

    expect(screen.getByRole("button", { name: "新的作者" })).toBeInTheDocument()
    expect(screen.getByText("个人资料已更新。")).toBeInTheDocument()
  })

  test("redirects anonymous visitors away from /me and opens the auth dialog", async () => {
    window.history.pushState({}, "", "/me")

    vi.mocked(listPictures).mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 0,
      list: [],
    })

    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe("/gallery")
    })

    expect(screen.getByText("请先登录后查看个人主页。")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "登录" })).toBeInTheDocument()
  })

  test("navigates to a public user page from the gallery photographer entry", async () => {
    const user = userEvent.setup()

    window.history.pushState({}, "", "/gallery")

    vi.mocked(listPictures)
      .mockResolvedValueOnce({
        pageNum: 1,
        pageSize: 20,
        total: 1,
        list: [
          {
            id: "101",
            src: "https://example.com/cover.jpg",
            thumbnailSrc: "https://example.com/cover-thumb.jpg",
            width: 1920,
            height: 1080,
            alt: "cover",
            photographer: "摄影师甲",
            category: "travel",
            categoryLabel: "travel",
            summary: "sunset",
            location: "2026-04-19",
            tags: ["travel"],
            format: "JPG",
            userId: "42",
          },
        ],
      })
      .mockResolvedValueOnce({
        pageNum: 1,
        pageSize: 20,
        total: 0,
        list: [],
      })

    vi.mocked(getUserProfile).mockResolvedValue({
      id: "42",
      userName: "摄影师甲",
      userAvatar: "",
      userProfile: "擅长拍摄自然光影。",
      userRole: "user",
      createTime: "2026-04-18 20:00:00",
      updateTime: "2026-04-18 20:00:00",
      pictureCount: 6,
      approvedPictureCount: 6,
    })

    render(<App />)

    await screen.findByRole("button", { name: "查看图片 cover" })
    await user.click(screen.getByRole("button", { name: "摄影师甲" }))

    await waitFor(() => {
      expect(window.location.pathname).toBe("/users/42")
    })

    expect(await screen.findByText("摄影师主页")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "摄影师甲" })).toBeInTheDocument()
    expect(screen.getByText("擅长拍摄自然光影。")).toBeInTheDocument()
  })
})
