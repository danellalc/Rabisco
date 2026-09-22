const EDGE = 8

export function svgIcon(path, size, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 32 32')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  if (className) svg.classList.add(className)
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  shape.setAttribute('d', path)
  svg.append(shape)
  return svg
}

export function createToast(element) {
  let hideTimer = 0
  let holding = false
  const queue = []

  const hide = () => {
    element.hidden = true
    holding = false
    const next = queue.shift()
    if (next) show(next.message, next.action)
  }

  const show = (message, action) => {
    element.replaceChildren(document.createTextNode(message))
    if (action) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = action.label
      button.addEventListener('click', () => {
        clearTimeout(hideTimer)
        hide()
        action.run()
      })
      element.append(button)
    }
    holding = Boolean(action)
    element.hidden = false
    clearTimeout(hideTimer)
    hideTimer = setTimeout(hide, action ? 5000 : 3000)
  }

  return (message, action) => {
    if (holding && !action) {
      queue.push({ message, action })
      return
    }
    show(message, action)
  }
}

function anchorRect(anchor) {
  if (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number' && anchor.width === undefined) {
    return { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, point: true }
  }
  return anchor
}

export function createPopover(element) {
  const close = () => {
    element.hidden = true
    element.replaceChildren()
    document.removeEventListener('pointerdown', closeIfOutside, true)
    document.removeEventListener('keydown', closeOnEscape)
  }
  const closeIfOutside = (event) => {
    if (!element.contains(event.target)) close()
  }
  const closeOnEscape = (event) => {
    if (event.key === 'Escape') close()
  }

  const entry = (action) => {
    if (action.separator) {
      const line = document.createElement('div')
      line.className = 'divider'
      return line
    }
    if (action.text !== undefined) {
      const line = document.createElement('div')
      line.className = 'menu-text'
      const label = document.createElement('span')
      label.textContent = action.label
      const value = document.createElement('span')
      value.textContent = action.text
      line.append(label, value)
      return line
    }
    if (action.swatches) {
      const row = document.createElement('div')
      row.className = 'swatches'
      for (const value of action.swatches) {
        const dot = document.createElement('button')
        dot.type = 'button'
        dot.className = `swatch ${value || 'none'}`
        dot.setAttribute('aria-label', action.labelOf(value))
        dot.setAttribute('aria-pressed', String(value === action.current))
        dot.addEventListener('click', () => {
          close()
          action.pick(value)
        })
        row.append(dot)
      }
      return row
    }
    const item = document.createElement('button')
    item.type = 'button'
    item.className = action.danger ? 'menu-item danger' : 'menu-item'
    item.textContent = action.label
    if (action.hint) {
      const hint = document.createElement('kbd')
      hint.textContent = action.hint
      item.append(hint)
    }
    item.addEventListener('click', () => {
      close()
      action.run()
    })
    return item
  }

  const open = (actions, anchor) => {
    close()
    for (const action of actions) element.append(entry(action))
    const parent = element.offsetParent || element.parentElement
    const box = parent.getBoundingClientRect()
    const rect = anchorRect(anchor)
    element.hidden = false
    const width = element.offsetWidth
    const height = element.offsetHeight
    const maxLeft = parent.clientWidth - width - EDGE
    const maxTop = parent.clientHeight - height - EDGE
    const left = rect.point ? rect.left - box.left : rect.right - box.left - width
    let top = rect.bottom - box.top + (rect.point ? 0 : 4)
    if (top > maxTop) top = rect.point ? rect.top - box.top - height : Math.max(EDGE, maxTop)
    element.style.left = `${Math.max(EDGE, Math.min(left, maxLeft))}px`
    element.style.top = `${Math.max(EDGE, top)}px`
    document.addEventListener('pointerdown', closeIfOutside, true)
    document.addEventListener('keydown', closeOnEscape)
  }

  return { open, close, isOpen: () => !element.hidden }
}

export function createChooser(element) {
  let fallback = null
  let dismissed = () => {}

  const close = () => {
    fallback = null
    dismissed = () => {}
    element.hidden = true
    element.replaceChildren()
    document.removeEventListener('pointerdown', settleIfOutside)
    document.removeEventListener('keydown', cancelOnEscape)
  }

  const settle = () => {
    if (!fallback) return
    const run = fallback
    close()
    run()
  }

  const settleIfOutside = (event) => {
    if (!element.contains(event.target)) settle()
  }

  const cancelOnEscape = (event) => {
    if (event.key !== 'Escape') return
    const onDismiss = dismissed
    close()
    onDismiss()
  }

  const open = (question, options, { focus = true, onDismiss } = {}) => {
    close()
    fallback = options[0].run
    dismissed = onDismiss || (() => {})
    const label = document.createElement('span')
    label.textContent = question
    element.append(label)
    for (const option of options) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = option.label
      button.addEventListener('click', () => {
        close()
        option.run()
      })
      element.append(button)
    }
    element.hidden = false
    if (focus && matchMedia('(hover: hover)').matches) element.querySelector('button').focus()
    document.addEventListener('pointerdown', settleIfOutside)
    document.addEventListener('keydown', cancelOnEscape)
  }

  return { open, settle, isOpen: () => !element.hidden }
}
