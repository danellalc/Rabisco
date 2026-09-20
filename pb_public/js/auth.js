const storageKey = 'rabisco.auth'
const RESEND_COOLDOWN = 15000

export function readAuth(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || 'null')
    return parsed && typeof parsed.token === 'string' && typeof parsed.userId === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function writeAuth(storage, auth) {
  try {
    if (auth) storage.setItem(storageKey, JSON.stringify(auth))
    else storage.removeItem(storageKey)
  } catch {
    return
  }
}

export function errorKey(error) {
  if (!error || typeof error.status !== 'number') return 'sendFailed'
  if (error.status === 429) return 'tooMany'
  if (error.status === 400 || error.status === 404) return 'codeInvalid'
  return 'sendFailed'
}

export function magicLinkFrom(search) {
  const params = new URLSearchParams(search)
  const code = params.get('otp')
  const id = params.get('id')
  return code && id ? { code, id } : null
}

export function initAuth({ api, store, elements, translate, onSignedIn }) {
  const { emailForm, codeForm, emailInput, codeInput, emailError, codeError, codeNote, resend, changeEmail } = elements
  let otpId = ''
  let email = ''

  const showError = (element, key) => {
    element.textContent = key ? translate(key) : ''
    element.hidden = !key
  }

  const show = (step) => {
    document.body.dataset.view = 'login'
    emailForm.hidden = step !== 'email'
    codeForm.hidden = step !== 'code'
    showError(emailError, null)
    showError(codeError, null)
    if (step === 'email') emailInput.focus()
    else codeInput.focus()
  }

  const finish = (session) => {
    store.auth = { token: session.token, userId: session.record.id }
    writeAuth(localStorage, store.auth)
    onSignedIn()
  }

  const requestCode = async () => {
    const button = emailForm.querySelector('button[type=submit]')
    button.disabled = true
    button.textContent = translate('sending')
    try {
      const result = await api.requestCode(email)
      otpId = result.otpId
      codeNote.textContent = translate('codeSent').replace('{email}', email)
      codeInput.value = ''
      show('code')
    } catch (error) {
      showError(emailError, errorKey(error))
    } finally {
      button.disabled = false
      button.textContent = translate('getCode')
    }
  }

  emailForm.addEventListener('submit', (event) => {
    event.preventDefault()
    email = emailInput.value.trim()
    if (!emailInput.checkValidity()) {
      showError(emailError, 'emailInvalid')
      return
    }
    requestCode()
  })

  codeForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = codeForm.querySelector('button[type=submit]')
    button.disabled = true
    try {
      finish(await api.signIn(otpId, codeInput.value.trim()))
    } catch (error) {
      showError(codeError, errorKey(error))
    } finally {
      button.disabled = false
    }
  })

  resend.addEventListener('click', () => {
    resend.disabled = true
    setTimeout(() => { resend.disabled = false }, RESEND_COOLDOWN)
    requestCode()
  })

  changeEmail.addEventListener('click', () => show('email'))

  const signOut = () => {
    store.auth = null
    writeAuth(localStorage, null)
    show('email')
  }

  const restore = async () => {
    const link = magicLinkFrom(location.search)
    if (link) {
      history.replaceState(null, '', location.pathname)
      try {
        finish(await api.signIn(link.id, link.code))
        return
      } catch (error) {
        show('code')
        showError(codeError, errorKey(error))
        return
      }
    }
    const saved = readAuth(localStorage)
    if (!saved) {
      show('email')
      return
    }
    store.auth = saved
    try {
      finish(await api.refresh())
    } catch (error) {
      if (error && error.status === 401) signOut()
      else onSignedIn()
    }
  }

  return { restore, signOut }
}
