import { canDeletePhoto } from "@/lib/photo-permissions"

describe("canDeletePhoto", () => {
  test("allows admins to delete any picture", () => {
    expect(
      canDeletePhoto(
        {
          id: "9",
          userAccount: "admin@example.com",
          userName: "管理员",
          userAvatar: "",
          userProfile: "",
          userRole: "admin",
        },
        { userId: "1" },
      ),
    ).toBe(true)
  })

  test("allows normal users to delete only their own pictures", () => {
    expect(
      canDeletePhoto(
        {
          id: "7",
          userAccount: "user@example.com",
          userName: "作者",
          userAvatar: "",
          userProfile: "",
          userRole: "user",
        },
        { userId: "7" },
      ),
    ).toBe(true)

    expect(
      canDeletePhoto(
        {
          id: "7",
          userAccount: "user@example.com",
          userName: "作者",
          userAvatar: "",
          userProfile: "",
          userRole: "user",
        },
        { userId: "8" },
      ),
    ).toBe(false)
  })
})
