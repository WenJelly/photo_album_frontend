import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import App from "@/App"
import { deletePicture, getPictureDetail, listPictures } from "@/lib/picture-api"

vi.mock("@/lib/admin-picture-api", () => ({
  getAdminPictureDetail: vi.fn(),
  listAdminPictures: vi.fn(),
  reviewPicture: vi.fn(),
}))

vi.mock("@/lib/picture-api", () => ({
  deletePicture: vi.fn(),
  getPictureDetail: vi.fn(),
  listPictures: vi.fn(),
  uploadPictureByUrl: vi.fn(),
  uploadPictureFile: vi.fn(),
}))

describe("App gallery delete", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.pushState({}, "", "/")
  })

  test("shows delete action for picture owners and removes the picture after deletion", async () => {
    const user = userEvent.setup()

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "7",
        userAccount: "owner@example.com",
        userName: "作者",
        userAvatar: "",
        userProfile: "",
        userRole: "user",
      }),
    )
    localStorage.setItem("token", "jwt-token")
    window.history.pushState({}, "", "/gallery")

    const photo = {
      id: "101",
      src: "https://example.com/cover.jpg",
      thumbnailSrc: "https://example.com/cover-thumb.jpg",
      width: 1920,
      height: 1080,
      alt: "cover",
      photographer: "作者",
      category: "travel",
      categoryLabel: "travel",
      summary: "sunset",
      location: "2026-04-19",
      tags: ["travel"],
      format: "JPG",
      viewCount: 1,
      likeCount: 2,
      createdAt: "2026-04-19 20:30:00",
      updatedAt: "2026-04-19 20:30:00",
      reviewStatus: 1,
      reviewMessage: "审核通过",
      userId: "7",
    }

    vi.mocked(listPictures).mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 1,
      list: [photo],
    })
    vi.mocked(getPictureDetail).mockResolvedValue(photo)
    vi.mocked(deletePicture).mockResolvedValue({ id: "101" })
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)

    render(<App />)

    await screen.findByRole("button", { name: /cover/i })
    await user.click(screen.getByRole("button", { name: /cover/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "删除图片" })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "删除图片" }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "确认删除这张图片？\n删除后前台列表将不再展示，且无法继续查看该图片。",
      )
      expect(deletePicture).toHaveBeenCalledWith("101")
    })

    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument()
  })
})
