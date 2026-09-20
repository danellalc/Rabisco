import { placeCaret } from './editor.js'

export const TYPING_GAP = 1000

export function isNewGroup(last, inputType, now, gap = TYPING_GAP) {
  return last.type !== inputType || now - last.at > gap
}

function caretPath(root) {
  const selection = document.getSelection()
  if (selection.rangeCount === 0 || !root.contains(selection.focusNode)) return null
  const path = []
  let node = selection.focusNode
  while (node !== root) {
    path.unshift([...node.parentNode.childNodes].indexOf(node))
    node = node.parentNode
  }
  return { path, offset: selection.focusOffset }
}

function restoreCaretPath(root, caret) {
  root.focus()
  let node = root
  for (const index of caret ? caret.path : []) {
    node = node.childNodes[index]
    if (!node) {
      placeCaret(root, root.childNodes.length)
      return
    }
  }
  if (!caret) {
    placeCaret(root, root.childNodes.length)
    return
  }
  const limit = node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length
  placeCaret(node, Math.min(caret.offset, limit))
}

function snapshot(root) {
  const copy = document.createElement('div')
  copy.append(...[...root.childNodes].map((node) => node.cloneNode(true)))
  return { copy, caret: caretPath(root) }
}

export function createHistory(root, { limit = 100, onRestore = () => {} } = {}) {
  const past = []
  const future = []
  let typing = { type: '', at: 0 }

  const restore = (entry) => {
    root.replaceChildren(...entry.copy.childNodes)
    restoreCaretPath(root, entry.caret)
    typing = { type: '', at: 0 }
    onRestore()
  }

  const capture = () => {
    const entry = snapshot(root)
    const last = past[past.length - 1]
    if (last && last.copy.isEqualNode(entry.copy)) return
    past.push(entry)
    if (past.length > limit) past.shift()
    future.length = 0
  }

  return {
    capture,
    reset() {
      past.length = 0
      future.length = 0
      typing = { type: '', at: 0 }
    },
    captureTyping(inputType) {
      const now = Date.now()
      if (isNewGroup(typing, inputType, now)) capture()
      typing = { type: inputType, at: now }
    },
    undo() {
      if (past.length === 0) return
      future.push(snapshot(root))
      restore(past.pop())
    },
    redo() {
      if (future.length === 0) return
      past.push(snapshot(root))
      restore(future.pop())
    }
  }
}

export function bindHistoryKeys(root, history) {
  root.addEventListener('beforeinput', (event) => {
    if (event.isComposing) return
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault()
      if (event.inputType === 'historyUndo') history.undo()
      else history.redo()
      return
    }
    if (event.defaultPrevented) return
    history.captureTyping(event.inputType)
  })

  document.addEventListener('keydown', (event) => {
    const modifier = event.ctrlKey || event.metaKey
    if (!modifier || event.altKey) return
    const key = event.key.toLowerCase()
    const isUndo = key === 'z' && !event.shiftKey
    const isRedo = key === 'y' || (key === 'z' && event.shiftKey)
    if (!isUndo && !isRedo) return
    event.preventDefault()
    if (isUndo) history.undo()
    else history.redo()
  })
}
