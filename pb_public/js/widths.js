const known = new Set()
let sheet = null

export function widthValue(raw) {
  const match = /^\s*(\d{1,3}(?:\.\d)?)%?\s*$/.exec(String(raw))
  if (!match) return null
  const value = parseFloat(match[1])
  return value >= 5 && value <= 100 ? match[1] : null
}

function ensureRule(value) {
  if (known.has(value)) return
  if (!sheet) {
    sheet = new CSSStyleSheet()
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  }
  sheet.insertRule(`.note img[data-width="${value}"]{width:${value}%}`)
  known.add(value)
}

export function setImageWidth(img, raw) {
  const value = widthValue(raw)
  if (value === null) return
  ensureRule(value)
  img.dataset.width = value
}

export function clearImageWidth(img) {
  delete img.dataset.width
}

export function ensureImageWidths(root) {
  for (const img of root.querySelectorAll('img[data-width]')) {
    const value = widthValue(img.dataset.width)
    if (value === null) delete img.dataset.width
    else ensureRule(value)
  }
}
