const GAP = 8

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function initToolbar({ host, area, bar, apply, active, beforeChange }) {
  let timer = 0
  const isPhone = () => matchMedia('(max-width:719px)').matches

  const positionOnPhone = () => {
    const viewport = window.visualViewport
    const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
    bar.style.top = `${bottom - bar.offsetHeight}px`
    bar.style.left = ''
  }

  const positionNearSelection = (range) => {
    const rect = range.getBoundingClientRect()
    const areaBox = area.getBoundingClientRect()
    const above = rect.top - areaBox.top >= bar.offsetHeight + GAP
    const top = (above ? rect.top - bar.offsetHeight - GAP : rect.bottom + GAP) - areaBox.top
    const left = clamp(rect.left + rect.width / 2 - bar.offsetWidth / 2 - areaBox.left, GAP, area.clientWidth - bar.offsetWidth - GAP)
    bar.style.top = `${top}px`
    bar.style.left = `${left}px`
  }

  const update = () => {
    const root = host.active()
    const selection = document.getSelection()
    const visible = Boolean(root) && selection.rangeCount > 0 && !selection.isCollapsed
      && root.contains(selection.anchorNode) && root.contains(selection.focusNode)
    if (!visible) {
      bar.hidden = true
      return
    }
    bar.hidden = false
    const pressed = active()
    for (const button of bar.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(pressed.has(button.dataset.cmd)))
    }
    if (isPhone()) positionOnPhone()
    else positionNearSelection(selection.getRangeAt(0))
  }

  const scheduleUpdate = () => {
    clearTimeout(timer)
    timer = setTimeout(update, 80)
  }

  document.addEventListener('selectionchange', scheduleUpdate)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => { if (!bar.hidden) update() })
    window.visualViewport.addEventListener('scroll', () => { if (!bar.hidden) update() })
  }

  bar.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') event.preventDefault()
  })
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button) return
    beforeChange()
    apply(button.dataset.cmd)
    update()
  })

  return { update }
}
