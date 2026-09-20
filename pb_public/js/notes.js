import { render, serialize } from './sanitize.js'
import { readList, writeList } from './list.js'
import { expiryDate } from './share.js'

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

export function writeLast(storage, id) {
  try {
    storage.setItem(lastKey, id)
  } catch {
    return
  }
}

export function expiryChoice(expires, now = Date.now()) {
  if (!expires) return 'never'
  const remaining = new Date(String(expires).replace(' ', 'T')).getTime() - now
  if (remaining <= 3600000) return '1h'
  if (remaining <= 86400000) return '1d'
  return '7d'
}

const shareOf = (record) => ({ mode: record.share_mode || 'off', token: record.share_token || '', expires: record.share_expires || '' })

const isClientError = (error) => Boolean(error && error.status >= 400 && error.status < 500)
const failureState = () => (navigator.onLine ? 'error' : 'offline')

export function createNotes({ api, store, note, list, history, chooser, translate, setState, onAuthLost, showToast, onOpened, focusEditor }) {
  let timer = 0
  let saving = false
  let switching = false
  let allowShrink = false
  let retryDelay = 0
  let chain = Promise.resolve()
  const uploads = new Set()
  const uploadRetries = new Map()
  const pendingDeletes = new Map()
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('rabisco')

  const serial = (task) => {
    const run = chain.then(task, task)
    chain = run.catch(() => {})
    return run
  }

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
    if (!current() || switching) return
    store.dirty = true
    setState('saving')
    schedule()
  }

  const summary = (record) => ({ id: record.id, title: record.title, cover: record.cover, pinned: record.pinned, updated: record.updated })

  const persistList = () => writeList(localStorage, list.get())

  const stillListed = (id) => !pendingDeletes.has(id) && Boolean(list.find(id))

  const applyServer = (record) => {
    clearTimeout(timer)
    store.note = { id: record.id, revision: record.updated, length: record.content.length, share: shareOf(record) }
    show(record.content)
    note.contentEditable = 'true'
    switching = false
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
    if (!active) return true
    if (!store.dirty) return !saving
    if (saving) return false
    swapUploadedImages()
    writeDraft(localStorage, active.id, { html: serialize(note), revision: active.revision, at: Date.now() })
    if (hasPendingImages()) return false
    const html = serialize(note)
    if (!allowShrink && isSuspiciousShrink(active.length, html.length)) {
      chooser.open(translate('shrunk'), [
        { label: translate('keep'), run: () => { allowShrink = true; save() } },
        { label: translate('undo'), run: () => { history.undo(); store.dirty = true; schedule() } }
      ], { focus: false, onDismiss: () => setState('error') })
      return false
    }
    saving = true
    store.dirty = false
    try {
      const result = await api.saveNote(active.id, html, active.revision)
      active.revision = result.updated
      active.length = html.length
      allowShrink = false
      retryDelay = 0
      writeDraft(localStorage, active.id, null)
      if (stillListed(active.id)) {
        list.upsert(summary(result))
        persistList()
      }
      if (channel) channel.postMessage({ id: active.id, revision: active.revision })
      if (current() === active) {
        setState(store.dirty ? 'saving' : 'saved')
        if (store.dirty) schedule()
      }
      return !store.dirty
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
      return false
    } finally {
      saving = false
    }
  }

  const commitDeletes = async () => {
    for (const [id, timeout] of [...pendingDeletes]) {
      clearTimeout(timeout)
      pendingDeletes.delete(id)
      try {
        await api.deleteNote(id)
      } catch {
        showToast(translate('saveFailed'))
      }
    }
  }

  const flush = async () => {
    clearTimeout(timer)
    await commitDeletes()
    await Promise.all([...uploads])
    if (!store.dirty) return true
    return save()
  }

  const upload = async (blobUrl, noteId = current() ? current().id : '') => {
    const blob = store.pendingImages.get(blobUrl)
    if (!noteId || !blob) return
    const task = (async () => {
      try {
        const record = await api.uploadImage(noteId, blob, `image.${blob.type.split('/')[1]}`)
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
        if (current() && current().id === noteId) {
          swapUploadedImages()
          markDirty()
        }
      } catch (error) {
        if (isClientError(error)) {
          store.pendingImages.delete(blobUrl)
          showToast(translate('imageUnreadable'))
          if (current() && current().id === noteId) markDirty()
        } else {
          setState(failureState())
          const delay = nextRetryDelay(uploadRetries.get(blobUrl) || 0)
          uploadRetries.set(blobUrl, delay)
          setTimeout(() => upload(blobUrl, noteId), delay)
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

  const switchTo = async (id) => {
    if (current() && current().id === id) {
      onOpened()
      focusEditor()
      return
    }
    if (!(await flush())) return
    switching = true
    note.contentEditable = 'false'
    let record
    try {
      record = await api.getNote(id)
    } catch (error) {
      switching = false
      if (current()) note.contentEditable = 'true'
      throw error
    }
    await discardIfBlank()
    applyServer(record)
    list.setActive(id)
    writeLast(localStorage, id)
    onOpened()
    restoreDraft(id, record)
    focusEditor()
  }

  const open = (id) => serial(() => switchTo(id))

  const create = () => serial(async () => {
    if (current() && isBlankNote()) {
      onOpened()
      focusEditor()
      return
    }
    if (!(await flush())) return
    const record = await api.createNote()
    list.upsert(summary(record))
    persistList()
    await switchTo(record.id)
  })

  const load = () => serial(async () => {
    list.set(readList(localStorage))
    const result = await api.listNotes()
    list.set(result.items)
    persistList()
    const last = readLast(localStorage)
    const first = list.find(last) || list.get()[0]
    if (first) {
      await switchTo(first.id)
      return
    }
    const record = await api.createNote()
    list.upsert(summary(record))
    persistList()
    await switchTo(record.id)
  })

  const pin = async () => {
    const active = current()
    if (!active) return
    const entry = list.find(active.id)
    const record = await api.pinNote(active.id, !(entry && entry.pinned))
    active.revision = record.updated
    list.upsert(summary(record))
    persistList()
  }

  const getShare = () => {
    const active = current()
    const share = active ? active.share : { mode: 'off', token: '', expires: '' }
    return { mode: share.mode, token: share.token, expiry: expiryChoice(share.expires) }
  }

  const setShare = async (mode, choice) => {
    const active = current()
    if (!active) return
    const record = await api.shareNote(active.id, mode, mode === 'off' ? '' : expiryDate(choice))
    active.revision = record.updated
    active.share = shareOf(record)
    list.upsert(summary(record))
    persistList()
  }

  const remove = () => serial(async () => {
    const active = current()
    if (!active) return
    const id = active.id
    clearTimeout(timer)
    store.dirty = false
    await commitDeletes()
    const entry = list.find(id)
    list.remove(id)
    persistList()
    writeDraft(localStorage, id, null)
    store.note = null
    const next = list.get()[0]
    if (next) await switchTo(next.id)
    else {
      const record = await api.createNote()
      list.upsert(summary(record))
      persistList()
      await switchTo(record.id)
    }
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
      run: () => {
        clearTimeout(pendingDeletes.get(id))
        pendingDeletes.delete(id)
        if (entry) list.upsert(entry)
        persistList()
        open(id).catch(() => showToast(translate('loadFailed')))
      }
    })
  })

  const reset = () => {
    clearTimeout(timer)
    for (const timeout of pendingDeletes.values()) clearTimeout(timeout)
    pendingDeletes.clear()
    uploadRetries.clear()
    store.note = null
    store.dirty = false
    switching = false
    store.pendingImages.clear()
    releaseUploaded()
    list.reset()
    note.replaceChildren()
    note.contentEditable = 'false'
  }

  if (channel) {
    channel.addEventListener('message', async (event) => {
      const active = current()
      if (!active || saving || switching || store.dirty || event.data.id !== active.id || event.data.revision === active.revision) return
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

  return { load, open, create, pin, remove, reset, markDirty, upload, save, flush, getShare, setShare, isPinned: () => { const entry = current() && list.find(current().id); return Boolean(entry && entry.pinned) } }
}
