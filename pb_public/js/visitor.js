import { nextRetryDelay } from './boards.js'

const SAVE_DELAY = 1000

export function createVisitor({ api, token, board, layer, history, chooser, translate, setState, showToast, onReady }) {
  let mode = 'view'
  let revision = ''
  let dirty = false
  let saving = false
  let timer = 0
  let retryDelay = 0

  const editable = () => mode === 'edit'

  const lock = () => {
    mode = 'view'
    dirty = false
    clearTimeout(timer)
    board.setEditable(false)
    onReady('view')
  }

  const apply = (shared) => {
    mode = shared.mode
    revision = shared.revision
    board.load(shared.content)
    history.reset()
    board.setEditable(mode === 'edit')
    dirty = false
    if (mode === 'edit') setState('saved')
  }

  const schedule = (delay = SAVE_DELAY) => {
    clearTimeout(timer)
    timer = setTimeout(save, delay)
  }

  const markDirty = () => {
    if (!editable()) return
    dirty = true
    setState('saving')
    schedule()
  }

  const conflict = () => {
    chooser.open(translate('conflict'), [
      { label: translate('keepMine'), run: async () => {
        const latest = await api.getShared(token)
        revision = latest.revision
        dirty = true
        save()
      } },
      { label: translate('reload'), run: async () => apply(await api.getShared(token)) }
    ], { focus: false, onDismiss: () => setState('error') })
  }

  const dropPendingImages = () => {
    for (const img of layer.querySelectorAll('img[src^="blob:"]')) {
      const item = img.closest('.item')
      if (item && item.dataset.type === 'image') board.remove([item.dataset.id])
      else img.parentElement.remove()
    }
    const pending = board.pendingFileIds()
    if (pending.length > 0) board.remove(pending)
  }

  const save = async () => {
    if (!dirty || saving || !editable()) return
    dropPendingImages()
    const content = board.serialize()
    saving = true
    dirty = false
    try {
      const result = await api.saveShared(token, content, revision)
      revision = result.revision
      retryDelay = 0
      setState(dirty ? 'saving' : 'saved')
      if (dirty) schedule()
    } catch (error) {
      dirty = true
      if (error && error.status === 409) {
        setState('error')
        conflict()
      } else if (error && (error.status === 404 || error.status === 403)) {
        showToast(translate(error.status === 403 ? 'linkViewOnly' : 'linkGone'))
        lock()
      } else if (error && error.status >= 400 && error.status < 500) {
        setState('error')
        showToast(translate('saveFailed'))
      } else {
        setState(navigator.onLine ? 'error' : 'offline')
        retryDelay = nextRetryDelay(retryDelay)
        schedule(retryDelay)
      }
    } finally {
      saving = false
    }
  }

  const load = async () => {
    try {
      apply(await api.getShared(token))
      onReady(mode)
    } catch (error) {
      const gone = Boolean(error && error.status === 404)
      board.setMessage(translate(gone ? 'linkGone' : 'loadFailed'))
      lock()
      if (!gone) window.addEventListener('online', load, { once: true })
    }
  }

  window.addEventListener('online', () => { if (dirty) schedule() })
  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = ''
  })

  return { load, markDirty, isEditable: editable }
}
