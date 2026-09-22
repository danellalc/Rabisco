import { svgIcon } from './dom.js'
import { FILE_ICON_PATHS } from './file-card.js'
import { extensionOf, previewable } from './items.js'

export function stepEntry(entries, id, step) {
  const index = entries.findIndex((entry) => entry.id === id)
  return index < 0 ? null : entries[index + step] || null
}

export function createPreview({ element, translate, formatBytes, mediaLink, fileBlob, siblings, download, openInTab }) {
  const name = element.querySelector('.preview-name')
  const hint = element.querySelector('.preview-hint')
  const body = element.querySelector('.preview-body')
  let current = null
  let objectUrl = ''

  const clear = () => {
    for (const media of body.querySelectorAll('video, audio')) {
      media.pause()
      media.removeAttribute('src')
    }
    body.replaceChildren()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }

  const button = (label, className, run) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = className
    item.textContent = label
    item.addEventListener('click', run)
    return item
  }

  const line = (className, text) => {
    const item = document.createElement('p')
    item.className = className
    item.textContent = text
    return item
  }

  const renderCard = (entry) => {
    const card = document.createElement('div')
    card.className = 'preview-card'
    card.append(
      svgIcon(FILE_ICON_PATHS[entry.fileKind] || FILE_ICON_PATHS.generic, 64, 'preview-icon'),
      line('preview-ext', extensionOf(entry.name).toUpperCase()),
      line('preview-title', entry.name),
      line('preview-size', formatBytes(entry.size)),
      button(translate('download'), 'primary', () => download(entry))
    )
    if (previewable(entry.fileKind)) card.append(button(translate('openInTab'), 'text-link', () => openInTab(entry)))
    body.replaceChildren(card)
  }

  const fallback = (entry) => {
    if (current === entry) renderCard(entry)
  }

  const showMedia = async (entry, tag) => {
    const media = document.createElement(tag)
    media.controls = true
    media.autoplay = true
    media.addEventListener('error', () => fallback(entry))
    body.replaceChildren(media)
    try {
      const url = await mediaLink({ file: entry.id })
      if (current === entry) media.src = url
    } catch {
      fallback(entry)
    }
  }

  const showImage = async (entry) => {
    const img = document.createElement('img')
    img.alt = entry.name
    img.addEventListener('error', () => fallback(entry))
    body.replaceChildren(img)
    if (entry.pic) {
      img.src = `/api/pic/${entry.id}/${entry.pic}`
      return
    }
    try {
      const blob = await fileBlob(entry.id)
      if (current !== entry) return
      objectUrl = URL.createObjectURL(blob)
      img.src = objectUrl
    } catch {
      fallback(entry)
    }
  }

  const render = (entry) => {
    clear()
    current = entry
    name.textContent = entry.name
    hint.hidden = siblings().length < 2
    if (entry.fileKind === 'image') showImage(entry)
    else if (entry.fileKind === 'video' || entry.fileKind === 'audio') showMedia(entry, entry.fileKind)
    else renderCard(entry)
  }

  const move = (step) => {
    const next = current ? stepEntry(siblings(), current.id, step) : null
    if (next) render(next)
  }

  element.addEventListener('click', (event) => {
    if (event.target === element || event.target === body) element.close()
  })
  element.addEventListener('close', () => {
    if (element.open) return
    clear()
    current = null
  })
  element.addEventListener('keydown', (event) => {
    if (event.target.matches('video, audio')) return
    if (event.key === 'ArrowLeft') move(-1)
    else if (event.key === 'ArrowRight') move(1)
    else return
    event.preventDefault()
  })
  element.querySelector('.preview-download').addEventListener('click', () => { if (current) download(current) })
  element.querySelector('.preview-close').addEventListener('click', () => element.close())

  return {
    open(entry) {
      render(entry)
      if (!element.open) element.showModal()
    },
    close() {
      if (element.open) element.close()
    },
    isOpen: () => element.open
  }
}
