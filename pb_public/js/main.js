import { createApi } from './api.js'
import { initAuth, writeAuth } from './auth.js'
import { createChooser, createToast } from './dom.js'
import { clearIfBlank, createInsertImage, insertText, placeCaretAtEnd, removeImageBlock } from './editor.js'
import { createFormatter, initChecklist } from './format.js'
import { bindHistoryKeys, createHistory } from './history.js'
import { applyTranslations, createTranslator, pickLanguage } from './i18n.js'
import { compressImage, copyImage, downloadBlob, fileExtension } from './images.js'
import { createLightbox } from './lightbox.js'
import { initLinks, linkSelection } from './links.js'
import { initList } from './list.js'
import { initMenu } from './menu.js'
import { initMove } from './move.js'
import { createNotes } from './notes.js'
import { initPaste } from './paste.js'
import { initResize } from './resize.js'
import { textOf } from './sanitize.js'
import { applySettings, readSettings, writeSettings } from './settings.js'
import { initShortcuts } from './shortcuts.js'
import { store } from './store.js'
import { createInsertTable } from './table.js'
import { initToolbar } from './toolbar.js'

store.settings = readSettings(localStorage)
applySettings(document.documentElement, store.settings)
if (/Android/.test(navigator.userAgent)) document.querySelector('meta[name=viewport]').content += ', interactive-widget=resizes-content'
document.body.dataset.view = 'loading'

const language = pickLanguage(navigator.languages)
const translate = createTranslator(language)
document.documentElement.lang = language
applyTranslations(document, translate)

const note = document.getElementById('note')
const area = document.getElementById('note-area')
const selection = document.getElementById('image-selection')
const handle = document.getElementById('resize-handle')
const saveState = document.getElementById('save-state')
const showToast = createToast(document.getElementById('toast'))
const chooser = createChooser(document.getElementById('paste-choice'))
const openLightbox = createLightbox(document.getElementById('lightbox'))
const formatter = createFormatter(note)
const api = createApi({
  getToken: () => (store.auth ? store.auth.token : ''),
  getUserId: () => (store.auth ? store.auth.userId : ''),
  onSession: (session) => {
    if (!store.auth) return
    store.auth = { ...store.auth, token: session.token }
    writeAuth(localStorage, store.auth)
  }
})
const signedIn = () => Boolean(store.auth) && ['note', 'list'].includes(document.body.dataset.view)
const isPhone = () => matchMedia('(max-width:719px)').matches
const showNote = () => { document.body.dataset.view = 'note' }
const showList = () => { document.body.dataset.view = 'list' }
const saveSettings = () => {
  applySettings(document.documentElement, store.settings)
  writeSettings(localStorage, store.settings)
}

const imageBlob = async (img) => store.pendingImages.get(img.src) || (await fetch(img.src)).blob()

const downloadImage = async (img) => {
  try {
    const blob = await imageBlob(img)
    downloadBlob(blob, `rabisco-${Date.now()}.${fileExtension(blob.type)}`)
  } catch {
    showToast(translate('imageUnreadable'))
  }
}

const copySelectedImage = async (img) => {
  try {
    await copyImage(img.src)
    showToast(translate('imageCopied'))
  } catch {
    showToast(translate('copyFailed'))
  }
}

const imageSelection = initResize({
  note,
  area,
  selection,
  handle,
  beforeChange: () => beforeChange(),
  afterChange: () => notes.markDirty(),
  onOpen: (img) => openLightbox(img.src, () => downloadImage(img)),
  onCopy: copySelectedImage,
  onDownload: downloadImage
})
const history = createHistory(note, { onRestore: () => { imageSelection.clear(); notes.markDirty() } })
const list = initList({
  rows: document.getElementById('rows'),
  search: document.getElementById('search'),
  translate,
  language,
  onOpen: (id) => notes.open(id).catch(() => showToast(translate('loadFailed'))),
  onSearchContents: async () => {
    const result = await api.listContents()
    return new Map(result.items.map((item) => [item.id, textOf(item.content)]))
  },
  onSearchFailed: () => showToast(translate('searchFailed'))
})
const notes = createNotes({
  api,
  store,
  note,
  list,
  history,
  chooser,
  translate,
  setState: (state) => { saveState.textContent = translate(state) },
  onAuthLost: () => auth.signOut(),
  showToast,
  onOpened: showNote,
  focusEditor: () => placeCaretAtEnd(note)
})
const beforeChange = () => {
  history.capture()
  notes.markDirty()
}
const recorded = (action) => (...args) => {
  beforeChange()
  return action(...args)
}

note.addEventListener('beforeinput', () => chooser.settle())
initShortcuts({
  note,
  apply: formatter.apply,
  beforeChange,
  insertDate: () => recorded(insertText)(new Intl.DateTimeFormat(language, { dateStyle: 'short' }).format(new Date()))
})
initLinks({ note, beforeChange })
bindHistoryKeys(note, history)
note.addEventListener('input', () => {
  clearIfBlank(note)
  notes.markDirty()
})

const discardImage = (img) => {
  if (!img.isConnected) return
  removeImageBlock(note, img)
  store.pendingImages.delete(img.src)
  showToast(translate('imageUnreadable'))
}

const insertImage = createInsertImage(note, {
  onInserted: async (img, file) => {
    try {
      const blobUrl = img.src
      store.pendingImages.set(blobUrl, await compressImage(file))
      notes.upload(blobUrl)
    } catch {
      discardImage(img)
    }
  },
  onFailed: discardImage
})

const choose = (question, options) => {
  chooser.open(translate(question), options.map((option) => ({ label: translate(option.label), run: option.run })))
}

initMove({
  note,
  area,
  marker: document.getElementById('drop-marker'),
  beforeChange,
  onMoved: () => imageSelection.clear()
})
initPaste(note, {
  insertImage: recorded(insertImage),
  insertText: recorded(insertText),
  insertTable: recorded(createInsertTable(note)),
  linkSelection: recorded((url) => linkSelection(note, url)),
  choose
})
initToolbar({ note, area, bar: document.getElementById('toolbar'), apply: formatter.apply, active: formatter.active, beforeChange })
initChecklist(note, beforeChange)
initMenu({
  button: document.getElementById('menu'),
  menu: document.getElementById('menu-panel'),
  translate,
  settings: store.settings,
  actions: [
    { label: () => translate(notes.isPinned() ? 'unpin' : 'pin'), run: () => notes.pin().catch(() => showToast(translate('saveFailed'))) },
    { label: () => translate('delete'), danger: true, run: () => notes.remove().catch(() => showToast(translate('saveFailed'))) }
  ],
  onChange: saveSettings
})

const createNote = () => {
  if (!signedIn()) return
  notes.create().catch(() => showToast(translate('saveFailed')))
}
document.getElementById('new').addEventListener('click', createNote)
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.key.toLowerCase() !== 'n') return
  event.preventDefault()
  createNote()
})
document.getElementById('back').addEventListener('click', () => {
  if (isPhone()) {
    notes.flush()
    showList()
    return
  }
  store.settings.sidebar = store.settings.sidebar === 'open' ? 'closed' : 'open'
  saveSettings()
})
document.getElementById('sign-out').addEventListener('click', async () => {
  await notes.flush()
  auth.signOut()
})

area.addEventListener('click', (event) => {
  if (event.target !== area) return
  placeCaretAtEnd(note)
})

const auth = initAuth({
  api,
  store,
  translate,
  elements: {
    emailForm: document.getElementById('email-form'),
    codeForm: document.getElementById('code-form'),
    emailInput: document.getElementById('email'),
    codeInput: document.getElementById('code'),
    emailError: document.getElementById('email-error'),
    codeError: document.getElementById('code-error'),
    codeNote: document.getElementById('code-note'),
    resend: document.getElementById('resend'),
    changeEmail: document.getElementById('change-email')
  },
  onSignedIn: () => {
    document.getElementById('me').textContent = store.auth.email
    showNote()
    loadNotes()
  },
  onSignedOut: () => {
    notes.reset()
    document.getElementById('me').textContent = ''
    saveState.textContent = ''
  }
})

async function loadNotes() {
  try {
    await notes.load()
    note.focus()
  } catch (error) {
    if (error && error.status === 401) {
      auth.signOut()
      return
    }
    saveState.textContent = translate('loadFailed')
    window.addEventListener('online', loadNotes, { once: true })
  }
}

document.execCommand('styleWithCSS', false, 'false')
document.execCommand('defaultParagraphSeparator', false, 'div')
document.execCommand('enableObjectResizing', false, 'false')
auth.restore()
