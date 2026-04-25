import { readFileSync } from "node:fs"
import { join } from "node:path"

const islandCss = readFileSync(join(process.cwd(), "src", "index.css"), "utf8")

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = islandCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"))

  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`)
  }

  return match[1]
}

describe("dynamic island theme css", () => {
  it("defines the pale blue violet glass palette on the shell", () => {
    const shell = getRuleBody(".dynamic-island-shell")

    expect(shell).toContain("--dynamic-island-glass-base: oklch(0.78 0.062 276 / 0.48);")
    expect(shell).toContain("--dynamic-island-glass-sheen:")
    expect(shell).toContain("--dynamic-island-text-primary: oklch(0.99 0.012 270 / 0.96);")
    expect(shell).toContain("background: var(--dynamic-island-glass-sheen), var(--dynamic-island-glass-base);")
    expect(shell).toContain("backdrop-filter: blur(22px) saturate(145%);")
    expect(shell).not.toContain("rgba(15, 23, 42")
  })

  it("keeps island variants variable-only to avoid extra filter layers", () => {
    const transparent = getRuleBody(".dynamic-island-shell--transparent")
    const solid = getRuleBody(".dynamic-island-shell--solid")
    const task = getRuleBody(".dynamic-island-shell--task")
    const islandThemeCss = islandCss.slice(
      islandCss.indexOf(".dynamic-island-shell"),
      islandCss.indexOf(".dynamic-island-logo-anchor"),
    )

    expect(transparent).toContain("--dynamic-island-glass-base: oklch(0.82 0.052 274 / 0.36);")
    expect(solid).toContain("--dynamic-island-glass-base: oklch(0.77 0.064 276 / 0.52);")
    expect(task).toContain("--dynamic-island-glass-base: oklch(0.71 0.07 278 / 0.62);")
    expect(islandThemeCss.match(/backdrop-filter:/g)).toHaveLength(1)
    expect(islandThemeCss).not.toMatch(/\n\s*filter:/)
    expect(islandThemeCss).not.toContain("radial-gradient")
  })
})
