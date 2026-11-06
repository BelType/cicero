/**
 * The reads, DOM-free (*a pointer is a read*, 2026-10-03).
 *
 * Four pure parts are pinned here: the property name that carries a read's meaning from the rewritten sheet to the engine (`gcpm-encoding.js`), the parse of the function as an author writes it, the counter a target shows after its own operations (`document-state.js`), and the delivery's own arithmetic — the fragment an address names, the selector a rule is keyed by, the sheet's text, and the comparison that says a run settled (`reads.js`). The rewrite branch itself is pinned beside the other rewrites, in `rewrite.test.js`. What needs a browser — finding the sites in the CSSOM, the page of a target, the measurement after delivery — is proved by `packages/essay`'s cases 79 to 82.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRead, decodeRead, parseReadFunction, READ_PREFIX } from '../src/gcpm-encoding.ts';
import { documentOpsOf as documentOpsOfTyped, counterStatesAfter, counterValue } from '../src/document-state.ts';
import { attrSelector, changedPairs, cssString, deliverySheetText, findSites, fragmentOf, hideSheetText as hideSheetTextTyped, hostSelector, RESERVATION } from '../src/reads.ts';
import { format } from '../src/counter-styles.ts';
import * as reads from '../src/reads.ts';
import { byShape } from './fakes.ts';

const documentOpsOf = byShape(documentOpsOfTyped);
const hideSheetText = byShape(hideSheetTextTyped);

test('the four spellings of an address, and the counter style, parse to one read each', () => {
  assert.deepEqual(parseReadFunction('target-counter', 'attr(href url), page'), { fn: 'counter', attr: 'href', url: null, counter: 'page', style: 'decimal' }, 'the shell`s spelling');
  assert.deepEqual(parseReadFunction('target-counter', 'attr(href), page'), { fn: 'counter', attr: 'href', url: null, counter: 'page', style: 'decimal' }, 'a venue`s spelling: the same read');
  assert.deepEqual(parseReadFunction('TARGET-COUNTER', '"#t", figure, lower-roman'), { fn: 'counter', attr: null, url: '#t', counter: 'figure', style: 'lower-roman' }, 'a string literal, and the optional counter style');
  assert.deepEqual(parseReadFunction('target-counter', 'url(#t), figure'), { fn: 'counter', attr: null, url: '#t', counter: 'figure', style: 'decimal' });
  assert.deepEqual(parseReadFunction('target-counter', 'url("#a b"), page'), { fn: 'counter', attr: null, url: '#a b', counter: 'page', style: 'decimal' });
  assert.deepEqual(parseReadFunction('target-text', 'attr(href url)'), { fn: 'text', attr: 'href', url: null, which: 'content' }, 'target-text() with no keyword reads `content`');
  assert.deepEqual(parseReadFunction('target-text', 'attr(href), before'), { fn: 'text', attr: 'href', url: null, which: 'before' });
});

test('a form this engine does not read parses to nothing, so the author`s declaration is left as written', () => {
  assert.equal(parseReadFunction('target-counters', 'attr(href), s'), null, 'target-counters() with no separator is not one it reads');
  assert.equal(parseReadFunction('counter', 'page'), null);
  assert.equal(parseReadFunction('target-counter', 'attr(href)'), null, 'no counter name');
  assert.equal(parseReadFunction('target-counter', 'href, page'), null, 'an identifier is not an address');
});

test('a read survives its own name: encode and decode are inverses, and the name is a plain custom property', () => {
  const reads = [
    { fn: 'counter', attr: 'href', url: null, counter: 'page', style: 'decimal' },
    { fn: 'counter', attr: null, url: '#chap_01 x', counter: 'my-figure', style: 'lower-roman' },
    { fn: 'text', attr: 'data-to', url: null, which: 'first-letter' },
    { fn: 'counter', attr: null, url: '#Ünïcode', counter: 'h2', style: 'decimal' }
  ];
  for (const r of reads) {
    const name = encodeRead((r as any));
    assert.ok(name.startsWith(READ_PREFIX));
    assert.match(name, /^--[A-Za-z0-9_-]+$/, 'only letters, digits, hyphens and underscores, so no serializer has anything to escape');
    assert.deepEqual(decodeRead(name), r);
  }
  assert.equal(encodeRead({ fn: 'counter', attr: 'href', url: null, counter: 'page', style: 'decimal' }), '--beltype-read-counter-attr-href-page-decimal', 'readable where the read is ordinary');
  assert.equal(decodeRead('--beltype-string-set'), null);
  assert.equal(decodeRead('--beltype-read-counter-nowhere-x-page-decimal'), null);
});

/** A plain element and the walk over it, as `document-state.test.js` builds them. */
const el = (style: any = {}, children: any[] = []) => ({ style, children });

test('a target shows its counter AFTER its own operations, in the innermost counter, forward or backward alike', () => {
  // Case 80's shape: <div.ch reset><p.fig inc #f1/><p.fig #f2/><p.fig #f3/></div> <div.ch reset><p #f4/><p #f5/><div.sub reset><p #f6/></div></div>
  const fig = () => el({ counterIncrement: 'figure 1' });
  const [f1, f2, f3, f4, f5, f6] = Array.from({ length: 6 }, fig);
  const ch1 = el({ counterReset: 'figure 0' }, [f1, f2, f3]);
  const sub = el({ counterReset: 'figure 0' }, [f6]);
  const ch2 = el({ counterReset: 'figure 0' }, [f4, f5, sub]);
  const section = el({}, [ch1, ch2]);
  const words = new Map([[section, 0], [ch1, 0], [f1, 0], [f2, 2], [f3, 4], [ch2, 6], [f4, 6], [f5, 8], [sub, 10], [f6, 10]]);
  const ops = documentOpsOf([section], { bases: [0, 12], wordsBefore: (e: any) => words.get(e) ?? 0 }, { styleOf: (e: any) => e.style, marks: new Set([f1, f3, f4, f5, f6, sub]) });
  const after = counterStatesAfter(ops);
  assert.equal(counterValue(after.get(f1), 'figure'), 1, 'its own increment is in force — what its own ::after shows');
  assert.equal(counterValue(after.get(f3), 'figure'), 3);
  assert.equal(counterValue(after.get(f4), 'figure'), 1, 'a later sibling`s reset starts a new counter, so not 4');
  assert.equal(counterValue(after.get(f5), 'figure'), 2);
  assert.equal(counterValue(after.get(f6), 'figure'), 1, 'the nested reset is the innermost counter: not 3 counting on from the chapter, not 6 counting every figure');
  assert.equal(counterValue(after.get(sub), 'figure'), 0, 'a mark that does nothing itself is still reached, in document order');
});

test('two elements opening at one word are two places: a heading sees its section`s reset, which strictly-before would not', () => {
  const h = el({ counterIncrement: 'chapter 1' });
  const s = el({ counterReset: 'chapter 4' }, [h]);
  const ops = documentOpsOf([s], { bases: [0, 3], wordsBefore: () => 0 }, { styleOf: (e: any) => e.style, marks: new Set([h]) });
  assert.equal(counterValue(counterStatesAfter(ops).get(h), 'chapter'), 5);
});

test('the value is spelled before it travels, in the style the read names', () => {
  assert.equal(format(2, 'lower-roman'), 'ii');
  assert.equal(cssString(format(11, 'decimal')), '"11"');
  for (const [control, escape] of [['\n', '\\a '], ['\r', '\\d '], ['\f', '\\c '], ['\u0000', '\\0 '], ['\u007f', '\\7f ']]) assert.equal(cssString(`a${control}b`), `"a${escape}b"`, 'a control character cannot end the string, in any of the forms CSS treats as a newline');
  assert.equal(cssString('The "Pequod" \\ x'), '"The \\"Pequod\\" \\\\ x"', 'a quote and a backslash in a target`s text are escaped, not trusted');
  assert.equal(RESERVATION, '0');
});

test('an address names a fragment of this document, or nothing', () => {
  const doc = 'http://localhost:1/cases/79/document.html';
  assert.equal(fragmentOf('#s1', doc, doc), 's1');
  assert.equal(fragmentOf('#caf%C3%A9', doc, doc), 'café', 'a percent-encoded fragment is the id it encodes');
  assert.equal(fragmentOf('document.html#s2', doc, doc), 's2', 'a relative URL back to this document is a fragment of it');
  assert.equal(fragmentOf('other.html#s2', doc, doc), null, 'another document is an error, css-content-3 §2.6.1');
  assert.equal(fragmentOf('#', doc, doc), null, 'no fragment');
  assert.equal(fragmentOf(null, doc, doc), null, 'no attribute');
});

test('a rule`s selector, without the pseudo-element the read stands in', () => {
  assert.equal(hostSelector('.toc-entry a::after'), '.toc-entry a');
  assert.equal(hostSelector('a:before, p.x::after'), 'a, p.x');
  assert.equal(hostSelector('::after'), '*');
  assert.equal(hostSelector('ul > ::before'), 'ul > *');
  assert.equal(hostSelector('a[title="x, y"]::after'), 'a[title="x, y"]', 'a comma inside an attribute selector does not split the list');
});

test('the delivery is one rule per target, keyed by the attribute, on the pseudo-elements alone', () => {
  const p = '--beltype-read-counter-attr-href-page-decimal';
  const q = '--beltype-read-text-attr-href-content';
  const values = new Map([
    [attrSelector('href', '#s1'), new Map([[p, '"1"'], [q, '"Loomings"']])],
    ['', new Map([['--beltype-read-counter-url-_23_t-page-decimal', '"3"']])],
    [attrSelector('href', '#empty'), new Map<any, any>()]
  ]);
  assert.equal(deliverySheetText(values), [
    `:where([href="#s1"])::before, :where([href="#s1"])::after { ${p}: "1"; ${q}: "Loomings"; }`,
    '::before, ::after { --beltype-read-counter-url-_23_t-page-decimal: "3"; }'
  ].join('\n'), 'two reads of one target share its rule; a literal address needs no key; nothing is written for nothing');
});

test('a run settles when the values it was laid out with are the values it produced', () => {
  const a = new Map([['k', new Map([['p', '"10"']])]]);
  assert.deepEqual(changedPairs(a, new Map([['k', new Map([['p', '"10"']])]])), []);
  assert.deepEqual(changedPairs(a, new Map([['k', new Map([['p', '"11"']])]])), ['k|p']);
  assert.deepEqual(changedPairs(a, new Map<any, any>()), ['k|p'], 'a value that disappeared — a target no longer placed — is a change too');
});

test('a resumed run starts every page read it knew at the value the run before it left, and a new one at the reservation (warm start)', async () => {
  const reservations = byShape((await import('../src/reads.ts')).reservations);
  const read = { fn: 'counter', counter: 'page', style: 'decimal' };
  const site = (key: any, prop = 'p') => ({ key, prop, read, target: {} } as any);
  const sites = [site('[href="#a"]'), site('[href="#b"]'), { ...site('[href="#c"]'), target: null }];
  const warm = new Map([['[href="#a"]', new Map([['p', '"55"']])]]);
  const cold = reservations(sites);
  assert.deepEqual([...cold.keys()], ['[href="#a"]', '[href="#b"]'], 'a reference with no target is not reserved');
  assert.equal(cold.get('[href="#a"]')?.get('p'), cssString(RESERVATION));
  const warmed = reservations(sites, warm);
  assert.equal(warmed.get('[href="#a"]')?.get('p'), '"55"', 'known: the number the last run delivered');
  assert.equal(warmed.get('[href="#b"]')?.get('p'), cssString(RESERVATION), 'unknown: the reservation');
  assert.deepEqual(changedPairs(warm, warmed).filter((id) => id.startsWith('[href="#a"]')), [], 'a warm start changes nothing the last run delivered');
});

test('the images are asked of the originals the host hands over, and the copies are never met', async () => {
  const awaitImages = byShape((await import('../src/measure.ts')).awaitImages);
  const img = (complete = true) => ({ localName: 'img', complete, loading: 'eager', addEventListener() {} });
  let asked = 0;
  const box = (...imgs: any[]) => ({ localName: 'section', querySelectorAll: () => { asked++; return imgs; } });
  const seen = await awaitImages(([box(img(), img()), img(), box(img())] as any));
  assert.equal(seen, 4, 'a box that is itself a picture counts, and each other box is asked once');
  assert.equal(asked, 2);
});

test('a reservation shown before the document is complete is painted invisible, in the pseudo-elements that read it, and only there', () => {
  const site = (key: any, pseudos: any) => ({ key, pseudos });
  assert.equal(hideSheetText([site('[href="#a"]', ['after']), site('[href="#b"]', ['before', 'after'])]), [
    'beltype-root :where([href="#a"])::after { visibility: hidden !important; }',
    'beltype-root :where([href="#b"])::before, beltype-root :where([href="#b"])::after { visibility: hidden !important; }'
  ].join('\n'));
  assert.equal(hideSheetText([site('[href="#a"]', ['after']), site('[href="#a"]', ['before'])]), 'beltype-root :where([href="#a"])::after, beltype-root :where([href="#a"])::before { visibility: hidden !important; }', 'two reads of one address are one rule');
  assert.equal(hideSheetText([site('', ['after']), site(null, ['after'])]), '', 'a literal address is keyed by nothing and its delivery rule reaches every pseudo-element, so there is nothing to scope the hiding to: it is left showing');
  assert.equal(hideSheetText([]), '');
  assert.equal(hideSheetText([site('[href="#a"]', ['after'])], '.view'), '.view :where([href="#a"])::after { visibility: hidden !important; }', 'a host that is not the root names the scope its pages stand in (*the engine knows no view*)');
});

/** A read's property name as the rewrite leaves it: the `target-counter()` of an href, in decimal. */
const hrefRead = encodeRead(({ fn: 'counter', attr: 'href', url: null, counter: 'page', style: 'decimal' } as any));
const readsContent = `var(${hrefRead}, "")`;
/** A rule's style double: its `content` is the given text, and nothing else is declared. */
const styled = (content: any) => ({ getPropertyValue: ( p: string) => (p === 'content' ? content : '') });
/** The found sites of a sheet, and every selector the document was asked for on the way. A document double with one link to `#s1`. */
function found(rules: any) {
  const asked: string[] = [];
  const link = { closest: () => null, getAttribute: ( n: string) => (n === 'href' ? '#s1' : null) };
  const doc = {
    styleSheets: [{ cssRules: rules }],
    adoptedStyleSheets: [],
    baseURI: 'https://x.test/d.html',
    URL: 'https://x.test/d.html',
    getElementById: ( id: string) => (id === 's1' ? { id } : null),
    querySelectorAll: ( sel: string) => { asked.push(sel); return [link]; }
  };
  return { sites: findSites((doc as any)), asked };
}

test('a top-level rule is asked as written, its pseudo-element taken off', () => {
  assert.deepEqual(found([{ type: 1, selectorText: 'a::after', style: styled(readsContent) }]).asked, ['a']);
});

test('a read in a nested rule written with its `&` is found: `& a::after` in `.toc` is asked as `:is(.toc) a`', () => {
  const { sites, asked } = found([{ type: 1, selectorText: '.toc', style: styled(''), cssRules: [
    { type: 1, selectorText: '& a::after', style: styled(readsContent) }
  ] }]);
  assert.deepEqual(asked, [':is(.toc) a']);
  assert.deepEqual(sites?.map((s) => s.pseudos), [['after']], 'the pseudo-element is the one the nested rule names');
});

test('two levels of nesting compose: each `&` is the parent`s resolved selector', () => {
  const { asked } = found([{ type: 1, selectorText: '.toc', style: styled(''), cssRules: [
    { type: 1, selectorText: '& .entry', style: styled(''), cssRules: [
      { type: 1, selectorText: '& a::after', style: styled(readsContent) }
    ] }
  ] }]);
  assert.deepEqual(asked, [':is(:is(.toc) .entry) a']);
});

test('a nested rule with no `&` is a descendant of its parent, and a leading combinator too', () => {
  assert.deepEqual(found([{ type: 1, selectorText: '.toc', style: styled(''), cssRules: [
    { type: 1, selectorText: 'a::after', style: styled(readsContent) }
  ] }]).asked, [':is(.toc) a']);
  assert.deepEqual(found([{ type: 1, selectorText: '.toc', style: styled(''), cssRules: [
    { type: 1, selectorText: '> a::after', style: styled(readsContent) }
  ] }]).asked, [':is(.toc) > a']);
});

test('a nested declarations rule (no selector of its own) takes its parent`s selector as its own', () => {
  const { sites, asked } = found([{ type: 1, selectorText: '.toc a::after', style: styled(''), cssRules: [
    { style: styled(readsContent) }
  ] }]);
  assert.deepEqual(asked, ['.toc a']);
  assert.deepEqual(sites?.map((s) => s.pseudos), [['after']]);
});

test('a group rule nested in a style rule is walked with the parent selector in scope', () => {
  assert.deepEqual(found([{ type: 1, selectorText: '.toc', style: styled(''), cssRules: [
    { type: 4, cssRules: [{ type: 1, selectorText: '& a::after', style: styled(readsContent) }] }
  ] }]).asked, [':is(.toc) a']);
});

test('target-counters() delivers every instance in scope, outermost first, each in the read`s style, joined by its separator', () => {
  const state = { item: [2, 1, 3] };
  assert.equal(reads.countersText(state, { counter: 'item', style: 'decimal', separator: '.' }), '2.1.3');
  assert.equal(reads.countersText(state, { counter: 'item', style: 'lower-roman', separator: '.' }), 'ii.i.iii', 'the style applies to each value');
  assert.equal(reads.countersText(state, { counter: 'item', style: 'decimal', separator: ' / ' }), '2 / 1 / 3', 'the separator is inserted between the values, and only there');
  assert.equal(reads.countersText({ item: [4] }, { counter: 'item', style: 'decimal', separator: '.' }), '4', 'a single instance is its value alone');
  assert.equal(reads.countersText({}, { counter: 'figure', style: 'decimal', separator: '.' }), '', 'a counter the document never mentioned shows the empty string, as counters() does');
  assert.equal(reads.countersText({ item: [] }, { counter: 'item', style: 'decimal', separator: '.' }), '');
});

test('a target-counters() read whose target does not exist shows nothing, and no delivery is written for it', () => {
  const site = { target: null, key: '[href="#gone"]', prop: '--beltype-read-counters-attr-href-item-decimal-_2e_', read: { fn: 'counters', attr: 'href', url: null, counter: 'item', style: 'decimal', separator: '.' }, pseudos: ['after'] };
  const { values, unread } = reads.staticValues([(site as any)], { doc: ({} as any), blocks: [] });
  assert.equal(values.size, 0);
  assert.deepEqual(unread, []);
});
