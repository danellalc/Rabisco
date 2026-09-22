import { defaults } from './settings.js'

const PREVIOUS_PREFIX = 'rabisco.'
const PREFIX = 'trecos.'
const CARRIED = ['settings', 'auth', 'list', 'last']

export const store = {
  pendingImages: new Map(),
  pendingNames: new Map(),
  uploaded: new Map(),
  settings: { ...defaults },
  auth: null,
  board: null,
  dirty: false
}

export function migrateStorage(storage) {
  try {
    for (const key of Object.keys(storage)) {
      if (!key.startsWith(PREVIOUS_PREFIX)) continue
      const name = key.slice(PREVIOUS_PREFIX.length)
      if (CARRIED.includes(name) && storage.getItem(PREFIX + name) === null) storage.setItem(PREFIX + name, storage.getItem(key))
      storage.removeItem(key)
    }
  } catch {
    return
  }
}
