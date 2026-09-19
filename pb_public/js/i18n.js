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
    widthWide: 'Wide',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    strike: 'Strikethrough',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    bulletList: 'Bullet list',
    numberedList: 'Numbered list',
    checklist: 'Checklist',
    hl1: 'Yellow highlight',
    hl2: 'Green highlight',
    hl3: 'Pink highlight',
    hlNone: 'Remove highlight',
    c1: 'Red text',
    c2: 'Blue text',
    c3: 'Gray text',
    cDefault: 'Default color',
    clear: 'Clear formatting'
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
    widthWide: 'Ampla',
    bold: 'Negrito',
    italic: 'Itálico',
    underline: 'Sublinhado',
    strike: 'Riscado',
    heading1: 'Título',
    heading2: 'Subtítulo',
    bulletList: 'Lista',
    numberedList: 'Lista numerada',
    checklist: 'Checklist',
    hl1: 'Marca-texto amarelo',
    hl2: 'Marca-texto verde',
    hl3: 'Marca-texto rosa',
    hlNone: 'Remover marca-texto',
    c1: 'Texto vermelho',
    c2: 'Texto azul',
    c3: 'Texto cinza',
    cDefault: 'Cor padrão',
    clear: 'Limpar formatação'
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
