export const MAX_EDGE = 1600

export function fitWithin(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export function fileExtension(type) {
  return type.split('/')[1] || 'bin'
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function drawToCanvas(bitmap, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas
}

export async function compressImage(file) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE)
  const canvas = drawToCanvas(bitmap, width, height)
  const webp = await toBlob(canvas, 'image/webp', 0.8)
  if (webp && webp.type === 'image/webp') return webp
  return toBlob(canvas, 'image/jpeg', 0.85)
}

export async function toPngBlob(blob) {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  return toBlob(drawToCanvas(bitmap, bitmap.width, bitmap.height), 'image/png')
}

export async function copyImage(src) {
  const png = fetch(src).then((response) => response.blob()).then(toPngBlob)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export function downloadBlob(blob, name) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
