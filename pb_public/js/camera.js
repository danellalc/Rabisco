export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
export const ZOOM_STEP = 1.25
export const WHEEL_STEP = 1.1
export const FIT_PADDING = 96

export function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function toWorld(camera, point) {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom }
}

export function toScreen(camera, point) {
  return { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y }
}

export function zoomAt(camera, factor, point) {
  const zoom = clampZoom(camera.zoom * factor)
  const anchor = toWorld(camera, point)
  return { zoom, x: point.x - anchor.x * zoom, y: point.y - anchor.y * zoom }
}

export function panBy(camera, dx, dy) {
  return { zoom: camera.zoom, x: camera.x + dx, y: camera.y + dy }
}

export function fitCamera(bounds, viewport, padding = FIT_PADDING) {
  const width = bounds.x1 - bounds.x0
  const height = bounds.y1 - bounds.y0
  const zoom = clampZoom(Math.min(viewport.width / (width + padding), viewport.height / (height + padding), 1))
  return {
    zoom,
    x: (viewport.width - width * zoom) / 2 - bounds.x0 * zoom,
    y: (viewport.height - height * zoom) / 2 - bounds.y0 * zoom
  }
}

export function zoomLabel(zoom) {
  return `${Math.round(zoom * 100)}%`
}
