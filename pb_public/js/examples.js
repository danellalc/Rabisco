const textItem = (id, x, y, w, html, color = '') => ({ id, type: 'text', x, y, z: 1, w, html, ...(color ? { color } : {}) })

export function firstBoardContent(translate) {
  const welcome = `<h1>${translate('exTitle')}</h1><div>${translate('exLine1')}</div><div>${translate('exLine2')}</div>`
  const tasks = `<h2>${translate('exTry')}</h2><ul class="ck"><li class="on">${translate('exTask1')}</li><li>${translate('exTask2')}</li></ul>`
  return JSON.stringify([
    textItem('ex000001', 40, 40, 340, welcome),
    { id: 'ex000002', type: 'frame', x: 404, y: 40, z: 0, w: 240, h: 256, name: translate('exFrame') },
    textItem('ex000003', 424, 72, 180, `<div>${translate('exNote1')}</div>`, 'hl1'),
    textItem('ex000004', 456, 168, 180, `<div>${translate('exNote2')}</div>`, 'hl2'),
    textItem('ex000005', 668, 40, 192, tasks)
  ])
}
