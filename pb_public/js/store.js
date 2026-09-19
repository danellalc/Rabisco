import { defaults } from './settings.js'

export const store = {
  pendingImages: new Map(),
  settings: { ...defaults }
}
