import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileName, toMarkdown, toText } from '../pb_public/js/export.js'

const h = (tag, attrs, ...children) => ({ tag, attrs, children })
const root = (...children) => ({ tag: 'div', attrs: {}, children })
const origin = 'https://notes.example.com'

test('headings, paragraphs and inline marks become markdown', () => {
  const tree = root(
    h('h1', {}, 'Title'),
    h('div', {}, 'Plain ', h('b', {}, 'bold'), ' and ', h('em', {}, 'soft '), h('s', {}, 'gone')),
    h('h2', {}, 'Sub'),
    h('div', {}, h('u', {}, 'under'), h('mark', { class: 'hl1' }, ' lit'), h('span', { class: 'c1' }, ' red'))
  )
  assert.equal(toMarkdown(tree, origin), '# Title\n\nPlain **bold** and *soft* ~~gone~~\n\n## Sub\n\nunder lit red\n')
  assert.equal(toText(tree, origin), 'Title\nPlain bold and soft gone\nSub\nunder lit red\n')
})

test('lists, checklists and nested lists keep their structure', () => {
  const tree = root(
    h('ul', {}, h('li', {}, 'one'), h('li', {}, 'two', h('ul', {}, h('li', {}, 'deep')))),
    h('ol', {}, h('li', {}, 'first'), h('li', {}, 'second')),
    h('ul', { class: 'ck' }, h('li', { class: 'on' }, 'done'), h('li', {}, 'todo'))
  )
  assert.equal(toMarkdown(tree, origin), '- one\n- two\n  - deep\n\n1. first\n2. second\n\n- [x] done\n- [ ] todo\n')
  assert.equal(toText(tree, origin), '- one\n- two\n  - deep\n1. first\n2. second\n- [x] done\n- [ ] todo\n')
})

test('links, images, rules and line breaks', () => {
  const tree = root(
    h('div', {}, 'see ', h('a', { href: 'https://x.test/a' }, 'this'), h('br', {}), 'next line'),
    h('div', {}, h('img', { src: '/api/files/images/abc/shot.webp', 'data-width': '50' })),
    h('div', {}, h('img', { src: 'blob:https://notes.example.com/1' })),
    h('hr', {}),
    'bare text at the root'
  )
  assert.equal(toMarkdown(tree, origin), 'see [this](https://x.test/a)\nnext line\n\n![image](https://notes.example.com/api/files/images/abc/shot.webp)\n\n---\n\nbare text at the root\n')
  assert.equal(toText(tree, origin), 'see this\nnext line\nhttps://notes.example.com/api/files/images/abc/shot.webp\n---\nbare text at the root\n')
})

test('parentheses in link targets are escaped so the markdown link survives', () => {
  const tree = root(h('div', {}, h('a', { href: 'https://x.test/a_(b)' }, 'wiki')))
  assert.equal(toMarkdown(tree, origin), '[wiki](https://x.test/a_%28b%29)\n')
})

test('tables become pipe tables in markdown and tab separated text', () => {
  const tree = root(h('table', {}, h('tbody', {}, h('tr', {}, h('td', {}, 'a'), h('td', {}, 'b|c')), h('tr', {}, h('td', {}, '1')))))
  assert.equal(toMarkdown(tree, origin), '| a | b\\|c |\n| --- | --- |\n| 1 |  |\n')
  assert.equal(toText(tree, origin), 'a\tb|c\n1\n')
})

test('empty marks and blank blocks are dropped', () => {
  const tree = root(h('div', {}, h('b', {}, '   ')), h('div', {}, h('br', {})), h('div', {}, 'kept'))
  assert.equal(toMarkdown(tree, origin), 'kept\n')
})

test('file names come from the title and stay safe', () => {
  assert.equal(fileName('Meeting: notes / plan?', 'md'), 'Meeting notes  plan.md')
  assert.equal(fileName('', 'txt'), 'rabisco.txt')
  assert.equal(fileName('x'.repeat(100), 'md'), `${'x'.repeat(60)}.md`)
  assert.equal(fileName(`${'x'.repeat(59)}😀 tail`, 'md'), `${'x'.repeat(59)}😀.md`)
  assert.equal(fileName('word '.repeat(30), 'md'), `${'word '.repeat(11)}word.md`)
})

test('quotes, inline code and code blocks keep their markdown shape', () => {
  const tree = root(
    h('blockquote', {}, h('div', {}, 'first'), h('div', {}, 'second')),
    h('div', {}, 'run ', h('code', {}, 'npm test'), ' now'),
    h('pre', {}, 'const a = 1\nconst b = 2\n')
  )
  assert.equal(toMarkdown(tree, origin), '> first\n> \n> second\n\nrun `npm test` now\n\n```\nconst a = 1\nconst b = 2\n```\n')
  assert.equal(toText(tree, origin), 'first\nsecond\nrun npm test now\nconst a = 1\nconst b = 2\n')
})

test('a list nested inside a heading is exported as a list', () => {
  const tree = root(h('h1', {}, h('ul', {}, h('li', {}, 'task'))))
  assert.equal(toMarkdown(tree, origin), '- task\n')
})

test('the html export is a standalone page that escapes text and keeps only safe attributes', async () => {
  const { toHtml } = await import('../pb_public/js/export.js')
  const tree = { tag: 'div', attrs: {}, children: [
    { tag: 'h1', attrs: {}, children: ['Title & <co>'] },
    { tag: 'div', attrs: { onclick: 'x()', class: 'hl1' }, children: ['Hello ', { tag: 'a', attrs: { href: 'https://x.test/?a=1&b=2', target: '_self' }, children: ['link'] }] },
    { tag: 'img', attrs: { src: '/api/files/images/abc/def.webp', 'data-width': '50', style: 'color:red' }, children: [] }
  ] }
  const html = toHtml(tree, 'https://trecos.test', 'My & title', 'pt-BR')
  assert.ok(html.startsWith('<!doctype html>\n<html lang="pt-BR">'))
  assert.ok(html.includes('<title>My &amp; title</title>'))
  assert.ok(html.includes('<h1>Title &amp; &lt;co&gt;</h1>'))
  assert.ok(html.includes('<div class="hl1">Hello <a href="https://x.test/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">link</a></div>'))
  assert.ok(html.includes('<img src="https://trecos.test/api/files/images/abc/def.webp" style="width:50%">'))
  assert.ok(!html.includes('onclick'))
  assert.ok(!html.includes('color:red'))
})

test('the docx export writes headings, runs, lists, links and tables into wordprocessingml', async () => {
  const { toDocxXml, toDocx, escapeXml } = await import('../pb_public/js/docx.js')
  const tree = { tag: 'div', attrs: {}, children: [
    { tag: 'h1', attrs: {}, children: ['Title & co'] },
    { tag: 'div', attrs: {}, children: ['Hello ', { tag: 'b', attrs: {}, children: ['bold'] }, ' ', { tag: 'a', attrs: { href: 'https://x.test/?a=1&b=2' }, children: ['link'] }, ' ', { tag: 'mark', attrs: { class: 'hl2' }, children: ['green'] }] },
    { tag: 'ul', attrs: { class: 'ck' }, children: [{ tag: 'li', attrs: { class: 'on' }, children: ['done'] }, { tag: 'li', attrs: {}, children: ['todo', { tag: 'ol', attrs: {}, children: [{ tag: 'li', attrs: {}, children: ['nested'] }] }] }] },
    { tag: 'blockquote', attrs: {}, children: [{ tag: 'div', attrs: {}, children: ['quoted'] }] },
    { tag: 'pre', attrs: {}, children: ['a = 1\nb = 2'] },
    { tag: 'hr', attrs: {}, children: [] },
    { tag: 'table', attrs: {}, children: [{ tag: 'tbody', attrs: {}, children: [{ tag: 'tr', attrs: {}, children: [{ tag: 'td', attrs: {}, children: ['1'] }, { tag: 'td', attrs: {}, children: ['2'] }] }] }] }
  ] }
  const { document, rels } = toDocxXml(tree)
  assert.ok(document.includes('<w:pStyle w:val="Heading1"/>'))
  assert.ok(document.includes('<w:t xml:space="preserve">Title &amp; co</w:t>'))
  assert.ok(document.includes('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">bold</w:t>'))
  assert.ok(document.includes('<w:hyperlink r:id="rId10">'))
  assert.ok(rels.includes('Id="rId10"') && rels.includes('Target="https://x.test/?a=1&amp;b=2"') && rels.includes('TargetMode="External"'))
  assert.ok(document.includes('<w:highlight w:val="green"/>'))
  assert.ok(document.includes('☑ ') && document.includes('☐ ') && document.includes('1. nested'.slice(0, 2)))
  assert.ok(document.includes('<w:ind w:left="1440"/>'))
  assert.ok(document.includes('<w:i/>') && document.includes('quoted'))
  assert.ok(document.includes('<w:pStyle w:val="Code"/>') && document.includes('a = 1</w:t><w:br/><w:t xml:space="preserve">b = 2'))
  assert.ok(document.includes('<w:pBdr>'))
  assert.ok(document.includes('<w:tbl>') && document.includes('<w:tc>'))
  assert.equal(escapeXml('a<b>&"\u0001'), 'a&lt;b&gt;&amp;&quot;')
  const zip = new Uint8Array(await toDocx(tree).arrayBuffer())
  assert.equal(zip[0], 0x50)
  assert.equal(zip[1], 0x4b)
  const text = new TextDecoder().decode(zip)
  assert.ok(text.includes('[Content_Types].xml') && text.includes('word/document.xml') && text.includes('word/styles.xml'))
})
