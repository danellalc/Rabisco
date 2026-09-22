import { choices } from './settings.js'

const MENU_SETTINGS = ['theme']
const labelKey = (key, value) => key + value[0].toUpperCase() + value.slice(1)

export function initMenu({ button, menu, translate, settings, actions, onChange }) {
  const close = () => {
    menu.hidden = true
    document.removeEventListener('pointerdown', closeIfOutside)
    document.removeEventListener('keydown', closeOnEscape)
  }
  const closeIfOutside = (event) => {
    if (!menu.contains(event.target) && !button.contains(event.target)) close()
  }
  const closeOnEscape = (event) => {
    if (event.key === 'Escape') close()
  }

  const render = () => {
    menu.replaceChildren()
    for (const action of actions) {
      if (action.note) {
        const note = document.createElement('p')
        note.className = 'menu-hint'
        note.textContent = action.note()
        menu.append(note)
        continue
      }
      const item = document.createElement('button')
      item.type = 'button'
      item.className = action.danger ? 'menu-item danger' : 'menu-item'
      item.textContent = action.label()
      item.addEventListener('click', () => {
        close()
        action.run()
      })
      menu.append(item)
    }
    for (const key of settings ? MENU_SETTINGS : []) {
      const row = document.createElement('div')
      row.className = 'menu-row'
      const label = document.createElement('span')
      label.textContent = translate(key)
      row.append(label)
      for (const value of choices[key]) {
        const option = document.createElement('button')
        option.type = 'button'
        option.textContent = translate(labelKey(key, value))
        option.setAttribute('aria-pressed', String(settings[key] === value))
        option.addEventListener('click', () => {
          settings[key] = value
          onChange(settings)
          render()
        })
        row.append(option)
      }
      menu.append(row)
    }
  }

  button.addEventListener('click', () => {
    if (!menu.hidden) {
      close()
      return
    }
    render()
    menu.hidden = false
    document.addEventListener('pointerdown', closeIfOutside)
    document.addEventListener('keydown', closeOnEscape)
  })
}
