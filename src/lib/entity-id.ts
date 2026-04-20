export type EntityId = string

function toTrimmedString(value: string | number) {
  return typeof value === "string" ? value.trim() : String(value)
}

export function stringifyEntityId(value: string | number) {
  return toTrimmedString(value)
}

export function normalizeEntityId(value: string | number, errorMessage = "参数错误"): EntityId {
  const normalizedValue = toTrimmedString(value)

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(errorMessage)
  }

  return normalizedValue
}
