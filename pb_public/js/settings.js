const storageKey = 'rabisco.settings'

export const defaults = { theme: 'system', width: 'wide', sidebar: 'open' }
export const choices = { theme: ['system', 'light', 'dark'], width: ['normal', 'wide'], sidebar: ['open', 'closed'] }

export function sanitizeSettings(raw) {
  const result = { ...defaults }
  if (!raw || typeof raw !== 'object') return result
  for (const key of Object.keys(choices)) {
    if (choices[key].includes(raw[key])) result[key] = raw[key]
  }
  return result
}

export function readSettings(storage) {
  try {
    return sanitizeSettings(JSON.parse(storage.getItem(storageKey) || '{}'))
  } catch {
    return { ...defaults }
  }
}

export function writeSettings(storage, settings) {
  try {
    storage.setItem(storageKey, JSON.stringify(settings))
  } catch {
    return
  }
}

export function applySettings(root, settings) {
  if (settings.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = settings.theme
  root.dataset.width = settings.width
  root.dataset.sidebar = settings.sidebar
}
