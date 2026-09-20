const HOUR = 3600000
const EXPIRY = { never: 0, '1h': HOUR, '1d': 24 * HOUR, '7d': 7 * 24 * HOUR }
const MODES = ['off', 'view', 'edit']

export function expiryDate(choice, now = Date.now()) {
  const span = EXPIRY[choice] || 0
  return span ? new Date(now + span).toISOString() : ''
}

export function shareUrl(origin, token) {
  return `${origin}/s/#${token}`
}

export function tokenFromHash(hash) {
  const token = String(hash || '').replace(/^#/, '')
  return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : ''
}

function copyField(field) {
  field.focus()
  field.select()
  return document.execCommand('copy')
}

export function initShare({ button, panel, translate, getShare, setShare, showToast }) {
  const close = () => {
    panel.hidden = true
    document.removeEventListener('pointerdown', closeIfOutside)
    document.removeEventListener('keydown', closeOnEscape)
  }
  const closeIfOutside = (event) => {
    if (!panel.contains(event.target) && !button.contains(event.target)) close()
  }
  const closeOnEscape = (event) => {
    if (event.key === 'Escape') close()
  }

  const change = async (mode, expiry) => {
    try {
      await setShare(mode, expiry)
      if (mode === 'off') showToast(translate('linkDisabled'))
      render()
    } catch {
      showToast(translate('saveFailed'))
    }
  }

  const copyLink = async (field) => {
    try {
      await navigator.clipboard.writeText(field.value)
    } catch {
      if (!copyField(field)) {
        showToast(translate('copyManually'))
        return
      }
    }
    showToast(translate('linkCopied'))
  }

  const render = () => {
    const share = getShare()
    panel.replaceChildren()
    const modes = document.createElement('div')
    modes.className = 'menu-row'
    for (const mode of MODES) {
      const option = document.createElement('button')
      option.type = 'button'
      option.textContent = translate(`share${mode[0].toUpperCase()}${mode.slice(1)}`)
      option.setAttribute('aria-pressed', String(share.mode === mode))
      option.addEventListener('click', () => { if (share.mode !== mode) change(mode) })
      modes.append(option)
    }
    panel.append(modes)
    if (share.mode === 'off' || !share.token) return
    const expiry = document.createElement('div')
    expiry.className = 'menu-row'
    const label = document.createElement('span')
    label.textContent = translate('expires')
    expiry.append(label)
    for (const choice of Object.keys(EXPIRY)) {
      const option = document.createElement('button')
      option.type = 'button'
      option.textContent = translate(`expiry_${choice}`)
      option.setAttribute('aria-pressed', String(share.expiry === choice))
      option.addEventListener('click', () => { if (share.expiry !== choice) change(share.mode, choice) })
      expiry.append(option)
    }
    panel.append(expiry)
    const row = document.createElement('div')
    row.className = 'link-row'
    const field = document.createElement('input')
    field.type = 'text'
    field.readOnly = true
    field.className = 'link-field'
    field.value = shareUrl(location.origin, share.token)
    field.addEventListener('focus', () => field.select())
    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'copy'
    copy.textContent = translate('copy')
    copy.addEventListener('click', () => copyLink(field))
    row.append(field, copy)
    panel.append(row)
  }

  button.addEventListener('click', () => {
    if (!panel.hidden) {
      close()
      return
    }
    render()
    panel.hidden = false
    document.addEventListener('pointerdown', closeIfOutside)
    document.addEventListener('keydown', closeOnEscape)
  })

  return { close }
}
