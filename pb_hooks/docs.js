const MAX_CONTENT_LENGTH = 2000000

function sanitizeDoc(content) {
  const { sanitizeHtml } = require(`${__hooks}/sanitize.js`)
  if (String(content || '').length > MAX_CONTENT_LENGTH) throw new BadRequestError('The document is too big.')
  return sanitizeHtml(String(content || ''))
}

module.exports = { sanitizeDoc }
