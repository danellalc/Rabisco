import { svgIcon } from './dom.js'
import { FILE_ICON_PATHS, KIND_ICONS } from './file-card.js'
import { countOf } from './i18n.js'
import { normalize, parseDate, relativeTime } from './list.js'
import { entriesOf, sortEntries } from './resources.js'

export const RESOURCE_PREFIX = 'trecos-resources:'
const CHECK = 'M4 8.2l2.6 2.6L12 5.6'
const COUNTS = [['folder', 'folders'], ['doc', 'docs'], ['file', 'files']]

export function resourceText(entries, folder) {
  return `${RESOURCE_PREFIX}${JSON.stringify({ folder, entries: entries.map((entry) => ({ kind: entry.kind, id: entry.id, name: entry.name })) })}`
}

export function parseResources(text) {
  if (typeof text !== 'string' || !text.startsWith(RESOURCE_PREFIX)) return null
  try {
    const parsed = JSON.parse(text.slice(RESOURCE_PREFIX.length))
    return parsed && Array.isArray(parsed.entries) ? { folder: String(parsed.folder || ''), entries: parsed.entries.filter((entry) => entry && typeof entry.id === 'string' && ['folder', 'doc', 'file'].includes(entry.kind)) } : null
  } catch {
    return null
  }
}

export function transferResources(transfer) {
  return parseResources(transfer.getData('text/plain'))
}

export function iconPathOf(entry) {
  if (entry.kind === 'folder') return KIND_ICONS.folder
  if (entry.kind === 'doc') return KIND_ICONS.doc
  return FILE_ICON_PATHS[entry.fileKind] || FILE_ICON_PATHS.generic
}

export function folderMeta(entries, translate, formatBytes) {
  const parts = COUNTS.map(([kind, key]) => [entries.filter((entry) => entry.kind === kind).length, key]).filter(([count]) => count > 0).map(([count, key]) => countOf(translate, key, count))
  if (parts.length === 0) return translate('emptyMeta')
  const bytes = entries.filter((entry) => entry.kind === 'file').reduce((total, entry) => total + (entry.size || 0), 0)
  if (bytes > 0) parts.push(formatBytes(bytes))
  return parts.join(' · ')
}

export function rangeBetween(ids, from, to) {
  const start = ids.indexOf(from)
  const end = ids.indexOf(to)
  if (start < 0 || end < 0) return [to]
  return ids.slice(Math.min(start, end), Math.max(start, end) + 1)
}

const checkIcon = () => {
  const svg = svgIcon(CHECK, 16, 'check-mark')
  svg.setAttribute('viewBox', '0 0 16 16')
  return svg
}

export function initDrive({ elements, translate, language, formatBytes, actions }) {
  const { up, crumbs, title, meta, selectBar, selectCount, selectClear, rows, search } = elements
  let listing = null
  let entries = []
  let order = 'updated'
  let selected = new Set()
  let linked = new Set()
  let anchor = ''
  let dragging = false

  const folderId = () => (listing && listing.folder ? listing.folder.id : '')
  const entryOf = (id) => entries.find((entry) => entry.id === id)
  const selectedEntries = () => [...selected].map(entryOf).filter(Boolean)
  const visibleIds = () => [...rows.querySelectorAll('.row')].map((element) => element.dataset.id)

  const renderHead = () => {
    const path = listing ? listing.path : []
    const current = path[path.length - 1]
    const parent = path[path.length - 2]
    const atRoot = !current
    up.parentElement.hidden = atRoot
    up.dataset.folder = parent ? parent.id : ''
    crumbs.replaceChildren()
    if (!atRoot) {
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'crumb'
      link.dataset.folder = parent ? parent.id : ''
      link.textContent = parent ? parent.name || parent.title || translate('untitled') : translate('myDrive')
      const slash = document.createElement('span')
      slash.className = 'crumb-sep'
      slash.textContent = ' /'
      crumbs.append(link, slash)
    }
    title.textContent = current ? current.name || current.title || translate('untitled') : translate('myDrive')
    title.dataset.folder = current ? current.id : ''
    meta.textContent = folderMeta(entries, translate, formatBytes)
  }

  const metaOf = (entry) => {
    if (entry.kind === 'folder') return String(entry.count || 0)
    if (entry.kind === 'doc') return relativeTime(parseDate(entry.updated).getTime(), Date.now(), translate, language)
    return formatBytes(entry.size)
  }

  const row = (entry) => {
    const element = document.createElement('div')
    element.className = 'row'
    element.tabIndex = 0
    element.draggable = true
    element.dataset.id = entry.id
    element.dataset.kind = entry.kind
    element.classList.toggle('selected', selected.has(entry.id))
    element.classList.toggle('linked', linked.has(entry.id))
    const lead = document.createElement('span')
    lead.className = 'row-lead'
    const check = document.createElement('button')
    check.type = 'button'
    check.className = 'check'
    check.tabIndex = -1
    check.setAttribute('aria-label', translate('select'))
    check.setAttribute('aria-pressed', String(selected.has(entry.id)))
    check.append(checkIcon())
    lead.append(svgIcon(iconPathOf(entry), 20, 'row-icon'), check)
    const name = document.createElement('span')
    name.className = 'title'
    name.textContent = entry.name || translate('untitled')
    const detail = document.createElement('span')
    detail.className = 'row-meta'
    detail.textContent = metaOf(entry)
    element.append(lead, name)
    if (entry.pinned) element.append(svgIcon('M16 5v10l3 4H13v8h-2v-8H5l3-4V5', 14, 'pin'))
    element.append(detail)
    if (entry.kind === 'folder') {
      const arrow = document.createElement('span')
      arrow.className = 'row-arrow'
      arrow.textContent = '›'
      element.append(arrow)
    }
    return element
  }

  const emptyState = (query) => {
    const text = document.createElement('p')
    text.className = 'empty'
    if (query) {
      text.textContent = translate('noResults')
      return [text]
    }
    text.append(...translate('emptyFolderText').split('\n').map((line) => {
      const span = document.createElement('span')
      span.textContent = line
      return span
    }))
    if (!folderId()) return [text]
    const zone = document.createElement('div')
    zone.className = 'drop-zone'
    zone.textContent = translate('dropHere')
    return [text, zone]
  }

  const renderRows = () => {
    const query = normalize(search.value).trim()
    const visible = sortEntries(entries, order).filter((entry) => !query || normalize(entry.name).includes(query))
    const focused = document.activeElement && document.activeElement.closest('.row') ? document.activeElement.dataset.id : ''
    rows.replaceChildren(...(visible.length > 0 ? visible.map(row) : emptyState(query)))
    if (focused) {
      const again = rows.querySelector(`.row[data-id="${focused}"]`)
      if (again) again.focus()
    }
  }

  const renderSelection = () => {
    for (const element of rows.querySelectorAll('.row')) {
      const isSelected = selected.has(element.dataset.id)
      element.classList.toggle('selected', isSelected)
      element.querySelector('.check').setAttribute('aria-pressed', String(isSelected))
    }
    selectBar.hidden = selected.size === 0
    selectCount.textContent = translate('selectedCount').replace('{n}', String(selected.size))
    actions.selectionChanged(selectedEntries())
  }

  const render = () => {
    renderHead()
    renderRows()
    renderSelection()
  }

  const select = (ids) => {
    selected = new Set(ids.filter((id) => entryOf(id)))
    renderSelection()
  }

  const toggle = (id, withRange) => {
    if (withRange && anchor) select([...new Set([...selected, ...rangeBetween(visibleIds(), anchor, id)])])
    else if (selected.has(id)) select([...selected].filter((other) => other !== id))
    else select([...selected, id])
    if (!withRange) anchor = id
  }

  const rowAt = (target) => (target instanceof Element ? target.closest('.row') : null)
  const siblingRow = (element, forward) => {
    let next = forward ? element.nextElementSibling : element.previousElementSibling
    while (next && !next.classList.contains('row')) next = forward ? next.nextElementSibling : next.previousElementSibling
    return next
  }

  const inlineRename = (target, initial, selectUntil, commit) => {
    const input = document.createElement('input')
    input.className = 'rename'
    input.value = initial
    let done = false
    const finish = (keep) => {
      if (done) return
      done = true
      const next = input.value.trim()
      input.replaceWith(target)
      if (keep && next && next !== initial) commit(next)
    }
    input.addEventListener('keydown', (event) => {
      event.stopPropagation()
      if (event.key === 'Enter') finish(true)
      if (event.key === 'Escape') finish(false)
    })
    input.addEventListener('blur', () => finish(true))
    input.addEventListener('pointerdown', (event) => event.stopPropagation())
    target.replaceWith(input)
    input.focus()
    input.setSelectionRange(0, selectUntil)
    return input
  }

  const startRename = (id) => {
    const element = rows.querySelector(`.row[data-id="${id}"]`)
    const entry = entryOf(id)
    if (!element || !entry) return
    const name = element.querySelector('.title')
    const dot = entry.kind === 'file' ? entry.name.lastIndexOf('.') : -1
    element.draggable = false
    const input = inlineRename(name, entry.name, dot > 0 ? dot : entry.name.length, (next) => actions.rename(entry, next))
    input.addEventListener('blur', () => {
      element.draggable = true
      if (element.isConnected) element.focus()
    })
  }

  const renameCurrent = () => {
    if (!listing || !listing.folder) return
    inlineRename(title, title.textContent, title.textContent.length, (next) => actions.renameCurrent(next)).classList.add('title-input')
  }

  rows.addEventListener('click', (event) => {
    const element = rowAt(event.target)
    if (!element || event.target.matches('input')) return
    const id = element.dataset.id
    if (event.target.closest('.check') || event.ctrlKey || event.metaKey || event.shiftKey) {
      toggle(id, event.shiftKey)
      return
    }
    if (selected.size > 0) select([])
    anchor = id
    actions.open(entryOf(id))
  })

  rows.addEventListener('contextmenu', (event) => {
    const element = rowAt(event.target)
    event.preventDefault()
    if (!element) {
      actions.folderMenu({ x: event.clientX, y: event.clientY })
      return
    }
    const targets = selected.has(element.dataset.id) ? selectedEntries() : [entryOf(element.dataset.id)]
    actions.menu(targets, { x: event.clientX, y: event.clientY })
  })

  rows.addEventListener('keydown', (event) => {
    const element = rowAt(event.target)
    if (!element || event.target.matches('input')) return
    const entry = entryOf(element.dataset.id)
    if (!entry) return
    const handled = ['Enter', 'F2', 'Delete', 'Backspace', ' ', 'ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)
    if (!handled) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Enter') actions.open(entry)
    else if (event.key === 'F2') startRename(entry.id)
    else if (event.key === 'Escape') select([])
    else if (event.key === 'Delete' || event.key === 'Backspace') actions.remove(selected.has(entry.id) ? selectedEntries() : [entry])
    else if (event.key === ' ') toggle(entry.id, event.shiftKey)
    else {
      const sibling = siblingRow(element, event.key === 'ArrowDown')
      if (sibling) sibling.focus()
    }
  })

  rows.addEventListener('dragstart', (event) => {
    const element = rowAt(event.target)
    if (!element) return
    const moving = selected.has(element.dataset.id) ? selectedEntries() : [entryOf(element.dataset.id)]
    dragging = true
    event.dataTransfer.setData('text/plain', resourceText(moving, folderId()))
    event.dataTransfer.effectAllowed = 'copyMove'
  })
  rows.addEventListener('dragend', () => {
    dragging = false
    clearTargets()
  })

  const clearTargets = () => {
    for (const element of document.querySelectorAll('.drop-target')) element.classList.remove('drop-target')
  }

  const targetOf = (target) => {
    const element = rowAt(target)
    if (element && element.dataset.kind === 'folder') return element
    return target instanceof Element ? target.closest('.crumb, .up') : null
  }

  const acceptsDrop = (event, element) => {
    if (element) return true
    return !dragging && folderId() !== '' && [...event.dataTransfer.types].includes('Files')
  }

  const overHandler = (event) => {
    const element = targetOf(event.target)
    if (!acceptsDrop(event, element)) return
    event.preventDefault()
    clearTargets()
    if (element) element.classList.add('drop-target')
    else rows.classList.add('drop-target')
  }

  const dropHandler = (event) => {
    const element = targetOf(event.target)
    if (!acceptsDrop(event, element)) return
    event.preventDefault()
    clearTargets()
    const target = element ? element.dataset.folder !== undefined ? element.dataset.folder : element.dataset.id : folderId()
    const resources = transferResources(event.dataTransfer)
    if (resources) {
      const movable = resources.entries.filter((entry) => entry.id !== target)
      if (movable.length > 0) actions.move(movable, resources.folder, target)
      return
    }
    const files = [...event.dataTransfer.files]
    if (files.length > 0) actions.upload(files, target)
  }

  for (const zone of [rows, up.parentElement]) {
    zone.addEventListener('dragover', overHandler)
    zone.addEventListener('dragleave', (event) => { if (!zone.contains(event.relatedTarget)) clearTargets() })
    zone.addEventListener('drop', dropHandler)
  }

  up.parentElement.addEventListener('click', (event) => {
    const button = event.target.closest('.crumb, .up')
    if (button) actions.crumb(button.dataset.folder)
  })

  title.addEventListener('dblclick', renameCurrent)
  selectClear.addEventListener('click', () => select([]))
  search.addEventListener('input', renderRows)

  return {
    set(next) {
      listing = next
      entries = entriesOf(next)
      selected = new Set([...selected].filter((id) => entries.some((entry) => entry.id === id)))
      render()
    },
    reset() {
      listing = null
      entries = []
      selected = new Set()
      linked = new Set()
      search.value = ''
      render()
    },
    remove(ids) {
      entries = entries.filter((entry) => !ids.includes(entry.id))
      selected = new Set([...selected].filter((id) => !ids.includes(id)))
      renderHead()
      renderRows()
      renderSelection()
    },
    select,
    setLinked(ids) {
      linked = new Set(ids)
      for (const element of rows.querySelectorAll('.row')) element.classList.toggle('linked', linked.has(element.dataset.id))
    },
    selected: selectedEntries,
    entry: entryOf,
    entries: () => entries,
    startRename,
    setOrder(next) {
      order = next
      renderRows()
    },
    order: () => order,
    renameCurrent,
    folderId,
    listing: () => listing,
    focusRow(id) {
      const element = rows.querySelector(`.row[data-id="${id}"]`)
      if (element) element.focus()
    }
  }
}
