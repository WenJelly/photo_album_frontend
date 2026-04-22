export function trimToUndefined(value?: string | null) {
  const normalizedValue = typeof value === "string" ? value.trim() : ""

  return normalizedValue || undefined
}
