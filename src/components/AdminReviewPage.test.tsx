import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { mockedDeletePicture } = vi.hoisted(() => ({
  mockedDeletePicture: vi.fn(),
}))

const {
  mockedListAdminPictures,
  mockedReviewPicture,
} = vi.hoisted(() => ({
  mockedListAdminPictures: vi.fn(),
  mockedReviewPicture: vi.fn(),
}))

vi.mock("@/lib/admin-picture-api", () => ({
  listAdminPictures: mockedListAdminPictures,
  reviewPicture: mockedReviewPicture,
}))

vi.mock("@/lib/picture-api", () => ({
  deletePicture: mockedDeletePicture,
}))

import { AdminReviewPage } from "./AdminReviewPage"

function createAdminPictureRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    url: "https://example.com/photo.jpg",
    thumbnailUrl: "https://example.com/photo-thumb.jpg",
    name: "Sunset",
    introduction: "Golden hour",
    category: "风景",
    tags: ["sunset"],
    picWidth: 1200,
    picHeight: 1200,
    reviewStatus: 0,
    reviewMessage: "待补充说明",
    userId: "9",
    user: {
      id: "9",
      userName: "Uploader",
    },
    createTime: "2026-04-23 10:00:00",
    updateTime: "2026-04-23 10:00:00",
    ...overrides,
  }
}

describe("AdminReviewPage", () => {
  beforeEach(() => {
    mockedDeletePicture.mockReset()
    mockedListAdminPictures.mockReset()
    mockedReviewPicture.mockReset()
  })

  it("opens detail directly from list data and updates the selected record after review", async () => {
    const pendingRecord = createAdminPictureRecord()
    const approvedRecord = createAdminPictureRecord({
      reviewStatus: 1,
      reviewMessage: "",
    })

    mockedListAdminPictures.mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 1,
      list: [pendingRecord],
    })
    mockedReviewPicture.mockResolvedValue(approvedRecord)

    render(<AdminReviewPage currentUserRole="admin" />)

    const openDetailButton = await screen.findByRole("button", {
      name: "查看图片 Sunset 的审核详情",
    })

    expect(mockedListAdminPictures).toHaveBeenCalledTimes(1)

    await userEvent.click(openDetailButton)

    expect(screen.getByRole("heading", { name: "图片详情" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("待补充说明")).toBeInTheDocument()
    expect(screen.getAllByText("Uploader").length).toBeGreaterThan(0)
    expect(mockedListAdminPictures).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole("button", { name: "通过审核" }))

    await waitFor(() => {
      expect(mockedReviewPicture).toHaveBeenCalledWith({
        id: "1",
        reviewStatus: 1,
        reviewMessage: "待补充说明",
      })
    })

    await waitFor(() => {
      expect(screen.getByText("已完成通过审核。")).toBeInTheDocument()
      expect(screen.getAllByText("已通过").length).toBeGreaterThan(0)
    })
  })
})
