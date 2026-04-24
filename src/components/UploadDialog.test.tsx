const { mockedUploadPictureByUrl, mockedUploadPictureFile } = vi.hoisted(() => ({
  mockedUploadPictureByUrl: vi.fn(),
  mockedUploadPictureFile: vi.fn(),
}))

vi.mock("@/lib/picture-api", () => ({
  uploadPictureByUrl: mockedUploadPictureByUrl,
  uploadPictureFile: mockedUploadPictureFile,
}))

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { UploadDialog } from "./UploadDialog"

function createUploadedPhoto() {
  return {
    id: "1",
    src: "https://example.com/photo.jpg",
    thumbnailSrc: "https://example.com/photo-thumb.jpg",
    width: 1200,
    height: 900,
    alt: "Uploaded photo",
    photographer: "User",
    category: "travel",
    summary: "",
    location: "",
    tags: [],
    reviewStatus: 1,
  }
}

describe("UploadDialog task events", () => {
  beforeEach(() => {
    mockedUploadPictureByUrl.mockReset()
    mockedUploadPictureFile.mockReset()
  })

  it("emits upload lifecycle events for real file progress without closing itself on success", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onUploaded = vi.fn()
    const onUploadTaskEvent = vi.fn()

    mockedUploadPictureFile.mockImplementation(async (params) => {
      params.onProgress?.({
        loaded: 400,
        total: 1000,
        progress: 0.4,
      })

      return createUploadedPhoto()
    })

    render(
      <UploadDialog
        open
        onClose={onClose}
        onUploaded={onUploaded}
        onUploadTaskEvent={onUploadTaskEvent}
      />,
    )

    await user.upload(
      screen.getByTestId("upload-file-input"),
      new File(["demo"], "demo.png", { type: "image/png" }),
    )
    await user.type(screen.getByTestId("upload-name-input"), "Demo")
    await user.click(screen.getByTestId("upload-submit"))

    await waitFor(() => {
      expect(mockedUploadPictureFile).toHaveBeenCalled()
    })

    expect(onUploadTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "start",
        mode: "file",
      }),
    )
    expect(onUploadTaskEvent).toHaveBeenCalledWith({
      type: "progress",
      mode: "file",
      progress: {
        loaded: 400,
        total: 1000,
        progress: 0.4,
      },
    })

    await waitFor(() => {
      expect(onUploadTaskEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          mode: "file",
        }),
      )
    })

    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it("reports upload failures back to the shell task layer", async () => {
    const user = userEvent.setup()
    const onUploadTaskEvent = vi.fn()

    mockedUploadPictureFile.mockRejectedValue(new Error("Upload exploded"))

    render(
      <UploadDialog
        open
        onClose={vi.fn()}
        onUploaded={vi.fn()}
        onUploadTaskEvent={onUploadTaskEvent}
      />,
    )

    await user.upload(
      screen.getByTestId("upload-file-input"),
      new File(["demo"], "demo.png", { type: "image/png" }),
    )
    await user.click(screen.getByTestId("upload-submit"))

    await waitFor(() => {
      expect(onUploadTaskEvent).toHaveBeenCalledWith({
        type: "error",
        mode: "file",
        message: "Upload exploded",
      })
    })
  })
})
