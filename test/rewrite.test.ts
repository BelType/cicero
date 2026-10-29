/**
 * The rewriter — `seam/rewrite.js` (*the host rewrites what the parser drops*, 2026-09-14).
 *
 * The only suite in this package that reaches into `seam/`, and the only one with a dependency behind it: css-tree runs in Node, so the rewrite is checkable without a browser even though nothing it produces means anything until one parses it. What is pinned is the CONTRACT — that the encoded forms are the ones `src/gcpm-encoding.js` decodes, that everything else in the author's text survives byte for byte, and that a sheet with nothing to rewrite comes back identical.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rewriteSheet as rewriteSheetTyped, rewriteNote as rewriteNoteTyped } from '../seam/rewrite.ts';
import { rewriteDocumentSheets as rewriteDocumentSheetsTyped } from '../seam/rewrite-document.ts';
import { ciceroEngine } from '../seam/index.ts';
import { STRING_SET_PROP, RUNNING_PROP, decodeContentFn as decodeContentFnTyped, decodePageName, decodeRead, FN_PREFIX } from '../src/gcpm-encoding.ts';
import { HAS_PROPERTY_PREFIX, authorSelectorOf, bareHasCount, decodeHasArgument } from '../src/data-beltype.ts';

/** The encoded string literals a rewritten sheet carries, unquoted, in order. */
const literals = (text: any) => [...text.matchAll(/"([^"]*)"/g)].map((m) => m[1]).filter((s) => s.startsWith(FN_PREFIX));

test('a sheet with nothing to rewrite comes back identical, and says so', () => {
  const source = '@page { size: A4; margin: 2cm; @top-center { content: counter(page) } }\nh1 { color: red }\n';
  const out = rewriteSheet(source);
  assert.equal(out.changed, false);
  assert.equal(out.text, source, 'a host only replaces a sheet the rewriter changed, so an untouched document must stay untouched');
  assert.equal(rewriteNote(out.counts), null);
});

test('string-set keeps its value text and loses only its property name', () => {
  const out = rewriteSheet("h2 { color: red; string-set: chapter content() ' — ' counter(n); font-size: 9pt }");
  assert.equal(out.counts.stringSet, 1);
  assert.match(out.text, new RegExp(`${STRING_SET_PROP}: chapter content\\(\\) ' — ' counter\\(n\\)`));
  assert.match(out.text, /color: red/, 'the declarations around it are the author\'s and do not move');
  assert.match(out.text, /font-size: 9pt/);
});

test('position: running() becomes the custom property holding the identifier alone', () => {
  const out = rewriteSheet('.rh { position: running(head); margin: 0 }');
  assert.equal(out.counts.running, 1);
  assert.equal(out.text, `.rh { ${RUNNING_PROP}: head; margin: 0 }`);
});

test('an ordinary position declaration is not touched', () => {
  const source = '.x { position: absolute } .y { position: fixed }';
  assert.equal(rewriteSheet(source).text, source);
});

test('string() and element() in a margin box become decodable literals, and the other terms stay', () => {
  const out = rewriteSheet('@page { @top-left { content: "first: " string(heading, first) } @top-center { content: element(head) } }');
  assert.equal(out.counts.content, 2);
  const [a, b] = literals(out.text);
  assert.deepEqual(decodeContentFn(a), { fn: 'string', name: 'heading', which: 'first' });
  assert.deepEqual(decodeContentFn(b), { fn: 'element', ident: 'head', which: 'first' });
  assert.match(out.text, /"first: "/, 'the author\'s own literal rides through beside the encoded one');
});

test('element() carries its keyword through the rewrite, as string() does', () => {
  const out = rewriteSheet('@page { @top-left { content: element(mark, last) } @bottom-center { content: element(mark, first-except) } }');
  assert.deepEqual(literals(out.text).map(decodeContentFn), [{ fn: 'element', ident: 'mark', which: 'last' }, { fn: 'element', ident: 'mark', which: 'first-except' }]);
});

test('string() with no second argument encodes GCPM\'s own default, and an unknown keyword falls back to it', () => {
  const one = rewriteSheet('@page { @top-center { content: string(chap) } }');
  assert.equal(decodeContentFn(literals(one.text)[0]).which, 'first');
  const two = rewriteSheet('@page { @top-center { content: string(chap, middle) } }');
  assert.equal(decodeContentFn(literals(two.text)[0]).which, 'first', 'a fifth keyword is not a reading this engine has; first is what GCPM makes the default');
});

test(':blank folds into a page name and the other three pseudo-classes stay where the parser keeps them', () => {
  const out = rewriteSheet('@page :blank { @top-center { content: none } }\n@page chapter:blank:left { margin: 1cm }\n@page :first { margin: 2cm }');
  assert.equal(out.counts.blank, 2);
  const names = [...out.text.matchAll(/@page ([^{]*)\{/g)].map((m) => m[1].trim());
  assert.deepEqual(names, ['__beltype-blank', 'chapter__beltype-blank:left', ':first']);
  assert.deepEqual(decodePageName('__beltype-blank'), { name: null, blank: true }, 'a bare :blank carries no page name, which is what holds its specificity at (0,1,0)');
  assert.deepEqual(decodePageName('chapter__beltype-blank'), { name: 'chapter', blank: true });
});

test('a page selector list becomes one rule per selector with the block repeated', () => {
  const out = rewriteSheet('@page :left, :right { margin: 1cm; @top-center { content: "x" } }');
  assert.equal(out.counts.split, 1);
  const names = [...out.text.matchAll(/@page ([^{]*)\{/g)].map((m) => m[1].trim());
  assert.deepEqual(names, [':left', ':right']);
  assert.equal([...out.text.matchAll(/margin: 1cm/g)].length, 2, 'the block is repeated whole — css-page-3 §4.1 makes the list a rule that applies to every page any selector matches');
});

test('a split carries the first pass\'s own encodings into every copy', () => {
  const out = rewriteSheet('@page :left, :blank { @top-center { content: string(chap, last) } }');
  const names = [...out.text.matchAll(/@page ([^{]*)\{/g)].map((m) => m[1].trim());
  assert.deepEqual(names, [':left', '__beltype-blank']);
  const decoded = literals(out.text).map(decodeContentFn);
  assert.equal(decoded.length, 2);
  for (const d of decoded) assert.deepEqual(d, { fn: 'string', name: 'chap', which: 'last' });
});

test('comments and formatting outside an edit survive byte for byte', () => {
  const source = '/* a note the author wrote */\nh2 {\n  /* and another */\n  string-set: chap content();\n}\n';
  const out = rewriteSheet(source);
  assert.match(out.text, /\/\* a note the author wrote \*\//);
  assert.match(out.text, /\/\* and another \*\//);
  assert.equal(out.text.split('\n').length, source.split('\n').length, 'a rename lands inside its own line, so provenance minted over the result still names the author\'s line');
});

test('a sheet css-tree cannot parse is returned untouched rather than half-rewritten', () => {
  const source = 'h2 { string-set: chap content()'; // no closing brace
  const out = rewriteSheet(source);
  assert.equal(typeof out.text, 'string');
});

test('the console note names what moved and what a reader will meet', () => {
  const out = rewriteSheet('h2 { string-set: c content() }\n@page :blank { margin: 0 }');
  const note = rewriteNote(out.counts);
  assert.match(note, /string-set/);
  assert.match(note, /@page :blank/);
  assert.match(note, /__beltype-blank/);
});

test('rewriting a rewritten sheet changes nothing — the encodings are not their own inputs', () => {
  const source = `h2 { string-set: chap content() }\n.rh { position: running(head) }\n@page :blank { @top-center { content: string(chap, last) element(head) } }`;
  const once = rewriteSheet(source);
  assert.equal(once.changed, true);
  const twice = rewriteSheet(once.text);
  assert.equal(twice.changed, false, 'a host that rewrites twice — a reload, a redraft — must not encode an encoding');
  assert.equal(twice.text, once.text);
});

test('an important declaration stays important through either rename', () => {
  const run = rewriteSheet('.rh { position: running(head) !important }');
  assert.match(run.text, new RegExp(`${RUNNING_PROP}: head !important`), 'the rename must not change which rule wins');
  const set = rewriteSheet('h2 { string-set: chap content() !important }');
  assert.match(set.text, /!important/);
});

test('a read becomes a var() of the property its meaning names, in place, in every spelling (*a pointer is a read*)', () => {
  const cases = [
    ['a::after { content: " " target-counter(attr(href url), page); }', 'a::after { content: " " var(--beltype-read-counter-attr-href-page-decimal, ""); }'],
    ['a::after { content: target-counter(attr(href), page) }', 'a::after { content: var(--beltype-read-counter-attr-href-page-decimal, "") }'],
    ['a::after { content: target-counter("#t", figure, lower-roman) }', 'a::after { content: var(--beltype-read-counter-url-_23_t-figure-lower_2d_roman, "") }'],
    ['a::after { content: target-counter(url(#t), figure) }', 'a::after { content: var(--beltype-read-counter-url-_23_t-figure-decimal, "") }'],
    ['a::after { content: ", in " target-text(attr(href url)) }', 'a::after { content: ", in " var(--beltype-read-text-attr-href-content, "") }'],
    ['a::after { content: " " target-counters(attr(href url), item, ".") }', 'a::after { content: " " var(--beltype-read-counters-attr-href-item-decimal-_2e_, "") }'],
    ['a::after { content: " (" target-counters(attr(href), item, ".", lower-roman) ")" }', 'a::after { content: " (" var(--beltype-read-counters-attr-href-item-lower_2d_roman-_2e_, "") ")" }']
  ];
  for (const [source, want] of cases) {
    const out = rewriteSheet(source);
    assert.equal(out.counts.reads, 1, source);
    assert.equal(out.text, want);
    const name = /var\((--[^,]+),/.exec(out.text)![1];
    assert.ok(decodeRead(name), 'the engine decodes what the host wrote');
  }
});

test('a read inside a content list keeps the list`s other terms and the declaration`s importance', () => {
  const out = rewriteSheet(`a.internalref::after { content: ' (pag. ' target-counter(attr(href), page) ') ' !important; color: red }`);
  assert.equal(out.text, `a.internalref::after { content: ' (pag. ' var(--beltype-read-counter-attr-href-page-decimal, "") ') ' !important; color: red }`, 'a real venue`s rule: only the function moves');
  assert.match(rewriteNote(out.counts), /target-counter\(\)\/target-text\(\)/);
});

test('a rule with no read, a form not read, and a read in a margin box are left as written', () => {
  for (const source of ['a::after { content: " " counter(figure) }', 'a::after { content: target-counters(attr(href), s) }', '@page { @top-center { content: target-counter(attr(href), page) } }']) {
    const out = rewriteSheet(source);
    assert.equal(out.counts.reads, 0);
    assert.equal(out.text, source);
  }
  const once = rewriteSheet('a::after { content: target-counter(attr(href), page) }');
  assert.equal(rewriteSheet(once.text).changed, false, 'a rewritten read is not its own input');
});

// *The measure runs under print media* (2026-10-06): the media pass.

test('a print group rule is opened, its rules stand at its level, and no line moves', () => {
  const source = '@media print {\n  @page { margin: 37.5pt }\n  p { width: 3em }\n}\nh1 { color: red }\n';
  const out = rewriteSheet(source);
  assert.equal(out.counts.opened, 1);
  assert.equal(out.counts.removed, 0);
  assert.doesNotMatch(out.text, /@media/);
  assert.match(out.text, /@page \{ margin: 37\.5pt \}/);
  assert.match(out.text, /p \{ width: 3em \}/);
  assert.equal(out.text.split('\n').length, source.split('\n').length, 'only the wrapper went, so every rule is on the line the author wrote it on');
  assert.equal(out.text.split('\n').findIndex((l: any) => l.includes('p { width')), source.split('\n').findIndex((l) => l.includes('p { width')));
  assert.match(rewriteNote(out.counts), /print media/);
});

test('all, only print, an uppercase PRINT and a list of the two open; a screen list is removed with its newlines kept', () => {
  for (const prelude of ['all', 'only print', 'PRINT', 'print, all', 'print /* why */']) {
    const out = rewriteSheet(`@media ${prelude} { a { color: red } }`);
    assert.equal(out.counts.opened, 1, prelude);
    assert.match(out.text, /a \{ color: red \}/);
  }
  const source = 'a { color: blue }\n@media screen {\n  a { color: red }\n  b { color: red }\n}\nc { color: green }\n';
  const out = rewriteSheet(source);
  assert.equal(out.counts.removed, 1);
  assert.doesNotMatch(out.text, /color: red/);
  assert.match(out.text, /a \{ color: blue \}/);
  assert.equal(out.text.split('\n').findIndex((l: any) => l.includes('c {')), source.split('\n').findIndex((l) => l.includes('c {')), 'a rule below a removed block keeps its line');
  assert.equal(rewriteSheet('@media screen, screen { a { color: red } }').counts.removed, 1);
});

test('a list naming both media, or carrying a feature, or not, is left exactly as written', () => {
  for (const source of [
    '@media screen, print { a { color: red } }',
    '@media all, screen { a { color: red } }',
    '@media print and (min-width: 10px) { a { color: red } }',
    '@media (min-width: 10px) { a { color: red } }',
    '@media not print { a { color: red } }',
    '@media screen and (color) { a { color: red } }',
    '@media { a { color: red } }'
  ]) {
    const out = rewriteSheet(source);
    assert.equal(out.changed, false, source);
    assert.equal(out.text, source);
  }
});

test('nested group rules are decided one by one: print in print opens twice, screen in print goes, print in screen goes with it', () => {
  const nest = rewriteSheet('@media print { @media all { a { color: red } } @media screen { b { color: red } } c { color: red } }');
  assert.deepEqual([nest.counts.opened, nest.counts.removed], [2, 1]);
  assert.doesNotMatch(nest.text, /@media/);
  assert.match(nest.text, /a \{ color: red \}/);
  assert.match(nest.text, /c \{ color: red \}/);
  assert.doesNotMatch(nest.text, /b \{/);
  const inside = rewriteSheet('@media screen { @media print { a { color: red } } h2 { string-set: c content() } }');
  assert.deepEqual([inside.counts.opened, inside.counts.removed, inside.counts.stringSet], [0, 1, 0], 'everything inside a removed block is gone, and counted as nothing');
  assert.equal(inside.text.trim(), '');
  const mixed = rewriteSheet('@media screen, print { @media print { a { color: red } } @media screen { b { color: red } } }');
  assert.match(mixed.text, /@media screen, print \{/, 'the untouched outer stays, and its inner groups are still decided');
  assert.doesNotMatch(mixed.text, /b \{/);
  assert.match(mixed.text, /a \{ color: red \}/);
});

test('the media pass composes with the renames: a string-set inside a print block is renamed once opened', () => {
  const out = rewriteSheet('@media print { h2 { string-set: chap content() } @page :blank { margin: 0 } }');
  assert.deepEqual([out.counts.opened, out.counts.stringSet, out.counts.blank], [1, 1, 1]);
  assert.match(out.text, new RegExp(`${STRING_SET_PROP}: chap content\\(\\)`));
  assert.match(out.text, /@page __beltype-blank \{/);
  assert.equal(rewriteSheet(out.text).changed, false, 'a rewritten sheet is not its own input');
});

test('a group rule that is not @media is not opened, and an @media inside @layer is', () => {
  assert.equal(rewriteSheet('@supports (display: grid) { a { color: red } } @layer base { b { color: red } }').changed, false);
  const out = rewriteSheet('@layer base { @media print { a { color: red } } }');
  assert.equal(out.text.replace(/\s+/g, ' ').trim(), '@layer base { a { color: red } }');
});

/** A node the way `rewriteDocumentSheets` reads one: the few members it touches. */
function fakeNode(tagName: any, attrs: any, text?: any) {
  return {
    tagName,
    id: attrs.id,
    textContent: text,
    replacedBy: null as any,
    hasAttribute: (k: any) => k in attrs,
    getAttribute: (k: any) => attrs[k] ?? null,
    replaceWith(n: any) { this.replacedBy = n; }
  };
}

test("the engine's own sheets are not rewritten: the interface sheet, its provision and the press sheet say @media screen and @media print on purpose", async (t) => {
  const interfaceText = readFileSync(new URL('../seam/cicero-interface.css', import.meta.url), 'utf8');
  assert.equal(rewriteSheet(interfaceText).changed, true, 'the control: rewritten as a sheet like any other, the interface sheet would lose its screen backdrop and wear its print surround on the screen');

  // The marks are the engine's own: the head fragment is what the shell splices and the editing tools compose.
  const head = ciceroEngine.headHtml('/');
  assert.match(head, /<link rel="stylesheet" data-beltype="cicero-interface" href="\/_beltype\/cicero-interface\.css">/);
  assert.match(head, /<style data-beltype="cicero-provision">/);

  const fetched: any[] = [];
  const iface = fakeNode('LINK', { rel: 'stylesheet', 'data-beltype': 'cicero-interface', href: '/_beltype/cicero-interface.css' });
  const press = fakeNode('STYLE', { id: '__beltype-press' }, '@media print { body { margin: 0 !important; } }');
  const provision = fakeNode('STYLE', { 'data-beltype': 'cicero-provision' }, ':root { line-height: 1.65; }');
  const author = fakeNode('STYLE', {}, '@media print { p { width: 3em } } @media screen { p { width: 9em } }');
  const linked = fakeNode('LINK', { rel: 'stylesheet', href: '/styles/a.css' });
  const doc = {
    baseURI: 'http://localhost/',
    defaultView: {
      location: { origin: 'http://localhost' },
      fetch: async (url: any) => { fetched.push(url); return { ok: true, text: async () => (url.endsWith('cicero-interface.css') ? interfaceText : '@media print { a { color: red } }') }; }
    },
    createElement: (tag: any) => ({ tag, textContent: '', attrs: {} as Record<string, any>, setAttribute(k: any, v: any) { this.attrs[k] = v; } }),
    querySelectorAll: () => [iface, press, provision, author, linked]
  };
  t.mock.method(console, 'info', () => {});

  const out = await rewriteDocumentSheets(doc);

  assert.deepEqual(fetched, ['http://localhost/styles/a.css'], 'the interface sheet is not even fetched');
  assert.equal(iface.replacedBy, null);
  assert.equal(press.textContent, '@media print { body { margin: 0 !important; } }');
  assert.equal(provision.textContent, ':root { line-height: 1.65; }');
  assert.equal(author.textContent!.includes('@media'), false, "the document's own style element is folded");
  assert.match(author.textContent, /p \{ width: 3em \}/);
  assert.doesNotMatch(author.textContent, /9em/);
  assert.match(linked.replacedBy!.textContent, /a \{ color: red \}/);
  assert.equal(out.changed, 2);
  assert.deepEqual([out.counts.opened, out.counts.removed], [2, 1]);
});

test('a sheet already judged is not fetched or judged again, a style edited in place is, and the links of a first run are fetched together', async (t) => {
  t.mock.method(console, 'info', () => {});
  let inFlight = 0;
  let mostInFlight = 0;
  const fetched: any[] = [];
  const style = fakeNode('STYLE', {}, '@media print { p { width: 3em } }');
  const a = fakeNode('LINK', { rel: 'stylesheet', href: '/a.css' });
  const b = fakeNode('LINK', { rel: 'stylesheet', href: '/b.css' });
  const doc = {
    baseURI: 'http://localhost/',
    defaultView: {
      location: { origin: 'http://localhost' },
      fetch: async (url: any) => {
        fetched.push(url);
        mostInFlight = Math.max(mostInFlight, ++inFlight);
        await new Promise<any>((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return { ok: true, text: async () => (url.endsWith('a.css') ? '@media print { a { color: red } }' : 'b { color: blue }') };
      }
    },
    createElement: (tag: any) => ({ tag, tagName: tag.toUpperCase(), textContent: '', attrs: {} as Record<string, any>, setAttribute(k: any, v: any) { this.attrs[k] = v; } }),
    querySelectorAll: () => [style, a, b].filter((n) => !n.replacedBy) // a replaced link has left the document
  };
  const judged = new WeakMap<any, any>();

  const first = await rewriteDocumentSheets(doc, judged);
  assert.equal(first.changed, 2);
  assert.equal(mostInFlight, 2, 'both links were asked for before either was answered');
  assert.deepEqual(fetched, ['http://localhost/a.css', 'http://localhost/b.css']);

  const folded = style.textContent;
  const second = await rewriteDocumentSheets(doc, judged);
  assert.equal(fetched.length, 2, 'the second call fetched nothing');
  assert.equal(second.changed, 0);
  assert.equal(style.textContent, folded, 'a judged style is left as it stands');

  style.textContent = '@media print { p { width: 5em } }';
  const third = await rewriteDocumentSheets(doc, judged);
  assert.equal(third.changed, 1, 'a style whose text is not the text it was judged at is judged again');
  assert.match(style.textContent, /5em/);
  assert.equal(fetched.length, 2);

  await rewriteDocumentSheets(doc, new WeakMap<any, any>());
  assert.equal(fetched.length, 3, 'a fresh memo judges the link still in the document again — the conditions moved');
});

// ── :has(), *one attribute has words* (2026-10-10) ─────────────────────────────────────────────────

/** The registry rule's arguments, read back the way the capture reads them. */
const registryOf = (text: any) => new Map([...text.matchAll(new RegExp(`${HAS_PROPERTY_PREFIX}([0-9a-z]+): ("(?:[^"\\\\]|\\\\.)*")`, 'g'))].map((m) => [m[1], decodeHasArgument(m[2])]));

test('a :has() becomes the union, in place and on its own line, and the sheet ends with the one rule that carries the arguments', () => {
  const source = 'section:has(> h2.mark) { background: red }\np:has(+ ul), li:has(> a) { margin: 0 }\n';
  const out = rewriteSheet(source);
  assert.equal(out.counts.has, 3);
  assert.equal(out.changed, true);
  assert.deepEqual(out.kept, []);
  const lines = out.text.split('\n');
  const guard = String.raw`, :where\(:not\(\[data-beltype~="fragment"\]\)\):has\(`;
  assert.match(lines[0], new RegExp(String.raw`^section:is\(:where\(\[data-beltype~="has:[0-9a-z]{6}"\]\):is\(\*, h2\.mark\)${guard}> h2\.mark\)\) \{ background: red \}$`));
  assert.match(lines[1], new RegExp(String.raw`^p:is\(:where\(\[data-beltype~="has:[0-9a-z]{6}"\]\):is\(\*, ul\)${guard}\+ ul${String.raw`:where\(:not\(\[data-beltype~="fragment"\]\)\)`}\)\), li:is\(:where\(\[data-beltype~="has:[0-9a-z]{6}"\]\):is\(\*, a\)${guard}> a\)\) \{ margin: 0 \}$`));
  assert.match(lines[2], /^:not\(\*\) \{ --beltype-has-/, 'the registry rule closes the sheet');
  assert.deepEqual([...registryOf(out.text).values()].sort(), ['+ ul', '> a', '> h2.mark']);
  assert.equal(authorSelectorOf(lines[0]), 'section:has(> h2.mark) { background: red }', 'and the inspector reads the rule as the author wrote it');
  assert.match(rewriteNote(out.counts), /3 :has\(\)/);
});

test('every line stays where the author put it, a multi-line argument included, and the second copy of the argument adds no line', () => {
  const source = 'a { color: red }\n.x:has(\n  > img,\n  + p.y\n) .z {\n  color: blue\n}\nb { color: green }\n';
  const out = rewriteSheet(source);
  const body = out.text.replace(/\n:not\(\*\) \{[^\n]*\}\n$/, '\n');
  assert.equal(body.split('\n').length, source.split('\n').length, 'the same number of lines before the registry rule');
  assert.equal(body.split('\n')[7], 'b { color: green }', 'and the rule below is on the line it was written on');
  assert.equal(authorSelectorOf(body), source.replace(':has(\n  > img,\n  + p.y\n)', ':has(\n  > img,\n  + p.y\n)'), 'and nothing else changed');
});

test('at any depth and in any grouping rule: inside :not(), :is(), @media, @layer, @supports and a nested rule', () => {
  const source = [
    'li:not(:has(> a)) { x: y }',
    ':is(p:has(+ ul), q) { x: y }',
    '@media print { b:has(> i) { x: y } }',
    '@layer base { c:has(~ d) { x: y } }',
    '@supports (display: grid) { e:has(> f) { x: y } }',
    '.n { &:has(> a) { x: y } }',
    'g:has(:scope > h) { x: y }'
  ].join('\n');
  const out = rewriteSheet(source);
  assert.deepEqual(out.kept.map((k: any) => k.replace(/ \(.*$/, '')), ['g:has(:scope > h)'], ':scope is the one thing left: its argument is relative to the element asked');
  assert.equal(out.counts.has, 6, 'the nested rule\'s & stands outside the argument, so it is rewritten');
  assert.equal(bareHasCount(out.text.split('\n').slice(0, 6).join('\n')), 0, 'every :has( of the first six rules is inside a union');
  assert.match(out.text.split('\n')[0], /^li:not\(:is\(:where/);
});

test('an argument that reads user state is left as written, and named; the rest of its selector list is rewritten', () => {
  for (const state of [':hover', ':checked', ':focus-within', ':target', ':focus-visible', ':active', ':visited', ':user-invalid']) {
    const out = rewriteSheet(`label:has(input${state}) { x: y }`);
    assert.equal(out.counts.has, 0, state);
    assert.equal(out.changed, false, `${state}: nothing to change`);
    assert.equal(out.kept.length, 1);
    assert.match(out.kept[0], new RegExp(`\\(${state}\\)$`));
  }
  const mixed = rewriteSheet('a:has(b), c:has(d:hover) { x: y }');
  assert.equal(mixed.counts.has, 1);
  assert.equal(bareHasCount(mixed.text), 1, 'the capture sees one :has( nothing answers for, so the document keeps whole copies');
});

test('the hash is six base-36 characters of the canonical argument: whitespace and comments do not change it, the argument does, and a collision widens', () => {
  const hashOf = (css: any) => [...registryOf(rewriteSheet(css).text).keys()][0];
  const a = hashOf('p:has(> a.x) { x: y }');
  assert.match(a, /^[0-9a-z]{6,}$/);
  assert.equal(a.length, 6);
  assert.equal(hashOf('p:has(  >   a.x  ) { x: y }'), a);
  assert.equal(hashOf('p:has(/* c */ > a.x) { x: y }'), a);
  assert.notEqual(hashOf('p:has(> a.y) { x: y }'), a);
  assert.equal(hashOf('li:has(> a.x) { x: y }'), a, 'one argument, one hash, whichever rule carries it');
});

test('a rewritten sheet is not its own input, and a sheet with no :has() is untouched', () => {
  const once = rewriteSheet('p:has(+ ul) { x: y }');
  assert.equal(rewriteSheet(once.text).changed, false);
  const plain = '@page { margin: 1cm }\np > a { x: y }\n';
  assert.equal(rewriteSheet(plain).text, plain);
  assert.equal(rewriteSheet('p::after { content: ":has(" }').changed, false, 'a :has( in a string is not a selector');
});

test('the native arm never finds a COPY among the siblings it looks at: the guard follows each compound a leading + or ~ reaches, and stops at the first other combinator (case 102)', () => {
  const guard = ':where(:not([data-beltype~="fragment"]))';
  const native = (argument: any) => {
    const out = rewriteSheet(`x:has(${argument}) { y: z }\n`);
    const text = out.text.split('\n')[0];
    const head = ` ${guard}:has(`;
    const at = text.indexOf(head);
    return text.slice(at + head.length, text.lastIndexOf(')) {'));
  };
  assert.equal(native('~ section p.warn'), `~ section${guard} p.warn`, 'the sibling is guarded; what is inside it is its own subtree');
  assert.equal(native('+ p'), `+ p${guard}`);
  assert.equal(native('+ p + p'), `+ p${guard} + p${guard}`, 'a chain of siblings guards every link');
  assert.equal(native('+ p ~ ul li'), `+ p${guard} ~ ul${guard} li`);
  assert.equal(native('+ p > a'), `+ p${guard} > a`, 'a child combinator leaves the sibling run');
  assert.equal(native('> a'), '> a', 'a child is no sibling');
  assert.equal(native('a ~ b'), 'a ~ b', 'a descendant argument has no sibling run of its own');
  assert.equal(native('+ p, > a, ~ b'), `+ p${guard}, > a, ~ b${guard}`, 'each selector of the list on its own');
  // The author's rule reads back as the author wrote it, guards and all.
  const out = rewriteSheet('x:has(+ p + p) { y: z }\n').text.split('\n')[0];
  assert.equal(authorSelectorOf(out), 'x:has(+ p + p) { y: z }');
});

// ── a reference inside a nested rule (*a pointer is a read*, B2) ────────────────────────────────────
// css-tree 3.2.1 parses a nested rule as a Rule only when it opens with `&`. A bare `a::after { … }` in a style block comes out as a Declaration whose value is a Raw, and that Raw swallows the rest of the statement, including a declaration written after it. The rewrite must reach the rule anyway, at its own offset.

test('a reference in a nested & rule is rewritten in place (css-tree already parses this spelling)', () => {
  const source = '.toc {\n  & a::after { content: " " target-counter(attr(href url), page); }\n}\n';
  const out = rewriteSheet(source);
  assert.equal(out.counts.reads, 1);
  assert.equal(out.text, '.toc {\n  & a::after { content: " " var(--beltype-read-counter-attr-href-page-decimal, ""); }\n}\n');
});

test('a reference in a bare nested rule is rewritten in place, at the offset the author wrote it', () => {
  const source = '.toc {\n  a::after { content: " " target-counter(attr(href url), page); }\n}\n';
  const out = rewriteSheet(source);
  assert.equal(out.counts.reads, 1);
  assert.equal(out.text, '.toc {\n  a::after { content: " " var(--beltype-read-counter-attr-href-page-decimal, ""); }\n}\n');
});

test('a reference in a nested rule under a nested print media is rewritten, and the media wrapper is opened in place', () => {
  const source = '.toc {\n  @media print {\n    a::after { content: " " target-counter(attr(href url), page); }\n  }\n}\n';
  const out = rewriteSheet(source);
  assert.equal(out.counts.opened, 1);
  assert.equal(out.counts.reads, 1);
  assert.equal(out.text, '.toc {\n  \n    a::after { content: " " var(--beltype-read-counter-attr-href-page-decimal, ""); }\n  \n}\n');
});

test('a declaration written after a swallowed nested rule survives byte for byte, and only the one function is replaced', () => {
  const source = '.toc {\n  a::after { content: " " target-counter(attr(href url), page); }\n  color: red;\n}\n';
  const out = rewriteSheet(source);
  assert.equal(out.counts.reads, 1);
  assert.equal(out.text, '.toc {\n  a::after { content: " " var(--beltype-read-counter-attr-href-page-decimal, ""); }\n  color: red;\n}\n');
});

// ── the author's sheets in a layer the host names (2026-10-17) ──────────────────────────────────────

import { parse as parseTyped } from '../seam/csstree.ts';
import { wrapInLayer } from '../seam/rewrite.ts';
import { LAYER as ENGINE_LAYER, WORDS_RULES } from '../src/data-beltype.ts';
import { LAYERS_ID } from '../src/dressing.ts';
import { byShape } from './fakes.ts';

const decodeContentFn = byShape(decodeContentFnTyped);
const rewriteNote = byShape(rewriteNoteTyped);
const rewriteSheet = byShape(rewriteSheetTyped);
const rewriteDocumentSheets = byShape(rewriteDocumentSheetsTyped);
const parse = byShape(parseTyped);

/** A sheet with every kind of top-level thing the wrap has to decide about. */
const LAYERED_SOURCE = [
  '@charset "utf-8";',
  '@import url(base.css);',
  '/* the author\'s comment */',
  'p { text-indent: 1em }',
  '@font-face { font-family: X; src: url(x.woff2) }',
  'h2 { string-set: chapter content(); color: red }',
  '@counter-style thumbs { system: cyclic; symbols: "👍"; }',
  '@page { size: A5; @top-center { content: string(chapter) } }',
  'a::after { content: target-counter(attr(href), page) }',
  'section:has(> h2) { break-before: page }',
  '@media print { q { quotes: none } }',
  '@media screen { q { color: blue } }',
  ''
].join('\n');

/** The top level of a sheet, as css-tree reads it: one entry per rule, `@name` for an at-rule. */
const topLevel = (text: any) => parse(text, { positions: true, parseAtrulePrelude: false, parseRulePrelude: false, parseValue: false }).children.toArray().filter((n: any) => n.type !== 'Comment').map((n: any) => (n.type === 'Atrule' ? `@${n.name}` : 'rule'));

test('without a layer the rewrite is byte-identical to what it was, and identical by reference where nothing matched', () => {
  const plain = rewriteSheet(LAYERED_SOURCE);
  assert.equal(rewriteSheet(LAYERED_SOURCE, {}).text, plain.text);
  assert.equal(rewriteSheet(LAYERED_SOURCE, { layer: null }).text, plain.text);
  const untouched = 'h1 { color: red }\n';
  assert.equal(rewriteSheet(untouched, { layer: null }).text, untouched);
  assert.equal(plain.rewrote, plain.changed);
  assert.equal(plain.layered, false);
});

test('the wrap keeps every line where the author put it, and adds none', () => {
  const out = rewriteSheet(LAYERED_SOURCE, { layer: 'author' });
  assert.equal(out.layered, true);
  const before = rewriteSheet(LAYERED_SOURCE).text.split('\n');
  const after = out.text.split('\n');
  assert.equal(after.length, before.length);
  before.forEach((line: any, i: any) => assert.ok(after[i].includes(line.trim()), `line ${i + 1} is still "${line.trim()}" (now "${after[i]}")`));
});

test('the at-rules a layer may not hold stay at the top level, between blocks closed before and opened after them, and the head of the sheet stays first', () => {
  const out = rewriteSheet(LAYERED_SOURCE, { layer: 'author' });
  assert.deepEqual(topLevel(out.text), ['@charset', '@import', '@layer', '@font-face', '@layer', '@counter-style', '@page', '@layer']);
  assert.match(out.text, /^@charset "utf-8";\n@import url\(base\.css\);\n/, 'no block opens before the @import, which must precede every rule');
  assert.equal(topLevel(out.text).filter((n: any) => n === '@layer').length, 3, 'a block that would only open and close is never written: none between @counter-style and @page');
});

test('the GCPM, reads, media and :has() rewrites are the same inside the wrap as outside it', () => {
  const wrapped = rewriteSheet(LAYERED_SOURCE, { layer: 'author' });
  const plain = rewriteSheet(LAYERED_SOURCE);
  assert.deepEqual(wrapped.counts, plain.counts);
  assert.equal(wrapped.text, wrapInLayer(plain.text, 'author').text, 'the wrap is applied to the rewrite\'s own result, and to nothing else');
  for (const form of [`${STRING_SET_PROP}: chapter content()`, '"__beltype-fn:string(chapter,first)"', 'var(--beltype-read-', ':where([data-beltype~="has:', ':not(*) { --beltype-has-', ' q { quotes: none } ']) assert.ok(wrapped.text.includes(form) && plain.text.includes(form), `${form} is in both`);
  assert.doesNotMatch(wrapped.text, /color: blue/, 'the screen block is removed inside the wrap as outside');
});

test('the wrap is not applied twice: a wrapped sheet holds nothing but layer blocks and hoisted at-rules', () => {
  const once = rewriteSheet(LAYERED_SOURCE, { layer: 'author' }).text;
  const twice = rewriteSheet(once, { layer: 'author' });
  assert.equal(twice.text, once);
  assert.equal(wrapInLayer(once, 'author').wrapped, false);
});

test('a sublayer name is written as given, and a name that is not one is refused', () => {
  assert.equal(wrapInLayer('p { a: b }', 'author.base').text, '@layer author.base { p { a: b } }');
  assert.throws(() => wrapInLayer('p { a: b }', 'not a name'), TypeError);
});

test('with a layer, a document\'s style is wrapped, every link becomes a style of its wrapped text at its seat (the address is not kept: an imported sheet is parsed again in every frame), and the provision\'s root line-height moves into the engine\'s layer', async (t) => {
  t.mock.method(console, 'info', () => {});
  const provisionText = `${WORDS_RULES}:root { line-height: 1.65; }`;
  const provision = fakeNode('STYLE', { 'data-beltype': 'cicero-provision' }, provisionText);
  const style = fakeNode('STYLE', {}, 'p { color: red }');
  const plain = fakeNode('LINK', { rel: 'stylesheet', href: '/plain.css' });
  const paged = fakeNode('LINK', { rel: 'stylesheet', href: '/paged.css' });
  const gcpm = fakeNode('LINK', { rel: 'stylesheet', href: '/gcpm.css' });
  const texts: Record<string, string> = { '/plain.css': 'q { color: blue }', '/paged.css': '@page { size: A5 }\nh1 { color: red }', '/gcpm.css': 'h2 { string-set: t content() }' };
  const doc = {
    baseURI: 'http://localhost/',
    defaultView: { location: { origin: 'http://localhost' }, fetch: async (url: any) => ({ ok: true, text: async () => texts[new URL(url).pathname] }) },
    createElement: (tag: any) => ({ tag, tagName: tag.toUpperCase(), textContent: '', attrs: {} as Record<string, any>, setAttribute(k: any, v: any) { this.attrs[k] = v; } }),
    querySelectorAll: () => [provision, style, plain, paged, gcpm],
    head: { first: [] as any[], prepend(n: any) { this.first.unshift(n); } },
    getElementById: (id: any) => doc.head.first.find((n) => n.id === id) ?? null
  };
  const out = await rewriteDocumentSheets(doc, new WeakMap<any, any>(), { layer: 'author' });
  assert.equal(style.textContent, '@layer author { p { color: red } }');
  assert.equal(plain.replacedBy!.textContent, '@layer author { q { color: blue } }', 'a link with nothing else to rewrite is wrapped as text too');
  assert.equal(paged.replacedBy!.textContent, '@page { size: A5 }\n@layer author { h1 { color: red } }');
  assert.match(gcpm.replacedBy!.textContent, /^@layer author \{ h2 \{ --beltype-string-set: t content\(\) \} \}$/);
  assert.equal(provision.textContent, `${WORDS_RULES}@layer ${ENGINE_LAYER} { :root { line-height: 1.65; } }`);
  assert.deepEqual([out.changed, out.counts.layered], [4, 4], 'four sheets in the layer');
  assert.equal(doc.head.first.length, 1, 'the order of the two layers is stated first in the head');
  assert.equal(doc.head.first[0].id, LAYERS_ID);
  assert.equal(doc.head.first[0].textContent, `@layer ${ENGINE_LAYER}, author;`);
  await rewriteDocumentSheets(doc, new WeakMap<any, any>(), { layer: 'author' });
  assert.equal(doc.head.first.length, 1, 'and stated once, in the engine\'s own element');

  // and without one, the same document is what it always was
  const style2 = fakeNode('STYLE', {}, 'p { color: red }');
  const provision2 = fakeNode('STYLE', { 'data-beltype': 'cicero-provision' }, provisionText);
  const plain2 = fakeNode('LINK', { rel: 'stylesheet', href: '/plain.css' });
  const unlayered = { ...doc, querySelectorAll: () => [provision2, style2, plain2], head: { first: [] as any[], prepend(n: any) { this.first.push(n); } } };
  await rewriteDocumentSheets(unlayered, new WeakMap<any, any>());
  assert.equal(unlayered.head.first.length, 0, 'no order is stated');
  assert.equal(style2.textContent, 'p { color: red }');
  assert.equal(plain2.replacedBy, null);
  assert.equal(provision2.textContent, provisionText);
});

test('with pages: false (a host with no pages: the site engine) a declaration that reads a page is left as written, the other reads are rewritten, and nothing print-shaped is decided', () => {
  // The site reads (2026-10-19), ruling R2a: on a site nothing delivers a page, so `" (" target-text() ", p. " target-counter(page) ")"` would read "(Configuration, p. )"; left whole, the screen drops it as it always did. And a host with no pages cuts nothing for paper, so the media pass (*the measure runs under print media*) and the `:has()` union (for hollow page copies) do not run.
  const page = '.a::after { content: " (" target-text(attr(href url)) ", p. " target-counter(attr(href url), page) ")"; }';
  const counter = '.b::after { content: target-counter(attr(href url), chapter, upper-roman); }';
  const media = '@media screen { .c { color: red } } @media print { .d { color: blue } }';
  const has = 'section:has(> h1) > h1 { color: green }';
  const out = rewriteSheet([page, counter, media, has].join('\n'), { pages: false });
  const [a, b, c, d] = out.text.split('\n');
  assert.equal(a, page, 'the page read\'s whole declaration is the author\'s, as written');
  assert.match(b, /content: var\(--beltype-read-[^,]+, ""\)/, 'an author counter read is rewritten as ever');
  assert.equal(c, media, 'the media lists are the browser\'s to decide');
  assert.equal(d, has, ':has() is left native');
  assert.equal(out.counts.reads, 1);
  assert.deepEqual([out.counts.opened, out.counts.removed, out.counts.has], [0, 0, 0]);
  const running = rewriteSheet('.rh { position: running(head) }', { pages: false });
  assert.equal(running.counts.running, 1, 'a running element is still marked, so the host can see it');
  assert.equal(rewriteSheet(page, { pages: true }).counts.reads, 2, 'the default reads pages, as before');
});

test('string() in an element\'s content becomes a read of the property the page host publishes, its keyword written out; a margin box keeps the literal; a host with no pages leaves the declaration whole', () => {
  // The page carries its conditions (2026-10-21), ruling 3: Chromium drops every flow string() at parse (P39e), so the host rewrites it into the var() the page publishes, "" the fallback a site measured off the page reads.
  const flow = 'p.a::after { content: " " string(heading); } p.b::before { content: string(chapter-title, first-except) " — " counter(page); }';
  const out = rewriteSheet(flow);
  assert.equal(out.text, 'p.a::after { content: " " var(--beltype-string-heading-first, ""); } p.b::before { content: var(--beltype-string-chapter_2d_title-first-except, "") " — " counter(page); }');
  assert.equal(out.counts.strings, 2);
  const margin = rewriteSheet('@page { @top-center { content: string(heading, last); } }');
  assert.match(margin.text, /"__beltype-fn:string\(heading,last\)"/, 'the page side keeps its literal encoding');
  assert.equal(margin.counts.strings, 0);
  assert.equal(rewriteSheet(flow, { pages: false }).text, flow, 'a site reads a page, and a host with no pages leaves it whole, as it leaves a page read');
});
