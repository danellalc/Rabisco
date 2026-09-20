import { parseDate } from './list.js'

const HOUR = 3600000
const EXPIRY = { never: 0, '1h': HOUR, '1d': 24 * HOUR, '7d': 7 * 24 * HOUR }
const MODES = ['off', 'view', 'edit']

export function expiryDate(choice, now = Date.now()) {
  const span = EXPIRY[choice] || 0
  return span ? new Date(now + span).toISOString() : ''
}

export function expiryChoice(expires, now = Date.now()) {
  if (!expires) return 'never'
  const remaining = parseDate(expires).getTime() - now
  if (remaining <= HOUR) return '1h'
  if (remaining <= 24 * HOUR) return '1d'
  return '7d'
}

export function shareUrl(origin, token) {
  return `${origin}/s/#${token}`
}

export function tokenFromHash(hash) {
  const token = String(hash || '').replace(/^#/, '')
  return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : ''
}

export function shareTarget(selectedIds, items) {
  const ids = selectedIds.filter((id) => items.some((item) => item.id === id))
  if (ids.length === 0) return { kind: 'board', ids: [] }
  const only = items.find((item) => item.id === ids[0])
  if (ids.length === 1 && only.type === 'file') return { kind: 'file', ids, name: only.name }
  return { kind: 'selection', ids }
}

export function parseShareItems(raw) {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id))

function copyField(field) {
  field.focus()
  field.select()
  return document.execCommand('copy')
}

export function initShare({ button, panel, translate, getState, createShare, updateShare, deleteShare, showToast }) {
  let target = null

  const close = () => {
    panel.hidden = true
    target = null
    document.removeEventListener('pointerdown', closeIfOutside)
    document.removeEventListener('keydown', closeOnEscape)
  }
  const closeIfOutside = (event) => {
    if (!panel.contains(event.target) && !button.contains(event.target)) close()
  }
  const closeOnEscape = (event) => {
    if (event.key === 'Escape') close()
  }

  const attempt = async (work, doneKey) => {
    try {
      await work()
      if (doneKey) showToast(translate(doneKey))
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

  const targetLabel = (share, items) => {
    const ids = parseShareItems(share.items)
    const kind = shareTarget(ids, items)
    if (kind.kind === 'board') return translate('targetBoard')
    if (kind.kind === 'file') return kind.name
    return translate('targetSelection').replace('{n}', String(ids.length))
  }

  const textButton = (label, className, run) => {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = className
    element.textContent = label
    element.addEventListener('click', run)
    return element
  }

  const render = () => {
    const state = getState()
    if (!target) target = shareTarget(state.selected, state.items)
    const current = state.shares.find((share) => sameIds(parseShareItems(share.items), target.ids)) || null
    panel.replaceChildren()
    const title = document.createElement('p')
    title.className = 'menu-title'
    title.textContent = target.kind === 'board' ? translate('thisBoard') : target.kind === 'file' ? target.name : translate('selectionOf').replace('{n}', String(target.ids.length))
    panel.append(title)
    if (target.kind === 'selection') {
      const hint = document.createElement('p')
      hint.className = 'menu-hint'
      hint.textContent = translate('selectionHint')
      panel.append(hint)
    }
    const modes = document.createElement('div')
    modes.className = 'menu-row modes'
    const activeMode = current ? current.mode : 'off'
    for (const mode of target.kind === 'board' ? MODES : ['view']) {
      const option = document.createElement('button')
      option.type = 'button'
      option.textContent = translate(`share${mode[0].toUpperCase()}${mode.slice(1)}`)
      option.setAttribute('aria-pressed', String(activeMode === mode))
      option.addEventListener('click', () => {
        if (activeMode === mode) return
        if (mode === 'off') attempt(() => deleteShare(current.id), 'linkDisabled')
        else if (current) attempt(() => updateShare(current.id, { mode }))
        else attempt(() => createShare(target.ids, mode, ''))
      })
      modes.append(option)
    }
    panel.append(modes)
    if (current) {
      const expiry = document.createElement('div')
      expiry.className = 'menu-row expiry'
      const label = document.createElement('span')
      label.textContent = translate('expires')
      expiry.append(label)
      const chosen = expiryChoice(current.expires)
      for (const choice of Object.keys(EXPIRY)) {
        const option = document.createElement('button')
        option.type = 'button'
        option.textContent = translate(`expiry_${choice}`)
        option.setAttribute('aria-pressed', String(chosen === choice))
        option.addEventListener('click', () => { if (chosen !== choice) attempt(() => updateShare(current.id, { expires: expiryDate(choice) })) })
        expiry.append(option)
      }
      panel.append(expiry)
      const row = document.createElement('div')
      row.className = 'link-row'
      const field = document.createElement('input')
      field.type = 'text'
      field.readOnly = true
      field.className = 'link-field'
      field.value = shareUrl(location.origin, current.token)
      field.addEventListener('focus', () => field.select())
      row.append(field, textButton(translate('copy'), 'copy', () => copyLink(field)))
      panel.append(row)
    }
    if (state.shares.length > 0) {
      const divider = document.createElement('div')
      divider.className = 'divider'
      const heading = document.createElement('p')
      heading.className = 'menu-label'
      heading.textContent = translate('activeLinks')
      panel.append(divider, heading)
      for (const share of state.shares) {
        const row = document.createElement('div')
        row.className = 'share-row'
        const mode = document.createElement('span')
        mode.className = 'mode'
        mode.textContent = translate(share.mode === 'edit' ? 'modeEdit' : 'modeView')
        row.append(
          textButton(targetLabel(share, state.items), 'target', () => {
            target = shareTarget(parseShareItems(share.items), state.items)
            render()
          }),
          mode,
          textButton(translate('copy'), 'text-link small', () => {
            const field = document.createElement('input')
            field.value = shareUrl(location.origin, share.token)
            row.append(field)
            copyLink(field).finally(() => field.remove())
          }),
          textButton(translate('disable'), 'text-link small quiet', () => attempt(() => deleteShare(share.id), 'linkDisabled'))
        )
        panel.append(row)
      }
    }
  }

  const open = (ids) => {
    target = ids ? shareTarget(ids, getState().items) : null
    render()
    panel.hidden = false
    document.addEventListener('pointerdown', closeIfOutside)
    document.addEventListener('keydown', closeOnEscape)
  }

  button.addEventListener('click', () => {
    if (!panel.hidden) {
      close()
      return
    }
    open(null)
  })

  return { close, open, refresh: () => { if (!panel.hidden) render() } }
}
