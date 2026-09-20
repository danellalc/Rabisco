const REFRESH_WINDOW = 3600000
const BOARD_FIELDS = 'id,content,revision,updated,title,cover,pinned,share_mode,share_token,share_expires'
const SUMMARY_FIELDS = 'id,revision,updated,title,cover,pinned,share_mode,share_token,share_expires'

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function tokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

export function createApi({ getToken, getUserId, onSession = () => {} }) {
  let refreshing = null

  const call = async (method, path, { body, headers = {}, anonymous = false } = {}) => {
    const init = { method, headers: { ...headers } }
    const token = getToken()
    if (token && !anonymous) init.headers.Authorization = token
    if (body instanceof FormData) init.body = body
    else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const response = await fetch(path, init)
    const data = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) throw new ApiError(response.status, (data && data.message) || response.statusText, data && data.data)
    return data
  }

  const refresh = async () => {
    if (!refreshing) {
      refreshing = call('POST', '/api/collections/users/auth-refresh')
        .then((session) => {
          onSession(session)
          return session
        })
        .finally(() => { refreshing = null })
    }
    return refreshing
  }

  const fresh = async (method, path, options) => {
    const token = getToken()
    if (token && tokenExpiry(token) - Date.now() < REFRESH_WINDOW) {
      try {
        await refresh()
      } catch (error) {
        if (error && error.status === 401) throw error
      }
    }
    return call(method, path, options)
  }

  const shareBody = (mode, expires) => (expires === undefined ? { share_mode: mode } : { share_mode: mode, share_expires: expires })

  return {
    requestCode: (email) => call('POST', '/api/collections/users/request-otp', { body: { email } }),
    signIn: (otpId, code) => call('POST', '/api/collections/users/auth-with-otp', { body: { otpId, password: code } }),
    refresh,
    listBoards: () => fresh('GET', '/api/collections/boards/records?sort=-pinned,-updated&perPage=200&skipTotal=1&fields=id,title,cover,pinned,updated'),
    listContents: () => fresh('GET', '/api/collections/boards/records?perPage=200&skipTotal=1&fields=id,content'),
    getBoard: (id) => fresh('GET', `/api/collections/boards/records/${id}?fields=${BOARD_FIELDS}`),
    createBoard: (content = '[]') => fresh('POST', `/api/collections/boards/records?fields=${BOARD_FIELDS}`, { body: { content, user: getUserId() } }),
    saveBoard: (id, content, revision) => fresh('PATCH', `/api/collections/boards/records/${id}?fields=${SUMMARY_FIELDS}`, { body: { content }, headers: { 'X-Note-Rev': revision } }),
    pinBoard: (id, pinned) => fresh('PATCH', `/api/collections/boards/records/${id}?fields=${SUMMARY_FIELDS}`, { body: { pinned } }),
    shareBoard: (id, mode, expires) => fresh('PATCH', `/api/collections/boards/records/${id}?fields=${SUMMARY_FIELDS}`, { body: shareBody(mode, expires) }),
    deleteBoard: (id) => fresh('DELETE', `/api/collections/boards/records/${id}`),
    uploadImage: (boardId, blob, name) => {
      const form = new FormData()
      form.append('board', boardId)
      form.append('user', getUserId())
      form.append('file', blob, name)
      return fresh('POST', '/api/collections/images/records?fields=id,file', { body: form })
    },
    imageUrl: (record) => `/api/files/images/${record.id}/${record.file}`,
    getShared: (token) => call('GET', '/api/shared', { headers: { 'X-Share-Token': token }, anonymous: true }),
    saveShared: (token, content, revision) => call('PATCH', '/api/shared', { body: { content }, headers: { 'X-Share-Token': token, 'X-Note-Rev': revision }, anonymous: true })
  }
}
