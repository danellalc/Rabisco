export function createToast(element) {
  let hideTimer = 0
  return (message, action) => {
    element.replaceChildren(document.createTextNode(message))
    if (action) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = action.label
      button.addEventListener('click', () => {
        element.hidden = true
        action.run()
      })
      element.append(button)
    }
    element.hidden = false
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { element.hidden = true }, action ? 5000 : 3000)
  }
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

  return { open, settle }
}
