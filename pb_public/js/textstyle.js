export const TEXT_SIZES = ['small', 'normal', 'large']
export const TEXT_ALIGNS = ['left', 'center', 'right']
export const SHORT_NOTE = 40
const DEFAULTS = { size: 'normal', align: 'left' }
const ALIGN_KEYS = { KeyL: 'left', KeyE: 'center', KeyR: 'right' }
const CLIPBOARD_KEYS = { KeyC: 'copy', KeyV: 'paste' }
const CLASSES = { 'size-small': ['size', 'small'], 'size-large': ['size', 'large'], 'align-center': ['align', 'center'], 'align-right': ['align', 'right'] }

export function cleanStyle(item) {
  if (!TEXT_SIZES.includes(item.size) || item.size === DEFAULTS.size) delete item.size
  if (!TEXT_ALIGNS.includes(item.align) || item.align === DEFAULTS.align) delete item.align
  return item
}

export function styleOf(item) {
  return { color: item.color || '', size: item.size || DEFAULTS.size, align: item.align || DEFAULTS.align }
}

export function styleClasses(item) {
  return Object.entries(CLASSES).map(([name, [key, value]]) => [name, item[key] === value])
}

export function cycled(list, current, step) {
  return list[(Math.max(0, list.indexOf(current)) + step + list.length) % list.length]
}

export function stepped(list, current, step) {
  return list[Math.min(list.length - 1, Math.max(0, list.indexOf(current) + step))]
}

export const STYLE_COMMANDS = {
  sizeDown: (style) => ({ size: stepped(TEXT_SIZES, style.size, -1) }),
  sizeUp: (style) => ({ size: stepped(TEXT_SIZES, style.size, 1) }),
  alignNext: (style) => ({ align: cycled(TEXT_ALIGNS, style.align, 1) })
}

export function isShort(text) {
  return text.length < SHORT_NOTE
}

export function styleKey(event) {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey === event.altKey) return null
  if (event.altKey) return CLIPBOARD_KEYS[event.code] || null
  return ALIGN_KEYS[event.code] ? { align: ALIGN_KEYS[event.code] } : null
}

export function styleEntries(style, translate, setStyle) {
  return [
    { label: `${translate('textSize')}: ${translate(`textSize_${style.size}`)}`, run: () => setStyle({ size: cycled(TEXT_SIZES, style.size, 1) }) },
    { label: `${translate('align')}: ${translate(`align_${style.align}`)}`, run: () => setStyle({ align: cycled(TEXT_ALIGNS, style.align, 1) }) }
  ]
}
