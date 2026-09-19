import { moveImageBlock, placeCaretAtPoint } from './editor.js'

export function initMove(note) {
  let dragging = null

  note.addEventListener('dragstart', (event) => {
    if (!(event.target instanceof Element)) return
    const img = event.target.closest('img')
    if (!img) return
    dragging = img
    event.dataTransfer.effectAllowed = 'move'
  })

  note.addEventListener('dragend', () => {
    dragging = null
  })

  return (x, y) => {
    if (!dragging) return false
    const img = dragging
    dragging = null
    placeCaretAtPoint(x, y)
    moveImageBlock(note, img)
    return true
  }
}
