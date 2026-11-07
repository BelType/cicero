/// <reference lib="dom" />
/**
 * THE ADDRESS of a cut, and the flat position it projects onto (the streamline round, 2026-08-19, amended by [*the cut is a place in the tree*](../../../.claude/decisions/cicero/the-cut-is-a-place-in-the-tree.md), 2026-09-18; architecture: The Ledger).
 *
 * **Paths order boxes; words order lines** — *a resume point is a path* (I2) in its own words. A cut's address is
 *
 *     { path: number[], word: number|null, px: { remaining: number, paint: number|null }|null }
 *
 * `path` is the source child-index path to the box the page resumes at, `[blockIndex, ...in-flow element-child indices]` — a `position: fixed` box is not counted, for the reason `inFlowChildren` below states and measured rather than assumed. `word` is the leaf-relative count of words already shown, non-null inside a line stack and only there. `px` is what a box divided geometrically has left: a cut in a container's block-end gap leaves `remaining` and no paint, the page edge's own cut (*the page edge is not a break point*, C10) leaves both. By class: a Class A cut, a start-edge Class C and a forced break take a bare path; a Class B takes a path plus `word`; an end-gap Class C and the edge cut take a path plus `px`.
 *
 * **A cut names a place in the tree, and the boxes it divides are the proper ancestors of that place, and nothing else** ([*the cut divides its ancestors*](../../../.claude/decisions/cicero/the-cut-divides-its-ancestors.md), 2026-09-29). A box carries its start decoration on a page when the page's opening cut does not divide it, and its end decoration when the closing cut does not; margins adjoining the cut are truncated (css-break-3 §5.2). Each class is a consequence: a Class A cut and a forced break name the place before a box, so that box is whole and only its ancestors are divided; a start-edge Class C names the place between a box's content edge and its first in-flow child, so the box itself is divided; a Class B and an end-gap Class C name a place inside the box, which is divided. The class never enters the dressing — it says only whether the place exists.
 *
 * **A run of lines beside block children is addressed by its container** ([*the anonymous box is in the procession*](../../../.claude/decisions/cicero/the-anonymous-box-is-in-the-procession.md), 2026-09-29). The Gauge reads such a run as an anonymous block box, which has no element and so no path: a place inside a run, or before a run that follows a block child, is the container's path plus a `word` in the container's joined-word space; the place after a leading run is the bare path to the first block child, whose trailing zero is then a place and is kept (below). `cutAfter` orders such a word against a path inside the same container by the flat projection, the one coordinate that says which children the run follows.
 *
 * **A trailing zero collapses where no gap stands there, and no run** (`normalizePath`). Before a first child is the same place as before its parent in the word space, and in the geometry too wherever nothing stands between the parent's content edge and that child — which is every Class A point, and a forced break. So a cut that normalises to `[b]` alone is a block boundary: the closing page's interval ends before block `b`, and block `b` presents whole on the next page as its original, its own leading edge drawn there. Carrying `[b, 0]` for such a cut dresses as cut-through a block that was never cut, which moved native seeds 71 and 173 off Chromium's own cuts ([*the cut resumes at the box*](../../../.claude/decisions/cicero/the-cut-resumes-at-the-box.md)). A start-edge Class C is the one place where a gap does stand there — it exists only when one does — so its path is minted unnormalised and keeps its zero: `[…X, 0]` divides X, the page before ends inside X showing its border and padding, and the page after resumes X stripped with its first child whole.
 *
 * **The path is the wire form; identity is the working form.** The account crosses a `page.evaluate` boundary in every runner and a live pointer cannot, so an address is plain JSON. `elAt` and `pathOf` below resolve it, and they touch only `.children` and `.parentElement`, so the DOM-free suites can feed them object trees. A clone is reached through `word-space.js`' clone-to-source map and never by following an index on it: the Compositor inserts `<br>`s and filler spans, and a fixed sibling counted by one builder and filtered by another would build a shell on the box next door (`packages/essay/cases/55-the-shell-behind-the-fixed-box`).
 *
 * **The flat position is the projection**: `wordsBefore(elAt(path)) + (word ?? 0)`, or the divided box's own end where the cut fell in its block-end gap. It is the global word index `bases[b] + w`, where `bases` is the prefix sum of per-block word counts in the word space (fragments.js `joinedWords`: maximal non-whitespace runs of the block's joined text — the same tokenization the Gauge reads and the essay package's generator declares; the differential's totality gate pins the equivalence per block, every seed). A page is the interval between two consecutive entry positions, and it is what *flow is forward* (I1) orders the Ledger by. **It is not, alone, what a page holds** (beltype#43, 2026-10-15): beside a parallel flow, document order and page membership part, and a page holds its interval's words and the remainders its opening cut carries in, less the remainders its closing cut carries out (`remaindersOf`). That membership is what a named string's assignments and a counter at the start of a page are read against, and what `pageOf` answers from. Ordering is the position first — ledger.js's `comparePos` — and the address second, `pathAfter` in the driver, which is what tells two wordless boxes at one word position apart.
 *
 * The index is built once per `paginate()` over the untouched source blocks and answers every offset query without walking clones (see CHANGELOG 2026-08-20): words-before-element and word-count-of-element are O(1) map lookups, block-of-position a binary search over `bases`. **One identity survives the address and the driver relies on it where it mints a Class B `word`:** the Gauge reads a clone, and a leaf that straddled in from the previous page has had its leading words consumed, so a word index counted on that clone is the source-absolute index shifted by the consumption — `max(startWord, wordsBefore(sourceEl))` is the source-absolute base for anything at or after a continuation's resume point. The `word` an address carries is leaf-relative in source coordinates, so a fresh clone consumes exactly it.
 *
 * Boundary semantics (see CHANGELOG 2026-08-20): **the word space under-determines block seams wherever a block has no words.** A plate image is zero-words with two pages of geometry, and at its seam three distinct addresses — before it, slicing it, after it — share one `gi` (case 04). That is the whole reason the address exists and the whole reason it is carried rather than derived. `blockOf`/`split` below are arithmetic fallbacks for consumers holding a bare position and no address (probes, tooling): they resolve a seam `gi` to the first block whose word range contains it, which is correct wherever blocks have words and a documented approximation where they don't.
 *
 * **The character refinement is minted** ([*a line inside a word is a break point*](../../../.claude/decisions/cicero/a-line-inside-a-word-is-a-break-point.md), 2026-09-23): inside a line stack the coordinate is a word and, where a line box begins inside that word at a silent break, a `char` — an offset in UTF-16 code units into it, present only when non-zero, ordered after the word by `cutAfter`. The flat position does not carry it: a page that resumes inside word *w* projects to *w*, so `comparePos` and everything read against the projection stand as they were. **A word divided at a soft hyphen is divided too** ([*the hyphen is written at the cut*](../../../.claude/decisions/cicero/the-hyphen-is-written-at-the-cut.md), 2026-10-06): the `char` is the character after the soft hyphen and the first fragment writes the hyphen the browser drew; the Compositor's own break inside a word is named at the character its record gave, in the source's own characters, before the soft hyphen its `<br>` leaves at the head of the next line. A word the browser hyphenated between two letters under `hyphens: auto` is still never divided: no character of the source says where.
 *
 * **The record is a tree, and the flat list is its projection** (*a parallel flow is a fragmentainer*, 2026-10-08; the tablet's *a resume point is a path* (I2) as amended in that round). An entry's resume record is its main path and, under every box the cut passes through that holds parallel flows, one node per flow, recursively — the shape of a Blink break token's child tokens. `ResumeNode` below is the tree, `flattenResume` and `flowsOf` / `treeOf` the two directions between it and the wire form the account, the ledger and every `page.evaluate` boundary keep, and both are pure arithmetic over plain objects. The wire order is the main path first and every other node in post-order: a node's own `cut` is the last place of the flow it speaks for, so the places that stand before it — a row's earlier items — precede it, which is document order and what the driver has always written.
 *
 * @packageDocumentation
 */

/** The address, as a type — the shape the header above states and nothing more. Plain JSON, so it crosses a `page.evaluate` boundary whole. */
export type Address = {
  /** The source child-index path to the box the page resumes at: `[blockIndex, ...in-flow element-child indices]`. */
  path: number[];
  /** The leaf-relative count of words already shown; non-null inside a line stack and only there. */
  word: number | null;
  /** Characters of word `word` already shown, where a line box begins inside it — at a silent break, or after a soft hyphen the browser drew; absent when zero. */
  char?: number;
  /** What a box divided geometrically has left; `paint` is non-null for the page edge's own cut (*the page edge is not a break point*, C10) alone. */
  px: { remaining: number, paint: number | null } | null;
};

import type { ResumePath } from './ledger.ts';
import type { Keep } from './forcing-memo.ts';

/** THE RESUME TREE — an entry's record as the nested object it is (*a resume point is a path*, I2, amended 2026-10-08). A node is one flow's place, and its `flows` are the places of the parallel flows that stand inside the box it resumes in: the earlier items of a divided row, the cells of a divided cell, a float nested in a block the cut passes through. The root is the main flow's, which bounds the interval and orders the ledger; every other node is a parallel flow's, live on the next page. The wire form is `flattenResume(tree)` and the inverse of it is `treeOf(paths)`. */
export type ResumeNode = {
  /** Where this flow resumes. */
  cut: Address;
  /** The flat projection of `cut` (a position in the document's word space). */
  pos: number;
  /** The deepest straddler, a live pointer. Opaque here: this module is DOM-free. */
  box?: unknown;
  /** The geometric remainder of a flow that declares a block size, or of an item the row stretches; `null` where the flow's own top lies below the cut. */
  remainingPx?: number | null;
  /** The path of the row item this node speaks for; absent on the main flow and on a float, which is what tells them from an item. */
  item?: number[];
  /** The class of this flow's cut, where its own walk chose one (*a parallel flow is a fragmentainer*, 2026-10-08): the verdict an item or a float was given at the page's height. The entry's `cls` stays the main path's; a node a verdict did not make — a spent item, one wholly below the height — carries none. */
  cls?: CutClass;
  /** What that cut could not satisfy, in the entry's own trace shape. */
  trace?: { kind?: string, violates?: object, k?: number, y?: number };
  /** The parallel flows standing inside this node's box, in the order their places stand before `cut` in document order. */
  flows: ResumeNode[];
};

import { BREAKING_SPACE, inDisplayOrder, isFixedBox, isInlineBox, isLineBreak } from './word-space.ts';
import type { CutClass } from './ledger.ts';

/** One end of a page's interval, as {@link pageIntervals} writes it: the account's own address and the `{ b, w }` it decomposes to. */
export type Endpoint = {
  /** The account's address. */
  cut: Address;
  /** The block, `cut.path[0]`. */
  b: number;
  /** The word within block `b`. */
  w: number;
  /** The parallel flows the cut carries, as the account entry holds them. */
  carried: ReadonlyArray<{ pos: number, cut: Address, item?: number[] }> | null;
  /** The words behind the cut its flows have not shown yet, block-relative ({@link remaindersOf}). */
  away: { b: number, from: number, to: number }[];
  /** The page that opens here began at a forced break. */
  forced?: boolean;
};

/** `outer` is a proper prefix of `inner`: the row item at `outer` holds the one at `inner`. */
const holds = ( outer: number[],  inner: number[]) => outer.length < inner.length && outer.every((n, i) => n === inner[i]);

/**
 * The flows of a main path, read off the wire form — the inverse of {@link flattenResume} for everything beside the root (*a parallel flow is a fragmentainer*, 2026-10-08). `paths` is the list without the main path: a row item belongs to the nearest item whose path holds its own, a float adopts the top-level items that stand before it since the last float, and the top-level items left at the end belong to the main flow. The first rule is containment and holds in any order; the other two are the wire's grouping, which the post-order of {@link flattenResume} makes unambiguous.
 *
 * @param paths - the list beside the main path.
 * @returns the root's `flows`.
 */
export function flowsOf(paths: ReadonlyArray<ResumePath>): ResumeNode[] {
  const nodes: ResumeNode[] = paths.map((p) => ({ ...p, flows: [] }));
  const items = nodes.filter((n) => n.item);
  const held: Set<ResumeNode> = new Set<any>();
  for (const n of items) {
    let owner: ResumeNode|null = null;

    for (const m of items) if (m !== n && holds((m.item as number[]), (n.item as number[])) && (!owner || (m.item as number[]).length > (owner.item as number[]).length)) owner = m;
    if (owner) { owner.flows.push(n); held.add(n); }
  }
  const floats: ResumeNode[] = [];
  let pending: ResumeNode[] = [];
  for (const n of nodes) {
    if (held.has(n)) continue;
    if (n.item) pending.push(n);
    else { n.flows = pending; pending = []; floats.push(n); }
  }
  return [...floats, ...pending];
}

/** The tree an entry's `paths` project (*a parallel flow is a fragmentainer*, 2026-10-08): `paths[0]` is the main flow's, the rest are its flows. `null` for the terminal entry, whose `paths` is empty. */
export function treeOf(paths: ReadonlyArray<ResumePath>): ResumeNode|null {
  if (paths.length === 0) return null;
  return { ...paths[0], flows: flowsOf(paths.slice(1)) };
}

/**
 * The wire form of a resume tree: the main path first, then every other node in post-order (a node's `flows` before the node). The fields a node carries are the fields the path carries — `flows` is the only thing left behind — so the list is what the driver has always written and `createEntry` checks.
 *
 * @returns empty for no tree, which is the terminal entry.
 */
export function flattenResume(tree: ResumeNode|null|undefined): ResumePath[] {
  if (!tree) return [];
  const post: (n: ResumeNode) => ResumePath[] = ({ flows, ...path }): ResumePath[] => [...flows.flatMap(post), path];
  const { flows, ...main } = tree;
  return [main, ...flows.flatMap(post)];
}

/** The address, resolved and compared. Six small functions, all of them pure and all of them touching nothing but `.children`, `.parentElement` and plain arrays — so the DOM-free suites feed them object trees, and so a realm that holds only an account can still say which cut comes first. */

/**
 * A box's in-flow element children — what a path's indices count — in display order, which differs from the order written inside a table alone (`word-space.js`' `inDisplayOrder`; *the-word-space-follows-the-table-display-order*, 2026-11-07): a header group written after its rows is a table's child 0, so paths order a table's boxes as its words are ordered.
 *
 * **A `position: fixed` box is not among them, and that is the only exclusion.** Its footprint is zero at any depth (CSS 2.1 §9.6.1, *a fixed box at any depth*), so it is in no flow, no word space, no feed and no presentation — and the address is the flow's own coordinate, so it is in no path either. That is also the only reading that resolves in every tree a path is resolved in, which is a stronger argument than the principle and was measured rather than assumed: the feed's clones have had fixed boxes stripped, the presentation's clones likewise, and the source is not one tree — `root.append(...blocks, ...fixed)` at intake reparents a nested fixed box out of the block it was declared in, so the tree the driver builds a path against and the tree the presentation resolves it against differ by exactly those boxes. Filtering makes the index the same number in all three; counting them raw made it right in one and wrong in the others, which is what put a shell on the box next door (`packages/essay/cases/55-the-shell-behind-the-fixed-box`).
 */
const inFlowChildren = ( el: Element,  isFixed: (el: Element) => boolean) => inDisplayOrder(el, [...(el.children ?? [])].filter((c) => !isFixed(c)));

/** The box a path names, descending from the top-level block it starts at. `null` where the tree no longer answers the path, which is an edited document rather than a defect. */
export function elAtIn(blockEl: Element|null|undefined, path: number[], isFixed: (el: Element) => boolean = isFixedBox): Element|null {
  let el = blockEl ?? null;
  for (let i = 1; i < path.length && el; i++) el = inFlowChildren(el, isFixed)[path[i]] ?? null;
  return el;
}

/** The box a path names, against the document's top-level blocks. */
export const elAt = ( blocks: ArrayLike<Element>|null|undefined,  path: number[], isFixed = isFixedBox) => elAtIn(blocks?.[path[0]] ?? null, path, isFixed);

/** An element's index among its parent's in-flow children — the number one level of a path holds. */
export const inFlowIndex = ( el: Element, isFixed = isFixedBox) => inFlowChildren((el.parentElement as Element), isFixed).indexOf(el);

/**
 * The source child-index path from `blockEl` (index `b`) down to `el`, counting in-flow children alone. The inverse of `elAtIn`.
 *
 * @param indexOf - each level's index, which the forcing index's memo answers from a `WeakMap` (*the forced-break index is kept across runs*, 2026-10-09) where the default scans the parent's children.
 */
export function pathOf(el: Element, blockEl: Element, b: number, isFixed: (el: Element) => boolean = isFixedBox, indexOf: (e: Element) => number = (e) => inFlowIndex(e, isFixed)) {
  const path = [];
  for (let e = (el as Element | null); e && e !== blockEl; e = e.parentElement) path.unshift(indexOf(e));
  path.unshift(b);
  return path;
}

/** A bare path's normal form: trailing zeros dropped, because before a first child is the same place as before its parent wherever no gap stands between the parent's content edge and that child. Never applied to a path carrying a word or a pixel extent, where the last index names the box the cut is inside and dropping it would name its parent instead — nor to a start-edge Class C's, whose place exists only because a gap stands there (the header above). */
export function normalizePath(path: number[], mayDrop: (n: number) => boolean = ( n: number) => true) {
  let n = path.length;
  // `mayDrop(n)` says whether the zero at index `n − 1` is no place — false where a run of inline content stands before that first child in its parent, whose anonymous box makes before the child a place after a line (*the anonymous box is in the procession*, 2026-09-29; `driver.js`' `cutTo` asks the position index).
  while (n > 1 && path[n - 1] === 0 && mayDrop(n)) n--;
  return path.slice(0, n);
}

/** Lexicographic order over two paths; a shorter path is the earlier place, since a box's own start precedes everything inside it. */
export function pathAfter(a: ReadonlyArray<number>|null|undefined, b: ReadonlyArray<number>|null|undefined) {
  const x = a ?? [];
  const y = b ?? [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? -1;
    const q = y[i] ?? -1;
    if (p !== q) return p > q;
  }
  return false;
}

/** Does this cut divide a box, or does it fall between two of them? A bare path that normalised to the block alone is a block boundary and divides nothing; everything else — a path into the block, a word, a pixel extent — divides the top-level block, and which boxes below it are divided is the proper-ancestor law in the header. The one predicate the presentation asks before it builds a fragment at either end. */
export const divides = ( cut: Address|null|undefined) => !!cut && (cut.path.length > 1 || cut.word != null || cut.px != null);

/**
 * Where a line stack resumes, read off the Gauge's pieces (*a line inside a word is a break point*, 2026-09-23): the first piece standing on line `line` or below, a word and a character where the line begins inside it, or, where every piece stands above, the place after the last word.
 *
 * @remarks Exported for a host that lays a page out itself and reads the same pieces (*the engine knows no view*); the driver's own cuts are made with this function.
 *
 * @param pieces - `report.wordsOf(box)`.
 */
export const placeAt = (pieces: { line: number; index: number; char: number; }[], line: number) => {
  const p = pieces.find((x) => x.line >= line);
  return p ? { word: p.index, char: p.char } : { word: pieces.length ? pieces[pieces.length - 1].index + 1 : 0, char: 0 };
};

/**
 * The progress test of *the build cannot fail* (C2), asked of an address. A later place in the tree, a later word in the same line stack, a later character in the same word, entering a shell, or a shell that shrank — a monolith taller than a page slices down page by page at one address, and the remainder is what moves.
 *
 * `null` for the earlier cut means there was none, which is progress: a parallel flow newly carried has shown itself for the first time.
 */
export function cutAfter(a: Address, b: Address|null|undefined, posOf: ((cut: Address) => number)|null = null): boolean {
  if (!b) return true;
  // A word in a box that holds blocks (*the anonymous box is in the procession*, 2026-09-29): a run of lines beside block children is addressed by its container's path and a word in the container's word space, so the place stands among the container's children, and only the flat position says which of them it follows. Where the other path runs inside that container, the two are ordered by their projections, and at an equal one the word comes after: a box inside the container starting at the run's first word stands before the run, since a run holds a word and the box holds none.
  if (posOf) {
    const [short, long] = a.path.length < b.path.length ? [a, b] : [b, a];
    if (short.word != null && short.path.length < long.path.length && short.path.every((n, i) => n === long.path[i])) {
      const d = posOf(a) - posOf(b);
      return d !== 0 ? d > 0 : a === short;
    }
  }
  if (pathAfter(a.path, b.path)) return true;
  if (pathAfter(b.path, a.path)) return false;
  if ((a.word ?? 0) > (b.word ?? 0)) return true;
  if ((a.word ?? 0) === (b.word ?? 0) && (a.char ?? 0) > (b.char ?? 0)) return true; // a later line inside the same word
  if (a.px && !b.px) return true;
  if (a.px && b.px) return a.px.remaining < b.px.remaining - 0.5;
  return false;
}

/** The DOM-free core: pure arithmetic over word counts plus an opaque-keyed element table. Split from the builder so it is testable without a browser, the same posture as the Ledger's injected `contains` once had. */
export function createPositionIndex({ wordCounts, elementWords }: { wordCounts: number[]; elementWords: Map<unknown,{ block: number; before: number; count: number; inside: boolean; }>; }) {
  const bases = [0];
  for (const c of wordCounts) bases.push(bases[bases.length - 1] + c);
  const total = bases[bases.length - 1];

  /** The global word index of word `w` of block `b`. */
  const posOf = ( b: number,  w: number) => bases[b] + w;

  /** The block whose word range holds `gi` — the largest `b` with `bases[b] <= gi`, clamped to the last block; at a seam this skips word-empty blocks forward to the first block that actually contains the position (the earlier-side rule above). */
  const blockOf = ( gi: number) => {
    let lo = 0;
    let hi = wordCounts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (bases[mid] <= gi) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  /** Decompose a global index into `{ b, w }` — the inverse of `posOf` under the boundary rule. */
  const split = ( gi: number) => {
    const b = blockOf(gi);
    return { b, w: gi - bases[b] };
  };

  const entryOf = ( el: unknown) => {
    const e = elementWords.get(el);
    if (!e) throw new Error('positions: element is not in the index — offsets are answered for SOURCE elements only, never clones');
    return e;
  };

  /** Words (in the block's word space) wholly before `el` — absolute within its block. A word straddling into `el` is not before it: it is the word `el`'s first character is part of, so `before` is that word's index, and a character inside `el` is asked at the word it belongs to (*an element that opens inside a word*, case 114, 2026-10-19). The entry's `inside` says the straddle happened, which is what a reader asking *does anything stand before this box in its parent* needs beside the count. */
  const wordsBefore = ( el: unknown) => entryOf(el).before;

  /** Words whose first part lies inside `el`. */
  const wordCountIn = ( el: unknown) => entryOf(el).count;

  /** The block index an element belongs to. */
  const blockOfEl = ( el: unknown) => entryOf(el).block;

  /** Whether `el` opens inside a word: its first character continues a word that began before it, across an inline seam. Then `before` names that word, and the words of `el` end past `before + count + 1`. */
  const opensInside = ( el: unknown) => entryOf(el).inside;

  /** The raw table row for `el`, or `null` — the non-throwing door, for a query (`pageOf`) where an element outside the index is an ordinary refusal rather than a programmer error. */
  const entryFor = ( el: unknown) => elementWords.get(el) ?? null;

  return { bases, wordCounts, total, posOf, blockOf, split, wordsBefore, wordCountIn, blockOfEl, opensInside, entryFor };
}

/**
 * One top-level block's part of the position index: its word count and, for every element in it, the words of the block before it, the words in it and whether it opens inside a word — all relative to the block's own start, so a block's part does not change when another block's words do (*a resumed run keeps its reads*, 2026-10-22). {@link indexBlocks} is these parts laid end to end, the bases their prefix sums.
 *
 * @param b - the block's index among the top-level blocks, which every entry carries; {@link indexBlocks} stamps a kept part again where its block moved.
 */
export function indexBlock(block: { childNodes: Iterable<any>; }, b: number, isInline = isInlineBox, isFixed = isFixedBox): { b: number; count: number; words: Map<any,{ block: number; before: number; count: number; inside: boolean; }>; } {
  const words = new Map<any, any>();
  let count = 0;
  let inWord = false;
  const walk = ( el: { childNodes: Iterable<any>; }) => {
    // An element entered inside a word (`inWord`: no breaking space since the word began) opens in word `count − 1`, which the walk has already counted; its `before` is that word's index, so that a character of the element is asked at the word it is part of, as `wordsBeforeChar` asks within it. The straddled word stays attributed by its first part, so `count` does not hold it, and `inside` records the one word by which the two then differ.
    const inside = inWord;
    const start = count;
    const before = inside ? count - 1 : count;
    for (const node of inDisplayOrder(el as Element, [...el.childNodes])) {
      if (node.nodeType === 3) {
        const s = node.data;
        for (let i = 0; i < s.length; i++) {
          if (BREAKING_SPACE.test(s[i])) inWord = false;
          else if (!inWord) {
            count++;
            inWord = true;
          }
        }
      } else if (node.nodeType === 1) {
        if (isFixed(node)) continue; // zero footprint at any depth: not in the flow, so not in the word space
        // A run does not cross a non-inline boundary (word-space.js): both edges end the word, or a block that opens with text continues whatever the block before it ended with. Nor an author's `<br>`, which is inline and breaks the line anyway.
        const joins = isInline(node) && !isLineBreak(node);
        if (!joins) inWord = false;
        walk(node);
        if (!joins) inWord = false;
      }
    }
    words.set(el, { block: b, before, count: count - start, inside });
  };
  walk(block);
  return { b, count, words };
}

/**
 * Build the index from the top-level source blocks, in one walk per block. The tokenization must equal `joinedWords`' exactly — a word is a maximal non-whitespace run of the joined text, continuing across text-node and inline-element seams — and the per-element attribution must equal `wordOffsetBefore`'s: a word belongs where its first part lies. Only `childNodes`, `nodeType`, and `data` are touched, so tests may feed plain object trees.
 *
 * **A `position: fixed` subtree is skipped whole** (*a fixed box at any depth*, 2026-09-15). Its footprint is zero by CSS 2.1 §9.6.1, so it is in no flow and in no word space — and the clone side does not see it either, `fragments.js`' `stripFixedBoxes` having taken it out before `joinedWords` runs. The skip is here rather than an accident of where the boxes happen to sit, because the two tokenizations *must never disagree*: the last time they did, a block's first word printed nowhere.
 * @param keep - the memo's door (`forcing-memo.js`): each block's {@link indexBlock} part is asked of it, and a part it kept from an earlier run is laid in place of a walk (*a resumed run keeps its reads*, 2026-10-22). Absent, every block is walked.
 */
export function indexBlocks(blocks: ArrayLike<{ childNodes: Iterable<any>; }>, isInline = isInlineBox, isFixed = isFixedBox, keep: Keep|null = null) {
  const wordCounts = [];
  const elementWords = new Map<any, any>();
  for (let b = 0; b < blocks.length; b++) {
    const read = () => indexBlock(blocks[b], b, isInline, isFixed);
    const part = keep ? keep('index', blocks[b], read) : read();
    // A part kept for a box that moved among the blocks counts the same words and is stamped with its new number here, in new entries, so an index laid before keeps its own.
    if (part.b !== b) {
      for (const [el, entry] of part.words) part.words.set(el, { ...entry, block: b });
      part.b = b;
    }
    for (const [el, entry] of part.words) elementWords.set(el, entry);
    wordCounts.push(part.count);
  }
  const index = createPositionIndex({ wordCounts, elementWords });
  /** The flat position just past the box a path names — where the words of a parallel flow's box end, which is what {@link remaindersOf} needs of a flow below the top level. `null` where the tree no longer answers the path, an edited document rather than a defect. */
  const endOf = (path: number[]): number|null => {
    const e = elementWords.get(elAt((blocks as ArrayLike<Element>), path, isFixed));
    return e ? index.bases[e.block] + e.before + e.count + (e.inside ? 1 : 0) : null;
  };
  return { ...index, endOf };
}

/**
 * Words of `el`'s own text that lie wholly before character `charOffset` of it — the char→word step, and the one place a consumer's character space meets this module's word space (*the engine answers the page*, 2026-09-04). Written in the same walk as `indexBlocks` and kept beside it on purpose: the tokenization must equal `joinedWords`' exactly, and a second implementation in a consumer's realm is an off-by-one that produces a confidently wrong page rather than a visible failure.
 *
 * `charOffset` counts into the element's own joined text, the same string `joinedWords` tokenizes — so a caller holding a DOM offset inside a descendant text node sums the text lengths before it, which is what a text-space consumer already does. Returns `null` when the offset is past the element's text: a refusal, not a clamp, because a clamped offset answers a page for a character that does not exist.
 *
 * **A character inside a word is that word's** (*a parallel flow is a fragmentainer*, 2026-10-08; *the page of a character*, P38, `packages/essay/probes/page-of.js`). The count is the words wholly before the character, which is the index of the word the character is part of — the position `pageContaining` asks the intervals about. The count used to include a word the offset was inside, which answered the next word's page for every character after a word's first, and so the next page for the characters of a page's last word.
 */
export function wordsBeforeChar(el: { childNodes: Iterable<any>; }, charOffset: number, isInline = isInlineBox) {
  if (!(charOffset >= 0)) return null;
  // The offset counts characters in the order written, and the words are counted in display order (*the-word-space-follows-the-table-display-order*): each text node's first character is found in the first order, and the walk below runs in the second.
  const startOf = new Map<any, number>();
  let chars = 0;
  (function count(node: { childNodes: Iterable<any>; }) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { startOf.set(child, chars); chars += child.data.length; }
      else if (child.nodeType === 1) count(child);
    }
  })(el);
  if (charOffset > chars) return null;
  let words = 0;
  let inWord = false;
  let done = false;
  let inside = false;
  const walk = ( node: { childNodes: Iterable<any>; }) => {
    for (const child of inDisplayOrder(node as Element, [...node.childNodes])) {
      if (done) return;
      if (child.nodeType === 3) {
        const s = child.data;
        const start = startOf.get(child) as number;
        for (let i = 0; i < s.length; i++) {
          // The character at the offset continues a word that began before it exactly when the walk is inside a word and this character is not a breaking space: `inWord` is the tokenization's own state, reset at every non-inline boundary, so a word does not straddle across one.
          if (start + i === charOffset) { inside = inWord && !BREAKING_SPACE.test(s[i]); done = true; return; }
          if (BREAKING_SPACE.test(s[i])) inWord = false;
          else if (!inWord) { words++; inWord = true; }
        }
      } else if (child.nodeType === 1) {
        const joins = isInline(child) && !isLineBreak(child);
        if (!joins) inWord = false;
        walk(child);
        if (!joins) inWord = false;
      }
    }
  };
  walk(el);
  return inside ? words - 1 : words;
}

/**
 * The page intervals, reconstructed from the account exactly as the driver's cursor advanced (*the engine answers the page*, 2026-09-04 — the construction was `present()`'s inline, and lives here now so the view and the query read one table). Pure arithmetic over the account; no DOM.
 *
 * An endpoint carries the account's own address (`cut`) and the `{ b, w }` its projection decomposes to: the block is `cut.path[0]` and never a binary search, since the word space under-determines block seams wherever a block has no words (case 04's plate). A page covers `[start, end)`; the last page's `end` is `null`, meaning the document's end.
 * @param account - the driver's account — one entry per page.
 * @param bases - the position index's prefix sums.
 * @param endOf - the index's `endOf`, for the `away` ranges each endpoint carries ({@link remaindersOf}); without it a flow below the top level throws.
 */
export function pageIntervals(account: ReadonlyArray<any>, bases: number[], endOf: (path: number[]) => number|null = topLevelEndOf(bases)) {
  const pages: { start: Endpoint; end: Endpoint|null; closes: any; index: number; blank: boolean; }[] = [];
  const none: { b: number; from: number; to: number; }[] = [];
  let start: Endpoint = { cut: { path: [0], word: null, px: null }, b: 0, w: 0, carried: null, away: none };
  account.forEach((entry, i) => {
    let end: Endpoint|null = null;
    if (entry.pos != null) {
      const b = entry.cut.path[0];
      // `away` is the endpoint's membership half (beltype#43): the words behind this cut that the flows it carries have not shown yet, block-relative so `pageContaining` asks them in its own `{ b, w }`. A page nothing flows onto carries no flow in the account, and the cursor carries the same flows across it, so its end keeps the ranges its start had.
      const away = entry.blank ? start.away : remaindersOf(entry.carried, endOf).map((r) => ({ b: r.b, from: r.from - bases[r.b], to: r.to - bases[r.b] }));
      // `forced` rides the endpoint because it is the next page's fact: the page that opens here began at a forced break, and §5.2 keeps the margin after it (*the margin after a forced break is preserved*, 2026-09-29) — read off the entry's own trace, the one place the driver wrote it.
      end = { cut: entry.cut, b, w: Math.max(0, entry.pos - bases[b]), carried: entry.carried ?? null, away, forced: entry.trace?.forced === true };
    }
    // A page nothing flows onto (css-page-3 §4.2.3, and css-break-3 §3.1's second break) closes at the position it opened, so its interval is empty and every containment test below skips it by arithmetic alone. `blank` is carried anyway because presentation must assign nothing there, and an empty interval is not enough to say so: a forcing interior to a block leaves `start.w > 0`, which the block loop would read as a continuation to build.
    pages.push({ start, end, closes: entry.closes, index: i, blank: entry.blank === true });
    if (end) start = end;
  });
  return pages;
}

/** `pageIntervals`' default `endOf`, for a caller holding the bases alone: a flow at the top level is its whole block. A flow below it needs the index's own `endOf`, and asking without one is a programmer error rather than a page answered by a guess. */
const topLevelEndOf = (bases: number[]) => ( path: number[]) => {
  if (path.length > 1) throw new Error('positions: a parallel flow below the top level ends where the index says — pass `pageIntervals` the index\'s `endOf`');
  return bases[path[0] + 1] ?? null;
};

/**
 * The remainders a cut carries — the words behind it that are not shown yet, as ranges of the flat word space (*a word is on the page its flow puts it*, 2026-10-15; beltype#43). Pure arithmetic over the account's `carried` and an `endOf` the index answers.
 *
 * @remarks
 * The flat index is document order, and order stays its job: the Ledger orders by it and in-content counters are tree-order by specification. It is not page membership. Beside a parallel flow the two part: a float's words come before the paragraph beside it in the document and are displayed beside and after it, so a word in the part of a float that continues on the next page stands behind the cut and is on the next page. No single flat boundary can say so (a row of cell A, words 24–35, and B, 36–47, with A's ninth word on page two and B's third on page one asks for `c ≤ 32` and `c > 38` at once). Each carried flow's own place can: a flow resumes at `pos`, and its box's words from there to the box's end are the words it has still to show. A page holds the words of its interval and of the ranges its start carries in, less the ranges its end carries out; every reader of membership asks that, and nothing else — `pageContaining` (so `pageOf` and a page read's target), the named strings and the counters a page starts with (`document-state.js`), and the driver's `held`.
 *
 * A flow's box is its row item's or nested flow's (`item`) where it has one, and its top-level block where it does not (a top-level float).
 *
 * @param endOf - the flat position just past the box a path names (`indexBlocks`' `endOf`).
 * @returns one flat range `[from, to)` per flow with words left, and its block.
 */
export function remaindersOf(carried: ReadonlyArray<{ pos: number; cut: { path: number[]; }; item?: number[]; }>|null|undefined, endOf: (path: number[]) => number|null): { b: number; from: number; to: number; }[] {
  const out = [];
  for (const c of carried ?? []) {
    const b = c.cut.path[0];
    const to = endOf(c.item ?? [b]);
    if (to != null && to > c.pos) out.push({ b, from: c.pos, to });
  }
  return out;
}

/** Does a range of {@link remaindersOf} hold flat position `gi`? */
export const inRemainders = (ranges: ReadonlyArray<{ from: number; to: number; }>, gi: number) => ranges.some((r) => r.from <= gi && gi < r.to);

/** Is word `w` of block `b` behind this endpoint's cut and not yet shown — in the remainder of a flow the cut carries? The block-relative form of {@link inRemainders}, over an endpoint of `pageIntervals`. */
export const carriedPast = (endpoint: { away?: ReadonlyArray<{ b: number; from: number; to: number; }>; }|null|undefined, q: { b: number; w: number; }) => !!endpoint?.away?.some((r) => r.b === q.b && r.from <= q.w && q.w < r.to);

/** The key a composition is filed under for a page of this content width — what `present()` looks a page's records up by, and what the presentation's map is keyed by. One definition, so the two cannot round differently. */
export const widthKeyOf = ( contentW: number) => String(Math.round(contentW * 100) / 100);

/**
 * Which blocks each page width must be composed over for presentation (*the presentation composes the pages it has*, 2026-09-15). Account arithmetic, no DOM.
 *
 * The walk composes each page at the width its own conditions give it — parity and `:first` included (*geometry changes only at page boundaries*, C8) — and a page presents through the records filed under that width. So what the presentation needs is read off the pages the account has: for every page that takes flow, the blocks from its interval's first block through its last, and the block a carried parallel flow brings onto it. A page nothing flows onto needs nothing. The interval's closing block is included even when the cut falls at its start, which composes one block the page does not show and costs nothing wrong.
 * @param blockCount - the number of top-level blocks, for the last page's open end.
 * @returns width key → the width and the block indices, ascending.
 */
export function presentationWidths(pages: ReturnType<typeof pageIntervals>, blockCount: number): Map<string,{ contentW: number; blocks: number[]; }> {
  const widths = new Map<any, any>();
  for (const pg of pages) {
    if (pg.blank || blockCount === 0) continue;
    const key = widthKeyOf(pg.closes.contentW);
    if (!widths.has(key)) widths.set(key, { contentW: pg.closes.contentW, blocks: new Set<any>() });
    const set = widths.get(key).blocks;
    const last = pg.end ? Math.min(pg.end.b, blockCount - 1) : blockCount - 1;
    for (let b = pg.start.b; b <= last; b++) set.add(b);
    for (const cf of pg.start.carried ?? []) if (cf.cut.path[0] < blockCount) set.add(cf.cut.path[0]);
  }
  return new Map([...widths].map(([key, w]) => [key, { contentW: w.contentW, blocks: [...w.blocks].sort((a, b) => a - b) }]));
}

/**
 * The page bearing `{ b, w }`, or `null` when the position space cannot discriminate there (*the engine answers the page*, 2026-09-04). Lexicographic containment in `[start, end)` over the block/word pair.
 *
 * Two refusals, and each names a fact the record genuinely does not hold. A page closed by a **shell** cut the block geometrically: every slice of that monolith carries the same word position, so nothing says which slice bears the character — and the reserved `(gi, char)` refinement would not help, because a shell cut moves no position at all. A **word-empty** block spanning more than one page has no word position to compare; its three seam addresses share one integer, which is why the presentation reads the cut's own path rather than arithmetic.
 * @param wordCounts - per-block word counts, for the word-empty test.
 */
export function pageOfPos(pages: ReturnType<typeof pageIntervals>, q: { b: number; w: number; }, wordCounts: number[]) {
  // The refusals are properties of the block, not of the page the search lands on — a shell cut leaves the position where it was, so its pages carry empty intervals and the search would sail past them into a page that merely looks like the answer.
  const undetermined = pages.some((pg) => pg.end && pg.end.b === q.b && (pg.end.cut.px != null || wordCounts[q.b] === 0));
  if (undetermined) return null;
  return pageContaining(pages, q);
}

/**
 * The page whose interval holds `{ b, w }`, by the arithmetic alone and with none of `pageOfPos`'s refusals — the question a `target-counter(<url>, page)` asks of a target's first word (*a pointer is a read*, 2026-10-03).
 *
 * The refusals above are about the block, and BelType's sections make a top-level block a whole chapter: one end-gap cut anywhere in it would leave every heading of the chapter without a page number (measured on the manual, 19 of its 191 contents entries). A word's position is still an exact answer for a word; what the arithmetic cannot say is which slice of a box sliced at the page edge a word inside it is on, and it answers the last slice there — a stated limit, where `pageOf` refuses.
 */
export function pageContaining(pages: ReturnType<typeof pageIntervals>, q: { b: number; w: number; }): number|null {
  const after = ( p: { b: number; w: number; },  x: { b: number; w: number; }) => p.b > x.b || (p.b === x.b && p.w > x.w);
  // Membership, not order (beltype#43, `remaindersOf`): the interval's words and the remainders its start carries in, less the remainders its end carries out.
  const hit = pages.find((pg) => ((!after(pg.start, q) && (pg.end == null || after(pg.end, q))) || carriedPast(pg.start, q)) && !carriedPast(pg.end, q));
  return hit ? hit.index : null;
}

/**
 * §5.3's extension, as the account's own arithmetic (*the end gap takes no extension*, 2026-09-15).
 *
 * *"When a box breaks, its content box extends to fill any remaining fragmentainer extent (leaving room for any margins/borders/padding applied by `box-decoration-break: clone`) **before the content resumes on the next fragmentainer**."* Three numbers the account already carries answer it and nothing is measured at present time: the page's content height, the cut's own extent, and the room the fit charged for cloned decoration.
 *
 * **The clause's condition is load-bearing and it is what this function exists to state.** Where the page's closing cut fell in a container's block-end gap, no content resumes past it — what continues is the box's own block-end padding and border — so the premise is absent and no extension is owed. Chromium delivers none there either, measured on three documents it partitions identically with this engine: its first fragment ends at its last child's bottom, at 161.25pt where this engine read 168.75, and at 171 where it read 172.5. A page ending in a shell is exactly that page, and a `px` on the closing address is how the account says so. The painted shell — the edge cut of *the page edge is not a break point* (C10) — is covered by the same test and loses nothing by it: its cut IS the limit and its cost is zero, so its extension is zero by the arithmetic anyway.
 *
 * @param page - one page's interval, from `pageIntervals`.
 * @param entry - the account entry that closes it.
 *
 * @returns the extension in px, zero where none is owed.
 */
export function extensionPx(page: { blank?: boolean; start: { b: number; cut: Address; carried?: ReadonlyArray<{ item?: number[]; }>|null; }; end: { b: number; cut: Address; }|null; closes: { contentH: number; }; }, entry: { usedPx: number; cost?: number; reservePx?: number; carried?: ReadonlyArray<{ item?: number[]; cut: Address; }>|null; }): number {
  if (page.blank || page.end == null) return 0;
  // A cut divides the interval's last block when its address names a place inside it — a box, a word, or a pixel extent — rather than the block's own boundary. A page that also resumes that block shows an intermediate fragment, whose tail is still in the clone, so neither the extension nor the widened clip may be delivered.
  const divided = divides(page.end.cut);
  // A page that also resumes the block it divides shows a middle fragment, and that was an exception here for as long as the middle fragment kept its tail in the clone. It is built by both cuts now (`fragments.js`'s `fragmentOf`), so it takes the extension like any other — except where it resumes as a painted shell, whose slice is left to itself.
  const resumes = divided && page.start.b === page.end.b && page.start.cut?.px?.paint != null;
  // A carried §2.1 box is still an original with its own tail under the clip, so a page a parallel flow crosses takes no extension either.
  const flowsCross = [...(page.start.carried ?? []), ...(entry.carried ?? [])].some((c) => !c.item); // a row item's place rides the same list and is no flow of its own
  // **A shell is the end gap only where nothing resumes beside it.** The closing address of a divided row is its last item's place, which is a shell when that item has nothing left but the row's stretch — and the row's other items do resume past the cut, so the premise of the exception is absent for it and the cells reach the foot (*the fragment lays out under the feed's conditions*, 2026-10-08; case 94). A shell with nothing resuming in a row beside it, a painted shell, and a block's own end gap stay as the record above states them.
  const shell = page.end.cut.px != null;
  const resumesBeside = shell && (page.end.cut.px as NonNullable<Address['px']>).paint == null
 && (entry.carried ?? []).some((c) => c.item && !(c.cut.px != null && c.cut.px.paint == null && c.cut.px.remaining <= 0));
  if (!divided || resumes || flowsCross || (shell && !resumesBeside)) return 0;
  return Math.max(0, page.closes.contentH - (entry.reservePx ?? 0) - entry.usedPx - (entry.cost ?? 0));
}
