import { svgIcon } from './dom.js'
import { FILE_ICON_PATHS, KIND_ICONS } from './file-card.js'
import { extensionOf } from './items.js'
import { normalize, parseDate, relativeTime } from './list.js'
import { entriesOf, sortEntries } from './resources.js'

export const RESOURCE_PREFIX = 'trecos-resources:'
export const BOARD_ROW = 'board'
const GROUPS = [['folder', 'groupFolders'], ['doc', 'groupDocs'], ['file', 'groupFiles']]

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

export function initDrive({ crumbs, rows, search, translate, language, formatBytes, actions }) {
  let listing = null
  let entries = []
  let order = 'updated'
  let selected = new Set()
  let dragging = false
  let activeId = ''

  const folderId = () => (listing && listing.folder ? listing.folder.id : '')
  const entryOf = (id) => entries.find((entry) => entry.id === id)
  const selectedEntries = () => [...selected].map(entryOf).filter(Boolean)

  const crumb = (label, id, isCurrent) => {
    const element = document.createElement(isCurrent ? 'span' : 'button')
    if (!isCurrent) element.type = 'button'
    element.className = isCurrent ? 'crumb current' : 'crumb'
    element.dataset.folder = id
    element.textContent = label
    return element
  }

  const renderCrumbs = () => {
    const path = listing ? listing.path : []
    const parts = [crumb(translate('myDrive'), '', path.length === 0)]
    path.forEach((folder, index) => {
      const separator = document.createElement('span')
      separator.className = 'crumb-sep'
      separator.textContent = '/'
      parts.push(separator, crumb(folder.name || folder.title || translate('untitled'), folder.id, index === path.length - 1))
    })
    crumbs.replaceChildren(...parts)
  }

  const metaOf = (entry) => {
    if (entry.kind !== 'file') return relativeTime(parseDate(entry.updated).getTime(), Date.now(), translate, language)
    const extension = extensionOf(entry.name).toUpperCase().slice(0, 4)
    return extension ? `${extension} · ${formatBytes(entry.size)}` : formatBytes(entry.size)
  }

  const boardRow = () => {
    const element = document.createElement('div')
    element.className = 'row board-row'
    element.tabIndex = 0
    element.dataset.kind = BOARD_ROW
    element.classList.toggle('active', activeId === BOARD_ROW)
    const icon = svgIcon(KIND_ICONS.board, 20)
    icon.classList.add('row-icon')
    const name = document.createElement('span')
    name.className = 'title'
    name.textContent = translate('boardOfFolder')
    element.append(icon, name)
    return element
  }

  const groupLabel = (key, count) => {
    const label = document.createElement('p')
    label.className = 'group-label'
    const total = document.createElement('span')
    total.textContent = String(count)
    label.append(translate(key), total)
    return label
  }

  const row = (entry) => {
    const element = document.createElement('div')
    element.className = 'row'
    element.tabIndex = 0
    element.draggable = true
    element.dataset.id = entry.id
    element.dataset.kind = entry.kind
    element.classList.toggle('selected', selected.has(entry.id))
    element.classList.toggle('active', entry.id === activeId)
    const icon = svgIcon(iconPathOf(entry), 20)
    icon.classList.add('row-icon')
    const name = document.createElement('span')
    name.className = 'title'
    name.textContent = entry.name || translate('untitled')
    const meta = document.createElement('span')
    meta.className = 'time'
    meta.textContent = metaOf(entry)
    element.append(icon, name, meta)
    if (entry.pinned) element.append(svgIcon('M16 5v10l3 4H13v8h-2v-8H5l3-4V5', 14, 'pin'))
    return element
  }

  const renderRows = () => {
    const query = normalize(search.value).trim()
    const visible = sortEntries(entries, order).filter((entry) => !query || normalize(entry.name).includes(query))
    const focused = document.activeElement && document.activeElement.closest('.row') ? document.activeElement.dataset.id : ''
    const children = listing && listing.folder && !query ? [boardRow()] : []
    for (const [kind, label] of GROUPS) {
      const members = visible.filter((entry) => entry.kind === kind)
      if (members.length > 0) children.push(groupLabel(label, members.length), ...members.map(row))
    }
    rows.replaceChildren(...children)
    if (visible.length === 0) {
      const title = document.createElement('p')
      title.className = 'empty-title'
      title.textContent = translate(query ? 'noResults' : listing && listing.folder ? 'emptyFolderTitle' : 'emptyDriveTitle')
      const empty = document.createElement('p')
      empty.className = 'empty'
      empty.textContent = query ? '' : translate(listing && listing.folder ? 'emptyFolder' : 'emptyDrive')
      rows.append(title, empty)
    }
    if (focused) {
      const again = rows.querySelector(`.row[data-id="${focused}"]`)
      if (again) again.focus()
    }
  }

  const render = () => {
    renderCrumbs()
    renderRows()
  }

  const select = (ids) => {
    selected = new Set(ids.filter((id) => entryOf(id)))
    for (const element of rows.querySelectorAll('.row')) element.classList.toggle('selected', selected.has(element.dataset.id))
  }

  const anyRowAt = (target) => (target instanceof Element ? target.closest('.row') : null)
  const isBoardRow = (element) => Boolean(element) && element.dataset.kind === BOARD_ROW
  const rowAt = (target) => {
    const element = anyRowAt(target)
    return isBoardRow(element) ? null : element
  }
  const siblingRow = (element, forward) => {
    let next = forward ? element.nextElementSibling : element.previousElementSibling
    while (next && !next.classList.contains('row')) next = forward ? next.nextElementSibling : next.previousElementSibling
    return next
  }

  const startRename = (id) => {
    const element = rows.querySelector(`.row[data-id="${id}"]`)
    const entry = entryOf(id)
    if (!element || !entry) return
    const name = element.querySelector('.title')
    const input = document.createElement('input')
    input.className = 'rename'
    input.value = entry.name
    let done = false
    const finish = (commit) => {
      if (done) return
      done = true
      const next = input.value.trim()
      input.replaceWith(name)
      element.draggable = true
      if (commit && next && next !== entry.name) actions.rename(entry, next)
    }
    input.addEventListener('keydown', (event) => {
      event.stopPropagation()
      if (event.key === 'Enter') finish(true)
      if (event.key === 'Escape') finish(false)
    })
    input.addEventListener('blur', () => finish(true))
    input.addEventListener('pointerdown', (event) => event.stopPropagation())
    element.draggable = false
    name.replaceWith(input)
    input.focus()
    const dot = entry.kind === 'file' ? entry.name.lastIndexOf('.') : -1
    input.setSelectionRange(0, dot > 0 ? dot : entry.name.length)
  }

  rows.addEventListener('click', (event) => {
    if (isBoardRow(anyRowAt(event.target))) {
      actions.showBoard()
      return
    }
    const element = rowAt(event.target)
    if (!element || event.target.matches('input')) return
    const id = element.dataset.id
    if (event.shiftKey || event.ctrlKey || event.metaKey) select(selected.has(id) ? [...selected].filter((other) => other !== id) : [...selected, id])
    else select([id])
    if (matchMedia('(hover: none)').matches) actions.open(entryOf(id))
  })

  rows.addEventListener('dblclick', (event) => {
    const element = rowAt(event.target)
    if (!element || event.target.matches('input')) return
    actions.open(entryOf(element.dataset.id))
  })

  rows.addEventListener('contextmenu', (event) => {
    const element = rowAt(event.target)
    event.preventDefault()
    if (!element) {
      actions.folderMenu({ x: event.clientX, y: event.clientY })
      return
    }
    if (!selected.has(element.dataset.id)) select([element.dataset.id])
    actions.menu(selectedEntries(), { x: event.clientX, y: event.clientY })
  })

  rows.addEventListener('keydown', (event) => {
    const board = anyRowAt(event.target)
    if (isBoardRow(board) && ['Enter', ' ', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'ArrowDown') {
        const next = siblingRow(board, true)
        if (next) next.focus()
      } else actions.showBoard()
      return
    }
    const element = rowAt(event.target)
    if (!element || event.target.matches('input')) return
    const entry = entryOf(element.dataset.id)
    if (!entry) return
    const handled = ['Enter', 'F2', 'Delete', 'Backspace', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)
    if (!handled) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Enter') actions.open(entry)
    else if (event.key === 'F2') startRename(entry.id)
    else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!selected.has(entry.id)) select([entry.id])
      actions.remove(selectedEntries())
    } else if (event.key === ' ') select([entry.id])
    else {
      const sibling = siblingRow(element, event.key === 'ArrowDown')
      if (sibling) sibling.focus()
    }
  })

  rows.addEventListener('dragstart', (event) => {
    const element = rowAt(event.target)
    if (!element) return
    if (!selected.has(element.dataset.id)) select([element.dataset.id])
    dragging = true
    event.dataTransfer.setData('text/plain', resourceText(selectedEntries(), folderId()))
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
    return target instanceof Element ? target.closest('.crumb:not(.current)') : null
  }

  const dropFolderOf = (element) => (element.classList.contains('crumb') ? element.dataset.folder : element.dataset.id)

  const acceptsDrop = (event, element) => {
    if (element) return true
    return !dragging && [...event.dataTransfer.types].includes('Files')
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
    const target = element ? dropFolderOf(element) : folderId()
    const resources = transferResources(event.dataTransfer)
    if (resources) {
      const movable = resources.entries.filter((entry) => entry.id !== target)
      if (movable.length > 0) actions.move(movable, resources.folder, target)
      return
    }
    const files = [...event.dataTransfer.files]
    if (files.length > 0) actions.upload(files, target)
  }

  for (const zone of [rows, crumbs]) {
    zone.addEventListener('dragover', overHandler)
    zone.addEventListener('dragleave', (event) => { if (!zone.contains(event.relatedTarget)) clearTargets() })
    zone.addEventListener('drop', dropHandler)
  }

  crumbs.addEventListener('click', (event) => {
    const button = event.target.closest('button.crumb')
    if (button) actions.crumb(button.dataset.folder)
  })

  const renameCurrent = () => {
    const current = crumbs.querySelector('.crumb.current')
    if (!current || !listing || !listing.folder) return
    const input = document.createElement('input')
    input.className = 'rename crumb-input'
    input.value = current.textContent
    let done = false
    const finish = (commit) => {
      if (done) return
      done = true
      const next = input.value.trim()
      input.replaceWith(current)
      if (commit && next && next !== current.textContent) actions.renameCurrent(next)
    }
    input.addEventListener('keydown', (event) => {
      event.stopPropagation()
      if (event.key === 'Enter') finish(true)
      if (event.key === 'Escape') finish(false)
    })
    input.addEventListener('blur', () => finish(true))
    current.replaceWith(input)
    input.focus()
    input.select()
  }

  crumbs.addEventListener('dblclick', (event) => {
    if (event.target.closest('.crumb.current')) renameCurrent()
  })

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
      search.value = ''
      render()
    },
    remove(id) {
      entries = entries.filter((entry) => entry.id !== id)
      selected.delete(id)
      renderRows()
    },
    select,
    setActive(id) {
      activeId = id
      for (const element of rows.querySelectorAll('.row')) element.classList.toggle('active', (element.dataset.id || element.dataset.kind) === id)
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
