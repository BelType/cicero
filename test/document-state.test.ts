/**
 * The document's counters at a position, DOM-free (*a counter is read at the start of the page*, 2026-09-14).
 *
 * Both halves are exercised without a browser, which is the point of the split: the walk takes its computed styles from an injected `styleOf`, so a plain object tree with a `counter-increment` on it is a document as far as this module is concerned — the same posture `positions.js` takes with `indexBlocks`. What is pinned is CSS 2.1's *Nested counters and scope*, which is the part a reader cannot check by looking, and the **strictly before** rule, which is the whole of css-page-3 §6.1's *spans the page break* and the reason case 37's second page reads one rather than two.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type PageCounterOps, documentOpsOf as documentOpsOfTyped, counterStateAt as counterStateAtTyped, pageNumberAt, withoutPageCounters, counterStatesAfter, counterValue as counterValueTyped, counterValues, parseStringSet as parseStringSetTyped, stringAssignmentsOf, runningAssignmentsOf, namedStringsForPage } from '../src/document-state.ts';
import { STRING_SET_PROP } from '../src/gcpm-encoding.ts';
import { indexBlocks as indexBlocksTyped } from '../src/positions.ts';
import { byShape } from './fakes.ts';

const parseStringSet = byShape(parseStringSetTyped);
const documentOpsOf = byShape(documentOpsOfTyped);
const counterStateAt = byShape(counterStateAtTyped);
const counterValue = byShape(counterValueTyped);
const indexBlocks = byShape(indexBlocksTyped);

/** A plain element: `children`, and the three counter declarations a computed style would carry. */
const el = (style: any = {}, children: any[] = []): any => ({ style, children });

/**
 * A document of plain objects, with the position index's own two members faked over a word count per element.
 *
 * `words` is how many words of its block lie before an element, which is exactly what `index.wordsBefore` answers; `bases` is the prefix sum over blocks. Declaring both by hand rather than running `indexBlocks` keeps this suite about the counter arithmetic and lets a position sit exactly where a test wants it.
 */
function walk(blocks: any, bases: any, before: any, ancestors: any[] = []) {
  const index = { bases, wordsBefore: (e: any) => before.get(e) ?? 0 };
  return documentOpsOf(blocks, index, { styleOf: (e: any) => e.style, ancestors });
}

test('an increment with no reset anywhere behaves as though the root had reset it', () => {
  const h = el({ counterIncrement: 'chapter 1' });
  const block = el({}, [h]);
  const before = new Map([[block, 0], [h, 0]]);
  const ops = walk([block], [0, 4], before);
  assert.equal(counterValue(counterStateAt(ops, 4), 'chapter'), 1);
  assert.equal(counterValue(counterStateAt(ops, 4), 'never-mentioned'), 0, 'a counter the document never names reads zero rather than throwing');
});

test('an operation applies only when it lies STRICTLY before the position asked about', () => {
  // Two blocks, one word each. The heading opens block one; a page starting at block one must not count it.
  const h = el({ counterIncrement: 'chapter 1' });
  const b0 = el({}, []);
  const b1 = el({}, [h]);
  const before = new Map([[b0, 0], [b1, 0], [h, 0]]);
  const ops = walk([b0, b1], [0, 1, 2], before);
  assert.equal(counterValue(counterStateAt(ops, 1), 'chapter'), 0, 'the heading begins ON this page, so it does not span the break and is not yet in force — case 37`s second page in miniature');
  assert.equal(counterValue(counterStateAt(ops, 2), 'chapter'), 1, 'a page beginning after it counts it');
});

test('an ancestor above the blocks is in force on the first page, at position zero', () => {
  const body = el({ counterReset: 'chapter 7' });
  const block = el({}, []);
  const ops = walk([block], [0, 3], new Map([[block, 0]]), [el({}), body]);
  assert.equal(counterValue(counterStateAt(ops, 0), 'chapter'), 7, 'html and body open before the document`s first word and span every break there is — recorded at −1, which is what makes position zero answer at all');
});

test('a reset opens a scope that carries to following siblings, and a nested reset nests', () => {
  // <section reset=c><h/><h/></section><section reset=c><h/></section> — the second section restarts the count.
  const mk = (n: any) => Array.from({ length: n }, () => el({ counterIncrement: 'c 1' }));
  const one = mk(2);
  const two = mk(1);
  const s1 = el({ counterReset: 'c 0' }, one);
  const s2 = el({ counterReset: 'c 0' }, two);
  const block = el({}, [s1, s2]);
  const before = new Map([[block, 0], [s1, 0], [one[0], 0], [one[1], 1], [s2, 2], [two[0], 2]]);
  const ops = walk([block], [0, 9], before);
  assert.equal(counterValue(counterStateAt(ops, 2), 'c'), 2, 'both headings of the first section');
  assert.deepEqual(counterValues(counterStateAt(ops, 3), 'c'), [1], 'the following sibling`s reset REPLACES its predecessor rather than nesting inside it — one instance, restarted');

  // <outer reset=c><h/><inner reset=c><h/></inner></outer> — counters() must report both.
  const outerH = el({ counterIncrement: 'c 1' });
  const innerH = el({ counterIncrement: 'c 1' });
  const inner = el({ counterReset: 'c 0' }, [innerH]);
  const outer = el({ counterReset: 'c 0' }, [outerH, inner]);
  const nested = el({}, [outer]);
  const nb = new Map([[nested, 0], [outer, 0], [outerH, 0], [inner, 1], [innerH, 1]]);
  const nops = walk([nested], [0, 9], nb);
  assert.deepEqual(counterValues(counterStateAt(nops, 2), 'c'), [1, 1], 'outermost first — this is what counters(c, ".") joins');
  assert.equal(counterValue(counterStateAt(nops, 2), 'c'), 1, 'counter() takes the innermost');
});

test('a reset`s scope reaches its FOLLOWING SIBLINGS, and ends when the walk leaves their parent', () => {
  // <section reset=c><h inc/></section><p inc/> — p is a following sibling of the section, so CSS 2.1 puts it inside the scope and the count continues.
  const h = el({ counterIncrement: 'c 1' });
  const s = el({ counterReset: 'c 0' }, [h]);
  const p = el({ counterIncrement: 'c 1' });
  const block = el({}, [s, p]);
  const before = new Map([[block, 0], [s, 0], [h, 0], [p, 1]]);
  assert.deepEqual(counterValues(counterStateAt(walk([block], [0, 9], before), 5), 'c'), [2], 'the following sibling is IN scope — "the element`s descendants and the element`s following siblings with their descendants"');

  // <outer><section reset=c><h inc/></section></outer><p inc/> — now p is a sibling of the section's PARENT, so the scope is over and p acts on a counter of its own.
  const h2 = el({ counterIncrement: 'c 1' });
  const s2 = el({ counterReset: 'c 0' }, [h2]);
  const outer = el({}, [s2]);
  const p2 = el({ counterIncrement: 'c 1' });
  const block2 = el({}, [outer, p2]);
  const b2 = new Map([[block2, 0], [outer, 0], [s2, 0], [h2, 0], [p2, 1]]);
  assert.deepEqual(counterValues(counterStateAt(walk([block2], [0, 9], b2), 5), 'c'), [1], 'one instance, reset by nothing and implicitly created at the root — the section`s scope ended with the section`s parent');
});

test('counter-set acts on the innermost instance, and counter-reset takes the number the author wrote', () => {
  const a = el({ counterReset: 'n 5' });
  const b = el({ counterIncrement: 'n 3' });
  const c = el({ counterSet: 'n 100' });
  const d = el({ counterIncrement: 'n' });
  const block = el({}, [a, b, c, d]);
  const before = new Map([[block, 0], [a, 0], [b, 1], [c, 2], [d, 3]]);
  const ops = walk([block], [0, 9], before);
  assert.equal(counterValue(counterStateAt(ops, 2), 'n'), 8);
  assert.equal(counterValue(counterStateAt(ops, 3), 'n'), 100);
  assert.equal(counterValue(counterStateAt(ops, 4), 'n'), 101, 'a bare counter-increment is one, which is the property`s own default rather than a number typed here');
});

test('a display:none element increments nothing, which is CSS 2.1`s own rule', () => {
  const hidden = el({ display: 'none', counterIncrement: 'c 1' }, [el({ counterIncrement: 'c 1' })]);
  const shown = el({ counterIncrement: 'c 1' });
  const block = el({}, [hidden, shown]);
  const before = new Map([[block, 0], [hidden, 0], [shown, 0]]);
  const ops = walk([block], [0, 9], before);
  assert.equal(counterValue(counterStateAt(ops, 5), 'c'), 1, 'neither the hidden element nor its subtree counts');
});

test('several counters on one declaration, and the values that are not counters', () => {
  const e = el({ counterReset: 'a 2 b' });
  const block = el({}, [e]);
  const ops = walk([block], [0, 9], new Map([[block, 0], [e, 0]]));
  const state = counterStateAt(ops, 5);
  assert.equal(counterValue(state, 'a'), 2);
  assert.equal(counterValue(state, 'b'), 0, 'a name with no number takes the property`s default, which for counter-reset is zero');

  const none = el({ counterReset: 'none', counterIncrement: '', counterSet: 'none' });
  const nb = el({}, [none]);
  assert.deepEqual(walk([nb], [0, 9], new Map([[nb, 0], [none, 0]])), [], 'an element that does nothing is not in the log at all');

  const rev = el({ counterReset: 'reversed(x) 4 y 1' });
  const rb = el({}, [rev]);
  const rops = walk([rb], [0, 9], new Map([[rb, 0], [rev, 0]]));
  const rstate = counterStateAt(rops, 5);
  assert.equal(counterValue(rstate, 'y'), 1, 'a reversed() counter is skipped by name, and the ordinary counter beside it still reads');
  assert.equal(counterValue(rstate, 'x'), 0, 'reversed() is css-lists-3`s and is not modelled — named, not guessed at');
});

test('the state is plain data, so it crosses a page.evaluate boundary like every other condition', () => {
  const h = el({ counterIncrement: 'chapter 1' });
  const block = el({}, [h]);
  const ops = walk([block], [0, 4], new Map([[block, 0], [h, 0]]));
  const state = counterStateAt(ops, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state, 'no Map, no class, nothing a structured clone would empty in silence');
});

/**
 * THE SECOND KIND OF OPERATION — GCPM's named strings, on the same walk and the same log (*the host rewrites what the parser drops*, 2026-09-14).
 *
 * `string-set` reaches this module as the custom property a host rewrote it into, so a plain object tree declares it by that name and nothing here knows how it got there. What is pinned is the `<content-list>` grammar, the evaluation moment (the element's own counters already in force), and §1.1.2's four keywords over a page's interval — which is the part a reader cannot check by looking and the part case 40 exists to show.
 */

const strung = (value: any, extra: any = {}) => ({ [STRING_SET_PROP]: value, ...extra });

test('a content list is parsed into the terms GCPM names, and nothing more of CSS', () => {
  assert.deepEqual(parseStringSet("chap content() ' — ' counter(n, upper-roman)"), [{
    name: 'chap',
    terms: [
      { kind: 'content', which: 'text' },
      { kind: 'string', value: ' — ' },
      { kind: 'counter', name: 'n', style: 'upper-roman' }
    ]
  }]);
  assert.equal(parseStringSet('none').length, 0);
  assert.equal(parseStringSet('').length, 0);
  assert.equal(parseStringSet("a 'x, y'")[0].terms[0].value, 'x, y', 'a comma inside a string is not a pair separator');
  assert.deepEqual(parseStringSet('a content(), b attr(title)').map((p: any) => p.name), ['a', 'b'], 'the declaration is a comma-separated list of pairs');
});

test('the terms evaluate against the element, and content() collapses its whitespace as white-space: normal would', () => {
  const h = el(strung('chap content()'), []);
  h.text = '  Of the\n  Whale  ';
  const block = el({}, [h]);
  const ops = documentOpsOf([block], { bases: [0, 9], wordsBefore: () => 0 }, { styleOf: (e: any) => e.style, textOf: (e: any) => e.text ?? '' });
  assert.deepEqual(stringAssignmentsOf(ops), [{ name: 'chap', pos: 0, value: 'Of the Whale' }]);
});

test('attr() reads the attribute the term names, and only the ones a term names', () => {
  const s = el(strung('head attr(title)'));
  s.attrs = { title: 'Loomings', lang: 'en' };
  const block = el({}, [s]);
  const ops = documentOpsOf([block], { bases: [0, 9], wordsBefore: () => 0 }, { styleOf: (e: any) => e.style, textOf: () => '', attrOf: (e: any, n: any) => e.attrs?.[n] });
  assert.equal(stringAssignmentsOf(ops)[0].value, 'Loomings');
  assert.deepEqual(Object.keys(ops[0].strings[0].attrs), ['title'], 'the walk carries what the terms ask for, so the pure half never needs a node');
});

test('a counter inside a content list reads the value the element itself just set', () => {
  const h = el(strung('head "Chapter " counter(chapter)', { counterIncrement: 'chapter 1' }));
  h.text = 'Loomings';
  const block = el({}, [h]);
  const ops = documentOpsOf([block], { bases: [0, 9], wordsBefore: () => 0 }, { styleOf: (e: any) => e.style, textOf: (e: any) => e.text ?? '' });
  assert.equal(stringAssignmentsOf(ops)[0].value, 'Chapter 1', 'GCPM assigns at the point the content box is created — the heading that opens chapter one names chapter one, not the chapter before it');
});

test('the four keywords over one page, against the specification\'s own worked example', () => {
  // Page one opens with Alpha and sets Beta lower down; page two sets nothing; page three sets Gamma below a paragraph. The positions are case 40's own shape.
  const a = [
    { name: 'heading', pos: 0, value: 'Alpha' },
    { name: 'heading', pos: 40, value: 'Beta' },
    { name: 'heading', pos: 200, value: 'Gamma' }
  ];
  assert.deepEqual(namedStringsForPage(a, 0, 100).heading, { first: 'Alpha', start: 'Alpha', last: 'Beta', 'first-except': '' });
  assert.deepEqual(namedStringsForPage(a, 100, 180).heading, { first: 'Beta', start: 'Beta', last: 'Beta', 'first-except': 'Beta' });
  assert.deepEqual(namedStringsForPage(a, 180, null).heading, { first: 'Gamma', start: 'Beta', last: 'Gamma', 'first-except': '' });
});

test('start turns on whether the assigning element OPENS the page, which is the pair of readings that differ', () => {
  const a = [{ name: 'h', pos: 50, value: 'X' }];
  assert.equal(namedStringsForPage(a, 50, 90).h.start, 'X', 'the element is the first element on the page');
  assert.equal(namedStringsForPage(a, 49, 90).h.start, '', 'one word earlier and the page did not open with it, so the entry value stands — empty, since the element has not yet appeared');
});

test('an entry value is the assignment in effect at the end of the PREVIOUS page, and empty where there is none', () => {
  const a = [{ name: 'h', pos: 10, value: 'One' }, { name: 'h', pos: 20, value: 'Two' }];
  assert.deepEqual(namedStringsForPage(a, 0, 5).h, { first: '', start: '', last: '', 'first-except': '' });
  assert.equal(namedStringsForPage(a, 30, null).h.first, 'Two', 'the last assignment before the page, not the first');
  assert.deepEqual(namedStringsForPage([], 0, null), {}, 'a document that sets no named string offers no readings to answer');
});

test('the readings are plain data, so they cross a page.evaluate boundary like the counters beside them', () => {
  const out = namedStringsForPage([{ name: 'h', pos: 0, value: 'X' }], 0, null);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out);
});

// AN AUTHOR COUNTER IS DELIVERED AT EACH PAGE'S START (2026-10-14): the page-start state, level by level.
test('counterLevels: one list per nesting level, outermost first, each counter at the levels it has an instance', async () => {
  const counterLevels = byShape((await import('../src/document-state.ts')).counterLevels);
  assert.deepEqual(counterLevels({ fig: [4] }), [[['fig', 4]]]);
  assert.deepEqual(counterLevels({ fig: [4, 3], sub: [1] }), [[['fig', 4], ['sub', 1]], [['fig', 3]]]);
  assert.deepEqual(counterLevels({ item: [2, 1, 3] }), [[['item', 2]], [['item', 1]], [['item', 3]]]);
  assert.deepEqual(counterLevels({ n: [-2, 0] }), [[['n', -2]], [['n', 0]]], 'a negative or zero value is a value');
  assert.deepEqual(counterLevels({}), []);
  assert.deepEqual(counterLevels(null), []);
});

test('an assignment and a counter operation in a carried flow`s remainder are on the page the flow continues on (beltype#43)', () => {
  // Case 112 in miniature: page 0's interval is [0, 32), page 1's [32, 44); the float's remainder [12, 20) is carried from page 0 to page 1. The marked element sits at word 15.
  const a = [{ name: 'who', pos: 15, value: 'r0w015' }];
  const away = [{ from: 12, to: 20 }];
  assert.deepEqual(namedStringsForPage(a, 0, 32, { away }).who, { first: '', start: '', last: '', 'first-except': '' }, 'nothing is assigned on page 0');
  assert.deepEqual(namedStringsForPage(a, 32, 44, { into: away }).who, { first: 'r0w015', start: '', last: 'r0w015', 'first-except': '' }, 'page 1 assigns it, and does not open with it');
  assert.deepEqual(namedStringsForPage(a, 44, null).who, { first: 'r0w015', start: 'r0w015', last: 'r0w015', 'first-except': 'r0w015' }, 'page 2 carries it in');
  const ops = [{ reset: [['fig', 0]], increment: [], set: [], pos: -1, depth: 0 }, { reset: [], increment: [['fig', 1]], set: [], pos: 15, depth: 2 }];
  assert.equal(counterValue(counterStateAt(ops, 32, away), 'fig'), 0, 'page 1 starts before the increment it shows');
  assert.equal(counterValue(counterStateAt(ops, 44), 'fig'), 1, 'page 2 starts after it');
});

// A RUNNING ELEMENT IS A NAMED NODE (2026-10-21): position: running() is a third kind of operation in the one log, and element()'s keywords are string()'s arithmetic.
test('a running element is logged where the flow stood when it was written, and element()`s four keywords are string()`s arithmetic with null for none', () => {
  // Case 118 in miniature: five one-block pages of ten words, Alder written before block 2 (page three), Birch between blocks 5 and 6 (the middle of page five).
  const blocks = Array.from({ length: 7 }, () => el());
  const bases = [0, 10, 20, 30, 40, 45, 50, 55];
  const ops = documentOpsOf(blocks, { bases, wordsBefore: () => 0 }, { styleOf: (e: any) => e.style, running: [{ name: 'mark', pos: 20 }, { name: 'mark', pos: 45 }] });
  const a = runningAssignmentsOf(ops);
  assert.deepEqual(a, [{ name: 'mark', value: 0, pos: 20 }, { name: 'mark', value: 1, pos: 45 }], 'each where the flow stood, its value its place in the list');
  assert.deepEqual(ops.map((op: any) => op.pos), [...ops.map((op: any) => op.pos)].sort((x, y) => x - y), 'the log stays in position order, which the replay`s early stop needs');
  const page = (start: any, end: any) => namedStringsForPage(a, start, end, {}, null).mark;
  const none = { first: null, start: null, last: null, 'first-except': null };
  assert.deepEqual(page(0, 10), none, 'before the first assignment there is no entry value: no element');
  assert.deepEqual(page(10, 20), none);
  assert.deepEqual(page(20, 30), { first: 0, start: 0, last: 0, 'first-except': null }, 'the page the first opens');
  assert.deepEqual(page(30, 40), { first: 0, start: 0, last: 0, 'first-except': 0 }, 'a page that assigns nothing shows the entry value');
  assert.deepEqual(page(40, null), { first: 1, start: 0, last: 1, 'first-except': null }, 'the second assigned mid-page: start keeps the entry value');
});

test('a running element after the last block stands at the document`s end, and one before the first opens page one', () => {
  const ops = documentOpsOf([el(), el()], { bases: [0, 4, 8], wordsBefore: () => 0 }, { styleOf: (e: any) => e.style, running: [{ name: 'h', pos: 0 }, { name: 'h', pos: 8 }] });
  assert.deepEqual(runningAssignmentsOf(ops).map((r) => r.pos), [0, 8]);
  assert.equal(namedStringsForPage(runningAssignmentsOf(ops), 0, 4, {}, null).h.start, 0);
  assert.equal(counterStateAt(ops, 8).h, undefined, 'a running element is no counter');
});

test('a running element at any depth is out of the flow: the walk does not enter it, so its own counters are unread, as a fixed box`s are', () => {
  const inside = el({ counterIncrement: 'fig 1' });
  const mark = el({ '--beltype-running': 'mark' }, [inside]);
  const after = el({ counterIncrement: 'fig 1' });
  const block = el({}, [mark, after]);
  const ops = walk([block], [0, 6], new Map([[block, 0], [after, 3]]));
  assert.equal(counterValue(counterStateAt(ops, 6), 'fig'), 1, 'only the increment in the flow');
});

// THE ENGINE KNOWS NO VIEW (2026-10-24, ruling 3): the counter and string state is computed over readers a host supplies, so a host that is not the root computes it from a tree of its own.
test('the whole state over supplied readers: a plain tree, indexed by indexBlocks, with no document anywhere', () => {
  assert.equal(typeof globalThis.document, 'undefined', 'the suite runs where no DOM exists, so nothing below can reach one');
  const text = (data: any) => ({ nodeType: 3, data });
  /** A node with both faces the two walks read: `childNodes` for the index, `children` for the log. */
  const node = (style: any, kids: any[] = [], inline = false) => ({ nodeType: 1, style, inline, childNodes: kids, children: kids.filter((k) => k.nodeType === 1) });
  const textOf = (n: any) => (n.nodeType === 3 ? n.data : n.childNodes.map(textOf).join(''));
  const heading = (title: any) => node({ counterIncrement: 'chapter', [STRING_SET_PROP]: 'head content()' }, [text(title)]);
  const fig = node({ counterIncrement: 'figure' }, [text('A '), node({}, [text('whale')], true)]);
  // Four blocks of 1, 6, 2 and 2 words, under a body that resets the chapter; no two of them share a parent, and nothing asks.
  const blocks = [heading('Loomings'), node({}, [text('Call me Ishmael. Some years ago')]), heading('The Carpet-Bag'), node({}, [fig])];
  const index = indexBlocks(blocks, (n: any) => n.inline === true, () => false);
  assert.deepEqual(index.bases, [0, 1, 7, 9, 11]);
  const ops = documentOpsOf(blocks, index, { styleOf: (n: any) => n.style, textOf, attrOf: () => null, ancestors: [node({}), node({ counterReset: 'chapter' })], marks: new Set([fig]), running: [{ name: 'mark', pos: 1 }] });
  assert.deepEqual(counterStateAt(ops, 7), { chapter: [1] }, 'a page opening on the second heading counts the first alone');
  assert.deepEqual(counterStateAt(ops, 8), { chapter: [2] });
  const strings = stringAssignmentsOf(ops);
  assert.deepEqual(strings, [{ name: 'head', pos: 0, value: 'Loomings' }, { name: 'head', pos: 7, value: 'The Carpet-Bag' }]);
  assert.deepEqual(namedStringsForPage(strings, 7, null).head, { first: 'The Carpet-Bag', start: 'The Carpet-Bag', last: 'The Carpet-Bag', 'first-except': '' });
  assert.deepEqual(runningAssignmentsOf(ops), [{ name: 'mark', value: 0, pos: 1 }]);
  assert.deepEqual(counterStatesAfter(ops).get(fig), { chapter: [2], figure: [1] }, 'a target-counter() of the figure, after its own increment');
});

test("an element's reset of the page counter numbers the page it begins on and the pages after count on from it; a second reset starts again", () => {
  // Two sections, each `counter-reset: page 1; break-before: page`, two pages each: the case of Codeberg issue 1.
  const one = el({ counterReset: 'page 1' });
  const two = el({ counterReset: 'page 1' });
  const before = new Map([[one, 0], [two, 0]]);
  const ops = walk([one, two], [0, 10, 20], before);
  const pages = (i: number) => ({ start: [0, 5, 10, 15][i], blank: false });
  assert.deepEqual([0, 5, 10, 15].map((pos, i) => pageNumberAt(ops, i, pos, { pages })), [1, 2, 1, 2]);
  assert.deepEqual([0, 5, 10, 15].map((pos, i) => pageNumberAt(ops, i, pos, { pages, away: i === 2 ? [{ from: 10, to: 12 }] : [] })), [1, 2, 3, 2], 'a reset inside a remainder the page carries in is not yet in force on that page');
});

test('with no reset of the page counter the page number is the run\'s count, a reset on the root numbers from its value, and a reset mid-page numbers the next page', () => {
  const plain = el({});
  const tens = (i: number) => ({ start: i * 10, blank: false });
  assert.equal(pageNumberAt(walk([plain], [0, 10], new Map([[plain, 0]])), 3, 30, { pages: tens }), 4);
  const body = el({ counterReset: 'page 5' });
  const block = el({});
  const ops = walk([block], [0, 10], new Map([[block, 0]]), [body]);
  assert.deepEqual([0, 10].map((pos, i) => pageNumberAt(ops, i, pos, { pages: tens })), [5, 6], 'the root sits at −1, before the first word');
  const late = el({ counterSet: 'page 1' });
  const ops2 = walk([el({}, [late])], [0, 10], new Map([[late, 7]]));
  assert.deepEqual([0, 5, 10].map((pos, i) => pageNumberAt(ops2, i, pos, { pages: (i: number) => ({ start: [0, 5, 10][i], blank: false }) })), [1, 2, 1], 'a `counter-set` of `page` at word 7 is in force from the page that begins at 10');
});

test('the page\'s own two counters are kept out of the delivered state, and a state without them is returned as it is', () => {
  const state = { page: [1], pages: [4], chapter: [2] };
  assert.deepEqual(withoutPageCounters(state), { chapter: [2] });
  assert.deepEqual(state.page, [1], 'not written');
  const authors = { chapter: [2] };
  assert.equal(withoutPageCounters(authors), authors);
});

test('a blank page made to bring a resetting element to its side continues the count before it and is not counted after; a blank inside the scope counts', () => {
  // Codeberg issue 13: copy one is one page, copy two needs a recto, so page 2 is blank and copy two begins on page 3.
  const one = el({ counterReset: 'page 1' });
  const two = el({ counterReset: 'page 1' });
  const ops = walk([one, two], [0, 10, 20], new Map([[one, 0], [two, 0]]));
  const run = [{ start: 0, blank: false }, { start: 10, blank: true }, { start: 10, blank: false }, { start: 15, blank: false }];
  const numbers = run.map((p, i) => pageNumberAt(ops, i, p.start, { pages: (j) => run[j], blank: p.blank }));
  assert.deepEqual(numbers, [1, 2, 1, 2], 'the blank reads 2 in copy one\'s count, and copy two begins at 1');
  // A blank the engine makes after the element began, say a recto break inside the copy, is a page of the scope like any other.
  const inside = [{ start: 0, blank: false }, { start: 10, blank: false }, { start: 15, blank: true }, { start: 15, blank: false }];
  assert.deepEqual(inside.map((p, i) => pageNumberAt(ops, i, p.start, { pages: (j) => inside[j], blank: p.blank })), [1, 1, 2, 3]);
});

test('the page context\'s own counter rules number the pages as Chromium\'s print does: an increment and a set carry, a reset is the page box\'s alone, and an element\'s reset takes no implicit increment', () => {
  const none: PageCounterOps = { reset: null, increment: null, set: null };
  const numbers = (counters: Array<Partial<PageCounterOps>>, ops: ReturnType<typeof walk> = []) => {
    const run = counters.map((c, i) => ({ start: i * 10, blank: false, counter: { ...none, ...c } }));
    return run.map((p, i) => pageNumberAt(ops, i, p.start, { pages: (j) => run[j], counter: p.counter }));
  };
  // Measured 2026-11-07 on Chromium's print (`test/browser/page-context-counters.browser.ts`).
  assert.deepEqual(numbers([{ increment: 2 }, { increment: 2 }, { increment: 2 }]), [2, 4, 6]);
  assert.deepEqual(numbers([{ reset: 5, increment: 2 }, { increment: 2 }, { increment: 2 }]), [7, 2, 4], '@page { counter-increment: page 2 } @page :first { counter-reset: page 5 }');
  assert.deepEqual(numbers([{ reset: 10 }, {}, {}]), [10, 1, 2]);
  assert.deepEqual(numbers([{ set: 7 }, {}, {}]), [7, 8, 9]);
  assert.deepEqual(numbers([{}, { reset: 2 }, { reset: 2 }, { reset: 2 }]), [1, 2, 2, 2]);
  // An element's reset, Cicero's own reading (Codeberg issue 1), comes before the page's own rules: reset to 1, then the page's increment of 2, as a page box's reset and increment give 7 above.
  const chapter = el({ counterReset: 'page 1' });
  assert.deepEqual(numbers([{ increment: 2 }, { increment: 2 }, { increment: 2 }], walk([el({}), chapter], [0, 10], new Map([[chapter, 0]]))), [2, 3, 5]);
});

test('a pseudo-element\'s counters are its element\'s first and last child\'s: a page after the element counts both, and a reference to the element reads it after its ::before and before its ::after', () => {
  // Two figures, a block each, two words each; the first numbered by its ::before, the second by its ::after.
  const one = Object.assign(el(), { before: { counterIncrement: 'fig 1', content: '"FIG"' } });
  const two = Object.assign(el(), { after: { counterIncrement: 'fig 1', content: '"FIG"' } });
  const index = { bases: [0, 2, 4], wordsBefore: () => 0, wordCountIn: () => 2 };
  const read = (marks: Set<object> | null) => documentOpsOf([one, two], index, { styleOf: (e: any) => e.style, pseudoStyleOf: (e: any, pseudo: string) => (pseudo === '::before' ? e.before : e.after), marks });
  assert.deepEqual([2, 4].map((pos) => counterValue(counterStateAt(read(null), pos), 'fig')), [1, 1], 'the second figure\'s ::after stands at its end, on the page that ends it');
  assert.equal(counterValue(counterStateAt(read(null), 5), 'fig'), 2);
  const after = counterStatesAfter(read(new Set([one, two])));
  assert.deepEqual([one, two].map((e) => counterValue(after.get(e), 'fig')), [1, 1]);
  assert.equal(counterValue(counterStateAt(walk([one, two], [0, 2, 4], new Map()), 5), 'fig'), 0, 'without the pseudo reads, as before');
  one.before.content = 'none';
  assert.equal(counterValue(counterStateAt(read(null), 5), 'fig'), 1, 'a ::before with no content is no box and counts nothing');
});

test('a list and its items carry their implicit list-item operations, css-lists-3 §4.3 and HTML\'s numbering', () => {
  const tagged = (tagName: string, attrs: Record<string, string>, style: any, children: any[] = []): any => ({ tagName, style, children, getAttribute: (n: string) => attrs[n] ?? null });
  const li = (style: any = {}, attrs: Record<string, string> = {}) => tagged('LI', attrs, { display: 'list-item', ...style });
  const count = (list: any, after: any) => {
    const block = el({}, [list, after]);
    const before = new Map<any, number>([[block, 0], [after, 10]]);
    const ops = walk([block], [0, 11], before);
    return counterValue(counterStateAt(ops, 11), 'list-item');
  };
  // The element after the list does something, so the replay enters it and leaves the scopes the list opened deeper: the log has no entry for an element that does nothing, and a scope closes only when an operation at or above its depth arrives.
  const p = () => el({ counterIncrement: 'unrelated 1' });
  assert.equal(count(tagged('OL', {}, {}, [li(), li(), li()]), p()), 3, 'each item adds one, and the list\'s scope carries to what follows it');
  assert.equal(count(tagged('OL', { start: '5' }, {}, [li(), li()]), p()), 6);
  assert.equal(count(tagged('OL', { reversed: '' }, {}, [li(), li(), li()]), p()), 1, 'reversed counts down from the number of items');
  assert.equal(count(tagged('OL', { reversed: '', start: '30' }, {}, [li(), li()]), p()), 29);
  assert.equal(count(tagged('OL', {}, {}, [li(), li({}, { value: '20' }), li()]), p()), 21, 'an item\'s value sets the counter');
  assert.equal(count(tagged('OL', {}, {}, [li(), li({ counterIncrement: 'list-item 5' })]), p()), 6, 'an author\'s increment of list-item replaces the implicit one');
  assert.equal(count(tagged('OL', {}, {}, [li(), tagged('LI', {}, { display: 'list-item' }, [tagged('OL', {}, {}, [li(), li(), li()])])]), p()), 2, 'an inner list counts in its own scope');
  assert.equal(count(tagged('UL', { value: '9' }, {}, [li({}, { value: '9' }), li()]), p()), 2, 'a ul\'s items take no value');
  assert.equal(count(tagged('OL', {}, {}, [li(), li({ display: 'none' })]), p()), 1, 'an item not displayed counts nothing');
});
