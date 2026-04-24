import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { mockedDeletePicture } = vi.hoisted(() => ({
  mockedDeletePicture: vi.fn(),
}))

const { mockedListAdminPictures, mockedReviewPicture } = vi.hoisted(() => ({
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
    category: "landscape",
    tags: ["sunset"],
    picWidth: 1200,
    picHeight: 1200,
    reviewStatus: 0,
    reviewMessage: "Pending note",
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

    const openDetailButton = await screen.findByRole("button", { name: /Sunset/ })

    expect(mockedListAdminPictures).toHaveBeenCalledTimes(1)

    await userEvent.click(openDetailButton)

    expect(screen.getByDisplayValue("Pending note")).toBeInTheDocument()
    expect(screen.getAllByText("Uploader").length).toBeGreaterThan(0)

    const actionButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent && button.textContent.length > 0)
      .slice(-3)

    await userEvent.click(actionButtons[0]!)

    await waitFor(() => {
      expect(mockedReviewPicture).toHaveBeenCalledWith({
        id: "1",
        reviewStatus: 1,
        reviewMessage: "Pending note",
      })
    })
  })

  it("requests all statuses when the first filter button is selected", async () => {
    mockedListAdminPictures.mockResolvedValue({
      pageNum: 1,
      pageSize: 20,
      total: 1,
      list: [createAdminPictureRecord()],
    })

    render(<AdminReviewPage currentUserRole="admin" />)

    await screen.findByRole("button", { name: /Sunset/ })

    const filterButtons = screen.getAllByRole("button").slice(0, 4)

    await userEvent.click(filterButtons[0]!)

    await waitFor(() => {
      expect(mockedListAdminPictures).toHaveBeenLastCalledWith(
        expect.objectContaining({
          reviewStatus: -1,
        }),
      )
    })
  })
})
