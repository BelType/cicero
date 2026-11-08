/**
 * The forced-break index's memo, DOM-free (*the forced-break index is kept across runs*, 2026-10-09): the same walk, read through the memo and read fresh, over a plain object tree that is edited the way `patchBox` edits a document — one element taking another's place — and the two indexes compared answer for answer.
 *
 * What a browser adds (that the sheets' reach is read right off real rules, that `getComputedStyle` is what the snapshot copies) is proved next door and on the editing tools' worktree editor; what is pinned here is the memo's own logic: what it keeps, what it forgets, and that forgetting less than the reach of the sheets is a stale answer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forcingIndexOf } from '../src/driver.ts';
import { ForcingMemo, FORCING_STYLE_READS, snapshotOfStyle } from '../src/forcing-memo.ts';
import { inFlowIndex as inFlowIndexTyped, normalizePath, pathOf as pathOfTyped } from '../src/positions.ts';
import { byShape } from './fakes.ts';

const inFlowIndex = byShape(inFlowIndexTyped);
const pathOf = byShape(pathOfTyped);

const DEFAULT_STYLE = { breakBefore: 'auto', breakAfter: 'auto', position: 'static', float: 'none', overflowX: 'visible', overflowY: 'visible', display: 'block', columnCount: 'auto', columnWidth: 'auto', page: 'auto' };
const box = (id: any, style: any = {}, ...children: any[]) => ({ id, style, children, parentElement: null });
const link = (el: any, parent: any = null) => { el.parentElement = parent; for (const c of el.children) link(c, el); return el; };
/** The live style of a box. `sideways` makes a box's break depend on its PREVIOUS SIBLING's `mark` — the reach of `.x + p`, which no ancestor chain explains. */
const liveStyle = (el: any, sideways = false) => {
  const style = { ...DEFAULT_STYLE, ...el.style };
  if (sideways) {
    const prev = el.parentElement?.children[el.parentElement.children.indexOf(el) - 1];
    if (prev?.style.mark) style.breakBefore = 'page';
  }
  return style;
};

/** The forcing index of `blocks`, read through `memo` (the driver's wiring, minus the browser) or fresh. */
function indexOf(blocks: any, memo: any, { sideways = false, reads = null }: any = {}) {
  const live = (el: any) => { const st = liveStyle(el, sideways); return reads ? new Proxy(st, { get: (t, k) => { reads.add(k); return t[k]; } }) : st; };
  const pageOf = (el: any) => { for (let e = el; e; e = e.parentElement) if (liveStyle(e).page !== 'auto') return liveStyle(e).page; return ''; };
  const pos = new Map<any, any>();
  let acc = 0;
  const number = (el: any) => { pos.set(el, acc); acc += el.style.words ?? 0; for (const c of el.children) number(c); };
  for (const b of blocks) number(b);
  const rawPath = memo
    ? (el: any, b: any) => pathOf(el, blocks[b], b, undefined, (e: any) => memo.indexIn(e, () => inFlowIndex(e)))
    : (el: any, b: any) => pathOf(el, blocks[b], b);
  return forcingIndexOf(blocks, {
    styleOf: memo ? (el) => memo.facts(el, () => snapshotOfStyle(live(el))) : live,
    pageNameOf: memo ? (el) => memo.pageName(el, () => pageOf(el)) : pageOf,
    blockChildren: memo ? (el) => memo.blockChildren(el, () => [...el.children]) : (el) => el.children,
    cutOf: (el, b) => ({ path: normalizePath(rawPath(el, b)), word: null, px: null }),
    posOf: (el) => pos.get(el)
  });
}

/** Every cursor worth asking from: the start of each box, in each block. */
function cursors(blocks: any) {
  const out: any[] = [];
  const walk = (el: any, path: any) => { out.push(path); el.children.forEach((c: any, i: any) => walk(c, [...path, i])); };
  blocks.forEach((b: any, i: any) => walk(b, [i]));
  return out;
}
const answers = (index: any, blocks: any) => cursors(blocks).flatMap((path) => ['', 'wide'].map((name) => {
  const found = index.find({ path, word: null, px: null }, name);
  return found ? [index.size, found.el.id, found.cut.path, found.parity, found.namedSwitch] : [index.size, null];
}));

/** Replace `old` by `fresh` where it stands, as `patchBox` does, and tell the memo. */
function replace(old: any, fresh: any, memo: any) {
  const parent = old.parentElement;
  parent.children[parent.children.indexOf(old)] = fresh;
  link(fresh, parent);
  memo.replaced(fresh);
}

const tree = () => {
  const blocks = [
    box('A', {}, box('B', { words: 3 }), box('C', {}, box('D', { words: 5 }), box('E', { words: 2 })), box('F', { words: 1 })),
    box('G', { words: 4 }),
    box('H', {}, box('I', { words: 6 }))
  ];
  blocks.forEach((b) => link(b, box('body')));
  return blocks;
};

test('the memo reads only the properties the snapshot lists', () => {
  const reads = new Set<any>();
  indexOf(tree(), null, { reads });
  // `page` is read by the page-name reader of this test, not through the style handed to the walk: the walk itself must stay inside the list.
  for (const name of reads) assert.ok(FORCING_STYLE_READS.includes(name), `forcingIndexOf read ${String(name)}, which the snapshot does not copy`);
});

test('a memo that was filled and an edit that took one box\'s place: the index is the fresh one, for every kind of edit', () => {
  const edits: [string, (b: any) => any][] = [
    ['an attribute that forces a break', (b: any) => replace(b[0].children[1].children[1], box('E2', { breakBefore: 'page', words: 9 }), memo)],
    ['a heading inserted into the box\'s parent', (b: any) => replace(b[0].children[1], box('C2', {}, box('H1', { breakBefore: 'right', words: 2 }), box('D', { words: 5 }), box('E', { words: 2 })), memo)],
    ['a child removed (the box lost its subtree)', (b: any) => replace(b[0].children[1], box('C3', {}), memo)],
    ['a named page on the new box', (b: any) => replace(b[0].children[0], box('B2', { page: 'wide', words: 3 }), memo)],
    ['a top-level block replaced', (b: any) => { b[2] = box('H2', { breakAfter: 'left' }, box('I2', { words: 1 })); link(b[2], b[1].parentElement); memo.replaced(b[2]); }],
    ['more than one box replaced between two runs', (b: any) => { replace(b[0].children[0], box('B3', { breakBefore: 'page' }), memo); replace(b[0].children[2], box('F3', { breakAfter: 'page' }), memo); }]
  ];
  let memo: any;
  for (const [name, edit] of edits) {
    memo = new ForcingMemo();
    const blocks = tree();
    assert.ok(memo.settle(0));
    indexOf(blocks, memo); // fill
    edit(blocks);
    assert.ok(memo.settle(0));
    const kept = indexOf(blocks, memo);
    assert.deepEqual(answers(kept, blocks), answers(indexOf(blocks, null), blocks), name);
    assert.ok(memo.hits > 0, `${name}: nothing was answered from the memo`);
  }
});

test('the memo answers most of a run from what it kept, and reads only the new subtree afresh', () => {
  const memo = new ForcingMemo();
  const blocks = tree();
  memo.settle(0);
  indexOf(blocks, memo);
  const filled = memo.misses;
  memo.restart();
  replace(blocks[0].children[1].children[1], box('E2', { words: 7 }), memo);
  memo.settle(0);
  indexOf(blocks, memo);
  // One new element: its facts, page name, children list and index; the ancestors' children lists (C, A and the body) and the siblings' indices are read again too, and the rest of the walk hits.
  assert.ok(memo.misses < filled / 2, `${memo.misses} misses after an edit, ${filled} for the whole document`);
  assert.ok(memo.hits > memo.misses);
});

test('a sheet that reaches a sibling: forgetting less than the parent\'s subtree is a stale answer, and settle(1) forgets it', () => {
  const blocks = tree();
  const stale = new ForcingMemo();
  stale.settle(0);
  indexOf(blocks, stale, { sideways: true });
  // F takes the place of an element whose `mark` makes the NEXT sibling break before itself; here the box before F gains the mark.
  const fresh = box('D2', { mark: true, words: 5 });
  replace(blocks[0].children[1].children[0], fresh, stale);
  stale.settle(0); // the reach of an own-ancestors sheet: E, after D2, keeps the style it had
  const wrong = indexOf(blocks, stale, { sideways: true });
  const truth = indexOf(blocks, null, { sideways: true });
  assert.notDeepEqual(answers(wrong, blocks), answers(truth, blocks), 'the premise: without the reach, the memo is wrong');

  const right = new ForcingMemo();
  const again = tree();
  right.settle(1);
  indexOf(again, right, { sideways: true });
  replace(again[0].children[1].children[0], box('D2', { mark: true, words: 5 }), right);
  right.settle(1);
  assert.deepEqual(answers(indexOf(again, right, { sideways: true }), again), answers(indexOf(again, null, { sideways: true }), again));
});

test('a sheet that reaches an ancestor: the memo is emptied and refused, and the run reads afresh', () => {
  const memo = new ForcingMemo();
  const blocks = tree();
  memo.settle(0);
  indexOf(blocks, memo);
  const wholeFill = memo.misses;
  memo.restart();
  assert.equal(memo.settle(2), false);
  // Offered to nobody, so nothing is read through it; and a later run that the sheets allow starts from empty: it misses exactly as often as the first.
  assert.equal(memo.settle(0), true);
  indexOf(blocks, memo);
  assert.equal(memo.misses, wholeFill);
});

test('an inline position: fixed on the new box shifts the in-flow indices after it, and the siblings\' indices were forgotten', () => {
  const memo = new ForcingMemo();
  const blocks = tree();
  const isFixed = (el: any) => el.style.position === 'fixed';
  const rawPath = (el: any, b: any) => pathOf(el, blocks[b], b, isFixed, (e: any) => memo.indexIn(e, () => inFlowIndex(e, isFixed)));
  memo.settle(0);
  const F = blocks[0].children[2];
  assert.deepEqual(rawPath(F, 0), [0, 2]);
  replace(blocks[0].children[0], box('B4', { position: 'fixed' }), memo);
  memo.settle(0);
  assert.deepEqual(rawPath(F, 0), [0, 1], 'F is the second in-flow child now');
});

test('the console is told once per memo life at each level, naming the rule that set it and its sheet', () => {
  const memo = new ForcingMemo();
  assert.equal(memo.notice({ reach: 0, culprit: null, count: 0 }), null);
  const two = memo.notice({ reach: 2, culprit: { selector: 'section:has(> h1)', sheet: '<style> 1', kind: 'style' }, count: 3 });
  assert.match(two!, /the rule "section:has\(> h1\)" in <style> 1, and 3 more rules,/);
  assert.match(two!, /read afresh on every run/);
  assert.equal(memo.notice({ reach: 2, culprit: { selector: 'p:has(em)', sheet: '<style> 1', kind: 'style' }, count: 0 }), null, 'once');
  const one = memo.notice({ reach: 1, culprit: { selector: 'p + p', sheet: 'https://example.org/book.css', kind: 'style' }, count: 0 });
  assert.match(one!, /the rule "p \+ p" in https:\/\/example\.org\/book\.css can make/);
  assert.equal(memo.notice({ reach: 1, culprit: { selector: 'p ~ p', sheet: '<style> 1', kind: 'style' }, count: 1 }), null, 'once');
  const fresh = new ForcingMemo();
  assert.match(fresh.notice({ reach: 2, culprit: { selector: null, sheet: '<style> 2', kind: 'container' }, count: 1 })!, /an @container rule in <style> 2, and 1 more rule,/);
  assert.match(new ForcingMemo().notice({ reach: 2, culprit: { selector: null, sheet: 'https://cdn.example/x.css', kind: 'unreadable' }, count: 0 })!, /the sheet https:\/\/cdn\.example\/x\.css, which the engine cannot read,/);
});
