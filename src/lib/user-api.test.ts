const { mockedGet, mockedPatch, mockedPost } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPatch: vi.fn(),
  mockedPost: vi.fn(),
}))

vi.mock("./request", async () => {
  const actual = await vi.importActual<typeof import("./request")>("./request")

  return {
    ...actual,
    default: {
      get: mockedGet,
      patch: mockedPatch,
      post: mockedPost,
    },
  }
})

import { getMyProfile, getUserProfile, updateMyProfile } from "./user-api"

describe("user-api", () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPatch.mockReset()
    mockedPost.mockReset()
  })

  it("loads my profile through the documented detail endpoint", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        data: {
          id: "1",
          userName: "User",
          userEmail: "test@example.com",
          userAvatar: "",
          userProfile: "",
          userRole: "user",
          pictureCount: 12,
        },
      },
    })

    const result = await getMyProfile()

    expect(mockedPost).toHaveBeenCalledWith("/api/user/get/detail", {})
    expect(mockedGet).not.toHaveBeenCalled()
    expect(result.id).toBe("1")
    expect(result.pictureCount).toBe(12)
  })

  it("loads another user's profile by id through the documented detail endpoint", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        data: {
          id: "9",
          userName: "Other",
          userRole: "user",
        },
      },
    })

    const result = await getUserProfile("9")

    expect(mockedPost).toHaveBeenCalledWith("/api/user/get/detail", {
      id: "9",
    })
    expect(result.id).toBe("9")
  })

  it("updates my profile through the documented update endpoint", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        data: {
          id: "1",
          userName: "Updated",
          userAvatar: "https://example.com/avatar.jpg",
          userProfile: "Intro",
          userRole: "user",
        },
      },
    })

    const result = await updateMyProfile({
      id: "1",
      userName: " Updated ",
      userAvatar: " https://example.com/avatar.jpg ",
      userProfile: " Intro ",
    })

    expect(mockedPost).toHaveBeenCalledWith("/api/user/update", {
      id: "1",
      userName: "Updated",
      userAvatar: "https://example.com/avatar.jpg",
      userProfile: "Intro",
    })
    expect(mockedPatch).not.toHaveBeenCalled()
    expect(result.userName).toBe("Updated")
  })
})
