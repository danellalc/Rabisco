export const dictionaries = {
  en: {
    placeholder: 'Write',
    share: 'Share',
    back: 'Back',
    more: 'More',
    imageUnreadable: 'That image could not be read',
    imageCopied: 'Image copied',
    copyFailed: 'Could not copy',
    download: 'Download',
    pasteAs: 'Paste as',
    asImage: 'Image',
    asText: 'Text',
    asTable: 'Spreadsheet',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    width: 'Width',
    widthNormal: 'Normal',
    widthWide: 'Wide'
  },
  'pt-BR': {
    placeholder: 'Escreva',
    share: 'Compartilhar',
    back: 'Voltar',
    more: 'Mais',
    imageUnreadable: 'Não deu pra ler essa imagem',
    imageCopied: 'Imagem copiada',
    copyFailed: 'Não deu pra copiar',
    download: 'Baixar',
    pasteAs: 'Colar como',
    asImage: 'Imagem',
    asText: 'Texto',
    asTable: 'Planilha',
    theme: 'Tema',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    width: 'Largura',
    widthNormal: 'Normal',
    widthWide: 'Ampla'
  }
}

export function pickLanguage(languages) {
  const first = (languages[0] || '').toLowerCase()
  return first.startsWith('pt') ? 'pt-BR' : 'en'
}

export function createTranslator(language) {
  const dictionary = dictionaries[language]
  return (key) => dictionary[key]
}

export function applyTranslations(root, translate) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = translate(element.dataset.i18n)
  })
  root.querySelectorAll('[data-i18n-label]').forEach((element) => {
    element.setAttribute('aria-label', translate(element.dataset.i18nLabel))
  })
  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.dataset.placeholder = translate(element.dataset.i18nPlaceholder)
  })
}
