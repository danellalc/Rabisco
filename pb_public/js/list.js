const MINUTE = 60000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function normalize(text) {
  return String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function parseDate(value) {
  return new Date(String(value).replace(' ', 'T'))
}

export function relativeTime(then, now, translate, language) {
  const diff = now - then
  if (diff < MINUTE) return translate('now')
  if (diff < HOUR) return translate('minutesAgo').replace('{n}', String(Math.floor(diff / MINUTE)))
  if (diff < DAY) return translate('hoursAgo').replace('{n}', String(Math.floor(diff / HOUR)))
  const thenDate = new Date(then)
  const nowDate = new Date(now)
  const yesterday = new Date(nowDate)
  yesterday.setDate(nowDate.getDate() - 1)
  if (thenDate.toDateString() === yesterday.toDateString()) return translate('yesterday')
  const options = { day: 'numeric', month: 'short' }
  if (thenDate.getFullYear() !== nowDate.getFullYear()) options.year = '2-digit'
  return new Intl.DateTimeFormat(language, options).format(thenDate).replace('.', '')
}
