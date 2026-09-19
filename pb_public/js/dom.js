export function createToast(element) {
  let hideTimer = 0
  return (message) => {
    element.textContent = message
    element.hidden = false
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { element.hidden = true }, 3000)
  }
}

export function createChooser(element) {
  let fallback = null

  const close = () => {
    fallback = null
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
    if (event.key === 'Escape') close()
  }

  const open = (question, options) => {
    close()
    fallback = options[0].run
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
    if (matchMedia('(hover: hover)').matches) element.querySelector('button').focus()
    document.addEventListener('pointerdown', settleIfOutside)
    document.addEventListener('keydown', cancelOnEscape)
  }

  return { open, settle }
}
