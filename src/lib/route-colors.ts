const TRANSITION_COLORS: Record<string, string> = {
  home: "#d8d3cb",
  gallery: "oklch(0.985 0.004 84)",
  adminReview: "oklch(0.985 0.004 84)",
  me: "oklch(0.985 0.004 84)",
  user: "oklch(0.985 0.004 84)",
}

export function getTransitionColor(page: string): string {
  return TRANSITION_COLORS[page] ?? "oklch(0.985 0.004 84)"
}
