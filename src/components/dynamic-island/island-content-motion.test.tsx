import { render, screen } from "@testing-library/react"

import type { AuthUser } from "@/contexts/auth-context"
import type { IslandTask } from "@/types/island-task"

import { IslandNavigationContent } from "./IslandNavigationContent"
import { IslandTaskPanel } from "./IslandTaskPanel"

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: "7",
    userEmail: "user@example.com",
    userName: "OverflowingProfileName",
    userAvatar: "https://example.com/avatar.jpg",
    userProfile: "",
    userRole: "user",
    ...overrides,
  }
}

function createTask(overrides?: Partial<IslandTask>): IslandTask {
  return {
    id: "task-1",
    type: "upload",
    phase: "transferring",
    status: "running",
    title: "Uploading 3 large archival images to the processing queue",
    summary: "Preparing previews, extracting palette data, and syncing metadata to the gallery timeline.",
    progress: 0.45,
    logs: ["[upload] preparing asset", "[upload] streaming bytes"],
    metric: {
      label: "Demo QPS",
      value: "312/s",
    },
    terminalOpen: false,
    ...overrides,
  }
}

describe("dynamic island content motion constraints", () => {
  it("locks compact brand copy and avatar geometry before the shell narrows", () => {
    render(
      <IslandNavigationContent
        canRunStressDemo={false}
        compact
        currentPage="gallery"
        isLoggedIn
        onAdminReviewClick={vi.fn()}
        onCompactToggle={vi.fn()}
        onGalleryClick={vi.fn()}
        onHomeClick={vi.fn()}
        onLoginClick={vi.fn()}
        onLogoutClick={vi.fn()}
        onMyProfileClick={vi.fn()}
        onRunStressDemo={vi.fn()}
        onUploadClick={vi.fn()}
        reducedMotion={false}
        user={createUser()}
      />,
    )

    expect(screen.getByText("WenJelly")).toHaveClass("dynamic-island-text-container")
    expect(screen.getByText("Standby Capsule")).toHaveClass("dynamic-island-text-container")
    expect(screen.queryByTestId("dynamic-island-shared-logo")).not.toBeInTheDocument()
    expect(screen.getByTestId("dynamic-island-toggle")).toHaveClass("dynamic-island-content-offset")
    expect(screen.queryByTestId("dynamic-island-shared-avatar")).not.toBeInTheDocument()
    expect(screen.getByTestId("dynamic-island-avatar-frame")).toHaveClass("dynamic-island-avatar-frame")

    const compactAvatar = document.querySelector('img[src="https://example.com/avatar.jpg"]')
    expect(compactAvatar).toHaveClass("dynamic-island-geometry-lock")
    expect(compactAvatar).toHaveAttribute("data-testid", "dynamic-island-avatar-media")
  })

  it("keeps expanded actions single-line and protects profile media from flex compression", () => {
    render(
      <IslandNavigationContent
        canRunStressDemo={false}
        compact={false}
        currentPage="home"
        isLoggedIn
        onAdminReviewClick={vi.fn()}
        onCompactToggle={vi.fn()}
        onGalleryClick={vi.fn()}
        onHomeClick={vi.fn()}
        onLoginClick={vi.fn()}
        onLogoutClick={vi.fn()}
        onMyProfileClick={vi.fn()}
        onRunStressDemo={vi.fn()}
        onUploadClick={vi.fn()}
        reducedMotion={false}
        user={createUser()}
      />,
    )

    expect(screen.getByRole("button", { name: "OverflowingProfileName" })).toHaveClass("dynamic-island-geometry-lock")
    expect(screen.getByText("OverflowingProfileName")).toHaveClass("dynamic-island-text-container")
    expect(screen.queryByTestId("dynamic-island-shared-logo")).not.toBeInTheDocument()
    expect(screen.queryByTestId("dynamic-island-shared-avatar")).not.toBeInTheDocument()
    expect(screen.getByTestId("dynamic-island-avatar-frame")).toHaveClass("dynamic-island-avatar-frame")
    expect(screen.getByRole("navigation", { name: "Primary" }).closest(".dynamic-island-nav")).toHaveClass(
      "dynamic-island-content-offset",
    )

    const userAvatar = document.querySelector('img[src="https://example.com/avatar.jpg"]')
    expect(userAvatar).toHaveClass("dynamic-island-geometry-lock")
    expect(userAvatar).toHaveAttribute("data-testid", "dynamic-island-avatar-media")
  })

  it("forces task titles and summaries to truncate while status chips and controls refuse squashing", () => {
    render(
      <IslandTaskPanel
        onDismiss={vi.fn()}
        onPreviewPhoto={vi.fn()}
        onToggleTerminal={vi.fn()}
        reducedMotion={false}
        task={createTask()}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Uploading 3 large archival images to the processing queue" }),
    ).toHaveClass("dynamic-island-text-container")
    expect(
      screen.getByText("Preparing previews, extracting palette data, and syncing metadata to the gallery timeline."),
    ).toHaveClass("dynamic-island-text-container")
    expect(screen.getByText("上传中")).toHaveClass("dynamic-island-geometry-lock")
    expect(screen.getByRole("button", { name: "Mini Terminal" })).toHaveClass("dynamic-island-geometry-lock")
  })

  it("renders upload phase labels instead of generic task debug labels", () => {
    render(
      <IslandTaskPanel
        onDismiss={vi.fn()}
        onPreviewPhoto={vi.fn()}
        onToggleTerminal={vi.fn()}
        reducedMotion={false}
        task={createTask({
          phase: "processing",
          progress: null,
          title: "服务器处理中",
          summary: "文件已发送完成，正在等待后端确认。",
          metric: {
            label: "阶段",
            value: "处理中",
          },
        })}
      />,
    )

    expect(screen.getByText("上传任务")).toBeInTheDocument()
    expect(screen.getByText("处理中", { selector: ".dynamic-island-status" })).toHaveClass(
      "dynamic-island-geometry-lock",
    )
    expect(screen.getAllByText("阶段")).toHaveLength(2)
    expect(screen.getByText("服务器处理中")).toBeInTheDocument()
    expect(screen.getByText("处理中...")).toBeInTheDocument()
  })

  it("renders a stopped progress state for failed uploads instead of an animated indeterminate bar", () => {
    render(
      <IslandTaskPanel
        onDismiss={vi.fn()}
        onPreviewPhoto={vi.fn()}
        onToggleTerminal={vi.fn()}
        reducedMotion={false}
        task={createTask({
          phase: "failed",
          progress: null,
          status: "error",
        })}
      />,
    )

    expect(screen.getByTestId("island-task-progress-stopped")).toBeInTheDocument()
    expect(screen.queryByTestId("island-task-progress-indeterminate")).not.toBeInTheDocument()
  })
})
