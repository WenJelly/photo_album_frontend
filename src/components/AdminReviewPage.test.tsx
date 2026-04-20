import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AdminReviewPage } from "@/components/AdminReviewPage"
import { deletePicture } from "@/lib/picture-api"
import {
  getAdminPictureDetail,
  listAdminPictures,
  reviewPicture,
} from "@/lib/admin-picture-api"

vi.mock("@/lib/admin-picture-api", () => ({
  getAdminPictureDetail: vi.fn(),
  listAdminPictures: vi.fn(),
  reviewPicture: vi.fn(),
}))

vi.mock("@/lib/picture-api", () => ({
  deletePicture: vi.fn(),
}))

const REVIEWING_RECORDS = [
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
  {
    id: "102",
    url: "https://example.com/night.jpg",
    thumbnailUrl: "https://example.com/night-thumb.jpg",
    name: "night",
    category: "street",
    introduction: "city lights",
    tags: ["street"],
    picWidth: 1600,
    picHeight: 900,
    reviewStatus: 0,
    reviewMessage: "",
    userId: "8",
    createTime: "2026-04-18 20:30:00",
    updateTime: "2026-04-18 20:30:00",
  },
]

describe("AdminReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAdminPictures).mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: REVIEWING_RECORDS.length,
      list: REVIEWING_RECORDS,
    })
  })

  test("loads picture detail and approves from the side panel", async () => {
    const user = userEvent.setup()

    vi.mocked(getAdminPictureDetail).mockResolvedValue(REVIEWING_RECORDS[0])
    vi.mocked(reviewPicture).mockResolvedValue({
      ...REVIEWING_RECORDS[0],
      reviewStatus: 1,
      reviewMessage: "审核通过",
    })

    render(<AdminReviewPage currentUserRole="admin" />)

    await screen.findByText("cover")

    await user.click(screen.getByRole("button", { name: "查看图片 cover 的审核详情" }))

    await waitFor(() => {
      expect(getAdminPictureDetail).toHaveBeenCalledWith("101")
    })

    expect(screen.getByRole("heading", { name: "图片详情" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "通过审核" }))

    await waitFor(() => {
      expect(reviewPicture).toHaveBeenCalledWith({
        id: "101",
        reviewStatus: 1,
        reviewMessage: undefined,
      })
    })

    expect(screen.getByText("已完成通过审核。")).toBeInTheDocument()
  })

  test("refetches records when switching review status filters", async () => {
    const user = userEvent.setup()

    render(<AdminReviewPage currentUserRole="admin" />)

    await screen.findByText("cover")
    await user.click(screen.getByRole("button", { name: "已通过" }))

    await waitFor(() => {
      expect(listAdminPictures).toHaveBeenLastCalledWith({
        pageNum: 1,
        pageSize: 20,
        reviewStatus: 1,
      })
    })
  })

  test("paginates locally when the backend returns more rows than the requested page size", async () => {
    const user = userEvent.setup()
    const oversizedRecordSet = Array.from({ length: 25 }, (_, index) => ({
      ...REVIEWING_RECORDS[0],
      id: String(101 + index),
      name: `cover-${index + 1}`,
    }))

    vi.mocked(listAdminPictures).mockResolvedValueOnce({
      pageNum: 1,
      pageSize: 20,
      total: oversizedRecordSet.length,
      list: oversizedRecordSet,
    })

    render(<AdminReviewPage currentUserRole="admin" />)

    await screen.findByText("cover-1")
    expect(screen.queryByText("cover-21")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "下一页" }))

    await waitFor(() => {
      expect(screen.getByText("cover-21")).toBeInTheDocument()
    })

    expect(listAdminPictures).toHaveBeenCalledTimes(1)
  })

  test("rejects multiple selected pictures with one shared message", async () => {
    const user = userEvent.setup()

    vi.mocked(reviewPicture)
      .mockResolvedValueOnce({
        ...REVIEWING_RECORDS[0],
        reviewStatus: 2,
        reviewMessage: "内容不符合要求",
      })
      .mockResolvedValueOnce({
        ...REVIEWING_RECORDS[1],
        reviewStatus: 2,
        reviewMessage: "内容不符合要求",
      })

    render(<AdminReviewPage currentUserRole="admin" />)

    await screen.findByText("cover")

    await user.click(screen.getByRole("checkbox", { name: "选择图片 101" }))
    await user.click(screen.getByRole("checkbox", { name: "选择图片 102" }))
    await user.click(screen.getByRole("button", { name: "批量拒绝" }))
    await user.type(screen.getByLabelText("批量审核意见"), "内容不符合要求")
    await user.click(screen.getByRole("button", { name: "确认批量拒绝" }))

    await waitFor(() => {
      expect(reviewPicture).toHaveBeenNthCalledWith(1, {
        id: "101",
        reviewStatus: 2,
        reviewMessage: "内容不符合要求",
      })
      expect(reviewPicture).toHaveBeenNthCalledWith(2, {
        id: "102",
        reviewStatus: 2,
        reviewMessage: "内容不符合要求",
      })
    })

    expect(screen.getByText("批量处理完成：成功 2 张")).toBeInTheDocument()
  })

  test("deletes the selected picture from the admin detail panel", async () => {
    const user = userEvent.setup()

    vi.mocked(getAdminPictureDetail).mockResolvedValue(REVIEWING_RECORDS[0])
    vi.mocked(deletePicture).mockResolvedValue({ id: "101" })
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)

    render(<AdminReviewPage currentUserRole="admin" />)

    await screen.findByText("cover")
    await user.click(screen.getByRole("button", { name: "查看图片 cover 的审核详情" }))
    await screen.findByRole("heading", { name: "图片详情" })
    await user.click(screen.getByRole("button", { name: "删除图片" }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "确认删除这张图片？\n删除后前台列表将不再展示，且无法继续查看该图片。",
      )
      expect(deletePicture).toHaveBeenCalledWith("101")
    })

    expect(screen.queryByText("cover")).not.toBeInTheDocument()
    expect(screen.getByText("已删除图片 101。")).toBeInTheDocument()
  })
})
