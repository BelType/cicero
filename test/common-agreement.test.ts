/**
 * The pin between common's `data-beltype` grammar and the engine's registry (common's SPEC, Article 3): the attribute, the belt's words and their kinds, and the parse of a shared table of values. Ported from BelType's root `test/data-beltype.test.js`, less its one test of core's shell, which stays there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as common from '@beltype/common/data-beltype';
import * as engine from '../src/data-beltype.ts';

const VALUES = [null, '', '   ', 'pos:135', 'split', 'split slice:2 pos:7 has:3gv2ab', '  split   start  ', 'pos:x', 'xpos:3', 'pos:-4', 'pos:1.5', 'a\tb\nc', 'has:3gv2ab fragment'];
const bearer = (value: string | null) => ({ getAttribute: (k: string) => (k === 'data-beltype' ? value : null) }) as any;

test('common and the registry agree on the attribute and on the belt\'s words and their kinds', () => {
  assert.equal(common.ATTRIBUTE, engine.ATTRIBUTE);
  assert.equal(common.TRANSFORM, engine.TRANSFORM);
  assert.equal(common.POS_KEY, engine.POS_KEY);
  assert.equal(common.POS_SELECTOR, engine.POS_SELECTOR);
  for (const { name, kind } of common.BELT_WORDS) {
    const entry = engine.REGISTRY.find((e) => e.name === name);
    assert.equal(entry?.kind, kind, `${name} is a ${kind} in both`);
    assert.equal(entry?.status, 'in use');
    assert.equal(entry?.writer, 'belt');
  }
});

test('common and the registry parse every sample value alike', () => {
  for (const value of VALUES) {
    const here = common.words(value);
    const there = engine.words(bearer(value));
    assert.deepEqual([...here.flags], [...there.flags], `flags of ${JSON.stringify(value)}`);
    assert.deepEqual([...here.values], [...there.values], `values of ${JSON.stringify(value)}`);
    assert.equal(common.posOf(bearer(value)), engine.posOf(bearer(value)), `posOf ${JSON.stringify(value)}`);
    assert.equal(common.wordOf(value, 'slice'), engine.wordOf(bearer(value), 'slice'));
    for (const word of ['split', 'start', 'fragment', 'star', 'pos:135']) assert.equal(common.hasWord(value, word), engine.hasWord(bearer(value), word), `hasWord ${word} of ${JSON.stringify(value)}`);
    assert.equal(common.withoutPos(value), engine.withoutPos(value ?? ''), `withoutPos ${JSON.stringify(value)}`);
  }
});

test('common and the registry write alike', () => {
  for (const value of VALUES) {
    const cell = (v: string | null) => { const attrs = new Map<string, string>(v === null ? [] : [['data-beltype', v]]); return { attrs, getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, x: string) => void attrs.set(k, x), removeAttribute: (k: string) => void attrs.delete(k) }; };
    const a = cell(value);
    const b = cell(value);
    common.setPos(a, 9);
    engine.setPos(b as any, 9);
    assert.equal(a.attrs.get('data-beltype'), b.attrs.get('data-beltype'), `setPos on ${JSON.stringify(value)}`);
    const c = cell(value);
    const d = cell(value);
    common.addWordTo(c, 'fragment');
    engine.addWord(d as any, 'fragment');
    const list = (m: Map<string, string>) => (m.get('data-beltype') ?? '').split(/\s+/).filter(Boolean);
    assert.deepEqual(list(c.attrs), list(d.attrs), `add a word to ${JSON.stringify(value)}`);
  }
});
