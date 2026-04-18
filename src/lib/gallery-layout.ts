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

function getAspectRatio(photo: LayoutPhoto) {
  return photo.width / photo.height
}

function getFittedHeight(photos: LayoutPhoto[], containerWidth: number, gap: number) {
  const ratioSum = photos.reduce((sum, photo) => sum + getAspectRatio(photo), 0)

  return (containerWidth - gap * (photos.length - 1)) / ratioSum
}

function getRenderedWidth(photos: LayoutPhoto[], height: number, gap: number) {
  const contentWidth = photos.reduce((sum, photo) => sum + getAspectRatio(photo) * height, 0)

  return contentWidth + gap * (photos.length - 1)
}

function getMaxItemsPerRow(containerWidth: number) {
  if (containerWidth < 768) return 2
  if (containerWidth < 1180) return 3
  return 5
}

function getLastRowMetrics(
  photos: LayoutPhoto[],
  containerWidth: number,
  gap: number,
  targetRowHeight: number
) {
  const naturalWidthAtTarget = getRenderedWidth(photos, targetRowHeight, gap)

  if (naturalWidthAtTarget <= containerWidth) {
    return {
      height: targetRowHeight,
      width: naturalWidthAtTarget,
    }
  }

  const fittedHeight = getFittedHeight(photos, containerWidth, gap)

  return {
    height: fittedHeight,
    width: containerWidth,
  }
}

export function buildJustifiedRows<T extends LayoutPhoto>(
  photos: T[],
  options: LayoutOptions
): JustifiedRow<T>[] {
  const { containerWidth, gap, targetRowHeight, minRowHeight, maxRowHeight } = options

  if (!photos.length || containerWidth <= 0) {
    return []
  }

  const maxItemsPerRow = getMaxItemsPerRow(containerWidth)
  const costs = new Array<number>(photos.length + 1).fill(Number.POSITIVE_INFINITY)
  const nextBreak = new Array<number>(photos.length).fill(photos.length)

  costs[photos.length] = 0

  for (let start = photos.length - 1; start >= 0; start -= 1) {
    const maxEnd = Math.min(photos.length, start + maxItemsPerRow)

    for (let end = start + 1; end <= maxEnd; end += 1) {
      const rowPhotos = photos.slice(start, end)
      const isLastRow = end === photos.length
      const filledHeight = getFittedHeight(rowPhotos, containerWidth, gap)
      const rowMetrics = isLastRow
        ? getLastRowMetrics(rowPhotos, containerWidth, gap, targetRowHeight)
        : { height: filledHeight, width: containerWidth }
      const rowHeight = rowMetrics.height
      const rowWidth = rowMetrics.width

      const rangePenalty =
        rowHeight < minRowHeight
          ? (minRowHeight - rowHeight) * (isLastRow ? 6 : 10)
          : rowHeight > maxRowHeight
            ? (rowHeight - maxRowHeight) * (isLastRow ? 1.5 : 10)
            : 0
      const targetPenalty = Math.abs(rowHeight - targetRowHeight) * (isLastRow ? 0.45 : 1.2)
      const widthPenalty = isLastRow ? Math.max(0, containerWidth - rowWidth) / 10 : 0
      const densityPenalty =
        rowPhotos.length === 1
          ? isLastRow
            ? 95
            : 180
          : rowPhotos.length === maxItemsPerRow && rowHeight < targetRowHeight
            ? 45
            : 0
      const orphanPenalty = photos.length - end === 1 ? 90 : 0
      const totalCost = targetPenalty + rangePenalty + widthPenalty + densityPenalty + orphanPenalty + costs[end]

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
    const filledHeight = getFittedHeight(rowPhotos, containerWidth, gap)
    const rowMetrics = isLastRow
      ? getLastRowMetrics(rowPhotos, containerWidth, gap, targetRowHeight)
      : { height: filledHeight, width: containerWidth }

    rows.push({
      photos: rowPhotos,
      height: rowMetrics.height,
      width: rowMetrics.width,
      isLastRow,
    })

    index = next
  }

  return rows
}
