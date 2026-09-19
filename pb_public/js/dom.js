export function createToast(element) {
  let hideTimer = 0
  return (message) => {
    element.textContent = message
    element.hidden = false
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { element.hidden = true }, 3000)
  }
}
