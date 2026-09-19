import { createChooser, createToast } from './dom.js'
import { clearIfBlank, createInsertImage, insertText, placeCaretAtEnd, removeImageBlock } from './editor.js'
import { bindHistoryKeys, createHistory } from './history.js'
import { applyTranslations, createTranslator, pickLanguage } from './i18n.js'
import { compressImage, copyImage, downloadBlob, fileExtension } from './images.js'
import { createLightbox } from './lightbox.js'
import { initMenu } from './menu.js'
import { initMove } from './move.js'
import { initPaste } from './paste.js'
import { initResize } from './resize.js'
import { applySettings, readSettings, writeSettings } from './settings.js'
import { store } from './store.js'
import { createInsertTable } from './table.js'

store.settings = readSettings(localStorage)
applySettings(document.documentElement, store.settings)

const language = pickLanguage(navigator.languages)
const translate = createTranslator(language)
document.documentElement.lang = language
applyTranslations(document, translate)

const note = document.getElementById('note')
const area = document.getElementById('note-area')
const selection = document.getElementById('image-selection')
const handle = document.getElementById('resize-handle')
const showToast = createToast(document.getElementById('toast'))
const chooser = createChooser(document.getElementById('paste-choice'))
const openLightbox = createLightbox(document.getElementById('lightbox'))

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
  beforeChange: () => history.capture(),
  onOpen: (img) => openLightbox(img.src, () => downloadImage(img)),
  onCopy: copySelectedImage,
  onDownload: downloadImage
})
const history = createHistory(note, { onRestore: () => imageSelection.clear() })
note.addEventListener('beforeinput', () => chooser.settle())
bindHistoryKeys(note, history)
note.addEventListener('input', () => clearIfBlank(note))

const recorded = (action) => (...args) => {
  history.capture()
  return action(...args)
}

const discardImage = (img) => {
  if (!img.isConnected) return
  removeImageBlock(note, img)
  store.pendingImages.delete(img.src)
  showToast(translate('imageUnreadable'))
}

const insertImage = createInsertImage(note, {
  onInserted: async (img, file) => {
    try {
      store.pendingImages.set(img.src, await compressImage(file))
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
  beforeChange: () => history.capture(),
  onMoved: () => imageSelection.clear()
})
initPaste(note, {
  insertImage: recorded(insertImage),
  insertText: recorded(insertText),
  insertTable: recorded(createInsertTable(note)),
  choose
})
initMenu({
  button: document.getElementById('menu'),
  menu: document.getElementById('menu-panel'),
  translate,
  settings: store.settings,
  onChange: (settings) => {
    applySettings(document.documentElement, settings)
    writeSettings(localStorage, settings)
  }
})

area.addEventListener('click', (event) => {
  if (event.target !== area) return
  placeCaretAtEnd(note)
})

document.execCommand('enableObjectResizing', false, 'false')
note.focus()
