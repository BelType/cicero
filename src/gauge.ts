/**
 * The Gauge — the measuring pass's report (architecture: MeasureReport). A ruler, never a decider.
 *
 * `takeReport` reads one settled layout and returns an immutable snapshot: obtaining it seals the mutation phase (*render-identical conditions*, I5, by type) — every query answers from the same geometry, lazily computed, cached, never re-laid-out. The report exposes only geometric primitives; classification, candidates, and legality are entirely brain-side (the Stonehand's).
 *
 * The rect-reading rules live here and nowhere else (architecture: rect-reading rules, stated once):
 *   - nested inline boxes emit duplicate rects for one run of text — reading per word collapses them to one rect per word;
 *   - characters at soft-wrap boundaries emit a zero-width leading rect on the wrong line — the reader takes the rect with the largest top;
 *   - every comparison against line positions is by integer line index, never scalar Y — word rects are clustered onto the line stack, by vertical overlap, before anything downstream sees them (`sharesLine`).
 *
 * All coordinates are container-relative: Y 0 is the measured flow's top border edge space.
 *
 * **The report also answers what a box that reads its children was laid out at** (`tracksOf`; *the fragment lays out under the feed's conditions*, 2026-10-08): a table's column widths and a grid's column list, read once per box per page, so that a fragment — which holds the box with the content outside its interval put away — can be written the widths its feed was measured under. It is a measurement and a literal, never a decision.
 *
 * @packageDocumentation
 */

import { BREAK, selectorOf } from './data-beltype.ts';
import { blockChildrenOf, footerBeforeRows, headerAfterRows, isAtom, isEngineText, isInlineBox, isLineBreak, mayBeAutoHyphenated, rangeOf, READS_ITS_CHILDREN, rowsAmong, SIDE_BY_SIDE, wordRuns } from './word-space.ts';

/** The Compositor's own `<br>`, found by the browser and never by splitting the attribute here (the walkers below run per box). */
const BREAK_SELECTOR = `br${selectorOf(BREAK)}`;

/** A length in CSS pixels, container-relative where it is a position. A transparent alias — the name is for the hover, nothing is branded. */
export type Px = number;

/** An integer index into a box's line stack, the unit every comparison against line positions is made in (the third rect-reading rule). A transparent alias. */
export type LineIndex = number;

/** A border-box rect, container-relative. */
export type Rect = {
  top: Px;
  bottom: Px;
  left: Px;
  right: Px;
  width: Px;
  height: Px;
};

/** One box of the measured flow, in the report's box list: an element's, or an anonymous block box the Gauge builds around a run of inline content standing beside block children (*the anonymous box is in the procession*, 2026-09-29). */
export type Box = {
  /** The measured clone that generated it; for an anonymous box, the block container that holds it, whose pitch the run's lines are set on and whose word space the run's words are counted in. */
  el: Element;
  /** The DOM parent's box, deliberately not the procession's — see `blockChildren`. */
  parent: Box | null;
  depth: number;
  /** For an anonymous box, the extent of its line boxes, read when first asked. */
  rect: Rect;
  inline: boolean;
  /** Every child box, inline ones included; none for an atom, which is never entered, and none for an anonymous box. */
  children: Box[];
  /** the procession this box establishes, its anonymous boxes included; empty for an inline box, whose block items join the enclosing one, and for an anonymous box. */
  blockChildren: Box[];
  /** An anonymous block box (CSS 2.1 §9.2.1.1): no element of its own, no decoration, and every break property `auto`. */
  anonymous?: boolean;
  /** A table's footer group written before its rows (`footerBeforeRows`), moved to the end of the table's procession, where §17.2 lays it out. */
  laidOutLast?: boolean;
  /** A table's header group written after its rows (`headerAfterRows`), moved to the front of the table's procession, where §17.2 lays it out. */
  laidOutFirst?: boolean;
};

/** One line box, recovered arithmetically from the rects clustered onto it and the line-heights they are set on (`computeLines`). */
export type LineBox = {
  top: Px;
  bottom: Px;
  /** The topmost of the rects clustered onto this line, before the half-leading is taken off. */
  rectTop: Px;
};

/** A word — or a piece of one — as the report exposes it: the text, the line it was homed to, which word of the box it is, and the character its line begins at inside it (*a line inside a word is a break point*, 2026-09-23). */
export type Word = {
  /** The whole word's text, on every piece of it. */
  word: string;
  line: LineIndex;
  /** Which word of the box this is, counting every word the tokenization finds. */
  index: number;
  /** Where this piece begins inside the word, in UTF-16 code units; 0 for a whole word and for a word's first piece. */
  char: number;
};

/** A word or a piece of one as it was measured: its rect's top and height, and the line the clustering assigns it afterwards. */
export type MeasuredWord = {
  word: string;
  index: number;
  char: number;
  top: Px;
  height: Px;
  /** Assigned by `computeLines`, the one reader, before anything leaves the report. */
  line?: LineIndex;
  /** The word lies inside an inline atom, and `top` and `height` are the atom's own box rather than the word's glyphs. */
  atom?: boolean;
  /** The word's text is the box's own child, set in the box's own font: its rect is the strut's content area. */
  own?: boolean;
  /** The line-height the word's inline box is set on, read off its parent element; `NaN` where that computes to a keyword. */
  lineHeight?: Px;
};

/** The end-edge gap of a box: the last content bottom and the padding-box bottom. */
export type Gap = {
  base: Px;
  bottom: Px;
};

/** What a box that reads its children measured its tracks to be on this page (*the fragment lays out under the feed's conditions*, 2026-10-08): a table's column widths and its own width, in px, or a grid's resolved column list as the browser computes it. The wire form: it crosses in the account and is written into a fragment as literals. */
export type Tracks = { kind: 'table', columns: Px[], width: Px } | { kind: 'grid', columns: string };

/** The sealed report {@link takeReport} hands back. */
export type MeasureReport = ReturnType<typeof takeReport>;

/**
 * Whether two vertical extents stand on one line: they overlap by more than half the shorter of the two (*the line is read by overlap*, 2026-09-29).
 *
 * @remarks
 * Every rect on one line box overlaps every other on the block axis, whatever face or size it is set in, because they share the line's baseline; a rect on the next line does not overlap it at all unless the lines are set on less than about half their own content area. The rule is the fragmentainers implementation's `sharesLine` (`measurement/line-box.js`). It replaced a tolerance on rect tops, 1.5px below the line's first top, which an inline span set smaller than its text crossed on one line: its top stood 3px below the text's (`packages/essay/cases/73-the-smaller-span-in-the-line`), so it opened a line of its own and the page was cut through one rendered line.
 */
const sharesLine = (aTop: Px, aBottom: Px, bTop: Px, bBottom: Px) => Math.min(aBottom, bBottom) - Math.max(aTop, bTop) > Math.min(aBottom - aTop, bBottom - bTop) / 2;
/** A character a word is made of: anything `BREAKING_SPACE` does not divide at. */
const WORD_CHAR = /[\S  ﻿]/;
/** A `display` whose inline content CSS 2.1 §9.2.1.1 wraps in anonymous block boxes — a block container's. A flex or grid container makes a run an anonymous item and a table an anonymous cell, which are other boxes and other questions. */
export const holdsAnonymousBlocks = ( display: string) => !/flex|grid|-webkit-box/.test(display) && (!/table/.test(display) || /^table-(cell|caption)$/.test(display));
const GAP_MIN = 0.75; // px — a third rect-reading rule, learned from the differential: half-leading float arithmetic leaves sub-pixel residue between a text box's last line and its border, and reporting that residue as a gap fabricates Class C cuts that bypass keeps. Real gaps (padding, margins, constrained heights) are ≥ 1px; noise stays under half a pixel.

/**
 * Read one settled layout into an immutable snapshot — obtaining it seals the mutation phase (*render-identical conditions*, I5, by type).
 *
 * @param container - the measured flow (measure.js's container), already laid out.
 * @param opts - the page's content height, for the raw overflow reading.
 */
export function takeReport(container: Element, { contentHeight }: { contentHeight: Px; }) {
  const doc = container.ownerDocument;
  const win = (doc.defaultView as Window);
  const origin = container.getBoundingClientRect();

  const rel = ( r: DOMRect) => ({ top: r.top - origin.top, bottom: r.bottom - origin.top, left: r.left - origin.left, right: r.right - origin.left, width: r.width, height: r.height });

  // The box list: every element box in the measured flow, document order, with its border-box rect and tree shape.
  const boxes: Box[] = [];
  const byEl: Map<Element,Box> = new Map<any, any>();
  ( function walk(el: Element, parent: Box|null, depth: number) {
    for (const child of el.children) {
      // A ruler reads rendered boxes (*every branch gets a place*, 2026-09-21). A box outside a fragment's interval is kept in the clone and not displayed, and the grab cuts a forced break into the feed by the same surgery — so the feed holds elements that generate no box at all. Listed, one read as a zero-height box whose children all stood at the origin, `endGapOf` took an end gap thousands of pixels deep off it, and a Class C cut at the page edge outranked every real candidate on every page: Caster's specimen printed its first page's whole remainder under the clip and a heading on no page. No box, no entry — and nothing under it either.
      if (win.getComputedStyle(child).display === 'none') continue;
      const rect = rel(child.getBoundingClientRect());
      const inline = isInlineBox(child);
      const box: Box = { el: child, parent, depth, rect, inline, children: [], blockChildren: [] };
      boxes.push(box);
      byEl.set(child, box);
      if (parent) parent.children.push(box);
      // An atom is never entered (*the procession stops at an atom*, 2026-09-27): it is one box, and what it holds — an SVG's `<text>`, an inline-block's paragraphs — generates no box of the measured flow. Nothing could address one: the procession stops at the atom, and a block-level atom is a monolith.
      if (!isAtom(child)) walk(child, box, depth + 1);
    }
  })(container, null, 0);

  /**
   * The procession, from the one walker (`word-space.js`'s `blockChildrenOf`; CSS 2.1 §9.2.1.1). A block box belongs to the procession of its nearest non-inline ancestor, so a block item inside an inline container joins the enclosing one and the container keeps an empty list. That is what makes the attribution a partition — every block box is in exactly one procession — and it is why this is a second pass rather than a push inside the walk: the same list would otherwise be built twice, once on the inline box and once on the box above it, and the Stonehand would price a boundary against whichever it happened to ask.
   *
   * `parent` stays the DOM parent and is deliberately untouched: it is what `driver.js`'s `itemOf` walks to reach a feed item, and what the Stonehand's `insideMonolith`, `insideParallel` and `crossingAvoid` walk to read the constraints an ancestor really imposes. The procession is a different question and gets a different answer.
   */
  // `blockChildrenOf` walks the element tree, which still holds what is not displayed; the procession is of boxes, so an element with none drops out here.
  for (const box of boxes) if (!box.inline) box.blockChildren = (blockChildrenOf(box.el).map(( el: Element) => byEl.get(el)).filter(Boolean) as Box[]);
  const flowProcession = (blockChildrenOf(container).map(( el: Element) => byEl.get(el)).filter(Boolean) as Box[]);

  /** The footer stands last (*the footer before the rows*, 2026-10-15). CSS 2.1 §17.2 lays a `table-footer-group` out *"after all other rows and row groups"*, wherever it is written, and HTML lets it be written before them. The procession and the box list are the order the Stonehand walks and stops at the edge in, and that order is the layout's: such a footer is moved behind the table's last row or row group in both, and marked `laidOutLast`. Walked in the document's order it stood first and far below the edge, so the walk stopped at it and the page held the header alone (measured, `packages/essay/cases/110-the-footer-before-the-rows`: a 40-row table on two pages holding the header and the last two rows). The address stays the document's: the footer's words come before the rows in the word space, which is why the Stonehand offers no place before the footer or inside it. */
  let moved = false;
  for (const box of boxes) {
    if (box.inline || box.blockChildren.length < 2 || !/^(inline-)?table$/.test(win.getComputedStyle(box.el).display)) continue;
    for (const list of [box.blockChildren, box.children]) {
      const f = list.findIndex((c) => footerBeforeRows(c.el));
      if (f < 0) continue;
      let last = -1;
      list.forEach((c, i) => {
        if (/^table-row(-group)?$/.test(win.getComputedStyle(c.el).display)) last = i;
      });
      if (last < f) continue;
      const [footer] = list.splice(f, 1);
      list.splice(last, 0, footer); // `last` moved down by one with the removal, so this is the place after it
      footer.laidOutLast = moved = true;
    }
    // The header stands first, the mirror (*thead-after-rows-and-tall-footer-lose-rows*, 2026-11-07): §17.2 lays a `table-header-group` out *"before all other rows and row groups"*, so one written after them is moved before the first. Its words stay after the rows in the word space, which is why the Stonehand offers no place inside it or right after it, and why the driver refuses one that does not repeat: only a copy can show it on a page before its words.
    for (const list of [box.blockChildren, box.children]) {
      const h = list.findIndex((c) => headerAfterRows(c.el));
      if (h < 0) continue;
      const first = list.findIndex((c) => /^table-row(-group)?$/.test(win.getComputedStyle(c.el).display));
      if (first < 0 || first > h) continue;
      const [header] = list.splice(h, 1);
      list.splice(first, 0, header);
      header.laidOutFirst = moved = true;
    }
  }

  /**
   * The anonymous boxes (*the anonymous box is in the procession*, 2026-09-29; CSS 2.1 §9.2.1.1). A block container holding a block-level box beside inline content wraps each maximal run of that content in an anonymous block box, and css-break-3 §4.1 divides the result like any procession: a Class A point between the run and the block beside it, Class B points between its lines, and no Class C point where it stands, since a line is child content. The procession used to be the element tree's block children alone, so a run had no box: its lines were read as nothing but the distance they opened, a start gap before the first block child and an end gap after the last, and a page edge crossing thirteen trailing lines shelled them blank (`packages/essay/cases/76-the-line-before-the-first-block`).
   *
   * **Gathered here and not in `word-space.js`' `blockChildrenOf`**, which stays the element walker: the forcing index, the page's name and the address all walk elements, and a run has no element, so it has no path of its own — a cut that names it names the box that holds it (`driver.js`' `cutTo`). The Gauge is the one reader that needs the run as a box, because it is the one that reads its lines.
   *
   * A run is the text and the inline-level boxes, atoms included, standing before, between or after the block children in the walk `blockChildrenOf` makes — through an inline box, stopping at an atom. A run holding no word is no box: whitespace alone is none, and so is an inline image alone, which is the limit a paragraph holding one image alone already has (it has no line stack either). Its slot is the number of block children standing before it, which is where it enters the procession, and its `rect` is its lines' extent, read when first asked, because the walk that stops at the page's edge asks it of few.
   */
  const slotOfText: Map<Text,number> = new Map<any, any>();
  const runSlot: Map<Box,number> = new Map<any, any>();
  const anonymousBefore: Map<Box,Box> = new Map<any, any>();
  const anonymousAfter: Map<Box,Box> = new Map<any, any>();
  /** An anonymous box's rect: from its first line box's top to its last one's bottom, across its container. A run none of whose words rendered has no line, and stands where the block child after it begins, or at its container's end. */
  const runRect = (anon: Box): Rect => {
    const holder = (anon.parent as Box);
    const { lines } = computeLines(anon);
    const next = holder.blockChildren[holder.blockChildren.indexOf(anon) + 1];
    const top = lines.length ? lines[0].top : next ? next.rect.top : holder.rect.bottom;
    const bottom = lines.length ? lines[lines.length - 1].bottom : top;
    return { top, bottom, left: holder.rect.left, right: holder.rect.right, width: holder.rect.width, height: bottom - top };
  };
  for (const box of boxes) {
    if (box.inline || !box.blockChildren.length || isAtom(box.el) || !holdsAnonymousBlocks(win.getComputedStyle(box.el).display)) continue;
    const kids = new Set(box.blockChildren.map((c) => c.el));
    const worded: Set<number> = new Set<any>();
    let slot = 0;
    const text = ( node: Text) => {
      slotOfText.set(node, slot);
      if (WORD_CHAR.test(node.data)) worded.add(slot);
    };
    /** Every text node inside an inline atom belongs to the run the atom stands in: the atom is one unit of that run's line, whatever it holds. */
    const inAtom = ( node: Node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) text((child as Text));
        else if (child.nodeType === 1) inAtom(child);
      }
    };
    const walkRun = ( el: Element) => {
      for (const node of el.childNodes) {
        if (node.nodeType === 3) {
          text((node as Text));
          continue;
        }
        if (node.nodeType !== 1) continue;
        const child = (node as Element);
        if (kids.has(child)) slot++;
        else if (win.getComputedStyle(child).display === 'none') continue;
        else if (isAtom(child)) inAtom(child);
        else if (isInlineBox(child)) walkRun(child);
      }
    };
    walkRun(box.el);
    if (!worded.size) continue;
    const procession: Box[] = [];
    for (let k = 0; k <= box.blockChildren.length; k++) {
      if (worded.has(k)) {
        const anon: Box = { el: box.el, parent: box, depth: box.depth + 1, rect: ((null as unknown) as Rect), inline: false, children: [], blockChildren: [], anonymous: true };
        runSlot.set(anon, k);
        let rect: Rect|null = null;
        Object.defineProperty(anon, 'rect', { enumerable: true, get: () => (rect ??= runRect(anon)) });
        procession.push(anon);
        if (k < box.blockChildren.length) anonymousBefore.set(box.blockChildren[k], anon);
        else anonymousAfter.set(box, anon);
      }
      if (k < box.blockChildren.length) procession.push(box.blockChildren[k]);
    }
    box.blockChildren = procession;
  }
  if (runSlot.size || moved) {
    // Into the box list at their places in document order, the order the Stonehand walks and stops at the edge in: before the block child each precedes, and a trailing one after its container's whole subtree. A footer laid out last is visited where its table's children now put it.
    const ordered: Box[] = [];
    const visit = ( box: Box) => {
      ordered.push(box);
      for (const child of box.children) {
        const before = anonymousBefore.get(child);
        if (before) ordered.push(before);
        visit(child);
      }
      const after = anonymousAfter.get(box);
      if (after) ordered.push(after);
    };
    for (const box of boxes.filter((b) => !b.parent)) visit(box);
    boxes.splice(0, boxes.length, ...ordered);
  }

  /** The rows (`word-space.js`'s `rowsAmong`; *every branch gets a place*). Where a box lays its children out side by side, those of its block children that overlap on the block axis are a row, and each of them is a parallel flow of its own. An absolutely positioned child is in no row: it is out of the flow the row is made of. `rowOf` is the answer the Stonehand and the driver read — a box's row-mates, itself included, or `null`. */
  const rowOfBox: Map<Box,Box[]> = new Map<any, any>();
  for (const box of boxes) {
    if (box.blockChildren.length < 2 || !SIDE_BY_SIDE.has(win.getComputedStyle(box.el).display)) continue;
    const inFlow = box.blockChildren.filter((c) => !['absolute', 'fixed'].includes(win.getComputedStyle(c.el).position));
    for (const row of rowsAmong(inFlow)) for (const item of row) rowOfBox.set(item, row);
  }

  const topLevel = boxes.filter((b) => !b.parent);
  const contentTop = topLevel.length ? topLevel[0].rect.top : 0;
  let flowBottom = contentTop;
  for (const b of topLevel) if (b.rect.bottom > flowBottom) flowBottom = b.rect.bottom;

  const lineCache: Map<Box,{ lines: LineBox[]; words: MeasuredWord[]; }> = new Map<any, any>();
  const wordCache: Map<Box,MeasuredWord[]> = new Map<any, any>();
  const lineHeightCache: Map<Element,Px> = new Map<any, any>();
  const tracksCache: Map<Box,Tracks|null> = new Map<any, any>();
  /** An element's computed line-height in px, read once; `NaN` where it computes to a keyword, which the CSSOM hands back as the string `normal`. */
  const lineHeightOf = ( el: Element) => {
    let lh = lineHeightCache.get(el);
    if (lh === undefined) lineHeightCache.set(el, (lh = parseFloat(win.getComputedStyle(el).lineHeight)));
    return lh;
  };

  /** Ordered text nodes under a box, with cumulative offsets — so a word range spans nested inlines correctly. */
  function textNodesOf(box: Box) {
    const nodes: { node: Text; start: number; }[] = [];
    // Where a word may not continue: the joined-text offsets at which a non-inline boundary falls, both of its edges (word-space.js). Collected in the walk that numbers the text, so the two can never disagree about a position.
    const breaks: number[] = [];
    // The outermost atom each text node lies inside, where it lies inside one: its words are read at the atom's box (`measureWords`).
    const atomOf: Map<Text,Element> = new Map<any, any>();
    // The offsets, in the source's characters, at which the Compositor's own `<br>` stands.
    const hintBreaks: number[] = [];
    let offset = 0;
    const walk = ( el: Node,  atom: Element|null) => {
      for (const child of el.childNodes) {
        // Text the engine wrote is not a character of the source (*the hyphen is written at the cut*, 2026-10-06): it has no offset, so a character offset into a word means the same text here and in the source.
        if (child.nodeType === 3 && isEngineText((child as Text))) continue;
        if (child.nodeType === 3) {
          nodes.push({ node: (child as Text), start: offset });
          if (atom) atomOf.set((child as Text), atom);
          offset += (child as Text).data.length;
        } else if (child.nodeType === 1) {
          if ((child as Element).tagName === 'BR' && (child as Element).matches(BREAK_SELECTOR)) hintBreaks.push(offset);
          const joins = isInlineBox((child as Element)) && !isLineBreak((child as Element));
          if (!joins) breaks.push(offset);
          walk(child, atom ?? (isAtom((child as Element)) ? (child as Element) : null));
          if (!joins) breaks.push(offset);
        }
      }
    };
    walk(box.el, null);
    return { nodes, total: offset, breaks, atomOf, hintBreaks };
  }

  // A fourth reading rule, range-endpoint side: at a text-node seam, a range start binds to the following node and a range end to the preceding one. An end bound forward would swallow whatever sits between the nodes — an atomic inline (the Compositor's filler span) contributes its own rect, and the largest-top rule would then home the word a line too low.
  function pointFor(nodes: { node: Text; start: number; }[], absOffset: number, atEnd = false): [Text,number] {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (atEnd ? absOffset > nodes[i].start : absOffset >= nodes[i].start) return [nodes[i].node, absOffset - nodes[i].start];
    }
    return [nodes[0]?.node, 0];
  }

  /**
   * One rect per word, largest top (the soft-wrap rule); duplicates from nested inlines collapse by construction — and one piece per line for a word the browser set on several lines at silent breaks or at a soft hyphen (*a line inside a word is a break point*, 2026-09-23; *the hyphen is written at the cut*, 2026-10-06).
   *
   * @remarks
   * A word is a run of non-whitespace and a line box is not: CJK text, `word-break: break-all` and `overflow-wrap`'s emergency break set one word on many lines, and a word homed on its last line left every line above it out of the stack — no Class B point between them, and a page edge that divided a line through its glyphs (`packages/essay/cases/63-the-line-inside-a-word`). So where a word's inked rects (width over half a pixel: the soft-wrap rule's zero-width leading rect is not ink) cluster onto more than one line, the character each later line begins at is found by a binary search over single-character ranges, and each silent break opens a piece. A break after a soft hyphen opens a piece at the character after it, and the fragment writes the hyphen the browser drew there (*the hyphen is written at the cut*, 2026-10-06); a break between two letters under `hyphens: auto` (`word-space.js`' `mayBeAutoHyphenated`) opens a piece where the browser drew a hyphen there, read in the range rects (`drewHyphen`), and the fragment writes it; one that drew none opens none, and that line joins the next, exactly as the largest-top rule always homed it. **A box carrying the Compositor's own breaks is split at them and nowhere else**: its lines are set by hints, so a word's later lines begin at the source characters its `<br>`s stand before, counted without the hyphen the Compositor wrote.
   */
  function measureWords(box: Box): MeasuredWord[] {
    if (wordCache.has(box)) return (wordCache.get(box) as MeasuredWord[]);
    const { nodes, total, breaks, atomOf, hintBreaks } = textNodesOf(box);
    const text = nodes.map((e) => e.node.data).join('');
    const words: MeasuredWord[] = [];
    const range = rangeOf(doc);
    const hyphens = win.getComputedStyle(box.el).hyphens;
    const hinted = !!box.el.querySelector(BREAK_SELECTOR);
    const slot = box.anonymous ? runSlot.get(box) : null;
    let index = 0;
    /** The inked rect of characters `[i, i + 1)` of the joined text with the largest top — `null` for a character with no ink. */
    const inkOf = ( i: number) => {
      range.setStart(...pointFor(nodes, i));
      range.setEnd(...pointFor(nodes, i + 1, true));
      let ink: DOMRect|null = null;
      for (const r of range.getClientRects()) if (r.width > 0.5 && (!ink || r.top > ink.top)) ink = r;
      return ink;
    };
    /** Did the browser draw a hyphen at the line break before character `i`? Chromium leaves the glyph it drew in that character's range: an inked rect on the line the break ends, beside the character's own on the next (measured 2026-11-07 on Chromium 153, as *the hyphen is written at the cut* measured 2026-10-06; an `overflow-wrap` emergency break leaves none). */
    const drewHyphen = ( i: number, line: { top: Px; bottom: Px; }) => {
      range.setStart(...pointFor(nodes, i));
      range.setEnd(...pointFor(nodes, i + 1, true));
      return [...range.getClientRects()].some((r) => r.width > 0.5 && sharesLine(r.top, r.bottom, line.top, line.bottom));
    };
    /** The pieces of the word at `[at, at + w.length)` whose inked rects are `rects`, or null for a word on one line. */
    const piecesOf = (at: number, w: string, rects: DOMRect[]) => {
      // The word's own lines, by the one rule `computeLines` reads a line by: sorted by top, a rect joins the line above it where it shares it.
      const tops: { top: Px; bottom: Px; }[] = [];
      for (const r of rects.filter((x) => x.width > 0.5).sort((a, b) => a.top - b.top)) {
        const last = tops[tops.length - 1];
        if (last && sharesLine(r.top, r.bottom, last.top, last.bottom)) last.bottom = Math.max(last.bottom, r.bottom);
        else tops.push({ top: r.top, bottom: r.bottom });
      }
      if (tops.length < 2) return null;
      // The Compositor's own break inside a word is a place the engine wrote and can name: each line of the word after the first begins at the source character the `<br>` stands before — the character its record gave (*the hyphen is written at the cut*, 2026-10-06). A word whose lines do not pair with its breaks is left whole.
      if (hinted) {
        const inside = hintBreaks.filter((o) => o > at && o < at + w.length).map((o) => o - at);
        if (inside.length !== tops.length - 1) return null;
        return [{ char: 0, top: tops[0].top, height: tops[0].bottom - tops[0].top }, ...inside.map((char, j) => ({ char, top: tops[j + 1].top, height: tops[j + 1].bottom - tops[j + 1].top }))];
      }
      const pieces = [{ char: 0, top: tops[0].top, height: tops[0].bottom - tops[0].top }];
      let from = 1;
      for (let j = 1; j < tops.length; j++) {
        // The first character inked on line j or below — the first whose ink no longer shares line j − 1: the search starts on line j − 1 and lines only grow along a word, so the predicate is monotone.
        let lo = from;
        let hi = w.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          const ink = inkOf(at + mid);
          if (ink && !sharesLine(ink.top, ink.bottom, tops[j - 1].top, tops[j - 1].bottom)) hi = mid;
          else lo = mid + 1;
        }
        if (lo >= w.length) break;
        const last = pieces[pieces.length - 1];
        const line = { top: tops[j].top, height: tops[j].bottom - tops[j].top };
        if (mayBeAutoHyphenated(w[lo - 1], w[lo], hyphens) && !drewHyphen(at + lo, tops[j - 1])) Object.assign(last, line);
        else pieces.push({ char: lo, ...line });
        from = lo + 1;
      }
      return pieces.length > 1 ? pieces : null;
    };
    // One pass per segment between block boundaries rather than one over the whole joined string. A word may not span such a boundary, and the Stonehand counts into this order when it prices a Class B cut (`rel` in driver.js), so a fusion here is a resume position the position index does not share — which is the whole defect *a word stops at a block boundary* closes.
    const bounds = [...new Set([0, ...breaks, total])].sort((a, b) => a - b);
    for (let s = 0; s < bounds.length - 1; s++) {
      const segment = text.slice(bounds[s], bounds[s + 1]);
      const re = wordRuns();
      let m: RegExpExecArray|null;
      while ((m = re.exec(segment))) {
        const at = bounds[s] + m.index;
        const [sn, so] = pointFor(nodes, at);
        // An anonymous box's words are its run's alone, counted in its container's word space: every word is still numbered, and only the run's are read.
        if (slot != null && slotOfText.get(sn) !== slot) {
          index++;
          continue;
        }
        /** A word inside an atom is read at the atom (*the procession stops at an atom*, 2026-09-27). css-break-3 §4.1: *"line boxes contain no possible break points"*, and an inline atom is part of one of them whatever it holds, so the words it holds are homed to the line that holds it. Read at their own glyphs, an inline drawing whose `<text>` stands on two rows was two lines, and a page cut between them divided the drawing where Chromium moves its line whole; an inline-block's paragraphs were a line stack of their own inside the holder's, and a cut between them lost a word (`packages/essay/probes/conservation.js`, *inline-blocks on one line*, which the procession's stop at the atom exposed). The tokenization is untouched — every word is still counted, in order — only where each one stands is read at the unit. */
        const atom = atomOf.get(sn);
        if (atom) {
          const r = atom.getBoundingClientRect();
          words.push({ word: m[0], index, char: 0, top: r.top - origin.top, height: r.height, atom: true });
          index++;
          continue;
        }
        const [en, eo] = pointFor(nodes, at + m[0].length, true);
        range.setStart(sn, so);
        range.setEnd(en, eo);
        const rects = [...range.getClientRects()];
        let best: DOMRect|null = null;
        for (const r of rects) {
          if (!best || r.top > best.top || (r.top === best.top && r.width > best.width)) best = r;
        }
        const pieces = best ? piecesOf(at, m[0], rects) : null;
        // What `computeLines` builds the word's inline box from: whether its text is the box's own, and the line-height of the element it is set in.
        const parent = (sn.parentElement as Element);
        const set = { own: parent === box.el, lineHeight: lineHeightOf(parent) };
        if (pieces) for (const p of pieces) words.push({ word: m[0], index, char: p.char, top: p.top - origin.top, height: p.height, ...set });
        else if (best) words.push({ word: m[0], index, char: 0, top: best.top - origin.top, height: best.height, ...set });
        index++;
      }
    }
    wordCache.set(box, words);
    return words;
  }

  /** A line as the homing builds it: every rect on it (`lo`, `hi`), the atoms among them (`atomLo`, `atomHi`), and the text words, whose inline boxes make its line box. */
  type Cluster = { texts: MeasuredWord[], lo: Px, hi: Px, atomLo: Px, atomHi: Px };

  /**
   * The line box of a cluster, CSS 2.1 §10.8.1's: the union of the inline boxes on the line, each a text rect — the content area of the face it is set in — centred on its own line-height, and extended to hold every atom on the line.
   *
   * @remarks
   * A word's own line-height is the box's `pitch` where its text is the box's own (`own`), and its parent element's otherwise; where that is a keyword the inline box is taken as the rect itself, with no leading. On a line of one face and one line-height the union is the one rect centred on the line-height, which is what this function computed from the line's first word before *the line is read by overlap* (2026-09-29) — so an ordinary line's box is unmoved, byte for byte. A line holding a smaller span set on `line-height: 1` keeps the text's box, 20px, and the same span on an inherited 20px reaches a pixel below the strut and makes the line 21px, as Chromium does (`packages/essay/cases/73-the-smaller-span-in-the-line`'s README). What it cannot see is the strut on a line holding no text of the box's own: a line set wholly in a smaller span reads the span's inline box alone. The atom clause is *the procession stops at an atom*'s, unchanged: an atom's box lies inside its line box, so the line box is extended to hold it.
   */
  function lineBoxOf(c: Cluster, pitch: Px): { top: Px; bottom: Px; } {
    let top = c.atomLo;
    let bottom = c.atomHi;
    for (const w of c.texts) {
      const lh = w.own ? pitch : (w.lineHeight as Px) > 0 ? (w.lineHeight as Px) : w.height;
      const t = w.top - (lh - w.height) / 2;
      if (t < top) top = t;
      if (t + lh > bottom) bottom = t + lh;
    }
    return { top, bottom };
  }

  /**
   * Home the words onto lines, in order: a text word joins the line above it where its rect shares that line's extent (`sharesLine`), an atom where its box overlaps that line's box at all, and each opens a line otherwise.
   *
   * @param pitch - Read only by the atom test, through `lineBoxOf`.
   */
  function home(words: MeasuredWord[], pitch: Px): Cluster[] {
    const lines: Cluster[] = [];
    for (const w of words) {
      let last = lines[lines.length - 1];
      const bottom = w.top + w.height;
      let joins = false;
      if (last && w.atom) {
        // An atom joins the line its box overlaps, and opens one where it overlaps none.
        const ext = lineBoxOf(last, pitch);
        joins = w.top < ext.bottom - 0.25 && bottom > ext.top + 0.25;
      } else if (last) joins = sharesLine(w.top, bottom, last.lo, last.hi);
      if (!joins) lines.push((last = { texts: [], lo: w.top, hi: bottom, atomLo: Infinity, atomHi: -Infinity }));
      last.lo = Math.min(last.lo, w.top);
      last.hi = Math.max(last.hi, bottom);
      if (w.atom) {
        last.atomLo = Math.min(last.atomLo, w.top);
        last.atomHi = Math.max(last.atomHi, bottom);
      } else last.texts.push(w);
      w.line = lines.length - 1;
    }
    return lines;
  }

  /**
   * The pitch a box's own lines are set on: its computed line-height where that is a length, and where it is the keyword `normal`, the pitch measured off its layout (*the line is read by overlap*, 2026-09-29).
   *
   * @remarks
   * The CSSOM answers `normal` as the string, never as the length Chromium set the lines on, so the length is read where it is visible: the distance between consecutive lines' strut rects — each line's tallest rect of the box's own text, or its tallest text rect where it holds none of the box's own — and the smallest such distance, since a line holding something taller than the font only widens its own gap. It is not floored: the fragmentainers implementation floors a measured `normal` to a whole pixel at a device pixel ratio of 1 because it computes with it, and this reads what the browser already laid out, rounding included. A box of one text line has no distance to read, and takes its content box's height, which is its one line box's (CSS 2.1 §10.6.3), wherever that lies between the line's rect and twice it; a content box outside that — a height, a min-height, a stretch — is not the line's, and the rect itself is taken. Nothing is written on the source: the tablet's intake normalisation (*The Line*) stays ruled and unbuilt, and the root's own line-height is still refused where it is not a length (`measure.js`).
   */
  function pitchOf(box: Box, words: MeasuredWord[]): Px {
    const declared = lineHeightOf(box.el);
    if (declared > 0) return declared;
    const struts = home(words.filter((w) => !w.atom), NaN).map((c) => c.texts.reduce((a, w) => ((w.own && !a.own) || (w.own === a.own && w.height > a.height) ? w : a)));
    let pitch = Infinity;
    for (let k = 1; k < struts.length; k++) {
      const gap = struts[k].top - struts[k - 1].top;
      if (gap > 0 && gap < pitch) pitch = gap;
    }
    if (pitch < Infinity) return pitch;
    if (!struts.length) return 0;
    // An anonymous box's content box is not its own to read: its container's holds the block children too, and its own rect is these lines.
    if (box.anonymous) return struts[0].height;
    const cs = win.getComputedStyle(box.el);
    const content = box.rect.height - ['border-top-width', 'border-bottom-width', 'padding-top', 'padding-bottom'].reduce((sum, p) => sum + parseFloat(cs.getPropertyValue(p)), 0);
    const ink = struts[0].height;
    return content >= ink && content <= 2 * ink ? content : ink;
  }

  /** The line stack of a text-bearing box: its words homed onto lines by overlap (`home`), each line's box the union of the inline boxes on it (`lineBoxOf`), on the box's own pitch (`pitchOf`). */
  function computeLines(box: Box): { lines: LineBox[]; words: MeasuredWord[]; } {
    if (lineCache.has(box)) return (lineCache.get(box) as { lines: LineBox[], words: MeasuredWord[] });
    const words = measureWords(box);
    const pitch = pitchOf(box, words);
    const lines = home(words, pitch).map((c) => ({ ...lineBoxOf(c, pitch), rectTop: c.lo }));
    const result = { lines, words };
    lineCache.set(box, result);
    return result;
  }

  /**
   * The tracks of a box that reads its children (*the fragment lays out under the feed's conditions*, 2026-10-08), read once per box per report.
   *
   * A table's column widths are the border boxes of the cells of one row: the first displayed row that has every column once — no cell spanning columns, and as many cells as the widest row has columns (a `rowspan` from above leaves a row short and disqualifies it). A table with no such row answers `null` and its fragment is laid out as it always was; a refusal here is data, not a guess. A grid's are its resolved `grid-template-columns`, which the browser answers with the used list of px sizes (line names kept, implicit tracks included); `none`, `subgrid` and `masonry` answer `null`. Every other box answers `null`, and so does a flex container, by ruling (nothing is lost by its drift).
   */
  function tracksOf(box: Box): Tracks|null {
    if (tracksCache.has(box)) return (tracksCache.get(box) as Tracks | null);
    let tracks: Tracks|null = null;
    const display = win.getComputedStyle(box.el).display;
    if (!box.anonymous && READS_ITS_CHILDREN.test(display)) {
      if (/^(inline-)?table$/.test(display)) tracks = tableTracks(box);
      else if (/^(inline-)?grid$/.test(display)) {
        const columns = win.getComputedStyle(box.el).gridTemplateColumns;
        if (columns && !/^none$|subgrid|masonry/.test(columns)) tracks = { kind: 'grid', columns };
      }
    }
    tracksCache.set(box, tracks);
    return tracks;
  }

  function tableTracks(table: Box): Tracks|null {
    const rows: { cells: Box[]; spans: number[]; }[] = [];
    const collect = ( parent: Box) => {
      for (const child of parent.children) {
        const d = win.getComputedStyle(child.el).display;
        if (d === 'table-row') {
          const cells = child.children.filter((c) => win.getComputedStyle(c.el).display === 'table-cell');
          rows.push({ cells, spans: cells.map((c) => Math.max(1, (c.el as HTMLTableCellElement).colSpan || 1)) });
        } else if (/^table-(row|header|footer)-group$/.test(d)) collect(child);
      }
    };
    collect(table);
    const columns = Math.max(0, ...rows.map((r) => r.spans.reduce((a, b) => a + b, 0)));
    const row = rows.find((r) => r.cells.length === columns && r.spans.every((n) => n === 1));
    return row ? { kind: 'table', columns: row.cells.map((c) => c.rect.width), width: table.rect.width } : null;
  }

  const report = {
    /** The raw cut: where the page's content height falls in this flow, or null if the whole feed fit. */
    overflowY: flowBottom - contentTop > contentHeight ? contentTop + contentHeight : null,
    /** Top border edge of the first box — the page starts here; any leading margin above it is already truncated by reading border edges (§5.2's page-start half). */
    contentTop,
    /** Bottom border edge of the last top-level box (trailing margins truncate at a cut and never count). */
    flowBottom,

    /** All boxes, document order — the driver and Stonehand walk structure through this. */
    boxes: () => boxes,
    boxOf: ( el: Element) => byEl.get(el) ?? null,

    /** The tracks of a table or a grid as this page's layout made them — see `tracksOf` above. `null` for every other box. */
    tracksOf,

    /** The block procession a box belongs to — its nearest non-inline ancestor's block children, or, with no box, the measured flow's own. The Stonehand's Class A boundaries range over it and the driver reads the in-flow bottom off it; both used to filter the box list themselves, which is how an inline container's block items came to be in no procession at all. */
    processionOf(box: Box|null = null): Box[] {
      let p = box ? box.parent : null;
      while (p && p.inline) p = p.parent;
      return p ? p.blockChildren : flowProcession;
    },

    /** The row a box stands in — its side-by-side siblings, itself included, in document order — or `null` for a box in a sequence. */
    rowOf: ( box: Box) => rowOfBox.get(box) ?? null,

    rectsOf(box: Box) {
      return [box.rect];
    },

    /** Real line boxes via Range rects, rect wrinkles normalized. Empty for boxes with block-level children — a composite box has no direct line stack, and the lines standing beside its block children are its anonymous boxes' (*the anonymous box is in the procession*); inline children (spans) are part of the line flow and measured through it. */
    linesOf(box: Box): LineBox[] {
      if (box.blockChildren.length) return [];
      return computeLines(box).lines;
    },

    /**
     * The lowest place a box's line stack can stand at, read without measuring a word (*the break search is cheaper*, 2026-10-12): its border-box bottom, which every line of a box that holds its content stands above, and infinity where the box does not (its content overflows it — a height or a max-height shorter than its lines, a flex item shrunk under them — which the element's own scroll extent says in a property read). The Stonehand asks it of a box to know whether the lines it has not measured could reach a height; an answer higher than the truth would skip lines that mattered, so a doubt is infinity.
     *
     * @remarks
     * An inline box and an anonymous box are answered by their rect: an inline box's is the union of its fragments, and an anonymous box's is its lines' own extent (`runRect`). The two scroll extents are integers, so an overflow under a pixel may read as none; the lines such a box could put below its bottom are the last one's, and a between-lines reading stands above the last line, a line's height higher at least. Measured 2026-10-12 over a full run of the BGD manual and of BelType's manual: the second-last line's bottom stands 16 px (BGD) and 22 px (the manual) above its box's at the nearest,.
     */
    reachOf(box: Box): Px {
      if (box.inline || box.anonymous) return box.rect.bottom;
      const el = (box.el as HTMLElement);
      return el.scrollHeight > el.clientHeight ? Infinity : box.rect.bottom;
    },

    /** Words — and the pieces of a word set on several lines — with their integer line indices: how a Class B cut resolves to a resume place, a word and, where the line begins inside one, a character. */
    wordsOf(box: Box): Word[] {
      if (box.blockChildren.length) return [];
      return computeLines(box).words.map((w) => ({ word: w.word, line: (w.line as LineIndex), index: w.index, char: w.char }));
    },

    /** The end-edge gap of a box as geometry: the last content bottom (`base`) and the padding-box bottom (`bottom`). Non-null whenever the region between them is where a Class C cut could fall — after the last block child, after the last line of a height-constrained text box, or the whole padding box of an emptied continuation shell. */
    endGapOf(box: Box): Gap|null {
      // An anonymous box is its lines and nothing else: no decoration, no declared size, so no gap after its last line.
      if (box.anonymous) return null;
      const cs = win.getComputedStyle(box.el);
      const bottom = box.rect.bottom - parseFloat(cs.borderBottomWidth);
      let base;
      if (box.blockChildren.length) {
        base = box.blockChildren[box.blockChildren.length - 1].rect.bottom;
      } else {
        const lines = this.linesOf(box);
        base = lines.length ? lines[lines.length - 1].bottom : box.rect.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
      }
      return bottom - base > GAP_MIN ? { base, bottom } : null;
    },

    /** Container-edge gap size at a box boundary, for Class C existence. Zero means no gap, and no Class C reading. */
    gapAt({ box, edge }: { box: Box; edge: 'start'|'end'; }): Px {
      if (edge === 'end') {
        const gap = this.endGapOf(box);
        return gap ? gap.bottom - gap.base : 0;
      }
      // The start gap is §4.1's, between the box's content edge and the outer edge of its first in-flow child (*the cut divides its ancestors*, 2026-09-29): the padding lies outside the content edge and the child's margin is its outer edge, so neither is a gap — case 65's correction at the box's other end, read again at this one (`packages/essay/cases/71-the-box-that-begins-a-page`, whose box c Chromium moves whole). A float or an absolutely positioned child stands in no procession, so what stands before the first in-flow child — box d's empty float there, and the clearance under it — is gap.
      const first = box.blockChildren.find((c) => {
        if (c.anonymous) return true;
        const s = win.getComputedStyle(c.el);
        return s.float === 'none' && s.position !== 'absolute' && s.position !== 'fixed';
      });
      // A run before the first block child is the first child, and its first line box stands at the content edge: nothing lies between them (*the anonymous box is in the procession*).
      if (!first || first.anonymous) return 0;
      const cs = win.getComputedStyle(box.el);
      const contentTop = box.rect.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
      return Math.max(0, first.rect.top - parseFloat(win.getComputedStyle(first.el).marginTop) - contentTop);
    }
  };

  return Object.freeze(report);
}
