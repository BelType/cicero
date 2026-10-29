/** The `data-beltype` registry — `src/data-beltype.js` (*one attribute has words*, 2026-10-10): the grammar, the table, the key-suffix check and the `has:` family's spellings. DOM-free: a plain object with the three attribute verbs is a bearer. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTRIBUTE, REGISTRY, FLAGS, KEYS, TRANSFORM, CICERO_PROVISION, CICERO_INTERFACE, ARTIFACT,
  assertNoKeySuffix, keyEndingWithAnother, words, wordOf, hasWord, addWord, removeWord, hasAnyWord, isEngineMark, setValue, removeKey,
  ENGINE_MARKS, POS_SELECTOR, posOf, setPos, stripPos, withoutPos,
  encodeHasUnion, authorSelectorOf, bareHasCount, isHasRegistryRule, encodeHasArgument, decodeHasArgument, hasWordFor
} from '../src/data-beltype.ts';

/** An element the way the grammar reads one. */
function bearer(value) {
  const attrs = new Map(value == null ? [] : [[ATTRIBUTE, value]]);
  return {
    getAttribute: (k) => attrs.get(k) ?? null,
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
    attrs
  };
}

test('the table: every word once — the head\'s three, the engine\'s, the stamp, and the keys', () => {
  assert.deepEqual([...FLAGS].sort(), [CICERO_INTERFACE, CICERO_PROVISION, TRANSFORM, 'adjoin', 'artifact', 'away', 'break', 'end', 'fill', 'fixed', 'fragment', 'shell', 'split', 'start', 'wrapped'].sort());
  assert.deepEqual([...KEYS].sort(), ['has', 'pos', 'slice']);
  assert.equal(REGISTRY.find((e) => e.name === 'pos').status, 'in use', 'core writes `pos:` since step 2');
  assert.equal(REGISTRY.find((e) => e.name === 'pos').writer, 'belt');
  assert.equal(REGISTRY.find((e) => e.name === 'has').writer, 'engine');
  assert.equal(REGISTRY.find((e) => e.name === 'slice').property, '--beltype-slice', 'a value word names the custom property the generated sheet delivers it into');
  assert.equal(new Set(REGISTRY.map((e) => e.name)).size, REGISTRY.length, 'every fact is declared once');
  for (const e of REGISTRY.filter((x) => x.facing === 'author hook')) assert.ok(['split', 'start', 'end', 'slice'].includes(e.name), `${e.name}: only the piece words are author hooks`);
});

test('the artifact word: a flag in use, written by the engine, and a copy keeps its source\'s words beside it', () => {
  const entry = REGISTRY.find((e) => e.name === ARTIFACT);
  assert.equal(ARTIFACT, 'artifact');
  assert.deepEqual([entry?.kind, entry?.status, entry?.writer], ['flag', 'in use', 'engine']);
  const copy = bearer('pos:12 fragment');
  addWord(copy, ARTIFACT);
  assert.equal(copy.attrs.get(ATTRIBUTE), 'pos:12 fragment artifact', 'the furniture word is added, not written over the copy\'s others');
  assert.equal(hasWord(copy, ARTIFACT), true);
});

test('the engine\'s own marks are a named set: a divided box, a fixed copy and the three elements it creates — not a fragment alone, which a composed block\'s clone also is', () => {
  assert.deepEqual([...ENGINE_MARKS].sort(), ['break', 'fill', 'fixed', 'shell', 'split']);
  assert.equal(isEngineMark(bearer('fragment split start')), true);
  assert.equal(isEngineMark(bearer('fragment')), false);
  assert.equal(isEngineMark(bearer('pos:12 break')), true);
  assert.equal(isEngineMark(bearer(null)), false);
  assert.equal(hasAnyWord(bearer('a b'), new Set(['c'])), false);
});

test('setValue and removeKey replace and remove a key\'s word and leave every other word', () => {
  const el = bearer('split slice:2 pos:12');
  setValue(el, 'slice', 3);
  assert.equal(el.attrs.get(ATTRIBUTE), 'split pos:12 slice:3');
  removeKey(el, 'pos');
  assert.equal(el.attrs.get(ATTRIBUTE), 'split slice:3');
  removeKey(el, 'slice');
  removeKey(el, 'nothing');
  assert.equal(el.attrs.get(ATTRIBUTE), 'split');
  const bare = bearer(null);
  setValue(bare, 'slice', 1);
  assert.equal(bare.attrs.get(ATTRIBUTE), 'slice:1');
  removeKey(bare, 'slice');
  assert.equal(bare.attrs.has(ATTRIBUTE), false, 'the attribute goes with its last word');
});

test('the line stamp: read as a word, set and stripped as a word, never as the whole attribute', () => {
  const copy = bearer('split slice:2 pos:135');
  assert.equal(posOf(copy), 135);
  setPos(copy, 140);
  assert.equal(copy.attrs.get(ATTRIBUTE), 'split slice:2 pos:140', 'the engine\'s words stand');
  stripPos(copy);
  assert.equal(copy.attrs.get(ATTRIBUTE), 'split slice:2');
  assert.equal(posOf(copy), null);
  const alone = bearer('pos:7');
  stripPos(alone);
  assert.equal(alone.attrs.has(ATTRIBUTE), false);
  assert.equal(withoutPos('split pos:12 has:3gv2ab'), 'split has:3gv2ab');
  assert.equal(POS_SELECTOR, '[data-beltype*="pos:"]');
  assert.equal(posOf(bearer(null)), null);
});

test('no key may end with another key: the registry passes, and the check refuses a pair that would not', () => {
  assert.equal(keyEndingWithAnother(KEYS), null);
  assert.deepEqual(keyEndingWithAnother(['pos', 'xpos']), ['xpos', 'pos']);
  assert.throws(() => assertNoKeySuffix(['has', 'slice', 'xhas']), /"xhas" ends with the key "has"/);
  assert.doesNotThrow(() => assertNoKeySuffix(['has', 'pos', 'slice', 'port', 'engine']));
});

test('words(): flags as a set, values as a map, a number parsed and a hash left a string', () => {
  const { flags, values } = words(bearer('split slice:2 has:3gv2ab pos:135 has:0259fw'));
  assert.deepEqual([...flags], ['split']);
  assert.equal(values.get('slice'), 2);
  assert.equal(values.get('pos'), 135);
  assert.equal(values.get('has'), '0259fw', 'a key repeated keeps the last word for the map, and hasWord answers each');
  assert.equal(typeof wordOf(bearer('has:3gv2ab'), 'has'), 'string');
  assert.equal(wordOf(bearer('has:0123'), 'has'), 123, 'a hash that happens to read as a number is a number — which is why a reader that needs the text asks hasWord');
  assert.deepEqual(words(bearer(null)).flags.size, 0);
  assert.equal(wordOf(bearer(''), 'pos'), undefined);
});

test('hasWord(): an exact word, flag or value, never a substring', () => {
  const el = bearer('cicero-provision has:3gv2ab');
  assert.equal(hasWord(el, CICERO_PROVISION), true);
  assert.equal(hasWord(el, 'cicero'), false);
  assert.equal(hasWord(el, hasWordFor('3gv2ab')), true);
  assert.equal(hasWord(el, 'has:3gv2'), false);
});

test('addWord and removeWord are read-modify-write: a copy keeps what its source carried, and the attribute goes with the last word', () => {
  const copy = bearer('pos:12');
  addWord(copy, 'has:3gv2ab');
  assert.equal(copy.attrs.get(ATTRIBUTE), 'pos:12 has:3gv2ab', 'the source\'s stamp is still there');
  addWord(copy, 'has:3gv2ab');
  assert.equal(copy.attrs.get(ATTRIBUTE), 'pos:12 has:3gv2ab', 'a word twice is a word once');
  removeWord(copy, 'pos:12');
  assert.equal(copy.attrs.get(ATTRIBUTE), 'has:3gv2ab');
  removeWord(copy, 'has:3gv2ab');
  assert.equal(copy.attrs.has(ATTRIBUTE), false, 'an element with nothing to say carries no attribute');
  addWord(copy, 'split');
  assert.equal(copy.attrs.get(ATTRIBUTE), 'split');
  removeWord(copy, 'nothing-here');
  assert.equal(copy.attrs.get(ATTRIBUTE), 'split');
});

test('the union is spelled once and read back whole: nested parentheses, strings, several in one selector', () => {
  const union = encodeHasUnion('3gv2ab', '> a:not(.x), + p[title="a)b"]', 'a:not(.x), p[title="a)b"]');
  assert.equal(union, ':is(:where([data-beltype~="has:3gv2ab"]):is(*, a:not(.x), p[title="a)b"]), :where(:not([data-beltype~="fragment"])):has(> a:not(.x), + p[title="a)b"]))');
  assert.equal(authorSelectorOf(`section${union} > p, li${encodeHasUnion('x1', '+ ul', 'ul')}`), 'section:has(> a:not(.x), + p[title="a)b"]) > p, li:has(+ ul)');
  assert.equal(authorSelectorOf('p:has(> a)'), 'p:has(> a)', 'a selector with no union is returned as it is');
  assert.equal(authorSelectorOf(':is(:where([data-beltype~="has:zz"]) x'), ':is(:where([data-beltype~="has:zz"]) x', 'a head the shape does not complete is left alone');
});

test('bareHasCount: every :has( the text holds, less the one inside each union', () => {
  const union = encodeHasUnion('a1b2c3', '> a', 'a');
  assert.equal(bareHasCount(`p${union}`), 0);
  assert.equal(bareHasCount(`p:has(> a)`), 1);
  assert.equal(bareHasCount(`p${union}, li:has(:hover)`), 1, 'a selector list with one rewritten and one left has one left');
  assert.equal(bareHasCount('p > a'), 0);
});

test('the registry rule and its argument codec', () => {
  assert.equal(isHasRegistryRule(':not(*)'), true);
  assert.equal(isHasRegistryRule('p'), false);
  for (const argument of ['> h2.mark', '+ p[title="a\\"b"]', 'a, b']) {
    assert.equal(decodeHasArgument(encodeHasArgument(argument)), argument);
  }
  assert.equal(decodeHasArgument('not a string'), null);
});
