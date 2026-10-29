import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntry } from '../src/ledger.ts';
import { cutAfter } from '../src/positions.ts';
import { clearOfEdit, composeResumed, converge, holderPage, keyOf, namesNoPlace, priorKeys, restartPage } from '../src/resume.ts';

const conditions = (extra = {}) => ({ contentW: 500, contentH: 700, pageNumber: 1, parity: 'right', counters: {}, ...extra });
const cut = (path, word = null, extra = {}) => ({ path, word, px: null, ...extra });
/** A main-flow entry closing at `at`, optionally with carried flows, an owed parity and a changed page number / parity / flat projection / measured y — the members the key must read, and those it must not. */
const entry = ({ at, pos = 0, cls = 'A', trace = {}, closes = {}, carried = [], owes = null }) =>
  createEntry({ paths: [{ pos, cut: at }, ...carried.map((c) => ({ pos, ...c }))], cls, trace: { kind: cls, y: 10, ...trace }, closes: conditions(closes), ...(owes ? { owes } : {}) });

test('the key is the address: pos, page number, the measured y and the box are out of it', () => {
  const a = entry({ at: cut([3, 1], 12), pos: 40, closes: { pageNumber: 5 }, trace: { y: 600 } });
  const b = entry({ at: cut([3, 1], 12), pos: 4000, closes: { pageNumber: 99 }, trace: { y: 12.5 } });
  assert.equal(keyOf(a, false), keyOf(b, false));
});

test('every member of an address is in the key: path, word, character, pixel extent', () => {
  const base = keyOf(entry({ at: cut([3, 1], 12) }), false);
  assert.notEqual(base, keyOf(entry({ at: cut([3, 2], 12) }), false), 'the path');
  assert.notEqual(base, keyOf(entry({ at: cut([3, 1], 13) }), false), 'the word');
  assert.notEqual(base, keyOf(entry({ at: cut([3, 1], 12, { char: 4 }) }), false), 'the character');
  assert.notEqual(keyOf(entry({ at: cut([3, 1], null, { px: { remaining: 40, paint: null } }) }), false), keyOf(entry({ at: cut([3, 1], null, { px: { remaining: 41, paint: null } }) }), false), 'the pixel extent of a divided box');
});

test('the class, the forced flag, a blank page and the end of the document are in the key', () => {
  const base = keyOf(entry({ at: cut([3]) }), false);
  assert.notEqual(base, keyOf(entry({ at: cut([3]), cls: 'B' }), false), 'the class');
  assert.notEqual(base, keyOf(entry({ at: cut([3]), trace: { forced: true } }), false), 'forced');
  assert.notEqual(keyOf(entry({ at: cut([3]), trace: { forced: true } }), false), keyOf(entry({ at: cut([3]), trace: { forced: true, blank: true } }), false), 'a blank page repeats the position and is not the page before it');
});

test('every live flow is in the key: the carried address, its remainder and a row item', () => {
  const one = keyOf(entry({ at: cut([3]), carried: [{ cut: cut([1], 4), remainingPx: 30 }] }), false);
  assert.notEqual(one, keyOf(entry({ at: cut([3]) }), false), 'a flow carried or not');
  assert.notEqual(one, keyOf(entry({ at: cut([3]), carried: [{ cut: cut([1], 5), remainingPx: 30 }] }), false), 'its address');
  assert.notEqual(one, keyOf(entry({ at: cut([3]), carried: [{ cut: cut([1], 4), remainingPx: 31 }] }), false), 'its remainder');
  assert.notEqual(one, keyOf(entry({ at: cut([3]), carried: [{ cut: cut([1], 4), remainingPx: 30, item: [1, 0] }] }), false), 'the row item it speaks for');
});

test('parity is in the key ONLY where it can change a cut: a geometry that differs by side, or a parity still owed', () => {
  const right = entry({ at: cut([3]), closes: { parity: 'right' } });
  const left = entry({ at: cut([3]), closes: { parity: 'left' } });
  assert.equal(keyOf(right, false), keyOf(left, false), 'two sides, one geometry: an odd page shift moves no cut');
  assert.notEqual(keyOf(right, true), keyOf(left, true), 'two geometries: the side decides the measure');
  const owesRight = entry({ at: cut([3]), trace: { forced: true }, closes: { parity: 'right' }, owes: 'left' });
  const owesLeft = entry({ at: cut([3]), trace: { forced: true }, closes: { parity: 'left' }, owes: 'left' });
  assert.notEqual(keyOf(owesRight, false), keyOf(owesLeft, false), 'an owed parity makes the next page blank or not by the side it falls on');
  assert.notEqual(keyOf(owesRight, false), keyOf(entry({ at: cut([3]), trace: { forced: true }, closes: { parity: 'right' } }), false), 'and what is owed is itself in the key');
});

test('convergence honours the page shift: an equal key is found wherever the prior ledger holds it', () => {
  const prior = [3, 4, 5, 6, 7].map((b) => entry({ at: cut([b]), closes: { pageNumber: b } }));
  const keys = priorKeys(prior, false);
  const fresh = entry({ at: cut([5]), closes: { pageNumber: 99, parity: 'left' } });
  assert.equal(converge({ keys, entry: fresh, geometryByParity: false, dirtyPaths: [[3, 0]], atLeast: 0 }), 2, 'found at prior page 2 while the new run stands at another index: the shift is the difference');
  assert.equal(converge({ keys, entry: entry({ at: cut([5], 1) }), geometryByParity: false, dirtyPaths: [[3, 0]], atLeast: 0 }), -1, 'a different word is no convergence');
  assert.equal(converge({ keys, entry: fresh, geometryByParity: false, dirtyPaths: [[3, 0]], atLeast: 3 }), -1, 'the prior page must lie past what the run was told it must reach');
});

test('a closing address inside or before the edited box cannot converge: the word index there names different text now', () => {
  assert.equal(clearOfEdit(entry({ at: cut([4, 0], 3) }), [[4, 0]]), false, 'inside the edited leaf');
  assert.equal(clearOfEdit(entry({ at: cut([4, 0]) }), [[4, 0]]), false, 'at its start');
  assert.equal(clearOfEdit(entry({ at: cut([4]) }), [[4, 0]]), false, 'an ancestor of it has not reached it');
  assert.equal(clearOfEdit(entry({ at: cut([3, 2], 1) }), [[4, 0]]), false, 'before it');
  assert.equal(clearOfEdit(entry({ at: cut([4, 1], 1) }), [[4, 0]]), true, 'a later leaf of the same block');
  assert.equal(clearOfEdit(entry({ at: cut([5]) }), [[4, 0]]), true, 'a later block');
  assert.equal(clearOfEdit(entry({ at: cut([5]), carried: [{ cut: cut([4, 0], 2) }] }), [[4, 0]]), false, 'a flow still carried inside it');
  assert.equal(clearOfEdit(entry({ at: cut([5]), carried: [{ cut: cut([1], 2) }] }), [[4, 0]]), true, 'a flow carried from elsewhere is clear');
  assert.equal(clearOfEdit(createEntry({ paths: [], cls: 'A', trace: { terminal: true }, closes: conditions() }), [[4, 0]]), true, 'the end of the document');
});

test('several boxes edited since the prior run: an address is clear only past every one of them (beltype#48)', () => {
  const edited = [[2], [6]];
  assert.equal(clearOfEdit(entry({ at: cut([4]) }), edited), false, 'past the first edited box and before the second: its later pages were cut in boxes that are gone');
  assert.equal(clearOfEdit(entry({ at: cut([6, 1], 3) }), edited), false, 'inside the second');
  assert.equal(clearOfEdit(entry({ at: cut([7]) }), edited), true, 'past both');
  assert.equal(clearOfEdit(entry({ at: cut([7]), carried: [{ cut: cut([2, 0], 1) }] }), edited), false, 'a flow still carried inside the first');
  const keys = priorKeys([4, 7].map((b) => entry({ at: cut([b]) })), false);
  assert.equal(converge({ keys, entry: entry({ at: cut([4]) }), geometryByParity: false, dirtyPaths: edited, atLeast: 0 }), -1, 'an equal key between the edited boxes is no convergence');
  assert.equal(converge({ keys, entry: entry({ at: cut([7]) }), geometryByParity: false, dirtyPaths: edited, atLeast: 0 }), 1, 'past the last it is');
});

test('the page whose interval holds the address, and the restart one page before it', () => {
  const prior = [cut([2]), cut([3, 0], 10), cut([5]), cut([8])].map((at) => entry({ at }));
  const after = (a, b) => cutAfter(a, b);
  assert.equal(holderPage(prior, { path: [1, 4], word: 2 }, after), 0, 'before the first cut: page one');
  assert.equal(holderPage(prior, { path: [3, 0], word: 4 }, after), 1, 'inside block 3, before its word 10');
  assert.equal(holderPage(prior, { path: [3, 0], word: 10 }, after), 2, 'AT a cut: the page that begins there holds it');
  assert.equal(holderPage(prior, { path: [9] }, after), 4, 'past the last cut: the page after the last entry');
  assert.equal(restartPage(0), 0);
  assert.equal(restartPage(2), 1, 'the page before: a cut reads the boxes it pushed to the next page');
});

test('a cut inside the edited box is past the box\'s start, however the new tree answers for it', () => {
  // The chapter at block 4 is the edited box (it gained a child). Its first page ended at [4,2,1] word 17 and the second at [4,2,4] word 31: addresses into the tree that was replaced.
  const prior = [cut([3, 6]), cut([4]), cut([4, 2, 1], 17), cut([4, 2, 4], 31), cut([4, 3]), cut([5])].map((at) => entry({ at }));
  // `after` as the driver gives it when the new tree has no such box: the cut projects to the block's start, which ties with the address.
  const tie = (a, b) => (a.path.length > b.path.length && b.path.every((n, i) => n === a.path[i]) ? false : cutAfter(a, b));
  assert.equal(holderPage(prior, { path: [4], word: 0 }, tie), 2, 'the page that ends inside the box holds the edit, not a later one');
  assert.equal(restartPage(holderPage(prior, { path: [4], word: 0 }, tie)), 1, 'and the run restarts one page before it');
  assert.equal(holderPage(prior, { path: [4], word: 5 }, (a, b) => cutAfter(a, b)), 2, 'an address with a word in it is ordered by the cut itself');
  assert.equal(holderPage(prior, { path: [4, 3] }, (a, b) => cutAfter(a, b)), 5, 'a smaller box edited later in the chapter: the pages that end before it stay before it, the one that begins at it holds it');
});

test('a page whose cut names no box is not a page to resume from; the end of the document is not a dangling address', () => {
  const hasBox = (c) => c.path.length <= 2;
  assert.equal(namesNoPlace(entry({ at: cut([4, 2]) }), hasBox, 9), false);
  assert.equal(namesNoPlace(entry({ at: cut([4, 2, 1], 17) }), hasBox, 9), true, 'a path into a tree that is not there');
  assert.equal(namesNoPlace(entry({ at: cut([4]), carried: [{ cut: cut([4, 2, 1], 3) }] }), hasBox, 9), true, 'a carried flow counts too');
  assert.equal(namesNoPlace(entry({ at: cut([9]) }), () => false, 9), false, 'the document end answers to no box, by construction');
});

test('two resumes compose into one from the first one\'s prior: the earlier start, the later end, the shifts summed (delivery resumes from the moved page)', () => {
  // A prior of 20 pages; the edit re-cuts 5–7 and adds one (21 pages, 13 kept); the reads' resume re-cuts 12–14 of that layout and adds one more (22 pages, 8 kept).
  const a = { from: 5, to: 7, shift: 1, converged: true, kept: 14 };
  const b = { from: 12, to: 14, shift: 1, converged: true, kept: 8 };
  assert.deepEqual(composeResumed(a, b), { from: 5, to: 14, shift: 2, converged: true, kept: 8 });
  // The second resume inside the first's range: the first's end, shifted by the second's pages.
  assert.deepEqual(composeResumed({ from: 5, to: 9, shift: 0, converged: true, kept: 11 }, { from: 4, to: 6, shift: 1, converged: true, kept: 15 }), { from: 4, to: 10, shift: 1, converged: true, kept: 11 });
  // Either one that ran to the end: nothing after is kept, and the end is the last page.
  assert.deepEqual(composeResumed({ from: 5, to: 21, shift: 1, converged: false, kept: 0 }, { from: 12, to: 14, shift: 1, converged: true, kept: 8 }), { from: 5, to: 22, shift: 2, converged: false, kept: 0 });
  assert.deepEqual(composeResumed(a, { from: 12, to: 22, shift: 1, converged: false, kept: 0 }), { from: 5, to: 22, shift: 2, converged: false, kept: 0 });
  // A whole run on either side: nothing was reused.
  assert.equal(composeResumed(null, b), null);
  assert.equal(composeResumed(a, null), null);
});
