import { insertBlock } from './editor.js'

export function looksTabular(text) {
  return typeof text === 'string' && text.includes('\t')
}

export function parseTable(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => line.split('\t'))
}

export function createInsertTable(root) {
  return (text) => {
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
