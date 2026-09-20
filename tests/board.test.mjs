import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_ZOOM, MIN_ZOOM, clampZoom, fitCamera, panBy, toScreen, toWorld, zoomAt, zoomLabel } from '../pb_public/js/camera.js'
import { GAP, GRID, snapMove, snapToGrid, tidy } from '../pb_public/js/snap.js'
import { boundsOf, formatSize, formatTime, isBlockedName, isMedia, kindOf, linkLabel, newId, nextZ, overlaps, parseContent, readingOrder, textOfItems } from '../pb_public/js/items.js'

test('file helpers on the client mirror the server: kinds, blocked names, sizes and times', () => {
  assert.equal(kindOf('Relatorio.PDF'), 'pdf')
  assert.equal(kindOf('trilha.mp3'), 'audio')
  assert.equal(kindOf('anything'), 'generic')
  assert.equal(isBlockedName('a.exe'), true)
  assert.equal(isBlockedName('a.zip'), false)
  assert.equal(isMedia('video'), true)
  assert.equal(isMedia('pdf'), false)
  assert.equal(formatSize(2400000, 'pt-BR'), '2,3 MB')
  assert.equal(formatSize(2400000, 'en'), '2.3 MB')
  assert.equal(formatSize(148 * 1024 * 1024, 'en'), '148 MB')
  assert.equal(formatSize(1500000000, 'pt-BR'), '1,4 GB')
  assert.equal(formatSize(2 * 1024 * 1024 * 1024, 'en'), '2 GB')
  assert.equal(formatSize(512, 'en'), '512 B')
  assert.equal(formatTime(84), '1:24')
  assert.equal(formatTime(5), '0:05')
})

test('zoom stays inside the limits and keeps the point under the cursor', () => {
  assert.equal(clampZoom(0.01), MIN_ZOOM)
  assert.equal(clampZoom(9), MAX_ZOOM)
  const camera = { zoom: 1, x: 100, y: 50 }
  const point = { x: 400, y: 300 }
  const before = toWorld(camera, point)
  const zoomed = zoomAt(camera, 2, point)
  assert.equal(zoomed.zoom, 2)
  assert.deepEqual(toWorld(zoomed, point), before)
  assert.deepEqual(toScreen(zoomed, before), point)
  assert.deepEqual(panBy(camera, 10, -5), { zoom: 1, x: 110, y: 45 })
  assert.equal(zoomLabel(0.333), '33%')
})

test('fit centers the bounds with padding and never zooms in past 100%', () => {
  const camera = fitCamera({ x0: 0, y0: 0, x1: 1000, y1: 500 }, { width: 800, height: 600 })
  assert.equal(camera.zoom, 800 / 1096)
  assert.equal(Math.round(camera.x), Math.round((800 - 1000 * camera.zoom) / 2))
  const small = fitCamera({ x0: 100, y0: 100, x1: 300, y1: 200 }, { width: 800, height: 600 })
  assert.equal(small.zoom, 1)
  assert.deepEqual(small, { zoom: 1, x: 200, y: 150 })
})

test('grid snapping rounds to eight pixels', () => {
  assert.equal(snapToGrid(13), 16)
  assert.equal(snapToGrid(-13), -16)
  assert.equal(GRID, 8)
})

test('moving items snap to neighbour edges, centers and the gap next to them', () => {
  const other = { x: 100, y: 100, w: 200, h: 100 }
  const edge = snapMove({ x: 104, y: 400, w: 50, h: 50 }, [other])
  assert.equal(edge.dx, -4)
  assert.deepEqual(edge.guides[0], { axis: 'x', at: 100 })
  const center = snapMove({ x: 400, y: 128, w: 50, h: 50 }, [other])
  assert.equal(center.dy, -3)
  const beside = snapMove({ x: 305, y: 400, w: 50, h: 50 }, [other])
  assert.equal(beside.dx, 300 + GAP - 305)
  const far = snapMove({ x: 501, y: 803, w: 50, h: 50 }, [other])
  assert.deepEqual(far, { dx: 3, dy: -3, guides: [] })
})

test('tidy lays a selection out on a grid in reading order', () => {
  const placed = tidy([
    { id: 'b', x: 300, y: 10, w: 100, h: 50 },
    { id: 'a', x: 20, y: 5, w: 100, h: 80 },
    { id: 'c', x: 50, y: 300, w: 100, h: 50 }
  ])
  assert.deepEqual(placed, [{ id: 'a', x: 24, y: 8 }, { id: 'b', x: 136, y: 8 }, { id: 'c', x: 24, y: 104 }])
})

test('item helpers: ids, parsing, order, bounds, overlap, search text, link labels', () => {
  assert.match(newId(), /^[a-z0-9]{8}$/)
  assert.notEqual(newId(), newId())
  assert.deepEqual(parseContent('junk'), [])
  assert.deepEqual(parseContent('[{"id":"a1b2","type":"text","x":0,"y":0},3,{"nope":1}]'), [{ id: 'a1b2', type: 'text', x: 0, y: 0 }])
  const items = [{ id: 'low1', x: 0, y: 100, z: 1 }, { id: 'right', x: 300, y: 0, z: 5 }, { id: 'left', x: 0, y: 0, z: 2 }]
  assert.deepEqual(readingOrder(items).map((item) => item.id), ['left', 'right', 'low1'])
  assert.equal(nextZ(items), 6)
  assert.deepEqual(boundsOf([{ x: 10, y: 20, w: 100, h: 50 }, { x: -5, y: 40, w: 10, h: 100 }]), { x0: -5, y0: 20, x1: 110, y1: 140 })
  assert.equal(boundsOf([]), null)
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x0: 5, y0: 5, x1: 20, y1: 20 }), true)
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x0: 10, y0: 10, x1: 20, y1: 20 }), false)
  const text = textOfItems([
    { id: 'a', type: 'link', x: 0, y: 50, url: 'https://x.test' },
    { id: 'b', type: 'text', x: 0, y: 0, html: '<b>hello</b>' }
  ], (html) => html.replace(/<[^>]+>/g, ''))
  assert.equal(text, 'hello https://x.test')
  assert.equal(linkLabel('https://figma.com/file/x/'), 'figma.com/file/x')
})
