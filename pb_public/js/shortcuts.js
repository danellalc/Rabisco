import { blockOf, insertBlock, placeCaret, wrapInlineRun } from './editor.js'

export const LINE_SHORTCUTS = {
  '#': 'heading1',
  '##': 'heading2',
  '-': 'bulletList',
  '*': 'bulletList',
  '1.': 'numberedList',
  '[]': 'checklist',
  '>': 'quote'
}

export const RULE_TRIGGER = '---'
export const CODE_TRIGGER = '```'
const NO_SHORTCUT_INSIDE = ['UL', 'OL', 'TABLE', 'PRE']

export function lineShortcut(textBeforeCaret) {
  return LINE_SHORTCUTS[textBeforeCaret] ?? null
}

export function keyShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (event.shiftKey) return key === 'x' ? 'strike' : null
  return { b: 'bold', i: 'italic', u: 'underline', e: 'code', ';': 'date' }[key] ?? null
}

function caretRange(root) {
  const selection = document.getSelection()
  if (selection.rangeCount === 0 || !selection.isCollapsed || !root.contains(selection.anchorNode)) return null
  return selection.getRangeAt(0)
}

function rangeFromBlockStart(root) {
  const caret = caretRange(root)
  if (!caret) return null
  const block = blockOf(caret.startContainer, root)
  if (!block) return null
  if (block.nodeType === Node.ELEMENT_NODE && NO_SHORTCUT_INSIDE.includes(block.tagName)) return null
  const range = document.createRange()
  range.setStart(block, 0)
  range.setEnd(caret.startContainer, caret.startOffset)
  return { range, block }
}

function emptyBlock(block) {
  const wrapped = block.nodeType === Node.ELEMENT_NODE ? block : wrapInlineRun(block)
  if (wrapped.textContent === '' && !wrapped.querySelector('br')) wrapped.append(document.createElement('br'))
  placeCaret(wrapped, 0)
  return wrapped
}

function emptyLine() {
  const line = document.createElement('div')
  line.append(document.createElement('br'))
  return line
}

function caretAtEndOf(block, caret) {
  if (caret.startContainer === block) return caret.startOffset === block.childNodes.length
  const node = caret.startContainer
  return node.nodeType === Node.TEXT_NODE && caret.startOffset === node.length && !node.nextSibling && node.parentNode === block
}

function leaveAfter(block) {
  const line = emptyLine()
  block.after(line)
  placeCaret(line, 0)
}

function innerLineOf(block, node) {
  let current = node
  while (current && current.parentNode !== block) current = current.parentNode
  return current
}

function enterInsideSpecialBlock(root, event) {
  const caret = caretRange(root)
  if (!caret) return false
  const block = blockOf(caret.startContainer, root)
  if (!block || block.nodeType !== Node.ELEMENT_NODE || !['PRE', 'BLOCKQUOTE'].includes(block.tagName)) return false
  if (block.tagName === 'PRE') {
    event.preventDefault()
    if (caret.startContainer === block) {
      const before = block.childNodes[caret.startOffset - 1]
      const rest = [...block.childNodes].slice(caret.startOffset)
      if (before && before.nodeName === 'BR' && rest.every((node) => node.nodeName === 'BR')) {
        before.remove()
        rest.forEach((node) => node.remove())
        leaveAfter(block)
        return true
      }
    }
    document.execCommand('insertText', false, '\n')
    return true
  }
  const inner = innerLineOf(block, caret.startContainer)
  const line = inner && inner.nodeType === Node.ELEMENT_NODE && inner.nodeName !== 'BR' ? inner : null
  if (line && line.textContent === '') {
    event.preventDefault()
    line.remove()
    if (block.textContent === '' && !block.querySelector('img')) block.remove()
    leaveAfter(block.isConnected ? block : root.lastElementChild || root.firstChild || root)
    return true
  }
  if (block.textContent !== '') return false
  event.preventDefault()
  const fresh = emptyLine()
  block.replaceWith(fresh)
  placeCaret(fresh, 0)
  return true
}

export function initShortcuts({ host, apply, beforeChange, insertDate }) {
  host.layer.addEventListener('beforeinput', (event) => {
    const root = host.active()
    if (!root || !root.contains(event.target)) return
    const isSpace = event.inputType === 'insertText' && event.data === ' '
    const isEnter = event.inputType === 'insertParagraph'
    if (!isSpace && !isEnter) return
    if (isEnter && enterInsideSpecialBlock(root, event)) return
    const found = rangeFromBlockStart(root)
    if (!found) return
    const text = found.range.toString()
    if (isSpace) {
      const command = lineShortcut(text)
      if (!command) return
      event.preventDefault()
      beforeChange()
      found.range.deleteContents()
      emptyBlock(found.block)
      apply(command)
      return
    }
    if (text === RULE_TRIGGER && found.block.textContent === RULE_TRIGGER) {
      event.preventDefault()
      beforeChange()
      found.range.deleteContents()
      emptyBlock(found.block)
      insertBlock(root, document.createElement('hr'))
      return
    }
    if (text === CODE_TRIGGER && found.block.textContent === CODE_TRIGGER) {
      event.preventDefault()
      beforeChange()
      found.range.deleteContents()
      emptyBlock(found.block)
      apply('codeBlock')
    }
  })

  document.addEventListener('keydown', (event) => {
    const root = host.active()
    if (!root || !root.contains(document.activeElement)) return
    const command = keyShortcut(event)
    if (!command) return
    event.preventDefault()
    if (command === 'date') {
      insertDate()
      return
    }
    beforeChange()
    apply(command)
  })
}
