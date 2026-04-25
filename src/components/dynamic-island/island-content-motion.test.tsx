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
    expect(screen.getByText("Live")).toHaveClass("dynamic-island-geometry-lock")
    expect(screen.getByRole("button", { name: "Mini Terminal" })).toHaveClass("dynamic-island-geometry-lock")
  })
})
