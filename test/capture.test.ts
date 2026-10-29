/**
 * The page area's arithmetic, DOM-free (*a page box has a border and a padding*, 2026-09-07).
 *
 * Most of `capture.js` is a reading of a live CSSOM and is proved next door in `packages/essay`. Two pieces of it are not readings at all, and they are the two this round turns on: whether a declared border width takes any room, and how the page area falls out of the page box once it can. Both are pure, so they are pinned here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderIsDrawn, pageArea, assertPageArea, transliterateContent, sizeToPx, MIN_PAGE_AREA_PX } from '../src/capture.ts';
import { encodeElement, encodeString } from '../src/gcpm-encoding.ts';

test('a declared border width takes room only where its own style draws a border', () => {
  // The page context has no computed style to ask, so an absent declaration IS the initial value — and `border-style`'s initial value is `none`. `@page { border: 5mm }` declares five millimetres and takes nothing.
  assert.equal(borderIsDrawn(null), false, 'no style declared: the initial value is `none`');
  assert.equal(borderIsDrawn('none'), false);
  assert.equal(borderIsDrawn('hidden'), false, '`hidden` computes to a used width of zero exactly as `none` does');
  assert.equal(borderIsDrawn('solid'), true);
  assert.equal(borderIsDrawn('double'), true);
});

test('the page area is the page box less its margins, its drawn borders and its paddings', () => {
  const four = (n) => ({ top: n, right: n, bottom: n, left: n });
  const area = pageArea({ pageW: 1000, pageH: 800, margins: four(50), borders: four(10), paddings: four(20) });
  assert.equal(area.contentW, 1000 - 160);
  assert.equal(area.contentH, 800 - 160);
});

test('each side is subtracted from its own dimension — left and right from the width, top and bottom from the height', () => {
  // The hazard the pin exists for: six terms in two sums is the shape a transposition hides in, and a document with equal insets on all four sides could never show one.
  const area = pageArea({
    pageW: 1000,
    pageH: 800,
    margins: { top: 1, right: 2, bottom: 4, left: 8 },
    borders: { top: 16, right: 32, bottom: 64, left: 128 },
    paddings: { top: 256, right: 512, bottom: 1024, left: 2048 }
  });
  assert.equal(area.contentW, 1000 - (2 + 8 + 32 + 128 + 512 + 2048), 'the width takes left and right only');
  assert.equal(area.contentH, 800 - (1 + 4 + 16 + 64 + 256 + 1024), 'the height takes top and bottom only');
});

test('a page area at or below the one-pixel floor is refused by name (css-break-3 §4)', () => {
  // The scar: an 8pt page whose margins made the area negative did not throw — it presented twenty-three intervals and printed twenty-nine pages of scraps, because the walk DOES advance, one fragment at a time, indefinitely. A defect that produces confetti is harder to diagnose than one that produces an exception.
  const where = "@page '(default)'";
  assert.throws(() => assertPageArea({ contentW: -30, contentH: -40 }, where), /page area .*wide and .*tall/);
  assert.throws(() => assertPageArea({ contentW: 0, contentH: 500 }, where), /wide/);
  assert.throws(() => assertPageArea({ contentW: 500, contentH: 0 }, where), /tall/);
  assert.throws(() => assertPageArea({ contentW: MIN_PAGE_AREA_PX, contentH: 500 }, where), /wide/, 'at the floor, not merely below it');
});

test('the refusal names the condition and says what to look at', () => {
  try {
    assertPageArea({ contentW: -30, contentH: 12 }, "@page 'plate'");
    assert.fail('expected a refusal');
  } catch (e) {
    assert.match(e.message, /@page 'plate'/, 'which page rule');
    assert.match(e.message, /css-break-3 §4/, 'which sentence');
    assert.match(e.message, /margins, borders and paddings/, 'what to look at');
  }
});

test('an ordinary page area passes the floor untouched', () => {
  assert.doesNotThrow(() => assertPageArea({ contentW: 1.01, contentH: 1.01 }, 'x'), 'the floor is a floor and not a minimum size policy');
  assert.doesNotThrow(() => assertPageArea({ contentW: 713.7, contentH: 1002.5 }, 'x'));
});

test('a page with no border and no padding keeps the page area it always had', () => {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  const area = pageArea({ pageW: 793.7, pageH: 1122.5, margins: { top: 60, right: 40, bottom: 60, left: 40 }, borders: zero, paddings: zero });
  assert.equal(area.contentW, 793.7 - 80);
  assert.equal(area.contentH, 1122.5 - 120);
});

/** `transliterateContent` is the third pure piece of this file (*the page carries its conditions*, 2026-10-21): a margin box's `content` goes into the page's shadow sheet as the author wrote it, and the browser spells every counter against the host's reset. It reads a captured value and never touches a DOM. */
test('a margin box\'s content is the author\'s as written: every counter, every style, every string', () => {
  for (const raw of ['counter(page)', 'counter(page) " of " counter(pages)', 'counter(page, lower-roman)', '"Chapter " counter(chapter, upper-roman)', "counters(sec, '-', upper-alpha)", 'counter(page, words)', 'url(x.png)', '"a" attr(title)']) {
    assert.deepEqual(transliterateContent(raw), { before: raw, after: null, parts: [] }, raw);
  }
});

test('a box with no content is not generated, and every other box says it exists', () => {
  assert.equal(transliterateContent('none'), null);
  assert.equal(transliterateContent('normal'), null);
  assert.equal(transliterateContent(''), null);
  assert.equal(transliterateContent(null), null);
  assert.equal(transliterateContent('""').before, '""', 'an empty string is generated and empty');
});

test('a named string becomes a read of the property the page publishes, its keyword as the host wrote it', () => {
  assert.equal(transliterateContent(`"first: " "${encodeString('heading', 'first')}"`)?.before, '"first: " var(--beltype-string-heading-first, "")');
  assert.equal(transliterateContent(`"${encodeString('chapter-title', 'first-except')}"`)?.before, 'var(--beltype-string-chapter_2d_title-first-except, "")');
});

test('the page total is blank, and not a number, while the document is not yet cut to its end', () => {
  assert.equal(transliterateContent('"page " counter(page) " of " counter(pages)', { pagesKnown: false })?.before, '"page " counter(page) " of " ""');
  assert.equal(transliterateContent('counters( pages , "/")', { pagesKnown: false })?.before, '""', 'in the counters() form too');
  assert.equal(transliterateContent('counter(page, lower-roman)', { pagesKnown: false })?.before, 'counter(page, lower-roman)', 'and the folio is untouched');
});

test('a running element splits the value: the terms before it to ::before, after it to ::after, and the element itself a part', () => {
  assert.deepEqual(transliterateContent(`"${encodeElement('head')}"`), { before: '""', after: null, parts: [{ element: 'head', which: 'first' }] });
  assert.deepEqual(transliterateContent(`"a " "${encodeElement('head', 'last')}" " | " "${encodeElement('x', 'first-except')}" counter(page)`), { before: '"a "', after: 'counter(page)', parts: [{ element: 'head', which: 'last' }, ' | ', { element: 'x', which: 'first-except' }] });
});

test('every media name css-page-3 lists resolves to its sheet, in millimetres, without the length probe', () => {
  // css-page-3 §7.1's <page-size> list: A5 A4 A3 B5 B4 JIS-B5 JIS-B4 letter legal ledger. The probe would refuse any of them, so a probe call is a failure.
  const noProbe = () => assert.fail('a named size must be answered by the table, never by the length probe');
  const mm = 96 / 25.4;
  const sheets = {
    a5: [148, 210], a4: [210, 297], a3: [297, 420], b5: [176, 250], b4: [250, 353],
    'jis-b5': [182, 257], 'jis-b4': [257, 364], letter: [215.9, 279.4], legal: [215.9, 355.6], ledger: [279.4, 431.8]
  };
  for (const [name, [w, h]] of Object.entries(sheets)) {
    assert.deepEqual(sizeToPx([name], noProbe), [w * mm, h * mm], name);
    assert.deepEqual(sizeToPx([name.toUpperCase()], noProbe), [w * mm, h * mm], `${name}: the keyword is case-insensitive`);
  }
});

test('the orientation words turn a named size on its long side, including the two JIS names', () => {
  const noProbe = () => assert.fail('a named size must be answered by the table');
  const mm = 96 / 25.4;
  assert.deepEqual(sizeToPx(['jis-b5', 'portrait'], noProbe), [182 * mm, 257 * mm]);
  assert.deepEqual(sizeToPx(['jis-b5', 'landscape'], noProbe), [257 * mm, 182 * mm]);
  assert.deepEqual(sizeToPx(['JIS-B4', 'landscape'], noProbe), [364 * mm, 257 * mm]);
  assert.deepEqual(sizeToPx(['a5', 'landscape'], noProbe), [210 * mm, 148 * mm], 'the old names keep working');
});

test('A6 is not a named size: it reaches the length probe in both orientations, and the probe refuses it', () => {
  // css-page-3 does not list A6, and Chromium's own print refuses it (`size: A6` prints the letter default). Nothing in the table may answer for it.
  const asked = [];
  const probe = (token) => {
    asked.push(token);
    return 100;
  };
  sizeToPx(['A6', 'portrait'], probe);
  sizeToPx(['A6', 'landscape'], probe);
  assert.deepEqual(asked, ['a6', 'a6'], 'both orientations hand the name to the probe');
});
