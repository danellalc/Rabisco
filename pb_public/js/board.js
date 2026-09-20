import { WHEEL_STEP, ZOOM_STEP, fitCamera, panBy, toScreen, toWorld, zoomAt } from './camera.js'
import { isBlank, placeCaretAtEnd, placeCaretAtPoint } from './editor.js'
import { CARD_HEIGHT, CARD_WIDTH, IMAGE_MIN_WIDTH, TEXT_MIN_WIDTH, boundsOf, linkLabel, newId, nextZ, overlaps, parseContent, readingOrder } from './items.js'
import { render, serialize } from './sanitize.js'
import { GRID, SNAP_DISTANCE, snapMove, snapToGrid, tidy } from './snap.js'

const DRAG_THRESHOLD = 4
const NUDGE = 8
const NUDGE_LARGE = 40
const DUPLICATE_OFFSET = 24
const NEW_TEXT_WIDTH = 320
const IMAGE_MAX_WIDTH = 640
const EDGE = 40
const EDGE_STEP = 16
const LINK_ICON = 'M13.2 18.8l5.6-5.6M11.6 15.2l-2.4 2.4a3.7 3.7 0 1 0 5.2 5.2l2.4-2.4M20.4 16.8l2.4-2.4a3.7 3.7 0 1 0-5.2-5.2l-2.4 2.4'

function svgIcon(path, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 32 32')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  shape.setAttribute('d', path)
  svg.append(shape)
  return svg
}

function caretPath(root) {
  const selection = document.getSelection()
  if (selection.rangeCount === 0 || !root.contains(selection.focusNode)) return null
  const path = []
  let node = selection.focusNode
  while (node !== root) {
    path.unshift([...node.parentNode.childNodes].indexOf(node))
    node = node.parentNode
  }
  return { path, offset: selection.focusOffset }
}

function restoreCaretPath(root, caret) {
  let node = root
  for (const index of caret ? caret.path : []) {
    node = node.childNodes[index]
    if (!node) {
      placeCaretAtEnd(root)
      return
    }
  }
  if (!caret) {
    placeCaretAtEnd(root)
    return
  }
  root.focus()
  const limit = node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length
  const range = document.createRange()
  range.setStart(node, Math.min(caret.offset, limit))
  range.collapse(true)
  const selection = document.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

export function createBoard({ area, layer, lasso, guides, message, translate, onChange, beforeChange, onCamera, onOpenImage, onItemMenu, onImageInserted }) {
  let items = []
  const elements = new Map()
  let camera = { zoom: 1, x: 24, y: 24 }
  let editable = true
  let editing = null
  let selection = new Set()
  let gesture = null
  const touches = new Map()
  let spaceHeld = false

  const itemOf = (id) => items.find((item) => item.id === id)
  const noteOf = (id) => elements.get(id).querySelector('.note')
  const host = {
    layer,
    area,
    editable: () => editable,
    active: () => (editing ? noteOf(editing) : null),
    rootOf: (node) => {
      const element = node instanceof Element ? node : node.parentElement
      return element ? element.closest('.note') : null
    }
  }

  const rectOf = (item) => {
    const element = elements.get(item.id)
    const w = item.type === 'link' ? CARD_WIDTH : item.w
    const h = element ? element.offsetHeight : CARD_HEIGHT
    return { id: item.id, x: item.x, y: item.y, w, h }
  }

  const screenPoint = (event) => {
    const box = area.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  const worldPoint = (event) => toWorld(camera, screenPoint(event))
  const viewport = () => ({ width: area.clientWidth, height: area.clientHeight })

  const applyCamera = () => {
    layer.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
    layer.style.setProperty('--zoom', String(camera.zoom))
    onCamera(camera)
  }

  const setCamera = (next) => {
    camera = next
    applyCamera()
  }

  const applyGeometry = (item) => {
    const element = elements.get(item.id)
    element.style.transform = `translate(${item.x}px, ${item.y}px)`
    element.style.zIndex = String(item.z)
    if (item.type !== 'link') element.style.width = `${item.w}px`
  }

  const decorate = (element) => {
    if (element.querySelector('.more')) return
    const type = element.dataset.type
    if (type !== 'link') {
      const handle = document.createElement('span')
      handle.className = 'handle'
      element.append(handle)
    }
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'more'
    more.textContent = '⋯'
    more.setAttribute('aria-label', translate('itemMenu'))
    more.addEventListener('click', (event) => {
      event.stopPropagation()
      onItemMenu(element.dataset.id, more)
    })
    element.append(more)
  }

  const undecorate = (element) => {
    for (const extra of element.querySelectorAll(':scope > .handle, :scope > .more')) extra.remove()
  }

  const setSelection = (ids) => {
    const next = new Set(ids.filter((id) => elements.has(id)))
    for (const [id, element] of elements) {
      const selected = next.has(id) && editable
      element.classList.toggle('selected', selected)
      if (selected) decorate(element)
      else undecorate(element)
    }
    selection = next
  }

  const build = (item) => {
    const element = document.createElement(item.type === 'link' ? 'a' : 'div')
    element.className = `item ${item.type}`
    element.dataset.id = item.id
    element.dataset.type = item.type
    if (item.type === 'text') {
      const note = document.createElement('div')
      note.className = 'note'
      note.contentEditable = 'false'
      note.dataset.placeholder = translate('placeholder')
      render(note, item.html || '')
      element.append(note)
    } else if (item.type === 'image') {
      const img = document.createElement('img')
      img.alt = ''
      img.draggable = false
      img.decoding = 'async'
      img.loading = 'lazy'
      if (item.width && item.height) {
        img.width = item.width
        img.height = item.height
      }
      img.src = item.src
      element.append(img)
    } else if (item.type === 'link') {
      element.href = item.url
      element.target = '_blank'
      element.rel = 'noopener noreferrer'
      const label = document.createElement('span')
      label.textContent = linkLabel(item.url)
      element.append(svgIcon(LINK_ICON, 24), label)
    }
    elements.set(item.id, element)
    applyGeometry(item)
    return element
  }

  const renderAll = () => {
    elements.clear()
    layer.replaceChildren(...items.map(build))
    setSelection([...selection])
  }

  const stopEditing = () => {
    if (!editing) return
    const id = editing
    const element = elements.get(id)
    const item = itemOf(id)
    editing = null
    if (!element || !item) return
    const note = element.querySelector('.note')
    note.contentEditable = 'false'
    element.classList.remove('editing')
    if (isBlank(note) && !note.querySelector('h1,h2,ul,ol,hr')) {
      beforeChange()
      removeItems([id])
      onChange()
      return
    }
    item.html = serialize(note)
  }

  const startEditing = (id, point) => {
    if (!editable || editing === id) return
    stopEditing()
    const element = elements.get(id)
    if (!element || element.dataset.type !== 'text') return
    setSelection([])
    editing = id
    const note = element.querySelector('.note')
    note.contentEditable = 'true'
    element.classList.add('editing')
    note.focus({ preventScroll: true })
    if (point) placeCaretAtPoint(point.x, point.y)
    if (!point || !note.contains(document.getSelection().anchorNode)) placeCaretAtEnd(note)
  }

  const removeItems = (ids) => {
    if (ids.includes(editing)) editing = null
    for (const id of ids) {
      const element = elements.get(id)
      if (element) element.remove()
      elements.delete(id)
    }
    items = items.filter((item) => !ids.includes(item.id))
    setSelection([...selection].filter((id) => !ids.includes(id)))
  }

  const addItem = (item) => {
    items.push(item)
    layer.append(build(item))
    return item
  }

  const place = (point) => ({ x: snapToGrid(point.x), y: snapToGrid(point.y), z: nextZ(items) })

  const addText = (point, html = '') => {
    beforeChange()
    const item = addItem({ id: newId(), type: 'text', ...place(point), w: NEW_TEXT_WIDTH, html })
    onChange()
    startEditing(item.id)
    return item
  }

  const addLink = (point, url) => {
    beforeChange()
    const item = addItem({ id: newId(), type: 'link', ...place(point), url })
    onChange()
    return item
  }

  const addImage = (point, file) => {
    beforeChange()
    const item = addItem({ id: newId(), type: 'image', ...place(point), w: NEW_TEXT_WIDTH, src: URL.createObjectURL(file) })
    const img = elements.get(item.id).querySelector('img')
    img.addEventListener('load', () => {
      item.width = img.naturalWidth
      item.height = img.naturalHeight
      item.w = Math.max(IMAGE_MIN_WIDTH, Math.min(IMAGE_MAX_WIDTH, img.naturalWidth))
      img.width = item.width
      img.height = item.height
      applyGeometry(item)
    }, { once: true })
    img.addEventListener('error', () => {
      removeItems([item.id])
      onChange()
    }, { once: true })
    onChange()
    onImageInserted(img, file)
    return item
  }

  const duplicateItems = (ids) => {
    if (ids.length === 0) return
    beforeChange()
    let z = nextZ(items)
    const copies = ids.map(itemOf).filter(Boolean).map((source) => {
      const copy = { ...source, id: newId(), x: source.x + DUPLICATE_OFFSET, y: source.y + DUPLICATE_OFFSET, z: z++ }
      if (source.type === 'text') copy.html = serialize(noteOf(source.id))
      return addItem(copy)
    })
    setSelection(copies.map((item) => item.id))
    onChange()
  }

  const bringToFront = (ids) => {
    beforeChange()
    let z = nextZ(items)
    for (const id of ids) {
      const item = itemOf(id)
      if (!item) continue
      item.z = z++
      applyGeometry(item)
    }
    onChange()
  }

  const moveBy = (ids, dx, dy) => {
    for (const id of ids) {
      const item = itemOf(id)
      if (!item) continue
      item.x += dx
      item.y += dy
      applyGeometry(item)
    }
  }

  const tidySelection = () => {
    if (selection.size < 2) return
    beforeChange()
    for (const placed of tidy([...selection].map((id) => rectOf(itemOf(id))))) {
      const item = itemOf(placed.id)
      item.x = placed.x
      item.y = placed.y
      applyGeometry(item)
    }
    onChange()
  }

  const showGuides = (list) => {
    guides.x.hidden = true
    guides.y.hidden = true
    for (const guide of list) {
      const target = guides[guide.axis]
      const screen = toScreen(camera, { x: guide.at, y: guide.at })
      if (guide.axis === 'x') target.style.left = `${screen.x}px`
      else target.style.top = `${screen.y}px`
      target.hidden = false
    }
  }

  const panAtEdges = (point) => {
    let dx = 0
    let dy = 0
    if (point.x < EDGE) dx = EDGE_STEP
    else if (point.x > area.clientWidth - EDGE) dx = -EDGE_STEP
    if (point.y < EDGE) dy = EDGE_STEP
    else if (point.y > area.clientHeight - EDGE) dy = -EDGE_STEP
    if (dx || dy) setCamera(panBy(camera, dx, dy))
  }

  const beginGesture = (event, next) => {
    gesture = { pointerId: event.pointerId, startClient: { x: event.clientX, y: event.clientY }, ...next }
  }

  const dragUpdate = (event) => {
    const point = screenPoint(event)
    const distance = Math.hypot(event.clientX - gesture.startClient.x, event.clientY - gesture.startClient.y)
    if (!gesture.moved) {
      if (distance <= DRAG_THRESHOLD) return
      gesture.moved = true
      beforeChange()
      document.body.classList.add('dragging')
    }
    panAtEdges(point)
    const world = toWorld(camera, point)
    const primary = gesture.origins[0]
    let target = { x: world.x - gesture.grab.x, y: world.y - gesture.grab.y }
    const moving = { x: target.x, y: target.y, w: gesture.bounds.x1 - gesture.bounds.x0, h: gesture.bounds.y1 - gesture.bounds.y0 }
    moving.x += gesture.bounds.x0 - primary.x
    moving.y += gesture.bounds.y0 - primary.y
    const snapped = event.altKey ? { dx: 0, dy: 0, guides: [] } : snapMove(moving, gesture.others, SNAP_DISTANCE / camera.zoom, GRID)
    target = { x: target.x + snapped.dx, y: target.y + snapped.dy }
    showGuides(snapped.guides)
    for (const origin of gesture.origins) {
      const item = itemOf(origin.id)
      item.x = target.x + origin.x - primary.x
      item.y = target.y + origin.y - primary.y
      applyGeometry(item)
    }
  }

  const lassoUpdate = (event) => {
    const start = gesture.startScreen
    const point = screenPoint(event)
    const box = { x0: Math.min(start.x, point.x), y0: Math.min(start.y, point.y), x1: Math.max(start.x, point.x), y1: Math.max(start.y, point.y) }
    lasso.style.left = `${box.x0}px`
    lasso.style.top = `${box.y0}px`
    lasso.style.width = `${box.x1 - box.x0}px`
    lasso.style.height = `${box.y1 - box.y0}px`
    lasso.hidden = false
    const worldBox = { ...toWorld(camera, { x: box.x0, y: box.y0 }), ...(() => { const end = toWorld(camera, { x: box.x1, y: box.y1 }); return { x1: end.x, y1: end.y } })() }
    const hit = items.filter((item) => overlaps(rectOf(item), { x0: worldBox.x, y0: worldBox.y, x1: worldBox.x1, y1: worldBox.y1 })).map((item) => item.id)
    setSelection([...new Set([...gesture.keep, ...hit])])
  }

  const resizeUpdate = (event) => {
    const item = itemOf(gesture.id)
    const world = worldPoint(event)
    const min = item.type === 'image' ? IMAGE_MIN_WIDTH : TEXT_MIN_WIDTH
    if (!gesture.moved) {
      gesture.moved = true
      beforeChange()
    }
    item.w = Math.max(min, snapToGrid(world.x - item.x))
    applyGeometry(item)
  }

  const pinchUpdate = () => {
    const [first, second] = [...touches.values()]
    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
    if (gesture && gesture.kind === 'pinch') {
      const zoomed = zoomAt(camera, distance / gesture.distance, gesture.middle)
      setCamera(panBy(zoomed, middle.x - gesture.middle.x, middle.y - gesture.middle.y))
    }
    gesture = { kind: 'pinch', distance, middle }
  }

  const endGesture = () => {
    if (!gesture) return
    const finished = gesture
    gesture = null
    lasso.hidden = true
    showGuides([])
    document.body.classList.remove('dragging')
    if ((finished.kind === 'drag' || finished.kind === 'resize') && finished.moved) onChange()
    if (finished.kind === 'drag' && !finished.moved && finished.tap && finished.wasSelected) startEditing(finished.origins[0].id)
  }

  const itemAt = (target) => (target instanceof Element ? target.closest('.item') : null)
  const isControl = (target) => target instanceof Element && Boolean(target.closest('.toolbar, .image-selection, .zoom, .menu, .chooser, .board-message'))

  area.addEventListener('pointerdown', (event) => {
    if (isControl(event.target)) return
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, screenPoint(event))
      if (touches.size === 2) {
        gesture = null
        lasso.hidden = true
        pinchUpdate()
        return
      }
    }
    if (event.button !== 0 && event.button !== 1) return
    const element = itemAt(event.target)
    const inEditing = editing && element && element.dataset.id === editing
    if (inEditing && event.target.closest('.note')) return
    if (event.target.closest('.handle') && element && editable) {
      event.preventDefault()
      beginGesture(event, { kind: 'resize', id: element.dataset.id })
      return
    }
    if (event.target.closest('.more')) return
    const wantsPan = event.button === 1 || spaceHeld || !editable || (!element && event.pointerType === 'touch')
    if (wantsPan) {
      if (event.button === 1) event.preventDefault()
      beginGesture(event, { kind: 'pan', startCamera: camera })
      return
    }
    if (element) {
      if (!inEditing) stopEditing()
      const id = element.dataset.id
      const wasSelected = selection.has(id)
      if (event.shiftKey) setSelection(wasSelected ? [...selection].filter((other) => other !== id) : [...selection, id])
      else if (!wasSelected) setSelection([id])
      if (element.dataset.type !== 'link' || event.pointerType === 'mouse') event.preventDefault()
      const chosen = [...selection]
      if (chosen.length === 0) return
      const origins = chosen.map((chosenId) => ({ id: chosenId, x: itemOf(chosenId).x, y: itemOf(chosenId).y }))
      const primary = origins.find((origin) => origin.id === id) || origins[0]
      const world = worldPoint(event)
      beginGesture(event, {
        kind: 'drag',
        origins: [primary, ...origins.filter((origin) => origin !== primary)],
        grab: { x: world.x - primary.x, y: world.y - primary.y },
        bounds: boundsOf(chosen.map((chosenId) => rectOf(itemOf(chosenId)))),
        others: items.filter((item) => !selection.has(item.id)).map(rectOf),
        tap: event.pointerType === 'touch' && element.dataset.type === 'text',
        wasSelected
      })
      return
    }
    stopEditing()
    if (!event.shiftKey) setSelection([])
    beginGesture(event, { kind: 'lasso', startScreen: screenPoint(event), keep: event.shiftKey ? [...selection] : [] })
  })

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' && touches.has(event.pointerId)) {
      touches.set(event.pointerId, screenPoint(event))
      if (touches.size === 2) {
        pinchUpdate()
        return
      }
    }
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (gesture.kind === 'pan') {
      setCamera(panBy(gesture.startCamera, event.clientX - gesture.startClient.x, event.clientY - gesture.startClient.y))
    } else if (gesture.kind === 'drag') dragUpdate(event)
    else if (gesture.kind === 'lasso') lassoUpdate(event)
    else if (gesture.kind === 'resize') resizeUpdate(event)
  })

  const release = (event) => {
    touches.delete(event.pointerId)
    if (gesture && gesture.kind === 'pinch') {
      if (touches.size < 2) gesture = null
      return
    }
    if (gesture && gesture.pointerId === event.pointerId) endGesture()
  }
  document.addEventListener('pointerup', release)
  document.addEventListener('pointercancel', release)

  layer.addEventListener('click', (event) => {
    const element = itemAt(event.target)
    if (!element) return
    if (element.dataset.type === 'image' && !editable) onOpenImage(element.querySelector('img'))
    if (element.dataset.type === 'link' && (document.body.classList.contains('dragging') || (editable && !event.ctrlKey && !event.metaKey && event.pointerType !== 'touch' && selection.size > 1))) event.preventDefault()
  })

  area.addEventListener('dblclick', (event) => {
    if (!editable || isControl(event.target)) return
    const element = itemAt(event.target)
    if (!element) {
      addText(worldPoint(event))
      return
    }
    const type = element.dataset.type
    if (type === 'text') startEditing(element.dataset.id, { x: event.clientX, y: event.clientY })
    else if (type === 'image') onOpenImage(element.querySelector('img'))
  })

  area.addEventListener('wheel', (event) => {
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      setCamera(zoomAt(camera, event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, screenPoint(event)))
      return
    }
    const horizontal = event.shiftKey && event.deltaX === 0
    setCamera(panBy(camera, -(horizontal ? event.deltaY : event.deltaX), horizontal ? 0 : -event.deltaY))
  }, { passive: false })

  const inField = (target) => target instanceof Element && (target.matches('input, textarea') || target.isContentEditable)

  document.addEventListener('keydown', (event) => {
    if (event.key === ' ' && !inField(event.target)) spaceHeld = true
    if (event.key === 'Escape') {
      if (editing) {
        stopEditing()
        onChange()
      } else setSelection([])
      return
    }
    if (!editable || inField(event.target)) return
    const modifier = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (modifier && key === 'a' && event.shiftKey) {
      event.preventDefault()
      tidySelection()
    } else if (modifier && key === 'a') {
      event.preventDefault()
      setSelection(items.map((item) => item.id))
    } else if (modifier && key === 'd') {
      event.preventDefault()
      duplicateItems([...selection])
    } else if (modifier && key === '0') {
      event.preventDefault()
      setCamera(zoomAt(camera, 1 / camera.zoom, { x: area.clientWidth / 2, y: area.clientHeight / 2 }))
    } else if (modifier && (key === '=' || key === '+' || key === '-')) {
      event.preventDefault()
      zoomBy(key === '-' ? 1 / ZOOM_STEP : ZOOM_STEP)
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selection.size > 0) {
      event.preventDefault()
      beforeChange()
      removeItems([...selection])
      onChange()
    } else if (event.key.startsWith('Arrow') && selection.size > 0) {
      event.preventDefault()
      const step = event.shiftKey ? NUDGE_LARGE : NUDGE
      beforeChange()
      moveBy([...selection], event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)
      onChange()
    }
  })

  document.addEventListener('keyup', (event) => {
    if (event.key === ' ') spaceHeld = false
  })

  const zoomBy = (factor) => setCamera(zoomAt(camera, factor, { x: area.clientWidth / 2, y: area.clientHeight / 2 }))

  const fit = (ids) => {
    const chosen = ids ? ids.map(itemOf).filter(Boolean) : items
    const bounds = boundsOf(chosen.map(rectOf))
    setCamera(bounds ? fitCamera(bounds, viewport()) : { zoom: 1, x: 24, y: 24 })
  }

  const load = (content, storedCamera) => {
    stopEditing()
    selection = new Set()
    items = parseContent(content).map((item) => ({ ...item, x: Number(item.x) || 0, y: Number(item.y) || 0, z: Number(item.z) || 1, w: Number(item.w) || NEW_TEXT_WIDTH }))
    renderAll()
    if (storedCamera) setCamera(storedCamera)
    else fit()
  }

  const serializeItems = () => JSON.stringify(items.map((item) => {
    if (item.type === 'text') return { ...item, html: serialize(noteOf(item.id)) }
    if (item.type === 'image') return { ...item, src: elements.get(item.id).querySelector('img').getAttribute('src') }
    return item
  }))

  const snapshot = () => {
    const key = serializeItems()
    return { key, editing, caret: editing ? caretPath(noteOf(editing)) : null }
  }

  const restore = (entry) => {
    const stored = camera
    const target = entry.editing
    editing = null
    items = parseContent(entry.key)
    renderAll()
    setCamera(stored)
    if (target && elements.has(target)) {
      startEditing(target)
      restoreCaretPath(noteOf(target), entry.caret)
    }
    onChange()
  }

  const setEditable = (next) => {
    editable = next
    area.dataset.editable = String(next)
    if (!next) {
      stopEditing()
      setSelection([])
    }
  }

  const isBlankBoard = () => items.length === 0 || (items.length === 1 && items[0].type === 'text' && isBlank(noteOf(items[0].id)))

  const editFirstText = () => {
    const first = readingOrder(items).find((item) => item.type === 'text')
    if (first) startEditing(first.id)
  }

  const elementsInReadingOrder = () => readingOrder(items).map((item) => elements.get(item.id))

  const setMessage = (text) => {
    message.textContent = text
    message.hidden = !text
  }

  const enterPrint = () => {
    layer.dataset.print = ''
    layer.style.transform = ''
    for (const element of elementsInReadingOrder()) {
      element.style.transform = ''
      element.style.width = ''
      layer.append(element)
    }
  }

  const exitPrint = () => {
    delete layer.dataset.print
    applyCamera()
    for (const item of items) applyGeometry(item)
  }

  window.addEventListener('beforeprint', enterPrint)
  window.addEventListener('afterprint', exitPrint)

  applyCamera()

  return {
    host,
    load,
    serialize: serializeItems,
    snapshot,
    restore,
    setEditable,
    isBlank: isBlankBoard,
    editFirstText,
    stopEditing,
    addText,
    addImage,
    addLink,
    duplicate: duplicateItems,
    bringToFront,
    remove: (ids) => {
      beforeChange()
      removeItems(ids)
      onChange()
    },
    selected: () => [...selection],
    camera: () => camera,
    setCamera,
    zoomBy,
    fit,
    center: () => toWorld(camera, { x: area.clientWidth / 2, y: area.clientHeight / 2 }),
    worldPoint: (point) => toWorld(camera, { x: point.x - area.getBoundingClientRect().left, y: point.y - area.getBoundingClientRect().top }),
    elementsInReadingOrder,
    setMessage,
    itemOf
  }
}
