import test from 'node:test';
import assert from 'node:assert/strict';
import { CompositionCache, paragraphKey, shapeOf, lookup, remember, blockKey } from '../src/composition-key.ts';

/** A paragraph as the key reads it. A fresh object every call: the key must not care which object it was handed. */
const para = (extra: any = {}) => ({ path: [4, 0, 2], markup: '<p>The quick brown fox jumps over the lazy dog.</p>', width: 412.5, inputs: ['left', 0, 'manual', 'en', '‐'], ...extra });

test('the same path, the same text and the same width are the same key, whichever object carries them', () => {
  assert.equal(paragraphKey(para()), paragraphKey(para()));
  assert.equal(paragraphKey(para()), paragraphKey(para({ path: [...[4, 0, 2]] })), 'a copy of the path is the path');
});

test('a changed word, a changed width and a changed path are three different keys', () => {
  const base = paragraphKey(para());
  assert.notEqual(base, paragraphKey(para({ markup: '<p>The quick brown fox jumps over the lazy cat.</p>' })), 'a changed word');
  assert.notEqual(base, paragraphKey(para({ width: 412.51 })), 'a changed width');
  assert.notEqual(base, paragraphKey(para({ path: [4, 0, 3] })), 'a changed path');
});

test('markup is in the key and not the text alone: wrapping a word in an element changes its width', () => {
  assert.notEqual(paragraphKey(para()), paragraphKey(para({ markup: '<p>The quick brown fox jumps over the lazy <b>dog</b>.</p>' })));
});

test('every per-block style input the lines are a function of is in the key', () => {
  const base = paragraphKey(para());
  assert.notEqual(base, paragraphKey(para({ inputs: ['justify', 0, 'manual', 'en', '‐'] })), 'alignment');
  assert.notEqual(base, paragraphKey(para({ inputs: ['left', 12, 'manual', 'en', '‐'] })), 'indent');
  assert.notEqual(base, paragraphKey(para({ inputs: ['left', 0, 'auto', 'en', '‐'] })), 'hyphens');
  assert.notEqual(base, paragraphKey(para({ inputs: ['left', 0, 'manual', 'it', '‐'] })), 'language');
});

test('the editing host\'s line stamps are not text: an edit above shifts every stamp below it and no paragraph\'s lines', () => {
  const at = (n: any) => `<p data-beltype="pos:${n}">The quick <em data-beltype="pos:${n}">brown</em> fox.</p>`;
  assert.equal(shapeOf(at(31)), shapeOf(at(87)));
  assert.equal(paragraphKey(para({ markup: shapeOf(at(31)) })), paragraphKey(para({ markup: shapeOf(at(87)) })));
  assert.notEqual(shapeOf(at(31)), shapeOf(at(31).replace('brown', 'green')), 'and the words stay in');
});

test('the stamp is a WORD of data-beltype: only it is taken out, a word of the engine\'s or an author\'s stays, and the attribute goes with its last word', () => {
  const at = (n: any) => `<p data-beltype="pos:${n}">The quick <em data-beltype="pos:${n} has:3gv2ab">brown</em> fox.</p>`;
  assert.equal(shapeOf(at(31)), shapeOf(at(87)));
  assert.equal(shapeOf(at(31)), '<p>The quick <em data-beltype="has:3gv2ab">brown</em> fox.</p>');
  assert.notEqual(shapeOf(at(31)), shapeOf(at(31).replace('has:3gv2ab', 'has:zzzzzz')), 'a word that is not the stamp is part of the shape');
});

test('a record stored under a key is found under an equal key from another object, and counted', () => {
  const cache = new CompositionCache();
  const record = { runs: [], lineCount: 3 };
  assert.equal(lookup(cache, paragraphKey(para())), undefined, 'cold');
  remember(cache, paragraphKey(para()), record);
  assert.equal(lookup(cache, paragraphKey(para())), record, 'a different object with the same key hits');
  assert.equal(lookup(cache, paragraphKey(para({ markup: '<p>changed</p>' }))), undefined, 'a changed word misses');
  assert.equal(lookup(cache, paragraphKey(para({ width: 300 }))), undefined, 'a changed width misses');
  assert.deepEqual({ hits: cache.hits, misses: cache.misses }, { hits: 1, misses: 1 }, 'a miss is a composition performed, a hit a composition not performed');
});

test('a plain Map is still a cache: the harness callers hand one in and nothing is counted', () => {
  const cache = new Map<any, any>();
  remember(cache, 'k', { runs: [] });
  assert.ok(lookup(cache, 'k'));
  assert.equal(lookup(cache, 'other'), undefined);
});

test('the cache clears with the conditions and keeps its records while they stand', () => {
  const cache = new CompositionCache();
  assert.equal(cache.restart('1000x800@1:sheets-a'), true, 'the first restart seats the conditions');
  remember(cache, 'k', { runs: [] });
  assert.equal(cache.restart('1000x800@1:sheets-a'), false, 'the same conditions keep the records');
  assert.ok(lookup(cache, 'k'));
  assert.equal(cache.restart('1400x800@1:sheets-a'), true, 'a viewport is a condition');
  assert.equal(cache.size, 0, 'and nothing survives it');
  remember(cache, 'k', { runs: [] });
  assert.equal(cache.restart('1400x800@1:sheets-b'), true, 'a stylesheet is a condition');
  assert.equal(cache.size, 0);
});

test('the tally is the run\'s: every restart begins it again', () => {
  const cache = new CompositionCache();
  cache.restart('a');
  remember(cache, 'k', {});
  lookup(cache, 'k');
  assert.deepEqual({ hits: cache.hits, misses: cache.misses }, { hits: 1, misses: 1 });
  cache.restart('a');
  assert.deepEqual({ hits: cache.hits, misses: cache.misses }, { hits: 0, misses: 0 }, 'the records stay, the count does not');
  assert.equal(cache.size, 1);
});

/** A top-level block as the block memo reads it. */
const block = (extra: any = {}) => ({ index: 7, width: 640, markup: '<section><h2>Title</h2><p>One two three.</p></section>', before: 'section class="chapter"', last: false, ...extra });

test('a top-level block unchanged, at the width it was laid out at, between the same neighbours, is the same key', () => {
  assert.equal(blockKey(block()), blockKey(block()));
  const at = (n: any) => `<section data-beltype="pos:${n}"><h2 data-beltype="pos:${n}">Title</h2><p>One two three.</p></section>`;
  assert.equal(blockKey(block({ markup: at(4) })), blockKey(block({ markup: at(90) })), 'the editing host\'s stamps are not content');
});

test('everything a block\'s layout is a function of is in the block key: its markup, its width, its place and its neighbour', () => {
  const base = blockKey(block());
  assert.notEqual(base, blockKey(block({ markup: '<section><h2>Title</h2><p>One two three four.</p></section>' })), 'a changed word');
  assert.notEqual(base, blockKey(block({ width: 641 })), 'a changed width');
  assert.notEqual(base, blockKey(block({ index: 8 })), 'a changed index (:nth-child)');
  assert.notEqual(base, blockKey(block({ before: 'section class="appendix"' })), 'a changed previous sibling (a sibling combinator)');
  assert.notEqual(base, blockKey(block({ last: true })), 'the last block (:last-child)');
});

test('the block memo clears with the conditions, and a plain Map has none', () => {
  const cache = new CompositionCache();
  cache.restart('a');
  cache.blocks.set('k', { records: [[0, { runs: [] }]], floaty: false, refused: 0 });
  assert.equal(cache.restart('a'), false);
  assert.equal(cache.blocks.size, 1, 'kept while the conditions stand');
  assert.equal(cache.restart('b'), true);
  assert.equal(cache.blocks.size, 0, 'cleared with them');
  assert.equal(cache.laid, 0);
});

test('the tally counts the top-level blocks laid out, and starts again with the run', () => {
  const cache = new CompositionCache();
  cache.restart('a');
  cache.laid += 3;
  assert.equal(cache.laid, 3);
  cache.restart('a');
  assert.equal(cache.laid, 0);
});
