import { placeCaretAtPoint, restoreCaret, snapshotCaret } from './editor.js'
import { isUrl } from './links.js'
import { looksTabular } from './table.js'

export function isImageType(type) {
  return typeof type === 'string' && type.startsWith('image/')
}

function transferFiles(transfer) {
  const fromItems = [...transfer.items].filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean)
  return fromItems.length > 0 ? fromItems : [...transfer.files]
}

export function imageFiles(transfer) {
  return transferFiles(transfer).filter((file) => isImageType(file.type))
}

export function otherFiles(transfer) {
  return transferFiles(transfer).filter((file) => !isImageType(file.type))
}

function askTableOrOther(root, files, text, handlers) {
  const caret = snapshotCaret(root)
  const later = (action) => () => {
    restoreCaret(root, caret)
    action()
  }
  const other = files.length > 0
    ? { label: 'asImage', run: later(() => files.forEach(handlers.insertImage)) }
    : { label: 'asText', run: later(() => handlers.insertText(text)) }
  handlers.choose('pasteAs', [other, { label: 'asTable', run: later(() => handlers.insertTable(text)) }])
}

function hasTextSelection() {
  const selection = document.getSelection()
  return selection.rangeCount > 0 && !selection.isCollapsed
}

function insertFromTransfer(root, transfer, handlers) {
  const files = imageFiles(transfer)
  const others = otherFiles(transfer)
  const text = transfer.getData('text/plain')
  if (others.length > 0) {
    handlers.addFiles(others)
    if (files.length === 0) return
  }
  if (looksTabular(text)) {
    askTableOrOther(root, files, text, handlers)
    return
  }
  if (files.length === 0 && isUrl(text) && hasTextSelection()) {
    handlers.linkSelection(text)
    return
  }
  if (files.length > 0) {
    files.forEach(handlers.insertImage)
    return
  }
  if (others.length === 0) handlers.insertText(text)
}

export function initPaste({ host, area }, handlers) {
  document.addEventListener('paste', (event) => {
    if (event.target instanceof Element && event.target.matches('input')) return
    const root = host.active()
    event.preventDefault()
    if (root && root.contains(document.activeElement)) insertFromTransfer(root, event.clipboardData, handlers)
    else handlers.boardPaste(event.clipboardData, null)
  })

  area.addEventListener('dragover', (event) => event.preventDefault())

  area.addEventListener('drop', (event) => {
    event.preventDefault()
    const root = host.active()
    const hit = document.elementFromPoint(event.clientX, event.clientY)
    if (root && hit && root.contains(hit)) {
      root.focus({ preventScroll: true })
      placeCaretAtPoint(event.clientX, event.clientY)
      insertFromTransfer(root, event.dataTransfer, handlers)
      return
    }
    handlers.boardPaste(event.dataTransfer, { x: event.clientX, y: event.clientY })
  })
}
