const INLINE_TAGS = new Set(['B', 'I', 'U', 'S', 'A', 'SPAN', 'MARK', 'BR'])

export function contentWidth(element) {
  const style = getComputedStyle(element)
  return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
}

export function insertText(text) {
  document.execCommand('insertText', false, text)
}

export function placeCaret(node, offset = 0) {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = document.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

export function placeCaretAtEnd(root) {
  root.focus()
  placeCaret(root, root.childNodes.length)
}

export function placeCaretAtPoint(x, y) {
  const selection = document.getSelection()
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y)
    if (!position) return
    placeCaret(position.offsetNode, position.offset)
    return
  }
  const range = document.caretRangeFromPoint(x, y)
  if (!range) return
  selection.removeAllRanges()
  selection.addRange(range)
}

export function currentRange(root) {
  const selection = document.getSelection()
  if (selection.rangeCount > 0 && root.contains(selection.anchorNode)) return selection.getRangeAt(0)
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  return range
}

export function blockOf(node, root) {
  let current = node
  while (current && current !== root && current.parentNode !== root) current = current.parentNode
  return current === root ? null : current
}

export function isBlank(node) {
  if (node.textContent !== '') return false
  return !(node.nodeType === Node.ELEMENT_NODE && node.querySelector('img,table'))
}

export function clearIfBlank(root) {
  if (root.childNodes.length > 0 && isBlank(root)) root.replaceChildren()
}

function isInline(node) {
  return node.nodeType !== Node.ELEMENT_NODE || INLINE_TAGS.has(node.tagName)
}

function endOffset(node) {
  return node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length
}

function emptyLine() {
  const line = document.createElement('div')
  line.append(document.createElement('br'))
  return line
}

function wrapInlineRun(node) {
  let first = node
  while (first.previousSibling && isInline(first.previousSibling)) first = first.previousSibling
  let last = node
  while (last.nextSibling && isInline(last.nextSibling)) last = last.nextSibling
  const run = []
  for (let current = first; current; current = current === last ? null : current.nextSibling) run.push(current)
  const wrapper = document.createElement('div')
  first.before(wrapper)
  wrapper.append(...run)
  return wrapper
}

function splitBlockAfterCaret(start, block) {
  const tail = document.createRange()
  tail.setStart(start.node, start.offset)
  tail.setEnd(block, endOffset(block))
  return tail.extractContents()
}

export function snapshotCaret(root) {
  return currentRange(root).cloneRange()
}

export function restoreCaret(root, range) {
  root.focus()
  const selection = document.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

export function placeCaretAfter(root, block) {
  let next = block.nextSibling
  if (!next) {
    next = emptyLine()
    root.append(next)
  }
  placeCaret(next, 0)
  return { node: next, offset: 0 }
}

export function insertBlock(root, block) {
  const range = currentRange(root)
  range.deleteContents()
  const start = { node: range.startContainer, offset: range.startOffset }
  const after = document.createElement('div')
  let current = blockOf(start.node, root)
  if (current && isInline(current)) current = wrapInlineRun(current)
  if (!current) {
    root.insertBefore(after, root.childNodes[start.offset] ?? null)
    after.before(block)
  } else if (current.tagName === 'TABLE') {
    current.after(block, after)
  } else {
    after.append(splitBlockAfterCaret(start, current))
    current.after(block, after)
    if (isBlank(current)) current.remove()
  }
  if (isBlank(after)) after.replaceChildren(document.createElement('br'))
  placeCaret(after)
}

export function insertImageBlock(root, img) {
  const figure = document.createElement('div')
  figure.append(img)
  insertBlock(root, figure)
}

export function removeImageBlock(root, img) {
  if (!img.isConnected) return
  const block = img.parentElement
  const next = block === root ? img.nextSibling : block.nextSibling
  img.remove()
  if (block !== root && !isBlank(block)) {
    placeCaret(block)
    return
  }
  if (block !== root) block.remove()
  if (next && next.parentNode === root) {
    placeCaret(next)
    return
  }
  if (isBlank(root)) {
    root.replaceChildren()
    placeCaret(root)
    return
  }
  const line = emptyLine()
  root.append(line)
  placeCaret(line)
}

export function moveImageBlock(root, img) {
  const range = currentRange(root)
  const block = img.parentElement
  if (block !== root && block.contains(range.startContainer)) return
  img.remove()
  if (block !== root && isBlank(block)) block.remove()
  insertImageBlock(root, img)
}

export function shiftImageBlock(root, img, direction) {
  const block = img.parentElement
  if (block === root) return
  const sibling = direction < 0 ? block.previousElementSibling : block.nextElementSibling
  if (!sibling) return
  if (direction < 0) sibling.before(block)
  else sibling.after(block)
  block.scrollIntoView({ block: 'nearest' })
}

export function createInsertImage(root, { onInserted, onFailed }) {
  return (file) => {
    const img = document.createElement('img')
    img.alt = ''
    img.draggable = false
    img.decoding = 'async'
    img.addEventListener('load', () => {
      img.width = img.naturalWidth
      img.height = img.naturalHeight
      if (img.naturalWidth > contentWidth(root)) img.style.width = '100%'
    }, { once: true })
    img.addEventListener('error', () => onFailed(img), { once: true })
    img.src = URL.createObjectURL(file)
    insertImageBlock(root, img)
    onInserted(img, file)
  }
}
