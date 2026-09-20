const URL_PATTERN = /^(https?:\/\/|www\.)[^\s<>"']+$/i
const SAFE_PROTOCOLS = ['http:', 'https:']

export function isUrl(text) {
  return typeof text === 'string' && URL_PATTERN.test(text.trim())
}

export function toHref(text) {
  const trimmed = text.trim()
  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed
  try {
    return SAFE_PROTOCOLS.includes(new URL(candidate).protocol) ? candidate : null
  } catch {
    return null
  }
}

export function lastWord(text) {
  const words = text.split(/\s+/)
  return words[words.length - 1] || ''
}

function secureLink(anchor, href) {
  const safe = toHref(href || '')
  if (!safe) {
    anchor.replaceWith(...anchor.childNodes)
    return
  }
  anchor.href = safe
  anchor.rel = 'noopener noreferrer'
  anchor.target = '_blank'
}

export function linkSelection(root, url) {
  const href = toHref(url)
  if (!href) return
  document.execCommand('createLink', false, href)
  for (const anchor of root.querySelectorAll('a:not([rel])')) secureLink(anchor, anchor.getAttribute('href'))
}

function linkWordBeforeCaret(word) {
  const selection = document.getSelection()
  const caret = selection.getRangeAt(0)
  const node = caret.startContainer
  if (node.nodeType !== Node.TEXT_NODE || caret.startOffset < word.length) return false
  const range = document.createRange()
  range.setStart(node, caret.startOffset - word.length)
  range.setEnd(node, caret.startOffset)
  if (range.toString() !== word) return false
  const anchor = document.createElement('a')
  secureLink(anchor, word)
  if (!anchor.href) return false
  range.surroundContents(anchor)
  const after = document.createRange()
  after.setStartAfter(anchor)
  after.collapse(true)
  selection.removeAllRanges()
  selection.addRange(after)
  return true
}

export function initLinks({ host, beforeChange }) {
  host.layer.addEventListener('beforeinput', (event) => {
    const root = host.active()
    if (!root || !root.contains(event.target)) return
    const isSpace = event.inputType === 'insertText' && event.data === ' '
    if (!isSpace && event.inputType !== 'insertParagraph') return
    const selection = document.getSelection()
    if (selection.rangeCount === 0 || !selection.isCollapsed || !root.contains(selection.anchorNode)) return
    const caret = selection.getRangeAt(0)
    const node = caret.startContainer
    if (node.nodeType !== Node.TEXT_NODE || node.parentElement.closest('a')) return
    const word = lastWord(node.data.slice(0, caret.startOffset))
    if (!isUrl(word)) return
    event.preventDefault()
    beforeChange()
    if (!linkWordBeforeCaret(word)) return
    if (!isSpace) {
      document.execCommand('insertParagraph')
      return
    }
    const space = document.createTextNode(' ')
    selection.getRangeAt(0).insertNode(space)
    const afterSpace = document.createRange()
    afterSpace.setStart(space, 1)
    afterSpace.collapse(true)
    selection.removeAllRanges()
    selection.addRange(afterSpace)
  })

  host.layer.addEventListener('click', (event) => {
    const anchor = event.target.closest('.note a')
    if (!anchor) return
    const touch = matchMedia('(hover: none)').matches
    if (host.editable() && !event.ctrlKey && !event.metaKey && !touch) return
    event.preventDefault()
    window.open(anchor.href, '_blank', 'noopener')
  })
}
