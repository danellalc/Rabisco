import { countOf } from './i18n.js'
import { normalize } from './list.js'

const listingKey = 'trecos.listing'
const lastKey = 'trecos.last'
const FIRST_TEXT = JSON.stringify([{ id: 'first000', type: 'text', x: 0, y: 0, z: 1, w: 640, html: '' }])

export function labelOf(entry) {
  return entry.name || entry.title || ''
}

export function entriesOf(listing) {
  const folders = listing.folders.map((folder) => ({ kind: 'folder', id: folder.id, name: labelOf(folder), title: folder.title, pinned: folder.pinned, updated: folder.updated, cover: folder.cover, count: folder.count || 0 }))
  const docs = listing.docs.map((doc) => ({ kind: 'doc', id: doc.id, name: doc.name, updated: doc.updated, revision: doc.revision }))
  const files = listing.files.map((file) => ({ kind: 'file', id: file.id, name: file.name, size: file.size, fileKind: file.kind, pic: file.pic || '', updated: file.updated }))
  return [...folders, ...docs, ...files]
}

export function sortEntries(entries, order) {
  const rank = { folder: 0, doc: 1, file: 1 }
  return [...entries].sort((a, b) => {
    if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind]
    if (Number(b.pinned || 0) !== Number(a.pinned || 0)) return Number(b.pinned || 0) - Number(a.pinned || 0)
    if (order === 'name') return normalize(a.name).localeCompare(normalize(b.name))
    return String(b.updated).localeCompare(String(a.updated))
  })
}

export function readLast(storage) {
  try {
    return storage.getItem(lastKey)
  } catch {
    return null
  }
}

export function writeLast(storage, id) {
  try {
    storage.setItem(lastKey, id)
  } catch {
    return
  }
}

export function readCachedListing(storage, id) {
  try {
    const parsed = JSON.parse(storage.getItem(listingKey) || 'null')
    return parsed && parsed.id === id && parsed.listing && Array.isArray(parsed.listing.folders) ? parsed.listing : null
  } catch {
    return null
  }
}

export function writeCachedListing(storage, id, listing) {
  try {
    storage.setItem(listingKey, JSON.stringify({ id, listing }))
  } catch {
    return
  }
}

export function createResources({ api, translate, showToast }) {
  const cache = new Map()

  const listing = async (id, { fresh = false } = {}) => {
    if (!fresh && cache.has(id)) return cache.get(id)
    const result = await api.drive(id)
    cache.set(id, result)
    return result
  }

  const invalidate = (...ids) => {
    for (const id of ids) cache.delete(id)
  }

  const createFolder = async (parent, name, content = FIRST_TEXT) => {
    const record = await api.createBoard({ parent, name, content })
    invalidate(parent)
    return record
  }

  const createDoc = async (folder, name, content = '') => {
    const record = await api.createDoc(folder, name, content)
    invalidate(folder)
    return record
  }

  const rename = async (entry, folder, name) => {
    if (entry.kind === 'folder') await api.updateBoard(entry.id, { name })
    else if (entry.kind === 'doc') await api.updateDoc(entry.id, { name })
    else await api.updateFile(entry.id, { name })
    invalidate(folder)
  }

  const move = async (entry, from, target) => {
    if (entry.id === target) return
    if (entry.kind === 'folder') await api.updateBoard(entry.id, { parent: target })
    else if (entry.kind === 'doc') await api.updateDoc(entry.id, { board: target })
    else await api.updateFile(entry.id, { board: target })
    invalidate(from, target)
  }

  const pin = async (entry, folder) => {
    await api.updateBoard(entry.id, { pinned: !entry.pinned })
    invalidate(folder)
  }

  const deleteNow = (entry) => {
    if (entry.kind === 'folder') return api.deleteBoard(entry.id)
    if (entry.kind === 'doc') return api.deleteDoc(entry.id)
    return api.deleteFile(entry.id)
  }

  const restore = async (entry, folder) => {
    const result = await api.restore(entry.kind, entry.id)
    invalidate(folder, result.home)
    return result.home
  }

  const remove = async (entries, folder, { onUndo }) => {
    const done = []
    for (const entry of entries) {
      try {
        await api.trash(entry.kind, entry.id)
        done.push(entry)
      } catch {
        showToast(translate('saveFailed'))
      }
    }
    invalidate(folder)
    if (done.length === 0) return done
    const what = done.length === 1 ? done[0].name || translate('untitled') : countOf(translate, 'items', done.length)
    showToast(translate('movedToTrash').replace('{name}', what), {
      label: translate('undo'),
      run: async () => {
        try {
          for (const entry of done) await restore(entry, folder)
        } catch {
          showToast(translate('saveFailed'))
        }
        onUndo()
      }
    })
    return done
  }

  const trashList = () => api.listTrash()

  const emptyTrash = async () => {
    await api.emptyTrash()
    cache.clear()
  }

  const upload = async (folder, file, onProgress = () => {}, signal) => {
    const record = await api.uploadFile(folder, file, file.name, onProgress, signal)
    invalidate(folder)
    return record
  }

  const duplicate = async (entry, folder) => {
    if (entry.kind === 'doc') {
      const doc = await api.getDoc(entry.id)
      return createDoc(folder, translate('copyOf').replace('{name}', doc.name), doc.content)
    }
    if (entry.kind === 'file') {
      const blob = await api.downloadFile(entry.id)
      const record = await api.uploadFile(folder, blob, entry.name, () => {})
      invalidate(folder)
      return record
    }
    return null
  }

  const reset = () => {
    cache.clear()
  }

  return { listing, invalidate, createFolder, createDoc, rename, move, pin, remove, restore, deleteNow, trashList, emptyTrash, upload, duplicate, reset }
}
