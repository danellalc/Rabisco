import { blockOf, insertBlock, placeCaret, wrapInlineRun } from './editor.js'
import { normalize } from './list.js'

export const SLASH_COMMANDS = [
  { id: 'paragraph', label: 'slashText' },
  { id: 'heading1', label: 'heading1' },
  { id: 'heading2', label: 'heading2' },
  { id: 'checklist', label: 'checklist' },
  { id: 'bulletList', label: 'bulletList' },
  { id: 'numberedList', label: 'numberedList' },
  { id: 'quote', label: 'quote' },
  { id: 'codeBlock', label: 'codeBlock' },
  { id: 'divider', label: 'divider' },
  { id: 'image', label: 'asImage' }
]

export function slashQuery(blockText) {
  const match = /^\/([^\s/]*)$/.exec(blockText)
  return match ? match[1] : null
}

export function filterSlash(commands, query, translate) {
  const needle = normalize(query)
  return commands.filter((command) => !needle || normalize(translate(command.label)).includes(needle) || normalize(command.id).includes(needle))
}

export function initSlash({ host, menu, translate, apply, beforeChange, pickImage }) {
  let block = null
  let matches = []
  let highlighted = 0

  const close = () => {
    menu.hidden = true
    menu.replaceChildren()
    block = null
    matches = []
  }

  const run = (command) => {
    const root = host.active()
    const target = block
    close()
    if (!root || !target || !target.isConnected) return
    beforeChange()
    const line = target.nodeType === Node.ELEMENT_NODE ? target : wrapInlineRun(target)
    line.textContent = ''
    line.append(document.createElement('br'))
    placeCaret(line, 0)
    if (command.id === 'divider') {
      insertBlock(root, document.createElement('hr'))
      return
    }
    if (command.id === 'image') {
      pickImage()
      return
    }
    apply(command.id)
  }

  const render = () => {
    menu.replaceChildren(...matches.map((command, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = index === highlighted ? 'menu-item current' : 'menu-item'
      button.textContent = translate(command.label)
      button.addEventListener('pointerdown', (event) => event.preventDefault())
      button.addEventListener('click', () => run(command))
      return button
    }))
  }

  const position = () => {
    const selection = document.getSelection()
    if (selection.rangeCount === 0) return
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const box = host.area.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left - box.left, host.area.clientWidth - menu.offsetWidth - 8))
    const below = rect.bottom - box.top + 6
    const top = below + menu.offsetHeight > host.area.clientHeight ? rect.top - box.top - menu.offsetHeight - 6 : below
    menu.style.left = `${left}px`
    menu.style.top = `${Math.max(8, top)}px`
  }

  const update = () => {
    const root = host.active()
    const selection = document.getSelection()
    if (!root || !host.editable() || selection.rangeCount === 0 || !selection.isCollapsed || !root.contains(selection.anchorNode)) {
      close()
      return
    }
    const current = blockOf(selection.anchorNode, root)
    const plainBlock = current && (current.nodeType === Node.TEXT_NODE || (current.nodeType === Node.ELEMENT_NODE && !['UL', 'OL', 'TABLE', 'PRE'].includes(current.tagName)))
    const query = plainBlock ? slashQuery(current.textContent) : null
    if (query === null) {
      close()
      return
    }
    block = current
    matches = filterSlash(SLASH_COMMANDS, query, translate)
    if (matches.length === 0) {
      close()
      return
    }
    highlighted = Math.min(highlighted, matches.length - 1)
    menu.hidden = false
    render()
    position()
  }

  host.layer.addEventListener('input', (event) => {
    if (event.inputType === 'insertText' && event.data === '/') highlighted = 0
    update()
  })

  document.addEventListener('keydown', (event) => {
    if (menu.hidden) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      highlighted = (highlighted + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length
      render()
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      run(matches[highlighted])
    }
  }, true)

  document.addEventListener('selectionchange', () => { if (!menu.hidden) update() })

  return { close, isOpen: () => !menu.hidden }
}
