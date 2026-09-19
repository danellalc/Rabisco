import { createToast } from './dom.js'
import { createInsertImage, insertText, placeCaretAtEnd, removeImageBlock } from './editor.js'
import { compressImage } from './images.js'
import { initPaste } from './paste.js'
import { initResize } from './resize.js'
import { store } from './store.js'

const note = document.getElementById('note')
const area = document.getElementById('note-area')
const selection = document.getElementById('image-selection')
const handle = document.getElementById('resize-handle')
const showToast = createToast(document.getElementById('toast'))

const releaseImage = (img) => {
  URL.revokeObjectURL(img.src)
  store.pendingImages.delete(img)
}

const discardImage = (img) => {
  if (!img.isConnected) return
  removeImageBlock(note, img)
  releaseImage(img)
  showToast('That image could not be read')
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

initPaste(note, { insertImage, insertText })
initResize({ note, area, selection, handle, onRemove: releaseImage })

area.addEventListener('click', (event) => {
  if (event.target !== area) return
  placeCaretAtEnd(note)
})

document.execCommand('enableObjectResizing', false, 'false')
note.focus()
