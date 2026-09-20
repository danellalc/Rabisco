import { fileExtension } from './images.js'
import { sanitize } from './sanitize.js'

async function copyImage(api, img, noteId) {
  try {
    const blob = await (await fetch(img.src)).blob()
    const record = await api.uploadImage(noteId, blob, `image.${fileExtension(blob.type)}`)
    img.src = api.imageUrl(record)
  } catch {
    img.remove()
  }
}

export async function duplicateShared(api, token) {
  const shared = await api.getShared(token)
  const record = await api.createNote()
  const body = sanitize(shared.content)
  for (const img of body.querySelectorAll('img')) await copyImage(api, img, record.id)
  await api.saveNote(record.id, body.innerHTML, record.revision)
  return record.id
}
