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
