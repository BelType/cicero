/**
 * What the engine does not do yet, read from the author's boxes at intake: vertical writing below the root is refused by name, and a multi-column box too tall for any page is laid out as one column.
 *
 * @remarks The root's own direction and writing mode are refused by `assertRenderConditions` (`src/measure.ts`). Both refusals are out of scope for the beta (SPEC II.1, item 6). The one-column fallback is an interim: the computed fact (the box needs dividing) is known and only the presentation of its columns is not, so it says so on the console (SPEC Article I, item 11). The ceiling is the first page's geometry, and a box nested in another multi-column box is measured on its own.
 *
 * @packageDocumentation
 */

import { createMeasureContext } from './measure.ts';
import { ONE_COLUMN } from './data-beltype.ts';
import { addSourceWord, measuringCopyOf, sourceHasWord } from './word-space.ts';

const named: WeakSet<Element> = new WeakSet<any>();

const describe = (el: Element) => `<${el.localName}${el.className && typeof el.className === 'string' ? ` class="${el.className}"` : ''}>`;

/**
 * Walk the blocks' boxes once: refuse a vertical writing mode, answer the multi-column boxes.
 *
 * @throws Error — bare and deliberate (`src/` may not import BelType's error types): a box below the root that computes a `writing-mode` other than `horizontal-tb`.
 */
export function readScope(win: Window & typeof globalThis, blocks: Iterable<Element>): Element[] {
  const columns: Element[] = [];
  for (const block of blocks) {
    for (const el of [block, ...block.querySelectorAll('*')]) {
      const st = win.getComputedStyle(el);
      if (st.writingMode && st.writingMode !== 'horizontal-tb') {
        throw new Error(`vertical writing is outside this engine's scope: ${describe(el)} computes writing-mode '${st.writingMode}', and every read here is horizontal (the line by vertical overlap, the cut by a y). Write it horizontal-tb, or print the document with another engine.`);
      }
      if ((st.columnCount ?? 'auto') !== 'auto' || (st.columnWidth ?? 'auto') !== 'auto') columns.push(el);
    }
  }
  return columns;
}

/**
 * Give the word `one-column` to every multi-column box that is taller than a page area at the page's width, so its copies lay out as one column and divide like any block. A box that fits a page keeps its columns.
 *
 * @param columns - {@link readScope}'s answer.
 * @param page - the geometry the boxes are measured against.
 */
export function foldTallColumns(doc: Document, columns: Element[], page: { contentW: number; contentH: number; }) {
  if (!columns.length) return;
  const ctx = createMeasureContext(doc, page.contentW);
  try {
    for (const el of columns) {
      if (sourceHasWord(el, ONE_COLUMN)) continue; // settled earlier in this call; the next call asks again
      const copy = measuringCopyOf(el);
      ctx.measure([copy]);
      if (copy.getBoundingClientRect().height <= page.contentH) continue;
      addSourceWord(el, ONE_COLUMN);
      if (!named.has(el)) {
        named.add(el);
        doc.defaultView?.console?.warn(`cicero: ${describe(el)} is a multi-column box taller than a page, and columns are not divided across pages yet — it is laid out as one column`);
      }
    }
  } finally {
    ctx.dispose();
  }
}
