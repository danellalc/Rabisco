const MAX_RUNNING = 2
const STATE_KEYS = { waiting: 'uploadWaiting', uploading: 'uploading', done: 'uploadDone', failed: 'uploadFailed', cancelled: 'uploadCancelled' }
const LEVELS = ['', 'warn', 'full']

const isPending = (job) => job.state === 'waiting' || job.state === 'uploading'

const element = (tag, className, text = '') => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

export function createUploads({ element: panel, translate, formatBytes, onSettled }) {
  const jobs = []
  let nextId = 1
  const head = element('p', 'uploads-head')
  const count = element('span', '')
  const clear = element('button', 'text-link small', translate('uploadClear'))
  clear.type = 'button'
  clear.addEventListener('click', () => {
    for (const job of jobs) job.row.remove()
    jobs.length = 0
    paintHead()
  })
  head.append(count, clear)
  panel.append(head)

  const paintHead = () => {
    const done = jobs.filter((job) => job.state === 'done').length
    count.textContent = translate('uploadsHead').replace('{done}', String(done)).replace('{total}', String(jobs.length))
    clear.hidden = jobs.some(isPending)
    panel.hidden = jobs.length === 0
  }

  const paint = (job) => {
    job.row.dataset.state = job.state
    job.stateText.textContent = translate(STATE_KEYS[job.state])
    job.fill.style.width = `${Math.round(job.progress * 100)}%`
    job.button.textContent = translate(job.state === 'failed' ? 'retry' : 'cancel')
    job.button.hidden = !isPending(job) && job.state !== 'failed'
    paintHead()
  }

  const build = (job) => {
    const row = element('div', 'upload-row')
    const name = element('span', 'upload-name', job.file.name)
    name.title = job.file.name
    const bar = element('span', 'upload-bar')
    job.fill = element('span', 'upload-fill')
    bar.append(job.fill)
    job.stateText = element('span', 'upload-state')
    job.button = element('button', 'text-link small')
    job.button.type = 'button'
    job.button.addEventListener('click', () => (job.state === 'failed' ? retry(job.id) : cancel(job.id)))
    row.append(name, element('span', 'upload-size', formatBytes(job.file.size)), bar, job.stateText, job.button)
    job.row = row
    panel.append(row)
  }

  const settle = (job, state) => {
    job.state = state
    job.controller = null
    paint(job)
    pump()
    if (!jobs.some((other) => other.target === job.target && isPending(other))) onSettled(job.target)
  }

  const start = async (job) => {
    job.state = 'uploading'
    job.controller = new AbortController()
    paint(job)
    try {
      await job.run(job.file, (fraction) => {
        job.progress = fraction
        paint(job)
      }, job.controller.signal)
      job.progress = 1
      settle(job, 'done')
    } catch {
      settle(job, job.state === 'cancelled' ? 'cancelled' : 'failed')
    }
  }

  const pump = () => {
    for (const job of jobs) {
      if (jobs.filter((other) => other.state === 'uploading').length >= MAX_RUNNING) return
      if (job.state === 'waiting') start(job)
    }
  }

  const find = (id) => jobs.find((job) => job.id === id)

  const add = (files, target, run) => {
    for (const file of files) {
      const job = { id: nextId++, file, target, run, state: 'waiting', progress: 0, controller: null }
      jobs.push(job)
      build(job)
      paint(job)
    }
    pump()
  }

  const cancel = (id) => {
    const job = find(id)
    if (!job) return
    if (job.state === 'waiting') settle(job, 'cancelled')
    else if (job.state === 'uploading') {
      job.state = 'cancelled'
      job.controller.abort()
    }
  }

  const retry = (id) => {
    const job = find(id)
    if (!job || job.state !== 'failed') return
    job.state = 'waiting'
    job.progress = 0
    paint(job)
    pump()
  }

  return { add, cancel, retry }
}

const readAll = (reader) => new Promise((resolve, reject) => {
  const found = []
  const step = () => reader.readEntries((entries) => {
    if (entries.length === 0) {
      resolve(found)
      return
    }
    found.push(...entries)
    step()
  }, reject)
  step()
})

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject))

export async function dropTree(entries) {
  const folders = []
  const files = []
  const walk = async (entry, path) => {
    if (entry.isDirectory) {
      const own = path ? `${path}/${entry.name}` : entry.name
      folders.push({ path: own, name: entry.name })
      for (const child of await readAll(entry.createReader())) await walk(child, own)
    } else if (entry.isFile) files.push({ path, file: await fileOf(entry) })
  }
  for (const entry of entries) await walk(entry, '')
  return { folders, files }
}

const entryOf = (item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null)
const parentOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

export function initFolderDrop({ folderOf, createFolder, upload, onFolders, onError }) {
  const receive = async (entries, target) => {
    const tree = await dropTree(entries)
    const ids = new Map([['', target]])
    for (const folder of tree.folders) ids.set(folder.path, (await createFolder(ids.get(parentOf(folder.path)), folder.name)).id)
    onFolders()
    for (const [path, id] of ids) {
      const files = tree.files.filter((entry) => entry.path === path).map((entry) => entry.file)
      if (files.length > 0) upload(id, files)
    }
  }

  document.addEventListener('drop', (event) => {
    const zone = event.target instanceof Element ? event.target.closest('#rows, #board') : null
    if (!zone || !event.dataTransfer) return
    const entries = [...event.dataTransfer.items].map(entryOf).filter(Boolean)
    if (!entries.some((entry) => entry.isDirectory)) return
    const row = event.target.closest('.row[data-kind=folder]')
    const target = row ? row.dataset.id : folderOf()
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    receive(entries, target).catch(onError)
  }, true)
}

export function quotaLevel(used, quota) {
  if (quota <= 0) return ''
  if (used >= quota) return 'full'
  return used >= quota * 0.8 ? 'warn' : ''
}

export function createQuotaAlerts(notify) {
  let level = ''
  return (used, quota) => {
    const next = quotaLevel(used, quota)
    if (LEVELS.indexOf(next) > LEVELS.indexOf(level)) notify(next, used, quota)
    level = next
    return next
  }
}
