/**
 * The scope the engine states: a vertical box below the root is refused by name, multi-column boxes are found, and the words sheet turns `one-column` into one column.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readScope } from '../src/scope.ts';
import { REGISTRY, WORDS_RULES } from '../src/data-beltype.ts';

const el = (tag: string, kids: any[] = []): any => ({ localName: tag, className: '', querySelectorAll: () => kids });
const win = (styles: Map<any, Record<string, string>>): any => ({ getComputedStyle: (e: any) => styles.get(e) ?? {} });

test('a vertical box below the root is refused by name; a horizontal tree passes', () => {
  const inner = el('p');
  const block = el('div', [inner]);
  assert.deepEqual(readScope(win(new Map()), [block]), []);
  assert.throws(() => readScope(win(new Map([[inner, { writingMode: 'vertical-rl' }]])), [block]), /vertical writing is outside this engine's scope: <p>.*'vertical-rl'/);
});

test('the multi-column boxes are the ones that set a count or a width', () => {
  const a = el('dl'), b = el('div'), c = el('ul');
  const block = el('section', [a, b, c]);
  const styles = new Map<any, Record<string, string>>([[a, { columnCount: '2', columnWidth: 'auto' }], [b, { columnCount: 'auto', columnWidth: '120px' }], [c, { columnCount: 'auto', columnWidth: 'auto' }]]);
  assert.deepEqual(readScope(win(styles), [block]), [a, b]);
});

test('the one-column word is registered and the words sheet makes it one column', () => {
  assert.ok(REGISTRY.some((e) => e.name === 'one-column' && e.kind === 'flag'));
  assert.match(WORDS_RULES, /one-column"\]\s*\{ column-count: auto !important; column-width: auto !important; \}/);
});
