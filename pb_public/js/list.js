const MINUTE = 60000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const listKey = 'rabisco.list'

export function normalize(text) {
  return String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function parseDate(value) {
  return new Date(String(value).replace(' ', 'T'))
}

export function sortNotes(items) {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updated).localeCompare(String(a.updated)))
}

export function relativeTime(then, now, translate, language) {
  const diff = now - then
  if (diff < MINUTE) return translate('now')
  if (diff < HOUR) return translate('minutesAgo').replace('{n}', String(Math.floor(diff / MINUTE)))
  if (diff < DAY) return translate('hoursAgo').replace('{n}', String(Math.floor(diff / HOUR)))
  const thenDate = new Date(then)
  const nowDate = new Date(now)
  const yesterday = new Date(nowDate)
  yesterday.setDate(nowDate.getDate() - 1)
  if (thenDate.toDateString() === yesterday.toDateString()) return translate('yesterday')
  const options = { day: 'numeric', month: 'short' }
  if (thenDate.getFullYear() !== nowDate.getFullYear()) options.year = '2-digit'
  return new Intl.DateTimeFormat(language, options).format(thenDate).replace('.', '')
}

export function matches(item, text, query) {
  const needle = normalize(query).trim()
  if (!needle) return true
  return normalize(item.title).includes(needle) || normalize(text).includes(needle)
}

export function readList(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(listKey) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string') : []
  } catch {
    return []
  }
}

export function writeList(storage, items) {
  try {
    storage.setItem(listKey, JSON.stringify(items))
  } catch {
    return
  }
}

export function initList({ rows, search, translate, language, onOpen, onSearchContents, onSearchFailed = () => {} }) {
  let items = []
  let activeId = ''
  let contents = null
  let loadingContents = false

  const row = (item) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'row'
    button.dataset.id = item.id
    if (item.id === activeId) button.classList.add('active')
    if (item.pinned) {
      const pin = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      pin.setAttribute('viewBox', '0 0 24 24')
      pin.setAttribute('width', '14')
      pin.setAttribute('height', '14')
      pin.classList.add('pin')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', 'M12 21C12 21 5.5 14.8 5.5 9.8C5.5 6 8.4 3 12 3C15.6 3 18.5 6 18.5 9.8C18.5 14.8 12 21 12 21Z M13.6 9.8a1.6 1.6 0 11-3.2 0 1.6 1.6 0 013.2 0Z')
      pin.append(path)
      button.append(pin)
    }
    const title = document.createElement('span')
    title.className = 'title'
    title.textContent = item.title || translate(item.cover ? 'imageNote' : 'untitled')
    button.append(title)
    const time = document.createElement('span')
    time.className = 'time'
    time.textContent = relativeTime(parseDate(item.updated).getTime(), Date.now(), translate, language)
    button.append(time)
    if (item.cover && !item.title) {
      const thumb = document.createElement('img')
      thumb.className = 'thumb'
      thumb.alt = ''
      thumb.loading = 'lazy'
      thumb.src = `${item.cover}?thumb=100x100`
      button.append(thumb)
    }
    return button
  }

  const render = () => {
    const query = search.value
    const focused = document.activeElement && document.activeElement.closest('.row') ? document.activeElement.dataset.id : ''
    const visible = items.filter((item) => matches(item, contents ? contents.get(item.id) || '' : '', query))
    rows.replaceChildren(...visible.map(row))
    if (visible.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'empty'
      empty.textContent = translate(items.length === 0 && !query.trim() ? 'noNotes' : 'noResults')
      rows.append(empty)
    }
    if (focused) {
      const again = rows.querySelector(`.row[data-id="${focused}"]`)
      if (again) again.focus()
    }
  }

  search.addEventListener('input', async () => {
    render()
    if (!search.value || contents || loadingContents) return
    loadingContents = true
    try {
      contents = await onSearchContents()
      render()
    } catch {
      contents = null
      onSearchFailed()
    } finally {
      loadingContents = false
    }
  })

  rows.addEventListener('click', (event) => {
    const button = event.target.closest('.row')
    if (button) onOpen(button.dataset.id)
  })

  return {
    set(next) {
      items = sortNotes(next)
      contents = null
      render()
    },
    reset() {
      items = []
      contents = null
      activeId = ''
      search.value = ''
      render()
    },
    get: () => items,
    upsert(item) {
      const index = items.findIndex((entry) => entry.id === item.id)
      if (index >= 0) items[index] = { ...items[index], ...item }
      else items.push(item)
      items = sortNotes(items)
      contents = null
      render()
    },
    remove(id) {
      items = items.filter((entry) => entry.id !== id)
      render()
    },
    setActive(id) {
      activeId = id
      render()
    },
    find: (id) => items.find((entry) => entry.id === id)
  }
}
