export interface PhotoPreviewOriginRect {
  x: number
  y: number
  width: number
  height: number
}

export function toPhotoPreviewOriginRect(rect: DOMRect | DOMRectReadOnly): PhotoPreviewOriginRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}
