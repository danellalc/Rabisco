import { svgIcon } from './dom.js'
import { KIND_ICONS } from './file-card.js'
import { labelOf } from './resources.js'

export function createFolderPicker({ element, resources, translate }) {
  let resolveWith = null
  let folder = ''
  let excluded = new Set()

  const close = (result) => {
    element.hidden = true
    element.replaceChildren()
    document.removeEventListener('keydown', onKey)
    const resolve = resolveWith
    resolveWith = null
    if (resolve) resolve(result)
  }

  const onKey = (event) => {
    if (event.key === 'Escape') close(null)
  }

  const button = (label, className, run) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = className
    item.textContent = label
    item.addEventListener('click', run)
    return item
  }

  const render = async () => {
    let listing
    try {
      listing = await resources.listing(folder)
    } catch {
      close(null)
      return
    }
    element.replaceChildren()
    const title = document.createElement('p')
    title.className = 'menu-title'
    title.textContent = translate('moveTo')
    const crumbs = document.createElement('div')
    crumbs.className = 'crumbs'
    crumbs.append(button(translate('myDrive'), 'crumb', () => { folder = ''; render() }))
    for (const ancestor of listing.path) {
      const separator = document.createElement('span')
      separator.className = 'crumb-sep'
      separator.textContent = '/'
      crumbs.append(separator, button(ancestor.name || ancestor.title || translate('untitled'), 'crumb', () => { folder = ancestor.id; render() }))
    }
    const rows = document.createElement('div')
    rows.className = 'picker-rows'
    const choices = listing.folders.filter((child) => !excluded.has(child.id))
    for (const child of choices) {
      const row = button(labelOf(child) || translate('untitled'), 'row', () => { folder = child.id; render() })
      row.prepend(svgIcon(KIND_ICONS.folder, 20, 'row-icon'))
      rows.append(row)
    }
    if (choices.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'empty'
      empty.textContent = translate('noSubfolders')
      rows.append(empty)
    }
    const foot = document.createElement('div')
    foot.className = 'picker-foot'
    foot.append(button(translate('cancel'), 'text-link', () => close(null)), button(translate('moveHere'), 'primary', () => close(folder)))
    element.append(title, crumbs, rows, foot)
    element.hidden = false
  }

  const pick = (start, exclude = []) => {
    if (resolveWith) close(null)
    folder = start
    excluded = new Set(exclude)
    document.addEventListener('keydown', onKey)
    render()
    return new Promise((resolve) => { resolveWith = resolve })
  }

  return { pick }
}
