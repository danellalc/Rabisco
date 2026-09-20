import { normalize, relativeTime, parseDate } from './list.js'
import { parseContent, readingOrder, textOfItems } from './items.js'

const LIMIT = 20

export function buildIndex(boards, contents, textOf) {
  const rows = []
  for (const board of boards) {
    const items = parseContent(contents.get(board.id) || '[]') || []
    const text = textOfItems(items, textOf)
    rows.push({ kind: 'board', boardId: board.id, label: board.title, updated: board.updated, haystack: normalize(`${board.title} ${text}`) })
    for (const item of readingOrder(items)) {
      if (item.type !== 'file') continue
      rows.push({ kind: 'file', boardId: board.id, itemId: item.id, label: item.name, meta: board.title, haystack: normalize(item.name) })
    }
  }
  return rows
}

export function searchIndex(rows, query, limit = LIMIT) {
  const needle = normalize(query).trim()
  if (!needle) return rows.filter((row) => row.kind === 'board').slice(0, limit)
  const words = needle.split(/\s+/)
  return rows.filter((row) => words.every((word) => row.haystack.includes(word))).slice(0, limit)
}

export function initSearch({ palette, input, rows, translate, language, loadIndex, onOpen }) {
  let index = null
  let loading = null

  const close = () => {
    palette.hidden = true
    document.removeEventListener('pointerdown', closeIfOutside, true)
  }
  const closeIfOutside = (event) => {
    if (!palette.contains(event.target)) close()
  }

  const render = () => {
    const results = index ? searchIndex(index, input.value) : []
    rows.replaceChildren(...results.map((row) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'palette-row'
      const kind = document.createElement('span')
      kind.className = 'kind'
      kind.textContent = translate(row.kind === 'file' ? 'kindFile' : 'kindBoard')
      const label = document.createElement('span')
      label.className = 'label'
      label.textContent = row.label || translate('untitled')
      const meta = document.createElement('span')
      meta.className = 'meta-mono'
      meta.textContent = row.kind === 'file' ? row.meta || translate('untitled') : relativeTime(parseDate(row.updated).getTime(), Date.now(), translate, language)
      button.append(kind, label, meta)
      button.addEventListener('click', () => {
        close()
        onOpen(row)
      })
      return button
    }))
  }

  const open = async () => {
    palette.hidden = false
    input.value = ''
    input.focus()
    document.addEventListener('pointerdown', closeIfOutside, true)
    if (!loading) loading = loadIndex().then((built) => { index = built }).catch(() => {}).finally(() => { loading = null })
    await loading
    render()
  }

  input.addEventListener('input', render)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key !== 'Enter') return
    const first = rows.querySelector('.palette-row')
    if (first) first.click()
  })

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
    event.preventDefault()
    if (palette.hidden) open()
    else close()
  })

  return { open, close }
}
