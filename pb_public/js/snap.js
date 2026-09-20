export const GRID = 8
export const SNAP_DISTANCE = 6
export const GAP = 8
export const TIDY_GAP = 16

export function snapToGrid(value, grid = GRID) {
  return Math.round(value / grid) * grid
}

function edges(rect) {
  return [rect.x, rect.x + rect.w / 2, rect.x + rect.w]
}

function verticalEdges(rect) {
  return [rect.y, rect.y + rect.h / 2, rect.y + rect.h]
}

function closest(movingEdges, targets, threshold) {
  let best = null
  for (const edge of movingEdges) {
    for (const target of targets) {
      const delta = target - edge
      if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: target }
    }
  }
  return best
}

function nearest(first, second) {
  if (!first) return second
  if (!second) return first
  return Math.abs(second.delta) < Math.abs(first.delta) ? second : first
}

export function snapMove(moving, others, threshold = SNAP_DISTANCE, grid = GRID) {
  const edgesX = []
  const edgesY = []
  const gapsX = []
  const gapsY = []
  for (const other of others) {
    edgesX.push(...edges(other))
    edgesY.push(...verticalEdges(other))
    gapsX.push(other.x + other.w + GAP, other.x - GAP)
    gapsY.push(other.y + other.h + GAP, other.y - GAP)
  }
  const bestX = nearest(closest(edges(moving), edgesX, threshold), closest([moving.x, moving.x + moving.w], gapsX, threshold))
  const bestY = nearest(closest(verticalEdges(moving), edgesY, threshold), closest([moving.y, moving.y + moving.h], gapsY, threshold))
  return {
    dx: bestX ? bestX.delta : snapToGrid(moving.x, grid) - moving.x,
    dy: bestY ? bestY.delta : snapToGrid(moving.y, grid) - moving.y,
    guides: [bestX ? { axis: 'x', at: bestX.at } : null, bestY ? { axis: 'y', at: bestY.at } : null].filter(Boolean)
  }
}

export function tidy(rects, gap = TIDY_GAP) {
  const ordered = rects.slice().sort((a, b) => a.y - b.y || a.x - b.x)
  if (ordered.length === 0) return []
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)))
  const originX = Math.min(...ordered.map((rect) => rect.x))
  const originY = Math.min(...ordered.map((rect) => rect.y))
  const placed = []
  let x = originX
  let y = originY
  let rowHeight = 0
  ordered.forEach((rect, index) => {
    if (index > 0 && index % columns === 0) {
      x = originX
      y += rowHeight + gap
      rowHeight = 0
    }
    placed.push({ id: rect.id, x: snapToGrid(x), y: snapToGrid(y) })
    x += rect.w + gap
    rowHeight = Math.max(rowHeight, rect.h)
  })
  return placed
}
