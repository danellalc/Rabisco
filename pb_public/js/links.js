const URL_PATTERN = /^(https?:\/\/|www\.)[^\s<>"']+$/i

export function isUrl(text) {
  return typeof text === 'string' && URL_PATTERN.test(text.trim())
}

export function toHref(text) {
  const trimmed = text.trim()
  return /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed
}

export function lastWord(text) {
  const words = text.split(/\s+/)
  return words[words.length - 1] || ''
}

function secureLink(anchor, href) {
  anchor.href = href
  anchor.rel = 'noopener noreferrer'
  anchor.target = '_blank'
}

export function linkSelection(root, url) {
  document.execCommand('createLink', false, toHref(url))
  for (const anchor of root.querySelectorAll('a:not([rel])')) secureLink(anchor, anchor.getAttribute('href'))
}

function linkWordBeforeCaret(word) {
  const selection = document.getSelection()
  const caret = selection.getRangeAt(0)
  const node = caret.startContainer
  if (node.nodeType !== Node.TEXT_NODE || caret.startOffset < word.length) return
  const range = document.createRange()
  range.setStart(node, caret.startOffset - word.length)
  range.setEnd(node, caret.startOffset)
  if (range.toString() !== word) return
  const anchor = document.createElement('a')
  secureLink(anchor, toHref(word))
  range.surroundContents(anchor)
  const after = document.createRange()
  after.setStartAfter(anchor)
  after.collapse(true)
  selection.removeAllRanges()
  selection.addRange(after)
}

export function initLinks({ note, beforeChange }) {
  note.addEventListener('beforeinput', (event) => {
    const isSpace = event.inputType === 'insertText' && event.data === ' '
    if (!isSpace && event.inputType !== 'insertParagraph') return
    const selection = document.getSelection()
    if (selection.rangeCount === 0 || !selection.isCollapsed || !note.contains(selection.anchorNode)) return
    const caret = selection.getRangeAt(0)
    const node = caret.startContainer
    if (node.nodeType !== Node.TEXT_NODE || node.parentElement.closest('a')) return
    const word = lastWord(node.data.slice(0, caret.startOffset))
    if (!isUrl(word)) return
    beforeChange()
    linkWordBeforeCaret(word)
  })

  note.addEventListener('click', (event) => {
    const anchor = event.target.closest('a')
    if (!anchor) return
    const touch = matchMedia('(hover: none)').matches
    if (!event.ctrlKey && !event.metaKey && !touch) return
    event.preventDefault()
    window.open(anchor.href, '_blank', 'noopener')
  })
}
