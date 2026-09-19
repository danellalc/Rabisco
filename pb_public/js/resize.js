import { contentWidth, placeCaretAfter, removeImageBlock, shiftImageBlock } from './editor.js'

export const MIN_WIDTH = 60

export function clampWidth(width, min, max) {
  return Math.min(max, Math.max(min, width))
}

export function toPercent(width, total) {
  return Math.round((width / total) * 1000) / 10
}

export function initResize({ note, area, selection, handle, beforeChange }) {
  let selected = null
  let expectedCaret = null
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

  const clear = () => {
    selected = null
    expectedCaret = null
    selection.hidden = true
  }

  const select = (img) => {
    selected = img
    selection.hidden = false
    reposition()
    note.focus({ preventScroll: true })
    expectedCaret = placeCaretAfter(note, img.parentElement)
  }

  const caretStillExpected = () => {
    const current = document.getSelection()
    return current.rangeCount > 0 && current.isCollapsed
      && current.anchorNode === expectedCaret.node && current.anchorOffset === expectedCaret.offset
  }

  note.addEventListener('click', (event) => {
    const img = event.target.closest('img')
    if (img) select(img)
    else clear()
  })

  note.addEventListener('dblclick', (event) => {
    const img = event.target.closest('img')
    if (!img) return
    beforeChange()
    img.style.removeProperty('width')
    reposition()
  })

  document.addEventListener('selectionchange', () => {
    if (selected && !caretStillExpected()) clear()
  })

  note.addEventListener('focusout', clear)

  document.addEventListener('keydown', (event) => {
    if (!selected || !note.contains(document.activeElement)) return
    if (event.key === 'Escape') {
      clear()
      return
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      beforeChange()
      shiftImageBlock(note, selected, event.key === 'ArrowUp' ? -1 : 1)
      select(selected)
      return
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    event.preventDefault()
    const img = selected
    clear()
    beforeChange()
    removeImageBlock(note, img)
  })

  handle.addEventListener('pointerdown', (event) => {
    if (!selected) return
    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    beforeChange()
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

  area.addEventListener('scroll', reposition)
  window.addEventListener('resize', reposition)

  return { clear }
}
