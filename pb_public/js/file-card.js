import { svgIcon } from './dom.js'
import { extensionOf, formatSize, formatTime, isMedia } from './items.js'

const SHEET = 'M19 4H9.5A2.5 2.5 0 0 0 7 6.5v19A2.5 2.5 0 0 0 9.5 28h13a2.5 2.5 0 0 0 2.5-2.5V10.5L19 4Z M19 4.5v6h6'
const PLAY = '▸'
const PAUSE = '❚❚'

export const FILE_ICON_PATHS = {
  pdf: SHEET,
  generic: SHEET,
  image: `${SHEET} M11.5 22l3.5-4.5 2.5 3 2-2.5 3 4Z M13.5 13.5a1.25 1.25 0 1 0 0 .01`,
  doc: `${SHEET} M11.5 15h9 M11.5 18.5h6`,
  sheet: `${SHEET} M11.5 14h9v6.5h-9Z M16 14v6.5 M11.5 17.25h9`,
  slides: `${SHEET} M11.5 14h9v5.5h-9Z M14.5 22h3`,
  zip: `${SHEET} M15.5 6v1.75 M15.5 9.75v1.75 M15.5 13.5v1.75`,
  video: `${SHEET} M13.5 14l5.5 3.25-5.5 3.25Z`,
  audio: `${SHEET} M11 17.5c1.6-3 3.2-3 4.8 0s3.2 3 4.8 0`,
  code: `${SHEET} M13.5 14l-2.5 3 2.5 3 M18.5 14l2.5 3-2.5 3`
}

export const KIND_ICONS = {
  folder: 'M4 9.5A2.5 2.5 0 0 1 6.5 7h6l3 3h10a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 25.5 26h-19A2.5 2.5 0 0 1 4 23.5Z',
  doc: `${SHEET} M11.5 14h9 M11.5 17.5h9 M11.5 21h5`
}

export function createFileCards({ elements, itemOf, translate, language, onMediaLink, onRenameFile, onChange }) {
  let playing = null

  const fill = (element, item) => {
    element.dataset.kind = item.kind || item.type
    if (item.type !== 'file' || item.file) delete element.dataset.pending
    else element.dataset.pending = ''
    const iconPath = item.type === 'file' ? FILE_ICON_PATHS[item.kind] || SHEET : KIND_ICONS[item.type]
    element.querySelector('.file-icon path').setAttribute('d', iconPath)
    element.querySelector('.ext').textContent = item.type === 'file' ? extensionOf(item.name).toUpperCase().slice(0, 4) : ''
    element.querySelector('.file-name').textContent = item.name
    const meta = element.querySelector('.file-meta')
    if (item.type === 'file') meta.textContent = item.file ? formatSize(item.size, language) : translate('uploading')
    else meta.textContent = translate(item.type === 'doc' ? 'kindDoc' : 'kindFolder')
    element.querySelector('.play').hidden = !(item.type === 'file' && item.file && isMedia(item.kind))
  }

  const refresh = (item) => {
    const element = elements.get(item.id)
    if (element) fill(element, item)
  }

  const stopPlaying = () => {
    if (!playing) return
    const { item, media, element } = playing
    playing = null
    element.classList.remove('playing')
    element.querySelector('.play').textContent = PLAY
    element.querySelector('.progress').style.width = '0'
    refresh(item)
    media.pause()
    media.remove()
  }

  const togglePlay = async (item) => {
    const element = elements.get(item.id)
    if (playing && playing.item.id === item.id) {
      if (playing.media.paused) playing.media.play()
      else playing.media.pause()
      element.querySelector('.play').textContent = playing.media.paused ? PLAY : PAUSE
      return
    }
    stopPlaying()
    const media = document.createElement(item.kind === 'video' ? 'video' : 'audio')
    media.preload = 'none'
    media.playsInline = true
    playing = { item, media, element }
    media.addEventListener('timeupdate', () => {
      element.querySelector('.file-meta').textContent = `${formatTime(media.currentTime)} · ${formatTime(media.duration)}`
      element.querySelector('.progress').style.width = media.duration ? `${(media.currentTime / media.duration) * 100}%` : '0'
    })
    media.addEventListener('ended', stopPlaying)
    media.addEventListener('error', stopPlaying)
    if (item.kind === 'video') {
      element.classList.add('playing')
      media.addEventListener('click', () => togglePlay(item))
    }
    element.append(media)
    try {
      media.src = await onMediaLink(item)
      if (playing && playing.media === media) {
        await media.play()
        element.querySelector('.play').textContent = PAUSE
      }
    } catch {
      if (playing && playing.media === media) stopPlaying()
    }
  }

  const build = (element, item) => {
    const row = document.createElement('div')
    row.className = 'file-row'
    const icon = document.createElement('span')
    icon.className = 'file-icon'
    const ext = document.createElement('span')
    ext.className = 'ext'
    icon.append(svgIcon(SHEET, 32), ext)
    const text = document.createElement('span')
    text.className = 'file-text'
    const name = document.createElement('span')
    name.className = 'file-name'
    const meta = document.createElement('span')
    meta.className = 'file-meta'
    text.append(name, meta)
    const play = document.createElement('button')
    play.type = 'button'
    play.className = 'play'
    play.textContent = PLAY
    play.setAttribute('aria-label', translate('playPause'))
    play.addEventListener('click', (event) => {
      event.stopPropagation()
      togglePlay(itemOf(item.id))
    })
    row.append(icon, text, play)
    const progress = document.createElement('span')
    progress.className = 'progress'
    element.append(row, progress)
    fill(element, item)
  }

  const setProgress = (id, fraction) => {
    const element = elements.get(id)
    if (element) element.querySelector('.progress').style.width = `${Math.round(fraction * 100)}%`
  }

  const setRecord = (id, record) => {
    const item = itemOf(id)
    if (!item) return
    item.file = record.id
    item.name = record.name
    item.size = record.size
    item.kind = record.kind
    refresh(item)
    setProgress(id, 0)
  }

  const rename = (id) => {
    const item = itemOf(id)
    const element = elements.get(id)
    if (!item || !element || (item.type === 'file' && !item.file)) return
    const name = element.querySelector('.file-name')
    const input = document.createElement('input')
    input.className = 'rename'
    input.value = item.name
    let done = false
    const finish = async (commit) => {
      if (done) return
      done = true
      const next = input.value.trim()
      input.replaceWith(name)
      if (!commit || !next || next === item.name) return
      try {
        await onRenameFile(item, next)
      } catch {
        refresh(item)
      }
    }
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(true)
      if (event.key === 'Escape') finish(false)
      event.stopPropagation()
    })
    input.addEventListener('blur', () => finish(true))
    name.replaceWith(input)
    input.focus()
    const dot = item.type === 'file' ? item.name.lastIndexOf('.') : -1
    input.setSelectionRange(0, dot > 0 ? dot : item.name.length)
  }

  return { build, refresh, stopPlaying, playingId: () => (playing ? playing.item.id : null), setProgress, setRecord, rename }
}
