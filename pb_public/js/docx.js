import { buildZip } from './zip.js'

const HIGHLIGHTS = { hl1: 'yellow', hl2: 'green', hl3: 'magenta' }
const COLORS = { c1: '8E4A40', c2: '4A637C', c3: '605E57' }
const HEADINGS = { h1: 40, h2: 30 }
const LISTS = ['ul', 'ol']
const INDENT = 720

const isText = (node) => typeof node === 'string'
const classesOf = (node) => (node.attrs.class || '').split(/\s+/)

export function escapeXml(text) {
  return String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function runProperties(style) {
  const parts = []
  if (style.code) parts.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>')
  if (style.size || style.code) parts.push(`<w:sz w:val="${style.size || 20}"/>`)
  if (style.bold) parts.push('<w:b/>')
  if (style.italic) parts.push('<w:i/>')
  if (style.underline) parts.push('<w:u w:val="single"/>')
  if (style.strike) parts.push('<w:strike/>')
  if (style.color) parts.push(`<w:color w:val="${style.color}"/>`)
  if (style.highlight) parts.push(`<w:highlight w:val="${style.highlight}"/>`)
  return parts.length > 0 ? `<w:rPr>${parts.join('')}</w:rPr>` : ''
}

function textRun(text, style) {
  const lines = text.split('\n')
  const body = lines.map((line) => `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`).join('<w:br/>')
  return `<w:r>${runProperties(style)}${body}</w:r>`
}

function styleFor(node, style) {
  const next = { ...style }
  if (node.tag === 'b' || node.tag === 'strong') next.bold = true
  if (node.tag === 'i' || node.tag === 'em') next.italic = true
  if (node.tag === 'u') next.underline = true
  if (node.tag === 's') next.strike = true
  if (node.tag === 'code') next.code = true
  for (const name of classesOf(node)) {
    if (HIGHLIGHTS[name]) next.highlight = HIGHLIGHTS[name]
    if (COLORS[name]) next.color = COLORS[name]
  }
  return next
}

function runs(nodes, style, links) {
  return nodes.map((node) => {
    if (isText(node)) return textRun(node, style)
    if (node.tag === 'br') return '<w:r><w:br/></w:r>'
    if (node.tag === 'img') return ''
    if (node.tag === 'a' && node.attrs.href) {
      const id = `rId${links.length + 10}`
      links.push({ id, url: node.attrs.href })
      return `<w:hyperlink r:id="${id}">${runs(node.children, { ...styleFor(node, style), underline: true, color: '33524D' }, links)}</w:hyperlink>`
    }
    return runs(node.children, styleFor(node, style), links)
  }).join('')
}

function paragraph(content, { heading = false, code = false, indent = 0, border = false } = {}) {
  const props = ['<w:spacing w:before="' + (heading ? 240 : 0) + '" w:after="' + (heading ? 120 : 160) + '"/>']
  if (heading) props.push('<w:keepNext/>')
  if (code) props.push('<w:shd w:val="clear" w:color="auto" w:fill="E3E0DA"/>')
  if (indent > 0) props.push(`<w:ind w:left="${indent}"/>`)
  if (border) props.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D3D0C9"/></w:pBdr>')
  return `<w:p><w:pPr>${props.join('')}</w:pPr>${content}</w:p>`
}

function listParagraphs(node, depth, style, links) {
  const checklist = classesOf(node).includes('ck')
  const out = []
  let number = 0
  for (const item of node.children) {
    if (isText(item) || item.tag !== 'li') continue
    number += 1
    const marker = node.tag === 'ol' ? `${number}. ` : checklist ? (classesOf(item).includes('on') ? '☑ ' : '☐ ') : '• '
    const own = item.children.filter((child) => isText(child) || !LISTS.includes(child.tag))
    const nested = item.children.filter((child) => !isText(child) && LISTS.includes(child.tag))
    out.push(paragraph(textRun(marker, style) + runs(own, style, links), { indent: INDENT * (depth + 1) }))
    for (const list of nested) out.push(...listParagraphs(list, depth + 1, style, links))
  }
  return out
}

function tableXml(node, style, links) {
  const rows = []
  const collect = (parent) => {
    for (const child of parent.children) {
      if (isText(child)) continue
      if (child.tag === 'tr') rows.push(child.children.filter((cell) => !isText(cell) && cell.tag === 'td'))
      else collect(child)
    }
  }
  collect(node)
  const borders = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="D3D0C9"/>`).join('') + '</w:tblBorders>'
  const body = rows.map((cells) => `<w:tr>${cells.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraph(runs(cell.children, style, links))}</w:tc>`).join('')}</w:tr>`).join('')
  return `<w:tbl><w:tblPr>${borders}</w:tblPr>${body}</w:tbl>${paragraph('')}`
}

function blocks(children, depth, style, links) {
  const out = []
  let run = []
  const flush = () => {
    if (run.length > 0) out.push(paragraph(runs(run, style, links), { indent: INDENT * depth }))
    run = []
  }
  for (const child of children) {
    if (isText(child) || (!LISTS.includes(child.tag) && !['h1', 'h2', 'hr', 'table', 'pre', 'blockquote', 'div', 'p'].includes(child.tag))) {
      run.push(child)
      continue
    }
    flush()
    if (HEADINGS[child.tag]) out.push(paragraph(runs(child.children, { ...style, bold: true, size: HEADINGS[child.tag] }, links), { heading: true }))
    else if (child.tag === 'hr') out.push(paragraph('', { border: true }))
    else if (LISTS.includes(child.tag)) out.push(...listParagraphs(child, depth, style, links))
    else if (child.tag === 'table') out.push(tableXml(child, style, links))
    else if (child.tag === 'pre') out.push(paragraph(runs(child.children, { ...style, code: true }, links), { code: true, indent: INDENT * depth }))
    else if (child.tag === 'blockquote') out.push(...blocks(child.children, depth + 1, { ...style, italic: true }, links))
    else out.push(...blocks(child.children, depth, style, links))
  }
  flush()
  return out
}

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'

export function toDocxXml(tree) {
  const links = []
  const body = blocks(tree.children, 0, {}, links).join('')
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links.map((link) => `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.url)}" TargetMode="External"/>`).join('')}</Relationships>`
  return { document, rels }
}

export function toDocx(tree) {
  const { document, rels } = toDocxXml(tree)
  const encoder = new TextEncoder()
  return buildZip([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'word/document.xml', data: encoder.encode(document) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(rels) }
  ])
}
