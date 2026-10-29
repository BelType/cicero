/**
 * The run-level walks, kept per top-level box (*a resumed run keeps its reads*, 2026-10-22), DOM-free: the position index and the document ops assembled from per-box parts equal the walks taken whole, and a memo that forgets one box reads that box again and no other.
 *
 * What a browser adds (the `:has()` answers, the reads' site search, that `getComputedStyle` is what the parts were read from) is proved next door, by the venue's resume pins and the editing tools' `preview-resumes`; what is pinned here is the seam's arithmetic and the memo's forgetting.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexBlock, indexBlocks as indexBlocksTyped } from '../src/positions.ts';
import { documentOpsOf as documentOpsOfTyped } from '../src/document-state.ts';
import { ForcingMemo } from '../src/forcing-memo.ts';
import { byShape, fakeElement } from './fakes.ts';

const indexBlocks = byShape(indexBlocksTyped);
const documentOpsOf = byShape(documentOpsOfTyped);

const t = (data: any) => ({ nodeType: 3, data });
/** A plain element that both walks can read: `childNodes` for the index, `children` and `parentElement` for the ops and the memo, `style` for `styleOf`. */
const el = (style: any, ...kids: any[]) => {
  const e = { nodeType: 1, style, childNodes: kids, children: kids.filter((k) => k.nodeType === 1), parentElement: null as any };
  for (const k of e.children) k.parentElement = e;
  return e;
};
const isInline = (e: any) => e.style.display === 'inline';
const isFixed = (e: any) => e.style.position === 'fixed';
const styleOf = (e: any) => e.style;

/** Three top-level blocks: a chapter with a counter and a nested section, a fixed box inside a paragraph, and one that opens inside a word across an inline seam. */
function documentOf() {
  const h1 = el({ counterIncrement: 'chapter 1', counterReset: 'section 0' }, t('One heading'));
  const h2 = el({ counterIncrement: 'section 1' }, t('A subheading here'));
  const p1 = el({}, t('alpha beta gamma'), el({ display: 'inline' }, t('delta')), t(' epsilon'));
  const chapter = el({}, h1, el({}, h2, p1));
  const p2 = el({}, t('zeta eta'), el({ position: 'fixed', counterIncrement: 'chapter 5' }, t('never counted')), t(' theta'));
  const second = el({ counterReset: 'chapter 9' }, p2);
  const third = el({}, t('io'), el({ display: 'inline', counterIncrement: 'section 1' }, t('ta kappa')), t(' lambda'));
  const blocks = [chapter, second, third];
  const root = { nodeType: 1, style: {} as any, childNodes: blocks, children: blocks, parentElement: null as any };
  for (const b of blocks) b.parentElement = root;
  return { blocks, h1, h2, p1, p2 };
}

/** Every element below the blocks, in document order. */
const elementsOf = (blocks: any) => {
  const out: any[] = [];
  const walk = (e: any) => { out.push(e); for (const c of e.children) walk(c); };
  blocks.forEach(walk);
  return out;
};

test('the position index assembled from per-box parts equals the index built whole: bases, positions, word counts', () => {
  const { blocks } = documentOf();
  const whole = indexBlocks(blocks, isInline, isFixed);
  const parts = blocks.map((block, b) => indexBlock(block, b, isInline, isFixed));
  const assembled = indexBlocks(blocks, isInline, isFixed, (kind: any, box: any, read: any) => parts[blocks.indexOf(box)]);
  assert.deepEqual(assembled.bases, whole.bases);
  assert.deepEqual(assembled.wordCounts, whole.wordCounts);
  assert.equal(assembled.total, whole.total);
  for (const e of elementsOf(blocks)) {
    assert.deepEqual(assembled.entryFor(e), whole.entryFor(e), 'every element answers the same entry');
  }
  assert.equal(assembled.endOf([2, 0]), whole.endOf([2, 0]));
  // Through the memo, twice: the second index reads nothing and answers the same.
  const memo = new ForcingMemo();
  let reads = 0;
  const counting = (e: any) => (reads++, isInline(e));
  indexBlocks(blocks, counting, isFixed, memo.keep);
  const first = reads;
  const again = indexBlocks(blocks, counting, isFixed, memo.keep);
  assert.ok(first > 0);
  assert.equal(reads, first, 'a kept part reads no style');
  assert.deepEqual(again.bases, whole.bases);
  for (const e of elementsOf(blocks)) assert.deepEqual(again.entryFor(e), whole.entryFor(e));
});

test('the document ops assembled from per-box logs equal the whole walk\'s log, with global positions', () => {
  const { blocks, h1 } = documentOf();
  const index = indexBlocks(blocks, isInline, isFixed);
  const html = el({ counterReset: 'chapter' });
  const body = el({});
  const running = [{ name: 'head', pos: 4 }];
  const whole = documentOpsOf(blocks, index, { styleOf, ancestors: [html, body], running });
  const memo = new ForcingMemo();
  const kept = documentOpsOf(blocks, index, { styleOf, ancestors: [html, body], running, keep: memo.keep });
  assert.deepEqual(kept, whole, 'the assembled log is the whole log');
  const again = documentOpsOf(blocks, index, { styleOf, ancestors: [html, body], running, keep: memo.keep });
  assert.deepEqual(again, whole, 'and so is the one read from the memo');
  assert.ok(whole.some((op: any) => op.pos > index.bases[1]), 'a later block\'s operations stand at global positions');
  // With marks: a part kept under one set of marks is not the answer under another.
  const marked = documentOpsOf(blocks, index, { styleOf, ancestors: [html, body], marks: new Set([h1]), keep: memo.keep });
  assert.deepEqual(marked, documentOpsOf(blocks, index, { styleOf, ancestors: [html, body], marks: new Set([h1]) }));
  const other = blocks[2].children[0];
  const remarked = documentOpsOf(blocks, index, { styleOf, ancestors: [html, body], marks: new Set([h1, other]), keep: memo.keep });
  assert.deepEqual(remarked, documentOpsOf(blocks, index, { styleOf, ancestors: [html, body], marks: new Set([h1, other]) }), 'a mark that moved into a kept box is read again');
});

test('a memo forgetting one box reads that box again and no other', () => {
  const { blocks, p1 } = documentOf();
  const memo = new ForcingMemo();
  let reads = 0;
  const counting = (e: any) => (reads++, e.style);
  const run = () => {
    memo.settle(0);
    const index = indexBlocks(blocks, isInline, isFixed, memo.keep);
    return documentOpsOf(blocks, index, { styleOf: counting, keep: memo.keep });
  };
  run();
  reads = 0;
  run();
  assert.equal(reads, 0, 'nothing forgotten, nothing read');

  // An edit inside the first block: a paragraph replaced by a longer one.
  const longer = el({}, t('alpha beta gamma delta epsilon zeta'));
  const parent = p1.parentElement;
  parent!.children[parent!.children.indexOf(p1)] = longer;
  parent!.childNodes[parent!.childNodes.indexOf(p1)] = longer;
  longer.parentElement = parent;
  memo.replaced(fakeElement(longer));
  const ops = run();
  let alone = 0;
  documentOpsOf([blocks[0]], indexBlocks([blocks[0]], isInline, isFixed), { styleOf: (e: any) => (alone++, e.style) });
  assert.equal(reads, alone, 'the edited block is read again, whole, and no other block is');
  const fresh = documentOpsOf(blocks, indexBlocks(blocks, isInline, isFixed), { styleOf });
  assert.deepEqual(ops, fresh, 'and the log is the one a fresh walk takes of the edited document');
  const index = indexBlocks(blocks, isInline, isFixed, memo.keep);
  assert.deepEqual(index.wordCounts, indexBlocks(blocks, isInline, isFixed).wordCounts, 'the index counts the new words');
});

test('a sheet that reaches a sibling forgets every box when a top-level box is replaced, and one that reaches further keeps nothing', () => {
  const { blocks } = documentOf();
  const memo = new ForcingMemo();
  let reads = 0;
  const counting = (e: any) => (reads++, e.style);
  const index = indexBlocks(blocks, isInline, isFixed);
  const walk = () => documentOpsOf(blocks, index, { styleOf: counting, keep: memo.keep });
  memo.settle(1);
  walk();
  const whole = reads;

  // An edit inside a block, at reach 1, forgets that block alone.
  reads = 0;
  memo.replaced(blocks[1].children[0]);
  assert.equal(memo.settle(1), true);
  walk();
  let alone = 0;
  documentOpsOf([blocks[1]], indexBlocks([blocks[1]], isInline, isFixed), { styleOf: (e: any) => (alone++, e.style) });
  assert.equal(reads, alone);

  // A top-level box replaced at reach 1 can change its next sibling's style: everything is read again.
  reads = 0;
  memo.replaced(fakeElement(blocks[2]));
  assert.equal(memo.settle(1), true);
  walk();
  assert.equal(reads, whole);

  // At reach 2 the memo is refused for the run and emptied.
  assert.equal(memo.settle(2), false);
  reads = 0;
  memo.settle(0);
  walk();
  assert.equal(reads, whole, 'emptied: the next run reads everything');
});
