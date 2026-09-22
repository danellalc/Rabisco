import { readingOrder } from './items.js'
import { normalize } from './list.js'

const inField = (target) => target instanceof Element && (target.matches('input, textarea') || target.isContentEditable)

export function itemText(item, element) {
  if (item.type === 'frame') return item.name || ''
  if (item.type === 'link') return item.url || ''
  const part = element ? element.querySelector('.note, .file-name') : null
  return part ? part.textContent : String(item.name || '')
}

export function matchesIn(items, query, textOf) {
  const needle = normalize(query).trim()
  if (!needle) return []
  return readingOrder(items).filter((item) => normalize(textOf(item)).includes(needle)).map((item) => item.id)
}

export function initFind({ bar, input, count, board, translate, isActive = () => true }) {
  const previous = bar.querySelector('.find-prev')
  const next = bar.querySelector('.find-next')
  const closeButton = bar.querySelector('.find-close')
  let ids = []
  let at = 0

  const textOf = (item) => itemText(item, board.elementOf(item.id))
  const focusInBoard = () => document.activeElement === document.body || board.host.area.contains(document.activeElement)

  const show = () => {
    if (ids.length > 0) count.textContent = translate('findCount').replace('{n}', String(at + 1)).replace('{total}', String(ids.length))
    else count.textContent = input.value.trim() ? translate('noResults') : ''
    previous.disabled = ids.length < 2
    next.disabled = ids.length < 2
  }

  const goTo = (position) => {
    if (ids.length === 0) return
    at = (position + ids.length) % ids.length
    board.focusItem(ids[at])
    show()
  }

  const search = () => {
    ids = matchesIn(board.items(), input.value, textOf)
    board.markFound(ids)
    at = 0
    if (ids.length > 0) board.focusItem(ids[0])
    show()
  }

  const open = () => {
    bar.hidden = false
    input.focus()
    input.select()
  }

  const close = () => {
    if (bar.hidden) return
    if (bar.contains(document.activeElement)) document.activeElement.blur()
    bar.hidden = true
    ids = []
    input.value = ''
    count.textContent = ''
    board.markFound([])
  }

  const jumpTo = (query) => {
    if (matchesIn(board.items(), query, textOf).length === 0) return
    input.value = query
    open()
    search()
  }

  input.addEventListener('input', search)
  bar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
      return
    }
    if (event.key !== 'Enter' || event.target !== input) return
    event.preventDefault()
    goTo(at + (event.shiftKey ? -1 : 1))
  })
  previous.addEventListener('click', () => goTo(at - 1))
  next.addEventListener('click', () => goTo(at + 1))
  closeButton.addEventListener('click', close)

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'f') return
    if (!bar.contains(event.target) && (inField(event.target) || !focusInBoard() || !isActive())) return
    event.preventDefault()
    open()
  })

  return { open, close, jumpTo }
}
