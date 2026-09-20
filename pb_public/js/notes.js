import { render, serialize } from './sanitize.js'
import { readList, writeList } from './list.js'

const SAVE_DELAY = 1000
const UNDO_DELAY = 5000
const RETRY_MIN = 2000
const RETRY_MAX = 30000
const SHRINK_MIN_LENGTH = 2000
const SHRINK_RATIO = 0.3
const lastKey = 'rabisco.last'
const draftKey = (id) => `rabisco.draft:${id}`

export function isSuspiciousShrink(previousLength, nextLength) {
  return previousLength > SHRINK_MIN_LENGTH && nextLength < previousLength * SHRINK_RATIO
}

export function nextRetryDelay(previous) {
  return Math.min(previous ? previous * 2 : RETRY_MIN, RETRY_MAX)
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

function readLast(storage) {
  try {
    return storage.getItem(lastKey) || ''
  } catch {
    return ''
  }
}

function writeLast(storage, id) {
  try {
    storage.setItem(lastKey, id)
  } catch {
    return
  }
}

const isClientError = (error) => Boolean(error && error.status >= 400 && error.status < 500)
const failureState = () => (navigator.onLine ? 'error' : 'offline')

export function createNotes({ api, store, note, list, history, chooser, translate, setState, onAuthLost, showToast, onOpened }) {
  let timer = 0
  let saving = false
  let allowShrink = false
  let retryDelay = 0
  const uploads = new Set()
  const uploadRetries = new Map()
  const pendingDeletes = new Map()
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('rabisco')

  const current = () => store.note

  const releaseUploaded = () => {
    for (const blobUrl of store.uploaded.keys()) URL.revokeObjectURL(blobUrl)
    store.uploaded.clear()
  }

  const show = (html) => {
    render(note, html)
    history.reset()
    releaseUploaded()
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

  const schedule = (delay = SAVE_DELAY) => {
    clearTimeout(timer)
    timer = setTimeout(save, delay)
  }

  const markDirty = () => {
    if (!current()) return
    store.dirty = true
    setState('saving')
    schedule()
  }

  const summary = (record) => ({ id: record.id, title: record.title, cover: record.cover, pinned: record.pinned, updated: record.updated })

  const persistList = () => writeList(localStorage, list.get())

  const applyServer = (record) => {
    store.note = { id: record.id, revision: record.updated, length: record.content.length }
    show(record.content)
    note.contentEditable = 'true'
    store.dirty = false
    list.upsert(summary(record))
    persistList()
    setState('saved')
  }

  const conflict = () => {
    chooser.open(translate('conflict'), [
      { label: translate('keepMine'), run: async () => {
        const latest = await api.getNote(current().id)
        current().revision = latest.updated
        store.dirty = true
        save()
      } },
      { label: translate('reload'), run: async () => {
        const id = current().id
        applyServer(await api.getNote(id))
        writeDraft(localStorage, id, null)
      } }
    ], { focus: false, onDismiss: () => setState('error') })
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
      ], { focus: false, onDismiss: () => setState('error') })
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
      retryDelay = 0
      writeDraft(localStorage, active.id, null)
      list.upsert(summary(result))
      persistList()
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
      } else if (isClientError(error)) {
        setState('error')
        showToast(translate('saveFailed'))
      } else {
        setState(failureState())
        retryDelay = nextRetryDelay(retryDelay)
        schedule(retryDelay)
      }
    } finally {
      saving = false
    }
  }

  const flush = async () => {
    clearTimeout(timer)
    await Promise.all([...uploads])
    if (store.dirty) await save()
  }

  const upload = async (blobUrl) => {
    const active = current()
    const blob = store.pendingImages.get(blobUrl)
    if (!active || !blob) return
    const task = (async () => {
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
        uploadRetries.delete(blobUrl)
        swapUploadedImages()
        markDirty()
      } catch (error) {
        if (isClientError(error)) {
          store.pendingImages.delete(blobUrl)
          showToast(translate('imageUnreadable'))
          markDirty()
        } else {
          setState(failureState())
          const delay = nextRetryDelay(uploadRetries.get(blobUrl) || 0)
          uploadRetries.set(blobUrl, delay)
          setTimeout(() => upload(blobUrl), delay)
        }
      }
    })()
    uploads.add(task)
    task.finally(() => uploads.delete(task))
  }

  const retryUploads = () => {
    for (const blobUrl of store.pendingImages.keys()) upload(blobUrl)
  }

  const isBlankNote = () => serialize(note) === '' && store.pendingImages.size === 0

  const discardIfBlank = async () => {
    const active = current()
    if (!active || !isBlankNote() || list.get().length < 2) return
    clearTimeout(timer)
    store.dirty = false
    store.note = null
    list.remove(active.id)
    persistList()
    writeDraft(localStorage, active.id, null)
    try {
      await api.deleteNote(active.id)
    } catch {
      return
    }
  }

  const restoreDraft = (id, record) => {
    const draft = readDraft(localStorage, id)
    if (!draft) return
    if (draft.revision === record.updated) {
      show(draft.html)
      markDirty()
      return
    }
    chooser.open(translate('conflict'), [
      { label: translate('keepMine'), run: () => { show(draft.html); markDirty() } },
      { label: translate('reload'), run: () => writeDraft(localStorage, id, null) }
    ], { focus: false, onDismiss: () => setState('error') })
  }

  const open = async (id) => {
    if (current() && current().id === id) {
      onOpened()
      return
    }
    await flush()
    await discardIfBlank()
    const record = await api.getNote(id)
    applyServer(record)
    list.setActive(id)
    writeLast(localStorage, id)
    onOpened()
    restoreDraft(id, record)
  }

  const create = async () => {
    if (current() && isBlankNote()) {
      onOpened()
      note.focus()
      return
    }
    await flush()
    const record = await api.createNote()
    list.upsert(summary(record))
    persistList()
    await open(record.id)
    note.focus()
  }

  const load = async () => {
    list.set(readList(localStorage))
    const result = await api.listNotes()
    list.set(result.items)
    persistList()
    const last = readLast(localStorage)
    const first = list.find(last) || list.get()[0]
    if (first) await open(first.id)
    else await create()
  }

  const pin = async () => {
    const active = current()
    if (!active) return
    const entry = list.find(active.id)
    const record = await api.pinNote(active.id, !(entry && entry.pinned))
    active.revision = record.updated
    list.upsert(summary(record))
    persistList()
  }

  const remove = async () => {
    const active = current()
    if (!active) return
    const id = active.id
    clearTimeout(timer)
    store.dirty = false
    const entry = list.find(id)
    list.remove(id)
    persistList()
    store.note = null
    const next = list.get()[0]
    if (next) await open(next.id)
    else await create()
    const timeout = setTimeout(async () => {
      pendingDeletes.delete(id)
      try {
        await api.deleteNote(id)
      } catch {
        showToast(translate('saveFailed'))
      }
    }, UNDO_DELAY)
    pendingDeletes.set(id, timeout)
    showToast(translate('deleted'), {
      label: translate('undo'),
      run: async () => {
        clearTimeout(pendingDeletes.get(id))
        pendingDeletes.delete(id)
        if (entry) list.upsert(entry)
        persistList()
        await open(id)
      }
    })
  }

  const reset = () => {
    clearTimeout(timer)
    store.note = null
    store.dirty = false
    store.pendingImages.clear()
    releaseUploaded()
    list.set([])
    note.replaceChildren()
    note.contentEditable = 'false'
  }

  if (channel) {
    channel.addEventListener('message', async (event) => {
      const active = current()
      if (!active || saving || store.dirty || event.data.id !== active.id || event.data.revision === active.revision) return
      applyServer(await api.getNote(active.id))
    })
  }

  window.addEventListener('online', () => {
    retryUploads()
    if (store.dirty) schedule()
  })

  window.addEventListener('beforeunload', (event) => {
    if (!store.dirty && store.pendingImages.size === 0 && pendingDeletes.size === 0) return
    event.preventDefault()
    event.returnValue = ''
  })

  note.contentEditable = 'false'

  return { load, open, create, pin, remove, reset, markDirty, upload, save, flush, isPinned: () => { const entry = current() && list.find(current().id); return Boolean(entry && entry.pinned) } }
}
