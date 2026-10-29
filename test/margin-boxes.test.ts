/**
 * css-page-3 §6.2's default alignment table, DOM-free (*where in the band*, 2026-09-07).
 *
 * The table is data transcribed from a specification, and a test that transcribed it a second time would check only that somebody typed it twice. So what is pinned here is the table's SHAPE — the properties that are easy to get wrong, and the one the engine had wrong for as long as the table went unread.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARGIN_CELLS, MARGIN_BOXES, ALIGN_X, ALIGN_Y, HORIZONTAL_BANDS, bandWidths, translateAlignment } from '../src/margin-boxes.ts';

const at = (name: any) => MARGIN_CELLS.find(([n]) => n === name);

test('sixteen boxes, each once, each with a grid seat and both alignments', () => {
  assert.equal(MARGIN_CELLS.length, 16);
  assert.equal(new Set(MARGIN_BOXES).size, 16);
  assert.equal(new Set(MARGIN_CELLS.map(([, r, c]) => `${r}/${c}`)).size, 16, 'no two boxes share a cell');
  for (const [name, row, col, x, y] of MARGIN_CELLS) {
    assert.ok(row >= 1 && row <= 5 && col >= 1 && col <= 5, `${name} sits on the 5x5 grid`);
    assert.ok(ALIGN_X[x], `${name}'s text-align is translatable`);
    assert.ok(ALIGN_Y[y], `${name}'s vertical-align is translatable`);
  }
});

test('the table is NOT centring — which is what the engine assumed until it was read', () => {
  // `.margin-cell { justify-content: center }` for all sixteen was the whole implementation, and it is right about six of them.
  const centred = MARGIN_CELLS.filter(([, , , x]) => x === 'center');
  assert.equal(centred.length, 8, 'eight of the sixteen are centred horizontally, and eight are not');
  assert.equal(new Set(MARGIN_CELLS.map(([, , , x]) => x)).size, 3, 'three distinct horizontal alignments, not one');
});

test('the four corners align toward the page area, not out at the sheet edge', () => {
  assert.equal(at('top-left-corner')![3], 'right');
  assert.equal(at('top-right-corner')![3], 'left');
  assert.equal(at('bottom-left-corner')![3], 'right');
  assert.equal(at('bottom-right-corner')![3], 'left');
});

test('the only vertical variation is down the two side bands', () => {
  const notMiddle = MARGIN_CELLS.filter(([, , , , y]) => y !== 'middle').map(([n]) => n);
  assert.deepEqual(notMiddle.sort(), ['left-bottom', 'left-top', 'right-bottom', 'right-top']);
  assert.equal(at('left-top')![4], 'top');
  assert.equal(at('left-bottom')![4], 'bottom');
  assert.equal(at('right-top')![4], 'top');
  assert.equal(at('right-bottom')![4], 'bottom');
});

test('an author’s alignment is restated as the two properties a flex cell reads, and the original is kept', () => {
  assert.deepEqual(translateAlignment([['text-align', 'right', '']]), [
    ['text-align', 'right', ''],
    ['justify-content', 'flex-end', '']
  ]);
  assert.deepEqual(translateAlignment([['vertical-align', 'bottom', 'important']]), [
    ['vertical-align', 'bottom', 'important'],
    ['align-items', 'flex-end', 'important']
  ], 'the priority travels with the translation, or an author’s !important would stop applying');
});

test('a value neither table names rides through untranslated rather than being guessed at', () => {
  assert.deepEqual(translateAlignment([['vertical-align', 'baseline', '']]), [['vertical-align', 'baseline', '']]);
  assert.deepEqual(translateAlignment([['color', 'red', '']]), [['color', 'red', '']]);
});

/**
 * css-page-3 §5.3.2's variable-dimension algorithm, DOM-free (*the margin boxes flex*, 2026-09-14).
 *
 * What is pinned is the section's own PRIORITIES rather than a transcription of its prose — that the middle box is centred whatever the side boxes ask for, that the surplus is distributed in proportion to content, that a lone box takes the band and so may cross the page's centre, and that each of the three branches is entered at the boundary the section draws it at. The numbers from `cases/38-three-boxes-one-band` sit beside them, because a case's arithmetic and the module's are the same arithmetic and this is where they can be compared without a browser.
 */

const sum = (ws: any) => ws.reduce((a: any, b: any) => a + b, 0);

test('the three boxes of a band are the three horizontal seats, and nothing else is', () => {
  assert.deepEqual(HORIZONTAL_BANDS.top, ['top-left', 'top-center', 'top-right']);
  assert.deepEqual(HORIZONTAL_BANDS.bottom, ['bottom-left', 'bottom-center', 'bottom-right']);
  const banded = new Set([...HORIZONTAL_BANDS.top, ...HORIZONTAL_BANDS.bottom]);
  assert.equal(banded.size, 6, 'twelve boxes flex in css-page-3 and six of them are horizontal — the other six are the side bands, which this algorithm does not size');
  for (const name of banded) assert.ok(MARGIN_BOXES.includes(name), name);
  for (const corner of ['top-left-corner', 'top-right-corner', 'bottom-left-corner', 'bottom-right-corner']) assert.ok(!banded.has(corner), 'a corner is fixed in both dimensions and is never in a band');
});

test('a generated middle box is centred, whatever the side boxes ask for', () => {
  // A wide A and a narrow C: the imaginary AC box is twice the LARGER of them, which is what keeps B centred.
  const [wa, wb, wc] = bandWidths({ a: { min: 10, max: 60 }, b: { min: 20, max: 80 }, c: { min: 4, max: 8 }, available: 300 });
  assert.equal(wa, wc, 'B centred means the two sides are equal — this is the section`s first stated priority and the whole reason for the imaginary AC box');
  assert.ok(Math.abs(sum([wa, wb, wc]) - 300) < 1e-9, 'the three used widths fill the band exactly');
  assert.ok(wb > 80, 'the surplus reaches the middle box rather than being left as a gap');
});

test('case 38`s own numbers, to the tenth of a point', () => {
  // A 28-character head in a monospaced face at 9pt: 151.2pt, in a 272.12pt band, between two one-letter boxes of 5.4pt.
  const [a, b, c] = bandWidths({ a: { min: 5.4, max: 5.4 }, b: { min: 27, max: 151.2 }, c: { min: 5.4, max: 5.4 }, available: 272.12 });
  assert.ok(Math.abs(b - 253.98) < 0.05, `the middle box takes about 254pt, not a third of 272 — got ${b}`);
  assert.ok(Math.abs(a - 9.07) < 0.05, `each side takes about 9.1pt — got ${a}`);
  assert.equal(a, c);
});

test('a lone box takes the whole band, which is how it comes to cross the centre (§5.4)', () => {
  const [a, b, c] = bandWidths({ a: { min: 32.4, max: 210.6 }, available: 272.12 });
  assert.equal(b, 0, 'no middle box is generated, so it takes nothing');
  assert.equal(c, 0);
  assert.ok(Math.abs(a - 272.12) < 1e-9, 'the only generated box takes the band — 272pt, far past the page`s centre, which §5.4`s first example allows in as many words');
});

test('the three branches are entered at the boundaries the section draws them at', () => {
  const a = { min: 20, max: 100 };
  const c = { min: 10, max: 50 };
  // Room above both max-content widths: the surplus goes in proportion to those. 200 - 150 = 50, split 100:50.
  const roomy = bandWidths({ a, c, available: 200 });
  assert.ok(Math.abs(roomy[0] - (100 + (50 * 100) / 150)) < 1e-9);
  assert.ok(Math.abs(roomy[2] - (50 + (50 * 50) / 150)) < 1e-9);
  // Exactly the sum of the max-content widths: the second branch is entered and must land on the same answer, or the algorithm is discontinuous at its own boundary.
  const exact = bandWidths({ a, c, available: 150 });
  assert.ok(Math.abs(exact[0] - 100) < 1e-9, 'continuity at available === sum of max-content widths');
  assert.ok(Math.abs(exact[2] - 50) < 1e-9);
  // Between the two sums: the surplus goes in proportion to how much each box could still GROW, which is max minus min.
  const tight = bandWidths({ a, c, available: 60 });
  assert.ok(Math.abs(tight[0] - (20 + (30 * 80) / 120)) < 1e-9);
  assert.ok(Math.abs(tight[2] - (10 + (30 * 40) / 120)) < 1e-9);
  // Below even the min-content widths: the flex space is NEGATIVE and the factors are the min-content widths, so the boxes shrink in proportion to how small they already are. No case exercises this and it is pinned for that reason.
  const cramped = bandWidths({ a, c, available: 15 });
  assert.ok(Math.abs(cramped[0] - (20 + (-15 * 20) / 30)) < 1e-9);
  assert.ok(Math.abs(cramped[2] - (10 + (-15 * 10) / 30)) < 1e-9);
  assert.ok(Math.abs(sum([cramped[0], cramped[1], cramped[2]]) - 15) < 1e-9, 'even overflowing, the three widths are what the band was told to hold');
});

test('a band of nothing divides evenly rather than dividing by zero', () => {
  const [a, b, c] = bandWidths({ available: 300 });
  assert.equal(b, 0, 'no middle box is generated');
  assert.ok(Math.abs(a - 150) < 1e-9, 'both flex factors are 1 where their sum is zero, which is the section`s own sentence');
  assert.ok(Math.abs(c - 150) < 1e-9);
  assert.deepEqual(bandWidths({ a: { min: 5, max: 5 }, available: 0 }), [0, 0, 0], 'a band with no room hands back no room, and never a negative track');
});

test('a box is generated by its content, not by its width — an empty-string box is still a box (§5.2)', () => {
  // Case 50's bottom band: only the middle box is generated, and it says "". It measures zero, and it exists.
  const [a, b, c] = bandWidths({ b: { min: 0, max: 0, generated: true }, available: 255.12 });
  assert.ok(Math.abs(b - 127.56) < 1e-9, `the imaginary AC box is zero, both flex factors are 1, and the middle box takes half the band — got ${b}`);
  assert.equal(a, c, 'and stays centred');
  assert.ok(Math.abs(a + b + c - 255.12) < 1e-9);

  // The same zero-width box on a side, with nothing else generated: A and C both measure zero, so their flex factors sum to zero and are *assumed to be 1* — the band divides evenly, and C's half is a track nothing paints. Unlike a lone side box with something to say, which takes the whole band by its max-content width.
  const [la, lb, lc] = bandWidths({ a: { min: 0, max: 0, generated: true }, available: 255.12 });
  assert.equal(lb, 0);
  assert.ok(Math.abs(la - 127.56) < 1e-9, `got ${la}`);
  assert.ok(Math.abs(lc - 127.56) < 1e-9, `got ${lc}`);

  // And the flag wins over a measurement in the other direction too: a box declared ungenerated takes no room whatever it measures.
  const [, wb] = bandWidths({ a: { min: 10, max: 40, generated: true }, b: { min: 30, max: 90, generated: false }, available: 200 });
  assert.equal(wb, 0);
});
