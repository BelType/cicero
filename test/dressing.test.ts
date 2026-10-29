/**
 * The continuation dressing is a door (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`): `dressing.js`' `ensureContinuationDressing` gives any host that presents pieces the five rules the root wears, made once per document and adopted once, and the engine's own sheets are still told apart from the author's.
 *
 * DOM-free: the document is a double with a constructor for sheets and a list of adopted ones. What the rules do on a page is proved by `packages/essay`'s battery, through the root, which calls the same function.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureContinuationDressing, isWordsSheet } from '../src/dressing.ts';
import { CUT_OFF, RESUMED } from '../src/data-beltype.ts';
import { byShape } from './fakes.ts';

/** A constructed sheet's double: it keeps the text it is given. */
class Sheet {
  text = '';
  replaceSync(text: string) {
    this.text = text;
  }
}
/** A document double: its window's sheet constructor, and the sheets it wears. */
const documentDouble = () => (({ defaultView: { CSSStyleSheet: Sheet }, adoptedStyleSheets: [] } as unknown) as Document);
/** A sheet double as the type the engine takes. */
const authorSheet = () => ((new Sheet() as unknown) as CSSStyleSheet);
/** The rules of a sheet's text, its comments taken out. */
const rulesOf = (sheet: CSSStyleSheet) => ((sheet as unknown) as Sheet).text.replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').map((line) => line.trim());

test('the continuation dressing is the five rules, made once per document and adopted once', () => {
  const doc = documentDouble();
  const sheet = ensureContinuationDressing(doc);
  assert.deepEqual(rulesOf(sheet), [
    `${RESUMED}::before { content: none !important; }`,
    `${RESUMED}::marker { content: none !important; }`,
    `${CUT_OFF}::after { content: none !important; }`,
    `${RESUMED}::first-letter { all: unset !important; }`,
    `${RESUMED}::first-line { all: unset !important; }`
  ]);
  assert.equal(RESUMED, '[data-beltype~="split"]:not([data-beltype~="start"])', 'a resumed piece is `split` without `start`');
  assert.equal(CUT_OFF, '[data-beltype~="split"]:not([data-beltype~="end"])', 'a cut-off piece is `split` without `end`');
  assert.equal(ensureContinuationDressing(doc), sheet, 'a second call answers the same sheet');
  assert.deepEqual(doc.adoptedStyleSheets, [sheet], 'and adopts it once');
  assert.notEqual(ensureContinuationDressing(documentDouble()), sheet, 'another document gets its own');
});

test('the continuation dressing is adopted after what the document wears, and again where the document no longer wears it', () => {
  const doc = documentDouble();
  const author = authorSheet();
  doc.adoptedStyleSheets = [author];
  const sheet = ensureContinuationDressing(doc);
  assert.deepEqual(doc.adoptedStyleSheets, [author, sheet]);
  doc.adoptedStyleSheets = []; // what `document.open()` does to a kept frame: the same Document, no adopted sheets
  assert.equal(ensureContinuationDressing(doc), sheet);
  assert.deepEqual(doc.adoptedStyleSheets, [sheet], 'the document is asked, not remembered');
});

test('the continuation dressing is the engine`s, and a host reading the document`s sheets leaves it out', async () => {
  const doc = documentDouble();
  const sheet = ensureContinuationDressing(doc);
  const author = authorSheet();
  assert.equal(isWordsSheet(doc, sheet), true);
  assert.equal(isWordsSheet(doc, author), false);
  assert.equal(isWordsSheet(documentDouble(), sheet), false, 'another document`s');
  // `root.js` defines its custom elements at load; these doubles are what that needs and nothing more.
  const g = (globalThis as any);
  g.HTMLElement ??= class {};
  g.customElements ??= { get: () => undefined, define: () => {} };
  const isDressingSheet = byShape((await import('../src/root.ts')).isDressingSheet);
  assert.equal(isDressingSheet(doc, sheet), true, 'the root`s answer names it');
  assert.equal(isDressingSheet(doc, author), false);
});
