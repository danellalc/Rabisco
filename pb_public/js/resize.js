import { contentWidth, removeImageBlock } from './editor.js'

export const MIN_WIDTH = 60

export function clampWidth(width, min, max) {
  return Math.min(max, Math.max(min, width))
}

export function toPercent(width, total) {
  return Math.round((width / total) * 1000) / 10
}

export function initResize({ note, area, selection, handle, onRemove }) {
  let selected = null
  let drag = null

  const reposition = () => {
    if (!selected) return
    const areaBox = area.getBoundingClientRect()
    const box = selected.getBoundingClientRect()
    selection.style.left = `${box.left - areaBox.left + area.scrollLeft}px`
    selection.style.top = `${box.top - areaBox.top + area.scrollTop}px`
    selection.style.width = `${box.width}px`
    selection.style.height = `${box.height}px`
  }

  const select = (img) => {
    selected = img
    selection.hidden = false
    reposition()
  }

  const clear = () => {
    selected = null
    selection.hidden = true
  }

  note.addEventListener('click', (event) => {
    const img = event.target.closest('img')
    if (img) select(img)
    else clear()
  })

  note.addEventListener('dblclick', (event) => {
    const img = event.target.closest('img')
    if (!img) return
    img.style.removeProperty('width')
    reposition()
  })

  document.addEventListener('keydown', (event) => {
    if (!selected) return
    if (event.key === 'Escape') {
      clear()
      return
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    event.preventDefault()
    const img = selected
    clear()
    removeImageBlock(note, img)
    onRemove(img)
  })

  document.addEventListener('pointerdown', (event) => {
    if (!selected || note.contains(event.target) || handle.contains(event.target)) return
    clear()
  })

  handle.addEventListener('pointerdown', (event) => {
    if (!selected) return
    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    drag = { startX: event.clientX, startWidth: selected.getBoundingClientRect().width, max: contentWidth(note) }
  })

  handle.addEventListener('pointermove', (event) => {
    if (!drag) return
    const width = clampWidth(drag.startWidth + event.clientX - drag.startX, MIN_WIDTH, drag.max)
    selected.style.width = `${toPercent(width, drag.max)}%`
    reposition()
  })

  const endDrag = () => { drag = null }
  handle.addEventListener('pointerup', endDrag)
  handle.addEventListener('pointercancel', endDrag)

  note.addEventListener('input', () => {
    if (selected && !note.contains(selected)) clear()
    else reposition()
  })
  area.addEventListener('scroll', reposition)
  window.addEventListener('resize', reposition)
}
