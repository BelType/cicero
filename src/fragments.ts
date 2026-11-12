/**
 * Fragment construction — one implementation, two consumers (third-coding-round.md item 2). The driver's measure feed and the root's presentation build continuations with the same code: what adjudication measured is what presentation shows, by construction rather than by parallel maintenance.
 *
 * **Both ends of a fragment are cut by THE ADDRESS** ([*the cut is a place in the tree*](../../../.claude/decisions/cicero/the-cut-is-a-place-in-the-tree.md), 2026-09-18). `continuationClone` and `firstFragmentClone` take one `cut` — `positions.js`' `{ path, word, px }` (see CHANGELOG 2026-09-18) — and each resolves it against the source and reaches this clone through `word-space.js`' clone-to-source map. **No index is followed on a clone anywhere in this file**, which is why the map is filled before `stripFixedBoxes` and before the Compositor's hints: a path to a block box never crosses a composable leaf, so the `<br>`s and filler spans the hints insert cannot lie about it, and a fixed sibling the clone no longer has cannot shift it.
 *
 * The three moves, mirrored end for end. **A bare path** — a Class A cut, a start-edge Class C, a forced break: the start removes everything standing before the target at every level and leaves the target and its successors untouched; the end is `truncateFrom(clone, target)`, which the measure feed already cuts a forced break with. **A path plus a `word`** — Class B, and only inside a line stack: the start locates the leaf the same way, then `consumeLeadingWords(leaf, word)` inside it; the end is `truncateFrom(clone, leaf, { keep: true })` then `consumeTrailingWords(leaf, word)`. **A path plus `px`** — an end-gap Class C or the page edge's own cut: the start builds the blank or painted shell, the end keeps the shelled box whole and drops what follows it.
 *
 * **Which boxes either end dresses is one law** ([*the cut divides its ancestors*](../../../.claude/decisions/cicero/the-cut-divides-its-ancestors.md), 2026-09-29): a cut names a place in the tree, the boxes it divides are the proper ancestors of that place, and nothing else. A box carries its start decoration on a page when the page's opening cut does not divide it, and its end decoration when the closing cut does not; margins adjoining the cut are truncated (css-break-3 §5.2). The class of the cut never enters the dressing — it says only whether the place exists.
 *
 * `consumeLeadingWords` and `consumeTrailingWords` survive, scoped to one line stack, because that is the only place *wordless means already shown* is sound: inside a line stack, word order and line order are the same order. Everything outside the leaf now leaves by its position in the tree, which is what stopped a plate with no words of its own from being spent at both ends of a fragment it stood between (`packages/essay/cases/53-the-plate-before-the-forced-break`).
 *
 * All writes here land on clones — decision products under *decisions land only as fragment hints or per-page literals* (C5); the source document is never touched.
 *
 * **A fragment is written the conditions its feed was measured under** (*the fragment lays out under the feed's conditions*, 2026-10-08; *render-identical conditions*, I5). A box that reads its children — a table, a grid — is laid out against content the fragment may have put away, so the three public constructors take the `tracks` the feed measured for the page (`gauge.js`' `tracksOf`, carried by the account) and `pinTracks` writes them as literals on the fragment's boxes: a table's column widths on the cells of its first displayed row with `table-layout: fixed` and the table's own width, a grid's column list on the grid. Never on the feed's own clone, which is where the numbers come from, and never across pages: each fragment is written from its own page's measurement (*cut-invariance*, C7). A flex row is written nothing, by ruling: its drift loses no word.
 *
 * **The items that ride beside a cut are the resume tree's flows** (*a parallel flow is a fragmentainer*, 2026-10-08). The builders still take the flat list the account carries and read it as a tree once, at their door; a row item, a cell and a float nested in the block the cut passes through are one kind of node — a box standing before the cut that is kept and cut at a place of its own.
 *
 * @packageDocumentation
 */

import { applyRecordsUnder, hyphenCharOf } from './compose-dom.ts';
import { addWord, ADJOIN, ARTIFACT, AWAY, BREAK, END, ENGINE_MARKS, hasAnyWord, hasWord, removeWord, SHELL, SPLIT, START, WRAPPED } from './data-beltype.ts';
import { pairsOf } from './document-state.ts';
import { divides, elAtIn, flowsOf } from './positions.ts';
import { BREAKING_SPACE, clonesDecoration, cutRanges, emptyText, inDisplayOrder, leaveOut, replaceChars, isEngineText, mayBeAutoHyphenated, noteEngineText, splitTextAt, isFixedBox, isInlineBox, isLineBreak, copyOf, shellOf, noteText, READS_ITS_CHILDREN, sourceOf, sourceStyle } from './word-space.ts';
import type { CompositionRecord } from './compose-dom.ts';
import type { ResumePath } from './ledger.ts';
import type { Address, ResumeNode } from './positions.ts';

/** A word of the clone-side word space, and the runs of text nodes that hold it (`joinedWords`). A part the engine wrote holds none of the word's characters. */
export type JoinedPart = { node: Text, start: number, end: number, engine?: boolean };

export type JoinedWord = { text: string, parts: JoinedPart[] };

/** A box's measured tracks and a row item's measured reach, as the account carries them for a page (`pinTracks`, `pinExtents`). */
export type Track = { path: number[], kind: string, columns: number[] | string, width?: number };

export type Extent = { path: number[], px: number };

/** The word space, clone side: words are maximal non-whitespace runs of the subtree's joined text — a run crossing a text-node or inline-element seam is one word, exactly as the Gauge reads, and exactly as the position index counts over sources (src/positions.js — the two tokenizations must never drift; counting per node instead shifts every offset by the seam-spanning words before it, which the test-document's inline markup caught). **A non-inline boundary ends the run** (word-space.js), which is where this stopped agreeing with the page for two months. This walk survives on the clone side only: consumption must find the resume word's actual text nodes in the mutated copy, which no source-side index can answer. */
export function joinedWords(root: Element, isInline: (el: Element) => boolean = isInlineBox): JoinedWord[] {
  const words: JoinedWord[] = [];
  let current: JoinedWord|null = null;
  const scan = ( node: Text) => {
    // Text the engine wrote — the Compositor's hyphen — is a part of the word that holds none of its characters: whole-word consumption takes it with its word, and an offset into the word counts the source's text alone (*the hyphen is written at the cut*, 2026-10-06).
    if (isEngineText(node)) {
      current?.parts.push({ node, start: 0, end: node.data.length, engine: true });
      return;
    }
    const s = node.data;
    let i = 0;
    if (s.length && BREAKING_SPACE.test(s[0])) current = null;
    while (i < s.length) {
      if (BREAKING_SPACE.test(s[i])) {
        current = null;
        i++;
        continue;
      }
      let j = i;
      while (j < s.length && !BREAKING_SPACE.test(s[j])) j++;
      if (current) {
        current.text += s.slice(i, j);
        current.parts.push({ node, start: i, end: j });
      } else {
        current = { text: s.slice(i, j), parts: [{ node, start: i, end: j }] };
        words.push(current);
      }
      i = j;
    }
    if (s.length && BREAKING_SPACE.test(s[s.length - 1])) current = null;
  };
  const walk = ( el: Element) => {
    for (const node of inDisplayOrder(el, [...el.childNodes] as Element[])) {
      if (node.nodeType === 3) scan((node as unknown as Text));
      else if (node.nodeType === 1) {
        if (isArtifact(node)) continue; // a copy the engine repeats is furniture, in no word of the box (the header the table repeats)
        // A run does not cross a non-inline boundary (word-space.js) — the same two resets `indexBlocks` writes, over the same tree shape, because the two tokenizations must answer the same number for the same document.
        const joins = isInline((node as Element)) && !isLineBreak((node as Element));
        if (!joins) current = null;
        walk((node as Element));
        if (!joins) current = null;
      }
    }
  };
  walk(root);
  return words;
}

/**
 * Take the fixed boxes a clone inherited from its source out of it (*a fixed box at any depth*, 2026-09-15).
 *
 * CSS 2.1 §9.6.1 repeats a `position: fixed` box on every page and says nothing about where it was declared, so the Model's answer for it is **zero** at any depth — no place in the word space, none in the feed, and nothing rendered from where it sits. A top-level one gets that for free by never being assigned; a nested one is inside a block that is assigned, so it leaves the clone here. The Furniture delivers it per page, from the source, which is untouched — the removal is a decision product under *decisions land only as fragment hints or per-page literals* (C5), exactly like every other write in this file.
 *
 * Walked depth-first over children rather than by a flat query, because a fixed box inside a fixed box goes with its ancestor and must not be visited twice.
 */
export function stripFixedBoxes(root: Element, isFixed: (el: Element) => boolean = isFixedBox): Element {
  for (const child of [...root.children]) {
    if (isFixed(child)) child.remove();
    else stripFixedBoxes(child, isFixed);
  }
  return root;
}

/**
 * The mark of a divided box, at the edge the cut divides it (*the cut divides its ancestors*, 2026-09-29; *the piece words*, 2026-10-11). A box a page's opening cut divides did not begin on that page, so its fragment there carries none of what CSS generates at a box's beginning — `::before`, `::marker`, `::first-letter`, `::first-line` — and a box the page's closing cut divides does not end there, so its fragment carries no `::after`. The dressing sheet (`root.js`) withholds them over the words, and the two functions below are the one place either is written, at every depth: the proper ancestors of the cut's place, and nothing else. A top-level fragment carries them too, which Caster's adapter reads as the identity of a continuation (`packages/caster/src/adapters/cicero.js`).
 *
 * **The words are `split`, `start` and `end`, and the pair of them says which cut divided the box**: a piece is `split` when either cut divides it, `start` unless the opening cut does (it is dressed as the box's beginning), `end` unless the closing cut does. The old classes were a pair of facts, `__beltype-cont` (the opening cut divides it) and `__beltype-cut` (the closing cut does), and the words are the same pair read from the other side: *cont* is `split` without `start`, *cut* is `split` without `end`. A box both cuts divide — a middle piece — is `split` alone. The two writers read the state the words already hold, so they compose in either order and are idempotent.
 */
export function markCont(el: Element) {
  const cut = hasWord(el, SPLIT) && !hasWord(el, END);
  addWord(el, SPLIT);
  removeWord(el, START);
  if (!cut) addWord(el, END);
}

/** The other cut: this piece does not end the box. See {@link markCont}. */
export function markCut(el: Element) {
  const cont = hasWord(el, SPLIT) && !hasWord(el, START);
  addWord(el, SPLIT);
  removeWord(el, END);
  if (!cont) addWord(el, START);
}

/** The painted shell's box: divided, and yet **dressed as the box's beginning** — it keeps its `::before`, its marker, its first letter, its top edge and its indent, because they were painted on the page before and ride above the clip (*the piece words*, 2026-10-11: `start` means "dressed as", not "holds"). It is `split start`, and `end` unless the closing cut also passes through it. */
function markShelled(el: Element) {
  const cut = hasWord(el, SPLIT) && !hasWord(el, END);
  addWord(el, SPLIT);
  addWord(el, START);
  if (!cut) addWord(el, END);
}

/**
 * Continuation dressing, arithmetic side: a box the page's opening cut divides carries no leading margin and no first-line indent on this page — and, under `slice`, no leading border or padding either. Only such a box: the proper ancestors of the place the cut names (*the cut divides its ancestors*, 2026-09-29), never the box a bare path resumes at, whose own first line is on this page (`truncateAdjoiningMargin` below is what that box gets).
 *
 * **The border and the padding are the property's** (*the fragment that wraps itself*, 2026-09-15). css-break-3 §5.4's `clone`: *"Each box fragment is independently wrapped with the border, padding, and margin."* This function dropped them unconditionally, which is `slice` written as the only behaviour.
 *
 * **The margin goes either way, and that is the specification's own note rather than a simplification**: *"Cloned margins are truncated on block-level boxes."* §5.2 truncates margins adjoining a break in any case, so the two agree and neither has to be chosen between.
 *
 * **The indent is not decoration at all.** A box that resumes is not beginning, so `text-indent` does not re-fire — the architecture's continuation dressing, beside `::first-letter` and the generated content, and nothing `box-decoration-break` has an opinion about.
 *
 * And the box is marked (`markCont`), so the dressing sheet withholds what it generates at its beginning.
 */
export function truncateLeadingDecoration(el: Element) {
  markCont(el);
  if (clonesDecoration(el)) addWord(el, WRAPPED); // the words sheet gives up the box's margin and indent either way, and its border and padding unless it wraps each fragment whole
}

/**
 * The box a bare-path cut resumes at, and its first-child chain: not divided, so each keeps its border, its padding, its `text-indent` and everything it generates, and loses only the block-start margin that adjoins the break (css-break-3 §5.2) — its own, and that of each first child whose margin would collapse through it into the break.
 *
 * The descent stops at the first box with a top border or a top padding, because a margin does not collapse through either (CSS 2.1 §8.3.1): a margin below it adjoins that box's content edge, not the break. The reading is the source's, through the word space's map; a box with no answer (the DOM-free suites) is read as having neither.
 *
 * @remarks
 * This is the first-child chain [*the cut resumes at the box*](../../../.claude/decisions/cicero/the-cut-resumes-at-the-box.md) measured as load-bearing (native seeds 71 and 173 moved off Chromium's cuts when it was dressed less), narrowed to the one property that chain carries into the break. It used to take the full dressing, border and padding included, which stripped every box that opened a page whole (`packages/essay/cases/71-the-box-that-begins-a-page`).
 * @see .claude/decisions/cicero/the-cut-divides-its-ancestors.md
 */
function truncateAdjoiningMargin(target: Element) {
  for (let d = (target as Element | null); d; d = d.children?.[0] ?? null) {
    addWord(d, ADJOIN);
    const st = sourceStyle(d);
    if (st && ((parseFloat(st.borderTopWidth) || 0) > 0 || (parseFloat(st.paddingTop) || 0) > 0)) break;
  }
}

/** Continuation dressing, the other edge: a box the page's closing cut divides — the chain the cut passes through — carries no trailing margin, and under `slice` no trailing border or padding, and is marked (`markCut`) so its `::after` waits for the fragment it ends on. The exact mirror of `truncateLeadingDecoration`, including which half the property governs: margins before a break are truncated (§5.2), and a cloned fragment wraps itself at both edges (§5.4), so the truncated feed is measured against the room truncation actually yields. */
export function truncateTrailingDecoration(el: Element) {
  markCut(el);
  if (clonesDecoration(el)) addWord(el, WRAPPED);
}

/**
 * Kept and not displayed (*every branch gets a place*, 2026-09-21) — what becomes of a box outside a fragment's interval.
 *
 * It used to be removed, and removal moves the author's selectors: fragmentation divides boxes, and selectors match the element tree, which Chromium's own fragmentation never touches. Measured on two documents put to every engine — a section tinted through `section:has(> h2.mark)` lost its tint on the page after, its heading gone from the clone (`packages/essay/cases/60-the-section-the-author-addressed`, and that is how BelType's own documents address a section); a list striped by `:nth-child(odd)` restriped from its sixth item, which had become a first child (`cases/61-the-zebra-list`). At a fragment's end it was worse than wrong-looking: the presented tree differed from the measured one, which still had its tail, and *a break decision is valid only under render-identical conditions*.
 *
 * So the box stays an element, in its place among its siblings, wearing the word `away` (the words sheet gives it `display: none !important`; it was an inline style until *the piece words*, 2026-10-11) — and CSS 2.1 §12.4.3 already says such an element neither increments nor resets a counter. An engine mark (a Compositor hint standing before the resume point) is not the author's element and still leaves.
 *
 * **And it is hollow** (*the clone is hollow outside the interval*, 2026-09-27): an element with its tag and its attributes and no children, which is the upgrade the rule named and left unbuilt. Every selector that reads an element's existence, place and attributes matches it as it matched the deep copy; what would not is a `:has()` reaching inside it, so where a stylesheet has one (`capture.js`'s `sheetsUseHas`) `hollow` is false and the box keeps its interior with its text emptied, as it did from 2026-09-21 — no selector reads text, and everything that reads words off a fragment, this file's `joinedWords` and Caster's partition, goes on finding exactly the fragment's own. `conceal` is the one place the shape is made, for a box put away here and for a box `cloneInterval` builds hollow from the start.
 */
function conceal(el: Element, hollow: boolean) {
  addWord(el, AWAY); // the words sheet hides it, in a layer an author's own `display` cannot outrank (`dressing.js`)
  if (hollow) {
    el.replaceChildren();
    return;
  }
  (function empty( n: Node) {
    for (const child of n.childNodes) {
      if (child.nodeType === 3) emptyText((child as Text));
      else empty(child);
    }
  })(el);
}

/** The source groups that do not repeat — replaced whole by whoever decides (the driver, from its measurement; the presentation, from the account). */
let declinedRepeats = new WeakSet<any>();

/**
 * Say which header and footer groups a divided table does not repeat (*the header repeats*, 2026-10-14). The decision is made once, at the table's first fragment (`driver.js`), and every fragment built after it reads this set.
 *
 * @param groups - source `thead`/`tfoot` elements.
 */
export function declineRepeats(groups: Iterable<Element> = []) {
  declinedRepeats = new WeakSet(groups);
}

const isArtifact = ( node: any) => typeof node.getAttribute === 'function' && hasWord(node, ARTIFACT);

/**
 * Is this element a table's header or footer group that a divided table repeats on a fragment it does not belong to (css2 17.2: *may*, and Blink does)?
 *
 * @remarks Decided by the tag and the computed display, and by the set of groups the table declined; the quarter-of-the-page guard and `break-inside` are judged once by the driver, which is what fills that set.
 *
 * @param node - a clone element, or a source element.
 */
function repeatedGroup(node: Element) {
  const src = sourceOf(node) ?? node;
  return mayRepeat(src) && !declinedRepeats.has(src);
}

/**
 * Could this source element be a repeated header or footer — a `thead` or `tfoot` whose computed display says so?
 *
 * @remarks A footer written before the rows (HTML 4 order, still legal) repeats like any other since *the footer before the rows* (2026-10-15). It is laid out at the table's foot but stands first in the document, and until the Gauge walked it where the layout puts it (`footerBeforeRows`) the walk stopped at it and the rows were lost; the header-repeat round left such a table unrepeated for that reason, and the reason is gone.
 *
 * @param src - a source element, or any element a computed style can be asked of.
 */
export function mayRepeat(src: Element) {
  if (!/^(THEAD|TFOOT)$/i.test((src as any).tagName ?? '')) return false;
  const display = sourceStyle(src)?.display;
  return display === 'table-header-group' || display === 'table-footer-group';
}

function putAway(node: ChildNode, hollow: boolean = false) {
  if (node.nodeType === 3) {
    emptyText((node as Text));
    return;
  }
  if (node.nodeType === 1 && repeatedGroup((node as Element))) {
    addWord((node as Element), ARTIFACT); // the table's header or footer group is repeated on this fragment, as a copy (css2 17.2)
    (node as Element).setAttribute('aria-hidden', 'true'); // an artifact is never read (`.claude/decisions/cicero/an-artifact-is-never-read.md`)
    return;
  }
  if (node.nodeType !== 1 || hasAnyWord((node as Element), ENGINE_MARKS)) {
    node.remove();
    return;
  }
  conceal((node as Element), hollow);
}

/**
 * A border side's width where its style draws one: `0` for `none`, and `null` for `hidden`, which suppresses the whole shared edge in the collapsing model (CSS 2.1 §17.6.2.1).
 *
 * @param cs - a source element's computed style.
 */
function drawnWidth(cs: CSSStyleDeclaration, side: 'Top'|'Bottom'): number|null {
  const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
  if (style === 'hidden') return null;
  return style === 'none' ? 0 : parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) || 0;
}

/** The widest drawn border on one side of these clone elements, read from their sources; `null` where any of them is `hidden`. */
function widestOf(els: Element[], side: 'Top'|'Bottom'): number|null {
  let w = 0;
  for (const el of els) {
    const cs = sourceStyle(el);
    if (!cs) continue;
    const d = drawnWidth(cs, side);
    if (d === null) return null;
    w = Math.max(w, d);
  }
  return w;
}

/**
 * The first row of a table clone's grid that is shown: put-away rows and the lifted header left out.
 *
 * @param lifted - the header copy, which stands outside the grid.
 */
function firstGridRow(table: Element, lifted: Element): Element|null {
  for (const child of table.children) {
    if (child === lifted || hasWord(child, AWAY)) continue;
    const d = sourceStyle(child)?.display ?? '';
    if (d === 'table-row') return child;
    if (/^table-(row|header|footer)-group$/.test(d)) {
      const row = [...child.children].find((r) => !hasWord(r, AWAY) && sourceStyle(r)?.display === 'table-row');
      if (row) return row;
    }
  }
  return null;
}

/**
 * Lift a continuation's header copy out of the table's grid where the grid would join it to the rows otherwise than Chromium prints them (*a repeated header joins the rows as Chromium prints them*, 2026-10-22): under collapsed borders where the header's bottom is wider than the first body row's top, the copy becomes the table's caption, laid out above the table box, with the bottom margin that places it.
 *
 * @remarks In one grid the header and the first body row share one border, the wider, half on each side. Chromium paints the header's bottom as the whole table resolves it, then the first body row's own top border over it, centred on the same line, and the body row's content stands half the row's own border below that line (Measured 2026-10-22: red 4px under blue 2px, the body one pixel above the grid's). In the caption the header resolves its own bottom, wholly inside the caption, and the table box resolves the body row's top at its sliced edge, wholly inside the table box; the caption's bottom margin is what puts the second border's centre on the first's. With `J` the whole table's join, `a` the caption's own bottom border and `t` the body row's top, the margin is `J/2 - a - t/2`. Every other copy stays in the grid, where it has been since *the header repeats* (2026-10-14); the spacing a separated table puts above the copy is the driver's spent lead (`spentLeadOf`), not this function's.
 *
 * The readings are the sources' computed styles, as everything this file decides, and the literal is written in the measure feed and in the presentation alike, since both build continuations here. The caption's cells are pinned to the grid's columns with the grid's first row (`pinTable`); the feed's are not pinned, as no feed is.
 *
 * @param group - a `thead` copy wearing `artifact`, a child of its table's clone.
 */
function liftRepeatedHeader(group: HTMLElement) {
  const table = group.parentElement;
  const cs = table ? sourceStyle(table) : null;
  if (!table || !cs || !/^(inline-)?table$/.test(cs.display)) return;
  if (cs.borderCollapse !== 'collapse') return;
  const rows = [...group.children].filter((r) => sourceStyle(r)?.display === 'table-row');
  const last = rows.at(-1);
  const first = firstGridRow(table, group);
  if (!last || !first) return;
  const cellsOf = ( row: Element) => [...row.children].filter((c) => sourceStyle(c)?.display === 'table-cell');
  const own = widestOf([...cellsOf(last), last], 'Bottom');
  const join = widestOf([...cellsOf(last), last, group], 'Bottom');
  const top = widestOf([...cellsOf(first), first, ...(first.parentElement && first.parentElement !== table ? [first.parentElement] : [])], 'Top');
  if (own === null || join === null || top === null || join <= top) return;
  group.style.cssText += `display:table-caption;caption-side:top;margin:0 0 ${join / 2 - own - top / 2}px;border:0;padding:0;`;
}

/**
 * Truncate a clone at a boundary element: `el` and everything after it in document order leave the fragment, and every ancestor the cut passes through — `clone` included — is dressed as a fragment that ends here.
 *
 * The grab's half of the word-granular forcing search (*the grab descends*): a forced break interior to a top-level block truncates the feed AT the position rather than between items, and this is what "at the position" means on the DOM. There is one spelling and not two, because the grab's events are always the start of the box that resumes — a `break-after` is carried to the next box before it becomes an event, so what arrives here is always "cut this box and its successors away".
 *
 * **`keep` is the first fragment's door into the same surgery** (*the first fragment is constructed*, 2026-09-15). A shell continues a box whose own content closed on the page before, so page one wants everything after that box gone and the box itself standing — the one difference from the grab's reading, where the boundary box is what resumes. With `keep`, the boundary element stays and is dressed as a fragment that ends there, which it is.
 *
 * @param clone - the top-level block's clone, already hinted and already consumed to the cursor.
 * @param el - the boundary node, addressed in the clone's own coordinates: an element, or the first node of a run of lines, which has no element (*the anonymous box is in the procession*).
 * @param opts - `keep`: the boundary element stays in the fragment (and is dressed), rather than leaving with its successors. `hollow`: what leaves is kept hollow (`putAway`).
 */
export function truncateFrom(clone: Element, el: ChildNode, { keep = false, hollow = false }: { keep?: boolean; hollow?: boolean; } = {}) {
  if (el === clone) return clone;
  const chain: Element[] = [];
  for (let e = (el as Element | null); e && e !== clone; e = e.parentElement) {
    // What follows in display order, which inside a table puts a footer written first after the rows and a header written last before them (*the-word-space-follows-the-table-display-order*).
    const siblings = inDisplayOrder(e.parentElement as Element, [...(e.parentElement as Element).childNodes] as Element[]);
    for (const sib of siblings.slice(siblings.indexOf(e) + 1)) putAway(sib, hollow);
    if (e !== el || keep) chain.push(e);
  }
  chain.push(clone);
  if (!keep) putAway(el, hollow);
  for (const a of chain) truncateTrailingDecoration(a);
  return clone;
}

/** The part of a joined word that holds its character `c`, or `null` past its end. A word's parts are its runs in successive text nodes, so a character offset into the word names exactly one of them. A part the engine wrote holds no characters. */
function partAt(word: JoinedWord, c: number) {
  let left = c;
  for (const part of word.parts) {
    if (part.engine) continue;
    const len = part.end - part.start;
    if (left < len) return part;
    left -= len;
  }
  return null;
}

/**
 * The node ranges that hold characters `[from, to)` of a joined word — what consuming part of one word removes (*a line inside a word is a break point*, 2026-09-23).
 *
 * @remarks
 * A part the engine wrote counts no characters and stands at the offset of the characters before it; it belongs to the side of a cut that holds those characters, so it is in `[from, to)` where `from < offset <= to` (*the hyphen is written at the cut*, 2026-10-06): the Compositor's hyphen ends the line it was written on, and a cut after the characters before it leaves it on the page they are on.
 */
function charRanges(word: JoinedWord, from: number, to: number) {
  const out: JoinedPart[] = [];
  let at = 0;
  for (const part of word.parts) {
    if (part.engine) {
      if (from < at && at <= to) out.push(part);
      continue;
    }
    const len = part.end - part.start;
    const lo = Math.max(from, at);
    const hi = Math.min(to, at + len);
    if (hi > lo) out.push({ node: part.node, start: part.start + lo - at, end: part.start + hi - at });
    at += len;
  }
  return out;
}

/** Whether the whitespace of a text node stands in its layout (css-text-4 §4.1): where it collapses it is nothing at a line's edge, and where it is preserved each newline draws a line. */
const preservesSpace = (t: Text) => !!t.parentElement && /^(pre|pre-wrap|pre-line|break-spaces)$/.test(sourceStyle(t.parentElement)?.whiteSpace ?? '');

/** Take a stretch of a cut's whitespace out of the fragment: leave it where it collapses, so layout reads the data exactly as before, and remove it where it is preserved, or a continuation opens on the empty lines of every line cut away. Either way the record says it is not shown. */
function dropSpace(t: Text, from: number, to: number) {
  if (to <= from) return;
  if (preservesSpace(t)) cutRanges(t, [{ start: from, end: to }]);
  else leaveOut(t, from, to);
}

/**
 * The indentation of the line a resume word opens: the whitespace before it back to a newline, in characters. Read before the words before it go, because only they tell the space that opens a line from the space that followed a word. A cut at a soft wrap has no newline in that gap and no indentation, the space hanging at the end of the line before; a line after a `<br>` looks the same and loses its indentation at the top of a page.
 */
function indentationBefore(clone: Element, node: Text, start: number) {
  let text = '';
  for (const t of textsIn(clone)) {
    if (t === node) {
      text += t.data.slice(0, start);
      break;
    }
    text += t.data;
  }
  let i = text.length;
  while (i > 0 && BREAKING_SPACE.test(text[i - 1])) i--;
  const newline = text.lastIndexOf('\n');
  return newline < i ? 0 : text.length - newline - 1;
}

/**
 * Say that everything before the resume point is held and not shown (*the engine names the source point*, 2026-10-13). Consuming blanks the words and leaves the whitespace between them, so a continuation's data still begins with the spaces of every word cut away; those are the source's characters and no part of the interval, and so are the whitespace before the first kept word and every text node that stands wholly before it. Where the whitespace collapses these are records only, and where it is preserved they leave the data (`dropSpace`), all but the indentation of the line the page opens on.
 *
 * @param resume - the node holding the first kept character, or null when nothing is kept.
 * @param indent - the characters immediately before it to keep, from {@link indentationBefore}.
 */
function leaveOutBefore(clone: Element, resume: Text|null, indent: number) {
  const lead = [];
  for (const t of textsIn(clone)) {
    if (t === resume) break;
    lead.push({ node: t, end: t.data.length });
  }
  if (resume) {
    let at = 0;
    while (at < resume.data.length && BREAKING_SPACE.test(resume.data[at])) at++;
    lead.push({ node: resume, end: at });
  }
  let left = indent;
  for (const { node, end } of lead.reverse()) {
    const kept = preservesSpace(node) ? Math.min(left, end) : 0;
    left -= kept;
    dropSpace(node, 0, end - kept);
  }
}

/** The mirror: everything after the last kept character is held and not shown.@param keep - the node holding the last kept character. */
function leaveOutAfter(clone: Element, keep: Text) {
  let end = keep.data.length;
  while (end > 0 && BREAKING_SPACE.test(keep.data[end - 1])) end--;
  let after = false;
  for (const t of [...textsIn(clone)]) {
    if (after) dropSpace(t, 0, t.data.length);
    else if (t === keep) after = true;
  }
  dropSpace(keep, end, keep.data.length);
}

/** The text nodes under an element, in document order — by `childNodes`, as `joinedWords` reads, so the DOM-free suites' trees serve. */
function* textsIn(el: Element): Generator<Text> {
  for (const node of el.childNodes) {
    if (node.nodeType === 3) yield (node as Text);
    else if (node.nodeType === 1 && !isArtifact(node)) yield* textsIn((node as Element));
  }
}

/** Consume the first n words of a clone, in the word space (joinedWords): the consumed words' characters blank out, elements left with no words that stand entirely before the resume point are removed (a spent figure must not survive as an empty fixed-height box; a spent <br> hint must not render an empty line), and the resume chain is dressed (*straddle-heredity*, C6). */
function consumeLeadingWords(clone: Element, n: number, char: number = 0, hollow: boolean = false) {
  const words = joinedWords(clone);
  if ((n <= 0 && char <= 0) || !words.length) return;
  // A resume inside word n (*a line inside a word is a break point*, 2026-09-23): its first `char` characters were shown on the page before, and go with the words before it. The page resumes at the part holding the first character left.
  const inside = char > 0 && n < words.length ? charRanges(words[n], 0, char) : [];
  const resumeWord = words[Math.min(n, words.length - 1)];
  const resumePart = n < words.length ? partAt(resumeWord, char) ?? resumeWord.parts[0] : null;
  const resumeNode = resumePart?.node ?? null;
  const indent = resumePart && char === 0 ? indentationBefore(clone, resumePart.node, resumePart.start) : 0;

  // Blank the consumed words' exact character ranges, one pass a node (`word-space.js`' `cutRanges`, which records what went).
  const perNode: Map<Text,JoinedPart[]> = new Map<any, any>();
  for (const part of [...words.slice(0, n).flatMap((w) => w.parts), ...inside]) {
    if (!perNode.has(part.node)) perNode.set(part.node, []);
    (perNode.get(part.node) as JoinedPart[]).push(part);
  }
  for (const [node, ranges] of perNode) cutRanges(node, ranges);
  leaveOutBefore(clone, resumeNode, indent);

  // Structural pass: an element with no remaining words, standing entirely before the resume point, is spent — its edges adjoin the cut (§5.2) and it leaves the fragment.
  const spent: Element[] = [];
  (function walk( el: Element) {
    for (const child of [...el.children]) {
      if (resumeNode && child.contains(resumeNode)) {
        walk(child);
        continue;
      }
      const before = !resumeNode || !!(child.compareDocumentPosition(resumeNode) & 4 /* FOLLOWING */);
      if (before && !/\S/.test((child.textContent as string))) spent.push(child);
      else if (before) walk(child); // a preceding element still holding words (should not happen in the joined space, but never delete words)
    }
  })(clone);
  for (const el of spent) putAway(el, hollow);

  // The straddling chain (*straddle-heredity*, C6): dress every level from the clone down to the resume point.
  if (resumeNode) {
    for (let el = resumeNode.parentElement; el && el !== clone; el = el.parentElement) truncateLeadingDecoration(el);
  }
}

/**
 * The deepest box the cut passes through — the innermost box divided, which is what §5.3 extends and whose last line the clone's cut line is.
 *
 * Read from the two ends of the boundary before anything is consumed, because the first word after the cut is about to leave the tree. A Class A cut between two siblings answers their parent, which is the right answer and not a coincidence: the boundary divides the container, not either sibling. A Class B cut between two lines of one paragraph answers that paragraph.
 */
function innermostDivided(clone: Element, lastKeptNode: Node, firstDroppedNode: Node): Element {
  const kept: Set<Element> = new Set<any>();
  for (let el = lastKeptNode.parentElement; el; el = el.parentElement) {
    kept.add(el);
    if (el === clone) break;
  }
  for (let el = firstDroppedNode.parentElement; el; el = el.parentElement) {
    if (kept.has(el)) return el;
    if (el === clone) break;
  }
  return clone;
}

/**
 * Consume the words from `n` — the exact dual of `consumeLeadingWords`, in the same word space (*the first fragment is constructed*, 2026-09-15).
 *
 * The three moves are mirrored one for one: the dropped words' characters blank out, elements left with no words that stand entirely after the boundary are removed (a figure below the cut must not survive as an empty fixed-height box), and the chain the cut passes through is dressed by `truncateTrailingDecoration` rather than by its leading twin. The partition is the same partition read from the other side — an element wholly after the boundary leaves, an ancestor of the last kept word is kept and dressed — which is why the two tests are one another's complement and never overlap: a word printed twice, or printed nowhere, is what an overlap here looks like on the page.
 *
 * @returns the innermost box the cut divided, or null when there was nothing after the boundary to consume.
 */
function consumeTrailingWords(clone: Element, n: number, char: number = 0, hollow: boolean = false): Element|null {
  const words = joinedWords(clone);
  if ((n <= 0 && char <= 0) || n >= words.length) return null;
  // An end inside word n: its first `char` characters are this page's, and the last of them is the last thing kept.
  const keepNode = char > 0 ? (partAt(words[n], char - 1) as { node: Text }).node : words[n - 1].parts[words[n - 1].parts.length - 1].node;
  const dropped = char > 0 ? charRanges(words[n], char, words[n].text.length) : words[n].parts;
  const inner = innermostDivided(clone, keepNode, dropped[0]?.node ?? words[n].parts[0].node);
  const firstDropped = dropped[0]?.node ?? words[n].parts[0].node;

  // Blank the dropped words' exact character ranges, one pass a node.
  const perNode: Map<Text,JoinedPart[]> = new Map<any, any>();
  for (const part of [...dropped, ...words.slice(n + 1).flatMap((w) => w.parts)]) {
    if (!perNode.has(part.node)) perNode.set(part.node, []);
    (perNode.get(part.node) as JoinedPart[]).push(part);
  }
  for (const [node, ranges] of perNode) cutRanges(node, ranges);

  // The hyphen is written at the cut (*the hyphen is written at the cut*, 2026-10-06). A soft hyphen the browser broke the line at is drawn there; one at the end of a fragment's last line is not, because nothing breaks after it. So the last kept character, where it is a soft hyphen, becomes the hyphenation character the browser drew — the box's own `hyphenate-character`, else U+2010 (css-text-4 §6.3.2) — and the empty string, which the property allows, removes it. A replacement: the word keeps its length, and the Compositor's own break, whose hyphen is already written and whose soft hyphen stands after it, cuts before the soft hyphen and never meets this.
  let autoHyphen: { node: Text; end: number; char: string; } | null = null;
  if (char > 0 && words[n].text[char - 1] === '\u00AD') {
    const soft = charRanges(words[n], char - 1, char).find((r) => !r.engine);
    if (soft) {
      const hyphen = hyphenCharOf(sourceStyle((soft.node.parentElement as Element)) ?? {});
      replaceChars(soft.node, soft.start, soft.end, hyphen); // one character for one character maps one to one; the empty string, or several, is a removal and the engine's own text (`word-space.js`)
    }
  } else if (char > 0) {
    // A cut between two letters under `hyphens: auto` is one the Gauge minted only where it measured the hyphen the browser drew (`gauge.js`, `piecesOf`), so the same predicate on the same characters says the first fragment ends with it: the hyphenation character is added after the last kept letter, as the engine's own text. A Compositor's break already carries its written hyphen, an engine part at the boundary, and gets none.
    const last = charRanges(words[n], char - 1, char);
    const kept = last.find((r) => !r.engine);
    const style = kept && sourceStyle((kept.node.parentElement as Element));
    if (kept && style && !last.some((r) => r.engine) && mayBeAutoHyphenated(words[n].text[char - 1], words[n].text[char], style.hyphens)) autoHyphen = { node: kept.node, end: kept.end, char: hyphenCharOf(style) };
  }

  leaveOutAfter(clone, keepNode);

  // Structural pass: an element with no remaining words, standing entirely after the boundary, is spent — its edges adjoin the cut (§5.2) and it leaves the fragment.
  // A block standing wholly before the first dropped character is not after the boundary, words or none (*the anonymous box is in the procession*, 2026-09-29): a word cut in a box that holds blocks falls at a run's first word, and a wordless block between the last kept word and the run — a figure after the paragraph before it — is before the cut. Inside a line stack no block stands there, so the leaf's reading is the one it always was.
  const blockBefore = ( child: Element) => !isInlineBox(child) && !!(child.compareDocumentPosition(firstDropped) & 4 /* FOLLOWING */);
  const spent: Element[] = [];
  (function walk( el: Element) {
    for (const child of [...el.children]) {
      if (child.contains(keepNode)) {
        walk(child);
        continue;
      }
      if (blockBefore(child)) continue;
      const after = !!(child.compareDocumentPosition(keepNode) & 2 /* PRECEDING */);
      if (after && !/\S/.test((child.textContent as string))) spent.push(child);
      else if (after) walk(child); // a following element still holding words (should not happen in the joined space, but never delete words)
    }
  })(clone);
  for (const el of spent) putAway(el, hollow);

  // Written last, after the leave-out and the structural pass that would take an element and a text with no source for spent: the hyphen the browser drew stands where the Compositor's stands, a text node of its own, the engine's, before a break mark (*the hyphen is written at the cut*; the printer finds the hyphen by that shape and the letters before it in the source's own run).
  if (autoHyphen && autoHyphen.char) {
    const { node, end } = autoHyphen;
    const parent = node.parentNode as Node;
    const doc = (node.parentElement as Element).ownerDocument;
    const before = end < node.data.length ? splitTextAt(node, end) : node.nextSibling;
    const written = doc.createTextNode(autoHyphen.char);
    noteEngineText(written);
    const br = doc.createElement('br');
    addWord(br, BREAK);
    parent.insertBefore(written, before);
    parent.insertBefore(br, before);
  }

  for (let el = (inner as Element | null); el && el !== clone; el = el.parentElement) truncateTrailingDecoration(el);
  return inner;
}

/**
 * The tracks, written (*the fragment lays out under the feed's conditions*, 2026-10-08). For each box the page's feed measured (`tracks`: `{ path, kind, columns, width }` from the account), reached through the source and the map like every address in this file, the measured widths become literals on the fragment's clone.
 *
 * **A table**: `table-layout: fixed` and the measured width on the table, and each cell of the first displayed row — a hollow row is `display: none` and sizes nothing — takes its measured column width as a border-box `width`, a cell spanning columns the sum of them. No `<colgroup>`: a `<col>` is an element the author's tree never had, and it shifts `table > :first-child` and the `:nth-child` of the table's children by one. The mapping is refused, and the table left as it was, where the first displayed row does not cover exactly the measured columns (a `rowspan` from a row above it that the interval put away). **A grid**: the measured column list as `grid-template-columns`; an item put away or spent keeps its track, which is the point. A box the clone no longer holds, or holds as a put-away shell, is skipped.
 *
 * @param source - the block's source element.
 * @param cloneOf - the source-to-clone map the fragment was built with.
 */
function pinTracks(source: Element, cloneOf: Map<Element,Element>|null, tracks: Track[]) {
  for (const t of tracks) {
    const src = elAtIn(source, rebase(t.path, [t.path[0]]));
    const clone = src ? cloneOf?.get(src) ?? null : null;
    if (!clone || !READS_ITS_CHILDREN.test(sourceStyle(clone)?.display ?? '') || hasWord(clone, AWAY)) continue;
    pinTrack((clone as HTMLElement), t);
  }
}

/**
 * One box's measured tracks, written on its clone: a grid takes its column list, a table its widths (`pinTable`). `pinTracks` finds the clone by the address in the account and calls this; a host that finds the boxes its own way calls it directly.
 *
 * @remarks Which element is a row and which a cell is read as `displayOf` answers. The default is the source's computed display (`sourceStyle`), which a clone registered with its source can be asked; a host whose page holds elements the engine did not register passes its own reading, by tag or by whatever it holds (*the engine knows no view*).
 *
 * @param clone - The clone of the box the tracks were measured on.
 */
export function pinTrack(clone: HTMLElement, t: { kind: string; columns: number[]|string; width?: number; }, displayOf?: (el: Element) => string) {
  if (t.kind === 'grid') clone.style.gridTemplateColumns = (t.columns as string);
  else if (t.kind === 'table') pinTable(clone, (t.columns as number[]), (t.width as number), displayOf);
}

/**
 * §5.3's extension for the items a row cut divides (*the fragment lays out under the feed's conditions*, 2026-10-08): each item's border box reaches the page area's foot, as `min-height` — a floor, which can never overshoot what the content below the cut left out of the fragment. `px` is the distance from the item's top to the foot, read off the feed.
 *
 * @param source - the block's source element.
 * @param cloneOf - the source-to-clone map the fragment was built with.
 */
function pinExtents(source: Element, cloneOf: Map<Element,Element>|null, extents: Extent[]) {
  for (const x of extents) {
    const src = elAtIn(source, rebase(x.path, [x.path[0]]));
    const clone = ((src ? cloneOf?.get(src) ?? null : null) as HTMLElement | null);
    if (!clone || hasWord(clone, AWAY)) continue;
    clone.style.boxSizing = 'border-box';
    // A table cell takes its floor from `height` (a cell's height is a minimum by CSS 2.1 §17.5.3), and no other box is asked for less than its content by it.
    if (sourceStyle(clone)?.display === 'table-cell') clone.style.height = `${x.px}px`;
    else clone.style.minHeight = `${x.px}px`;
  }
}

/** One table's widths, as `pinTracks` states them. The first displayed row is found by the source's display (a detached clone cannot be asked) and by the put-away mark on the clone. A header copy lifted into the caption (`liftRepeatedHeader`) stands outside the grid, so the grid's first row is the one after it, and each of the copy's rows takes the same widths, which is what keeps its columns over the grid's. */
function pinTable(table: HTMLElement, columns: number[], width: number, displayOf: (el: Element) => string = (el) => sourceStyle(el)?.display ?? '') {
  const shown = ( el: Element) => !hasWord(el, AWAY);
  const lifted = ( el: Element) => (el as HTMLElement).style?.display === 'table-caption';
  let row: Element|null = null;
  const heads: Element[] = [];
  (function find( parent: Element) {
    for (const child of parent.children) {
      if (row || !shown(child)) continue;
      const d = displayOf(child);
      if (lifted(child)) heads.push(...[...child.children].filter((r) => displayOf(r) === 'table-row'));
      else if (d === 'table-row') row = child;
      else if (/^table-(row|header|footer)-group$/.test(d)) find(child);
    }
  })(table);
  if (!row) return;
  const cellsOf = ( r: Element) => ([...r.children].filter((c) => shown(c) && displayOf(c) === 'table-cell') as HTMLTableCellElement[]);
  const cells = cellsOf(row);
  const widths = spanWidths(columns, cells.map((c) => c.colSpan || 1));
  if (!widths) return; // the row does not cover the measured columns: leave the table as laid out
  table.style.tableLayout = 'fixed';
  table.style.boxSizing = 'border-box';
  table.style.width = `${width}px`;
  for (const [r, w] of ([[row, widths], ...heads.map((h) => [h, spanWidths(columns, cellsOf(h).map((c) => c.colSpan || 1))])] as Array<[Element, number[] | null]>)) {
    if (!w) continue;
    cellsOf(r).forEach((cell, i) => {
      cell.style.boxSizing = 'border-box';
      cell.style.width = `${w[i]}px`;
    });
  }
}

/**
 * The width each cell of a row takes from the measured columns: a cell spanning n columns the sum of the next n. `null` where the cells do not cover exactly the columns measured — a row that a `rowspan` from above leaves short, or one the interval cut differently — which is the refusal, not a guess.
 *
 * @param columns - the measured column widths
 * @param spans - each cell's `colspan`
 */
export function spanWidths(columns: number[], spans: number[]): number[]|null {
  const n = spans.map((x) => Math.max(1, x));
  if (n.reduce((a, b) => a + b, 0) !== columns.length) return null;
  let at = 0;
  return n.map((x) => columns.slice(at, (at += x)).reduce((a, b) => a + b, 0));
}

/**
 * A carried parallel flow's own extent, on the page it continues onto (the *geometric remainder beside the path* of *a resume point is a path*, I2; tablet, The Flows).
 *
 * The third kind of continuation, and the one this file went two rounds without: a monolith's remainder is painted at exactly the leftover height, a nested C-end box is shelled at exactly the leftover height, and a carried §2.1 flow — round 07's *"an ordinary continuation at a start word, so `mutateToContinuation`'s existing `startWord` path serves it"* — was given no height at all. That is right for a box whose content is its size and wrong for a box that declares one: `aside { height: 96mm }` continued at 96mm with one paragraph left in it, so a rail that had shown 60mm of itself asked for 96 more and the page after it could never close. css-break-3 §5.1: *"Layout is performed per-fragmentainer, with each fragmentainer continuing progress from the breakpoint on the previous"* — the continuation of a 96mm box that has shown 60mm is 36mm.
 *
 * The reading is the source's, never the clone's: a detached clone has no computed style to ask. `auto` needs nothing and gets nothing — an auto-height box's content already is its size, and writing a height there would clip content the remainder arithmetic never measured, which *the page edge is not a break point* (C10) forbids.
 */
function applyCarriedRemainder(clone: HTMLElement, source: Element, remainderPx: number) {
  const cs = (source.ownerDocument.defaultView as Window).getComputedStyle(source);
  const declaresBlockSize = cs.height !== 'auto' || (cs.minHeight !== 'auto' && parseFloat(cs.minHeight) > 0);
  if (!declaresBlockSize) return;
  clone.style.boxSizing = 'border-box';
  clone.style.height = `${Math.max(0, remainderPx)}px`;
  clone.style.minHeight = '0';
}

/** The clone element an address names: resolved on the source and mapped across, never followed on the clone (this file's header, and [*the cut is a place in the tree*](../../../.claude/decisions/cicero/the-cut-is-a-place-in-the-tree.md)). `null` where the tree no longer answers the path or the map does not hold it — an edited document, not a defect, and the callers consume nothing rather than everything. */
function targetOf(cut: Address, source: Element|null, cloneOf: Map<Element,Element>|null): Element|null {
  const src = elAtIn(source, cut.path);
  return src ? cloneOf?.get(src) ?? null : null;
}

/** The chain from just inside `clone` down to `target`, on the clone — the boxes the cut passes through, which is what both ends dress. */
function chainTo(clone: Element, target: Element) {
  const chain: Element[] = [];
  for (let e = (target as Element | null); e && e !== clone; e = e.parentElement) chain.unshift(e);
  return chain;
}

/**
 * A row's items, each cut at its own place (*every branch gets a place*, 2026-09-21).
 *
 * An address speaks for one flow, and a row's items are flows beside each other. So beside the cut a fragment is built from, there may ride `items`: `{ item, cut, remainingPx }`, `item` being the path of the row item the place speaks for. Each is applied by the same two mutations this file already has, on the item's own sub-clone with the item's own source as the root — one implementation, so an item and a top-level block cannot disagree about what a word cut or a shell is. The list arrives flat, the wire form, and is read as the tree it projects at the door (`positions.js`' `flowsOf`: an entry belongs to the nearest item that holds it, a table inside a flex item); each level takes its own `flows` and hands the node's down, so nothing here reconstructs nesting from path prefixes (*a parallel flow is a fragmentainer*, 2026-10-08).
 *
 * `rootPath` is the full path of the box `source` is — `[b]` for a top-level block — which is what an item's path is measured from.
 */
const rebase: (path: number[],rootPath: number[]) => number[] = (path, rootPath): number[] => [0, ...path.slice(rootPath.length)];
function itemsOf(flows: ResumeNode[], rootPath: number[], source: Element|null, cloneOf: Map<Element,Element>|null) {
  return flows.flatMap((e) => {
    const itemSource = elAtIn(source, rebase((e.item as number[]), rootPath));
    const itemClone = itemSource ? cloneOf?.get(itemSource) ?? null : null;
    if (!itemClone) return []; // a path the tree no longer answers: leave the item as it stands rather than cut it blind
    return [{ e, itemSource, itemClone, cut: { ...e.cut, path: rebase(e.cut.path, (e.item as number[])) }, nested: e.flows }];
  });
}
/** An item with nothing left: its own path and a zero remainder. It is whole on the page where it ends, and an empty box that holds its column on every page after. */
const isSpent = ( cut: Address) => cut.path.length === 1 && cut.px != null && cut.px.paint == null && cut.px.remaining <= 0;

/**
 * Mutate an (already hinted) clone into its continuation form — the start cut, by the address.
 * @param clone - a fresh clone of the top-level block, hints applied when composing.
 *   cut: `positions.js`' `{ path, word, px }`, resolved against `source` and mapped onto this clone through `cloneOf`. A bare path — a Class A cut, a start-edge Class C, a forced break — consumes everything standing before the box at every level and leaves the box and its successors untouched; this is the exact form of what a word approximated, since a wordless box standing just past a boundary shares its word position with the word after it and a resume by word removed it as spent when it had never been shown (*the cut resumes at the box*, 2026-09-14). A path plus a word is a Class B cut: the same descent, then the leaf's own already-shown words consumed inside it. A path plus px is a shell of the box the path names — preceding siblings at every level consumed whole, the box occupying exactly the leftover border-box height, following siblings continuing in flow; `px.paint` non-null is the painted shell of *the page edge is not a break point* (C10), where the page edge cut through the box's own extent, so the box keeps its whole self and is pulled up by the height already shown. Blank versus painted is a property of the cut, not of the box.
 *   remainderPx non-null (with `source`): a carried parallel flow, live rather than painted — the box's own leftover border-box extent, written only where the source declares a block size. See `applyCarriedRemainder`.
 *   forced: the page this continuation opens began at a forced break, so a bare path keeps the resumed box's block-start margin and its first-child chain's (§5.2). The page's fact, handed in by the caller that knows it — the driver's `cursor.forced`, the presentation's `pg.start.forced`.
 * @returns the fragment root — normally the clone, but the slice wrapper when the sliced box IS the top-level block. Callers must use the return value.
 */
export function mutateToContinuation(clone: Element, { cut = null, remainderPx = null, source = null, cloneOf = null, items = [], flows = null, rootPath = null, hollow = false, forced = false }: { cut?: Address|null; remainderPx?: number|null; source?: Element|null; cloneOf?: Map<Element,Element>|null; items?: ResumePath[]; flows?: ResumeNode[]|null; rootPath?: number[]|null; hollow?: boolean; forced?: boolean; } = {}): Element {
  let root = clone;
  const path = rootPath ?? (cut ? [cut.path[0]] : [0]);
  const mine = itemsOf(flows ?? flowsOf(items), path, source, cloneOf);
  // The items of a divided row stand before the place this cut resumes at, and are not spent: each has a place of its own, applied below.
  const keep: Set<Node> = new Set(mine.map((m) => m.itemClone));
  // A row a spanning cell's group reaches stands before the place too (the Gauge's rows: a `rowspan` makes the cells of every row it spans one row), and every cell in it is an item with a place of its own, so the row stays and its cells are cut below.
  for (const m of mine) if (m.itemClone.parentElement && m.itemClone.parentElement !== clone && /^TR$/i.test(m.itemClone.parentElement.tagName)) keep.add(m.itemClone.parentElement);
  if (divides(cut)) {
    const target = targetOf((cut as Address), source, cloneOf);
    if (!target) return clone; // a path the tree no longer answers: present the box whole rather than consume it blind
    if ((cut as Address).px != null) root = shellAt(clone, target, ((cut as Address).px as NonNullable<Address['px']>), keep, hollow);
    else {
      const chain = chainTo(clone, target);
      // Everything standing before the target leaves, at every level. Walked by sibling and never by index: the Compositor inserts `<br>`s and filler spans into a composed leaf, so a hint standing before the resume point is consumed with the rest rather than counted as a box.
      let el = clone;
      for (const step of chain) {
        for (const sib of inDisplayOrder(el, [...el.childNodes] as Element[])) {
          if (sib === step) break;
          if (keep.has(sib)) continue;
          putAway(sib, hollow);
        }
        el = step;
      }
      // Then by kind, and only inside the box the path names: *wordless means already shown* is sound where word order and line order are the same order, and nowhere else. A leaf is one such place; the other is a box that holds blocks, whose word cut falls at or inside a run of its lines (*the anonymous box is in the procession*, 2026-09-29) — everything standing before that word's text in document order, block children included, is before the cut, so consuming the box's first `word` words through its block children leaves them wordless and the structural pass puts them away, and nothing after the word is touched.
      if ((cut as Address).word != null) consumeLeadingWords(target, ((cut as Address).word as number), (cut as Address).char ?? 0, hollow);
      // The cut divides its ancestors (*the cut divides its ancestors*, 2026-09-29): the boxes a cut divides are the proper ancestors of the place it names, and nothing else, so the clone and the chain above the target are dressed and marked as divided. A Class B cut's place is inside the leaf, which is therefore divided too, and the inline chain inside it is `consumeLeadingWords`' own. A bare path's place is before the target, which is therefore whole: it keeps its border, padding and indent, and gives up only the margin adjoining the break, with its first-child chain through which that margin collapses (§5.2).
      truncateLeadingDecoration(clone);
      for (let a = target.parentElement; a && a !== clone; a = a.parentElement) truncateLeadingDecoration(a);
      /** The margin after a forced break is preserved, at every depth (*the margin after a forced break is preserved*, 2026-09-29). css-break-3 §5.2: *"When a forced break occurs there, adjoining margins before the break are truncated, but margins after the break are preserved."* The margin after the break is the resumed box's own block-start margin and its first-child chain's, which collapse into it — a negative one included, which is how a band is pulled into the page margin. The divided ancestors are not after the break: each began pages ago, so each still gives up its margin, and under `slice` its border and padding. Whether the break was forced is a fact about the page, not the address — the account entry's `trace.forced`, the driver's `cursor.forced` — so it arrives here as `forced`, from both callers, and the measure and the presentation agree page for page. */
      if ((cut as Address).word == null) {
        if (!forced) truncateAdjoiningMargin(target);
      } else truncateLeadingDecoration(target);
    }
    // A table the cut divides keeps its header's copy, and the copy joins the rows as Chromium prints them; such a table stands on the cut's chain, the only place its copy can be.
    for (let a = (target as Element | null); a; a = a === clone ? null : a.parentElement) {
      for (const g of a.childNodes) if (/^THEAD$/i.test((g as Element).tagName ?? '') && hasWord((g as Element), ARTIFACT)) liftRepeatedHeader((g as HTMLElement));
    }
  } else if (remainderPx != null) {
    // A carried flow resuming at its own start: no box is divided, and it is still a continuation — its start edge was drawn on the page before (§5.2).
    truncateLeadingDecoration(clone);
  }
  if (remainderPx != null && source) applyCarriedRemainder((clone as HTMLElement), source, remainderPx);
  for (const m of mine) mutateToContinuation(m.itemClone, { cut: m.cut, remainderPx: m.e.remainingPx ?? null, source: m.itemSource, cloneOf, flows: m.nested, rootPath: m.e.item, hollow });
  numberDividedLists(root, cut, source, cloneOf);
  return root;
}

/** The list items an `<ol>` owns, in tree order: HTML's list owner is the nearest `ol`, `ul` or `menu` ancestor. An item that is not displayed as a list item has no ordinal, where a style can be read. */
function ownedItems(ol: Element): Element[] {
  const out: Element[] = [];
  (function walk(el: Element) {
    for (const c of el.children) {
      if (/^(?:OL|UL|MENU)$/i.test(c.tagName)) continue;
      if (/^LI$/i.test(c.tagName)) {
        const display = sourceStyle(c)?.display;
        if (display == null || display.includes('list-item')) out.push(c);
      }
      walk(c);
    }
  })(ol);
  return out;
}

/**
 * The ordinal value of each item an `<ol>` owns, as HTML numbers them (§4.4.8) and css-lists-3 states it as the `list-item` counter: the list resets the counter one step before its `start`, which under `reversed` defaults to the number of items; each item adds its step, 1 or −1 under `reversed` unless a `counter-increment` names `list-item`, and a `counter-set` of `list-item`, or else a `value` attribute, sets it.
 *
 * @remarks A `counter-reset` of `list-item` on an item is left out on purpose: Chromium's print numbers the markers on through it, its ordinals HTML's and not the reset counter's (measured 2026-11-07, `test/browser/list-continuation.browser.ts`), so the `start` this ordinal becomes is the browser's own number for the item.
 */
export function listOrdinals(ol: Element): Map<Element,number> {
  const items = ownedItems(ol);
  const reversed = ol.hasAttribute('reversed');
  const dflt = reversed ? -1 : 1;
  const start = parseInt(ol.getAttribute('start') ?? '', 10);
  let n = (Number.isFinite(start) ? start : reversed ? items.length : 1) - dflt;
  const out = new Map<Element,number>();
  for (const li of items) {
    const style = sourceStyle(li);
    const named = (value: unknown, fallback: number) => pairsOf(value, fallback).find(([name]) => name === 'list-item')?.[1];
    n += named(style?.counterIncrement, 1) ?? dflt;
    const value = parseInt(li.getAttribute('value') ?? '', 10);
    const set = named(style?.counterSet, 0) ?? (Number.isFinite(value) ? value : null);
    if (set != null) n = set;
    out.set(li, n);
  }
  return out;
}

/**
 * Every `<ol>` (or numbered `<ul>` or `<menu>`) a cut divides is numbered from the first item its piece keeps: the piece's copy carries a `start` attribute of that item's ordinal, so the browser's own marker counts on from the source's numbering. Without it a continued list numbered from 1 again on every page, and the first piece of a `reversed` list counted down from the items it kept (measured 2026-11-07 against Chromium's print, `test/browser/list-continuation.browser.ts`). Read from the source, so it holds whichever cut ran first.
 */
function numberDividedLists(root: Element, cut: Address|null, source: Element|null, cloneOf: Map<Element,Element>|null) {
  if (!divides(cut) || !source || !cloneOf) return;
  const target = elAtIn(source, (cut as Address).path);
  for (let a = target?.parentElement ?? null; a; a = a === source ? null : a.parentElement) {
    if (!/^(?:OL|UL|MENU)$/i.test(a.tagName)) continue;
    const copy = cloneOf.get(a);
    if (!copy) continue;
    for (const [li, n] of listOrdinals(a)) {
      const c = cloneOf.get(li);
      if (!c || !root.contains(c) || hasWord(c, AWAY)) continue;
      // HTML's `start` belongs to `<ol>` alone, and Chromium's marker ignores a `counter-reset` of `list-item` (both measured 2026-11-08), so a `ul` or `menu` continues by the first kept item's own `value`.
      if (/^OL$/i.test(a.tagName)) copy.setAttribute('start', String(n));
      else c.setAttribute('value', String(n));
      break;
    }
  }
}

/** The shell branch of the start cut: the box the path names continues at exactly the extent it has left, blank or painted. */
function shellAt(clone: Element, target: Element, px: NonNullable<Address['px']>, keep: Set<Node> = new Set<any>(), hollow: boolean = false): Element {
  const painted = px.paint != null;
  const chain = chainTo(clone, target);
  {
    let el = (clone as HTMLElement);
    // Ancestors along the chain are dressed as continuations. The sliced box itself is not: its own top decoration was painted on the page before and rides above the clip, so truncating it here would draw the border twice — it is marked `split start` instead (`markShelled`), divided and yet dressed as the box's beginning.
    if (!(painted && chain.length === 0)) truncateLeadingDecoration(el);
    else markShelled(el);
    for (let i = 0; i < chain.length; i++) {
      const step = chain[i];
      for (const sib of inDisplayOrder(el, [...el.childNodes] as Element[])) {
        if (sib === step) break;
        if (keep.has(sib)) continue;
        putAway(sib, hollow);
      }
      el = (step as HTMLElement);
      if (!(painted && i === chain.length - 1)) truncateLeadingDecoration(el);
      else markShelled(el);
    }
    if (!painted) {
      // The blank shell: no children (their margins adjoin the cut and truncate per §5.2), no text, and the leftover border-box height the cut arithmetic assumed — a floor rather than the used height, since the box still wears the block-end padding and border a `slice` fragment draws on the box's last fragment, and those alone are the whole of a pure-padding end gap. That is what makes the page agree with Chromium's, and it is why `remainingPx` is read by the walk's progress test and by nothing that prints (*the end gap takes no extension*, 2026-09-15).
      el.replaceChildren();
      el.style.boxSizing = 'border-box';
      el.style.height = `${Math.max(0, px.remaining)}px`;
      el.style.minHeight = '0';
      // Its block-end padding is spent with the rest (`block-end-padding-taller-than-page`, assessment 2026-11-07): the shell has no content, so its padding paints exactly as the content box it gives way to, and the border box is the remainder alone. A padding taller than the page area otherwise held every shell at its own height, the remainder never shrank, and the walk refused. A box that clones its decoration wears its padding on every fragment, so it keeps it.
      if (!clonesDecoration(el)) el.style.setProperty('padding-bottom', '0', 'important');
      return clone;
    }
    // The painted shell: a slice wrapper takes the box's place in flow at exactly the leftover height and clips there; the box keeps its natural size — an image must never be resized into the remainder — and a negative top margin pulls the already-shown part above the clip.
    // `display: flow-root` is load-bearing, not decoration: `overflow` on the block axis does not establish a block formatting context (that is the whole point of `clip` over `hidden` — no scroll container), so without it the negative margin collapses straight out of the wrapper and drags the wrapper itself up by the same amount. Measured: wrapper top −280 instead of 0, and the walk stops advancing. `clip` over `hidden` still matters the other way — `hidden` would make the wrapper scrollable, which the monolith predicate reads.
    // The block axis alone, like every other fragmentation clip in this engine (*the page rendering clips at the bleed area*, 2026-09-18). What this wrapper hides is the part of the box shown on the page before, which lies above it; ink beside the box is the page's business and the page box is where it stops. Changed for consistency with the flow and the content area rather than for a document: no case here slices a box whose ink also hangs into the margin, and the record says so.
    const slice = el.ownerDocument.createElement('div');
    addWord(slice, SHELL); // the painted shell's wrapper (*the page edge is not a break point*, C10), self-identifying like the Compositor's own writes: a decision product, rendering-inert without CSS, and addressable by tooling
    slice.style.cssText = `box-sizing:border-box;display:flow-root;height:${Math.max(0, px.remaining)}px;overflow-x:visible;overflow-y:clip;`;
    const root = el === clone ? slice : clone;
    el.replaceWith(slice); // a no-op when el is the parentless clone — the wrapper becomes the root instead
    slice.appendChild(el);
    el.style.marginTop = `-${Math.max(0, (px.paint as number))}px`;
    el.style.marginBottom = '0';
    return root;
  }
}

/**
 * A clone of a top-level block for one interval, hollow outside it (*the clone is hollow outside the interval*, 2026-09-27) — the one construction behind the measure feed and every presented fragment, and the one place the clone-to-source map is filled.
 *
 * `start` and `end` are the interval's two cuts, `positions.js`' addresses, resolved on the source: at every level of the chain from the block down to each cut's box, the element siblings the chain leaves wholly before the start or wholly after the end are exactly the boxes the start cut and the end cut will put away, and they are built hollow here — an element with its tag and attributes and no children, concealed as `putAway` conceals one — rather than deep-cloned only to be emptied. Everything else is deep. So the map holds only elements that exist, and the work a page costs is the page's, not the block's.
 *
 * What the walks after it read is never hollowed here. The two cuts' own boxes and every box on their chains are built; a box that is, or holds, a row item with a place of its own (`items`) is deep, because that item's cut resolves inside it; and a bare end's own box, which leaves the fragment, is left to `putAway` to hollow after the walk that names it. Text nodes are copied and blanked by the cuts, as before.
 *
 * With `hollow` false — a stylesheet the document wears has a `:has(` selector (`capture.js`'s `sheetsUseHas`) — this is the deep clone and the whole map it always was.
 *
 * @param source - the block's source element, untouched.
 * @returns the clone, its elements registered against their sources in `into`.
 */
export function cloneInterval(source: Element, { start = null, end = null, items = [], hollow = false, into = new Map<any, any>() }: { start?: Address|null; end?: Address|null; items?: ResumePath[]; hollow?: boolean; into?: Map<Element,Element>; } = {}): Element {
  const startBox = hollow && divides(start) ? elAtIn(source, (start as Address).path) : null;
  const endBox = hollow && divides(end) ? elAtIn(source, (end as Address).path) : null;
  if (!startBox && !endBox) {
    return copyOf(source, into);
  }
  /** The box and every ancestor up to the block, on the source. */
  const chainOf = ( box: Element) => {
    const set: Set<Element> = new Set<any>();
    for (let e = (box as Element | null); e; e = e === source ? null : e.parentElement) set.add(e);
    return set;
  };
  const onStart = startBox ? chainOf(startBox) : new Set<any>();
  const onEnd = endBox ? chainOf(endBox) : new Set<any>();
  const guarded: Set<Node> = new Set<any>();
  for (const e of items) {
    const itemBox = elAtIn(source, (e.item as number[]));
    if (itemBox) for (const a of chainOf(itemBox)) guarded.add(a);
  }
  // Every copy is made by `word-space.js`' one point (*a copy may be presented*): a shell or a deep copy of a presented source is the host's element, and the caller uses what comes back.
  const register = ( s: Element) => {
    const c = shellOf(s);
    into.set(s, c);
    return c;
  };
  const deep = ( s: Element) => copyOf(s, into);
  const hollowOf = ( s: Element) => {
    const c = register(s);
    conceal(c, true);
    return c;
  };
  const stepOf: (s: Element,chain: Set<Element>,box: Element|null) => Element|null = (s, chain, box): Element|null => (chain.has(s) && s !== box ? [...s.children].find((k) => chain.has(k)) ?? null : null);
  const build: (s: Element) => Element = (s): Element => {
    const c = register(s);
    const startStep = stepOf(s, onStart, startBox);
    const endStep = stepOf(s, onEnd, endBox);
    // Before, in or after the interval is asked in display order (*the-word-space-follows-the-table-display-order*), and the copy keeps the order written.
    const phases = new Map<Node, string>();
    let phase = startStep ? 'before' : 'in';
    for (const node of inDisplayOrder(s, [...s.childNodes] as Element[])) {
      if (node === startStep) phase = 'in';
      phases.set(node, phase);
      if (node === endStep) phase = 'after';
    }
    for (const node of s.childNodes) {
      const phase = phases.get(node);
      let out;
      if (node.nodeType !== 1) {
        out = node.cloneNode(false);
        if (node.nodeType === 3) noteText((out as Text), (node as Text)); // a text on the chain is registered like the deep ones (*the engine names the source point*)
      }
      else if (node === startStep || node === endStep) out = build((node as Element));
      else if (phase !== 'in' && !guarded.has(node) && !repeatedGroup((node as Element))) out = hollowOf((node as Element));
      else out = deep((node as Element));
      c.appendChild(out);
    }
    return c;
  };
  return build(source);
}

/**
 * A copy of a flow block, ready to be measured or presented: the one prelude every site that copies a piece of the flow runs, so that *a fixed box has zero footprint at any depth* cannot depend on a site remembering it.
 *
 * @remarks
 * The steps, in this order: the clone (`cloneInterval`, deep inside the interval and hollow outside it), the clone-to-source map filled as it is built, the fixed boxes taken out, and, when a `composition` is given, the cached hints applied. The map comes first because it is what lets the strip ask the source whether a box is fixed, and the strip comes before the hints and the consumption so that a fragment consumes in the word space `indexBlocks` counted. A caller that cuts the clone's tail before the hints (the feed's `cutCloneAt`) passes no `composition` and applies the hints itself, after its cut.
 *
 * One order at every site. `applyRecordsUnder` pairs each box of the clone with the source it was copied from (`sourceOf`), so a box the strip took out cannot shift the pairing; until 2026-10-17 it paired by child index, and `root.js` alone hinted first to keep the indices true (CHANGELOG 2026-10-17).
 * @param source - the block's source element, untouched.
 * @param opts - `into` is filled and returned as `cloneOf`; the rest is `cloneInterval`'s, with the composition whose hints are applied.
 * @returns the clone and the map from each source element to its copy.
 */
export function cloneFlowPiece(source: Element, { composition = null, into = new Map<any, any>(), ...interval }: { start?: Address|null; end?: Address|null; items?: ResumePath[]; hollow?: boolean; into?: Map<Element,Element>; composition?: Map<Element,CompositionRecord>|null; } = {}): { clone: Element; cloneOf: Map<Element,Element>; } {
  const clone = cloneInterval(source, { ...interval, into });
  stripFixedBoxes(clone);
  if (composition) applyRecordsUnder(clone, source, composition);
  return { clone, cloneOf: into };
}

/**
 * Build a continuation fragment of a top-level block: hints first (when composing), continuation mutation after — the continuation keeps exactly the remaining subset of the same chosen lines (*cut-invariance*, C7).
 * @param source - the block's source element, untouched.
 *
 * `tracks`: the page's measured tracks for this block (`pinTracks`), written after the cuts.
 */
export function continuationClone(source: Element, { cut = null, remainderPx = null, composition = null, items = [], hollow = false, forced = false, tracks = [], extents = [] }: { cut?: Address|null; remainderPx?: number|null; composition?: Map<Element,CompositionRecord>|null; items?: ResumePath[]; hollow?: boolean; forced?: boolean; tracks?: Track[]; extents?: Extent[]; } = {}): Element {
  // Mapped as it is built, in both directions: a detached clone cannot be asked what its display is, and the address is resolved on the source and mapped across rather than followed on a tree the hints are about to change.
  const { clone, cloneOf } = cloneFlowPiece(source, { start: cut, items, hollow, composition });
  const root = mutateToContinuation(clone, { cut, remainderPx, source, cloneOf, items, hollow, forced });
  pinTracks(source, cloneOf, tracks);
  pinExtents(source, cloneOf, extents);
  return root;
}

/**
 * Mutate an (already hinted) clone into its first fragment form — the dual of `mutateToContinuation`, step for step (*the first fragment is constructed*, 2026-09-15).
 *
 * The straddling box's first fragment used to be the original, assigned to the page where it begins and clipped by the flow at the cut. That could never deliver §5.3's extension, because a box's ink and its own overflow content are one subtree: a clip moved to the page area's edge admits the next page's first line along with the background, which four sound documents proved by losing words to it. Once the words after the cut are not in the tree at all, the extension is safe and is one number.
 *
 * @param clone - a fresh clone of the top-level block, hints applied when composing.
 *   cut: the page's closing address, the mirror of the continuation's opening one. A px cut fell in the end gap of the box the path names: the box keeps its whole content and everything after it leaves, its remainder continuing on the next page as the shell. A word cut fell at that word of the leaf the path names: everything after the leaf leaves, then the leaf's own words from there. A bare path is a boundary before the box it names: the box and everything after it leave, exactly as the measure feed already cuts a forced break, and the box the cut divides is therefore the box's parent — which is what a boundary between two siblings divides, and what the Stonehand already charged §5.3's room against.
 *   extPx: §5.3's extension, the fragmentainer extent this fragment's content box grows into, delivered as block-end padding on the innermost divided box of the main path and of every divided row item (2026-10-08: the recursion into the items passes it on). The account's own arithmetic (`contentH − usedPx − cost`); nothing is measured here. Nesting does the rest: an ancestor wraps its child, so one assignment per flow is every divided box of it. The items' own reach to the foot, where a row is cut at a height above it, is `pinExtents`, from a number the feed measured.
 * @returns the clone.
 */
export function mutateToFirstFragment(clone: Element, { cut = null, extPx = 0, source = null, cloneOf = null, items = [], flows = null, rootPath = null, hollow = false }: { cut?: Address|null; extPx?: number; source?: Element|null; cloneOf?: Map<Element,Element>|null; items?: ResumePath[]; flows?: ResumeNode[]|null; rootPath?: number[]|null; hollow?: boolean; } = {}): Element {
  let inner = clone;
  // A row's other items stand before the place this cut ends at, so the truncation below leaves them whole; each is ended at its own place. One wholly shown is left alone, and one the page never reached is emptied and keeps its column.
  for (const m of itemsOf(flows ?? flowsOf(items), rootPath ?? (cut ? [cut.path[0]] : [0]), source, cloneOf)) {
    if (isSpent(m.cut)) continue;
    if (!divides(m.cut)) m.itemClone.replaceChildren();
    else mutateToFirstFragment(m.itemClone, { cut: m.cut, extPx, source: m.itemSource, cloneOf, flows: m.nested, rootPath: m.e.item, hollow });
  }
  if (divides(cut)) {
    const target = targetOf((cut as Address), source, cloneOf);
    if (!target) return clone; // a path the tree no longer answers: keep the fragment whole rather than cut it blind
    if ((cut as Address).px != null) {
      inner = target;
      truncateFrom(clone, target, { keep: true, hollow });
    } else if ((cut as Address).word != null) {
      truncateFrom(clone, target, { keep: true, hollow });
      inner = consumeTrailingWords(target, ((cut as Address).word as number), (cut as Address).char ?? 0, hollow) ?? target;
    } else if (target !== clone) {
      const divided = target.parentElement;
      truncateFrom(clone, target, { hollow });
      inner = divided ?? clone;
    }
  }
  // The fragment ends at the cut, so the top-level block's own block-end decoration is the cut's, exactly as the continuation's start edge is.
  truncateTrailingDecoration(clone);
  /**
   * §5.3's extension, delivered. *"When a box breaks, its content box extends to fill any remaining fragmentainer extent (leaving room for any margins/borders/padding applied by `box-decoration-break: clone`)."*
   *
   * Block-end padding on the innermost divided box, and every ancestor grows by wrapping its child. Under `slice` the padding the words sheet zeroes for a cut-off box becomes exactly the extension, written inline and `!important` so that it outranks that sheet; under `clone` the box keeps its own block-end padding and the extension is added on top of it, since that padding is drawn at this fragment's edge too and the Stonehand already charged the cut for it. No wrapper enters the author's tree and no element is measured at present time — a wrapper would change `>` and `:nth-child` matching for every child of every divided block, and a measurement here would be a fact derived from a tree the driver never saw.
   */
  if (extPx > 0) {
    const own = clonesDecoration(inner) ? parseFloat((sourceStyle(inner)?.paddingBottom as string)) || 0 : 0;
    // `!important`, inline: the words sheet zeroes a cut-off box's bottom padding in a layer, and an element-attached important declaration is the one thing that outranks a layer (css-cascade-5 §6.4.1). A plain object tree, as the DOM-free suites feed, takes the bare property.
    if (typeof (inner as HTMLElement).style.setProperty === 'function') (inner as HTMLElement).style.setProperty('padding-bottom', `${own + extPx}px`, 'important');
    else (inner as HTMLElement).style.paddingBottom = `${own + extPx}px`;
  }
  /** And the cut line stays justified. css-text-3 §7.2 says a line before a forced or fragmentation break is not the last line of its block, so `text-align: justify` binds it — but in a clone cut AT the break it is the last line and the browser would set it ragged. The alignment is restated rather than inherited, and it is read from the source through the word space's map, because a detached clone has no computed style to ask. The Compositor makes the same move for the same reason (`compose-dom.js`), which is what makes this the engine's one answer written twice for two different line providers rather than two answers. */
  if (sourceStyle(inner)?.textAlign === 'justify') (inner as HTMLElement).style.textAlignLast = 'justify';
  numberDividedLists(clone, cut, source, cloneOf);
  return clone;
}

/**
 * Build the first fragment of a top-level block the page's closing cut divides: hints first (when composing), first-fragment mutation after — `continuationClone`'s mirror, step for step, so the two halves of one divided box are built by one implementation and cannot disagree about where the boundary was.
 * @param source - the block's source element, untouched.
 */
export function firstFragmentClone(source: Element, { cut = null, extPx = 0, composition = null, items = [], hollow = false, tracks = [], extents = [] }: { cut?: Address|null; extPx?: number; composition?: Map<Element,CompositionRecord>|null; items?: ResumePath[]; hollow?: boolean; tracks?: Track[]; extents?: Extent[]; } = {}): Element {
  const { clone, cloneOf } = cloneFlowPiece(source, { end: cut, items, hollow, composition });
  mutateToFirstFragment(clone, { cut, extPx, source, cloneOf, items, hollow });
  pinTracks(source, cloneOf, tracks);
  pinExtents(source, cloneOf, extents);
  return clone;
}

/**
 * A fragment holds exactly its interval (*every branch gets a place*, 2026-09-21) — one construction with two optional ends.
 *
 * The middle of a block spanning three pages both resumes and ends, and until this it was built by the start cut alone: a clone of the block's whole remainder with its tail hidden under the flow's clip. The tail was in every count — CSS counters, Caster's partition, `packages/essay/lib/census.js` — and on the page too, wherever the cut did not happen to fall on a line boundary (`packages/essay/probes/conservation.js`'s placed grid printed a line on two pages). Built by both cuts, the tail is not in the tree, so the fragment takes §5.3's extension and its clip may stand at the page area's edge, exactly as a first fragment's does.
 *
 * The end is cut first. Both cuts are resolved on the source and reach this clone through one map, so neither disturbs the other's target — but a word is leaf-relative in source coordinates, and where both cuts fall in one line stack the start cut blanks the words before it, which would shift every index the end cut counts by. Taken from the end first, both count into the leaf as the source wrote it.
 *
 * A painted start is left to its slice: a monolith the page edge slices keeps its wrapper at both ends, and that clip is the slicing itself, not a tail.
 * @param source - the block's source element, untouched.
 */
export function fragmentOf(source: Element, { start = null, end = null, startItems = [], endItems = [], remainderPx = null, extPx = 0, composition = null, hollow = false, forced = false, tracks = [], extents = [] }: { start?: Address|null; end?: Address|null; startItems?: ResumePath[]; endItems?: ResumePath[]; remainderPx?: number|null; extPx?: number; composition?: Map<Element,CompositionRecord>|null; hollow?: boolean; forced?: boolean; tracks?: Track[]; extents?: Extent[]; } = {}): Element {
  const ends = divides(end) && start?.px?.paint == null;
  const { clone, cloneOf } = cloneFlowPiece(source, { start, end: ends ? end : null, items: [...startItems, ...endItems], hollow, composition });
  if (ends) mutateToFirstFragment(clone, { cut: end, extPx, source, cloneOf, items: endItems, hollow });
  const root = mutateToContinuation(clone, { cut: start, remainderPx, source, cloneOf, items: startItems, hollow, forced });
  pinTracks(source, cloneOf, tracks);
  pinExtents(source, cloneOf, extents);
  return root;
}

