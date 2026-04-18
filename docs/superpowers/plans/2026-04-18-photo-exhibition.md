# Photo Exhibition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the current gallery into a curated exhibition homepage with a refined layout, a redesigned equal-height justified gallery algorithm, and a shared-height preview panel.

**Architecture:** Keep the existing React + Vite + Tailwind stack, split the page into small presentation components, move gallery row calculation into a reusable layout utility, and cover the layout engine plus primary interactions with tests. The gallery stays data-driven, with the page shell, grid, and lightbox reworked around the approved exhibition spec.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Base UI button, Vitest, Testing Library, jsdom

---

## File structure

- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `src/components/CategoryFilter.tsx`
- Modify: `src/components/PhotoGrid.tsx`
- Modify: `src/components/Lightbox.tsx`
- Modify: `src/data/photos.ts`
- Modify: `src/types/photo.ts`
- Delete: `src/App.css`
- Create: `src/lib/gallery-layout.ts`
- Create: `src/lib/gallery-layout.test.ts`
- Create: `src/test/setup.ts`
- Create: `src/components/ExhibitionHeader.tsx`
- Create: `src/components/HeroIntro.tsx`
- Create: `src/components/GallerySummary.tsx`
- Create: `src/App.test.tsx`
- Create: `src/components/PhotoGrid.test.tsx`
- Create: `src/components/Lightbox.test.tsx`

### Responsibility map

- `src/lib/gallery-layout.ts`: pure equal-height justified gallery algorithm with dynamic-programming row partitioning.
- `src/lib/gallery-layout.test.ts`: layout regression coverage for row packing, final-row handling, and width stability.
- `src/App.tsx`: top-level state orchestration for category filtering, selection, summary counts, and page composition.
- `src/components/ExhibitionHeader.tsx`: lightweight sticky header and top-level actions.
- `src/components/HeroIntro.tsx`: curatorial intro copy and entry action.
- `src/components/GallerySummary.tsx`: collection stats and current browsing context.
- `src/components/CategoryFilter.tsx`: segmented category control with active and reset affordances.
- `src/components/PhotoGrid.tsx`: gallery container, responsive row rendering, empty state, and per-photo cards.
- `src/components/Lightbox.tsx`: shared-height desktop preview shell, mobile fallback, keyboard and overlay behavior.
- `src/App.test.tsx`: page-shell behavior around filter changes and top-level landmarks.
- `src/components/PhotoGrid.test.tsx`: empty-state behavior for the gallery component when no works are available.
- `src/components/Lightbox.test.tsx`: preview interaction coverage for keyboard navigation, close behavior, and scroll locking.
- `src/index.css`: design tokens, base surfaces, and reusable exhibition utility classes.

### Notes before execution

- The current branch is `master`. The human explicitly asked to execute in the current workspace, so implementation may proceed here.
- The worktree is dirty. Only stage files touched by this plan.
- The current project has no test runner. Task 1 adds test tooling before production-code TDD begins.

## Task 1: Add test tooling and replace the gallery layout engine

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/lib/gallery-layout.ts`
- Create: `src/lib/gallery-layout.test.ts`

- [ ] **Step 1: Add the failing layout tests**

```ts
// src/lib/gallery-layout.test.ts
import { describe, expect, it } from "vitest"

import { buildJustifiedRows } from "@/lib/gallery-layout"

const landscapeSet = [
  { id: "a", width: 1800, height: 1200 },
  { id: "b", width: 2200, height: 1400 },
  { id: "c", width: 1600, height: 1200 },
  { id: "d", width: 1200, height: 1800 },
  { id: "e", width: 2400, height: 1600 },
]

describe("buildJustifiedRows", () => {
  it("balances rows close to the target height", () => {
    const rows = buildJustifiedRows(landscapeSet, {
      containerWidth: 1280,
      gap: 16,
      targetRowHeight: 280,
      minRowHeight: 220,
      maxRowHeight: 360,
    })

    expect(rows).toHaveLength(2)
    expect(rows[0].height).toBeGreaterThanOrEqual(220)
    expect(rows[0].height).toBeLessThanOrEqual(360)
    expect(rows[1].height).toBeLessThanOrEqual(280)
  })

  it("keeps the last row natural instead of force-filling the container", () => {
    const rows = buildJustifiedRows(landscapeSet.slice(0, 3), {
      containerWidth: 1440,
      gap: 20,
      targetRowHeight: 320,
      minRowHeight: 220,
      maxRowHeight: 380,
    })

    const lastRow = rows.at(-1)

    expect(lastRow).toBeDefined()
    expect(lastRow?.isLastRow).toBe(true)
    expect(lastRow?.width).toBeLessThan(1440)
  })

  it("recomputes row groups when the container becomes narrower", () => {
    const wideRows = buildJustifiedRows(landscapeSet, {
      containerWidth: 1320,
      gap: 18,
      targetRowHeight: 290,
      minRowHeight: 220,
      maxRowHeight: 360,
    })
    const narrowRows = buildJustifiedRows(landscapeSet, {
      containerWidth: 720,
      gap: 18,
      targetRowHeight: 250,
      minRowHeight: 180,
      maxRowHeight: 300,
    })

    expect(wideRows).toHaveLength(2)
    expect(narrowRows.length).toBeGreaterThan(wideRows.length)
    expect(narrowRows.every((row) => row.height >= 180)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the layout test to verify it fails**

Run: `npx vitest run src/lib/gallery-layout.test.ts`

Expected: FAIL because `vitest` is not installed and `@/lib/gallery-layout` does not exist yet.

- [ ] **Step 3: Add test tooling and scripts**

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

```ts
// vite.config.ts
import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
})
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest"
```

- [ ] **Step 4: Implement the minimal layout utility**

```ts
// src/lib/gallery-layout.ts
export interface LayoutPhoto {
  id: string
  width: number
  height: number
}

export interface LayoutOptions {
  containerWidth: number
  gap: number
  targetRowHeight: number
  minRowHeight: number
  maxRowHeight: number
}

export interface JustifiedRow<T extends LayoutPhoto> {
  photos: T[]
  height: number
  width: number
  isLastRow: boolean
}

function getRowHeight(photos: LayoutPhoto[], containerWidth: number, gap: number) {
  const ratioSum = photos.reduce((sum, photo) => sum + photo.width / photo.height, 0)
  return (containerWidth - gap * (photos.length - 1)) / ratioSum
}

function getRowWidth(photos: LayoutPhoto[], height: number, gap: number) {
  const contentWidth = photos.reduce((sum, photo) => sum + (photo.width / photo.height) * height, 0)
  return contentWidth + gap * (photos.length - 1)
}

export function buildJustifiedRows<T extends LayoutPhoto>(
  photos: T[],
  options: LayoutOptions
): JustifiedRow<T>[] {
  if (!photos.length || options.containerWidth <= 0) {
    return []
  }

  const { containerWidth, gap, targetRowHeight, minRowHeight, maxRowHeight } = options
  const maxItemsPerRow = containerWidth < 640 ? 2 : containerWidth < 1024 ? 3 : 5
  const costs = new Array<number>(photos.length + 1).fill(Number.POSITIVE_INFINITY)
  const nextBreak = new Array<number>(photos.length).fill(photos.length)

  costs[photos.length] = 0

  for (let start = photos.length - 1; start >= 0; start -= 1) {
    for (let end = start + 1; end <= Math.min(photos.length, start + maxItemsPerRow); end += 1) {
      const rowPhotos = photos.slice(start, end)
      const isLastRow = end === photos.length
      const naturalHeight = getRowHeight(rowPhotos, containerWidth, gap)
      const rowHeight = isLastRow ? Math.min(targetRowHeight, naturalHeight) : naturalHeight
      const outsideRangePenalty =
        rowHeight < minRowHeight
          ? (minRowHeight - rowHeight) * 4
          : rowHeight > maxRowHeight
            ? (rowHeight - maxRowHeight) * 4
            : 0
      const densityPenalty =
        rowPhotos.length === 1 && !isLastRow
          ? 180
          : rowPhotos.length === maxItemsPerRow && rowHeight < targetRowHeight
            ? 40
            : 0
      const orphanPenalty = photos.length - end === 1 ? 90 : 0
      const targetPenalty = Math.abs(rowHeight - targetRowHeight) * (isLastRow ? 0.35 : 1)
      const totalCost = targetPenalty + outsideRangePenalty + densityPenalty + orphanPenalty + costs[end]

      if (totalCost < costs[start]) {
        costs[start] = totalCost
        nextBreak[start] = end
      }
    }
  }

  const rows: JustifiedRow<T>[] = []
  let index = 0

  while (index < photos.length) {
    const next = nextBreak[index]
    const rowPhotos = photos.slice(index, next)
    const isLastRow = next === photos.length
    const naturalHeight = getRowHeight(rowPhotos, containerWidth, gap)
    const rowHeight = isLastRow ? Math.min(targetRowHeight, naturalHeight) : naturalHeight

    rows.push({
      photos: rowPhotos,
      height: rowHeight,
      width: getRowWidth(rowPhotos, rowHeight, gap),
      isLastRow,
    })

    index = next
  }

  return rows
}
```

- [ ] **Step 5: Run the layout test to verify it passes**

Run: `npm test -- src/lib/gallery-layout.test.ts`

Expected: PASS with 3 tests green.

- [ ] **Step 6: Checkpoint commit**

```bash
git add package.json vite.config.ts src/test/setup.ts src/lib/gallery-layout.ts src/lib/gallery-layout.test.ts
git commit -m "feat: add justified gallery layout engine"
```

## Task 2: Add richer photo metadata and rebuild the page shell

**Files:**
- Modify: `src/types/photo.ts`
- Modify: `src/data/photos.ts`
- Create: `src/components/ExhibitionHeader.tsx`
- Create: `src/components/HeroIntro.tsx`
- Create: `src/components/GallerySummary.tsx`
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Add the failing page-shell tests**

```tsx
// src/App.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import App from "@/App"

describe("App", () => {
  it("renders the curated intro and summary counts", () => {
    render(<App />)

    expect(screen.getByText(/curated exhibition/i)).toBeInTheDocument()
    expect(screen.getByText(/30 works/i)).toBeInTheDocument()
    expect(screen.getByText(/5 collections/i)).toBeInTheDocument()
  })

  it("filters the gallery by category", async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.click(screen.getByRole("button", { name: /portrait/i }))

    expect(screen.getByText(/6 works in portrait/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the page-shell test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the page still renders the old flat gallery shell and there is no reset action.

- [ ] **Step 3: Extend the photo model and collection data**

```ts
// src/types/photo.ts
export interface Photo {
  id: string
  src: string
  width: number
  height: number
  alt: string
  photographer: string
  category: "nature" | "architecture" | "portrait" | "street" | "abstract"
  summary: string
  location: string
}
```

```ts
// src/data/photos.ts
export const categories = ["all", "nature", "architecture", "portrait", "street", "abstract"] as const

export type Category = (typeof categories)[number]

export const photos: Photo[] = [
  {
    id: "1",
    src: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
    width: 5472,
    height: 3648,
    alt: "Mountain lake reflection at sunset",
    photographer: "Quino Al",
    category: "nature",
    summary: "A quiet alpine basin where the light softens before disappearing behind the ridge.",
    location: "Patagonia",
  }
]
```

Apply the same `summary` and `location` additions to all remaining photo entries in `src/data/photos.ts`.

- [ ] **Step 4: Implement the new shell components and page composition**

```tsx
// src/components/ExhibitionHeader.tsx
import type { Category } from "@/data/photos"
import { Button } from "@/components/ui/button"
import { CategoryFilter } from "@/components/CategoryFilter"

interface ExhibitionHeaderProps {
  activeCategory: Category
  onCategoryChange: (category: Category) => void
  onJumpToGallery: () => void
  totalCount: number
}

export function ExhibitionHeader({
  activeCategory,
  onCategoryChange,
  onJumpToGallery,
  totalCount,
}: ExhibitionHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-4 md:px-8">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.24em] text-muted-foreground">Curated exhibition</p>
          <h1 className="text-lg font-medium tracking-[-0.03em]">Still / Frame</h1>
        </div>
        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <CategoryFilter active={activeCategory} onChange={onCategoryChange} />
        </div>
        <Button variant="outline" size="sm" onClick={onJumpToGallery}>
          {totalCount} works
        </Button>
      </div>
    </header>
  )
}
```

```tsx
// src/components/HeroIntro.tsx
import { Button } from "@/components/ui/button"

interface HeroIntroProps {
  onExplore: () => void
}

export function HeroIntro({ onExplore }: HeroIntroProps) {
  return (
    <section className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 pb-14 pt-16 md:px-8 md:pb-24 md:pt-24">
      <p className="text-[0.72rem] uppercase tracking-[0.28em] text-muted-foreground">Edition 01</p>
      <div className="max-w-4xl space-y-6">
        <h2 className="max-w-3xl text-4xl font-medium tracking-[-0.06em] text-balance text-foreground md:text-6xl">
          Curated exhibition of quiet landscapes, architecture, portraits, and streets in measured light.
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          A slower gallery designed for reading images rather than scrolling past them. Each collection is arranged
          as a calm sequence, with restrained context and uninterrupted space.
        </p>
      </div>
      <div>
        <Button size="lg" onClick={onExplore}>
          Enter selection
        </Button>
      </div>
    </section>
  )
}
```

```tsx
// src/components/GallerySummary.tsx
import type { Category } from "@/data/photos"

interface GallerySummaryProps {
  totalCount: number
  categoryCount: number
  activeCategory: Category
  filteredCount: number
}

export function GallerySummary({
  totalCount,
  categoryCount,
  activeCategory,
  filteredCount,
}: GallerySummaryProps) {
  const viewLabel = activeCategory === "all" ? `${totalCount} works across all collections` : `${filteredCount} works in ${activeCategory}`

  return (
    <section className="mx-auto grid max-w-[1440px] gap-4 px-5 pb-10 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] md:px-8">
      <div className="rounded-[28px] border border-border/70 bg-card/80 p-6 md:p-7">
        <p className="text-sm leading-6 text-muted-foreground">
          The exhibition keeps the interface quiet so the sequence of photographs can establish the pace.
        </p>
      </div>
      <div className="rounded-[28px] border border-border/70 bg-card/80 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Works</p>
        <p className="mt-3 text-2xl font-medium tracking-[-0.05em]">{totalCount}</p>
      </div>
      <div className="rounded-[28px] border border-border/70 bg-card/80 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Collections</p>
        <p className="mt-3 text-2xl font-medium tracking-[-0.05em]">{categoryCount}</p>
      </div>
      <div className="rounded-[28px] border border-border/70 bg-card/80 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current view</p>
        <p className="mt-3 text-sm leading-6 text-foreground">{viewLabel}</p>
      </div>
    </section>
  )
}
```

```tsx
// src/App.tsx
import { useMemo, useRef, useState } from "react"

import { CategoryFilter } from "@/components/CategoryFilter"
import { ExhibitionHeader } from "@/components/ExhibitionHeader"
import { GallerySummary } from "@/components/GallerySummary"
import { HeroIntro } from "@/components/HeroIntro"
import { Lightbox } from "@/components/Lightbox"
import { PhotoGrid } from "@/components/PhotoGrid"
import { categories, photos, type Category } from "@/data/photos"
import type { Photo } from "@/types/photo"

function App() {
  const galleryRef = useRef<HTMLElement | null>(null)
  const [activeCategory, setActiveCategory] = useState<Category>("all")
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  const filteredPhotos = useMemo(
    () => (activeCategory === "all" ? photos : photos.filter((photo) => photo.category === activeCategory)),
    [activeCategory]
  )

  const selectedIndex = selectedPhoto ? filteredPhotos.findIndex((photo) => photo.id === selectedPhoto.id) : -1

  const jumpToGallery = () => galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  const clearFilter = () => setActiveCategory("all")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ExhibitionHeader
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onJumpToGallery={jumpToGallery}
        totalCount={photos.length}
      />
      <main>
        <HeroIntro onExplore={jumpToGallery} />
        <GallerySummary
          totalCount={photos.length}
          categoryCount={categories.length - 1}
          activeCategory={activeCategory}
          filteredCount={filteredPhotos.length}
        />
        <section ref={galleryRef} className="mx-auto max-w-[1440px] px-5 pb-16 md:px-8 md:pb-24">
          <div className="mb-6 flex flex-col gap-4 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.28em] text-muted-foreground">Browse collection</p>
              <h3 className="mt-3 text-2xl font-medium tracking-[-0.04em] md:text-3xl">
                {activeCategory === "all" ? "All curated works" : `${activeCategory} selection`}
              </h3>
            </div>
            <CategoryFilter active={activeCategory} onChange={setActiveCategory} />
          </div>
          <PhotoGrid photos={filteredPhotos} onPhotoClick={setSelectedPhoto} onClearFilter={clearFilter} />
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 pb-8 text-sm text-muted-foreground md:px-8">
        <span>Still / Frame exhibition</span>
        <button className="transition-colors hover:text-foreground" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Back to top
        </button>
      </footer>
      {selectedPhoto ? (
        <Lightbox
          photo={selectedPhoto}
          photos={filteredPhotos}
          onClose={() => setSelectedPhoto(null)}
          onSelect={setSelectedPhoto}
        />
      ) : null}
    </div>
  )
}

export default App
```

- [ ] **Step 5: Run the page-shell test to verify it passes**

Run: `npm test -- src/App.test.tsx`

Expected: PASS with 2 tests green.

- [ ] **Step 6: Checkpoint commit**

```bash
git add src/types/photo.ts src/data/photos.ts src/components/ExhibitionHeader.tsx src/components/HeroIntro.tsx src/components/GallerySummary.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add exhibition page shell"
```

## Task 3: Rebuild category filter and photo grid presentation

**Files:**
- Modify: `src/components/CategoryFilter.tsx`
- Modify: `src/components/PhotoGrid.tsx`
- Modify: `src/App.test.tsx`
- Create: `src/components/PhotoGrid.test.tsx`

- [ ] **Step 1: Add the failing gallery interaction tests**

```tsx
// src/App.test.tsx
it("uses a segmented filter with the active state exposed to assistive technology", async () => {
  const user = userEvent.setup()

  render(<App />)
  const natureButton = screen.getByRole("button", { name: /nature/i })

  await user.click(natureButton)

  expect(natureButton).toHaveAttribute("aria-pressed", "true")
})
```

```tsx
// src/components/PhotoGrid.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PhotoGrid } from "@/components/PhotoGrid"

describe("PhotoGrid", () => {
  it("shows a calm empty state with a reset action", async () => {
    const user = userEvent.setup()
    const onClearFilter = vi.fn()

    render(<PhotoGrid photos={[]} onPhotoClick={() => {}} onClearFilter={onClearFilter} />)

    expect(screen.getByText(/calm sequence/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /clear filter/i }))

    expect(onClearFilter).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the interaction test to verify it fails**

Run: `npm test -- src/App.test.tsx src/components/PhotoGrid.test.tsx`

Expected: FAIL because the current filter styling and empty state do not match the new behavior.

- [ ] **Step 3: Implement the segmented filter and new grid shell**

```tsx
// src/components/CategoryFilter.tsx
import { categories, type Category } from "@/data/photos"
import { cn } from "@/lib/utils"

interface CategoryFilterProps {
  active: Category
  onChange: (category: Category) => void
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div
      className="no-scrollbar flex max-w-full gap-2 overflow-x-auto rounded-full border border-border/70 bg-card/70 p-1"
      role="toolbar"
      aria-label="Photo categories"
    >
      {categories.map((category) => {
        const pressed = active === category

        return (
          <button
            key={category}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(category)}
            className={cn(
              "rounded-full px-4 py-2 text-sm capitalize transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              pressed
                ? "bg-foreground text-background shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {category}
          </button>
        )
      })}
    </div>
  )
}
```

```tsx
// src/components/PhotoGrid.tsx
import { useEffect, useState } from "react"

import { buildJustifiedRows } from "@/lib/gallery-layout"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
  onClearFilter: () => void
}

function useContainerWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })

    observer.observe(element)
    setWidth(element.clientWidth)

    return () => observer.disconnect()
  }, [element])

  return { setElement, width }
}

export function PhotoGrid({ photos, onPhotoClick, onClearFilter }: PhotoGridProps) {
  const { setElement, width } = useContainerWidth()
  const gap = width < 768 ? 12 : 18
  const targetRowHeight = width < 640 ? 220 : width < 1024 ? 260 : 320

  const rows = buildJustifiedRows(photos, {
    containerWidth: width,
    gap,
    targetRowHeight,
    minRowHeight: Math.max(170, targetRowHeight - 60),
    maxRowHeight: targetRowHeight + 80,
  })

  if (!photos.length) {
    return (
      <div className="rounded-[32px] border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center md:px-10">
        <p className="text-[0.72rem] uppercase tracking-[0.28em] text-muted-foreground">No matching works</p>
        <h4 className="mt-4 text-2xl font-medium tracking-[-0.04em]">This calm sequence is empty for the current filter.</h4>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Return to the full exhibition to continue browsing the wider collection.
        </p>
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-6 inline-flex rounded-full border border-border bg-background px-5 py-2.5 text-sm transition-colors hover:bg-secondary"
        >
          Clear filter
        </button>
      </div>
    )
  }

  return (
    <div ref={setElement} className="space-y-4">
      {rows.map((row) => (
        <div
          key={`${row.photos[0]?.id}-${row.photos.length}`}
          className={cn("flex", row.isLastRow && "justify-start")}
          style={{ gap, height: row.height }}
        >
          {row.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onPhotoClick(photo)}
              className="group relative overflow-hidden rounded-[24px] bg-muted/60 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
              style={{ flex: `${photo.width / photo.height} 0 0` }}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/58 via-black/10 to-transparent px-4 pb-4 pt-12 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                <p className="text-sm font-medium text-white">{photo.alt}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/72">
                  <span>{photo.photographer}</span>
                  <span aria-hidden="true">/</span>
                  <span className="capitalize">{photo.category}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the interaction test to verify it passes**

Run: `npm test -- src/App.test.tsx src/components/PhotoGrid.test.tsx`

Expected: PASS with the filter and empty-state tests green.

- [ ] **Step 5: Checkpoint commit**

```bash
git add src/components/CategoryFilter.tsx src/components/PhotoGrid.tsx src/App.test.tsx src/components/PhotoGrid.test.tsx
git commit -m "feat: redesign exhibition gallery interactions"
```

## Task 4: Redesign the lightbox as a shared-height reading view

**Files:**
- Modify: `src/components/Lightbox.tsx`
- Create: `src/components/Lightbox.test.tsx`

- [ ] **Step 1: Add the failing lightbox tests**

```tsx
// src/components/Lightbox.test.tsx
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { photos } from "@/data/photos"
import { Lightbox } from "@/components/Lightbox"

describe("Lightbox", () => {
  it("locks body scroll while open and restores it on cleanup", () => {
    const { unmount } = render(
      <Lightbox photo={photos[0]} photos={photos.slice(0, 3)} onClose={() => {}} onSelect={() => {}} />
    )

    expect(document.body.style.overflow).toBe("hidden")
    unmount()
    expect(document.body.style.overflow).toBe("")
  })

  it("moves to the next photo with the arrow key", () => {
    const onSelect = vi.fn()

    render(<Lightbox photo={photos[0]} photos={photos.slice(0, 3)} onClose={() => {}} onSelect={onSelect} />)
    fireEvent.keyDown(document, { key: "ArrowRight" })

    expect(onSelect).toHaveBeenCalledWith(photos[1])
  })

  it("closes when the overlay is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<Lightbox photo={photos[0]} photos={photos.slice(0, 3)} onClose={onClose} onSelect={() => {}} />)
    await user.click(screen.getByLabelText(/close preview/i))

    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the lightbox test to verify it fails**

Run: `npm test -- src/components/Lightbox.test.tsx`

Expected: FAIL because the component signature does not yet accept the full filtered photo list and the current preview does not expose the new UI contract.

- [ ] **Step 3: Implement the redesigned lightbox**

```tsx
// src/components/Lightbox.tsx
import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Photo } from "@/types/photo"

interface LightboxProps {
  photo: Photo
  photos: Photo[]
  onClose: () => void
  onSelect: (photo: Photo) => void
}

export function Lightbox({ photo, photos, onClose, onSelect }: LightboxProps) {
  const [loaded, setLoaded] = useState(false)
  const currentIndex = useMemo(() => photos.findIndex((item) => item.id === photo.id), [photo.id, photos])
  const previousPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null
  const nextPhoto = currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null

  useEffect(() => {
    setLoaded(false)
  }, [photo.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowLeft" && previousPhoto) onSelect(previousPhoto)
      if (event.key === "ArrowRight" && nextPhoto) onSelect(nextPhoto)
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [nextPhoto, onClose, onSelect, previousPhoto])

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(17,17,19,0.86)] px-4 py-4 backdrop-blur-xl md:px-6 md:py-6" onClick={onClose}>
      <div
        className="mx-auto flex h-full max-w-[1500px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#121214] text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-[48vh] flex-1 items-center justify-center overflow-hidden bg-[#0d0d0f] p-5 md:min-h-0 md:p-8">
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex rounded-full border border-white/12 bg-white/8 p-2 text-white transition hover:bg-white/14"
          >
            <X className="size-4" />
          </button>
          {previousPhoto ? (
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => onSelect(previousPhoto)}
              className="absolute left-4 top-1/2 inline-flex -translate-y-1/2 rounded-full border border-white/12 bg-white/8 p-2 text-white transition hover:bg-white/14"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {nextPhoto ? (
            <button
              type="button"
              aria-label="Next image"
              onClick={() => onSelect(nextPhoto)}
              className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 rounded-full border border-white/12 bg-white/8 p-2 text-white transition hover:bg-white/14"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}
          <img
            src={photo.src.replace("w=800", "w=1600")}
            alt={photo.alt}
            onLoad={() => setLoaded(true)}
            className={cn("max-h-full max-w-full object-contain transition duration-500", loaded ? "opacity-100" : "opacity-0")}
          />
          {!loaded ? <div className="absolute inset-0 animate-pulse bg-white/[0.03]" /> : null}
        </div>
        <aside className="flex w-full shrink-0 flex-col justify-between overflow-y-auto border-t border-white/8 bg-[#17171a] p-6 md:h-full md:w-[360px] md:border-l md:border-t-0 md:p-8">
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">Selected work</p>
              <h3 className="text-2xl font-medium tracking-[-0.04em]">{photo.alt}</h3>
              <p className="text-sm leading-6 text-white/64">{photo.summary}</p>
            </div>
            <dl className="grid gap-5 text-sm text-white/72">
              <div>
                <dt className="text-[0.72rem] uppercase tracking-[0.24em] text-white/42">Photographer</dt>
                <dd className="mt-2 text-base text-white">{photo.photographer}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] uppercase tracking-[0.24em] text-white/42">Collection</dt>
                <dd className="mt-2 text-base capitalize text-white">{photo.category}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] uppercase tracking-[0.24em] text-white/42">Location</dt>
                <dd className="mt-2 text-base text-white">{photo.location}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] uppercase tracking-[0.24em] text-white/42">Dimensions</dt>
                <dd className="mt-2 text-base text-white">{photo.width} x {photo.height}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-8 space-y-4 border-t border-white/8 pt-5">
            <p className="text-sm text-white/52">
              {currentIndex + 1} / {photos.length}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => previousPhoto && onSelect(previousPhoto)} disabled={!previousPhoto}>
                Previous
              </Button>
              <Button variant="secondary" onClick={() => nextPhoto && onSelect(nextPhoto)} disabled={!nextPhoto}>
                Next
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the lightbox test to verify it passes**

Run: `npm test -- src/components/Lightbox.test.tsx`

Expected: PASS with all preview interaction tests green.

- [ ] **Step 5: Checkpoint commit**

```bash
git add src/components/Lightbox.tsx src/components/Lightbox.test.tsx
git commit -m "feat: redesign exhibition lightbox"
```

## Task 5: Polish tokens, remove template leftovers, and run final verification

**Files:**
- Modify: `src/index.css`
- Delete: `src/App.css`

- [ ] **Step 1: Add the failing visual-regression expectations**

```tsx
// src/App.test.tsx
it("keeps the top-level landmarks and footer links accessible", () => {
  render(<App />)

  expect(screen.getByRole("banner")).toBeInTheDocument()
  expect(screen.getByRole("main")).toBeInTheDocument()
  expect(screen.getByRole("contentinfo")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /back to top/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the accessibility smoke test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL if the footer, landmarks, or button labels are still missing after earlier tasks.

- [ ] **Step 3: Implement final token and base-style cleanup**

```css
/* src/index.css */
:root {
  --background: oklch(0.985 0.004 84);
  --foreground: oklch(0.19 0.008 84);
  --card: oklch(0.972 0.003 84);
  --card-foreground: oklch(0.19 0.008 84);
  --popover: oklch(0.985 0.004 84);
  --popover-foreground: oklch(0.19 0.008 84);
  --primary: oklch(0.21 0.012 84);
  --primary-foreground: oklch(0.985 0.004 84);
  --secondary: oklch(0.95 0.004 84);
  --secondary-foreground: oklch(0.21 0.012 84);
  --muted: oklch(0.945 0.003 84);
  --muted-foreground: oklch(0.46 0.008 84);
  --accent: oklch(0.77 0.028 76);
  --accent-foreground: oklch(0.18 0.012 84);
  --border: oklch(0.88 0.004 84);
  --input: oklch(0.88 0.004 84);
  --ring: oklch(0.72 0.024 76);
  --radius: 1.5rem;
}

@layer base {
  html {
    font-family: "Geist Variable", sans-serif;
    scroll-behavior: smooth;
  }

  body {
    min-height: 100vh;
    background:
      radial-gradient(circle at top, oklch(0.99 0.01 84), transparent 32%),
      linear-gradient(180deg, oklch(0.985 0.004 84), oklch(0.965 0.004 84));
    color: var(--foreground);
    text-rendering: optimizeLegibility;
  }

  button {
    cursor: pointer;
  }

  img {
    display: block;
  }
}

@utility no-scrollbar {
  scrollbar-width: none;
}

@utility no-scrollbar::-webkit-scrollbar {
  display: none;
}
```

```diff
- import './App.css'
```

Delete `src/App.css` once the import is gone and all starter-template selectors are unused.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected:

- `npm test`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

- [ ] **Step 5: Final checkpoint commit**

```bash
git add src/index.css src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: polish photo exhibition redesign"
```

## Self-review

### Spec coverage

- Page architecture: covered by Task 2 page-shell components and `App.tsx` rewrite.
- Visual language: covered by Task 5 token and base-style cleanup plus component rewrites in Tasks 2-4.
- Equal-height justified gallery and improved algorithm: covered by Task 1 and Task 3.
- Shared-height desktop lightbox with right-side information panel: covered by Task 4.
- Empty state, keyboard controls, and responsiveness: covered by Tasks 3 and 4, with final verification in Task 5.
- Code cleanup and template removal: covered by Tasks 2 and 5.

### Placeholder scan

- No placeholder markers or deferred implementation notes remain.
- Every task includes concrete file paths, commands, and code blocks.

### Type consistency

- `Photo` uses `summary` and `location` in both data and lightbox tasks.
- `Lightbox` receives `photo`, `photos`, `onClose`, and `onSelect` consistently.
- `CategoryFilter` uses `Category` from `src/data/photos.ts` throughout.

Plan complete and saved to `docs/superpowers/plans/2026-04-18-photo-exhibition.md`. Inline execution has already been requested, so the next step is to implement this plan with `executing-plans`.
