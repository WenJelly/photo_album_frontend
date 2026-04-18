import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import App from "@/App"
import { photos } from "@/data/photos"

function renderAt(pathname: string) {
  window.history.pushState({}, "", pathname)
  return render(<App />)
}

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
  })

  it("renders a full-bleed hero with the navigation overlaying it and no hero copy", () => {
    renderAt("/")
    const banner = screen.getByRole("banner")
    const shell = screen.getByTestId("app-shell")

    expect(shell).toHaveClass("h-screen")
    expect(shell).toHaveClass("overflow-hidden")
    expect(within(banner).getByRole("heading", { level: 1, name: /wenjelly/i })).toBeInTheDocument()
    expect(within(banner).getByRole("button", { name: /首页/i })).toBeInTheDocument()
    expect(within(banner).getByRole("button", { name: /图库/i })).toBeInTheDocument()
    expect(within(banner).getByRole("button", { name: /登录/i })).toBeInTheDocument()
    expect(within(banner).getByText(/在线影像档案/i)).toBeInTheDocument()
    expect(banner).toHaveClass("absolute")
    expect(banner).toHaveClass("bg-white/18")
    expect(banner).toHaveClass("backdrop-blur-2xl")
    expect(screen.getByTestId("home-hero-shell")).toHaveClass("pt-0")
    expect(screen.getByTestId("home-hero-shell")).toHaveClass("pb-0")
    expect(screen.getByTestId("home-hero")).toHaveClass("min-h-screen")
    expect(screen.getByTestId("home-hero")).toHaveStyle({
      backgroundImage: expect.stringContaining("hero.png"),
    })
    expect(screen.queryByText(/30 幅作品/)).not.toBeInTheDocument()
    expect(screen.queryByText(/5 个主题/)).not.toBeInTheDocument()
    expect(screen.getByTestId("home-hero")).toBeEmptyDOMElement()
    expect(screen.queryByRole("button", { name: /进入图库/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2, name: /精选预览/i })).not.toBeInTheDocument()
    expect(screen.queryByAltText(photos[0].alt)).not.toBeInTheDocument()
  })

  it("navigates to the gallery route from the header", async () => {
    const user = userEvent.setup()

    renderAt("/")
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: /图库/i }))

    expect(window.location.pathname).toBe("/gallery")
    expect(screen.getByAltText(photos[0].alt)).toBeInTheDocument()
  })

  it("opens the auth card from the header login button", async () => {
    const user = userEvent.setup()

    renderAt("/")
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: /登录/i }))

    expect(screen.getByRole("dialog", { name: /登录/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument()
  })

  it("resets scroll position when switching back to the home hero", async () => {
    const user = userEvent.setup()
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {})

    renderAt("/gallery")
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: /首页/i }))

    expect(window.location.pathname).toBe("/")
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "auto" })

    scrollToSpy.mockRestore()
  })

  it("keeps a stable scrollbar gutter on the gallery page to avoid layout jitter when filters change", () => {
    renderAt("/gallery")

    expect(document.documentElement.style.scrollbarGutter).toBe("stable both-edges")
  })

  it("removes the gallery summary block and keeps the page focused on filters and works", () => {
    renderAt("/gallery")
    const main = screen.getByRole("main")

    expect(screen.getByRole("toolbar", { name: /作品分类/i })).toBeInTheDocument()
    expect(main.firstElementChild).toHaveClass("px-4")
    expect(main.firstElementChild).toHaveClass("pt-4")
    expect(screen.queryByText(/当前分类/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/作品总量/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2, name: /wenjelly 图库/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/所有作品都基于原始宽高进行等高瀑布流编排/i)).not.toBeInTheDocument()
  })

  it("filters the gallery by category", async () => {
    const user = userEvent.setup()

    renderAt("/gallery")
    await user.click(screen.getAllByRole("button", { name: /人像/i })[0])

    expect(screen.getAllByRole("button", { name: /人像/i })[0]).toHaveAttribute("aria-pressed", "true")
    expect(screen.getAllByRole("img")).toHaveLength(6)
  })

  it("uses a segmented filter with the active state exposed to assistive technology", async () => {
    const user = userEvent.setup()

    renderAt("/gallery")
    const natureButton = screen.getAllByRole("button", { name: /自然/i })[0]

    await user.click(natureButton)

    expect(natureButton).toHaveAttribute("aria-pressed", "true")
  })

  it("opens an enlarged preview with a right-side info panel when a photo is clicked", async () => {
    const user = userEvent.setup()

    renderAt("/gallery")
    const card = screen.getByAltText(photos[0].alt).closest("button")

    expect(card).not.toBeNull()
    await user.click(card!)

    expect(screen.getByRole("dialog", { name: /图片预览/i })).toBeInTheDocument()
    expect(screen.getByRole("complementary")).toBeInTheDocument()
  })

  it("keeps preview navigation within the currently filtered set", async () => {
    const user = userEvent.setup()

    renderAt("/gallery")
    await user.click(screen.getAllByRole("button", { name: /人像/i })[0])

    const portraitCard = screen.getByAltText(photos[11].alt).closest("button")

    expect(portraitCard).not.toBeNull()
    await user.click(portraitCard!)

    await user.click(screen.getByRole("button", { name: /下一张图片/i }))

    expect(screen.getByRole("heading", { name: photos[12].alt })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: photos[0].alt })).not.toBeInTheDocument()
  })

  it("keeps the top-level landmarks accessible without rendering the footer", () => {
    renderAt("/")

    expect(screen.getByRole("banner")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /返回顶部/i })).not.toBeInTheDocument()
  })
})
