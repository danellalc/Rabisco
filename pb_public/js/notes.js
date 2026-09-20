import { render, serialize } from './sanitize.js'

const SAVE_DELAY = 1000
const SHRINK_MIN_LENGTH = 2000
const SHRINK_RATIO = 0.3
const draftKey = (id) => `rabisco.draft:${id}`

export function isSuspiciousShrink(previousLength, nextLength) {
  return previousLength > SHRINK_MIN_LENGTH && nextLength < previousLength * SHRINK_RATIO
}

export function readDraft(storage, id) {
  try {
    const parsed = JSON.parse(storage.getItem(draftKey(id)) || 'null')
    return parsed && typeof parsed.html === 'string' && typeof parsed.revision === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function writeDraft(storage, id, draft) {
  try {
    if (draft) storage.setItem(draftKey(id), JSON.stringify(draft))
    else storage.removeItem(draftKey(id))
  } catch {
    return
  }
}

export function createNotes({ api, store, note, history, chooser, translate, setState, onAuthLost, showToast }) {
  let timer = 0
  let saving = false
  let allowShrink = false
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('rabisco')

  const current = () => store.note

  const show = (html) => {
    render(note, html)
    history.reset()
  }

  const swapUploadedImages = () => {
    for (const img of note.querySelectorAll('img[src^="blob:"]')) {
      const url = store.uploaded.get(img.src)
      if (url) img.src = url
    }
  }

  const hasPendingImages = () => [...note.querySelectorAll('img[src^="blob:"]')].some((img) => {
    if (store.pendingImages.has(img.src)) return true
    img.parentElement.remove()
    return false
  })

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(save, SAVE_DELAY)
  }

  const markDirty = () => {
    if (!current()) return
    store.dirty = true
    setState('saving')
    schedule()
  }

  const applyServer = (record) => {
    store.note = { id: record.id, revision: record.updated, length: record.content.length }
    show(record.content)
    store.dirty = false
    writeDraft(localStorage, record.id, null)
    setState('saved')
  }

  const conflict = async () => {
    chooser.open(translate('conflict'), [
      { label: translate('reload'), run: async () => applyServer(await api.getNote(current().id)) },
      { label: translate('keepMine'), run: async () => {
        const latest = await api.getNote(current().id)
        current().revision = latest.updated
        store.dirty = true
        save()
      } }
    ])
  }

  const save = async () => {
    const active = current()
    if (!active || !store.dirty || saving) return
    swapUploadedImages()
    if (hasPendingImages()) return
    const html = serialize(note)
    if (!allowShrink && isSuspiciousShrink(active.length, html.length)) {
      chooser.open(translate('shrunk'), [
        { label: translate('keep'), run: () => { allowShrink = true; save() } },
        { label: translate('undo'), run: () => { history.undo(); store.dirty = true; schedule() } }
      ])
      return
    }
    writeDraft(localStorage, active.id, { html, revision: active.revision, at: Date.now() })
    saving = true
    store.dirty = false
    try {
      const result = await api.saveNote(active.id, html, active.revision)
      active.revision = result.updated
      active.length = html.length
      allowShrink = false
      writeDraft(localStorage, active.id, null)
      if (channel) channel.postMessage({ id: active.id, revision: active.revision })
      setState(store.dirty ? 'saving' : 'saved')
      if (store.dirty) schedule()
    } catch (error) {
      store.dirty = true
      if (error && error.status === 409) {
        setState('error')
        conflict()
      } else if (error && error.status === 401) {
        setState('error')
        onAuthLost()
      } else if (error && error.status >= 400 && error.status < 500) {
        setState('error')
        showToast(translate('saveFailed'))
      } else {
        setState('offline')
      }
    } finally {
      saving = false
    }
  }

  const upload = async (blobUrl) => {
    const active = current()
    const blob = store.pendingImages.get(blobUrl)
    if (!active || !blob) return
    try {
      const record = await api.uploadImage(active.id, blob, `image.${blob.type.split('/')[1]}`)
      const url = api.imageUrl(record)
      await new Promise((resolve, reject) => {
        const probe = new Image()
        probe.onload = resolve
        probe.onerror = reject
        probe.src = url
      })
      store.uploaded.set(blobUrl, url)
      store.pendingImages.delete(blobUrl)
      swapUploadedImages()
      markDirty()
    } catch (error) {
      if (error && error.status >= 400 && error.status < 500) {
        store.pendingImages.delete(blobUrl)
        showToast(translate('imageUnreadable'))
        markDirty()
      } else {
        setState('offline')
      }
    }
  }

  const retryUploads = () => {
    for (const blobUrl of store.pendingImages.keys()) upload(blobUrl)
  }

  const load = async () => {
    const latest = await api.latestNote()
    const record = latest.items[0] || await api.createNote()
    applyServer(record)
    const draft = readDraft(localStorage, record.id)
    if (!draft) return
    if (draft.revision === record.updated) {
      show(draft.html)
      markDirty()
      return
    }
    chooser.open(translate('conflict'), [
      { label: translate('reload'), run: () => writeDraft(localStorage, record.id, null) },
      { label: translate('keepMine'), run: () => { show(draft.html); markDirty() } }
    ])
  }

  if (channel) {
    channel.addEventListener('message', async (event) => {
      const active = current()
      if (!active || event.data.id !== active.id || event.data.revision === active.revision || store.dirty) return
      applyServer(await api.getNote(active.id))
    })
  }

  window.addEventListener('online', () => {
    retryUploads()
    if (store.dirty) schedule()
  })

  window.addEventListener('beforeunload', (event) => {
    if (!store.dirty && store.pendingImages.size === 0) return
    event.preventDefault()
    event.returnValue = ''
  })

  return { load, markDirty, upload, save }
}
