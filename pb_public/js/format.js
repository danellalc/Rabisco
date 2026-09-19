import { blockOf } from './editor.js'

const HIGHLIGHTS = ['hl1', 'hl2', 'hl3']
const COLORS = ['c1', 'c2', 'c3']

function unwrap(element) {
  element.replaceWith(...element.childNodes)
}

function retag(root, from, to, className) {
  for (const element of root.querySelectorAll(from)) {
    const replacement = document.createElement(to)
    if (className) replacement.className = className
    replacement.append(...element.childNodes)
    element.replaceWith(replacement)
  }
}

function selectionRange(root) {
  const selection = document.getSelection()
  if (selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null
  return selection.getRangeAt(0)
}

function elementAtCaret(root) {
  const range = selectionRange(root)
  if (!range) return null
  const node = range.startContainer
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
}

function unwrapTouching(root, selector) {
  const range = selectionRange(root)
  if (!range) return
  for (const element of root.querySelectorAll(selector)) {
    if (range.intersectsNode(element)) unwrap(element)
  }
}

function currentBlockTag(root) {
  const range = selectionRange(root)
  if (!range) return ''
  const block = blockOf(range.startContainer, root)
  return block && block.nodeType === Node.ELEMENT_NODE ? block.tagName : ''
}

function toggleBlock(root, tag) {
  const same = currentBlockTag(root) === tag.toUpperCase()
  document.execCommand('formatBlock', false, same ? '<div>' : `<${tag}>`)
}

function currentList(root) {
  const element = elementAtCaret(root)
  return element ? element.closest('ul,ol') : null
}

function toggleList(root, ordered, checklist) {
  const list = currentList(root)
  if (list && list.tagName === 'UL' && !ordered) {
    const isChecklist = list.classList.contains('ck')
    if (isChecklist !== checklist) {
      list.classList.toggle('ck', checklist)
      return
    }
  }
  document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList')
  const created = currentList(root)
  if (created && created.tagName === 'UL') created.classList.toggle('ck', checklist)
}

function highlight(root, className) {
  unwrapTouching(root, 'mark')
  document.execCommand('hiliteColor', false, '#010203')
  retag(root, 'span[style*="background"]', 'mark', className)
}

function color(root, className) {
  unwrapTouching(root, COLORS.map((name) => `span.${name}`).join(','))
  document.execCommand('foreColor', false, '#010203')
  retag(root, 'font[color]', 'span', className)
  retag(root, 'span[style*="color"]', 'span', className)
}

export function createFormatter(root) {
  const commands = {
    bold: () => document.execCommand('bold'),
    italic: () => document.execCommand('italic'),
    underline: () => document.execCommand('underline'),
    strike: () => {
      document.execCommand('strikeThrough')
      retag(root, 'strike', 's')
    },
    heading1: () => toggleBlock(root, 'h1'),
    heading2: () => toggleBlock(root, 'h2'),
    bulletList: () => toggleList(root, false, false),
    numberedList: () => toggleList(root, true, false),
    checklist: () => toggleList(root, false, true),
    hlNone: () => unwrapTouching(root, 'mark'),
    cDefault: () => unwrapTouching(root, COLORS.map((name) => `span.${name}`).join(',')),
    clear: () => {
      document.execCommand('removeFormat')
      if (['H1', 'H2'].includes(currentBlockTag(root))) document.execCommand('formatBlock', false, '<div>')
    }
  }
  for (const name of HIGHLIGHTS) commands[name] = () => highlight(root, name)
  for (const name of COLORS) commands[name] = () => color(root, name)

  const apply = (name) => {
    const command = commands[name]
    if (!command) return
    root.focus({ preventScroll: true })
    command()
  }

  const active = () => {
    const set = new Set()
    if (document.queryCommandState('bold')) set.add('bold')
    if (document.queryCommandState('italic')) set.add('italic')
    if (document.queryCommandState('underline')) set.add('underline')
    if (document.queryCommandState('strikeThrough')) set.add('strike')
    const tag = currentBlockTag(root)
    if (tag === 'H1') set.add('heading1')
    if (tag === 'H2') set.add('heading2')
    const element = elementAtCaret(root)
    if (!element) return set
    const list = element.closest('ul,ol')
    if (list) set.add(list.tagName === 'OL' ? 'numberedList' : list.classList.contains('ck') ? 'checklist' : 'bulletList')
    const mark = element.closest('mark')
    if (mark) set.add(mark.className)
    const colored = element.closest(COLORS.map((name) => `.${name}`).join(','))
    if (colored) set.add(colored.className)
    return set
  }

  return { apply, active }
}

export function initChecklistToggle(root, beforeChange) {
  root.addEventListener('click', (event) => {
    const item = event.target
    if (!(item instanceof Element) || item.tagName !== 'LI' || event.offsetX > 24) return
    const list = item.parentElement
    if (!list.classList.contains('ck')) return
    beforeChange()
    item.classList.toggle('on')
  })
}
