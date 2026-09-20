import { defaults } from './settings.js'

export const store = {
  pendingImages: new Map(),
  uploaded: new Map(),
  settings: { ...defaults },
  auth: null,
  note: null,
  dirty: false
}
