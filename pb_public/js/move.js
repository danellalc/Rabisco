const MOUSE_THRESHOLD = 4
const TOUCH_THRESHOLD = 10
const LONG_PRESS = 300
const GHOST_WIDTH = 240

export function initMove({ host, area, marker, beforeChange, onMoved }) {
  let pending = null
  let drag = null

  const blockAt = (root, x, y) => {
    const hit = document.elementFromPoint(x, y)
    if (!hit || hit === root || !root.contains(hit)) return null
    let block = hit
    while (block.parentNode !== root) block = block.parentNode
    return block
  }

  const targetFor = (root, x, y) => {
    const block = blockAt(root, x, y) || root.lastElementChild
    if (!block) return null
    const box = block.getBoundingClientRect()
    return { block, before: y < box.top + box.height / 2 }
  }

  const showMarker = (target) => {
    const areaBox = area.getBoundingClientRect()
    const box = target.block.getBoundingClientRect()
    marker.style.top = `${(target.before ? box.top : box.bottom) - areaBox.top}px`
    marker.style.left = `${box.left - areaBox.left}px`
    marker.style.width = `${box.width}px`
    marker.hidden = false
  }

  const cancelPending = () => {
    if (pending) clearTimeout(pending.timer)
    pending = null
  }

  const cleanup = () => {
    drag.ghost.remove()
    marker.hidden = true
    document.body.classList.remove('dragging')
    drag = null
  }

  const start = () => {
    const { img, root, x, y } = pending
    cancelPending()
    const box = img.getBoundingClientRect()
    const scale = Math.min(1, GHOST_WIDTH / box.width)
    const ghost = img.cloneNode()
    ghost.className = 'drag-ghost'
    ghost.removeAttribute('style')
    ghost.style.width = `${box.width * scale}px`
    document.body.append(ghost)
    document.body.classList.add('dragging')
    drag = { img, root, ghost, target: null, offsetX: (x - box.left) * scale, offsetY: (y - box.top) * scale }
    update(x, y)
  }

  const update = (x, y) => {
    drag.ghost.style.left = `${x - drag.offsetX}px`
    drag.ghost.style.top = `${y - drag.offsetY}px`
    drag.target = targetFor(drag.root, x, y)
    if (drag.target) showMarker(drag.target)
    else marker.hidden = true
  }

  const finish = () => {
    const { img, target } = drag
    cleanup()
    const figure = img.parentElement
    if (!target || target.block === figure) return
    beforeChange()
    if (target.before) target.block.before(figure)
    else target.block.after(figure)
    onMoved()
  }

  host.layer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return
    const img = event.target.closest('.note img')
    const root = img ? host.rootOf(img) : null
    if (!root || root !== host.active()) return
    event.preventDefault()
    event.stopPropagation()
    pending = { img, root, x: event.clientX, y: event.clientY, timer: 0 }
    if (event.pointerType !== 'mouse') pending.timer = setTimeout(start, LONG_PRESS)
  })

  document.addEventListener('pointermove', (event) => {
    if (drag) {
      update(event.clientX, event.clientY)
      return
    }
    if (!pending) return
    const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
    if (event.pointerType === 'mouse' && distance > MOUSE_THRESHOLD) start()
    else if (event.pointerType !== 'mouse' && distance > TOUCH_THRESHOLD) cancelPending()
  })

  document.addEventListener('pointerup', () => {
    if (drag) finish()
    cancelPending()
  })

  document.addEventListener('pointercancel', () => {
    if (drag) cleanup()
    cancelPending()
  })

  document.addEventListener('touchmove', (event) => {
    if (drag) event.preventDefault()
  }, { passive: false })

  host.layer.addEventListener('contextmenu', (event) => {
    if (drag || pending) event.preventDefault()
  })
}
