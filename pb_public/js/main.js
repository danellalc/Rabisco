import { createChooser, createToast } from './dom.js'
import { createInsertImage, insertText, placeCaretAtEnd, removeImageBlock } from './editor.js'
import { applyTranslations, createTranslator, pickLanguage } from './i18n.js'
import { compressImage } from './images.js'
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

const releaseImage = (img) => {
  URL.revokeObjectURL(img.src)
  store.pendingImages.delete(img)
}

const discardImage = (img) => {
  if (!img.isConnected) return
  removeImageBlock(note, img)
  releaseImage(img)
  showToast(translate('imageUnreadable'))
}

const insertImage = createInsertImage(note, {
  onInserted: async (img, file) => {
    try {
      store.pendingImages.set(img, await compressImage(file))
    } catch {
      discardImage(img)
    }
  },
  onFailed: discardImage
})

const choose = (question, options) => {
  chooser(translate(question), options.map((option) => ({ label: translate(option.label), run: option.run })))
}

const dropMovedImage = initMove(note)
initPaste(note, { insertImage, insertText, insertTable: createInsertTable(note), choose, dropMovedImage })
initResize({ note, area, selection, handle, onRemove: releaseImage })
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
