import { caretPathOf, placeCaretAtEnd, placeCaretByPath } from './editor.js'
import { createHistory } from './history.js'
import { render, serialize } from './sanitize.js'
import { nextRetryDelay } from './boards.js'

const SAVE_DELAY = 1000

export function createDocument({ section, nameField, note, host, translate, setState, showToast, chooser, onNameChanged, onClosed }) {
  let current = null
  let dirty = false
  let saving = false
  let timer = 0
  let retryDelay = 0

  const history = createHistory({
    snapshot: () => ({ key: note.innerHTML, caret: caretPathOf(note) }),
    restore: (entry) => {
      render(note, entry.key, { allowLocalImages: true })
      if (entry.caret) placeCaretByPath(note, entry.caret)
      else placeCaretAtEnd(note)
      markDirty()
    }
  })

  const isOpen = () => current !== null

  const schedule = (delay = SAVE_DELAY) => {
    clearTimeout(timer)
    timer = setTimeout(save, delay)
  }

  const markDirty = () => {
    if (!current || !current.editable) return
    dirty = true
    setState('saving')
    schedule()
  }

  const apply = (doc) => {
    current = doc
    render(note, doc.content)
    note.contentEditable = doc.editable ? 'true' : 'false'
    nameField.value = doc.name
    nameField.disabled = !doc.editable || !doc.rename
    section.hidden = false
    document.body.dataset.doc = ''
    host.setDocument(note)
    history.reset()
    dirty = false
    setState('saved')
  }

  const conflict = () => {
    chooser.open(translate('conflict'), [
      { label: translate('keepMine'), run: async () => {
        const latest = await current.reload()
        current.revision = latest.revision
        dirty = true
        save()
      } },
      { label: translate('reload'), run: async () => apply({ ...current, ...(await current.reload()) }) }
    ], { focus: false, onDismiss: () => setState('error') })
  }

  const save = async () => {
    if (!current || !dirty || saving || !current.editable) return
    if (section.querySelector('img[src^="blob:"]')) {
      schedule()
      return
    }
    const content = serialize(note)
    const doc = current
    saving = true
    dirty = false
    try {
      const result = await doc.save(content, doc.revision)
      doc.revision = result.revision
      retryDelay = 0
      if (current === doc) {
        setState(dirty ? 'saving' : 'saved')
        if (dirty) schedule()
      }
    } catch (error) {
      dirty = true
      if (current !== doc) return
      if (error && error.status === 409) {
        setState('error')
        conflict()
      } else if (error && (error.status === 404 || error.status === 403)) {
        showToast(translate(error.status === 403 ? 'linkViewOnly' : 'linkGone'))
        current.editable = false
        note.contentEditable = 'false'
        setState('error')
      } else if (error && error.status === 401) {
        setState('error')
        throw error
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

  const flush = async () => {
    clearTimeout(timer)
    if (dirty) await save()
    return !dirty
  }

  const open = async (doc) => {
    if (current) await close()
    apply(doc)
    if (doc.editable) {
      note.focus({ preventScroll: true })
      placeCaretAtEnd(note)
    }
  }

  const close = async () => {
    if (!current) return
    await flush()
    const doc = current
    current = null
    dirty = false
    section.hidden = true
    delete document.body.dataset.doc
    host.setDocument(null)
    note.replaceChildren()
    history.reset()
    onClosed(doc)
  }

  nameField.addEventListener('change', async () => {
    if (!current || !current.rename) return
    const name = nameField.value.trim()
    if (!name || name === current.name) {
      nameField.value = current.name
      return
    }
    try {
      await current.rename(name)
      current.name = name
      onNameChanged(current)
    } catch {
      nameField.value = current.name
      showToast(translate('saveFailed'))
    }
  })
  nameField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      note.focus()
      placeCaretAtEnd(note)
    }
  })

  window.addEventListener('online', () => { if (dirty) schedule() })
  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = ''
  })

  return { open, close, flush, markDirty, isOpen, history, current: () => current, note }
}
