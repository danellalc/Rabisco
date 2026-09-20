import { insertBlock } from './editor.js'

export function looksTabular(text) {
  if (typeof text !== 'string') return false
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim() !== '')
  return lines.length > 0 && lines.every((line) => line.includes('\t'))
}

export function parseTable(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => line.split('\t'))
}

export function createInsertTable(host) {
  return (text) => {
    const root = host.active()
    if (!root) return
    const table = document.createElement('table')
    const body = document.createElement('tbody')
    for (const cells of parseTable(text)) {
      const row = document.createElement('tr')
      for (const cell of cells) {
        const column = document.createElement('td')
        column.textContent = cell
        row.append(column)
      }
      body.append(row)
    }
    table.append(body)
    insertBlock(root, table)
  }
}
