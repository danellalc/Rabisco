export const TYPING_GAP = 1000

export function isNewGroup(last, inputType, now, gap = TYPING_GAP) {
  return last.type !== inputType || now - last.at > gap
}

export function createHistory({ snapshot, restore, limit = 100 }) {
  const past = []
  const future = []
  let typing = { type: '', at: 0 }

  const capture = () => {
    const entry = snapshot()
    const last = past[past.length - 1]
    if (last && last.key === entry.key) return
    past.push(entry)
    if (past.length > limit) past.shift()
    future.length = 0
  }

  const apply = (entry) => {
    restore(entry)
    typing = { type: '', at: 0 }
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
      future.push(snapshot())
      apply(past.pop())
    },
    redo() {
      if (future.length === 0) return
      past.push(snapshot())
      apply(future.pop())
    }
  }
}

export function bindHistoryKeys(host, history) {
  host.layer.addEventListener('beforeinput', (event) => {
    if (event.isComposing || !host.rootOf(event.target)) return
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
    if (!modifier || event.altKey || event.target.matches('input')) return
    const key = event.key.toLowerCase()
    const isUndo = key === 'z' && !event.shiftKey
    const isRedo = key === 'y' || (key === 'z' && event.shiftKey)
    if (!isUndo && !isRedo) return
    event.preventDefault()
    if (isUndo) history.undo()
    else history.redo()
  })
}
