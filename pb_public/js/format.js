import { blockOf } from './editor.js'

const HIGHLIGHTS = ['hl1', 'hl2', 'hl3']
const COLORS = ['c1', 'c2', 'c3']
const COLOR_SELECTOR = COLORS.map((name) => `span.${name}`).join(',')
const SENTINEL_COLOR = '#010203'
const BLOCK_COMMANDS = { H1: 'heading1', H2: 'heading2', BLOCKQUOTE: 'quote', PRE: 'codeBlock' }
const SPECIAL_BLOCKS = Object.keys(BLOCK_COMMANDS)

function endOffsetOf(node) {
  return node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length
}

function selectionRange(root) {
  const selection = document.getSelection()
  if (selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null
  return selection.getRangeAt(0)
}

function descendStart(node, offset) {
  while (node.nodeType === Node.ELEMENT_NODE && node.childNodes[offset]) {
    node = node.childNodes[offset]
    offset = 0
  }
  return [node, offset]
}

function descendEnd(node, offset) {
  while (node.nodeType === Node.ELEMENT_NODE && offset > 0 && node.childNodes[offset - 1]) {
    node = node.childNodes[offset - 1]
    offset = endOffsetOf(node)
  }
  return [node, offset]
}

function keepingSelection(root, work) {
  const range = selectionRange(root)
  const points = range ? [...descendStart(range.startContainer, range.startOffset), ...descendEnd(range.endContainer, range.endOffset)] : null
  work()
  if (!points || !points[0].isConnected || !points[2].isConnected) return
  const restored = document.createRange()
  restored.setStart(points[0], Math.min(points[1], endOffsetOf(points[0])))
  restored.setEnd(points[2], Math.min(points[3], endOffsetOf(points[2])))
  const selection = document.getSelection()
  selection.removeAllRanges()
  selection.addRange(restored)
}

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

function overlapsText(range, element) {
  const inner = document.createRange()
  inner.selectNodeContents(element)
  const startInside = range.compareBoundaryPoints(Range.START_TO_START, inner) > 0
  const endInside = range.compareBoundaryPoints(Range.END_TO_END, inner) < 0
  const clipped = document.createRange()
  clipped.setStart(startInside ? range.startContainer : inner.startContainer, startInside ? range.startOffset : inner.startOffset)
  clipped.setEnd(endInside ? range.endContainer : inner.endContainer, endInside ? range.endOffset : inner.endOffset)
  return clipped.toString() !== ''
}

function unwrapTouching(root, selector) {
  const range = selectionRange(root)
  if (!range) return
  const targets = [...root.querySelectorAll(selector)].filter((element) => range.intersectsNode(element) && overlapsText(range, element))
  targets.forEach(unwrap)
}

function elementAtCaret(root) {
  const range = selectionRange(root)
  if (!range) return null
  const node = range.startContainer
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
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

function isolateItem(list, item) {
  const items = [...list.children]
  const index = items.indexOf(item)
  const before = items.slice(0, index)
  const after = items.slice(index + 1)
  if (before.length > 0) {
    const head = list.cloneNode(false)
    head.append(...before)
    list.before(head)
  }
  if (after.length > 0) {
    const tail = list.cloneNode(false)
    tail.append(...after)
    list.after(tail)
  }
}

function toggleList(root, ordered, checklist) {
  if (SPECIAL_BLOCKS.includes(currentBlockTag(root))) document.execCommand('formatBlock', false, '<div>')
  const element = elementAtCaret(root)
  const item = element ? element.closest('li') : null
  const list = item ? item.parentElement : null
  if (list && list.tagName === 'UL' && !ordered && list.classList.contains('ck') !== checklist) {
    keepingSelection(root, () => {
      isolateItem(list, item)
      list.classList.toggle('ck', checklist)
    })
    return
  }
  document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList')
  const created = currentList(root)
  if (created && created.tagName === 'UL') created.classList.toggle('ck', checklist)
}

function paint(root, selector, tag, className) {
  keepingSelection(root, () => unwrapTouching(root, selector))
  document.execCommand('foreColor', false, SENTINEL_COLOR)
  keepingSelection(root, () => retag(root, 'font[color]', tag, className))
}

export function createFormatter(host) {
  const commands = {
    bold: () => document.execCommand('bold'),
    italic: () => document.execCommand('italic'),
    underline: () => document.execCommand('underline'),
    strike: (root) => {
      document.execCommand('strikeThrough')
      keepingSelection(root, () => retag(root, 'strike', 's'))
    },
    heading1: (root) => toggleBlock(root, 'h1'),
    heading2: (root) => toggleBlock(root, 'h2'),
    quote: (root) => toggleBlock(root, 'blockquote'),
    codeBlock: (root) => toggleBlock(root, 'pre'),
    paragraph: () => document.execCommand('formatBlock', false, '<div>'),
    code: (root) => {
      const element = elementAtCaret(root)
      if (element && element.closest('code')) keepingSelection(root, () => unwrapTouching(root, 'code'))
      else paint(root, 'code', 'code', '')
    },
    bulletList: (root) => toggleList(root, false, false),
    numberedList: (root) => toggleList(root, true, false),
    checklist: (root) => toggleList(root, false, true),
    hlNone: (root) => keepingSelection(root, () => unwrapTouching(root, 'mark')),
    cDefault: (root) => keepingSelection(root, () => unwrapTouching(root, COLOR_SELECTOR)),
    clear: (root) => {
      keepingSelection(root, () => unwrapTouching(root, `mark,code,${COLOR_SELECTOR}`))
      document.execCommand('removeFormat')
      if (SPECIAL_BLOCKS.includes(currentBlockTag(root))) document.execCommand('formatBlock', false, '<div>')
    }
  }
  for (const name of HIGHLIGHTS) commands[name] = (root) => paint(root, 'mark', 'mark', name)
  for (const name of COLORS) commands[name] = (root) => paint(root, COLOR_SELECTOR, 'span', name)

  const apply = (name) => {
    const command = commands[name]
    const root = host.active()
    if (!command || !root) return
    root.focus({ preventScroll: true })
    command(root)
  }

  const active = () => {
    const set = new Set()
    const root = host.active()
    if (!root) return set
    if (document.queryCommandState('bold')) set.add('bold')
    if (document.queryCommandState('italic')) set.add('italic')
    if (document.queryCommandState('underline')) set.add('underline')
    if (document.queryCommandState('strikeThrough')) set.add('strike')
    const tag = currentBlockTag(root)
    if (BLOCK_COMMANDS[tag]) set.add(BLOCK_COMMANDS[tag])
    const element = elementAtCaret(root)
    if (!element) return set
    const list = element.closest('ul,ol')
    if (list) set.add(list.tagName === 'OL' ? 'numberedList' : list.classList.contains('ck') ? 'checklist' : 'bulletList')
    if (element.closest('code')) set.add('code')
    if (element.closest('blockquote')) set.add('quote')
    if (element.closest('pre')) set.add('codeBlock')
    const mark = element.closest('mark')
    if (mark) set.add(mark.className)
    const colored = element.closest(COLORS.map((name) => `.${name}`).join(','))
    if (colored) set.add(colored.className)
    return set
  }

  return { apply, active }
}

export function initChecklist(host, beforeChange) {
  host.layer.addEventListener('click', (event) => {
    const item = event.target
    const root = item instanceof Element ? host.rootOf(item) : null
    if (!root || root !== host.active() || item.tagName !== 'LI' || event.offsetX > 24) return
    if (!item.parentElement.classList.contains('ck')) return
    beforeChange()
    item.classList.toggle('on')
  })

  host.layer.addEventListener('input', (event) => {
    const root = host.active()
    if (event.inputType !== 'insertParagraph' || !root || !root.contains(event.target)) return
    const element = elementAtCaret(root)
    const item = element ? element.closest('li') : null
    if (!item || !item.parentElement.classList.contains('ck') || !item.classList.contains('on')) return
    const previous = item.previousElementSibling
    if (previous && previous.classList.contains('on')) item.classList.remove('on')
  })
}
