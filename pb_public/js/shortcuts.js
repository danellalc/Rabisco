import { blockOf, insertBlock, placeCaret, wrapInlineRun } from './editor.js'

export const LINE_SHORTCUTS = {
  '#': 'heading1',
  '##': 'heading2',
  '-': 'bulletList',
  '*': 'bulletList',
  '1.': 'numberedList',
  '[]': 'checklist'
}

export const RULE_TRIGGER = '---'
const NO_SHORTCUT_INSIDE = ['UL', 'OL', 'TABLE']

export function lineShortcut(textBeforeCaret) {
  return LINE_SHORTCUTS[textBeforeCaret] ?? null
}

export function keyShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (event.shiftKey) return key === 'x' ? 'strike' : null
  return { b: 'bold', i: 'italic', u: 'underline', ';': 'date' }[key] ?? null
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

export function initShortcuts({ host, apply, beforeChange, insertDate }) {
  host.layer.addEventListener('beforeinput', (event) => {
    const root = host.active()
    if (!root || !root.contains(event.target)) return
    const isSpace = event.inputType === 'insertText' && event.data === ' '
    const isEnter = event.inputType === 'insertParagraph'
    if (!isSpace && !isEnter) return
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
