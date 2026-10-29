/**
 * The one-to-four box grammar, DOM-free (*the silent defects earn their cases*, 2026-09-09).
 *
 * What is worth pinning here is not the four-value case, which nobody gets wrong. It is the three-value case, whose middle value serves two sides; the paren-aware split, which is why a `var()` carrying its own fallback list does not become four values; and the refusal to guess at a list length the grammar does not have — the thing the browser would have done for us if it could.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandBox, topLevelValues } from '../src/box-shorthand.ts';

test('one to four values map to the sides CSS says they do', () => {
  assert.deepEqual(expandBox('12mm'), { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' });
  assert.deepEqual(expandBox('1px 2px'), { top: '1px', right: '2px', bottom: '1px', left: '2px' });
  assert.deepEqual(expandBox('1px 2px 3px'), { top: '1px', right: '2px', bottom: '3px', left: '2px' }, 'three values: the middle one is BOTH horizontal sides');
  assert.deepEqual(expandBox('1px 2px 3px 4px'), { top: '1px', right: '2px', bottom: '3px', left: '4px' });
});

test('a function keeps its own spaces and commas', () => {
  assert.deepEqual(topLevelValues('var(--a, 1px 2px) 3px'), ['var(--a, 1px 2px)', '3px']);
  assert.deepEqual(expandBox('var(--outer)'), { top: 'var(--outer)', right: 'var(--outer)', bottom: 'var(--outer)', left: 'var(--outer)' });
  assert.deepEqual(expandBox('calc(1in - 3mm) var(--x)'), { top: 'calc(1in - 3mm)', right: 'var(--x)', bottom: 'calc(1in - 3mm)', left: 'var(--x)' });
});

test('whitespace is not a value, and a list the grammar does not have is refused rather than guessed', () => {
  assert.deepEqual(topLevelValues('  10px   20px  '), ['10px', '20px']);
  assert.equal(expandBox(''), null);
  assert.equal(expandBox('   '), null);
  assert.equal(expandBox('1px 2px 3px 4px 5px'), null, 'five values are not the grammar: the caller reports no declaration, which is where it was without this module');
});

test('the values come back as the author wrote them, unresolved', () => {
  const sides = expandBox('var(--outer)');
  assert.equal(sides!.top, 'var(--outer)', 'this module knows nothing about lengths; capture.js seats each raw value and the browser answers');
});
