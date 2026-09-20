export class ApiError extends Error {
  constructor(status, message, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function createApi({ getToken, getUserId }) {
  const call = async (method, path, { body, headers = {} } = {}) => {
    const init = { method, headers: { ...headers } }
    const token = getToken()
    if (token) init.headers.Authorization = token
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

  return {
    requestCode: (email) => call('POST', '/api/collections/users/request-otp', { body: { email } }),
    signIn: (otpId, code) => call('POST', '/api/collections/users/auth-with-otp', { body: { otpId, password: code } }),
    refresh: () => call('POST', '/api/collections/users/auth-refresh'),
    listNotes: () => call('GET', '/api/collections/notes/records?sort=-pinned,-updated&perPage=200&skipTotal=1&fields=id,title,cover,pinned,updated'),
    listContents: () => call('GET', '/api/collections/notes/records?perPage=200&skipTotal=1&fields=id,content'),
    getNote: (id) => call('GET', `/api/collections/notes/records/${id}?fields=id,content,updated,title,cover,pinned`),
    createNote: () => call('POST', '/api/collections/notes/records?fields=id,content,updated,title,cover,pinned', { body: { content: '', user: getUserId() } }),
    saveNote: (id, content, revision) => call('PATCH', `/api/collections/notes/records/${id}?fields=id,updated,title,cover,pinned`, { body: { content }, headers: { 'X-Note-Rev': revision } }),
    pinNote: (id, pinned) => call('PATCH', `/api/collections/notes/records/${id}?fields=id,updated,title,cover,pinned`, { body: { pinned } }),
    deleteNote: (id) => call('DELETE', `/api/collections/notes/records/${id}`),
    uploadImage: (noteId, blob, name) => {
      const form = new FormData()
      form.append('note', noteId)
      form.append('user', getUserId())
      form.append('file', blob, name)
      return call('POST', '/api/collections/images/records?fields=id,file', { body: form })
    },
    imageUrl: (record) => `/api/files/images/${record.id}/${record.file}`
  }
}
