const { mockedPost } = vi.hoisted(() => ({
  mockedPost: vi.fn(),
}))

vi.mock("./request", async () => {
  const actual = await vi.importActual<typeof import("./request")>("./request")

  return {
    ...actual,
    default: {
      post: mockedPost,
    },
  }
})

import { login, register } from "./auth-api"

describe("auth-api", () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it("maps login to the documented response fields", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        message: "success",
        data: {
          token: "jwt-token",
          id: "1",
          userEmail: "test@example.com",
          userName: "User",
          userAvatar: "",
          userProfile: "",
          userRole: "user",
          createTime: "2026-04-23 10:00:00",
          updateTime: "2026-04-23 10:00:00",
        },
      },
    })

    const result = await login({
      userEmail: "test@example.com",
      userPassword: "123456",
    })

    expect(mockedPost).toHaveBeenCalledWith("/api/user/login", {
      userEmail: "test@example.com",
      userPassword: "123456",
    })
    expect(result.data.userEmail).toBe("test@example.com")
  })

  it("registers against the documented endpoint", async () => {
    mockedPost.mockResolvedValue({
      data: {
        code: 200,
        message: "success",
        data: {
          id: "12",
        },
      },
    })

    const result = await register({
      userEmail: "test@example.com",
      userPassword: "123456",
      userCheckPassword: "123456",
    })

    expect(mockedPost).toHaveBeenCalledWith("/api/user/register", {
      userEmail: "test@example.com",
      userPassword: "123456",
      userCheckPassword: "123456",
    })
    expect(result.data.id).toBe("12")
  })
})
