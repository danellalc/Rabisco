import { fileExtension } from './images.js'
import { parseContent } from './items.js'
import { sanitize } from './sanitize.js'

async function copyImage(api, src, boardId) {
  const blob = await (await fetch(src)).blob()
  const record = await api.uploadImage(boardId, blob, `image.${fileExtension(blob.type)}`)
  return api.imageUrl(record)
}

async function copyInlineImages(api, html, boardId) {
  const body = sanitize(html)
  for (const img of body.querySelectorAll('img')) {
    try {
      img.src = await copyImage(api, img.src, boardId)
    } catch {
      const block = img.parentElement
      img.remove()
      if (block && block.parentElement && block.textContent.trim() === '' && !block.querySelector('img')) block.remove()
    }
  }
  return body.innerHTML
}

export async function duplicateShared(api, token) {
  const shared = await api.getShared(token)
  const record = await api.createBoard()
  const items = []
  for (const item of parseContent(shared.content)) {
    if (item.type === 'text') items.push({ ...item, html: await copyInlineImages(api, item.html, record.id) })
    else if (item.type === 'image') {
      try {
        items.push({ ...item, src: await copyImage(api, item.src, record.id) })
      } catch {
        continue
      }
    } else items.push(item)
  }
  await api.saveBoard(record.id, JSON.stringify(items), record.revision)
  return record.id
}
