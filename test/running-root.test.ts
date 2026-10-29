/**
 * The intake's boxes stand in an element the host names (CHANGELOG 2026-10-28), DOM-free: `topLevelBlocks` and `runningBoxes` read `doc.body`'s children by default and the children of the element they are told otherwise, and `runningPosition` is the driver's own two lines for a running element's place, exported so a host that reads the boxes elsewhere turns them into positions the same way.
 *
 * What a browser adds (that real computed style names the running elements) is proved next door by the venue's running-element cases; what is pinned here is which element's children are the boxes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topLevelBlocks, runningBoxes, runningPosition } from '../src/driver.ts';
import { RUNNING_PROP } from '../src/gcpm-encoding.ts';

/** `tag#id`, with children: the little of an element the intake reads. */
function el(spec, ...children) {
  const [, tag, id = ''] = /^(\w+)(?:#([\w-]+))?$/.exec(spec);
  const e = { tagName: tag.toUpperCase(), id, children, parentElement: null, get nextElementSibling() { const s = e.parentElement?.children ?? []; return s[s.indexOf(e) + 1] ?? null; } };
  for (const c of children) c.parentElement = e;
  return e;
}

/** A document whose body holds one section, and a holder (not in the body) holding a heading, a running mark, and a section with a running mark inside it. */
function documentOf() {
  const body = el('body', el('section#own', el('p#mine')));
  const holder = el('div#holder', el('header#top'), el('section#s1', el('p#a'), el('p#head'), el('p#b')));
  const running = new Map([[holder.children[0], 'title'], [holder.children[1].children[1], 'chapter']]);
  const doc = ({ body, defaultView: { getComputedStyle: (e) => ({ getPropertyValue: (prop) => (prop === RUNNING_PROP ? running.get(e) ?? '' : ''), position: 'static' }) } } as any);
  return { doc, body, holder };
}

test('the top-level blocks are the body`s children unless the host names the element they stand in', () => {
  const { doc, holder } = documentOf();
  assert.deepEqual(topLevelBlocks(doc).map((e) => e.id), ['own'], 'as ever: the body');
  assert.deepEqual(topLevelBlocks(doc, holder).map((e) => e.id), ['s1'], 'the holder`s children, less the running mark, which is not a block');
});

test('the running boxes are read in the element the host names, and the memo`s door stays the second argument', () => {
  const { doc, holder } = documentOf();
  assert.deepEqual(runningBoxes(doc), [], 'the body holds none');
  const boxes = runningBoxes(doc, null, holder);
  assert.deepEqual(boxes.map((r) => [r.el.id, r.name, r.block, r.next?.id ?? null]), [['top', 'title', 0, null], ['head', 'chapter', 0, 'b']], 'the block numbers count the holder`s blocks');
  let asked = 0;
  const keep = (kind, box, read) => (asked++, read());
  assert.deepEqual(runningBoxes(doc, keep, holder), boxes, 'a memo reads through, as it always did');
  assert.equal(asked, 2, 'once per box in the holder');
});

test('a running element`s place is the base of its block plus the words before the element that follows it', () => {
  const index = { bases: [0, 12], wordsBefore: (e) => (e.id === 'b' ? 3 : 0) };
  assert.equal(runningPosition({ block: 1, next: null }, index), 12, 'nothing follows it in its block: the block`s first word');
  assert.equal(runningPosition({ block: 1, next: { id: 'b' } }, index), 15);
});
