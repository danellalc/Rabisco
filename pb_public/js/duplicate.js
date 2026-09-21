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

async function copyFile(api, token, item, boardId) {
  const blob = await api.downloadShared(token, item.file)
  const record = await api.uploadFile(boardId, blob, item.name, () => {})
  return { ...item, file: record.id, name: record.name, size: record.size, kind: record.kind }
}

export async function duplicateShared(api, token) {
  const shared = await api.getShared(token)
  const record = await api.createBoard({ name: shared.title || '' })
  if (shared.kind === 'doc') {
    await api.createDoc(record.id, shared.title, await copyInlineImages(api, shared.content, record.id))
    return record.id
  }
  if (shared.kind === 'file') {
    await copyFile(api, token, shared.file, record.id)
    return record.id
  }
  const items = []
  for (const item of parseContent(shared.content) || []) {
    try {
      if (item.type === 'text') items.push({ ...item, html: await copyInlineImages(api, item.html, record.id) })
      else if (item.type === 'image') items.push({ ...item, src: await copyImage(api, item.src, record.id) })
      else if (item.type === 'file') items.push(await copyFile(api, token, item, record.id))
      else if (item.type === 'link') items.push(item)
    } catch {
      continue
    }
  }
  await api.saveBoard(record.id, JSON.stringify(items), record.revision)
  return record.id
}
