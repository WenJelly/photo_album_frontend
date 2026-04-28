import { readFileSync } from "node:fs"
import { join } from "node:path"

const indexCss = readFileSync(join(process.cwd(), "src", "index.css"), "utf8")

describe("dynamic island readability theme", () => {
  test("keeps secondary and muted task-panel text at stronger contrast in the blue-violet theme", () => {
    expect(indexCss).toContain("--dynamic-island-text-secondary: oklch(0.96 0.024 264 / 0.9);")
    expect(indexCss).toContain("--dynamic-island-text-muted: oklch(0.93 0.028 270 / 0.8);")
  })

  test("gives small information fields slightly stronger weight", () => {
    expect(indexCss).toContain(".dynamic-island-metric__label {")
    expect(indexCss).toContain("font-weight: 600;")
    expect(indexCss).toContain(".dynamic-island-progress__meta {")
  })
})
