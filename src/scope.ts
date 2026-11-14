/**
 * What the engine does not do yet, read from the author's boxes at intake: vertical writing below the root is refused by name, text and an inline-level box standing directly in the body are refused by name, and a multi-column box too tall for any page is laid out as one column.
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

/** The inline-level elements that draw nothing, which {@link refuseBareContent} passes over: a line break between two blocks leaves an empty line and no content to lose. */
const DRAWS_NOTHING = new Set(['br', 'wbr']);

/**
 * Refuse what stands directly in the body and is not a block: a text node with anything but white space in it, and an element that computes an inline-level `display` or `display: contents` (ruled 2026-11-14).
 *
 * @remarks The pages are made of the body's element children, each cut as a block. A text node among them is none of them, so it stays outside the root, on screen and on no page. An inline-level one is taken, and where a page ends at it the cut falls before it and the next page begins after it. Measured 2026-11-14 on a `<span>`, an `<a>`, an `<img>`, an inline `<svg>` and an `inline-block` box: each is drawn where no page ends at it and on no page where one does, and a long `<span>` is never divided. The engine does not wrap either in a block of its own, since an element it added would be one the author's selectors can see, where CSS 2.1's anonymous block box is not. This is the default intake's refusal: a host that hands the run its own boxes is not asked.
 *
 * @param root - the element the boxes stand in, whose child text nodes are read.
 * @param blocks - the top-level blocks the intake took from it, fixed boxes and running elements already out.
 * @throws Error — bare and deliberate, as {@link readScope}'s.
 */
export function refuseBareContent(win: Window & typeof globalThis, root: Element, blocks: Iterable<Element>) {
  for (const node of root.childNodes) {
    if (node.nodeType !== 3 || !/[^ \t\n\r\f]/.test(node.nodeValue ?? '')) continue;
    const words = (node.nodeValue ?? '').trim().replace(/\s+/g, ' ');
    throw new Error(`text directly in the document's body is outside this engine's intake: "${words.length > 40 ? `${words.slice(0, 40)}…` : words}" stands outside any element, and the pages are made of the body's element children, so it would stay on screen and reach no page. Put it inside a block element, a <p> or a <div>.`);
  }
  for (const el of blocks) {
    const display = win.getComputedStyle(el).display ?? '';
    if (display === 'contents') throw new Error(`a box with display: contents directly in the document's body is outside this engine's intake: ${describe(el)} has no box of its own, and a top-level box is cut as a block, so where a page ends at it, what it holds would be drawn on no page. Give it display: block, or put what it holds directly in the body.`);
    if (!display.startsWith('inline') || DRAWS_NOTHING.has(el.localName)) continue;
    throw new Error(`an inline-level box directly in the document's body is outside this engine's intake: ${describe(el)} computes display '${display}', and a top-level box is cut as a block, so where a page ends at it, it would be drawn on no page. Put it inside a block element, a <figure> or a <div>, or give it display: block.`);
  }
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
