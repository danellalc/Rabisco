import { parseDate, readList, writeList } from './list.js'

const SAVE_DELAY = 1000
const UNDO_DELAY = 5000
const RETRY_MIN = 2000
const RETRY_MAX = 30000
const SHRINK_MIN_LENGTH = 2000
const SHRINK_RATIO = 0.3
const lastKey = 'trecos.last'
const draftKey = (id) => `trecos.draft:${id}`
const cameraKey = (id) => `trecos.camera:${id}`

export function isSuspiciousShrink(previousLength, nextLength) {
  return previousLength > SHRINK_MIN_LENGTH && nextLength < previousLength * SHRINK_RATIO
}

export function nextRetryDelay(previous) {
  return Math.min(previous ? previous * 2 : RETRY_MIN, RETRY_MAX)
}

export function readDraft(storage, id) {
  try {
    const parsed = JSON.parse(storage.getItem(draftKey(id)) || 'null')
    return parsed && typeof parsed.content === 'string' && typeof parsed.revision === 'string' ? parsed : null
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

export function readCamera(storage, id) {
  try {
    const parsed = JSON.parse(storage.getItem(cameraKey(id)) || 'null')
    return parsed && [parsed.zoom, parsed.x, parsed.y].every((value) => typeof value === 'number' && isFinite(value)) ? parsed : null
  } catch {
    return null
  }
}

export function writeCamera(storage, id, camera) {
  try {
    storage.setItem(cameraKey(id), JSON.stringify(camera))
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

export function liveShares(shares, now = Date.now()) {
  return shares.filter((share) => !share.expires || parseDate(share.expires).getTime() > now)
}

const isClientError = (error) => Boolean(error && error.status >= 400 && error.status < 500)
const failureState = () => (navigator.onLine ? 'error' : 'offline')

export function createBoards({ api, store, board, layer, list, history, chooser, translate, formatBytes, setState, onAuthLost, showToast, onOpened, onQuota }) {
  let timer = 0
  let saving = false
  let switching = false
  let allowShrink = false
  let retryDelay = 0
  let chain = Promise.resolve()
  const uploads = new Set()
  const uploadRetries = new Map()
  const pendingFiles = new Map()
  const pendingDeletes = new Map()
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('trecos')

  const serial = (task) => {
    const run = chain.then(task, task)
    chain = run.catch(() => {})
    return run
  }

  const current = () => store.board

  const releaseUploaded = () => {
    for (const blobUrl of store.uploaded.keys()) URL.revokeObjectURL(blobUrl)
    store.uploaded.clear()
  }

  const show = (id, content) => {
    board.load(content, readCamera(localStorage, id))
    history.reset()
    releaseUploaded()
  }

  const swapUploadedImages = () => {
    for (const img of layer.querySelectorAll('img[src^="blob:"]')) {
      const url = store.uploaded.get(img.src)
      if (url) img.src = url
    }
  }

  const pruneStaleImages = () => {
    let pending = false
    for (const img of layer.querySelectorAll('img[src^="blob:"]')) {
      if (store.pendingImages.has(img.src)) {
        pending = true
        continue
      }
      const item = img.closest('.item')
      if (item && item.dataset.type === 'image') board.remove([item.dataset.id])
      else img.parentElement.remove()
    }
    return pending
  }

  const pruneStaleFiles = () => {
    let pending = false
    for (const id of board.pendingFileIds()) {
      if (pendingFiles.has(id)) pending = true
      else board.remove([id])
    }
    return pending
  }

  const hasPendingUploads = () => {
    const images = pruneStaleImages()
    const files = pruneStaleFiles()
    return images || files
  }

  const refreshQuota = async () => {
    try {
      onQuota(await api.quota())
    } catch {
      return
    }
  }

  const schedule = (delay = SAVE_DELAY) => {
    clearTimeout(timer)
    timer = setTimeout(save, delay)
  }

  const markDirty = () => {
    if (!current() || switching || board.isBroken()) return
    store.dirty = true
    setState('saving')
    schedule()
  }

  const rememberCamera = (camera) => {
    if (current()) writeCamera(localStorage, current().id, camera)
  }

  const summary = (record) => ({ id: record.id, title: record.title, cover: record.cover, pinned: record.pinned, updated: record.updated })

  const persistList = () => writeList(localStorage, list.get())

  const stillListed = (id) => !pendingDeletes.has(id) && Boolean(list.find(id))

  const applyServer = (record, shares = []) => {
    clearTimeout(timer)
    store.board = { id: record.id, revision: record.revision, length: record.content.length, shares }
    show(record.id, record.content)
    board.setEditable(true)
    switching = false
    store.dirty = false
    list.upsert(summary(record))
    persistList()
    setState('saved')
  }

  const conflict = () => {
    chooser.open(translate('conflict'), [
      { label: translate('keepMine'), run: async () => {
        const latest = await api.getBoard(current().id)
        current().revision = latest.revision
        store.dirty = true
        save()
      } },
      { label: translate('reload'), run: async () => {
        const id = current().id
        applyServer(await api.getBoard(id), current().shares)
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
    writeDraft(localStorage, active.id, { content: board.serialize(), revision: active.revision, at: Date.now() })
    if (hasPendingUploads()) return false
    const content = board.serialize()
    if (!allowShrink && isSuspiciousShrink(active.length, content.length)) {
      chooser.open(translate('shrunk'), [
        { label: translate('keep'), run: () => { allowShrink = true; save() } },
        { label: translate('undo'), run: () => { history.undo(); store.dirty = true; schedule() } }
      ], { focus: false, onDismiss: () => setState('error') })
      return false
    }
    saving = true
    store.dirty = false
    try {
      const result = await api.saveBoard(active.id, content, active.revision)
      active.revision = result.revision
      active.length = content.length
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
      const holdsStorage = content.includes('"file":') || content.includes('/api/files/images/')
      if (holdsStorage || active.holdsStorage) refreshQuota()
      active.holdsStorage = holdsStorage
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
        await api.deleteBoard(id)
      } catch {
        showToast(translate('saveFailed'))
      }
    }
  }

  const flush = async () => {
    clearTimeout(timer)
    board.stopEditing()
    await commitDeletes()
    await Promise.all([...uploads, ...pendingFiles.values()])
    if (!store.dirty) return true
    return save()
  }

  const uploadFailure = (error) => {
    if (error && error.status === 415) return translate('fileTypeBlocked')
    if (error && error.status === 413) {
      const data = error.data || {}
      return translate('storageFull').replace('{used}', formatBytes(data.used || 0)).replace('{quota}', formatBytes(data.quota || 0))
    }
    return translate('fileUploadFailed')
  }

  const uploadFile = (itemId, name, fileOrSourceId) => {
    const boardId = current() ? current().id : ''
    if (!boardId) return
    const task = (async () => {
      try {
        const blob = typeof fileOrSourceId === 'string' ? await api.downloadFile(fileOrSourceId) : fileOrSourceId
        const record = await api.uploadFile(boardId, blob, name, (fraction) => board.setFileProgress(itemId, fraction))
        pendingFiles.delete(itemId)
        if (current() && current().id === boardId) {
          board.setFileRecord(itemId, record)
          markDirty()
        }
      } catch (error) {
        pendingFiles.delete(itemId)
        if (current() && current().id === boardId) {
          board.remove([itemId])
          showToast(uploadFailure(error))
        }
      }
    })()
    pendingFiles.set(itemId, task)
  }

  const upload = async (blobUrl, boardId = current() ? current().id : '') => {
    const blob = store.pendingImages.get(blobUrl)
    if (!boardId || !blob) return
    const task = (async () => {
      try {
        const record = await api.uploadImage(boardId, blob, `image.${blob.type.split('/')[1]}`)
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
        if (current() && current().id === boardId) {
          swapUploadedImages()
          markDirty()
        }
      } catch (error) {
        if (isClientError(error)) {
          store.pendingImages.delete(blobUrl)
          showToast(error.status === 413 ? uploadFailure(error) : translate('imageUnreadable'))
          if (current() && current().id === boardId) markDirty()
        } else {
          setState(failureState())
          const delay = nextRetryDelay(uploadRetries.get(blobUrl) || 0)
          uploadRetries.set(blobUrl, delay)
          setTimeout(() => upload(blobUrl, boardId), delay)
        }
      }
    })()
    uploads.add(task)
    task.finally(() => uploads.delete(task))
  }

  const retryUploads = () => {
    for (const blobUrl of store.pendingImages.keys()) upload(blobUrl)
  }

  const isBlankBoard = () => !board.isBroken() && board.isBlank() && store.pendingImages.size === 0 && pendingFiles.size === 0

  const discardIfBlank = async () => {
    const active = current()
    if (!active || !isBlankBoard() || list.get().length < 2) return
    clearTimeout(timer)
    store.dirty = false
    store.board = null
    list.remove(active.id)
    persistList()
    writeDraft(localStorage, active.id, null)
    try {
      await api.deleteBoard(active.id)
    } catch {
      return
    }
  }

  const restoreDraft = (id, record) => {
    const draft = readDraft(localStorage, id)
    if (!draft) return
    if (draft.revision === record.revision) {
      show(id, draft.content)
      markDirty()
      return
    }
    chooser.open(translate('conflict'), [
      { label: translate('keepMine'), run: () => { show(id, draft.content); markDirty() } },
      { label: translate('reload'), run: () => writeDraft(localStorage, id, null) }
    ], { focus: false, onDismiss: () => setState('error') })
  }

  const switchTo = async (id) => {
    if (current() && current().id === id) {
      onOpened()
      return
    }
    if (!(await flush())) return
    switching = true
    board.setEditable(false)
    let record
    let shares
    try {
      record = await api.getBoard(id)
      shares = (await api.listShares(id)).items
    } catch (error) {
      switching = false
      if (current()) board.setEditable(true)
      throw error
    }
    await discardIfBlank()
    onOpened()
    applyServer(record, liveShares(shares))
    list.setActive(id)
    writeLast(localStorage, id)
    restoreDraft(id, record)
    if (board.isBlank()) board.editFirstText()
  }

  const open = (id) => serial(() => switchTo(id))

  const freshBoard = () => api.createBoard(JSON.stringify([{ id: 'first000', type: 'text', x: 0, y: 0, z: 1, w: 640, html: '' }]))

  const create = () => serial(async () => {
    if (current() && isBlankBoard()) {
      onOpened()
      board.editFirstText()
      return
    }
    if (!(await flush())) return
    const record = await freshBoard()
    list.upsert(summary(record))
    persistList()
    await switchTo(record.id)
  })

  const load = () => serial(async () => {
    list.set(readList(localStorage))
    const result = await api.listBoards()
    list.set(result.items)
    persistList()
    const last = readLast(localStorage)
    const first = list.find(last) || list.get()[0]
    refreshQuota()
    if (first) {
      await switchTo(first.id)
      return
    }
    const record = await freshBoard()
    list.upsert(summary(record))
    persistList()
    await switchTo(record.id)
  })

  const pin = async () => {
    const active = current()
    if (!active) return
    const entry = list.find(active.id)
    const record = await api.pinBoard(active.id, !(entry && entry.pinned))
    list.upsert(summary(record))
    persistList()
  }

  const getShares = () => (current() ? liveShares(current().shares) : [])

  const publishShares = () => {
    const active = current()
    if (channel && active) channel.postMessage({ id: active.id, shares: active.shares })
  }

  const createShare = async (items, mode, expires) => {
    const active = current()
    if (!active) return
    const share = await api.createShare(active.id, items, mode, expires)
    active.shares = [...active.shares, share]
    publishShares()
  }

  const updateShare = async (id, patch) => {
    const active = current()
    if (!active) return
    const share = await api.updateShare(id, patch)
    active.shares = active.shares.map((entry) => (entry.id === id ? share : entry))
    publishShares()
  }

  const deleteShare = async (id) => {
    const active = current()
    if (!active) return
    await api.deleteShare(id)
    active.shares = active.shares.filter((entry) => entry.id !== id)
    publishShares()
  }

  const title = () => {
    const entry = current() && list.find(current().id)
    return entry ? entry.title : ''
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
    store.board = null
    const next = list.get()[0]
    if (next) await switchTo(next.id)
    else {
      const record = await freshBoard()
      list.upsert(summary(record))
      persistList()
      await switchTo(record.id)
    }
    const timeout = setTimeout(async () => {
      pendingDeletes.delete(id)
      try {
        await api.deleteBoard(id)
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
    pendingFiles.clear()
    store.board = null
    store.dirty = false
    switching = false
    store.pendingImages.clear()
    releaseUploaded()
    list.reset()
    board.load('[]', { zoom: 1, x: 24, y: 24 })
    board.setEditable(false)
  }

  if (channel) {
    channel.addEventListener('message', async (event) => {
      const active = current()
      if (!active || event.data.id !== active.id) return
      if (event.data.shares) {
        active.shares = event.data.shares
        return
      }
      if (saving || switching || store.dirty || event.data.revision === active.revision) return
      applyServer(await api.getBoard(active.id), active.shares)
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

  board.setEditable(false)

  return { load, open, create, pin, remove, reset, markDirty, rememberCamera, upload, uploadFile, refreshQuota, save, flush, getShares, createShare, updateShare, deleteShare, title, currentId: () => (current() ? current().id : ''), isPinned: () => { const entry = current() && list.find(current().id); return Boolean(entry && entry.pinned) } }
}
