import { blockOf, insertBlock } from './editor.js'

export const LINE_SHORTCUTS = {
  '#': 'heading1',
  '##': 'heading2',
  '-': 'bulletList',
  '*': 'bulletList',
  '1.': 'numberedList',
  '[]': 'checklist'
}

export const RULE_TRIGGER = '---'

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
  const range = document.createRange()
  range.setStart(block, 0)
  range.setEnd(caret.startContainer, caret.startOffset)
  return { range, block }
}

export function initShortcuts({ note, apply, beforeChange, insertDate }) {
  note.addEventListener('beforeinput', (event) => {
    const isSpace = event.inputType === 'insertText' && event.data === ' '
    const isEnter = event.inputType === 'insertParagraph'
    if (!isSpace && !isEnter) return
    const found = rangeFromBlockStart(note)
    if (!found) return
    const text = found.range.toString()
    if (isSpace) {
      const command = lineShortcut(text)
      if (!command) return
      event.preventDefault()
      beforeChange()
      found.range.deleteContents()
      apply(command)
      return
    }
    if (text === RULE_TRIGGER && found.block.textContent === RULE_TRIGGER) {
      event.preventDefault()
      beforeChange()
      found.block.textContent = ''
      insertBlock(note, document.createElement('hr'))
    }
  })

  document.addEventListener('keydown', (event) => {
    if (!note.contains(document.activeElement)) return
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
