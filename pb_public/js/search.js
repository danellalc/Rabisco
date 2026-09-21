import { normalize, relativeTime, parseDate } from './list.js'

const LIMIT = 20

export function buildIndex(index, translate) {
  const folderNames = new Map(index.boards.map((board) => [board.id, board.name || board.title || translate('untitled')]))
  const rows = []
  for (const board of index.boards) {
    const label = folderNames.get(board.id)
    rows.push({ kind: 'folder', id: board.id, folder: board.parent, label, updated: board.updated, meta: folderNames.get(board.parent) || translate('myDrive'), haystack: normalize(`${label} ${board.text}`) })
  }
  for (const doc of index.docs) {
    rows.push({ kind: 'doc', id: doc.id, folder: doc.board, label: doc.name, updated: doc.updated, meta: folderNames.get(doc.board) || '', haystack: normalize(`${doc.name} ${doc.text}`) })
  }
  for (const file of index.files) {
    rows.push({ kind: 'file', id: file.id, folder: file.board, label: file.name, fileKind: file.kind, size: file.size, meta: folderNames.get(file.board) || '', haystack: normalize(file.name) })
  }
  return rows
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

  const rowButton = (kindLabel, label, metaText, run) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'palette-row'
    const kind = document.createElement('span')
    kind.className = 'kind'
    kind.textContent = kindLabel
    const text = document.createElement('span')
    text.className = 'label'
    text.textContent = label
    const meta = document.createElement('span')
    meta.className = 'meta-mono'
    meta.textContent = metaText
    button.append(kind, text, meta)
    button.addEventListener('click', () => {
      close()
      run()
    })
    return button
  }

  const render = () => {
    const query = input.value
    const results = index ? searchIndex(index, query) : []
    const chosen = matchingCommands(commands(), query)
    rows.replaceChildren(
      ...chosen.map((command) => rowButton(translate('kindCommand'), command.label, '', command.run)),
      ...results.map((row) => rowButton(
        translate(row.kind === 'file' ? 'kindFile' : row.kind === 'doc' ? 'kindDoc' : 'kindFolder'),
        row.label || translate('untitled'),
        row.kind === 'folder' ? relativeTime(parseDate(row.updated).getTime(), Date.now(), translate, language) : row.meta,
        () => onOpen(row)
      ))
    )
    highlight(0)
  }

  const open = async () => {
    palette.hidden = false
    input.value = ''
    input.focus()
    document.addEventListener('pointerdown', closeIfOutside, true)
    render()
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
