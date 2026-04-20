import { render, screen, waitFor } from "@testing-library/react"

import App from "@/App"
import { listAdminPictures } from "@/lib/admin-picture-api"
import { listPictures } from "@/lib/picture-api"

vi.mock("@/lib/admin-picture-api", () => ({
  getAdminPictureDetail: vi.fn(),
  listAdminPictures: vi.fn(),
  reviewPicture: vi.fn(),
}))

vi.mock("@/lib/picture-api", () => ({
  getPictureDetail: vi.fn(),
  listPictures: vi.fn(),
  uploadPictureByUrl: vi.fn(),
  uploadPictureFile: vi.fn(),
}))

describe("App admin review route", () => {
  afterEach(() => {
    localStorage.clear()
    window.history.pushState({}, "", "/")
  })

  test("renders the admin review workspace for stored admin users", async () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "1",
        userAccount: "admin@example.com",
        userName: "管理员",
        userAvatar: "",
        userProfile: "",
        userRole: "admin",
      }),
    )
    localStorage.setItem("token", "jwt-token")
    window.history.pushState({}, "", "/admin/review")

    vi.mocked(listAdminPictures).mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 1,
      list: [
        {
          id: "101",
          url: "https://example.com/cover.jpg",
          thumbnailUrl: "https://example.com/cover-thumb.jpg",
          name: "cover",
          category: "travel",
          introduction: "sunset",
          tags: ["travel"],
          picWidth: 1920,
          picHeight: 1080,
          reviewStatus: 0,
          reviewMessage: "",
          userId: "7",
          createTime: "2026-04-19 20:30:00",
          updateTime: "2026-04-19 20:30:00",
        },
      ],
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "审核管理" })).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "审核管理" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("cover")).toBeInTheDocument()
    expect(screen.getAllByText("待审核")).toHaveLength(2)
  })

  test("redirects non-admin users away from the review route", async () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "2",
        userAccount: "user@example.com",
        userName: "普通用户",
        userAvatar: "",
        userProfile: "",
        userRole: "user",
      }),
    )
    localStorage.setItem("token", "jwt-token")
    window.history.pushState({}, "", "/admin/review")

    vi.mocked(listPictures).mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 0,
      list: [],
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText("仅管理员可访问审核管理。")).toBeInTheDocument()
    })

    expect(window.location.pathname).toBe("/gallery")
  })
})
