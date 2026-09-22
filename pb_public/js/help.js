export const SHORTCUTS = [
  ['targetBoard', [
    ['V', 'toolSelect'], ['H / Space', 'toolHand'], ['T', 'toolText'], ['N', 'toolNote'], ['F', 'toolFrame'],
    ['dblClick', 'placeholder'], ['Enter', 'edit'], ['Del', 'delete'],
    ['Ctrl A', 'selectAll'], ['Ctrl Shift A', 'tidy'], ['Ctrl D', 'duplicate'], ['Ctrl C, Ctrl V', 'copyPaste'],
    ['Ctrl Z', 'undo'], ['Ctrl Shift Z', 'redo'], ['Ctrl 0', 'zoom100'], ['Ctrl +', 'zoomIn'], ['Ctrl -', 'zoomOut'], ['Ctrl F', 'findOnBoard'], ['Esc', 'escHelp']
  ]],
  ['helpList', [['Enter', 'open'], ['F2', 'rename'], ['Del', 'delete'], ['Space', 'select'], ['↑ ↓', 'arrowsRows']]],
  ['slashText', [
    ['Ctrl B', 'bold'], ['Ctrl I', 'italic'], ['Ctrl U', 'underline'], ['Ctrl E', 'code'], ['/', 'slashHelp'],
    ['# Space', 'heading1'], ['- Space', 'bulletList'], ['1. Space', 'numberedList'], ['[] Space', 'checklist'],
    ['> Space', 'quote'], ['``` Enter', 'codeBlock'], ['--- Enter', 'divider'],
    ['Ctrl Shift L / E / R', 'alignHelp'], ['Ctrl Alt C / V', 'copyPasteStyle']
  ]],
  ['helpApp', [['Ctrl K', 'searchAll'], ['Ctrl Alt N', 'newFolder'], ['?', 'shortcuts']]]
]

const inField = (target) => target instanceof Element && (target.matches('input, textarea') || target.isContentEditable)

const element = (tag, className, text) => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

export function initHelp({ element: panel, translate, isActive }) {
  const body = element('div', 'help-body', '')
  for (const [group, rows] of SHORTCUTS) {
    const section = element('div', 'help-group', '')
    section.append(element('p', 'menu-label', translate(group)))
    for (const [keys, label] of rows) {
      const row = element('div', 'help-row', '')
      row.append(element('kbd', '', translate(keys) || keys), element('span', '', translate(label)))
      section.append(row)
    }
    body.append(section)
  }
  panel.append(element('p', 'menu-title', translate('shortcuts')), body)

  const close = () => {
    panel.hidden = true
    document.removeEventListener('pointerdown', closeIfOutside, true)
  }
  const closeIfOutside = (event) => {
    if (!panel.contains(event.target)) close()
  }
  const open = () => {
    if (!panel.hidden) return
    panel.hidden = false
    document.addEventListener('pointerdown', closeIfOutside, true)
  }
  const toggle = () => (panel.hidden ? open() : close())

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close()
    if (event.key !== '?' || inField(event.target) || !isActive()) return
    event.preventDefault()
    toggle()
  })

  return { open, close, toggle }
}
