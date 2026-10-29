/**
 * The counter styles, pinned as arithmetic (*a counter has a style*, 2026-09-14).
 *
 * Not a table of expected strings typed twice: what is asserted here is where each system CHANGES — the subtractive pairs a roman numeral is wrong without, the wrap from `z` to `aa`, the leading zero's own boundary, and the two ranges outside which a numeral does not exist and decimal is the specification's own answer. Plus the fallback's contract, which is the decision this module carries: an unknown style prints a number and says so once.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { format, resetWarnings, COUNTER_STYLES } from '../src/counter-styles.ts';

test('decimal is the default and the fallback of every range', () => {
  assert.equal(format(7), '7');
  assert.equal(format(7, 'decimal'), '7');
  assert.equal(format(0, 'lower-roman'), '0', 'a roman numeral for zero does not exist — css-counter-styles-3 falls the value back to decimal rather than inventing one');
  assert.equal(format(4000, 'upper-roman'), '4000');
  assert.equal(format(0, 'lower-alpha'), '0');
  assert.equal(format(-3, 'upper-latin'), '-3');
});

test('the roman numerals are right where they subtract', () => {
  const cases = [[1, 'i'], [3, 'iii'], [4, 'iv'], [9, 'ix'], [14, 'xiv'], [40, 'xl'], [90, 'xc'], [400, 'cd'], [900, 'cm'], [1987, 'mcmlxxxvii'], [3999, 'mmmcmxcix']];
  for (const [n, want] of cases) assert.equal(format(n, 'lower-roman'), want, `${n}`);
  assert.equal(format(1987, 'upper-roman'), 'MCMLXXXVII', 'the upper case is the lower case, cased — one system, not two');
});

test('the alphabetic systems are bijective base 26, and latin is alpha', () => {
  assert.equal(format(1, 'lower-alpha'), 'a');
  assert.equal(format(26, 'lower-alpha'), 'z');
  assert.equal(format(27, 'lower-alpha'), 'aa', 'the wrap has no `[a]` at position zero — 27 is `aa`, never `ba`');
  assert.equal(format(52, 'lower-alpha'), 'az');
  assert.equal(format(53, 'lower-alpha'), 'ba');
  assert.equal(format(703, 'lower-alpha'), 'aaa');
  assert.equal(format(27, 'upper-latin'), 'AA');
  assert.equal(format(27, 'lower-latin'), format(27, 'lower-alpha'), 'latin and alpha are aliases of one system, not two tables that can drift');
});

test('decimal-leading-zero pads below ten and stops there', () => {
  assert.equal(format(0, 'decimal-leading-zero'), '00');
  assert.equal(format(9, 'decimal-leading-zero'), '09');
  assert.equal(format(10, 'decimal-leading-zero'), '10');
  assert.equal(format(-4, 'decimal-leading-zero'), '-4', 'a negative is not padded — there is no second digit to reach');
});

test('`none` prints nothing, which is what the style means', () => {
  assert.equal(format(5, 'none'), '');
});

test('an unknown style prints the number and warns once, not once per page', () => {
  resetWarnings();
  const said = [];
  const warn = (m) => said.push(m);
  assert.equal(format(3, 'cjk-earthly-branch', warn), '3', 'the number is computed and readable; only its spelling is unknown');
  assert.equal(format(4, 'cjk-earthly-branch', warn), '4');
  assert.equal(format(5, 'CJK-Earthly-Branch', warn), '5', 'the name is folded, so one style is one notice');
  assert.equal(said.length, 1, 'a hundred-page document must not bury the notice under a hundred copies of it');
  assert.match(said[0], /cjk-earthly-branch/);
  assert.match(said[0], /decimal/, 'the notice says what was printed instead, or it is a riddle');
});

test('the style list is read from the table rather than typed beside it', () => {
  for (const name of COUNTER_STYLES) assert.equal(typeof format(1, name), 'string', name);
  assert.ok(COUNTER_STYLES.includes('lower-roman') && COUNTER_STYLES.includes('upper-latin'));
});
