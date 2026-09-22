import { svgIcon } from './dom.js'
import { FILE_ICON_PATHS, KIND_ICONS } from './file-card.js'
import { extensionOf, formatSize } from './items.js'
import { parseDate, relativeTime } from './list.js'

export function sharedEntries(shared) {
  const docs = (shared.docs || []).map((doc) => ({ kind: 'doc', id: doc.id, name: doc.name, updated: doc.updated }))
  const files = (shared.files || []).map((file) => ({ kind: 'file', id: file.id, name: file.name, size: file.size, fileKind: file.kind, pic: file.pic }))
  return [...docs, ...files]
}

export function createSharedList({ button, panel, translate, language, onOpen }) {
  let entries = []

  const close = () => {
    panel.hidden = true
    document.removeEventListener('pointerdown', closeIfOutside, true)
  }

  const closeIfOutside = (event) => {
    if (!panel.contains(event.target) && !button.contains(event.target)) close()
  }

  const thumbnail = (entry) => {
    const image = document.createElement('img')
    image.className = 'row-thumb'
    image.loading = 'lazy'
    image.decoding = 'async'
    image.alt = ''
    image.src = `/api/pic/${entry.id}/${entry.pic}`
    return image
  }

  const metaOf = (entry) => {
    if (entry.kind === 'doc') return relativeTime(parseDate(entry.updated).getTime(), Date.now(), translate, language)
    const extension = extensionOf(entry.name).toUpperCase().slice(0, 4)
    const size = formatSize(entry.size, language)
    return extension ? `${extension} · ${size}` : size
  }

  const row = (entry) => {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'row'
    element.dataset.id = entry.id
    element.dataset.kind = entry.kind
    const lead = entry.kind === 'file' && entry.fileKind === 'image' && entry.pic ? thumbnail(entry) : svgIcon(entry.kind === 'doc' ? KIND_ICONS.doc : FILE_ICON_PATHS[entry.fileKind] || FILE_ICON_PATHS.generic, 20, 'row-icon')
    const name = document.createElement('span')
    name.className = 'title'
    name.textContent = entry.name || translate('untitled')
    const meta = document.createElement('span')
    meta.className = 'row-meta'
    meta.textContent = metaOf(entry)
    element.append(lead, name, meta)
    element.addEventListener('click', () => {
      close()
      onOpen(entry)
    })
    return element
  }

  button.addEventListener('click', () => {
    if (!panel.hidden) {
      close()
      return
    }
    panel.replaceChildren(...entries.map(row))
    panel.hidden = false
    document.addEventListener('pointerdown', closeIfOutside, true)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
  })

  return {
    set(shared) {
      entries = sharedEntries(shared)
      button.textContent = translate('sharedContents').replace('{n}', String(entries.length))
      button.hidden = entries.length === 0
      close()
    }
  }
}
