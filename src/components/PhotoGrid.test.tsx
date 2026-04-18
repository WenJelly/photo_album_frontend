import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PhotoGrid } from "@/components/PhotoGrid"
import { buildJustifiedRows } from "@/lib/gallery-layout"

const photos = [
  {
    id: "a",
    src: "/a.jpg",
    width: 1800,
    height: 1200,
    alt: "A",
    photographer: "One",
    category: "nature" as const,
    summary: "A",
    location: "A",
    tags: ["自然光", "薄雾", "山野"],
  },
  {
    id: "b",
    src: "/b.jpg",
    width: 2200,
    height: 1400,
    alt: "B",
    photographer: "Two",
    category: "architecture" as const,
    summary: "B",
    location: "B",
    tags: ["几何", "结构", "材质"],
  },
  {
    id: "c",
    src: "/c.jpg",
    width: 1600,
    height: 1200,
    alt: "C",
    photographer: "Three",
    category: "portrait" as const,
    summary: "C",
    location: "C",
    tags: ["凝视", "近景", "静态"],
  },
  {
    id: "d",
    src: "/d.jpg",
    width: 1200,
    height: 1800,
    alt: "D",
    photographer: "Four",
    category: "street" as const,
    summary: "D",
    location: "D",
    tags: ["夜景", "街头", "反光"],
  },
  {
    id: "e",
    src: "/e.jpg",
    width: 2400,
    height: 1600,
    alt: "E",
    photographer: "Five",
    category: "abstract" as const,
    summary: "E",
    location: "E",
    tags: ["色块", "肌理", "实验"],
  },
]

describe("PhotoGrid", () => {
  it("shows a calm empty state with a reset action", async () => {
    const user = userEvent.setup()
    const onClearFilter = vi.fn()

    render(<PhotoGrid photos={[]} onClearFilter={onClearFilter} />)

    expect(screen.getByText(/当前筛选条件下还没有可浏览的作品。/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /清除筛选/i }))

    expect(onClearFilter).toHaveBeenCalledTimes(1)
  })

  it("uses the computed natural width for the last row instead of stretching it", () => {
    const { container } = render(<PhotoGrid photos={photos} />)
    const rows = buildJustifiedRows(photos, {
      containerWidth: 1280,
      gap: 10,
      targetRowHeight: 314,
      minRowHeight: 254,
      maxRowHeight: 394,
    })
    const renderedRows = container.firstElementChild?.children
    const lastRenderedRow = renderedRows?.item((renderedRows.length ?? 1) - 1) as HTMLElement | null
    const lastComputedRow = rows.at(-1)

    expect(lastComputedRow?.isLastRow).toBe(true)
    expect(lastComputedRow?.width).toBeLessThan(1280)
    expect(lastRenderedRow).toHaveStyle(`width: ${lastComputedRow?.width}px`)
    expect(container.firstElementChild).toHaveClass("space-y-2")
  })

  it("renders photo cards without rounded corners", () => {
    render(<PhotoGrid photos={photos} />)

    expect(screen.getByRole("button", { name: /A/i }).className).not.toMatch(/rounded-\[/)
    expect(screen.getByRole("button", { name: /A/i })).toHaveClass("rounded-none")
  })

  it("aggregates overflow tags on photo cards", () => {
    render(<PhotoGrid photos={photos} />)
    const firstCard = screen.getByRole("button", { name: /A/i })

    expect(within(firstCard).getByText("自然光")).toBeInTheDocument()
    expect(within(firstCard).getByText("薄雾")).toBeInTheDocument()
    expect(within(firstCard).getByText("+1")).toBeInTheDocument()
  })
})
