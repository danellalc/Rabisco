export function createLightbox(dialog) {
  const picture = dialog.querySelector('img')
  const download = dialog.querySelector('button')
  let onDownload = () => {}

  dialog.addEventListener('click', () => dialog.close())
  download.addEventListener('click', (event) => {
    event.stopPropagation()
    onDownload()
  })

  return (src, downloadAction) => {
    picture.src = src
    onDownload = downloadAction
    dialog.showModal()
  }
}
