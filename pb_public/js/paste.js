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

function moveCaretToPoint(x, y) {
  const selection = document.getSelection()
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y)
    if (!position) return
    const range = document.createRange()
    range.setStart(position.offsetNode, position.offset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    return
  }
  const range = document.caretRangeFromPoint(x, y)
  if (!range) return
  selection.removeAllRanges()
  selection.addRange(range)
}

function insertFromTransfer(transfer, { insertImage, insertText }) {
  const files = imageFiles(transfer)
  if (files.length > 0) {
    files.forEach(insertImage)
    return
  }
  insertText(transfer.getData('text/plain'))
}

export function initPaste(root, handlers) {
  root.addEventListener('paste', (event) => {
    event.preventDefault()
    insertFromTransfer(event.clipboardData, handlers)
  })

  root.addEventListener('dragover', (event) => event.preventDefault())

  root.addEventListener('drop', (event) => {
    event.preventDefault()
    root.focus()
    moveCaretToPoint(event.clientX, event.clientY)
    insertFromTransfer(event.dataTransfer, handlers)
  })
}
