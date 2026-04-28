import { mapBackendPictureToPhoto } from "@/lib/backend-picture"

describe("mapBackendPictureToPhoto", () => {
  test("preserves the photographer avatar from the backend user payload", () => {
    const photo = mapBackendPictureToPhoto({
      id: 1,
      url: "https://example.com/photo.jpg",
      picWidth: 1600,
      picHeight: 1000,
      userId: 9,
      user: {
        id: 9,
        userName: "Avery Stone",
        userAvatar: "https://example.com/avatar.jpg",
      },
    })

    expect(photo.userAvatar).toBe("https://example.com/avatar.jpg")
  })

  test("does not map createTime into the shooting location field", () => {
    const photo = mapBackendPictureToPhoto({
      id: 2,
      url: "https://example.com/photo.jpg",
      picWidth: 1600,
      picHeight: 1000,
      createTime: "2026-04-28 09:30:00",
    })

    expect(photo.location).toBe("")
    expect(photo.createdAt).toBe("2026-04-28 09:30:00")
  })
})
