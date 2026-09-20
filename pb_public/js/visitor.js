import { render, serialize } from './sanitize.js'
import { nextRetryDelay } from './notes.js'

const SAVE_DELAY = 1000

export function createVisitor({ api, token, note, history, chooser, translate, setState, showToast, onReady }) {
  let mode = 'view'
  let revision = ''
  let dirty = false
  let saving = false
  let timer = 0
  let retryDelay = 0

  const editable = () => mode === 'edit' && note.isContentEditable

  const lock = () => {
    mode = 'view'
    dirty = false
    clearTimeout(timer)
    note.contentEditable = 'false'
    onReady('view')
  }

  const apply = (shared) => {
    mode = shared.mode
    revision = shared.revision
    render(note, shared.content)
    history.reset()
    note.contentEditable = mode === 'edit' ? 'true' : 'false'
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

  const save = async () => {
    if (!dirty || saving || !editable()) return
    for (const img of note.querySelectorAll('img[src^="blob:"]')) img.parentElement.remove()
    const html = serialize(note)
    saving = true
    dirty = false
    try {
      const result = await api.saveShared(token, html, revision)
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
      note.textContent = translate(gone ? 'linkGone' : 'loadFailed')
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
