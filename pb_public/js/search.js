import { normalize, relativeTime, parseDate } from './list.js'

const LIMIT = 20
const SNIPPET = 60
const KIND_LABELS = { all: 'typeAll', folder: 'typeFolders', doc: 'typeDocs', file: 'typeFiles' }
export const KINDS = Object.keys(KIND_LABELS)

export function buildIndex(index, translate) {
  const folderNames = new Map(index.boards.map((board) => [board.id, board.name || board.title || translate('untitled')]))
  const rows = []
  for (const board of index.boards) {
    const label = folderNames.get(board.id)
    rows.push({ kind: 'folder', id: board.id, folder: board.parent, label, updated: board.updated, meta: folderNames.get(board.parent) || translate('myDrive'), text: board.text || '', haystack: normalize(`${label} ${board.text}`) })
  }
  for (const doc of index.docs) {
    rows.push({ kind: 'doc', id: doc.id, folder: doc.board, label: doc.name, updated: doc.updated, meta: folderNames.get(doc.board) || '', text: doc.text || '', haystack: normalize(`${doc.name} ${doc.text}`) })
  }
  for (const file of index.files) {
    rows.push({ kind: 'file', id: file.id, folder: file.board, label: file.name, fileKind: file.kind, size: file.size, meta: folderNames.get(file.board) || '', text: '', haystack: normalize(file.name) })
  }
  return rows
}

export function filterRows(rows, kind) {
  return !kind || kind === 'all' ? rows : rows.filter((row) => row.kind === kind)
}

export function snippetOf(text, query) {
  const source = String(text || '')
  const needle = normalize(query).trim().split(/\s+/)[0]
  if (!needle) return ''
  const at = normalize(source).indexOf(needle)
  if (at < 0) return ''
  const start = Math.max(0, at - Math.round((SNIPPET - needle.length) / 2))
  const end = Math.min(source.length, start + SNIPPET)
  return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`
}

export function searchIndex(rows, query, limit = LIMIT) {
  const needle = normalize(query).trim()
  if (!needle) return rows.filter((row) => row.kind === 'folder').sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, limit)
  const words = needle.split(/\s+/)
  const inLabel = (row) => words.every((word) => normalize(row.label).includes(word))
  return rows
    .filter((row) => words.every((word) => row.haystack.includes(word)))
    .sort((a, b) => Number(inLabel(b)) - Number(inLabel(a)))
    .slice(0, limit)
}

export function matchingCommands(commands, query) {
  const needle = normalize(query).trim()
  return commands.filter((command) => !needle || normalize(command.label).includes(needle))
}

export function initSearch({ palette, input, rows, translate, language, commands, loadIndex, onOpen }) {
  let index = null
  let loading = null
  let highlighted = 0
  let kind = 'all'

  const close = () => {
    palette.hidden = true
    document.removeEventListener('pointerdown', closeIfOutside, true)
  }
  const closeIfOutside = (event) => {
    if (!palette.contains(event.target)) close()
  }

  const highlight = (position) => {
    const buttons = [...rows.querySelectorAll('.palette-row')]
    if (buttons.length === 0) return
    highlighted = (position + buttons.length) % buttons.length
    buttons.forEach((button, at) => button.classList.toggle('current', at === highlighted))
    buttons[highlighted].scrollIntoView({ block: 'nearest' })
  }

  const rowButton = (kindLabel, label, metaText, run, snippet = '') => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'palette-row'
    const kindText = document.createElement('span')
    kindText.className = 'kind'
    kindText.textContent = kindLabel
    const text = document.createElement('span')
    text.className = 'label'
    const title = document.createElement('span')
    title.textContent = label
    text.append(title)
    if (snippet) {
      const hint = document.createElement('span')
      hint.className = 'snippet'
      hint.textContent = snippet
      text.append(hint)
    }
    const meta = document.createElement('span')
    meta.className = 'meta-mono'
    meta.textContent = metaText
    button.append(kindText, text, meta)
    button.addEventListener('click', () => {
      close()
      run()
    })
    return button
  }

  const filters = document.createElement('div')
  filters.className = 'palette-filters'
  const chips = KINDS.map((name) => {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip'
    chip.dataset.kind = name
    chip.textContent = translate(KIND_LABELS[name])
    chip.addEventListener('click', () => setKind(name))
    filters.append(chip)
    return chip
  })
  rows.before(filters)

  const setKind = (next) => {
    kind = next
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.kind === kind))
    render()
    input.focus()
  }

  const snippetFor = (row, query) => {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean)
    if (words.length === 0 || words.every((word) => normalize(row.label).includes(word))) return ''
    return snippetOf(row.text, query)
  }

  const render = () => {
    const query = input.value
    const results = index ? searchIndex(filterRows(index, kind), query) : []
    const chosen = kind === 'all' ? matchingCommands(commands(), query) : []
    rows.replaceChildren(
      ...chosen.map((command) => rowButton(translate('kindCommand'), command.label, '', command.run)),
      ...results.map((row) => rowButton(
        translate(row.kind === 'file' ? 'kindFile' : row.kind === 'doc' ? 'kindDoc' : 'kindFolder'),
        row.label || translate('untitled'),
        row.kind === 'folder' ? relativeTime(parseDate(row.updated).getTime(), Date.now(), translate, language) : row.meta,
        () => onOpen(row, query),
        snippetFor(row, query)
      ))
    )
    highlight(0)
  }

  const open = async () => {
    palette.hidden = false
    input.value = ''
    input.focus()
    setKind('all')
    document.addEventListener('pointerdown', closeIfOutside, true)
    if (!loading) loading = loadIndex().then((built) => { index = built }).catch(() => {}).finally(() => { loading = null })
    await loading
    if (!palette.hidden) render()
  }

  input.addEventListener('input', render)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      setKind(KINDS[(KINDS.indexOf(kind) + (event.shiftKey ? KINDS.length - 1 : 1)) % KINDS.length])
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      highlight(highlighted + (event.key === 'ArrowDown' ? 1 : -1))
      return
    }
    if (event.key !== 'Enter') return
    const current = rows.querySelectorAll('.palette-row')[highlighted]
    if (current) current.click()
  })

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
    event.preventDefault()
    if (palette.hidden) open()
    else close()
  })

  return { open, close }
}
