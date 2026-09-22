const storageKey = 'trecos.recent'
const KINDS = ['folder', 'doc', 'file']
export const RECENT_LIMIT = 50

const isEntry = (entry) => entry && typeof entry === 'object' && KINDS.includes(entry.kind) && typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.at === 'number'

export function readRecent(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

export function writeRecent(storage, entries) {
  try {
    storage.setItem(storageKey, JSON.stringify(entries))
  } catch {
    return
  }
}

export function touch(entries, entry, now) {
  const rest = entries.filter((other) => !(other.kind === entry.kind && other.id === entry.id))
  return [{ ...entry, at: now }, ...rest].slice(0, RECENT_LIMIT)
}

export function forget(entries, kind, id) {
  return entries.filter((other) => !(other.kind === kind && other.id === id))
}

export function renameIn(entries, kind, id, name) {
  return entries.map((entry) => (entry.kind === kind && entry.id === id ? { ...entry, name } : entry))
}

export function dayLabel(at, now, translate, language) {
  const then = new Date(at)
  const today = new Date(now)
  if (then.toDateString() === today.toDateString()) return translate('today')
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (then.toDateString() === yesterday.toDateString()) return translate('yesterday')
  const options = { day: 'numeric', month: 'short' }
  if (then.getFullYear() !== today.getFullYear()) options.year = '2-digit'
  return new Intl.DateTimeFormat(language, options).format(then).replace('.', '')
}

export function groupByDay(entries, now, translate, language) {
  const groups = []
  for (const entry of entries) {
    const label = dayLabel(entry.at, now, translate, language)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
}
