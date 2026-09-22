import { createApi } from './api.js'
import { initAuth, readAuth, writeAuth } from './auth.js'
import { createBoard, parseClipboard } from './board.js'
import { createBoards, liveShares } from './boards.js'
import { ZOOM_STEP, zoomLabel } from './camera.js'
import { createDocument } from './document.js'
import { createChooser, createPopover, createToast } from './dom.js'
import { initDrive, transferResources } from './drive.js'
import { duplicateShared } from './duplicate.js'
import { clearIfBlank, createInsertImage, insertText, removeImageBlock } from './editor.js'
import { firstBoardContent } from './examples.js'
import { toDocx } from './docx.js'
import { fileName, toHtml, toMarkdown, toText, treeOf, treeOfBoard } from './export.js'
import { FILE_ICON_PATHS } from './file-card.js'
import { initFind } from './find.js'
import { createFormatter, initChecklist } from './format.js'
import { initHelp } from './help.js'
import { bindHistoryKeys, createHistory } from './history.js'
import { applyTranslations, countOf, createTranslator, pickLanguage } from './i18n.js'
import { compressImage, copyImage, downloadBlob, fileExtension } from './images.js'
import { FILE_MAX_BYTES, REFERENCE_TYPES, TEXT_COLORS, formatSize, isBlockedName, parseContent, previewable } from './items.js'
import { createLightbox } from './lightbox.js'
import { initLinks, isUrl, linkSelection, toHref } from './links.js'
import { parseDate, relativeTime } from './list.js'
import { initMenu } from './menu.js'
import { initMove } from './move.js'
import { initPanel } from './panel.js'
import { imageFiles, initPaste, otherFiles } from './paste.js'
import { createFolderPicker } from './picker.js'
import { createPreview } from './preview.js'
import { forget, readRecent, renameIn, touch, writeRecent } from './recent.js'
import { initResize } from './resize.js'
import { createResources, labelOf, readCachedListing, readLast, writeCachedListing, writeLast } from './resources.js'
import { parsePath, pathFor } from './router.js'
import { render, serviceWorkerUrl, textOf } from './sanitize.js'
import { buildIndex, initSearch } from './search.js'
import { applySettings, readSettings, writeSettings } from './settings.js'
import { SHARE_HASH, clearShareTarget, readShareTarget } from './share-target.js'
import { initShare, matchesTarget, parseShareItems, shareTarget, shareUrl, tokenFromHash } from './share.js'
import { createSharedList } from './shared-list.js'
import { initShortcuts } from './shortcuts.js'
import { initSlash } from './slash.js'
import { migrateStorage, store } from './store.js'
import { createInsertTable } from './table.js'
import { STYLE_COMMANDS, styleEntries } from './textstyle.js'
import { initToolbar } from './toolbar.js'
import { createQuotaAlerts, createUploads, initFolderDrop } from './uploads.js'
import { createVisitor } from './visitor.js'
import { buildZip, uniqueName } from './zip.js'

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
const setState = (state) => { saveState.textContent = state ? translate(state) : '' }
const sync = {
  markDirty: () => {},
  rememberCamera: () => {},
  imageInserted: () => {},
  fileInserted: () => {},
  fileCopy: () => {},
  shareItems: () => {},
  boardId: () => '',
  mediaLink: () => Promise.reject(new Error('no link')),
  fileBlob: () => Promise.reject(new Error('no file')),
  renameFile: () => Promise.reject(new Error('no rename')),
  openItem: () => {},
  contextMenu: () => {},
  pickImage: () => {},
  closeDoc: () => docEditor.close(),
  docClosed: () => {},
  selectionChanged: () => {},
  metaOf: () => ''
}
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

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showToast(translate('copied'))
  } catch {
    showToast(translate('copyFailed'))
  }
}

const closeIfStillBlank = (tab) => {
  try {
    if (tab.location.href === 'about:blank') tab.close()
  } catch {
    return
  }
}

const openInTab = async (resolveUrl) => {
  const tab = window.open('about:blank', '_blank')
  try {
    const url = await resolveUrl()
    if (tab) {
      tab.opener = null
      tab.location.href = url
      setTimeout(() => closeIfStillBlank(tab), 4000)
    } else window.open(url, '_blank', 'noopener')
  } catch {
    if (tab) tab.close()
    showToast(translate('downloadFailed'))
  }
}

const beforeChange = () => {
  activeHistory().capture()
  sync.markDirty()
}
const recorded = (action) => (...args) => {
  beforeChange()
  return action(...args)
}

const downloadFile = async (file) => {
  try {
    const url = await sync.mediaLink({ file: file.id })
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
  } catch {
    showToast(translate('downloadFailed'))
  }
}

const fileOf = (item) => ({ id: item.file, name: item.name, kind: item.kind, size: item.size })

const whenOf = (value) => {
  const date = parseDate(value)
  return `${new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)} (${relativeTime(date.getTime(), Date.now(), translate, language)})`
}

const showDetails = (target, anchor) => {
  const lines = [{ label: translate('nameLabel'), text: target.name }]
  const kindText = target.kind === 'file' ? (target.fileKind === 'generic' ? translate('kindFile') : target.fileKind) : target.kind === 'image' ? translate('asImage') : translate(target.kind === 'doc' ? 'kindDoc' : 'kindFolder')
  lines.push({ label: translate('typeLabel'), text: kindText })
  if (target.kind === 'file') lines.push({ label: translate('sizeLabel'), text: formatBytes(target.size) })
  if (target.location) lines.push({ label: translate('locationLabel'), text: target.location })
  if (target.created) lines.push({ label: translate('createdLabel'), text: whenOf(target.created) })
  if (target.updated) lines.push({ label: translate('modifiedLabel'), text: whenOf(target.updated) })
  if (target.dimensions) lines.push({ label: translate('dimensionsLabel'), text: target.dimensions })
  if (target.cards !== undefined) lines.push({ label: translate('onBoardLabel'), text: target.cards > 0 ? `${translate('yes')} (${countOf(translate, 'cards', target.cards)})` : translate('no') })
  if (target.links !== undefined) lines.push({ label: translate('linksLabel'), text: countOf(translate, 'active', target.links) })
  const actions = []
  if (target.manage) actions.push({ label: translate('manage'), run: target.manage })
  if (target.kind === 'file') actions.push({ label: translate('download'), run: () => downloadFile({ id: target.id, name: target.name }) })
  itemMenu.open(actions.length > 0 ? [...lines, { separator: true }, ...actions] : lines, anchor)
}

const openFile = async (file, anchor) => {
  if (file.kind === 'image') {
    try {
      const blob = await sync.fileBlob(file.id)
      openLightbox(URL.createObjectURL(blob), () => downloadBlob(blob, file.name))
    } catch {
      showToast(translate('downloadFailed'))
    }
    return
  }
  if (previewable(file.kind)) {
    openInTab(() => sync.mediaLink({ file: file.id }))
    return
  }
  showDetails({ kind: 'file', id: file.id, name: file.name, fileKind: file.kind, size: file.size, updated: file.updated, location: file.location }, anchor || { x: window.innerWidth / 2 - 100, y: window.innerHeight / 3 })
}

const board = createBoard({
  area,
  layer,
  lasso: document.getElementById('lasso'),
  guides: { x: document.getElementById('guide-x'), y: document.getElementById('guide-y') },
  message: document.getElementById('board-message'),
  translate,
  language,
  boardId: () => sync.boardId(),
  metaOf: (item) => sync.metaOf(item),
  onSelection: () => sync.selectionChanged(),
  onTool: (tool) => {
    for (const button of toolButtons) button.setAttribute('aria-pressed', String(button.dataset.tool === tool))
  },
  onChange: () => sync.markDirty(),
  beforeChange,
  onCamera: (camera) => {
    zoomLevel.textContent = zoomLabel(camera.zoom)
    sync.rememberCamera(camera)
  },
  onOpenImage: (img) => openLightbox(img.src, () => downloadImage(img)),
  onOpenItem: (item) => sync.openItem(item),
  onItemMenu: (id, anchor) => sync.contextMenu({ kind: 'items', ids: board.selected().includes(id) ? board.selected() : [id], item: board.itemOf(id), point: anchor.getBoundingClientRect() }),
  onContextMenu: (request) => sync.contextMenu(request),
  onImageInserted: (img, file) => sync.imageInserted(img, file),
  onFileInserted: (item, file) => sync.fileInserted(item, file),
  onFileCopy: (item, source) => sync.fileCopy(item, source),
  onMediaLink: (item) => sync.mediaLink(item),
  onRenameFile: (item, name) => sync.renameFile(item, name)
})
const toolButtons = [...document.querySelectorAll('#tools button')]
for (const button of toolButtons) button.addEventListener('click', () => board.setTool(button.dataset.tool))
const host = board.host
const formatter = createFormatter(host)
const history = createHistory({ snapshot: board.snapshot, restore: (entry) => { imageSelection.clear(); board.restore(entry) } })
const docEditor = createDocument({
  section: document.getElementById('doc'),
  nameField: document.getElementById('doc-name'),
  note: document.getElementById('doc-note'),
  host,
  translate,
  setState,
  showToast,
  chooser,
  onNameChanged: (doc) => sync.docRenamed(doc),
  onClosed: () => {
    if (store.board) setState(store.dirty ? 'saving' : 'saved')
    sync.docClosed()
  }
})
const activeHistory = () => (docEditor.isOpen() ? docEditor.history : history)
document.getElementById('doc-close').addEventListener('click', () => sync.closeDoc())
const find = initFind({
  bar: document.getElementById('find'),
  input: document.getElementById('find-input'),
  count: document.getElementById('find-count'),
  board,
  translate,
  isActive: () => !docEditor.isOpen()
})

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

area.addEventListener('beforeinput', () => chooser.settle())
initShortcuts({
  host,
  apply: formatter.apply,
  beforeChange,
  insertDate: () => recorded(insertText)(new Intl.DateTimeFormat(language, { dateStyle: 'short' }).format(new Date()))
})
initLinks({ host, beforeChange })
initSlash({ host, menu: document.getElementById('slash-menu'), translate, apply: formatter.apply, beforeChange, pickImage: () => sync.pickImage() })
bindHistoryKeys(host, {
  undo: () => activeHistory().undo(),
  redo: () => activeHistory().redo(),
  captureTyping: (type) => activeHistory().captureTyping(type)
})
area.addEventListener('input', (event) => {
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

const wireEditor = ({ insertImageInText, addImageOnBoard, addFilesOnBoard, addResourcesOnBoard }) => {
  const pasteOnBoard = ({ images, others, text }, origin) => {
    if (others.length > 0) addFilesOnBoard(origin, others)
    if (images.length > 0) {
      images.forEach((file, index) => addImageOnBoard({ x: origin.x + index * 24, y: origin.y + index * 24 }, file))
      return
    }
    if (others.length > 0) return
    const resources = transferResources({ getData: () => text })
    if (resources) {
      addResourcesOnBoard(origin, resources)
      return
    }
    const copied = parseClipboard(text)
    if (copied) board.pasteItems(copied, origin)
    else if (isUrl(text)) board.addLink(origin, toHref(text))
    else if (text.trim() !== '') {
      board.addText(origin)
      recorded(insertText)(text)
    }
  }
  initMove({ host, area, marker: document.getElementById('drop-marker'), beforeChange, onMoved: () => imageSelection.clear() })
  initPaste({ host, area }, {
    insertImage: insertImageInText,
    insertText: recorded(insertText),
    insertTable: recorded(createInsertTable(host)),
    linkSelection: recorded((url) => linkSelection(host.active(), url)),
    choose,
    addFiles: (files) => addFilesOnBoard(board.center(), files),
    boardPaste: (transfer, point) => {
      if (!store.board) return
      pasteOnBoard({ images: imageFiles(transfer), others: otherFiles(transfer), text: transfer.getData('text/plain') }, point ? board.worldPoint(point) : board.center())
    }
  })
  initToolbar({ host, area, bar: document.getElementById('toolbar'), apply: (name) => (STYLE_COMMANDS[name] ? board.styleCommand(name) : formatter.apply(name)), active: formatter.active, beforeChange })
  initChecklist(host, beforeChange)
  return pasteOnBoard
}

const readClipboard = async () => {
  const entries = await navigator.clipboard.read()
  const images = []
  let text = ''
  for (const entry of entries) {
    const imageType = entry.types.find((type) => type.startsWith('image/'))
    if (imageType) images.push(new File([await entry.getType(imageType)], `image.${fileExtension(imageType)}`, { type: imageType }))
    else if (entry.types.includes('text/plain')) text = await (await entry.getType('text/plain')).text()
  }
  return { images, others: [], text }
}

const duplicate = async (token) => {
  const id = await duplicateShared(api, token)
  writeLast(localStorage, id)
}

const uploadError = (error) => {
  if (error && error.status === 415) return translate('fileTypeBlocked')
  if (error && error.status === 413) {
    const data = error.data || {}
    return translate('storageFull').replace('{used}', formatBytes(data.used || 0)).replace('{quota}', formatBytes(data.quota || 0))
  }
  return translate('fileUploadFailed')
}

const FORMATS = [['md', 'downloadMd'], ['html', 'downloadHtml'], ['docx', 'downloadDocx'], ['txt', 'downloadTxt']]
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const LOADING_DELAY = 300

const exportAs = (format, tree, title) => {
  const origin = location.origin
  const name = title || translate('untitled')
  if (format === 'html') downloadBlob(new Blob([toHtml(tree, origin, name, language)], { type: 'text/html' }), fileName(name, 'html'))
  else if (format === 'docx') downloadBlob(new Blob([toDocx(tree)], { type: DOCX_TYPE }), fileName(name, 'docx'))
  else if (format === 'md') downloadBlob(new Blob([toMarkdown(tree, origin)], { type: 'text/markdown' }), fileName(name, 'md'))
  else downloadBlob(new Blob([toText(tree, origin)], { type: 'text/plain' }), fileName(name, 'txt'))
}

const exportMenu = (treeOfTarget, titleOfTarget, print) => [
  ...FORMATS.map(([format, key]) => ({ label: translate(key), run: () => exportAs(format, treeOfTarget(), titleOfTarget()) })),
  { separator: true },
  { label: translate('printPdf'), run: print }
]

const textExportMenu = (id, point) => {
  const note = () => board.elementOf(id).querySelector('.note')
  const tree = () => ({ tag: 'div', attrs: {}, children: treeOf(note()).children })
  const title = () => note().textContent.trim().split('\n')[0].slice(0, 60)
  return exportMenu(tree, title, () => {
    board.stopEditing()
    board.printOnly([id])
  })
}

const removeKeyOf = (ids) => {
  const types = ids.map(board.itemOf).filter(Boolean).map((item) => item.type)
  const cards = types.filter((type) => REFERENCE_TYPES.includes(type)).length
  if (cards === 0) return 'delete'
  return cards === types.length ? 'removeFromBoard' : 'removeSelection'
}

const trashKeyOf = (type) => ({ file: 'deleteFileToo', doc: 'deleteDocToo', folder: 'deleteFolderToo' })[type]

const canvasMenu = (ids, item, point, { owner }) => {
  const single = ids.length === 1 ? item : null
  const front = { label: translate('bringToFront'), run: () => board.bringToFront(ids) }
  const back = { label: translate('sendToBack'), run: () => board.sendToBack(ids) }
  const duplicateAction = { label: translate('duplicate'), hint: 'Ctrl D', run: () => board.duplicate(ids) }
  const removeKey = removeKeyOf(ids)
  const removeAction = { label: translate(removeKey), danger: removeKey === 'delete', hint: 'Del', run: () => board.remove(ids) }
  const pasteStyleAction = board.hasCopiedStyle() && board.textIds(ids).length > 0 ? [{ label: translate('pasteStyle'), hint: 'Ctrl Alt V', run: () => board.pasteStyle(ids) }] : []
  if (!single) return [{ label: translate('frameSelection'), run: () => board.frameSelection(ids) }, duplicateAction, ...pasteStyleAction, front, back, { separator: true }, removeAction]
  const actions = []
  if (single.type === 'frame') {
    actions.push({ label: translate('rename'), hint: 'Enter', run: () => board.renameFile(single.id) })
    if (owner) actions.push({ label: translate('shareFrame'), run: () => sync.shareItems([single.id]) })
    actions.push(duplicateAction, { separator: true }, { label: translate('delete'), hint: 'Del', danger: true, run: () => board.remove(ids) })
    return actions
  }
  if (single.type === 'text') {
    actions.push(
      { label: translate('edit'), hint: 'Enter', run: () => board.startEditing(single.id) },
      duplicateAction,
      { label: translate('copyItems'), run: () => copyText(board.clipboardText(ids)) },
      { label: translate('export'), run: () => itemMenu.open(textExportMenu(single.id, point), point) },
      { swatches: ['', ...TEXT_COLORS], current: single.color || '', labelOf: (value) => translate(value ? `noteColor_${value}` : 'noteColorNone'), pick: (value) => board.setColor(ids, value) },
      ...styleEntries(board.styleOf(single.id), translate, (patch) => board.setStyle(ids, patch)),
      { label: translate('copyStyle'), hint: 'Ctrl Alt C', run: () => board.copyStyle(single.id) },
      ...pasteStyleAction,
      front, back, { separator: true }, removeAction
    )
    return actions
  }
  if (single.type === 'image') {
    const img = board.elementOf(single.id).querySelector('img')
    actions.push(
      { label: translate('open'), run: () => openLightbox(img.src, () => downloadImage(img)) },
      { label: translate('download'), run: () => downloadImage(img) }
    )
    if (owner && single.file) actions.push({ label: translate('showAsCard'), run: () => owner.imageToCard(single) })
    else if (owner) actions.push({ label: translate('saveToDrive'), run: () => owner.imageToFile(single) })
    actions.push(
      { label: translate('details'), run: () => showDetails({ kind: 'image', name: single.name || translate('asImage'), dimensions: `${img.naturalWidth} × ${img.naturalHeight}`, location: owner ? owner.folderPath() : '' }, point) },
      duplicateAction, front, back, { separator: true }, removeAction
    )
    return actions
  }
  if (single.type === 'link') {
    actions.push(
      { label: translate('openLink'), run: () => window.open(single.url, '_blank', 'noopener') },
      { label: translate('copyUrl'), run: () => copyText(single.url) },
      duplicateAction, front, back, { separator: true }, removeAction
    )
    return actions
  }
  if (single.type === 'file') {
    actions.push({ label: translate('open'), run: () => openFile(fileOf(single), point) })
    if (single.file) actions.push({ label: translate('download'), run: () => downloadFile(fileOf(single)) })
    if (owner && single.file) {
      actions.push({ label: translate('rename'), run: () => board.renameFile(single.id) })
      if (single.kind === 'image') actions.push({ label: translate('showAsImage'), run: () => owner.fileToImage(single) })
      actions.push(
        { label: translate('moveTo'), run: () => owner.moveWithPicker([owner.refOf(single)]) },
        duplicateAction,
        { label: translate('shareFile'), run: () => sync.shareItems([single.id]) },
        { label: translate('copyLink'), run: () => owner.copyLinkFor(owner.refOf(single)) },
        { label: translate('details'), run: () => owner.showEntryDetails(owner.refOf(single), point) }
      )
    }
    actions.push(front, back, { separator: true }, removeAction)
    if (owner && single.file) actions.push({ label: translate(trashKeyOf(single.type)), danger: true, run: () => owner.removeEntries([owner.refOf(single)]) })
    return actions
  }
  if (!owner) return [removeAction]
  actions.push({ label: translate('open'), run: () => sync.openItem(single) })
  actions.push({ label: translate('rename'), run: () => board.renameFile(single.id) })
  actions.push({ label: translate('moveTo'), run: () => owner.moveWithPicker([owner.refOf(single)]) })
  if (single.type === 'doc') actions.push(duplicateAction)
  actions.push(
    { label: translate('share'), run: () => sync.shareItems([single.id]) },
    { label: translate('copyLink'), run: () => owner.copyLinkFor(owner.refOf(single)) }
  )
  actions.push({ label: translate('details'), run: () => owner.showEntryDetails(owner.refOf(single), point) })
  actions.push(front, back, { separator: true }, removeAction, { label: translate(trashKeyOf(single.type)), danger: true, run: () => owner.removeEntries([owner.refOf(single)]) })
  return actions
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
    onReady: (mode, payload) => {
      document.body.dataset.mode = mode === 'doc' ? payload.mode : mode
      document.getElementById('shared-foot').hidden = false
      if (mode === 'view' || mode === 'edit') sharedList.set(payload)
      if (mode === 'doc') {
        docEditor.open({
          id: '',
          name: payload.title,
          content: payload.content,
          revision: payload.revision,
          editable: payload.mode === 'edit',
          rename: null,
          save: (content, revision) => api.saveShared(sharedToken, content, revision),
          reload: () => api.getShared(sharedToken)
        })
        return
      }
      if (mode !== 'download') return
      const page = document.getElementById('download-page')
      page.querySelector('path').setAttribute('d', FILE_ICON_PATHS[payload.kind] || FILE_ICON_PATHS.generic)
      document.getElementById('download-ext').textContent = payload.name.split('.').pop().toUpperCase().slice(0, 4)
      document.getElementById('download-name').textContent = payload.name
      document.getElementById('download-size').textContent = formatBytes(payload.size)
      document.getElementById('download-button').addEventListener('click', () => downloadFile({ id: payload.file || payload.id, name: payload.name }))
      page.hidden = false
    }
  })
  const openSharedDoc = async (entry) => {
    try {
      const doc = await api.sharedDoc(sharedToken, entry.id)
      await docEditor.open({ id: doc.id, name: doc.name, content: doc.content, revision: '', editable: false, rename: null, save: null, reload: null })
    } catch {
      showToast(translate('linkGone'))
    }
  }
  const sharedList = createSharedList({
    button: document.getElementById('shared-files'),
    panel: document.getElementById('shared-list'),
    translate,
    language,
    onOpen: (entry) => {
      if (entry.kind === 'doc') openSharedDoc(entry)
      else openFile({ id: entry.id, name: entry.name, kind: entry.fileKind, size: entry.size })
    }
  })
  sync.markDirty = () => (docEditor.isOpen() ? docEditor.markDirty() : visitor.markDirty())
  sync.mediaLink = async (item) => (await api.sharedFileLink(sharedToken, item.file)).url
  sync.fileBlob = (id) => api.downloadShared(sharedToken, id)
  sync.openItem = (item) => {
    if (item.type === 'file') openFile(fileOf(item))
    else showToast(translate('notShared'))
  }
  sync.contextMenu = (request) => {
    if (request.kind === 'items') itemMenu.open(canvasMenu(request.ids, request.item, request.point, { owner: null }), request.point)
    else if (request.kind === 'board') {
      itemMenu.open([
        { label: translate('addText'), run: () => board.addText(request.world) },
        { label: translate('addNote'), run: () => board.addText(request.world, '', 'hl1') },
        { label: translate('addFrame'), run: () => board.addFrame({ ...request.world, ...board.frameSize }) },
        { label: translate('selectAll'), run: () => board.select(board.items().map((item) => item.id)) }
      ], request.point)
    }
  }
  const refuse = () => showToast(translate('imagesOwnerOnly'))
  sync.pickImage = refuse
  wireEditor({ insertImageInText: refuse, addImageOnBoard: refuse, addFilesOnBoard: refuse, addResourcesOnBoard: refuse })
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
  const resources = createResources({ api, translate, showToast })
  const picker = createFolderPicker({ element: document.getElementById('picker'), resources, translate })
  const rowsElement = document.getElementById('rows')
  const preview = createPreview({
    element: document.getElementById('preview'),
    translate,
    formatBytes,
    mediaLink: (item) => sync.mediaLink(item),
    fileBlob: (id) => sync.fileBlob(id),
    siblings: () => [...rowsElement.querySelectorAll('.row[data-kind=file]')].map((row) => drive.entry(row.dataset.id)).filter(Boolean),
    download: (entry) => downloadFile({ id: entry.id, name: entry.name }),
    openInTab: (entry) => openInTab(() => sync.mediaLink({ file: entry.id }))
  })
  const quotaLine = document.getElementById('quota')
  const quotaFill = document.getElementById('quota-fill')
  const quotaAlerts = createQuotaAlerts((level, used, quota) => showToast(level === 'full' ? translate('storageFullWarn') : translate('storageWarn').replace('{used}', formatBytes(used)).replace('{quota}', formatBytes(quota))))
  const fileInput = document.getElementById('file-input')
  const imageInput = document.getElementById('image-input')
  const addMenu = createPopover(document.getElementById('add-menu'))
  const newMenu = createPopover(document.getElementById('new-menu'))
  const newButton = document.getElementById('new')
  const uploadButton = document.getElementById('upload')
  const paneTitle = document.getElementById('pane-title')
  const tips = document.getElementById('tips')
  const folderView = document.getElementById('folder-view')
  const sideView = document.getElementById('side-view')
  const boardLine = document.getElementById('board-line')
  const boardSummary = document.getElementById('board-summary')
  const avatar = document.getElementById('avatar')
  const rail = { folder: document.getElementById('rail-drive'), recent: document.getElementById('rail-recent'), trash: document.getElementById('rail-trash') }
  const selectButtons = { share: document.getElementById('select-share'), move: document.getElementById('select-move'), download: document.getElementById('select-download'), remove: document.getElementById('select-delete') }
  let folderId = ''
  let uploadTarget = 'board'
  let imageTarget = 'board'
  let dropPoint = null
  let lastHint = null
  let panelView = 'folder'
  let recents = readRecent(localStorage)

  const createLoadingBar = (bar) => {
    let pending = 0
    let timer = 0
    const settle = () => {
      if (--pending > 0) return
      clearTimeout(timer)
      bar.hidden = true
    }
    return (promise) => {
      if (pending++ === 0) timer = setTimeout(() => { bar.hidden = false }, LOADING_DELAY)
      return promise.finally(settle)
    }
  }
  const whileLoading = createLoadingBar(document.getElementById('loading-bar'))
  const whileBoardLoading = createLoadingBar(document.getElementById('board-loading'))

  const setPath = (path, replace) => {
    if (location.pathname === path) return
    window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
  }
  const currentPath = () => (docEditor.isOpen() ? pathFor('doc', docEditor.current().id) : pathFor('folder', folderId))
  const routeOf = () => parsePath(location.pathname) || { kind: 'root', id: '' }

  const folderEntry = () => {
    const listing = drive.listing()
    return listing && listing.folder ? listing.folder : null
  }
  const folderLabel = () => {
    const folder = folderEntry()
    return folder ? labelOf(folder) || translate('untitled') : translate('myDrive')
  }
  const folderPath = () => {
    const listing = drive.listing()
    return [translate('myDrive'), ...(listing ? listing.path : []).map((folder) => labelOf(folder) || translate('untitled'))].join(' / ')
  }
  const refOf = (item) => ({ kind: item.type, id: item[item.type], name: item.name, size: item.size, fileKind: item.kind })
  const timeAgo = (value) => relativeTime(parseDate(value).getTime(), Date.now(), translate, language)

  const rememberRecent = (entry, folder = folderId, folderName = folderLabel()) => {
    recents = touch(recents, { kind: entry.kind, id: entry.id, name: entry.name, fileKind: entry.fileKind, folder, folderName }, Date.now())
    writeRecent(localStorage, recents)
  }
  const forgetRecent = (kind, id) => {
    recents = forget(recents, kind, id)
    writeRecent(localStorage, recents)
  }

  const showPanel = (view) => {
    panelView = view
    folderView.hidden = view !== 'folder'
    sideView.hidden = view === 'folder'
    for (const [name, button] of Object.entries(rail)) button.setAttribute('aria-current', String(name === view))
    if (view === 'recent') renderRecent()
    if (view === 'trash') renderTrash()
    if (isPhone()) showList()
  }

  const setPaneTitle = (template, name) => {
    paneTitle.replaceChildren()
    if (!template) return
    const caption = document.createElement('span')
    caption.textContent = template.split('{name}')[0]
    const named = document.createElement('span')
    named.className = 'pane-name'
    named.textContent = name
    paneTitle.append(caption, named)
  }

  const updateTitle = () => {
    const doc = docEditor.isOpen() ? docEditor.current() : null
    if (doc) setPaneTitle(translate('docNamed'), doc.name || translate('untitled'))
    else setPaneTitle(folderId ? translate('boardOfFolderNamed') : '', folderLabel())
    uploadButton.disabled = !folderId
    if (folderId) delete document.body.dataset.root
    else document.body.dataset.root = ''
    updateLinked()
  }

  const updateLinked = () => {
    const doc = docEditor.isOpen() ? docEditor.current() : null
    const ids = board.selected().map(board.itemOf).filter((item) => item && REFERENCE_TYPES.includes(item.type)).map((item) => item[item.type])
    if (doc && doc.id) ids.push(doc.id)
    drive.setLinked(ids)
  }

  const showTips = () => {
    tips.hidden = store.settings.tips === 'shown'
  }
  const dismissTips = () => {
    if (tips.hidden) return
    tips.hidden = true
    store.settings.tips = 'shown'
    saveSettings()
  }
  document.getElementById('tips-done').addEventListener('click', dismissTips)
  area.addEventListener('pointerdown', (event) => { if (!tips.contains(event.target)) dismissTips() })
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') dismissTips() })

  const updateHints = () => {
    const hint = folderId && store.board && board.items().length === 0 ? translate('boardHints') : folderId ? '' : translate('rootHint')
    if (hint === lastHint) return
    lastHint = hint
    board.setMessage(hint)
  }

  const updateBoardLine = () => {
    const items = store.board && folderId ? board.items() : []
    const parts = [['text', 'texts'], ['image', 'images'], ['link', 'links'], ['frame', 'frames']].map(([type, key]) => [items.filter((item) => item.type === type).length, key]).filter(([count]) => count > 0).map(([count, key]) => countOf(translate, key, count))
    boardLine.hidden = parts.length === 0
    boardSummary.textContent = parts.length > 0 ? translate('onBoard').replace('{list}', parts.join(' · ')) : ''
  }

  const refreshFolder = async (id = folderId) => {
    try {
      const listing = await whileLoading(resources.listing(id, { fresh: true }))
      if (id !== folderId) return
      drive.set(listing)
      board.refreshCards()
      updateTitle()
      writeCachedListing(localStorage, id, listing)
    } catch {
      return
    }
  }

  const openFolder = async (id, replace) => {
    find.close()
    await docEditor.close()
    let listing
    try {
      listing = await whileLoading(resources.listing(id))
    } catch (error) {
      if (error && error.status === 404 && id) {
        showToast(translate('loadFailed'))
        forgetRecent('folder', id)
        return openFolder('', replace)
      }
      throw error
    }
    folderId = id
    drive.set(listing)
    writeLast(localStorage, id)
    writeCachedListing(localStorage, id, listing)
    setPath(pathFor('folder', id), replace)
    if (listing.folder) rememberRecent({ kind: 'folder', id, name: labelOf(listing.folder) || translate('untitled') }, listing.folder.parent, listing.path.length > 1 ? listing.path[listing.path.length - 2].name || listing.path[listing.path.length - 2].title : translate('myDrive'))
    updateTitle()
    if (id) await whileBoardLoading(boards.open(id))
    else await boards.close()
    lastHint = null
    updateHints()
    updateBoardLine()
  }

  const openDoc = async (id, replace) => {
    find.close()
    const doc = await whileLoading(api.getDoc(id))
    if (doc.board !== folderId) await openFolder(doc.board, replace)
    await docEditor.open({
      id,
      name: doc.name,
      content: doc.content,
      revision: doc.revision,
      editable: true,
      save: (content, revision) => api.saveDoc(id, content, revision),
      reload: () => api.getDoc(id),
      rename: (name) => api.updateDoc(id, { name })
    })
    setPath(pathFor('doc', id), replace)
    rememberRecent({ kind: 'doc', id, name: doc.name })
    updateTitle()
    showNote()
  }

  const followRoute = (route) => (route.kind === 'doc' ? openDoc(route.id, true) : openFolder(route.id, true)).catch((error) => {
    if (!(error && error.status === 404)) throw error
    showToast(translate('loadFailed'))
    return openFolder('', true)
  })

  const focusCardOf = (entry) => {
    const placed = board.referenceIds(entry.kind, entry.id)
    if (placed.length > 0) board.focusItem(placed[0])
  }

  const openEntry = async (entry) => {
    try {
      if (entry.kind === 'folder') await openFolder(entry.id)
      else if (entry.kind === 'doc') await openDoc(entry.id)
      else {
        rememberRecent(entry)
        focusCardOf(entry)
        await openFile({ id: entry.id, name: entry.name, kind: entry.fileKind, size: entry.size, updated: entry.updated, location: folderPath() })
      }
    } catch (error) {
      if (error && error.status === 404) forgetRecent(entry.kind, entry.id)
      showToast(translate('loadFailed'))
    }
  }

  const renameEntry = async (entry, name, { undoable = true } = {}) => {
    try {
      await resources.rename(entry, folderId, name)
      board.renameReferences(entry.kind, entry.id, name)
      if (board.referenceIds(entry.kind, entry.id).length > 0) boards.markDirty()
      recents = renameIn(recents, entry.kind, entry.id, name)
      writeRecent(localStorage, recents)
      await refreshFolder()
      if (undoable) showToast(translate('renamedTo').replace('{name}', name), { label: translate('undo'), run: () => renameEntry({ ...entry, name }, entry.name, { undoable: false }) })
    } catch {
      showToast(translate('saveFailed'))
      await refreshFolder()
    }
  }

  const cardsOf = (entries) => entries.flatMap((entry) => {
    const known = drive.entry(entry.id)
    return board.referenceIds(entry.kind, entry.id).map(board.itemOf).map((item) => ({ ...item, pic: (known && known.pic) || entry.pic || '' }))
  })

  const restoreCards = (cards) => {
    for (const card of cards) {
      if (card.type === 'image') board.addPicture({ x: card.x, y: card.y }, { id: card.file, name: card.name, size: card.size, pic: card.pic })
      else board.addReference({ x: card.x, y: card.y }, card.type, card[card.type], card.name, card.type === 'file' ? { size: card.size, kind: card.kind } : {})
    }
  }

  const moveEntries = async (entries, from, target, { undoable = true } = {}) => {
    const cards = from === folderId ? cardsOf(entries) : []
    const moved = []
    try {
      for (const entry of entries) {
        await resources.move(entry, from, target)
        moved.push(entry)
        if (from === folderId && entry.kind !== 'folder') board.remove(board.referenceIds(entry.kind, entry.id))
      }
      showToast(translate('moved'), undoable ? { label: translate('undo'), run: async () => {
        await moveEntries(moved, target, from, { undoable: false })
        if (folderId === from) restoreCards(cards)
      } } : undefined)
    } catch {
      showToast(translate('saveFailed'))
    }
    resources.invalidate(from, target, folderId)
    await refreshFolder()
  }

  const moveWithPicker = async (entries) => {
    const target = await picker.pick(folderId, entries.filter((entry) => entry.kind === 'folder').map((entry) => entry.id))
    if (target === null || target === folderId) return
    await moveEntries(entries, folderId, target)
  }

  const confirmTrash = (question) => new Promise((resolve) => {
    chooser.open(question, [
      { label: translate('cancel'), run: () => resolve(false) },
      { label: translate('deleteAnyway'), run: () => resolve(true) }
    ], { onDismiss: () => resolve(false) })
  })

  const onBoardQuestion = (entries) => {
    const placed = entries.filter((entry) => board.referenceIds(entry.kind, entry.id).length > 0)
    if (placed.length === 0) return null
    if (placed.length === 1) return translate('deleteOnBoardAsk').replace('{name}', placed[0].name)
    return translate('deleteManyOnBoardAsk').replace('{n}', String(placed.length))
  }

  const removeEntries = async (entries, { ask = true } = {}) => {
    const question = ask ? onBoardQuestion(entries) : null
    if (question && !(await confirmTrash(question))) return
    const cards = cardsOf(entries)
    for (const entry of entries) {
      if (docEditor.isOpen() && docEditor.current().id === entry.id) {
        await docEditor.close()
        setPath(pathFor('folder', folderId), true)
      }
    }
    drive.remove(entries.map((entry) => entry.id))
    if (cards.length > 0) board.remove(cards.map((card) => card.id))
    const done = await resources.remove(entries, folderId, {
      onUndo: () => {
        restoreCards(cards)
        refreshFolder()
      }
    })
    for (const entry of done) forgetRecent(entry.kind, entry.id)
    if (done.length < entries.length) await refreshFolder()
    boards.refreshQuota()
  }

  const uploads = createUploads({
    element: document.getElementById('uploads'),
    translate,
    formatBytes,
    onSettled: (target) => {
      resources.invalidate(target)
      refreshFolder()
      boards.refreshQuota()
    }
  })

  const acceptsUpload = (file) => {
    if (isBlockedName(file.name)) showToast(translate('fileTypeBlocked'))
    else if (file.size > FILE_MAX_BYTES) showToast(translate('fileTooBig'))
    else return true
    return false
  }

  const uploadInto = (target, files) => {
    uploads.add(files.filter(acceptsUpload), target, async (file, onProgress, signal) => {
      try {
        const record = await resources.upload(target, file, onProgress, signal)
        if (target === folderId) rememberRecent({ kind: 'file', id: record.id, name: record.name, fileKind: record.kind })
        return record
      } catch (error) {
        if (!signal.aborted) showToast(uploadError(error))
        throw error
      }
    })
  }

  const shareFor = async (target) => {
    const boardId = target.kind === 'folder' ? target.id : folderId
    const shape = { kind: target.kind, ids: [], doc: target.kind === 'doc' ? target.id : '', file: target.kind === 'file' ? target.id : '' }
    if (boardId === folderId && store.board) {
      const existing = boards.getShares().find((share) => matchesTarget(share, shape))
      return existing || boards.createShare(shape, 'view', '')
    }
    const shares = (await api.listShares(boardId)).items
    const existing = shares.find((share) => matchesTarget(share, shape) && (!share.expires || parseDate(share.expires).getTime() > Date.now()))
    return existing || api.createShare({ board: boardId, mode: 'view', doc: shape.doc, file: shape.file })
  }

  const copyLinkFor = async (target) => {
    try {
      const share = await shareFor(target)
      await navigator.clipboard.writeText(shareUrl(location.origin, share.token))
      showToast(translate('linkCopied'))
    } catch {
      showToast(translate('copyFailed'))
    }
  }

  const shareEntry = async (entry) => {
    if (entry.kind === 'folder') {
      await openFolder(entry.id)
      share.open(null)
      return
    }
    share.open({ kind: entry.kind, ids: [], [entry.kind]: entry.id, name: entry.name })
  }

  const linksOf = async (entry) => {
    if (entry.kind !== 'folder') return boards.getShares().filter((share) => matchesTarget(share, { kind: entry.kind, ids: [], [entry.kind]: entry.id })).length
    return liveShares((await api.listShares(entry.id)).items).filter((share) => !share.doc && !share.file && parseShareItems(share.items).length === 0).length
  }

  const showEntryDetails = async (entry, point) => {
    const known = drive.entry(entry.id) || entry
    const links = await linksOf(known).catch(() => undefined)
    showDetails({ ...known, location: folderPath(), cards: board.referenceIds(known.kind, known.id).length, links, manage: links > 0 ? () => shareEntry(known) : null }, point)
  }

  const placeOnBoard = (entries) => {
    if (!store.board) return
    const origin = board.center()
    const placed = entries.map((entry, index) => {
      const extra = entry.kind === 'file' ? { size: entry.size, kind: entry.fileKind } : {}
      return board.addReference({ x: origin.x + index * 24, y: origin.y + index * 72 }, entry.kind, entry.id, entry.name, extra).id
    })
    board.select(placed)
    showNote()
  }

  const newFolder = async () => {
    try {
      const record = await resources.createFolder(folderId, translate('newFolderName'))
      await refreshFolder()
      drive.focusRow(record.id)
      drive.startRename(record.id)
    } catch {
      showToast(translate('saveFailed'))
    }
  }

  const newDoc = async () => {
    if (!folderId) {
      showToast(translate('pickFolderFirst'))
      return
    }
    try {
      const record = await resources.createDoc(folderId, translate('newDocName'))
      await refreshFolder()
      await openDoc(record.id)
    } catch {
      showToast(translate('saveFailed'))
    }
  }

  const uploadFiles = () => {
    if (!folderId) {
      showToast(translate('pickFolderFirst'))
      return
    }
    uploadTarget = 'folder'
    fileInput.click()
  }

  const createDocHere = async (world) => {
    try {
      const record = await resources.createDoc(folderId, translate('newDocName'))
      board.addReference(world, 'doc', record.id, record.name)
      await refreshFolder()
      await openDoc(record.id)
    } catch {
      showToast(translate('saveFailed'))
    }
  }

  const createFolderHere = async (world) => {
    try {
      const record = await resources.createFolder(folderId, translate('newFolderName'))
      const item = board.addReference(world, 'folder', record.id, record.name)
      await refreshFolder()
      board.renameFile(item.id)
    } catch {
      showToast(translate('saveFailed'))
    }
  }

  const imageToFile = async (item) => {
    const img = board.elementOf(item.id).querySelector('img')
    try {
      const blob = await imageBlob(img)
      const record = await resources.upload(folderId, new File([blob], `image-${Date.now()}.${fileExtension(blob.type)}`, { type: blob.type }))
      board.linkImage(item.id, record)
      await refreshFolder()
      boards.refreshQuota()
    } catch (error) {
      showToast(uploadError(error))
    }
  }

  const imageToCard = (item) => {
    const entry = drive.entry(item.file)
    board.remove([item.id])
    board.addReference({ x: item.x, y: item.y }, 'file', item.file, entry ? entry.name : item.name, { size: entry ? entry.size : item.size, kind: 'image' })
  }

  const fileToImage = async (item) => {
    const entry = drive.entry(item.file)
    if (entry && entry.pic) {
      board.remove([item.id])
      board.addPicture({ x: item.x, y: item.y }, { id: entry.id, name: entry.name, size: entry.size, pic: entry.pic })
      return
    }
    try {
      const blob = await api.downloadFile(item.file)
      board.remove([item.id])
      const image = addImageOnBoard({ x: item.x, y: item.y }, new File([blob], item.name, { type: blob.type }))
      board.linkImage(image.id, { id: item.file, name: item.name, size: item.size })
    } catch {
      showToast(translate('downloadFailed'))
    }
  }

  const owner = { refOf, folderLabel, folderPath, showEntryDetails, moveWithPicker, removeEntries, copyLinkFor, imageToFile, imageToCard, fileToImage }

  const downloadEntries = async (entries) => {
    const files = entries.filter((entry) => entry.kind === 'file')
    const docs = entries.filter((entry) => entry.kind === 'doc')
    if (files.length === 1 && docs.length === 0) {
      downloadFile({ id: files[0].id, name: files[0].name })
      return
    }
    if (files.length + docs.length === 0) return
    try {
      const taken = new Set()
      const parts = []
      for (const entry of files) parts.push({ name: uniqueName(entry.name, taken), data: new Uint8Array(await (await api.downloadFile(entry.id)).arrayBuffer()) })
      for (const entry of docs) {
        const doc = await api.getDoc(entry.id)
        const holder = document.createElement('div')
        render(holder, doc.content)
        parts.push({ name: uniqueName(`${doc.name || translate('untitled')}.md`, taken), data: new TextEncoder().encode(toMarkdown({ tag: 'div', attrs: {}, children: treeOf(holder).children }, location.origin)) })
      }
      downloadBlob(buildZip(parts), fileName(folderLabel(), 'zip'))
    } catch {
      showToast(translate('zipFailed'))
    }
  }

  const entryMenu = (entries, point) => {
    if (entries.length > 1) {
      return [
        { label: translate('placeOnBoard'), run: () => placeOnBoard(entries) },
        { label: translate('move'), run: () => moveWithPicker(entries) },
        { label: translate('download'), run: () => downloadEntries(entries) },
        { separator: true },
        { label: `${translate('delete')} (${entries.length})`, danger: true, run: () => removeEntries(entries) }
      ]
    }
    const entry = entries[0]
    const actions = [{ label: translate('open'), run: () => openEntry(entry) }]
    if (entry.kind === 'file') actions.push({ label: translate('quickLook'), hint: 'Space', run: () => preview.open(entry) })
    if (folderId) actions.push({ label: translate('placeOnBoard'), run: () => placeOnBoard([entry]) })
    actions.push(
      { label: translate('share'), run: () => shareEntry(entry) },
      { label: translate('copyLink'), run: () => copyLinkFor(entry) },
      { label: translate('rename'), hint: 'F2', run: () => drive.startRename(entry.id) },
      { label: translate('move'), run: () => moveWithPicker([entry]) }
    )
    if (entry.kind === 'folder') actions.push({ label: translate(entry.pinned ? 'unpin' : 'pin'), run: () => resources.pin(entry, folderId).then(refreshFolder).catch(() => showToast(translate('saveFailed'))) })
    else actions.push({ label: translate('duplicate'), run: () => resources.duplicate(entry, folderId).then(refreshFolder).catch((error) => showToast(uploadError(error))) })
    if (entry.kind !== 'folder') actions.push({ label: translate('download'), run: () => downloadEntries([entry]) })
    actions.push({ label: translate('details'), run: () => showEntryDetails(entry, point) })
    actions.push({ separator: true }, { label: translate('delete'), hint: 'Del', danger: true, run: () => removeEntries([entry]) })
    return actions
  }

  const folderMenu = () => [
    ...newActions(),
    { separator: true },
    { label: translate(drive.order() === 'name' ? 'sortByDate' : 'sortByName'), run: () => drive.setOrder(drive.order() === 'name' ? 'updated' : 'name') }
  ]

  const newActions = () => {
    const actions = [{ label: translate('newFolderLabel'), run: newFolder }]
    if (!folderId) return actions
    actions.push(
      { label: translate('newDocLabel'), run: newDoc },
      { label: translate('newText'), run: () => { showNote(); board.addText(board.center()) } },
      { label: translate('newFrame'), run: () => { showNote(); board.addFrame({ ...board.center(), ...board.frameSize }) } }
    )
    return actions
  }

  const drive = initDrive({
    elements: {
      up: document.getElementById('up'),
      crumbs: document.getElementById('crumbs'),
      title: document.getElementById('panel-title'),
      meta: document.getElementById('panel-meta'),
      selectBar: document.getElementById('select-bar'),
      selectCount: document.getElementById('select-count'),
      selectClear: document.getElementById('select-clear'),
      rows: document.getElementById('rows'),
      search: document.getElementById('search')
    },
    translate,
    language,
    formatBytes,
    actions: {
      open: openEntry,
      preview: (entry) => { if (entry.kind === 'file') preview.open(entry) },
      menu: (entries, point) => itemMenu.open(entryMenu(entries, point), point),
      folderMenu: (point) => itemMenu.open(folderMenu(), point),
      rename: renameEntry,
      renameCurrent: async (name) => {
        try {
          await api.updateBoard(folderId, { name })
          if (store.board) store.board.name = name
          const folder = folderEntry()
          resources.invalidate(folderId, folder ? folder.parent : '')
          recents = renameIn(recents, 'folder', folderId, name)
          writeRecent(localStorage, recents)
          await refreshFolder()
        } catch {
          showToast(translate('saveFailed'))
        }
      },
      move: moveEntries,
      remove: removeEntries,
      upload: (files, target) => uploadInto(target, files),
      crumb: (id) => openFolder(id).catch(() => showToast(translate('loadFailed'))),
      selectionChanged: (entries) => {
        selectButtons.share.disabled = entries.length !== 1
        selectButtons.download.disabled = !entries.some((entry) => entry.kind !== 'folder')
      }
    }
  })
  sync.docClosed = () => updateTitle()
  sync.closeDoc = async () => {
    await docEditor.close()
    setPath(pathFor('folder', folderId))
  }

  const panel = initPanel({
    elements: { title: document.getElementById('view-title'), sub: document.getElementById('view-sub'), actions: document.getElementById('view-actions'), rows: document.getElementById('view-rows') },
    translate,
    language
  })

  const openRecent = async (entry) => {
    showPanel('folder')
    try {
      if (entry.kind === 'folder') {
        await openFolder(entry.id)
      } else {
        await openFolder(entry.folder)
        const known = drive.entry(entry.id)
        if (!known) throw Object.assign(new Error('gone'), { status: 404 })
        drive.focusRow(entry.id)
        focusCardOf(known)
      }
      showNote()
    } catch {
      forgetRecent(entry.kind, entry.id)
      showToast(translate('loadFailed'))
      showPanel('recent')
    }
  }

  function renderRecent() {
    panel.showRecent(recents, { entryOf: (kind, id) => recents.find((entry) => entry.kind === kind && entry.id === id), open: openRecent })
  }

  let trashListing = { entries: [], keepDays: 30 }

  const trashMenu = (entry) => [
    { label: translate('restore'), run: async () => {
      try {
        await resources.restore(entry, entry.home)
        if (entry.home === folderId || entry.kind === 'folder') await refreshFolder()
        boards.refreshQuota()
      } catch (error) {
        showToast(translate(error && error.status === 409 ? 'restoreFolderFirst' : 'saveFailed'))
      }
      renderTrash()
    } },
    { separator: true },
    { label: translate('deleteForever'), danger: true, run: async () => {
      try {
        await resources.deleteNow(entry)
        boards.refreshQuota()
      } catch {
        showToast(translate('saveFailed'))
      }
      renderTrash()
    } }
  ]

  const emptyTrash = () => {
    chooser.open(translate('emptyTrashAsk'), [
      { label: translate('cancel'), run: () => {} },
      { label: translate('emptyNow'), run: async () => {
        try {
          await resources.emptyTrash()
          boards.refreshQuota()
        } catch {
          showToast(translate('saveFailed'))
        }
        renderTrash()
      } }
    ])
  }

  async function renderTrash() {
    try {
      trashListing = await whileLoading(resources.trashList())
    } catch {
      showToast(translate('loadFailed'))
    }
    if (panelView !== 'trash') return
    panel.showTrash(trashListing, {
      entryOf: (kind, id) => trashListing.entries.find((entry) => entry.kind === kind && entry.id === id),
      open: (entry, point) => itemMenu.open(trashMenu(entry), point),
      menu: (entry, point) => itemMenu.open(trashMenu(entry), point),
      empty: emptyTrash
    })
  }

  const boards = createBoards({
    api,
    store,
    board,
    root: area,
    history,
    chooser,
    translate,
    formatBytes,
    setState,
    onAuthLost: () => auth.signOut(),
    showToast,
    onOpened: () => {
      showNote()
      updateBoardLine()
      showTips()
    },
    onQuota: ({ used, quota }) => {
      const level = quotaAlerts(used, quota)
      quotaLine.textContent = translate('quotaLine').replace('{used}', formatBytes(used)).replace('{quota}', formatBytes(quota))
      for (const name of ['warn', 'full']) {
        quotaLine.classList.toggle(name, level === name)
        quotaFill.parentElement.classList.toggle(name, level === name)
      }
      quotaFill.style.width = `${Math.min(100, quota > 0 ? (used / quota) * 100 : 0)}%`
    },
    onSummary: (summary) => {
      if (summary.filesChanged) {
        refreshFolder()
        return
      }
      const listing = drive.listing()
      if (!listing || !listing.folder || listing.folder.id !== summary.id) return
      resources.invalidate(summary.parent)
      if (listing.folder.title === summary.title && listing.folder.cover === summary.cover) return
      listing.folder.title = summary.title
      listing.folder.cover = summary.cover
      listing.path[listing.path.length - 1].title = summary.title
      drive.set(listing)
    },
    onImageUploaded: () => { if (docEditor.isOpen()) docEditor.markDirty() }
  })
  sync.markDirty = () => {
    if (docEditor.isOpen()) docEditor.markDirty()
    else {
      boards.markDirty()
      updateHints()
      updateBoardLine()
    }
  }
  sync.selectionChanged = updateLinked
  sync.metaOf = (item) => {
    const entry = drive.entry(item.type === 'image' ? item.file : item[item.type])
    if (!entry) return ''
    if (item.type === 'image') return `${formatBytes(entry.size)} · ${translate('alsoInFolder')}`
    if (item.type === 'folder') return `${translate('kindFolder')} · ${countOf(translate, 'items', entry.count || 0)}`
    if (item.type === 'doc') return `${translate('kindDoc')} · ${timeAgo(entry.updated)}`
    return ''
  }
  sync.rememberCamera = boards.rememberCamera
  sync.fileInserted = (item, file) => boards.uploadFile(item.id, file.name, file)
  sync.fileCopy = (item, source) => boards.uploadFile(item.id, item.name, source)
  sync.boardId = boards.currentId
  sync.mediaLink = async (item) => (await api.fileLink(item.file)).url
  sync.fileBlob = (id) => api.downloadFile(id)
  sync.renameFile = async (item, name) => {
    const kind = item.type
    const id = item[kind]
    if (kind === 'file') await api.updateFile(id, { name })
    else if (kind === 'doc') await api.updateDoc(id, { name })
    else await api.updateBoard(id, { name })
    board.renameReferences(kind, id, name)
    boards.markDirty()
    resources.invalidate(folderId)
    refreshFolder()
  }
  sync.docRenamed = (doc) => {
    updateTitle()
    board.renameReferences('doc', doc.id, doc.name)
    if (board.referenceIds('doc', doc.id).length > 0) boards.markDirty()
    resources.invalidate(folderId)
    refreshFolder()
  }
  sync.openItem = (item) => {
    if (item.type === 'folder') openFolder(item.folder).catch(() => showToast(translate('loadFailed')))
    else if (item.type === 'doc') openDoc(item.doc).catch(() => showToast(translate('loadFailed')))
    else if (item.file) {
      rememberRecent(refOf(item))
      openFile({ ...fileOf(item), location: folderPath() })
    }
  }
  const pictureName = (file, blob) => {
    const base = String(file.name || '').replace(/\.[^.]+$/, '') || `image-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`
    return `${base}.${fileExtension(blob.type)}`
  }

  sync.imageInserted = async (img, file) => {
    try {
      const blobUrl = img.src
      const blob = await compressImage(file)
      store.pendingImages.set(blobUrl, blob)
      const holder = img.closest('.item')
      if (holder && holder.dataset.type === 'image') store.pendingNames.set(blobUrl, pictureName(file, blob))
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
  const addResourcesOnBoard = (point, resources) => {
    resources.entries.forEach((entry, index) => {
      const known = drive.entry(entry.id)
      if (entry.kind !== 'folder' && resources.folder !== folderId) return
      const extra = known && known.kind === 'file' ? { size: known.size, kind: known.fileKind } : {}
      board.addReference({ x: point.x + index * 24, y: point.y + index * 72 }, entry.kind, entry.id, entry.name, extra)
    })
  }
  const pasteOnBoard = wireEditor({ insertImageInText, addImageOnBoard, addFilesOnBoard, addResourcesOnBoard })
  initFolderDrop({
    folderOf: () => folderId,
    createFolder: resources.createFolder,
    upload: uploadInto,
    onFolders: () => refreshFolder(),
    onError: () => showToast(translate('saveFailed'))
  })
  fileInput.addEventListener('change', () => {
    const files = [...fileInput.files]
    fileInput.value = ''
    if (uploadTarget === 'board') addFilesOnBoard(dropPoint || board.center(), files)
    else uploadInto(folderId, files)
    dropPoint = null
  })
  imageInput.addEventListener('change', () => {
    const files = [...imageInput.files]
    imageInput.value = ''
    if (imageTarget === 'text') {
      const root = host.active()
      if (root) root.focus({ preventScroll: true })
      files.forEach((file) => insertImageInText(file))
    } else {
      const origin = dropPoint || board.center()
      files.forEach((file, index) => addImageOnBoard({ x: origin.x + index * 24, y: origin.y + index * 24 }, file))
    }
    imageTarget = 'board'
    dropPoint = null
  })
  sync.pickImage = () => {
    imageTarget = 'text'
    imageInput.click()
  }

  sync.contextMenu = (request) => {
    if (request.kind === 'items') {
      itemMenu.open(canvasMenu(request.ids, request.item, request.point, { owner }), request.point)
      return
    }
    if (request.kind === 'dropOnFolder') {
      const entries = request.ids.map(board.itemOf).filter((item) => item && ['file', 'doc'].includes(item.type)).map(refOf)
      if (entries.length === 0) return
      moveEntries(entries, folderId, request.folder.folder)
      return
    }
    itemMenu.open(boardActions(request.world), request.point)
  }

  const boardActions = (world) => [
    { label: translate('addText'), run: () => board.addText(world) },
    { label: translate('addNote'), run: () => board.addText(world, '', 'hl1') },
    { label: translate('addFrame'), run: () => board.addFrame({ ...world, ...board.frameSize }) },
    { label: translate('newDoc'), run: () => createDocHere(world) },
    { label: translate('newFolder'), run: () => createFolderHere(world) },
    { label: translate('uploadFiles'), run: () => { dropPoint = world; uploadTarget = 'board'; fileInput.click() } },
    { label: translate('addImage'), run: () => { dropPoint = world; imageTarget = 'board'; imageInput.click() } },
    { label: translate('addLink'), run: async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (isUrl(text)) board.addLink(world, toHref(text))
        else showToast(translate('copyUrlFirst'))
      } catch {
        showToast(translate('clipboardBlocked'))
      }
    } },
    { label: translate('paste'), run: async () => {
      try {
        pasteOnBoard(await readClipboard(), world)
      } catch {
        showToast(translate('clipboardBlocked'))
      }
    } },
    { separator: true },
    { label: translate('selectAll'), run: () => board.select(board.items().map((item) => item.id)) }
  ]

  const currentTree = () => (docEditor.isOpen() ? { tag: 'div', attrs: {}, children: treeOf(docEditor.note).children } : treeOfBoard(board.elementsInReadingOrder()))
  const currentTitle = () => (docEditor.isOpen() ? docEditor.current().name : folderLabel())

  const exportCurrent = (format) => {
    board.stopEditing()
    exportAs(format, currentTree(), currentTitle())
  }

  const exportZip = async () => {
    board.stopEditing()
    try {
      const taken = new Set()
      const entries = [{ name: uniqueName('board.md', taken), data: new TextEncoder().encode(toMarkdown(currentTree(), location.origin)) }]
      for (const item of parseContent(board.serialize()) || []) {
        if (item.type === 'file' && item.file) {
          const blob = await api.downloadFile(item.file)
          entries.push({ name: uniqueName(item.name, taken), data: new Uint8Array(await blob.arrayBuffer()) })
        }
      }
      for (const img of area.querySelectorAll('img[src^="/api/files/images/"], img[src^="/api/pic/"]')) {
        const blob = await (await fetch(img.getAttribute('src'))).blob()
        entries.push({ name: uniqueName(img.getAttribute('src').split('/').pop(), taken), data: new Uint8Array(await blob.arrayBuffer()) })
      }
      downloadBlob(buildZip(entries), fileName(currentTitle() || 'board', 'zip'))
    } catch {
      showToast(translate('zipFailed'))
    }
  }

  const removeCurrentFolder = async () => {
    const folder = folderEntry()
    if (!folder) return
    const entry = { kind: 'folder', id: folder.id, name: labelOf(folder) }
    if (!board.isBlank() && !(await confirmTrash(translate('deleteOnBoardAsk').replace('{name}', entry.name)))) return
    const parent = folder.parent
    try {
      await openFolder(parent)
    } catch {
      showToast(translate('loadFailed'))
      return
    }
    await removeEntries([entry], { ask: false })
  }

  initMenu({
    button: document.getElementById('menu'),
    menu: document.getElementById('menu-panel'),
    translate,
    settings: null,
    actions: [
      { label: () => translate(folderEntry() && folderEntry().pinned ? 'unpin' : 'pin'), run: async () => {
        const folder = folderEntry()
        if (!folder) return
        try {
          await resources.pin({ id: folder.id, pinned: folder.pinned }, folder.parent)
          folder.pinned = !folder.pinned
        } catch {
          showToast(translate('saveFailed'))
        }
      } },
      { label: () => translate('renameFolder'), run: () => drive.renameCurrent() },
      { label: () => translate('addFile'), run: () => { uploadTarget = 'board'; fileInput.click() } },
      { label: () => translate('downloadMd'), run: () => exportCurrent('md') },
      { label: () => translate('downloadHtml'), run: () => exportCurrent('html') },
      { label: () => translate('downloadDocx'), run: () => exportCurrent('docx') },
      { label: () => translate('downloadTxt'), run: () => exportCurrent('txt') },
      { label: () => translate('downloadZip'), run: exportZip },
      { label: () => translate('shortcuts'), run: () => help.open() },
      { label: () => translate('print'), run: () => window.print() },
      { label: () => translate('deleteFolder'), danger: true, run: removeCurrentFolder }
    ],
    onChange: saveSettings
  })
  initMenu({
    button: avatar,
    menu: document.getElementById('account-menu'),
    translate,
    settings: store.settings,
    actions: [
      { note: () => (store.auth ? store.auth.email : '') },
      { label: () => translate('signOut'), run: async () => {
        await docEditor.close()
        await boards.flush()
        auth.signOut()
      } }
    ],
    onChange: saveSettings
  })
  const share = initShare({
    button: document.getElementById('share'),
    panel: document.getElementById('share-panel'),
    translate,
    getState: () => ({
      selected: board.selected(),
      items: parseContent(board.serialize()) || [],
      shares: boards.getShares(),
      doc: docEditor.isOpen() ? { id: docEditor.current().id, name: docEditor.current().name } : null,
      nameOf: (kind, id) => {
        const entry = drive.entry(id)
        return entry ? entry.name : translate(kind === 'doc' ? 'kindDoc' : 'kindFile')
      }
    }),
    createShare: boards.createShare,
    updateShare: boards.updateShare,
    deleteShare: boards.deleteShare,
    showToast,
    onFolderTarget: (target) => openFolder(target.folder).then(() => share.open(null)).catch(() => showToast(translate('loadFailed')))
  })
  sync.shareItems = (ids) => share.open(shareTarget(ids, parseContent(board.serialize()) || []))

  newButton.addEventListener('click', (event) => {
    if (newMenu.isOpen()) {
      newMenu.close()
      return
    }
    newMenu.open(newActions(), event.currentTarget.getBoundingClientRect())
  })
  uploadButton.addEventListener('click', uploadFiles)
  selectButtons.share.addEventListener('click', () => { if (drive.selected().length === 1) shareEntry(drive.selected()[0]) })
  selectButtons.move.addEventListener('click', () => moveWithPicker(drive.selected()))
  selectButtons.download.addEventListener('click', () => downloadEntries(drive.selected()))
  selectButtons.remove.addEventListener('click', () => removeEntries(drive.selected()))
  document.getElementById('fit-link').addEventListener('click', () => { showNote(); board.fit() })
  rail.folder.addEventListener('click', () => showPanel('folder'))
  rail.recent.addEventListener('click', () => showPanel(panelView === 'recent' ? 'folder' : 'recent'))
  rail.trash.addEventListener('click', () => showPanel(panelView === 'trash' ? 'folder' : 'trash'))
  document.getElementById('add').addEventListener('click', (event) => {
    if (addMenu.isOpen()) {
      addMenu.close()
      return
    }
    if (!store.board) {
      showToast(translate('pickFolderFirst'))
      return
    }
    addMenu.open(boardActions(board.center()), event.currentTarget.getBoundingClientRect())
  })

  const palette = initSearch({
    palette: document.getElementById('palette'),
    input: document.getElementById('palette-input'),
    rows: document.getElementById('palette-rows'),
    translate,
    language,
    commands: () => [
      { label: translate('newFolder'), run: newFolder },
      { label: translate('newDoc'), run: newDoc },
      { label: translate('uploadFiles'), run: uploadFiles },
      { label: translate('recent'), run: () => showPanel('recent') },
      { label: translate('trash'), run: () => showPanel('trash') }
    ],
    loadIndex: async () => buildIndex(await whileLoading(api.searchIndex()), translate),
    onOpen: async (row, query) => {
      try {
        showPanel('folder')
        if (row.kind === 'folder') {
          await openFolder(row.id)
          find.jumpTo(query)
        } else if (row.kind === 'doc') await openDoc(row.id)
        else {
          await openFolder(row.folder)
          const entry = drive.entry(row.id)
          if (entry) focusCardOf(entry)
          drive.focusRow(row.id)
        }
      } catch {
        showToast(translate('loadFailed'))
      }
    }
  })

  document.getElementById('search-open').addEventListener('click', () => palette.open())
  const help = initHelp({ element: document.getElementById('help'), translate, isActive: signedIn })

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.key.toLowerCase() !== 'n') return
    event.preventDefault()
    if (signedIn()) newFolder()
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
      avatar.textContent = (store.auth.email || '?').slice(0, 1).toUpperCase()
      recents = readRecent(localStorage)
      if (isPhone()) showList()
      else showNote()
      loadDrive()
    },
    onSignedOut: () => {
      docEditor.close()
      boards.reset()
      resources.reset()
      drive.reset()
      folderId = ''
      setPath('/', true)
      recents = []
      showPanel('folder')
      clearShareTarget()
      avatar.textContent = ''
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

  const openSomeFolder = async () => {
    if (folderId) return true
    const listing = drive.listing()
    const recent = listing && listing.folders[0]
    if (!recent) return false
    await openFolder(recent.id, true)
    return true
  }

  const receiveShared = async () => {
    if (location.hash !== SHARE_HASH) {
      clearShareTarget()
      return
    }
    window.history.replaceState(null, '', location.pathname)
    const shared = await readShareTarget()
    if (!shared || (!shared.text && shared.files.length === 0)) return
    if (!(await openSomeFolder())) {
      showToast(translate('pickFolderFirst'))
      return
    }
    chooser.open(translate('sharedAsk'), [
      { label: translate('discard'), run: () => {} },
      { label: translate('add'), run: () => addShared(shared) }
    ])
  }

  async function loadDrive() {
    try {
      const route = routeOf()
      const last = route.kind === 'root' ? readLast(localStorage) : route.id
      const cached = readCachedListing(localStorage, last || '')
      if (cached) drive.set(cached)
      await duplicatePending()
      if (route.kind === 'doc') await followRoute(route)
      else await openFolder(last || '', true)
      if (last === null) await openSomeFolder()
      const listing = drive.listing()
      if (!folderId && listing && listing.folders.length === 0) {
        const record = await resources.createFolder('', translate('firstFolderName'), firstBoardContent(translate))
        await openFolder(record.id, true)
      }
      boards.refreshQuota()
      await receiveShared()
    } catch (error) {
      if (error && error.status === 401) {
        auth.signOut()
        return
      }
      saveState.textContent = translate('loadFailed')
      window.addEventListener('online', loadDrive, { once: true })
    }
  }

  window.addEventListener('popstate', () => {
    if (!signedIn() || location.pathname === currentPath()) return
    followRoute(routeOf()).catch(() => showToast(translate('loadFailed')))
  })

  auth.restore()
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register(serviceWorkerUrl())
