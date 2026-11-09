/**
 * The driver's parity arithmetic, DOM-free (*a parity is worth a page*, 2026-09-07).
 *
 * Almost all of the build loop needs a browser and is proved next door in `packages/essay`. Two pieces of it do not, and they are the two the parity round turns on: what parity a forced value demands (css-break-3 §3.1), and how two forced values at one break point combine (§4.3). Both are pure functions over strings, so they are pinned here, where a suite runs in milliseconds and cannot be told a comfortable answer by a font.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parityOf, combineParity, forcingIndexOf as forcingIndexOfTyped, castOffWords, firstPageWords } from '../src/driver.ts';
import { normalizePath as normalizePathTyped, pathOf as pathOfTyped } from '../src/positions.ts';
import { byShape } from './fakes.ts';

const forcingIndexOf = byShape(forcingIndexOfTyped);
const normalizePath = byShape(normalizePathTyped);
const pathOf = byShape(pathOfTyped);

test('the parity four demand a side; page and auto demand none (css-break-3 §3.1)', () => {
  assert.equal(parityOf('left'), 'left');
  assert.equal(parityOf('right'), 'right');
  assert.equal(parityOf('page'), null);
  assert.equal(parityOf('auto'), null);
  assert.equal(parityOf('avoid'), null);
});

test('recto and verso resolve against the left-to-right page progression this engine derives parity from', () => {
  // css-break-3 §3.1: recto is the page that is SECOND in a spread, verso the first, according to the page progression; css-page-3 §3.3 makes the first page of a left-to-right document a right page. The driver's `parityAt` is that progression, so recto is right here and verso is left, and the two readings move together or not at all.
  assert.equal(parityOf('recto'), 'right');
  assert.equal(parityOf('verso'), 'left');
});

test('§4.3: among the parity four the latest element in the flow wins', () => {
  assert.equal(combineParity('left', 'right'), 'right');
  assert.equal(combineParity('right', 'left'), 'left');
});

test('§4.3: a forced value carrying no parity honours the one beside it rather than cancelling it', () => {
  // "they combine such that all types of break are honored" — a page break and a left page break combine into a left page break, whichever side declared which.
  assert.equal(combineParity('left', null), 'left');
  assert.equal(combineParity(null, 'left'), 'left');
  assert.equal(combineParity(null, null), null);
});

/** The grab's index, DOM-free (*the page asks the index*, 2026-09-25): the walk taken once over a plain object tree, and the page's question asked of it. The two trees are the decision records' worked example: the first tree's answers are the ones the old per-page walk gave, and the second tree's are css-break-3's since *a box is not its first child* (2026-09-26) — the old walk's were the defect case 64 reproduces. */
const DEFAULT_STYLE = { breakBefore: 'auto', breakAfter: 'auto', position: 'static', float: 'none', overflowX: 'visible', overflowY: 'visible', display: 'block', page: 'auto' };
const box = (id: any, style: any = {}, ...children: any[]) => ({ id, tagName: 'DIV', style, children, parentElement: null });
function indexOver(...blocks: any[]) {
  const link = (el: any) => { for (const c of el.children) { c.parentElement = el; link(c); } };
  const body = box('body', {}, ...blocks);
  link(body);
  const styleOf = (el: any) => ({ ...DEFAULT_STYLE, ...el.style });
  const pageNameOf = (el: any) => {
    for (let e = el; e; e = e.parentElement) if (styleOf(e).page !== 'auto') return styleOf(e).page;
    return '';
  };
  // A box's word position is the words of every box before it in walk order, each box carrying its own in `words` (the Cast-off's tests; the grab's trees carry none and read zero throughout).
  // A box's `trail` is a run of that many words standing after it in its parent, an anonymous block box with no element (*the anonymous box is in the procession*).
  let acc = 0;
  const pos = new Map<any, any>();
  const extent = new Map<any, any>();
  const number = (el: any) => { const start = acc; pos.set(el, acc); acc += el.style.words ?? 0; for (const c of el.children) { number(c); acc += c.style.trail ?? 0; } extent.set(el, { before: start, count: acc - start }); };
  for (const b of blocks) number(b);
  return forcingIndexOf(blocks, { styleOf, pageNameOf, cutOf: (el: any, b: any, word: any = null) => ({ path: word == null ? normalizePath(pathOf(el, blocks[b], b)) : pathOf(el, blocks[b], b), word, px: null }), posOf: (el: any) => pos.get(el), blockChildren: (el: any) => el.children, extentOf: (el: any) => extent.get(el) });
}
const at = (path: any, word: any = null) => ({ path, word, px: null });
const answer = (found: any) => (found ? [found.el.id, found.cut.path, found.parity] : null);

test('the index: an outer container closing after its last child replaces the child\'s parity (§4.3)', () => {
  const index = indexOver(box('A', { breakAfter: 'right' }, box('B'), box('C', { breakAfter: 'left' })), box('D'));
  assert.deepEqual(answer(index.find(at([0]), '')), ['D', [1], 'right']);
  assert.deepEqual(answer(index.find(at([0, 1], 3), '')), ['D', [1], 'right']);
});

test('the index spends a first child\'s break-after once, where it falls (§4.3)', () => {
  // B's address is A's — a bare path drops its trailing zeros — and the prefix rule read B's break-after again on every page inside A: E, left, then D, left. The subtree rule (*a box is not its first child*) carries only what closes in front of the event found, so after C's page B is spent and A's plain page is what stands before D. Case 64 is this tree on a page.
  const index = indexOver(box('A', { breakAfter: 'page' }, box('B', { breakAfter: 'left' }), box('C'), box('E')), box('D'));
  assert.deepEqual(answer(index.find(at([0]), '')), ['C', [0, 1], 'left']);
  assert.deepEqual(answer(index.find(at([0, 1]), '')), ['D', [1], null]);
  assert.deepEqual(answer(index.find(at([0, 2], 4), '')), ['D', [1], null]);
  assert.equal(index.find(at([1]), ''), null);
});

test('the index carries a break-after into the run of lines after the box, at the run\'s first word', () => {
  // B closes in front of a three-word run that A holds before C; the run is the box that resumes, so the event is A's path and word 2, B's two words being before it. The run forces nothing of its own, so after it nothing is pending into C.
  const index = indexOver(box('A', {}, box('B', { breakAfter: 'page', words: 2, trail: 3 }), box('C', { words: 1 })));
  const found = index.find(at([0]), '');
  assert.deepEqual([found.el.id, found.cut.path, found.cut.word, found.runAfter.id], ['A', [0], 2, 'B']);
  assert.equal(index.find(at([0], 2), ''), null);
  // The Cast-off never names the run: its place is the next box.
  assert.deepEqual(place(index.boundAt(at([0]), 1)), ['C', [0, 1]]);
});

test('the index keeps the walk\'s refusals and its names-only question', () => {
  const index = indexOver(
    box('A', {}, box('abs', { position: 'absolute', breakBefore: 'page' }), box('float', { float: 'left', breakAfter: 'page' }, box('inside', { breakBefore: 'page' })), box('P')),
    box('Q', { page: 'wide' }),
    box('R', { page: 'wide', breakBefore: 'page' })
  );
  // Nothing inside the float and nothing on the absolutely positioned box forces; the float's own break-after is not read either. The first event is the named page.
  const named = index.find(at([0]), '');
  assert.deepEqual(answer(named), ['Q', [1], null]);
  assert.equal(named.namedSwitch, true);
  // Asked under the new name, the switch is gone and R's forced break-before is next; asked for names alone, R is not an event at all. All three answers are the old walk's.
  assert.deepEqual(answer(index.find(at([1]), 'wide')), ['R', [2], null]);
  assert.equal(index.find(at([1]), 'wide').namedSwitch, false);
  assert.equal(index.find(at([1]), 'wide', { namesOnly: true }), null);
});

/** css-page-3 §8.1's start and end page values, DOM-free: a name break stands where the end page value before a class A break point and the start page value after it differ, read among boxes the `page` property applies to (the WPT `css-page/page-name-*` shapes). */
const breaks = (index: any) => { const out: string[] = []; let at = at0; for (let f = index.find(at, ''); f; f = index.find(at, '')) { out.push(f.el.id); at = f.cut; } return out; };
const at0 = { path: [0], word: null, px: null };

test('a start page value propagates from the deepest first child, and an end page value from the last (page-name-propagated-001, -002)', () => {
  assert.deepEqual(breaks(indexOver(box('A', { page: 'a' }), box('B', { page: 'b' }, box('C', { page: 'c' }, box('D', { page: 'a' }))))), []);
  assert.deepEqual(breaks(indexOver(box('A', { page: 'a' }), box('B', { page: 'b' }, box('E', { page: 'e' }, box('F', { page: 'a' })), box('C', { page: 'c' })), box('D', { page: 'd' }))), ['C', 'D']);
});

test('a name on a flex item, a float or an inline-block forces nothing; inside a flex item the block flow switches again (page-name-flex-001, -004, float-001, inline-block-003)', () => {
  assert.deepEqual(breaks(indexOver(box('A'), box('F', { display: 'flex' }, box('B', { page: 'b' }), box('C', { page: 'c' })), box('D'))), []);
  assert.deepEqual(breaks(indexOver(box('A'), box('F', { display: 'flex' }, box('I', {}, box('B', { page: 'a' }), box('C', { page: 'b' }))), box('D'))), ['C']);
  assert.deepEqual(breaks(indexOver(box('A', { page: 'a', float: 'left' }), box('B', { page: 'b' }))), []);
  assert.deepEqual(breaks(indexOver(box('A', { page: 'a', display: 'inline-block' }), box('B', { page: 'b', display: 'inline-block' }))), []);
});

/** The Cast-off's arithmetic, DOM-free (*the Cast-off bounds the feed*, 2026-09-26): the number read off the account, and the place it names on the grab's own list. The tree is the decision record's worked example — a section of two paragraphs, a three-row table and two more paragraphs, forty words a paragraph and twenty a row. What the feed then does, and the check that pours it again, is geometry, and is proved next door in `packages/essay`. */
const example = () =>
  indexOver(
    box('S', {},
      box('P1', { words: 40 }),
      box('P2', { words: 40 }),
      box('T', { display: 'table' }, box('R1', { display: 'table-row', words: 20 }), box('R2', { display: 'table-row', words: 20 }), box('R3', { display: 'table-row', words: 20 })),
      box('P3', { words: 40 }),
      box('P4', { words: 40 })
    )
  );
const place = (found: any) => (found ? [found.el.id, found.cut.path] : null);

test('the Cast-off reads its number off the account: the mean page plus twice its spread, and none on page one', () => {
  assert.equal(castOffWords([]), null); // page one has no page before it, and is fed whole
  assert.equal(castOffWords([{ pos: 15, blank: false }]), 35); // the first page's start is word zero; one page has no spread, so 15 + the floor
  assert.equal(castOffWords([{ pos: 15, blank: false }, { pos: 40, blank: false }]), 50); // mean 20, spread 5: 20 + 10 + 20
  // A blank page moved nothing and says nothing about the next.
  assert.equal(castOffWords([{ pos: 15, blank: false }, { pos: 40, blank: false }, { pos: 40, blank: true }]), 50);
  // A page that moved no words — a monolith's slice — is left out of the estimate rather than ending it.
  assert.equal(castOffWords([{ pos: 15, blank: false }, { pos: 15, blank: false }]), 35);
  // No page has moved a word yet: nothing to estimate from, and the feed is whole.
  assert.equal(castOffWords([{ pos: 0, blank: false }]), null);
});

test('page one is estimated from its own size: lines times words per line, doubled — and from nothing unusable', () => {
  // 600 x 800 content, 16px type on a 24px line: 33.3 lines of 600 / (0.5 * 16 * 6) = 12.5 words, twice over.
  assert.equal(firstPageWords({ contentW: 600, contentH: 800, fontSize: 16, lineHeight: 24 }), Math.ceil((800 / 24) * 12.5 * 2));
  // A line height that is not a pixel length (`normal` parses to NaN), or a size of zero, is no estimate: the feed is whole.
  assert.equal(firstPageWords({ contentW: 600, contentH: 800, fontSize: 16, lineHeight: Number.NaN }), null);
  assert.equal(firstPageWords({ contentW: 600, contentH: 800, fontSize: 0, lineHeight: 24 }), null);
  assert.equal(firstPageWords({ contentW: 0, contentH: 800, fontSize: 16, lineHeight: 24 }), null);
});

test('the place is the first boundary at or past the bound, strictly after the cursor', () => {
  const index = example();
  // 45 words from the section's start: P2 starts at 40, the table at 80, so the table's own start is the first boundary at or past 45.
  assert.deepEqual(place(index.boundAt(at([0]), 45)), ['T', [0, 2]]);
  // From P3's start the place is never P3 itself, whatever the bound: the box a page begins with is not after the cursor.
  assert.deepEqual(place(index.boundAt(at([0, 3]), 0)), ['P4', [0, 4]]);
  // Past the document's last box there is no place, and the feed is whole.
  assert.equal(index.boundAt(at([0]), 1000), null);
});

test('a place inside a table moves past the table, and doubling the bound can land there', () => {
  const index = example();
  // 90 words: the first box at or past it is the second row, at 100 — inside the table, whose automatic layout reads every row, so the place moves to the first box after it.
  assert.deepEqual(place(index.boundAt(at([0]), 90)), ['P3', [0, 3]]);
  // The pour again doubles the bound: 45 words named the table's start, 90 names P3.
  assert.deepEqual(place(index.boundAt(at([0]), 2 * 45)), ['P3', [0, 3]]);
  // A cursor inside the table — a page that began on its second row — gets its place after the table too, so the table's remainder is always fed whole.
  assert.deepEqual(place(index.boundAt(at([0, 2, 1]), 0)), ['P3', [0, 3]]);
});

test('a float is never the place: it stands beside the flow, possibly between two lines of a paragraph', () => {
  const index = indexOver(box('A', { words: 0 }, box('X', { words: 10 }), box('F', { float: 'left', words: 5 })), box('B', { words: 10 }));
  assert.deepEqual(place(index.boundAt(at([0]), 10)), ['B', [1]]);
});

test('a refused resume names the part of the conditions that moved', async () => {
  const describeConditions = byShape((await import('../src/driver.ts')).describeConditions);
  const key = (w: any, h: any, dpr: any, dark: any, sheets: any, epoch?: any) => JSON.stringify([w, h, dpr, dark, sheets, epoch]);
  const base = key(1200, 800, 1, false, ['a{}', 'b{}']);
  assert.equal(describeConditions(base, key(1000, 800, 1, false, ['a{}', 'b{}'])), 'the render conditions changed: the viewport went from 1200×800 to 1000×800');
  assert.equal(describeConditions(base, key(1200, 800, 2, true, ['a{}', 'b{}'])), 'the render conditions changed: the device pixel ratio went from 1 to 2; the colour scheme went from light to dark');
  assert.equal(describeConditions(base, key(1200, 800, 1, false, ['a{}', 'c{}']), ['/x.css', '/y.css']), 'the render conditions changed: stylesheet /y.css changed');
  assert.equal(describeConditions(base, key(1200, 800, 1, false, ['a{}', 'b{}', 'c{}'])), 'the render conditions changed: the document wore 2 stylesheets and now wears 3');
  assert.equal(describeConditions(base, key(1200, 800, 1, false, ['a{}', 'b{}'], 1)), 'the render conditions changed: a font face finished loading');
  assert.equal(describeConditions(base, base), 'the render conditions changed: a part this engine cannot name');
});

// THE HEADER REPEATS (2026-10-14): a copy the engine repeats ahead of a box is furniture with a footprint, not a spent lead — and a box with no such copy before it owes the lead arithmetic exactly what it owed before.
test('standsAfterArtifact: only a preceding sibling wearing the artifact word counts, and a box with none changes nothing', async () => {
  const standsAfterArtifact = byShape((await import('../src/driver.ts')).standsAfterArtifact);
  const el = (words: any, previousElementSibling: any = null) => ({ getAttribute: (n: any) => (n === 'data-beltype' ? words : null), previousElementSibling });
  const head = el('artifact');
  const plain = el(null);
  assert.equal(standsAfterArtifact(el(null, head)), true, 'a header copy directly before');
  assert.equal(standsAfterArtifact(el(null, el(null, head))), true, 'a header copy further back');
  assert.equal(standsAfterArtifact(el(null, plain)), false, 'an ordinary sibling is not furniture');
  assert.equal(standsAfterArtifact(el(null, el('fragment away'))), false, 'other words are not the artifact word');
  assert.equal(standsAfterArtifact(el(null)), false, 'no sibling at all');
  assert.equal(standsAfterArtifact(null), false);
});
