import { createApi } from './api.js'
import { initAuth, readAuth, writeAuth } from './auth.js'
import { createBoard } from './board.js'
import { createBoards, writeLast } from './boards.js'
import { ZOOM_STEP, zoomLabel } from './camera.js'
import { createChooser, createPopover, createToast } from './dom.js'
import { duplicateShared } from './duplicate.js'
import { clearIfBlank, createInsertImage, insertText, removeImageBlock } from './editor.js'
import { fileName, toMarkdown, toText, treeOfBoard } from './export.js'
import { createFormatter, initChecklist } from './format.js'
import { bindHistoryKeys, createHistory } from './history.js'
import { applyTranslations, createTranslator, pickLanguage } from './i18n.js'
import { compressImage, copyImage, downloadBlob, fileExtension } from './images.js'
import { FILE_MAX_BYTES, formatSize, isBlockedName, parseContent, textOfItems } from './items.js'
import { createLightbox } from './lightbox.js'
import { initLinks, isUrl, linkSelection, toHref } from './links.js'
import { initList } from './list.js'
import { initMenu } from './menu.js'
import { initMove } from './move.js'
import { imageFiles, initPaste, otherFiles } from './paste.js'
import { initResize } from './resize.js'
import { serviceWorkerUrl, textOf } from './sanitize.js'
import { applySettings, readSettings, writeSettings } from './settings.js'
import { SHARE_HASH, clearShareTarget, readShareTarget } from './share-target.js'
import { initShare, tokenFromHash } from './share.js'
import { initShortcuts } from './shortcuts.js'
import { migrateStorage, store } from './store.js'
import { createInsertTable } from './table.js'
import { initToolbar } from './toolbar.js'
import { createVisitor } from './visitor.js'

migrateStorage(localStorage)
store.settings = readSettings(localStorage)
applySettings(document.documentElement, store.settings)
if (/Android/.test(navigator.userAgent)) document.querySelector('meta[name=viewport]').content += ', interactive-widget=resizes-content'
document.body.dataset.view = 'loading'

const language = pickLanguage(navigator.languages)
const translate = createTranslator(language)
document.documentElement.lang = language
applyTranslations(document, translate)

const sharedPage = location.pathname.startsWith('/s/')
const sharedToken = sharedPage ? tokenFromHash(location.hash) : ''
const duplicateKey = 'trecos.duplicate'
const area = document.getElementById('board')
const layer = document.getElementById('layer')
const saveState = document.getElementById('save-state')
const zoomLevel = document.getElementById('zoom-level')
const showToast = createToast(document.getElementById('toast'))
const chooser = createChooser(document.getElementById('paste-choice'))
const itemMenu = createPopover(document.getElementById('item-menu'))
const openLightbox = createLightbox(document.getElementById('lightbox'))
const api = createApi({
  getToken: () => (store.auth ? store.auth.token : ''),
  getUserId: () => (store.auth ? store.auth.userId : ''),
  onSession: (session) => {
    if (!store.auth) return
    store.auth = { ...store.auth, token: session.token }
    writeAuth(localStorage, store.auth)
  }
})
const setState = (state) => { saveState.textContent = translate(state) }
const sync = { markDirty: () => {}, rememberCamera: () => {}, imageInserted: () => {}, fileInserted: () => {}, mediaLink: () => Promise.reject(new Error('no link')), renameFile: () => Promise.reject(new Error('no rename')) }
const formatBytes = (bytes) => formatSize(bytes, language)
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
    downloadBlob(blob, `trecos-${Date.now()}.${fileExtension(blob.type)}`)
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

const beforeChange = () => {
  history.capture()
  sync.markDirty()
}
const recorded = (action) => (...args) => {
  beforeChange()
  return action(...args)
}

const downloadFile = async (item) => {
  try {
    const url = await sync.mediaLink(item)
    const link = document.createElement('a')
    link.href = url
    link.download = item.name
    link.click()
  } catch {
    showToast(translate('downloadFailed'))
  }
}

const showItemMenu = (id, anchor) => {
  const element = layer.querySelector(`.item[data-id="${id}"]`)
  const item = board.itemOf(id)
  const actions = []
  if (element && element.dataset.type === 'image') actions.push({ label: translate('download'), run: () => downloadImage(element.querySelector('img')) })
  if (item && item.type === 'file' && item.file) {
    if (!sharedPage) actions.push({ label: translate('rename'), run: () => board.renameFile(id) })
    actions.push({ label: translate('download'), run: () => downloadFile(item) })
  }
  actions.push(
    { label: translate('duplicate'), run: () => board.duplicate([id]) },
    { label: translate('bringToFront'), run: () => board.bringToFront([id]) },
    { label: translate('delete'), danger: true, run: () => board.remove([id]) }
  )
  itemMenu.open(actions, anchor.getBoundingClientRect())
}

const board = createBoard({
  area,
  layer,
  lasso: document.getElementById('lasso'),
  guides: { x: document.getElementById('guide-x'), y: document.getElementById('guide-y') },
  message: document.getElementById('board-message'),
  translate,
  language,
  onChange: () => sync.markDirty(),
  beforeChange,
  onCamera: (camera) => {
    zoomLevel.textContent = zoomLabel(camera.zoom)
    sync.rememberCamera(camera)
  },
  onOpenImage: (img) => openLightbox(img.src, () => downloadImage(img)),
  onOpenFile: (item) => downloadFile(item),
  onItemMenu: showItemMenu,
  onImageInserted: (img, file) => sync.imageInserted(img, file),
  onFileInserted: (item, file) => sync.fileInserted(item, file),
  onMediaLink: (item) => sync.mediaLink(item),
  onRenameFile: (item, name) => sync.renameFile(item, name)
})
const host = board.host
const formatter = createFormatter(host)
const history = createHistory({ snapshot: board.snapshot, restore: (entry) => { imageSelection.clear(); board.restore(entry) } })

const imageSelection = initResize({
  host,
  area,
  selection: document.getElementById('image-selection'),
  handle: document.getElementById('resize-handle'),
  beforeChange,
  afterChange: () => sync.markDirty(),
  onOpen: (img) => openLightbox(img.src, () => downloadImage(img)),
  onCopy: copySelectedImage,
  onDownload: downloadImage
})

layer.addEventListener('beforeinput', () => chooser.settle())
initShortcuts({
  host,
  apply: formatter.apply,
  beforeChange,
  insertDate: () => recorded(insertText)(new Intl.DateTimeFormat(language, { dateStyle: 'short' }).format(new Date()))
})
initLinks({ host, beforeChange })
bindHistoryKeys(host, history)
layer.addEventListener('input', (event) => {
  const root = host.active()
  if (!root || !root.contains(event.target)) return
  clearIfBlank(root)
  sync.markDirty()
})

document.getElementById('zoom-out').addEventListener('click', () => board.zoomBy(1 / ZOOM_STEP))
document.getElementById('zoom-in').addEventListener('click', () => board.zoomBy(ZOOM_STEP))
document.getElementById('fit').addEventListener('click', () => board.fit())

const discardImage = (img) => {
  if (!img.isConnected) return
  const item = img.closest('.item')
  if (item && item.dataset.type === 'image') board.remove([item.dataset.id])
  else removeImageBlock(host.rootOf(img), img)
  store.pendingImages.delete(img.src)
  showToast(translate('imageUnreadable'))
}

const choose = (question, options) => {
  chooser.open(translate(question), options.map((option) => ({ label: translate(option.label), run: option.run })))
}

const wireEditor = ({ insertImageInText, addImageOnBoard, addFilesOnBoard }) => {
  initMove({ host, area, marker: document.getElementById('drop-marker'), beforeChange, onMoved: () => imageSelection.clear() })
  initPaste({ host, area }, {
    insertImage: insertImageInText,
    insertText: recorded(insertText),
    insertTable: recorded(createInsertTable(host)),
    linkSelection: recorded((url) => linkSelection(host.active(), url)),
    choose,
    addFiles: (files) => addFilesOnBoard(board.center(), files),
    boardPaste: (transfer, point) => {
      const origin = point ? board.worldPoint(point) : board.center()
      const files = imageFiles(transfer)
      const others = otherFiles(transfer)
      if (others.length > 0) addFilesOnBoard(origin, others)
      if (files.length > 0) {
        files.forEach((file, index) => addImageOnBoard({ x: origin.x + index * 24, y: origin.y + index * 24 }, file))
        return
      }
      if (others.length > 0) return
      const text = transfer.getData('text/plain')
      if (isUrl(text)) board.addLink(origin, toHref(text))
      else if (text.trim() !== '') {
        board.addText(origin)
        recorded(insertText)(text)
      }
    }
  })
  initToolbar({ host, area, bar: document.getElementById('toolbar'), apply: formatter.apply, active: formatter.active, beforeChange })
  initChecklist(host, beforeChange)
}

const duplicate = async (token) => {
  const id = await duplicateShared(api, token)
  writeLast(localStorage, id)
}

document.execCommand('styleWithCSS', false, 'false')
document.execCommand('defaultParagraphSeparator', false, 'div')
document.execCommand('enableObjectResizing', false, 'false')

if (sharedPage) {
  store.auth = readAuth(localStorage)
  document.body.dataset.view = 'shared'
  document.body.dataset.mode = 'loading'
  const visitor = createVisitor({
    api,
    token: sharedToken,
    board,
    layer,
    history,
    chooser,
    translate,
    setState,
    showToast,
    onReady: (mode) => {
      document.body.dataset.mode = mode
      document.getElementById('shared-foot').hidden = false
    }
  })
  sync.markDirty = visitor.markDirty
  sync.mediaLink = async (item) => (await api.sharedFileLink(sharedToken, item.file)).url
  const refuse = () => showToast(translate('imagesOwnerOnly'))
  wireEditor({ insertImageInText: refuse, addImageOnBoard: refuse, addFilesOnBoard: refuse })
  document.getElementById('duplicate').addEventListener('click', async () => {
    try {
      if (!store.auth) throw Object.assign(new Error('sign in first'), { status: 401 })
      await duplicate(sharedToken)
      location.href = '/'
    } catch (error) {
      if (error && error.status === 401) {
        sessionStorage.setItem(duplicateKey, sharedToken)
        location.href = '/'
        return
      }
      showToast(translate(error && error.status === 404 ? 'linkGone' : 'saveFailed'))
    }
  })
  visitor.load()
} else {
  const list = initList({
    rows: document.getElementById('rows'),
    search: document.getElementById('search'),
    translate,
    language,
    onOpen: (id) => boards.open(id).catch(() => showToast(translate('loadFailed'))),
    onSearchContents: async () => {
      const result = await api.listContents()
      return new Map(result.items.map((item) => [item.id, textOfItems(parseContent(item.content), textOf)]))
    },
    onSearchFailed: () => showToast(translate('searchFailed'))
  })
  const quotaLine = document.getElementById('quota')
  const boards = createBoards({
    api,
    store,
    board,
    layer,
    list,
    history,
    chooser,
    translate,
    formatBytes,
    setState,
    onAuthLost: () => auth.signOut(),
    showToast,
    onOpened: showNote,
    onQuota: ({ used, quota }) => {
      quotaLine.textContent = translate('quotaLine').replace('{used}', formatBytes(used)).replace('{quota}', formatBytes(quota))
      quotaLine.classList.toggle('full', used >= quota)
    }
  })
  sync.markDirty = boards.markDirty
  sync.rememberCamera = boards.rememberCamera
  sync.fileInserted = (item, file) => boards.uploadFile(item.id, file)
  sync.mediaLink = async (item) => (await api.fileLink(item.file)).url
  sync.renameFile = (item, name) => api.renameFile(item.file, name)
  sync.imageInserted = async (img, file) => {
    try {
      const blobUrl = img.src
      store.pendingImages.set(blobUrl, await compressImage(file))
      boards.upload(blobUrl)
    } catch {
      discardImage(img)
    }
  }
  const signedIn = () => Boolean(store.auth) && ['note', 'list'].includes(document.body.dataset.view)

  const insertImageInText = recorded(createInsertImage(host, { onInserted: sync.imageInserted, onFailed: discardImage }))
  const addImageOnBoard = (point, file) => board.addImage(point, file)
  const addFilesOnBoard = (point, files) => {
    files.forEach((file, index) => {
      if (isBlockedName(file.name)) {
        showToast(translate('fileTypeBlocked'))
        return
      }
      if (file.size > FILE_MAX_BYTES) {
        showToast(translate('fileTooBig'))
        return
      }
      board.addFile({ x: point.x + index * 24, y: point.y + index * 72 }, file)
    })
  }
  wireEditor({ insertImageInText, addImageOnBoard, addFilesOnBoard })
  const fileInput = document.getElementById('file-input')
  fileInput.addEventListener('change', () => {
    addFilesOnBoard(board.center(), [...fileInput.files])
    fileInput.value = ''
  })

  const exportBoard = (extension, convert, type) => {
    board.stopEditing()
    const content = convert(treeOfBoard(board.elementsInReadingOrder()), location.origin)
    downloadBlob(new Blob([content], { type }), fileName(boards.title() || content.slice(0, 60), extension))
  }
  initMenu({
    button: document.getElementById('menu'),
    menu: document.getElementById('menu-panel'),
    translate,
    settings: store.settings,
    actions: [
      { label: () => translate(boards.isPinned() ? 'unpin' : 'pin'), run: () => boards.pin().catch(() => showToast(translate('saveFailed'))) },
      { label: () => translate('addFile'), run: () => fileInput.click() },
      { label: () => translate('downloadTxt'), run: () => exportBoard('txt', toText, 'text/plain') },
      { label: () => translate('downloadMd'), run: () => exportBoard('md', toMarkdown, 'text/markdown') },
      { label: () => translate('print'), run: () => window.print() },
      { label: () => translate('delete'), danger: true, run: () => boards.remove().catch(() => showToast(translate('saveFailed'))) }
    ],
    onChange: saveSettings
  })
  initShare({
    button: document.getElementById('share'),
    panel: document.getElementById('share-panel'),
    translate,
    getShare: boards.getShare,
    setShare: boards.setShare,
    showToast
  })

  const createBoardNow = () => {
    if (!signedIn()) return
    boards.create().catch(() => showToast(translate('saveFailed')))
  }
  document.getElementById('new').addEventListener('click', createBoardNow)
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.key.toLowerCase() !== 'n') return
    event.preventDefault()
    createBoardNow()
  })
  document.getElementById('back').addEventListener('click', () => {
    if (isPhone()) {
      boards.flush()
      showList()
      return
    }
    store.settings.sidebar = store.settings.sidebar === 'open' ? 'closed' : 'open'
    saveSettings()
  })
  document.getElementById('sign-out').addEventListener('click', async () => {
    await boards.flush()
    auth.signOut()
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
      loadBoards()
    },
    onSignedOut: () => {
      boards.reset()
      clearShareTarget()
      document.getElementById('me').textContent = ''
      saveState.textContent = ''
    }
  })

  const duplicatePending = async () => {
    const pending = sessionStorage.getItem(duplicateKey)
    if (!pending) return
    sessionStorage.removeItem(duplicateKey)
    try {
      await duplicate(pending)
      showToast(translate('duplicated'))
    } catch (error) {
      if (error && error.status === 401) throw error
      showToast(translate(error && error.status === 404 ? 'linkGone' : 'saveFailed'))
    }
  }

  const addShared = async (shared) => {
    try {
      const origin = board.center()
      addFilesOnBoard(origin, shared.files.filter((file) => !file.type.startsWith('image/')))
      shared.files.filter((file) => file.type.startsWith('image/')).forEach((file, index) => addImageOnBoard({ x: origin.x + index * 24, y: origin.y + index * 24 }, file))
      if (shared.text) {
        board.addText({ x: origin.x, y: origin.y + shared.files.length * 24 })
        recorded(insertText)(shared.text)
      }
    } catch {
      showToast(translate('saveFailed'))
    }
  }

  const receiveShared = async () => {
    if (location.hash !== SHARE_HASH) {
      clearShareTarget()
      return
    }
    window.history.replaceState(null, '', '/')
    const shared = await readShareTarget()
    if (!shared || (!shared.text && shared.files.length === 0)) return
    chooser.open(translate('sharedAsk'), [
      { label: translate('discard'), run: () => {} },
      { label: translate('add'), run: () => addShared(shared) }
    ])
  }

  async function loadBoards() {
    try {
      await duplicatePending()
      await boards.load()
      await receiveShared()
    } catch (error) {
      if (error && error.status === 401) {
        auth.signOut()
        return
      }
      saveState.textContent = translate('loadFailed')
      window.addEventListener('online', loadBoards, { once: true })
    }
  }

  auth.restore()
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register(serviceWorkerUrl())
