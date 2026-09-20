const REFRESH_WINDOW = 3600000
const BOARD_FIELDS = 'id,content,revision,updated,title,cover,pinned'
const SUMMARY_FIELDS = 'id,revision,updated,title,cover,pinned'
const FILE_FIELDS = 'id,name,size,kind'
const SHARE_FIELDS = 'id,token,mode,items,expires'

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

function parseResponse(status, text) {
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (status < 200 || status >= 300) throw new ApiError(status, (data && data.message) || `HTTP ${status}`, data && data.data)
  return data
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

  const uploadWithProgress = (path, form, onProgress) => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', path)
    request.setRequestHeader('Authorization', getToken())
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    })
    request.addEventListener('load', () => {
      try {
        resolve(parseResponse(request.status, request.responseText))
      } catch (error) {
        reject(error)
      }
    })
    request.addEventListener('error', () => reject(new ApiError(0, 'Network error', null)))
    request.addEventListener('abort', () => reject(new ApiError(0, 'Upload aborted', null)))
    request.send(form)
  })

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
    deleteBoard: (id) => fresh('DELETE', `/api/collections/boards/records/${id}`),
    listShares: (boardId) => fresh('GET', `/api/collections/shares/records?perPage=50&skipTotal=1&sort=created&filter=${encodeURIComponent(`board='${boardId}'`)}&fields=${SHARE_FIELDS}`),
    createShare: (boardId, items, mode, expires) => fresh('POST', `/api/collections/shares/records?fields=${SHARE_FIELDS}`, { body: { board: boardId, user: getUserId(), items: JSON.stringify(items), mode, expires } }),
    updateShare: (id, patch) => fresh('PATCH', `/api/collections/shares/records/${id}?fields=${SHARE_FIELDS}`, { body: patch }),
    deleteShare: (id) => fresh('DELETE', `/api/collections/shares/records/${id}`),
    uploadImage: (boardId, blob, name) => {
      const form = new FormData()
      form.append('board', boardId)
      form.append('user', getUserId())
      form.append('file', blob, name)
      return fresh('POST', '/api/collections/images/records?fields=id,file', { body: form })
    },
    imageUrl: (record) => `/api/files/images/${record.id}/${record.file}`,
    uploadFile: async (boardId, file, name, onProgress) => {
      const form = new FormData()
      form.append('board', boardId)
      form.append('user', getUserId())
      form.append('file', file, name)
      await fresh('GET', '/api/health').catch(() => null)
      return uploadWithProgress(`/api/collections/files/records?fields=${FILE_FIELDS}`, form, onProgress)
    },
    renameFile: (id, name) => fresh('PATCH', `/api/collections/files/records/${id}?fields=${FILE_FIELDS}`, { body: { name } }),
    fileLink: (id) => fresh('POST', `/api/files/${id}/link`),
    quota: () => fresh('GET', '/api/quota'),
    getShared: (token) => call('GET', '/api/shared', { headers: { 'X-Share-Token': token }, anonymous: true }),
    saveShared: (token, content, revision) => call('PATCH', '/api/shared', { body: { content }, headers: { 'X-Share-Token': token, 'X-Note-Rev': revision }, anonymous: true }),
    sharedFileLink: (token, file) => call('POST', '/api/shared/file-link', { body: { file }, headers: { 'X-Share-Token': token }, anonymous: true })
  }
}
