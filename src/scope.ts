/**
 * What the engine does not do yet, read from the author's boxes at intake: vertical writing below the root is refused by name, text, a `display: contents` box and an inline-level box holding words standing directly in the body are refused by name, and a multi-column box too tall for any page is laid out as one column.
 *
 * @remarks The root's own direction and writing mode are refused by `assertRenderConditions` (`src/measure.ts`). Both refusals are out of scope for the beta (SPEC II.1, item 6). The one-column fallback is an interim: the computed fact (the box needs dividing) is known and only the presentation of its columns is not, so it says so on the console (SPEC Article I, item 11). The ceiling is the first page's geometry, and a box nested in another multi-column box is measured on its own.
 *
 * @packageDocumentation
 */

import { createMeasureContext } from './measure.ts';
import { ONE_COLUMN } from './data-beltype.ts';
import { addSourceWord, holdsAtomsAlone, measuringCopyOf, sourceHasWord } from './word-space.ts';

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
 * Refuse what stands directly in the body and the engine cannot cut: a text node with anything but white space in it, an element that computes `display: contents`, and an inline-level element holding words (ruled 2026-11-14; narrowed 2026-11-16, *an atom in the body is a line of the body*).
 *
 * @remarks The pages are made of the body's element children. A text node among them is none of them, so it stays outside the root, on screen and on no page. An inline-level box holding words stands on lines CSS 2.1 §9.2.1.1 puts in an anonymous block box, and a page may end between them, which is the teaching round's; measured 2026-11-14, a `<span>` and an `<a>` were each drawn on no page where a page ended at them, and a long `<span>` was never divided. An inline-level box holding atoms and no word (`word-space.ts`' `holdsAtomsAlone`: an `<img>`, an inline `<svg>`, an `inline-block` box, a `<picture>`, an `<a>` around an image) is taken: the Gauge reads a run of them as the one line of its anonymous block box, moved whole (`gauge.ts`' `takeReport`). The engine does not wrap either in a block of its own, since an element it added would be one the author's selectors can see, where CSS 2.1's anonymous block box is not. This is the default intake's refusal: a host that hands the run its own boxes is not asked.
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
    if (!display.startsWith('inline') || DRAWS_NOTHING.has(el.localName) || holdsAtomsAlone(el)) continue;
    throw new Error(`an inline-level box holding words directly in the document's body is outside this engine's intake: ${describe(el)} computes display '${display}', and the lines its words stand on are not yet read where it stands, so where a page ends at it, it would be drawn on no page. Put it inside a block element, a <p> or a <div>, or give it display: block.`);
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
