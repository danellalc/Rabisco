import { contentWidth, placeCaretAfter, removeImageBlock, shiftImageBlock } from './editor.js'
import { clearImageWidth, setImageWidth } from './widths.js'

export const MIN_WIDTH = 60

export function clampWidth(width, min, max) {
  return Math.min(max, Math.max(min, width))
}

export function toPercent(width, total) {
  return Math.round((width / total) * 1000) / 10
}

export function initResize({ host, area, selection, handle, beforeChange, afterChange, onOpen, onCopy, onDownload }) {
  let selected = null
  let expectedCaret = null
  let drag = null

  const root = () => (selected ? host.rootOf(selected) : null)

  const reposition = () => {
    if (!selected) return
    const areaBox = area.getBoundingClientRect()
    const box = selected.getBoundingClientRect()
    selection.style.left = `${box.left - areaBox.left}px`
    selection.style.top = `${box.top - areaBox.top}px`
    selection.style.width = `${box.width}px`
    selection.style.height = `${box.height}px`
  }

  const clear = () => {
    selected = null
    expectedCaret = null
    selection.hidden = true
  }

  const select = (img) => {
    const owner = host.rootOf(img)
    if (owner !== host.active()) {
      if (!host.editable()) onOpen(img)
      return
    }
    selected = img
    selection.hidden = false
    reposition()
    owner.focus({ preventScroll: true })
    expectedCaret = placeCaretAfter(owner, img.parentElement)
  }

  const resetWidth = () => {
    beforeChange()
    clearImageWidth(selected)
    reposition()
  }

  const caretStillExpected = () => {
    const current = document.getSelection()
    return current.rangeCount > 0 && current.isCollapsed
      && current.anchorNode === expectedCaret.node && current.anchorOffset === expectedCaret.offset
  }

  host.layer.addEventListener('click', (event) => {
    const img = event.target.closest('.note img')
    if (img) select(img)
    else clear()
  })

  host.layer.addEventListener('dblclick', (event) => {
    const img = event.target.closest('.note img')
    if (img && host.rootOf(img) === host.active()) onOpen(img)
  })

  handle.addEventListener('dblclick', () => {
    if (selected) resetWidth()
  })

  document.addEventListener('selectionchange', () => {
    if (selected && expectedCaret && !caretStillExpected()) clear()
  })

  host.layer.addEventListener('focusout', (event) => {
    if (selected && host.rootOf(event.target) === root()) clear()
  })

  document.addEventListener('keydown', (event) => {
    const owner = root()
    if (!selected || !owner || !owner.contains(document.activeElement)) return
    const modifier = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (event.key === 'Escape') {
      clear()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(selected)
      return
    }
    if (modifier && key === 'c') {
      event.preventDefault()
      onCopy(selected)
      return
    }
    if (modifier && key === 's') {
      event.preventDefault()
      onDownload(selected)
      return
    }
    if (event.altKey && key === '0') {
      event.preventDefault()
      resetWidth()
      return
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      beforeChange()
      shiftImageBlock(owner, selected, event.key === 'ArrowUp' ? -1 : 1)
      select(selected)
      return
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    event.preventDefault()
    const img = selected
    clear()
    beforeChange()
    removeImageBlock(owner, img)
  })

  handle.addEventListener('pointerdown', (event) => {
    const owner = root()
    if (!selected || !owner) return
    event.preventDefault()
    event.stopPropagation()
    handle.setPointerCapture(event.pointerId)
    beforeChange()
    drag = { startX: event.clientX, startWidth: selected.getBoundingClientRect().width, max: contentWidth(owner), scale: selected.getBoundingClientRect().width / selected.offsetWidth }
  })

  handle.addEventListener('pointermove', (event) => {
    if (!drag) return
    const width = clampWidth((drag.startWidth + event.clientX - drag.startX) / drag.scale, MIN_WIDTH, drag.max)
    setImageWidth(selected, toPercent(width, drag.max))
    reposition()
  })

  const endDrag = () => {
    if (drag) afterChange()
    drag = null
  }
  handle.addEventListener('pointerup', endDrag)
  handle.addEventListener('pointercancel', endDrag)

  window.addEventListener('resize', reposition)

  return { clear, reposition }
}
