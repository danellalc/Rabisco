import { placeCaretAtPoint, restoreCaret, snapshotCaret } from './editor.js'
import { isUrl } from './links.js'
import { looksTabular } from './table.js'

export function isImageType(type) {
  return typeof type === 'string' && type.startsWith('image/')
}

export function imageFiles(transfer) {
  const fromItems = [...transfer.items]
    .filter((item) => item.kind === 'file' && isImageType(item.type))
    .map((item) => item.getAsFile())
    .filter(Boolean)
  if (fromItems.length > 0) return fromItems
  return [...transfer.files].filter((file) => isImageType(file.type))
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
  const text = transfer.getData('text/plain')
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
  handlers.insertText(text)
}

export function initPaste(root, handlers) {
  root.addEventListener('paste', (event) => {
    event.preventDefault()
    insertFromTransfer(root, event.clipboardData, handlers)
  })

  root.addEventListener('dragover', (event) => event.preventDefault())

  root.addEventListener('drop', (event) => {
    event.preventDefault()
    root.focus()
    placeCaretAtPoint(event.clientX, event.clientY)
    insertFromTransfer(root, event.dataTransfer, handlers)
  })
}
