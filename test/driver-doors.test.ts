/**
 * The driver's small readings, exported for a host that lays a page out itself (CHANGELOG 2026-10-28, *The driver's closures are doors*), DOM-free: `placeAt`, `pageNameDownFrom`, `gapAbove`, `processionBottoms` and `fitsPage`, and `pinTrack`.
 *
 * Each was a closure inside `paginateOnce` (or, `pinTrack`, the body of a loop in `fragments.js`) and the driver now calls the exported form with what the closure read from its scope. What a browser adds (that the driver's cuts did not move) is proved next door by the venue's battery; what is pinned here is what each answers on a small input.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapAbove as gapAboveTyped, pageNameDownFrom as pageNameDownFromTyped } from '../src/driver.ts';
import { placeAt } from '../src/positions.ts';
import { fitsPage, processionBottoms as processionBottomsTyped } from '../src/stonehand.ts';
import { pinTrack as pinTrackTyped } from '../src/fragments.ts';
import { byShape } from './fakes.ts';

const processionBottoms = byShape(processionBottomsTyped);
const gapAbove = byShape(gapAboveTyped);
const pageNameDownFrom = byShape(pageNameDownFromTyped);
const pinTrack = byShape(pinTrackTyped);

test('placeAt: the first piece on the line or below, a character where the line begins inside a word, else the place after the last word', () => {
  const pieces = [{ line: 0, index: 0, char: 0 }, { line: 0, index: 1, char: 0 }, { line: 1, index: 2, char: 0 }, { line: 1, index: 3, char: 0 }, { line: 2, index: 3, char: 4 }];
  assert.deepEqual(placeAt(pieces, 0), { word: 0, char: 0 });
  assert.deepEqual(placeAt(pieces, 1), { word: 2, char: 0 });
  assert.deepEqual(placeAt(pieces, 2), { word: 3, char: 4 }, 'a line that begins inside word 3 resumes four characters into it');
  assert.deepEqual(placeAt(pieces, 3), { word: 4, char: 0 }, 'every piece above: the place after the last word');
  assert.deepEqual(placeAt([], 0), { word: 0, char: 0 });
});

test('processionBottoms keeps the main flow and the parallel flows apart, and an empty procession bottoms out at the page`s start', () => {
  const box = (name: any, bottom: any) => ({ name, rect: { bottom } });
  const report = { processionOf: () => [box('p', 300), box('float', 700), box('q', 450), box('float2', 500)] };
  const parallel = (b: any) => b.name.startsWith('float');
  assert.deepEqual(processionBottoms({ report, pageStart: 40, parallel }), { inFlowBottom: 450, parallelBottom: 700 });
  assert.deepEqual(processionBottoms({ report: { processionOf: () => [] }, pageStart: 40, parallel }), { inFlowBottom: 40, parallelBottom: 40 });
  assert.deepEqual(processionBottoms({ report: { processionOf: () => [box('p', 10)] }, pageStart: 40, parallel }), { inFlowBottom: 40, parallelBottom: 40 }, 'a box above the start never lowers the bottom below it');
});

test('fitsPage: within the content height and a quarter pixel, measured from the page`s start', () => {
  assert.equal(fitsPage({ inFlowBottom: 540, pageStart: 40, contentHeight: 500 }), true);
  assert.equal(fitsPage({ inFlowBottom: 540.25, pageStart: 40, contentHeight: 500 }), true, 'the quarter pixel is the Gauge`s rounding');
  assert.equal(fitsPage({ inFlowBottom: 540.26, pageStart: 40, contentHeight: 500 }), false);
  assert.equal(fitsPage({ inFlowBottom: 541, pageStart: 40, contentHeight: 500, eps: 1 }), true, 'a host may state its own tolerance');
});

/** A box of the page's tree: where it stands, and what contains it. */
const boxOf = (el: any, top: any, parent: any = null) => ({ el, rect: { top }, parent });

test('gapAbove: how far each child stands below its container`s content edge, summed up the chain', () => {
  const styles = new Map<any, any>();
  const win = { getComputedStyle: (el: any) => styles.get(el) ?? { borderTopWidth: '0px', paddingTop: '0px', borderCollapse: 'collapse' } };
  const grid = {};
  const item = {};
  styles.set(grid, { borderTopWidth: '2px', paddingTop: '3px', borderCollapse: 'collapse' });
  const container = boxOf(grid, 100);
  const resumed = boxOf(item, 105 + 70, container);
  assert.equal(gapAbove(resumed, { boxOf: () => null }, win), 70, 'a grid`s spent track: the item stands 70 below the container`s content edge');
  assert.equal(gapAbove(boxOf({}, 100, boxOf({}, 100)), { boxOf: () => null }, win), 0, 'a block resumed at the top of its container owes nothing');
});

test('gapAbove: a separated table owes the spacing above its repeated header`s copy, and a collapsed one owes nothing', () => {
  const copy = { tagName: 'THEAD', previousElementSibling: null, getAttribute: () => 'artifact' };
  const rows = { tagName: 'TBODY', previousElementSibling: copy, getAttribute: () => null };
  const table = {};
  const copyBox = boxOf(copy, 106);
  const report = { boxOf: (el: any) => (el === copy ? copyBox : null) };
  const winOf = (borderCollapse: any) => ({ getComputedStyle: () => ({ borderTopWidth: '1px', paddingTop: '0px', borderCollapse }) });
  const resumed = () => boxOf(rows, 130, boxOf(table, 100));
  assert.equal(gapAbove(resumed(), report, winOf('separate')), 5, 'the copy stands 5 below the table`s content edge, at 101: its own footprint is not a lead, the spacing above it is');
  assert.equal(gapAbove(resumed(), report, winOf('collapse')), 0, 'under collapsed borders the copy`s top is the table`s own and nothing is owed');
});

/** An element with a computed `page`, as `effectivePageName` reads it. */
function named(page: any, parent: any = null, children: any[] = []) {
  const win = { getComputedStyle: (e: any) => ({ page: e.page }) };
  const e = { page, parentElement: parent, ownerDocument: { defaultView: win }, children };
  for (const c of children) c.parentElement = e;
  return e;
}

test('pageNameDownFrom: down the first in-flow block child while no run stands before it, then the effective page name', () => {
  const heading = named('auto');
  const float = named('auto');
  const chapter = named('chapter', null, [heading]);
  const article = named('auto', null, [float, chapter]);
  const styles = new Map([[float, { position: 'static', float: 'left' }]]);
  const styleOf = (e: any) => styles.get(e) ?? { position: 'static', float: 'none' };
  const blockChildren = (e: any) => e.children;
  assert.equal(pageNameDownFrom(article, { styleOf, runBefore: () => false, blockChildren }), 'chapter', 'the float is skipped, the chapter begins where the article does, and its heading inherits the name');
  assert.equal(pageNameDownFrom(article, { styleOf, runBefore: (parent: any) => parent === article, blockChildren }), '', 'a line before the chapter is the article`s first content, and the article is unnamed');
  assert.equal(pageNameDownFrom(heading, { styleOf, runBefore: () => false, blockChildren }), 'chapter', 'a box with no block child is where it stands, named by its ancestors');
});

/** An element for the table writer: a tag, children, a `style` it can be written on, and no engine words. */
function table(tag: any, children: any[] = [], colSpan = 1) {
  return { tagName: tag, children, colSpan, style: {} as any, getAttribute: () => null };
}
const byTag = (el: any) => ({ TR: 'table-row', TD: 'table-cell', TH: 'table-cell', THEAD: 'table-header-group', TBODY: 'table-row-group', TFOOT: 'table-footer-group' } as Record<string, string>)[el.tagName] ?? '';

test('pinTrack: a grid takes its measured column list', () => {
  const clone = table('DIV');
  pinTrack(clone, { kind: 'grid', columns: '120px 1fr 40px' });
  assert.equal(clone.style.gridTemplateColumns, '120px 1fr 40px');
});

test('pinTrack: a table takes its width and the first row`s cells the measured columns, spans summed, as the display function reads rows and cells', () => {
  const cells = [table('TD'), table('TD', [], 2)];
  const clone = table('TABLE', [table('TBODY', [table('TR', cells)])]);
  pinTrack(clone, { kind: 'table', columns: [100, 60, 40], width: 200 }, byTag);
  assert.equal(clone.style.tableLayout, 'fixed');
  assert.equal(clone.style.width, '200px');
  assert.deepEqual(cells.map((c) => c.style.width), ['100px', '100px']);
});

test('pinTrack: a table whose first row does not cover the measured columns is left as laid out, and so is one the default display cannot be asked of', () => {
  const short = [table('TD'), table('TD')];
  const clone = table('TABLE', [table('TR', short)]);
  pinTrack(clone, { kind: 'table', columns: [100, 60, 40], width: 200 }, byTag);
  assert.deepEqual(clone.style, {}, 'a rowspan above leaves the row short: the refusal, not a guess');
  const unregistered = table('TABLE', [table('TR', [table('TD')])]);
  pinTrack(unregistered, { kind: 'table', columns: [100], width: 100 });
  assert.deepEqual(unregistered.style, {}, 'the default reads the source`s computed display, which an element nobody registered has none of');
});
