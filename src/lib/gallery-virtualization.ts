export interface VirtualRowMetric {
  index: number
  start: number
  height: number
  end: number
}

export interface VisibleRowRangeOptions {
  scrollTop: number
  viewportHeight: number
  overscan: number
}

export function buildVirtualRowMetrics(rows: Array<{ height: number }>, rowGap: number): VirtualRowMetric[] {
  let offset = 0

  return rows.map((row, index) => {
    const start = offset
    const height = row.height
    const end = start + height

    offset = end + rowGap

    return {
      index,
      start,
      height,
      end,
    }
  })
}

export function getVisibleRowRange(rows: VirtualRowMetric[], options: VisibleRowRangeOptions) {
  if (!rows.length) {
    return { start: 0, end: 0 }
  }

  const viewportStart = Math.max(0, options.scrollTop - options.overscan)
  const viewportEnd = options.scrollTop + options.viewportHeight + options.overscan
  const start = rows.findIndex((row) => row.end > viewportStart)

  if (start === -1) {
    return { start: rows.length, end: rows.length }
  }

  let end = start
  while (end < rows.length && rows[end].start < viewportEnd) {
    end += 1
  }

  return { start, end }
}

export function getVirtualRowsHeight(rows: VirtualRowMetric[]) {
  return rows.at(-1)?.end ?? 0
}
