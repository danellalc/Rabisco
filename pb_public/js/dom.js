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
  const close = () => {
    element.hidden = true
    element.replaceChildren()
    document.removeEventListener('pointerdown', closeIfOutside)
    document.removeEventListener('keydown', closeOnEscape)
  }
  const closeIfOutside = (event) => {
    if (!element.contains(event.target)) close()
  }
  const closeOnEscape = (event) => {
    if (event.key === 'Escape') close()
  }
  return (question, options) => {
    close()
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
    element.querySelector('button').focus()
    document.addEventListener('pointerdown', closeIfOutside)
    document.addEventListener('keydown', closeOnEscape)
  }
}
