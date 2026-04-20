import request, { unwrapApiResponse } from "@/lib/request"
import { deletePicture } from "@/lib/picture-api"

vi.mock("@/lib/request", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  unwrapApiResponse: vi.fn((payload) => payload),
}))

describe("picture-api delete", () => {
  const LARGE_PICTURE_ID = "1921565896585154562"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("deletes a picture through the protected delete endpoint", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: {
        data: {
          id: "101",
        },
      },
    })

    await expect(deletePicture("101")).resolves.toEqual({ id: "101" })

    expect(request.post).toHaveBeenCalledWith("/api/picture/delete", {
      id: "101",
    })
    expect(unwrapApiResponse).toHaveBeenCalled()
  })

  test("preserves large snowflake ids when deleting pictures", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: {
        data: {
          id: LARGE_PICTURE_ID,
        },
      },
    })

    await expect(deletePicture(LARGE_PICTURE_ID)).resolves.toEqual({ id: LARGE_PICTURE_ID })

    expect(request.post).toHaveBeenCalledWith("/api/picture/delete", {
      id: LARGE_PICTURE_ID,
    })
  })

  test("rejects invalid picture ids before requesting deletion", async () => {
    await expect(deletePicture("0")).rejects.toThrow("图片参数错误")

    expect(request.post).not.toHaveBeenCalled()
  })
})
