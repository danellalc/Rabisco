const ROUTE = /^\/([fd])\/([a-z0-9]{15})\/?$/

export function pathFor(kind, id) {
  if (!id) return '/'
  return kind === 'folder' ? `/f/${id}` : kind === 'doc' ? `/d/${id}` : '/'
}

export function parsePath(pathname) {
  if (pathname === '/' || pathname === '/index.html') return { kind: 'root', id: '' }
  const match = ROUTE.exec(pathname)
  return match ? { kind: match[1] === 'f' ? 'folder' : 'doc', id: match[2] } : null
}
