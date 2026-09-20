const TITLE_LIMIT = 120

function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function titleOf(sanitizedHtml) {
  const text = decodeBasicEntities(sanitizedHtml.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
  return text.slice(0, TITLE_LIMIT)
}

function coverOf(sanitizedHtml) {
  const match = /<img [^>]*src="(\/api\/files\/images\/[a-z0-9]+\/[a-z0-9_.-]+)"/i.exec(sanitizedHtml)
  return match ? match[1] : ''
}

module.exports = { titleOf, coverOf }
