import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { ALLOWED_TAGS as clientTags, CLASS_TOKENS as clientClasses, safeHref, safeImageSource, safeWidth } from '../pb_public/js/sanitize.js'

const require = createRequire(import.meta.url)
const { sanitizeHtml, ALLOWED_TAGS, CLASS_TOKENS } = require('../pb_hooks/sanitize.js')

const payloads = [
  '<img src=x onerror=alert(1)>',
  '<IMG SRC="javascript:alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<script>alert(1)</script>',
  '<script src="//evil/x.js"></script>after',
  '<style>body{display:none}</style>',
  '<svg onload=alert(1)><circle/></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
  '<iframe src="//evil"></iframe>',
  '<object data="//evil"></object>',
  '<embed src="//evil">',
  '<div onclick="alert(1)">x</div>',
  '<div onmouseover=alert(1)>x</div>',
  '<b onfocus=alert(1) tabindex=1>x</b>',
  '<img src="/api/files/images/abc/x.webp" onload="alert(1)">',
  '<img src="//evil.test/x.png">',
  '<img src="https://evil.test/x.png">',
  '<img srcset="//evil/x 1x" src="/api/files/images/a/b.webp">',
  '<a href="http://ok.test" target="_top" onclick="x">ok</a>',
  '<form action="//evil"><input name=x><button>go</button></form>',
  '<template><img src=x onerror=alert(1)></template>',
  '<noscript><img src=x onerror=alert(1)></noscript>',
  '<!--<img src=x onerror=alert(1)>-->',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<img src="/api/files/images/a/b.webp" style="width:50%;background:url(x)">',
  '<span class="c1 evil" onclick="x">x</span>',
  '<a href="http://x.test"><img src="/api/files/images/a/b.webp" onerror="alert(1)"></a>',
  '<<img src=x onerror=alert(1)>>',
  '<img/src=x/onerror=alert(1)>',
  '<img src="x"onerror="alert(1)">',
  '<a href=javascript:alert(1)>x</a>',
  '<base href="//evil/">',
  '<meta http-equiv="refresh" content="0;url=//evil">',
  '<link rel="stylesheet" href="//evil/x.css">',
  '<div><script>alert(1)</div></script>',
  '<scr<script>ipt>alert(1)</script>',
  '<img src="/api/files/images/a/b.webp" width="10; alert(1)">',
  '<td onclick="alert(1)">x</td>'
]

const dangerous = /(<script|<style|<iframe|<object|<embed|<svg|<math|<form|<input|<button|<base|<meta|<link|<template|<noscript|on\w+=|javascript:|vbscript:|data:|srcset|background:|<!--)/i

test('every payload comes out harmless from the server sanitizer', () => {
  for (const payload of payloads) {
    const output = sanitizeHtml(payload)
    assert.ok(!dangerous.test(output), `still dangerous: ${payload} -> ${output}`)
  }
})

test('good content survives the server sanitizer unchanged in meaning', () => {
  const input = '<div>Hello <b>bold</b> <mark class="hl1">hi</mark> <span class="c2">blue</span></div><ul class="ck"><li class="on">done</li></ul><div><img src="/api/files/images/abc123/pic_x1y2.webp" width="800" height="600" data-width="45"></div><hr><div><a href="https://x.test/a?b=1">link</a></div>'
  const output = sanitizeHtml(input)
  assert.equal(output, '<div>Hello <b>bold</b> <mark class="hl1">hi</mark> <span class="c2">blue</span></div><ul class="ck"><li class="on">done</li></ul><div><img src="/api/files/images/abc123/pic_x1y2.webp" width="800" height="600" data-width="45"></div><hr><div><a href="https://x.test/a?b=1" rel="noopener noreferrer" target="_blank">link</a></div>')
})

test('quotes, inline code and code blocks survive without attributes', () => {
  assert.equal(sanitizeHtml('<blockquote class="x" onclick="1">quoted</blockquote><pre style="a"><code>let a = 1</code></pre><p>use <code>npm</code></p>'), '<blockquote>quoted</blockquote><pre><code>let a = 1</code></pre><p>use <code>npm</code></p>')
})

test('a legacy style width becomes data-width on the server', () => {
  assert.equal(sanitizeHtml('<img src="/api/files/images/a/b.webp" style="width: 45%">'), '<img src="/api/files/images/a/b.webp" data-width="45">')
})

test('unknown tags are unwrapped and text with angle brackets is escaped', () => {
  assert.equal(sanitizeHtml('<section>a &lt; b</section>'), 'a &lt; b')
  assert.equal(sanitizeHtml('1 < 2 and 3 > 2'), '1 &lt; 2 and 3 &gt; 2')
  assert.equal(sanitizeHtml('<div>open'), '<div>open</div>')
  assert.equal(sanitizeHtml('</div>stray'), 'stray')
})

test('image width outside 5 to 100 percent and bad dimensions are dropped', () => {
  assert.equal(sanitizeHtml('<img src="/api/files/images/a/b.webp" data-width="150" width="0" height="-1">'), '<img src="/api/files/images/a/b.webp">')
  assert.equal(sanitizeHtml('<img src="/api/files/images/a/b.webp" data-width="60.5">'), '<img src="/api/files/images/a/b.webp" data-width="60.5">')
  assert.equal(sanitizeHtml('<img src="/api/files/images/a/b.webp" data-width="4">'), '<img src="/api/files/images/a/b.webp">')
})

test('images without a valid source are removed on the server', () => {
  assert.equal(sanitizeHtml('<div><img src="blob:http://x/1"></div>'), '<div></div>')
  assert.equal(sanitizeHtml('<img src=x onerror=alert(1)>text'), 'text')
})

test('client and server allowlists are identical', () => {
  assert.deepEqual(clientTags, ALLOWED_TAGS)
  assert.deepEqual(clientClasses, CLASS_TOKENS)
})

test('client url and width validators agree with the server', () => {
  assert.equal(safeHref('javascript:alert(1)'), null)
  assert.equal(safeHref('java\tscript:alert(1)'), null)
  assert.equal(safeHref('https://x.test'), 'https://x.test')
  assert.equal(safeHref('mailto:a@b.c'), 'mailto:a@b.c')
  assert.equal(safeImageSource('https://evil.test/x.png', false), null)
  assert.equal(safeImageSource('blob:http://x/1', true), 'blob:http://x/1')
  assert.equal(safeImageSource('blob:http://x/1', false), null)
  assert.equal(safeImageSource('/api/files/images/abc/x.webp', false), '/api/files/images/abc/x.webp')
  assert.equal(safeWidth('width: 45%'), '45')
  assert.equal(safeWidth('width: 2%'), null)
  assert.equal(safeWidth('width: 45%; color: red'), null)
})
