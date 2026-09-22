import { WHEEL_STEP, ZOOM_STEP, fitCamera, panBy, toScreen, toWorld, zoomAt } from './camera.js'
import { svgIcon } from './dom.js'
import { caretPathOf, isBlank, placeCaretAtEnd, placeCaretAtPoint, placeCaretByPath } from './editor.js'
import { createFileCards } from './file-card.js'
import { CARD_HEIGHT, CARD_WIDTH, FRAME_MIN, IMAGE_MIN_HEIGHT, IMAGE_MIN_WIDTH, REFERENCE_TYPES, TEXT_COLORS, TEXT_MIN_WIDTH, boundsOf, frameAround, frameMembers, kindOf, linkLabel, newId, nextZ, overlaps, parseContent, readingOrder } from './items.js'
import { render, safeHref, safeImageSource, serialize } from './sanitize.js'
import { GRID, SNAP_DISTANCE, snapMove, snapToGrid, tidy } from './snap.js'

const DRAG_THRESHOLD = 4
const NUDGE = 8
const NUDGE_LARGE = 40
const DUPLICATE_OFFSET = 24
const NEW_TEXT_WIDTH = 320
const NOTE_WIDTH = 200
const IMAGE_MAX_WIDTH = 640
const EDGE = 40
const EDGE_STEP = 16
const LINK_ICON = 'M13.2 18.8l5.6-5.6M11.6 15.2l-2.4 2.4a3.7 3.7 0 1 0 5.2 5.2l2.4-2.4M20.4 16.8l2.4-2.4a3.7 3.7 0 1 0-5.2-5.2l-2.4 2.4'
const CARDS = ['link', ...REFERENCE_TYPES]
const ALL_EDGES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const HANDLE_EDGES = { text: ['e', 'w'], image: ALL_EDGES, frame: ALL_EDGES, file: ['e', 'w'] }
const TYPES = ['text', 'image', 'link', 'frame', ...REFERENCE_TYPES]
const FRAME_SIZE = { w: 320, h: 240 }
const MIN_SIZE = { image: { w: IMAGE_MIN_WIDTH, h: IMAGE_MIN_HEIGHT }, frame: { w: FRAME_MIN, h: FRAME_MIN }, text: { w: TEXT_MIN_WIDTH, h: 0 }, file: { w: CARD_WIDTH, h: 0 } }
const CONTROLS = '.toolbar, .image-selection, .zoom, .tools, .menu, .chooser, .board-message, .play, .rename, video, .doc'
export const TOOLS = ['select', 'hand', 'text', 'note', 'frame']
export const TOOL_KEYS = { v: 'select', h: 'hand', t: 'text', n: 'note', f: 'frame' }
export const CLIPBOARD_PREFIX = 'trecos-items:'

export function cleanItems(raw) {
  const kept = []
  for (const item of raw) {
    const clean = { ...item, x: Number(item.x) || 0, y: Number(item.y) || 0, z: Number(item.z) || 1, w: Number(item.w) || NEW_TEXT_WIDTH }
    if (clean.type === 'link') clean.url = safeHref(String(clean.url || ''))
    if (clean.type === 'image') {
      clean.src = safeImageSource(String(clean.src || ''), true)
      if (Number(clean.h) > 0) clean.h = Number(clean.h)
      else delete clean.h
      if (typeof clean.file !== 'string' || clean.file === '') {
        delete clean.file
        delete clean.name
        delete clean.size
      }
    }
    if (clean.type === 'text') {
      clean.html = String(clean.html || '')
      if (!TEXT_COLORS.includes(clean.color)) delete clean.color
    }
    if (REFERENCE_TYPES.includes(clean.type)) clean.name = String(clean.name || '')
    if (clean.type === 'frame') {
      clean.h = Number(clean.h) || FRAME_SIZE.h
      clean.name = String(clean.name || '')
    }
    if (!TYPES.includes(clean.type) || clean.url === null || clean.src === null) continue
    if (CARDS.includes(clean.type) && !(Number(item.w) > 0)) delete clean.w
    kept.push(clean)
  }
  return kept
}

export function parseClipboard(text) {
  if (typeof text !== 'string' || !text.startsWith(CLIPBOARD_PREFIX)) return null
  try {
    const parsed = JSON.parse(text.slice(CLIPBOARD_PREFIX.length))
    return parsed && Array.isArray(parsed.items) ? { board: String(parsed.board || ''), items: parsed.items } : null
  } catch {
    return null
  }
}

export function createBoard({ area, layer, lasso, guides, message, translate, language, boardId, metaOf, onChange, beforeChange, onCamera, onSelection = () => {}, onTool = () => {}, onOpenImage, onOpenItem, onItemMenu, onContextMenu, onImageInserted, onFileInserted, onFileCopy, onMediaLink, onRenameFile }) {
  let items = []
  const elements = new Map()
  let camera = { zoom: 1, x: 24, y: 24 }
  let editable = true
  let editing = null
  let selection = new Set()
  let gesture = null
  const touches = new Map()
  let spaceHeld = false
  let tool = 'select'
  let suppressClick = false
  let broken = false
  let documentNote = null
  let documentEditable = false

  const itemOf = (id) => items.find((item) => item.id === id)
  const noteOf = (id) => elements.get(id).querySelector('.note')
  const cards = createFileCards({ elements, itemOf, translate, language, metaOf, onMediaLink, onRenameFile, onChange, onPlayingChanged: (id) => refreshDecoration(id) })
  const host = {
    layer: area,
    area,
    editable: () => (documentNote ? documentEditable : editable),
    active: () => documentNote || (editing ? noteOf(editing) : null),
    rootOf: (node) => {
      const element = node instanceof Element ? node : node.parentElement
      return element ? element.closest('.note') : null
    },
    setDocument: (note, canEdit = true) => {
      documentNote = note
      documentEditable = Boolean(note) && canEdit
    }
  }

  const setTool = (next) => {
    if (!TOOLS.includes(next) || next === tool) return
    tool = next
    area.dataset.tool = tool
    if (tool !== 'select') stopEditing()
    onTool(tool)
  }

  const setSpaceHeld = (held) => {
    spaceHeld = held
    area.classList.toggle('space-pan', held)
  }

  const rectOf = (item) => {
    const element = elements.get(item.id)
    const w = CARDS.includes(item.type) ? (element ? element.offsetWidth : 230) : item.w
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
    if (!CARDS.includes(item.type)) element.style.width = `${item.w}px`
    if (item.type === 'file') {
      if (item.w) element.style.setProperty('--card-w', `${item.w}px`)
      else element.style.removeProperty('--card-w')
    }
    if (item.type === 'image' || item.type === 'frame') element.style.height = item.h ? `${item.h}px` : ''
  }

  const frameLabel = (item) => item.name || translate('frame')

  const applyColor = (item) => {
    const element = elements.get(item.id)
    for (const color of TEXT_COLORS) element.classList.toggle(`color-${color}`, item.color === color)
  }

  const resizable = (element) => element.dataset.type !== 'file' || element.classList.contains('playing')

  const decorate = (element) => {
    if (element.querySelector(':scope > .more')) return
    for (const edge of resizable(element) ? HANDLE_EDGES[element.dataset.type] || [] : []) {
      const handle = document.createElement('span')
      handle.className = `handle handle-${edge}`
      handle.dataset.edge = edge
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

  const refreshDecoration = (id) => {
    const element = elements.get(id)
    if (!element || !selection.has(id)) return
    undecorate(element)
    decorate(element)
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
    onSelection([...next])
  }

  const imageNote = (item) => {
    const element = elements.get(item.id)
    let note = element.querySelector('.image-note')
    const text = item.file ? metaOf(item) : ''
    if (!text) {
      if (note) note.remove()
      return
    }
    if (!note) {
      note = document.createElement('span')
      note.className = 'image-note'
      element.append(note)
    }
    note.textContent = text
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
      elements.set(item.id, element)
      imageNote(item)
    } else if (item.type === 'link') {
      element.href = item.url
      element.target = '_blank'
      element.rel = 'noopener noreferrer'
      const label = document.createElement('span')
      label.textContent = linkLabel(item.url)
      element.append(svgIcon(LINK_ICON, 24), label)
    } else if (item.type === 'frame') {
      const label = document.createElement('span')
      label.className = 'frame-label'
      label.textContent = frameLabel(item)
      element.append(label, ...['top', 'right', 'bottom', 'left'].map((side) => {
        const edge = document.createElement('span')
        edge.className = `frame-edge frame-${side}`
        return edge
      }))
    } else {
      cards.build(element, item)
    }
    elements.set(item.id, element)
    applyGeometry(item)
    if (item.type === 'text') applyColor(item)
    return element
  }

  const renderAll = () => {
    cards.stopPlaying()
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
    if (isBlank(note) && !note.querySelector('h1,h2,ul,ol,hr,blockquote,pre')) {
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
    if (ids.includes(cards.playingId())) cards.stopPlaying()
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

  const addText = (point, html = '', color = '') => {
    beforeChange()
    const item = { id: newId(), type: 'text', ...place(point), w: TEXT_COLORS.includes(color) ? NOTE_WIDTH : NEW_TEXT_WIDTH, html }
    if (TEXT_COLORS.includes(color)) item.color = color
    addItem(item)
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

  const addFile = (point, file) => {
    beforeChange()
    const item = addItem({ id: newId(), type: 'file', ...place(point), file: '', name: file.name, size: file.size, kind: kindOf(file.name) })
    onChange()
    onFileInserted(item, file)
    return item
  }

  const addFrame = (rect) => {
    beforeChange()
    const item = addItem({ id: newId(), type: 'frame', x: snapToGrid(rect.x), y: snapToGrid(rect.y), z: 0, w: Math.max(FRAME_MIN, snapToGrid(rect.w)), h: Math.max(FRAME_MIN, snapToGrid(rect.h)), name: '' })
    onChange()
    setSelection([item.id])
    return item
  }

  const frameSelection = (ids) => {
    const bounds = boundsOf(ids.map(itemOf).filter((item) => item && item.type !== 'frame').map(rectOf))
    return bounds ? addFrame(frameAround(bounds)) : null
  }

  const renameFrame = (id) => {
    const item = itemOf(id)
    const element = elements.get(id)
    if (!item || !element || !editable) return
    const label = element.querySelector('.frame-label')
    const input = document.createElement('input')
    input.className = 'rename frame-rename'
    input.value = item.name
    input.placeholder = translate('frame')
    let done = false
    const finish = (commit) => {
      if (done) return
      done = true
      const next = input.value.trim().slice(0, 80)
      input.replaceWith(label)
      if (!commit || next === item.name) return
      beforeChange()
      item.name = next
      label.textContent = frameLabel(item)
      onChange()
    }
    input.addEventListener('keydown', (event) => {
      event.stopPropagation()
      if (event.key === 'Enter') finish(true)
      if (event.key === 'Escape') finish(false)
    })
    input.addEventListener('blur', () => finish(true))
    label.replaceWith(input)
    input.focus()
    input.select()
  }

  const renameItem = (id) => {
    const item = itemOf(id)
    if (item && item.type === 'frame') renameFrame(id)
    else cards.rename(id)
  }

  const addReference = (point, kind, id, name, extra = {}) => {
    beforeChange()
    const item = addItem({ id: newId(), type: kind, ...place(point), [kind]: id, name, ...extra })
    onChange()
    setSelection([item.id])
    return item
  }

  const referenceIds = (kind, id) => items.filter((item) => item.type === kind && item[kind] === id).map((item) => item.id)

  const linkImage = (id, record) => {
    const item = itemOf(id)
    if (!item || item.type !== 'image') return
    beforeChange()
    item.file = record.id
    item.name = record.name
    item.size = record.size
    if (record.pic) {
      item.src = `/api/pic/${record.id}/${record.pic}`
      elements.get(id).querySelector('img').src = item.src
    }
    imageNote(item)
    onChange()
  }

  const addPicture = (point, record) => {
    beforeChange()
    const item = addItem({ id: newId(), type: 'image', ...place(point), w: NEW_TEXT_WIDTH, src: `/api/pic/${record.id}/${record.pic}`, file: record.id, name: record.name, size: record.size })
    const img = elements.get(item.id).querySelector('img')
    img.addEventListener('load', () => {
      if (!img.naturalWidth) return
      item.width = img.naturalWidth
      item.height = img.naturalHeight
      item.w = Math.max(IMAGE_MIN_WIDTH, Math.min(IMAGE_MAX_WIDTH, img.naturalWidth))
      img.width = item.width
      img.height = item.height
      applyGeometry(item)
      onChange()
    }, { once: true })
    onChange()
    setSelection([item.id])
    return item
  }

  const refreshCards = () => {
    for (const item of items) {
      if (item.type === 'image') imageNote(item)
      else if (REFERENCE_TYPES.includes(item.type)) cards.refresh(item)
    }
  }

  const renameReferences = (kind, id, name) => {
    for (const item of items) {
      if (item.type !== kind || item[kind] !== id) continue
      item.name = name
      cards.refresh(item)
    }
  }

  const setColor = (ids, color) => {
    beforeChange()
    for (const id of ids) {
      const item = itemOf(id)
      if (!item || item.type !== 'text') continue
      if (TEXT_COLORS.includes(color)) item.color = color
      else delete item.color
      applyColor(item)
    }
    onChange()
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

  const clipboardText = (ids) => {
    const chosen = ids.map(itemOf).filter((item) => item && (item.type !== 'file' || item.file))
    if (chosen.length === 0) return ''
    const payload = chosen.map((item) => (item.type === 'text' ? { ...item, html: serialize(noteOf(item.id)) } : item))
    return `${CLIPBOARD_PREFIX}${JSON.stringify({ board: boardId(), items: payload })}`
  }

  const pasteItems = (parsed, point) => {
    const incoming = cleanItems(parseContent(JSON.stringify(parsed.items)) || [])
    if (incoming.length === 0) return
    beforeChange()
    const bounds = boundsOf(incoming.map((item) => ({ x: Number(item.x) || 0, y: Number(item.y) || 0, w: Number(item.w) || CARD_HEIGHT, h: CARD_HEIGHT })))
    let z = nextZ(items)
    const sameBoard = parsed.board === boardId()
    const pasted = incoming.map((source) => {
      const item = { ...source, id: newId(), x: snapToGrid(point.x + (Number(source.x) || 0) - bounds.x0), y: snapToGrid(point.y + (Number(source.y) || 0) - bounds.y0), z: z++ }
      if (item.type === 'file' && !sameBoard) {
        const sourceFile = item.file
        item.file = ''
        addItem(item)
        onFileCopy(item, sourceFile)
        return item
      }
      if (item.type === 'doc' && !sameBoard) return null
      return addItem(item)
    }).filter(Boolean)
    setSelection(pasted.map((item) => item.id))
    onChange()
  }

  const focusItem = (id) => {
    if (!elements.has(id)) return
    setSelection([id])
    fit([id])
  }

  const inField = (target) => target instanceof Element && (target.matches('input, textarea') || target.isContentEditable)
  const focusInBoard = () => document.activeElement === document.body || area.contains(document.activeElement)

  document.addEventListener('copy', (event) => {
    if (!editable || editing || selection.size === 0 || inField(event.target)) return
    const text = clipboardText([...selection])
    if (!text) return
    event.clipboardData.setData('text/plain', text)
    event.preventDefault()
  })

  document.addEventListener('cut', (event) => {
    if (!editable || editing || selection.size === 0 || inField(event.target)) return
    const text = clipboardText([...selection])
    if (!text) return
    event.clipboardData.setData('text/plain', text)
    event.preventDefault()
    beforeChange()
    removeItems([...selection])
    onChange()
  })

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

  const sendToBack = (ids) => {
    beforeChange()
    const chosen = new Set(ids)
    let z = 1
    for (const item of [...items].sort((a, b) => a.z - b.z)) {
      if (chosen.has(item.id)) continue
      item.z = z + ids.length
      z++
      applyGeometry(item)
    }
    let low = 1
    for (const id of ids) {
      const item = itemOf(id)
      if (!item) continue
      item.z = low++
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
    highlightDropFolder(event)
  }

  const folderCardAt = (event) => {
    const hit = document.elementFromPoint(event.clientX, event.clientY)
    const element = hit instanceof Element ? hit.closest('.item.folder') : null
    return element && !selection.has(element.dataset.id) ? element : null
  }

  const highlightDropFolder = (event) => {
    const movable = gesture.origins.every((origin) => ['file', 'doc'].includes((itemOf(origin.id) || {}).type))
    const target = movable ? folderCardAt(event) : null
    for (const element of layer.querySelectorAll('.item.folder.drop-target')) if (element !== target) element.classList.remove('drop-target')
    if (target) target.classList.add('drop-target')
    gesture.dropFolder = target ? target.dataset.id : ''
  }

  const rubberBand = (event) => {
    const start = gesture.startScreen
    const point = screenPoint(event)
    const box = { x0: Math.min(start.x, point.x), y0: Math.min(start.y, point.y), x1: Math.max(start.x, point.x), y1: Math.max(start.y, point.y) }
    lasso.style.left = `${box.x0}px`
    lasso.style.top = `${box.y0}px`
    lasso.style.width = `${box.x1 - box.x0}px`
    lasso.style.height = `${box.y1 - box.y0}px`
    lasso.hidden = false
    if (Math.hypot(event.clientX - gesture.startClient.x, event.clientY - gesture.startClient.y) > DRAG_THRESHOLD) gesture.moved = true
    return box
  }

  const drawUpdate = (event) => {
    const box = rubberBand(event)
    const from = toWorld(camera, { x: box.x0, y: box.y0 })
    const to = toWorld(camera, { x: box.x1, y: box.y1 })
    gesture.rect = { x: from.x, y: from.y, w: to.x - from.x, h: to.y - from.y }
  }

  const lassoUpdate = (event) => {
    const box = rubberBand(event)
    const from = toWorld(camera, { x: box.x0, y: box.y0 })
    const to = toWorld(camera, { x: box.x1, y: box.y1 })
    const region = { x0: from.x, y0: from.y, x1: to.x, y1: to.y }
    const encloses = (rect) => rect.x >= region.x0 && rect.y >= region.y0 && rect.x + rect.w <= region.x1 && rect.y + rect.h <= region.y1
    const hit = items.filter((item) => (item.type === 'frame' ? encloses(rectOf(item)) : overlaps(rectOf(item), region))).map((item) => item.id)
    setSelection([...new Set([...gesture.keep, ...hit])])
  }

  const resizeUpdate = (event) => {
    const item = itemOf(gesture.id)
    const world = worldPoint(event)
    const { edge, start, ratio } = gesture
    const dx = world.x - start.world.x
    const dy = world.y - start.world.y
    if (!gesture.moved) {
      gesture.moved = true
      beforeChange()
    }
    let w = edge.includes('e') ? start.w + dx : edge.includes('w') ? start.w - dx : start.w
    let h = edge.includes('s') ? start.h + dy : edge.includes('n') ? start.h - dy : start.h
    const proportional = item.type === 'image' && edge.length === 2 && !event.shiftKey
    if (proportional) {
      if (Math.abs(dx) >= Math.abs(dy)) h = w / ratio
      else w = h * ratio
    }
    const min = MIN_SIZE[item.type]
    w = Math.max(min.w, snapToGrid(w))
    h = Math.max(min.h, snapToGrid(h))
    if (proportional) h = Math.max(min.h, Math.round(w / ratio))
    if (edge.includes('w')) item.x = start.x + start.w - w
    if (edge.includes('n')) item.y = start.y + start.h - h
    item.w = w
    if (item.type === 'frame' || (item.type === 'image' && (item.h || !proportional))) item.h = h
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
    for (const element of layer.querySelectorAll('.item.folder.drop-target')) element.classList.remove('drop-target')
    suppressClick = Boolean(finished.moved)
    if (finished.kind === 'drag' && finished.moved && finished.dropFolder) {
      onContextMenu({ kind: 'dropOnFolder', folder: itemOf(finished.dropFolder), ids: finished.origins.map((origin) => origin.id) })
      return
    }
    if ((finished.kind === 'drag' || finished.kind === 'resize') && finished.moved) onChange()
    if (finished.kind === 'drag' && !finished.moved && finished.tap && finished.wasSelected) startEditing(finished.origins[0].id)
    if (finished.kind === 'place' && !finished.moved) {
      if (finished.editId) startEditing(finished.editId, finished.client)
      else addText(finished.world, '', finished.color)
      setTool('select')
    }
    if (finished.kind === 'draw') {
      const rect = finished.moved && finished.rect && finished.rect.w >= FRAME_MIN && finished.rect.h >= FRAME_MIN ? finished.rect : { ...finished.world, ...FRAME_SIZE }
      addFrame(rect)
      setTool('select')
    }
  }

  const itemAt = (target) => (target instanceof Element ? target.closest('.item') : null)
  const isControl = (target) => target instanceof Element && Boolean(target.closest(CONTROLS))

  area.addEventListener('pointerdown', (event) => {
    suppressClick = false
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
    const handle = event.target.closest('.handle')
    if (handle && element && editable) {
      event.preventDefault()
      const item = itemOf(element.dataset.id)
      const box = rectOf(item)
      beginGesture(event, { kind: 'resize', id: item.id, edge: handle.dataset.edge, start: { x: item.x, y: item.y, w: box.w, h: box.h, world: worldPoint(event) }, ratio: box.w / Math.max(1, box.h) })
      return
    }
    if (event.target.closest('.more')) return
    const wantsPan = event.button === 1 || spaceHeld || tool === 'hand' || !editable || (!element && event.pointerType === 'touch')
    if (wantsPan) {
      if (event.button === 1) event.preventDefault()
      beginGesture(event, { kind: 'pan', startCamera: camera })
      return
    }
    if (tool === 'text' || tool === 'note') {
      event.preventDefault()
      const editId = tool === 'text' && element && element.dataset.type === 'text' ? element.dataset.id : ''
      if (!editId) stopEditing()
      beginGesture(event, { kind: 'place', world: worldPoint(event), client: { x: event.clientX, y: event.clientY }, color: tool === 'note' ? 'hl1' : '', editId })
      return
    }
    if (tool === 'frame') {
      event.preventDefault()
      stopEditing()
      setSelection([])
      beginGesture(event, { kind: 'draw', startScreen: screenPoint(event), world: worldPoint(event) })
      return
    }
    if (element) {
      if (!inEditing) stopEditing()
      const id = element.dataset.id
      const wasSelected = selection.has(id)
      if (event.shiftKey) setSelection(wasSelected ? [...selection].filter((other) => other !== id) : [...selection, id])
      else if (!wasSelected) setSelection([id])
      const grabbed = itemOf(id)
      if (grabbed && grabbed.type !== 'frame' && grabbed.z !== nextZ(items) - 1) {
        grabbed.z = nextZ(items)
        applyGeometry(grabbed)
        onChange()
      }
      if (element.dataset.type !== 'link' || event.pointerType === 'mouse') event.preventDefault()
      if (selection.size === 0) return
      const carried = new Set(selection)
      for (const chosenId of selection) {
        const chosenItem = itemOf(chosenId)
        if (chosenItem.type === 'frame') frameMembers(items, chosenItem).forEach((member) => carried.add(member.id))
      }
      const chosen = [...carried]
      const origins = chosen.map((chosenId) => ({ id: chosenId, x: itemOf(chosenId).x, y: itemOf(chosenId).y }))
      const primary = origins.find((origin) => origin.id === id) || origins[0]
      const world = worldPoint(event)
      beginGesture(event, {
        kind: 'drag',
        origins: [primary, ...origins.filter((origin) => origin !== primary)],
        grab: { x: world.x - primary.x, y: world.y - primary.y },
        bounds: boundsOf(chosen.map((chosenId) => rectOf(itemOf(chosenId)))),
        others: items.filter((item) => !carried.has(item.id) && item.type !== 'frame').map(rectOf),
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
      const dx = event.clientX - gesture.startClient.x
      const dy = event.clientY - gesture.startClient.y
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) gesture.moved = true
      setCamera(panBy(gesture.startCamera, dx, dy))
    } else if (gesture.kind === 'drag') dragUpdate(event)
    else if (gesture.kind === 'lasso') lassoUpdate(event)
    else if (gesture.kind === 'draw') drawUpdate(event)
    else if (gesture.kind === 'resize') resizeUpdate(event)
    else if (gesture.kind === 'place' && Math.hypot(event.clientX - gesture.startClient.x, event.clientY - gesture.startClient.y) > DRAG_THRESHOLD) gesture.moved = true
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

  area.addEventListener('click', (event) => {
    if (!suppressClick) return
    suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }, true)

  layer.addEventListener('click', (event) => {
    const element = itemAt(event.target)
    if (!element) return
    const type = element.dataset.type
    if (type === 'image' && !editable) onOpenImage(element.querySelector('img'))
    if (REFERENCE_TYPES.includes(type) && !editable && !isControl(event.target)) onOpenItem(itemOf(element.dataset.id))
    if (type === 'link' && editable && (tool === 'hand' || (!event.ctrlKey && !event.metaKey && event.pointerType !== 'touch' && selection.size > 1))) event.preventDefault()
  })

  area.addEventListener('dblclick', (event) => {
    if (!editable || isControl(event.target)) return
    const element = itemAt(event.target)
    if (!element) {
      addText(worldPoint(event))
      return
    }
    const type = element.dataset.type
    if (event.target.closest('.handle') && type === 'image') {
      const item = itemOf(element.dataset.id)
      beforeChange()
      item.w = Math.max(IMAGE_MIN_WIDTH, Math.min(IMAGE_MAX_WIDTH, item.width || item.w))
      delete item.h
      applyGeometry(item)
      onChange()
      return
    }
    if (type === 'text') startEditing(element.dataset.id, { x: event.clientX, y: event.clientY })
    else if (type === 'image') onOpenImage(element.querySelector('img'))
    else if (type === 'frame') renameFrame(element.dataset.id)
    else if (REFERENCE_TYPES.includes(type)) onOpenItem(itemOf(element.dataset.id))
  })

  area.addEventListener('contextmenu', (event) => {
    if (isControl(event.target)) return
    const element = itemAt(event.target)
    if (editing && element && element.dataset.id === editing && event.target.closest('.note')) return
    event.preventDefault()
    if (!editable) return
    const point = { x: event.clientX, y: event.clientY }
    if (!element) {
      onContextMenu({ kind: 'board', point, world: worldPoint(event) })
      return
    }
    const id = element.dataset.id
    if (!selection.has(id)) setSelection([id])
    onContextMenu({ kind: 'items', point, item: itemOf(id), ids: [...selection] })
  })

  area.addEventListener('wheel', (event) => {
    if (event.target instanceof Element && event.target.closest('.doc')) return
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      setCamera(zoomAt(camera, event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, screenPoint(event)))
      return
    }
    const horizontal = event.shiftKey && event.deltaX === 0
    setCamera(panBy(camera, -(horizontal ? event.deltaY : event.deltaX), horizontal ? 0 : -event.deltaY))
  }, { passive: false })

  document.addEventListener('keydown', (event) => {
    if (event.key === ' ' && !inField(event.target)) setSpaceHeld(true)
    if (event.key === 'Escape') {
      if (editing) {
        stopEditing()
        onChange()
      } else if (tool !== 'select') setTool('select')
      else if (!documentNote) setSelection([])
      return
    }
    if (!editable || documentNote || inField(event.target) || !focusInBoard()) return
    const modifier = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (!modifier && !event.altKey && TOOL_KEYS[key]) {
      event.preventDefault()
      setTool(TOOL_KEYS[key])
    } else if (modifier && key === 'a' && event.shiftKey) {
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
    } else if (event.key === 'Enter' && selection.size === 1 && !modifier) {
      const item = itemOf([...selection][0])
      if (!item) return
      event.preventDefault()
      if (item.type === 'text') startEditing(item.id)
      else if (item.type === 'image') onOpenImage(elements.get(item.id).querySelector('img'))
      else if (item.type === 'frame') renameFrame(item.id)
      else if (REFERENCE_TYPES.includes(item.type)) onOpenItem(item)
    } else if (event.key === 'F2' && selection.size === 1) {
      event.preventDefault()
      renameItem([...selection][0])
    } else if (event.key.startsWith('Arrow') && selection.size > 0) {
      event.preventDefault()
      const step = event.shiftKey ? NUDGE_LARGE : NUDGE
      beforeChange()
      moveBy([...selection], event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)
      onChange()
    }
  })

  document.addEventListener('keyup', (event) => {
    if (event.key === ' ') setSpaceHeld(false)
  })

  const zoomBy = (factor) => setCamera(zoomAt(camera, factor, { x: area.clientWidth / 2, y: area.clientHeight / 2 }))

  const fit = (ids) => {
    if (area.clientWidth === 0 || area.clientHeight === 0) {
      requestAnimationFrame(() => { if (area.clientWidth > 0 && area.clientHeight > 0) fit(ids) })
      return
    }
    const chosen = ids ? ids.map(itemOf).filter(Boolean) : items
    const bounds = boundsOf(chosen.map(rectOf))
    setCamera(bounds ? fitCamera(bounds, viewport()) : { zoom: 1, x: 24, y: 24 })
  }

  const load = (content, storedCamera) => {
    stopEditing()
    selection = new Set()
    const parsed = parseContent(content)
    broken = parsed === null
    items = cleanItems(parsed || [])
    renderAll()
    setMessage(broken ? translate('loadFailed') : '')
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
    return { key, editing, caret: editing ? caretPathOf(noteOf(editing)) : null }
  }

  const restore = (entry) => {
    const stored = camera
    const target = entry.editing
    editing = null
    items = cleanItems(parseContent(entry.key) || [])
    renderAll()
    setCamera(stored)
    if (target && elements.has(target)) {
      startEditing(target)
      placeCaretByPath(noteOf(target), entry.caret)
    }
    onChange()
  }

  const setEditable = (next) => {
    editable = next && !broken
    area.dataset.editable = String(editable)
    if (!next) {
      stopEditing()
      setSelection([])
      setTool('select')
    }
  }

  const isBlankBoard = () => items.length === 0 || (items.length === 1 && items[0].type === 'text' && isBlank(noteOf(items[0].id)))

  const editFirstText = () => {
    const first = readingOrder(items).find((item) => item.type === 'text')
    if (first) startEditing(first.id)
  }

  const elementsInReadingOrder = () => readingOrder(items).map((item) => elements.get(item.id))

  const setMessage = (text) => {
    message.replaceChildren(...String(text || '').split('\n').filter(Boolean).map((line) => {
      const row = document.createElement('span')
      row.textContent = line
      return row
    }))
    message.hidden = !text
  }

  const enterPrint = () => {
    layer.dataset.print = ''
    layer.style.transform = ''
    for (const element of elementsInReadingOrder()) {
      element.style.transform = ''
      element.style.width = ''
      element.style.height = ''
      layer.append(element)
    }
  }

  const exitPrint = () => {
    delete layer.dataset.print
    delete layer.dataset.printOnly
    for (const element of layer.querySelectorAll('.print-target')) element.classList.remove('print-target')
    applyCamera()
    for (const item of items) applyGeometry(item)
  }

  const printOnly = (ids) => {
    layer.dataset.printOnly = ''
    for (const id of ids) {
      const element = elements.get(id)
      if (element) element.classList.add('print-target')
    }
    window.print()
  }

  window.addEventListener('beforeprint', enterPrint)
  window.addEventListener('afterprint', exitPrint)

  applyCamera()

  return {
    host,
    load,
    serialize: serializeItems,
    items: () => items,
    snapshot,
    restore,
    setEditable,
    isBroken: () => broken,
    isBlank: isBlankBoard,
    editFirstText,
    startEditing,
    stopEditing,
    addText,
    addImage,
    addLink,
    addFile,
    addReference,
    addFrame,
    frameSelection,
    frameSize: FRAME_SIZE,
    referenceIds,
    renameReferences,
    linkImage,
    addPicture,
    refreshCards,
    setColor,
    setFileProgress: cards.setProgress,
    setFileRecord: cards.setRecord,
    renameFile: renameItem,
    refreshCard: cards.refresh,
    pendingFileIds: () => [...layer.querySelectorAll('.item.file[data-pending]')].map((element) => element.dataset.id),
    duplicate: duplicateItems,
    clipboardText,
    pasteItems,
    focusItem,
    bringToFront,
    sendToBack,
    remove: (ids) => {
      beforeChange()
      removeItems(ids)
      onChange()
    },
    select: setSelection,
    selected: () => [...selection],
    camera: () => camera,
    setCamera,
    zoomBy,
    fit,
    center: () => toWorld(camera, { x: area.clientWidth / 2, y: area.clientHeight / 2 }),
    worldPoint: (point) => toWorld(camera, { x: point.x - area.getBoundingClientRect().left, y: point.y - area.getBoundingClientRect().top }),
    elementsInReadingOrder,
    elementOf: (id) => elements.get(id) || null,
    printOnly,
    setTool,
    tool: () => tool,
    setMessage,
    itemOf
  }
}
