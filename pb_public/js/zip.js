const TABLE = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

export function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

function header(view, offset, fields) {
  for (const [size, value] of fields) {
    if (size === 2) view.setUint16(offset, value, true)
    else view.setUint32(offset, value, true)
    offset += size
  }
  return offset
}

export function uniqueName(name, taken) {
  if (!taken.has(name)) {
    taken.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  let counter = 2
  while (taken.has(`${base} (${counter})${extension}`)) counter++
  const next = `${base} (${counter})${extension}`
  taken.add(next)
  return next
}

export function buildZip(entries, now = new Date()) {
  const encoder = new TextEncoder()
  const parts = []
  const directory = []
  let offset = 0
  const stamp = dosDateTime(now)
  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length)
    header(new DataView(local.buffer), 0, [[4, 0x04034b50], [2, 20], [2, 0x0800], [2, 0], [2, stamp.time], [2, stamp.day], [4, crc], [4, data.length], [4, data.length], [2, name.length], [2, 0]])
    local.set(name, 30)
    parts.push(local, data)
    const central = new Uint8Array(46 + name.length)
    header(new DataView(central.buffer), 0, [[4, 0x02014b50], [2, 20], [2, 20], [2, 0x0800], [2, 0], [2, stamp.time], [2, stamp.day], [4, crc], [4, data.length], [4, data.length], [2, name.length], [2, 0], [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]])
    central.set(name, 46)
    directory.push(central)
    offset += local.length + data.length
  }
  const directorySize = directory.reduce((total, part) => total + part.length, 0)
  const end = new Uint8Array(22)
  header(new DataView(end.buffer), 0, [[4, 0x06054b50], [2, 0], [2, 0], [2, entries.length], [2, entries.length], [4, directorySize], [4, offset], [2, 0]])
  return new Blob([...parts, ...directory, end], { type: 'application/zip' })
}
