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
  return !(node.nodeType === Node.ELEMENT_NODE && node.querySelector('img'))
}

function endOffset(node) {
  return node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length
}

function splitBlockAfterCaret(range, block) {
  const tail = document.createRange()
  tail.setStart(range.startContainer, range.startOffset)
  tail.setEnd(block, endOffset(block))
  return tail.extractContents()
}

function emptyLine() {
  const line = document.createElement('div')
  line.append(document.createElement('br'))
  return line
}

export function insertImageBlock(root, img) {
  const range = currentRange(root)
  range.deleteContents()
  const figure = document.createElement('div')
  figure.append(img)
  const after = document.createElement('div')
  const block = blockOf(range.startContainer, root)
  if (block) {
    after.append(splitBlockAfterCaret(range, block))
    block.after(figure, after)
    if (isBlank(block)) block.remove()
  } else {
    root.insertBefore(after, root.childNodes[range.startOffset] ?? null)
    after.before(figure)
  }
  if (isBlank(after)) after.replaceChildren(document.createElement('br'))
  placeCaret(after)
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
  const line = emptyLine()
  root.append(line)
  placeCaret(line)
}

export function createInsertImage(root, { onInserted, onFailed }) {
  return (file) => {
    const img = document.createElement('img')
    img.alt = ''
    img.addEventListener('load', () => {
      if (img.naturalWidth > contentWidth(root)) img.style.width = '100%'
    }, { once: true })
    img.addEventListener('error', () => onFailed(img), { once: true })
    img.src = URL.createObjectURL(file)
    insertImageBlock(root, img)
    onInserted(img, file)
  }
}
