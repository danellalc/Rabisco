import { iconPathOf } from './drive.js'
import { svgIcon } from './dom.js'
import { parseDate, relativeTime } from './list.js'
import { groupByDay } from './recent.js'

export function initPanel({ elements, translate, language }) {
  const { title, sub, actions, rows } = elements
  let handlers = {}

  const timeOf = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' })

  const groupLabel = (text) => {
    const label = document.createElement('p')
    label.className = 'group-label'
    label.textContent = text
    return label
  }

  const emptyLine = (text) => {
    const line = document.createElement('p')
    line.className = 'empty'
    line.textContent = text
    return line
  }

  const row = (entry, place, when) => {
    const element = document.createElement('div')
    element.className = 'row row-tall'
    element.tabIndex = 0
    element.dataset.id = entry.id
    element.dataset.kind = entry.kind
    const text = document.createElement('span')
    text.className = 'row-text'
    const name = document.createElement('span')
    name.className = 'title'
    name.textContent = entry.name || translate('untitled')
    const origin = document.createElement('span')
    origin.className = 'row-origin'
    origin.textContent = place
    text.append(name, origin)
    const time = document.createElement('span')
    time.className = 'row-meta'
    time.textContent = when
    element.append(svgIcon(iconPathOf(entry), 20, 'row-icon'), text, time)
    return element
  }

  const setHead = (heading, subtitle, buttons) => {
    title.textContent = heading
    sub.textContent = subtitle
    actions.replaceChildren(...buttons.map((button) => {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = button.danger ? 'text-link danger' : 'text-link'
      element.textContent = button.label
      element.addEventListener('click', button.run)
      return element
    }))
  }

  const entryAt = (target) => {
    const element = target instanceof Element ? target.closest('.row') : null
    return element ? handlers.entryOf(element.dataset.kind, element.dataset.id) : null
  }

  rows.addEventListener('click', (event) => {
    const entry = entryAt(event.target)
    if (entry) handlers.open(entry, { x: event.clientX, y: event.clientY })
  })
  rows.addEventListener('contextmenu', (event) => {
    const entry = entryAt(event.target)
    if (!entry || !handlers.menu) return
    event.preventDefault()
    handlers.menu(entry, { x: event.clientX, y: event.clientY })
  })
  rows.addEventListener('keydown', (event) => {
    const entry = entryAt(event.target)
    if (!entry) return
    if (event.key === 'Enter') handlers.open(entry, event.target.getBoundingClientRect())
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const next = event.key === 'ArrowDown' ? event.target.nextElementSibling : event.target.previousElementSibling
      const target = next && next.classList.contains('row') ? next : next ? (event.key === 'ArrowDown' ? next.nextElementSibling : next.previousElementSibling) : null
      if (target && target.classList.contains('row')) target.focus()
    } else return
    event.preventDefault()
    event.stopPropagation()
  })

  return {
    showRecent(entries, next) {
      handlers = next
      setHead(translate('recent'), translate('recentSub'), [])
      const groups = groupByDay(entries, Date.now(), translate, language)
      rows.replaceChildren(...(groups.length === 0 ? [emptyLine(translate('recentEmpty'))] : groups.flatMap((group) => [groupLabel(group.label), ...group.entries.map((entry) => row(entry, entry.folderName || translate('myDrive'), timeOf.format(entry.at)))])))
    },
    showTrash(listing, next) {
      handlers = next
      const buttons = listing.entries.length > 0 ? [{ label: translate('emptyTrash'), danger: true, run: next.empty }] : []
      setHead(translate('trash'), translate('trashSub').replace('{days}', String(listing.keepDays)), buttons)
      rows.replaceChildren(...(listing.entries.length === 0 ? [emptyLine(translate('trashEmptyText'))] : listing.entries.map((entry) => row(entry, entry.homeName || translate('myDrive'), relativeTime(parseDate(entry.trashed).getTime(), Date.now(), translate, language)))))
    }
  }
}
