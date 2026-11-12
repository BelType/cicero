/**
 * The Stonehand — adjudication: legality, classification, the retreat walk, THE MAKE-UP ORDER (tablet: *breaks are classified*, I3; architecture: The Stonehand). The only hand that writes entries — the driver turns this module's verdict into a Ledger entry.
 *
 * One pass, then one order. Collect every candidate the feed offers — one raw Y can carry an A, a B and a C pixels apart, and each is adjudicated under its own rules — checking legality mechanically as they are built: one walk up the ancestor chain, one constraint lookup (*legality is locally decidable*, C4). Then rank whatever fits by the make-up order (below) and take the first. Geometry comes only from the Gauge's sealed report; law is read from the source elements (the measure context is neutralized by design).
 *
 * Fit arithmetic honors break-margin truncation (§5.2): candidate positions are border edges, so the margin above a cut never counts against the closing page — the measured feed still contains those margins, the arithmetic reads past them.
 *
 * **The collection is a function of a procession** (*a parallel flow is a fragmentainer*, 2026-10-08). `collect` takes the walker — which fixes the procession, the page's or a flow's own by its root — the boxes in it, the limit and the start, and the page runs it over the document; a row item runs the same code over its own subtree with the row's height as its limit and its top as its start (`flowVerdict`), and `decide` ranks what that offers on the make-up order exactly as the page's. So the walk reads constraints inside a parallel flow — an avoid on a paragraph in a cell, its orphans and widows, a forced break, a monolith — and only the height crosses the wall (§2.1): every climb up the ancestor chain stops at the root, so what stands outside a flow does not reach in (*legality is locally decidable*, C4) and the flow's own do not reach out. A row is offered at one height, priced by the sum of its items' verdicts, and withdrawn where a content-bearing item the height divides shows nothing above it (case 91). The verdict of a row carries each item's own (`items`), which the driver turns into the places of the resume tree.
 *
 * Termination is *the build cannot fail* (C2): last resort cannot fail. If no candidate fits the page, the first boundary past the page edge is taken (progress with overflow — the monolith case); if no boundary exists at all, the verdict is null and the whole feed belongs to one page (the driver's terminal or overflowing-single-box case).
 *
 * @packageDocumentation
 */

import { isAtom, READS_ITS_CHILDREN, sourceHasWord } from './word-space.ts';
import { ARTIFACT, ONE_COLUMN, hasWord } from './data-beltype.ts';

import type { Box, MeasureReport, Px } from './gauge.ts';
import type { CutClass, Violates } from './ledger.ts';

/** The make-up order's keys, computed once per candidate that fits. */
export type MakeUpKey = {
  /** 1 or 0 — binary, not counted (*nested avoids*, P21). */
  avoid: number;
  /** The orphans + widows shortfall, in lines. */
  ow: number;
  y: Px;
  /** The candidate box's flow position. */
  docIndex: number;
};

/** One reading the feed offers, judged under its own rules. */
export type Candidate = {
  /** The engine's reading; `R` is a cut through a row. */
  kind: 'A' | 'B' | 'C' | 'R';
  cls: Exclude<CutClass, 'LAST_RESORT'>;
  y: Px;
  docIndex: number;
  box: Box;
  /** §5.3's *leaving room*: the block-end decoration every broken box that clones it will wrap its fragment in. */
  cost: Px;
  /** A Class B cut's line index — the cut falls after line `k`. */
  k?: number;
  /** The line count of that stack. */
  T?: number;
  /** A start-gap Class C. */
  edge?: 'start';
  /** A start-gap Class C's first in-flow child: the cut names the place before it. */
  child?: Box;
  /** That candidate's gap, between the box's content edge and the child's outer top. */
  gap?: Px;
  /** The row an `R` cut goes through. */
  row?: Box[];
  /** What each item of that row does at the cut's height. */
  items?: RowItem[];
  /** An `R` cut with an item sliced by the page edge: a reading of the edge's own, ranked below every one that fits. */
  edgeCut?: boolean;
  /** A Class A boundary a forced break value stands at, inside a flow whose own forced breaks are read: the flow goes no further. */
  forced?: boolean;
  /** The top of the row an `R` cut goes through. */
  rowTop?: Px;
  violatesAvoid: () => boolean;
  violatesOW: () => boolean;
  owShortfall: () => number;
};

/** The between-lines readings of a box, not yet measured: a place held in the candidate list, in the order the readings would stand in it, until the walk knows whether the box can still matter (`collect`, *the break search is cheaper*). */
export type Pending = {
  kind: 'lines';
  box: Box;
  docIndex: number;
};

/** One item of a row at the row's cut: wholly above the height (`above`, shown and spent), wholly below it or beginning below it (`below`, resumes whole), holding nothing it has not shown above it (`done`), a monolith it crosses (`held`, resumes whole) or divided by it, and then the item's own verdict — the best cut its procession offers at or above the height — or null where the item holds nothing to show. */
export type RowItem = {
  item: Box;
  state: 'above' | 'below' | 'done' | 'held' | 'divided';
  verdict: Verdict | null;
};

/** The winning cut, and its honest account of what it could not satisfy. */
export type Verdict = {
  /** `E` is the page edge's own cut (*the page edge is not a break point*, C10). */
  kind: Candidate['kind'] | 'E';
  cls: CutClass;
  box: Box;
  y: Px;
  k?: number;
  T?: number;
  edge?: 'start';
  child?: Box;
  gap?: Px;
  row?: Box[];
  /** A row cut's items, each with its own verdict where the cut divides it (*a parallel flow is a fragmentainer*, 2026-10-08). */
  items?: RowItem[];
  /** The cut is a forced break's own, or goes through a row one of whose items ends at one. */
  forced?: boolean;
  /** Absent on the page edge's cut alone. */
  cost?: Px;
  violates: Violates;
};

/**
 * THE MAKE-UP ORDER (*breaks are classified*, I3, amended in the fifth round) — which constraint yields first, and the standing fact that a constraint which has yielded still pulls.
 *
 * This replaced a "relaxation ladder" of five rungs walked in sequence, and the replacement is not cosmetic. A ladder is climbed step by step and what you leave behind stays behind: each rung dropped a constraint to enlarge the candidate set and then never consulted it again. Because an avoid blocks every interior candidate until avoids yield, and avoids only yield after orphans and widows have, a cut inside an avoid box could never honor orphans or widows — the two are independent in the spec and were coupled by our own structure. Differential seed 88 was one visible consequence; the coupling was general.
 *
 * The spec drops rules "to provide more break points" (css-break-3 §4.4) — it enlarges the set. It never says a candidate still satisfying a dropped rule must be passed over for one that does not. Chromium does not pass it over, measured at every boundary: the rung probes, *widows past a relaxed avoid* (P18) through *the impossible block, re-checked* (P24), in the essay package's `probes/rungs.js`.
 *
 * So there are no rungs. There is one total order over the candidates that fit, applied once:
 *
 *   1. violates an avoid (rules 1/2/4)      — ascending, binary   (*which rule goes first*, P20: rule 3 yields first, as the spec prescribes; *nested avoids*, P21: nesting is moot, so binary rather than counted)
 *   2. orphans + widows shortfall, in lines — ascending           (*widows past a relaxed avoid*, P18; *orphans, the mirror*, P19; *magnitude or half?*, P20b; the third cell of *the impossible block, re-checked*, P24)
 *   3. y, then flow position                — descending          (*maximize content before the cut*, C3, unchanged, now explicitly the tie-break it always was)
 *
 * When any clean candidate exists the key is [0, 0, …] and the order reduces to plain furthest-first, so the behaviour that was already right is right by construction. Only the cases that used to relax can move.
 *
 * The name is the composing room's own: page make-up is the stage between typesetting and lock-up, performed at the stone with a make-up rule in hand — the Stonehand's exact job. "Ladder" went back where it belongs: in the trade it names a defect, three or more consecutive hyphenated line-endings.
 *
 * DECORATION_TRUNCATION was a rung here and is gone. As a rung it never bound and cannot: decoration truncation governs how a break renders, not which candidate wins (*the decoration rung*, P22 — with a clean earlier boundary available, Chromium slices straight through a bordered, padded box under both `box-decoration-break` values). Narrowed 2026-07-28: §4.4 does list cloned-decoration truncation, but as a step that makes room in the last-resort sequence, between dropping rules 1/2/4 and breaking anywhere. Unimplemented here, recorded in the checklist as a small gap — and never what this rung claimed to be.
 */
export const MAKE_UP_ORDER = Object.freeze(['avoid', 'orphans-widows', 'content']);

/**
 * How far short of rule 3 a Class B cut after line k falls, in lines, counting both sides. Zero exactly when the cut lies inside `classBWindow`.
 *
 * Kept separate from the window predicate because the two answer different questions: the window says whether a cut is clean, this says how much it costs when it is not — and where rule 3 cannot be satisfied at all (T < orphans + widows) only the second is defined, which is how a cornered line stack still picks a cut instead of packing.
 */
export function owShortfall(k: number, T: number, orphans: number, widows: number) {
  return Math.max(0, Math.max(1, orphans) - (k + 1)) + Math.max(0, Math.max(1, widows) - (T - k - 1));
}

/**
 * The make-up order as a comparator, over candidates already scored `{ avoid, ow, y, docIndex }`. Exported so its laws are testable without a DOM.
 *
 * Lexicographic, not additive: no orphans/widows shortfall, however large, makes a candidate worse than one that violates an avoid. That is the spec's own drop order (rule 3 yields before rules 1/2/4) and what Chromium was measured doing (*which rule goes first*, P20).
 */
export function byMakeUpOrder(a: MakeUpKey, b: MakeUpKey) {
  return a.avoid - b.avoid || a.ow - b.ow || b.y - a.y || b.docIndex - a.docIndex;
}

const AVOID = new Set(['avoid', 'avoid-page']);
/** The break values that force a break: the grab's own list (`driver.js`' `isForced`). */
const FORCED = new Set(['page', 'left', 'right', 'recto', 'verso']);

/** Class B window arithmetic: cutting after line k is inside the legal window iff k+1 >= orphans and T-(k+1) >= widows — [orphans-1, T-widows-1] as line indices, null when the window is empty (T < orphans + widows: no cut in this stack satisfies rule 3 at all). The window says whether a cut is clean; `owShortfall` says how far short it falls, and the make-up order ranks on the second. */
export function classBWindow(T: number, orphans: number, widows: number): [number,number]|null {
  const lo = Math.max(1, orphans) - 1;
  const hi = T - Math.max(1, widows) - 1;
  return hi < lo ? null : [lo, hi];
}

/**
 * The monolith predicate, on the tablet's three grounds (The Cut).
 *
 * **The inherent**: atoms and true scroll containers admit no interior break points. An atom is `word-space.js`' `isAtom` — a replaced element, an SVG or MathML element, an atomic inline — asked by local name and namespace, the one predicate the procession stops at ([*the procession stops at an atom*](../../../.claude/decisions/cicero/the-procession-stops-at-an-atom.md), 2026-09-27). This clause used to compare `tagName` against a list of its own spelled in capitals, and an inline `<svg>` reports `svg`: a block-level drawing straddling the foot was cut between its two `<text>` elements where Chromium's print moves it whole (`packages/essay/cases/70-the-drawing-in-the-divided-paragraph`, its measurement). The `overflow: hidden`/`clip` zone was a UA-may question the differential answered empirically on day one: Chromium print fragments such boxes, slicing them at the page edge (their empty regions even produce token-less pages) — so they are not monolithic here either, and their trailing space is Class C gap territory. Recorded in the checklist as the may-zones survey's first answer.
 *
 * **The normatively forbidden**, built 2026-09-07 (*the box on every page*): CSS 2.1 §9.3.1 says *"UAs must not paginate the content of fixed boxes"*, which makes a fixed box monolithic by requirement rather than by nature — the strongest of the three grounds and the only one that is not a judgement call. A top-level fixed box never reaches this predicate, having left the flow before the walk begins; a nested one does, and this is what refuses to cut through it.
 */
export function isMonolith(el: Element, style: CSSStyleDeclaration, live: Element = el) {
  if (isAtom(el)) return true;
  if (style.position === 'fixed') return true;
  if (['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflowX)) return true;
  return notYetDivided(style, live) !== null;
}

/**
 * **A fourth ground, and a temporary one: what the engine does not yet divide, where dividing it loses words** (*every branch gets a place*, 2026-09-21). Two arrangements lay content side by side in ways a row of sibling boxes does not describe, and each lost words at a cut until it was held whole (`packages/essay/probes/conservation.js`): a multi-column container, whose columns are fragmentainers of their own; and an inline-level block container, which is an atom of a line, with paragraphs inside it that the procession used to see. Held as a monolith each moves whole, or is sliced by the edge with its remainder painted — css-break-3's own remedy. **The remedy has a price, measured the same day, and it is why the list is this short**: a slice through text leaves the line the edge crosses half on each page, and the print's text layer reads it on both. A multi-column box taller than a page no longer reaches this list: it is laid out as one column (`src/scope.ts`), and the slice is left to a box that is a monolith for another reason. That is better than words on no page and worse than anything else, so a grid with sized tracks or placed items — which divides without losing a word and merely opens its next page on the spent track's blank — was tried here and taken out again. Each entry leaves this list when it has a design of its own.
 *
 * `live` is the element a measured clone stands for, kept in the signature for the day a ground needs to ask the element rather than its computed style — a grid's declared tracks are such a question: `grid-template-rows` resolves to the used tracks, implicit ones included, and only `computedStyleMap()` tells a declared list from none (measured in Chromium).
 */
export function notYetDivided(style: CSSStyleDeclaration, live: Element): 'multicol'|'inline block container'|null {
  if (((style.columnCount ?? 'auto') !== 'auto' || (style.columnWidth ?? 'auto') !== 'auto') && !sourceHasWord(live, ONE_COLUMN)) return 'multicol'; // a source the run laid out as one column (`src/scope.ts`) is an ordinary block, though its own style still says columns
  if (/^inline-(block|flex|grid|table)$/.test(style.display ?? '')) return 'inline block container';
  return null;
}
const named: WeakSet<Element> = new WeakSet<any>();

const last = <T>(a: T[]): T|undefined => a[a.length - 1];

/**
 * The two out-of-flow predicates, kept apart because css-break-3 treats them differently and it would be easy to collapse them by accident.
 *
 * `isAbsolutelyPositioned` — break-before/break-after **must not** apply (§3.1), and `break-inside`'s "applies to" excludes such boxes (§3.2). Not a preference: a must not, and we were violating it until 2026-07-29 (probe *forced break by box type*, P28: an abspos box carrying `break-before: page` printed on one page in Chromium and forced a second in ours).
 *
 * `isOutOfFlow` — the wider set, floats included. Child→parent break propagation **must ignore out-of-flow children** (§3.1.1, corrected in 2016 by Issue 2614). Floats keep their own break-* values, because §3.1 says a UA *should* apply them to floats whose containing block is in the normal flow — a should that Chromium does not honour and we accidentally do, recorded rather than blessed (checklist, part three).
 */
export const isAbsolutelyPositioned = ( style: CSSStyleDeclaration) => style.position === 'absolute' || style.position === 'fixed';
export const isOutOfFlow = ( style: CSSStyleDeclaration) => isAbsolutelyPositioned(style) || (style.float && style.float !== 'none');

/**
 * A box the Cast-off's bound never cuts inside (*the Cast-off bounds the feed*, 2026-09-26): one whose layout reads its whole interior, so putting away what follows a boundary inside it could move a box before that boundary.
 *
 * @remarks
 * The bound puts away every box after the place it names and trusts that nothing before that place moves. That is true of block layout, which is forward, and false in exactly these boxes: a monolith, laid out as one piece (*the line box is the atom*, I3); a parallel flow, whose interior is laid out against its own extent (§2.1); and a box that lays its children out against each other — a table, whose automatic layout reads every row for its column widths, and a flex or grid container, whose items are sized together. A line stack is the fourth, and needs no test here: the bound cuts only at the start of an in-flow block box, which is never inside one.
 *
 * The Stonehand refuses the first two interiors through the same two predicates, `isMonolith` and `isOutOfFlow`, called here rather than restated. The third half cannot be shared, and the difference is the one between the two callers. The Stonehand asks where a break may be chosen and reads a row off the report's geometry (`rowOf` — a flex column is a sequence, and it cuts inside one); the bound decides before anything is laid out, so it reads the display that permits a row, and adds the table, whose rows the Stonehand does cut between and whose layout still reads them all. Refusing a flex column costs the bound a longer feed, never a different verdict.
 */
export function neverCutInside(el: Element, style: CSSStyleDeclaration) {
  return isMonolith(el, style) || !!isOutOfFlow(style) || READS_ITS_CHILDREN.test(style.display ?? '');
}

export type StyleOfBox = (box: Box) => CSSStyleDeclaration;

/**
 * What an anonymous block box answers when the walk reads its style (*the anonymous box is in the procession*, 2026-09-29). CSS 2.1 §9.2.1.1: *"The properties of anonymous boxes are inherited from the enclosing non-anonymous box … Non-inherited properties have their initial value."* So every break property is `auto`, it is in flow and undecorated, and it is set by its container's `orphans` and `widows`, the two inherited properties this walk reads of it.
 *
 * @param holder - the container's computed style
 */
const anonymousStyle = (holder: CSSStyleDeclaration): CSSStyleDeclaration =>
  ((Object.freeze({ breakBefore: 'auto', breakAfter: 'auto', breakInside: 'auto', position: 'static', float: 'none', display: 'block', overflowX: 'visible', overflowY: 'visible', columnCount: 'auto', columnWidth: 'auto', boxDecorationBreak: 'slice', borderBottomWidth: '0px', paddingBottom: '0px', orphans: holder.orphans, widows: holder.widows }) as unknown) as CSSStyleDeclaration);

/** The last in-flow block descendant chain — the path a `break-after` propagates up (§3.1.1), out-of-flow children skipped. */
const lastInFlowChild = (box: Box, styleOfBox: StyleOfBox) => last(box.blockChildren.filter((c) => !isOutOfFlow(styleOfBox(c)))) ?? null;
const firstInFlowChild = (box: Box, styleOfBox: StyleOfBox) => box.blockChildren.find((c) => !isOutOfFlow(styleOfBox(c))) ?? null;

/**
 * Boundary break-after at a box's end edge is carried by the box and its last-in-flow-block-descendant chain (spec break propagation, §3.1.1).
 *
 * @param values - the values asked for; the avoids by default, and `FORCED` where a flow's own forced breaks are read.
 */
function breakAfterAvoid(box: Box, styleOfBox: StyleOfBox, values: Set<string> = AVOID) {
  for (let b = (box as Box | null); b; b = lastInFlowChild(b, styleOfBox)) {
    if (values.has(styleOfBox(b).breakAfter)) return true;
  }
  return false;
}

/** The mirror of {@link breakAfterAvoid}: break-before at a box's start edge, carried down its first-in-flow chain. */
function breakBeforeAvoid(box: Box, styleOfBox: StyleOfBox, values: Set<string> = AVOID) {
  for (let b = (box as Box | null); b; b = firstInFlowChild(b, styleOfBox)) {
    if (values.has(styleOfBox(b).breakBefore)) return true;
  }
  return false;
}

/**
 * The boxes the retreat walk reads, and where it stops — one definition with two readers (*the Cast-off bounds the feed*, 2026-09-26): `adjudicate` below, and the driver's check on a bounded feed, `reachesBelowTheEdge`. The check asks whether the walk would stop inside the feed it was handed, and it must ask with the walk's own predicates, because a second spelling of *where the walk stops* is a second answer that can drift from the first while both go on agreeing with themselves.
 *
 * **The walk has a root** (*a parallel flow is a fragmentainer*, 2026-10-08): with none it reads the page's procession, and with a box it reads that box's own — a row item, a carried float — as the same walk with the same predicates and a boundary drawn at the root. Every climb up the ancestor chain stops there, so what stands outside the root does not reach in (*legality is locally decidable*, C4) and the root's own row, float and margins are not its interior's business (§2.1: only the height crosses). The root is the one box the walk reads whose own parallel-flow status is not asked: it is the flow.
 *
 * @param styleCache - shared across the walks one adjudication makes, so a row item's walk does not read what the page's already did.
 * @param forcing - whether a flow's own forced breaks are read (a document with a forced break inside a row item asks, page by page): the boundary a forced value stands at is then marked on the candidate, and the flow's verdict is the first of them.
 */
function walkOf(report: MeasureReport, sourceOf: (cloneEl: Element) => Element|null, root: Box|null = null, styleCache: Map<Box,CSSStyleDeclaration> = new Map<any, any>(), forcing: boolean = false) {
  const boxes = report.boxes();
  const win = boxes.length ? boxes[0].el.ownerDocument.defaultView : null;
  const styleOfBox: StyleOfBox = (box) => {
    let s = styleCache.get(box);
    if (!s) {
      s = box.anonymous ? anonymousStyle(styleOfBox((box.parent as Box))) : (win as Window).getComputedStyle(sourceOf(box.el) ?? box.el);
      styleCache.set(box, s);
    }
    return s;
  };
  const monolithic = ( box: Box) => {
    if (box.anonymous) return false; // a run of lines, never one unit
    const live = sourceOf(box.el) ?? box.el;
    const held = isMonolith(box.el, styleOfBox(box), live);
    // Named once per box, on the console, so a page that looks wrong for this reason says so.
    if (held && typeof live === 'object' && !named.has(live)) {
      const why = notYetDivided(styleOfBox(box), live);
      if (why) {
        named.add(live);
        console.info(`cicero: a ${why} is not divided yet — <${String(live.tagName ?? '?').toLowerCase()}${live.className ? ` class="${live.className}"` : ''}> moves whole, or is sliced by the page edge`);
      }
    }
    return held;
  };
  /** A climb from a box to the root, the root included where `inclusive` — a monolith root holds its interior; a parallel or row-item root IS the flow the walk reads. */
  const climb = ( box: Box,  test: (p: Box) => boolean,  inclusive: boolean) => {
    if (box === root) return false;
    for (let p = box.parent; p; p = p.parent) {
      if (p === root && !inclusive) return false;
      if (test(p)) return true;
      if (p === root) return false;
    }
    return false;
  };
  const insideMonolith = ( box: Box) => climb(box, monolithic, true);
  /**
   * §2.1's line, drawn where the tablet's The Flows says it is drawn: *"the Stonehand offers no candidates inside a parallel flow and reads no constraints from within one: its interior is the oracle's business."* A box establishing a parallel formatting context — a float, an absolutely positioned box — couples to the main flow's cut through geometry alone, so its interior offers nothing to the make-up order and its own extent is not a position in the procession the cuts divide.
   *
   * `parallelBox` is the box itself; `insideParallel` is anything under one. The predicate was defined in this file from the sixth round and used only by the §3.1.1 propagation walks: **no candidate had ever been tested against it**, so a float's interior offered Class A points between its children, Class B points on its lines and Class C points in its end gaps, all of them ranked beside the main flow's. Measured on `cases/21-parallel-flows`: a 96mm rail in a 70mm page area took the first two pages by itself, cut twice inside its own paragraphs, and the five slabs beside it followed on pages three and four — where the specification, and Chromium, put a fragment of each on each of two pages. In the composed mode the same reading chose a candidate standing behind the cursor and the build threw.
   */
  const parallelBox = ( box: Box) => box !== root && !!isOutOfFlow(styleOfBox(box));
  const insideParallel = ( box: Box) => climb(box, parallelBox, false);
  /** A row's items are parallel flows too (*every branch gets a place*, 2026-09-21; §2.1's own list — the cells of a row, grid items, flex items). `report.rowOf` is the Gauge's answer: the side-by-side siblings a box stands among, or null. An item's interior offers nothing, exactly as a float's does, and the boundary between two items of one row is not a place in any procession — they stand beside each other, so nothing lies between them on the block axis. A row therefore offers two readings and no more: the boundary before it, on its first item, and the page edge through it. */
  const rowOf = ( box: Box) => (box === root ? null : report.rowOf?.(box) ?? null);
  const insideRowItem = ( box: Box) => climb(box, (p) => !!rowOf(p), false);
  /** A copy the engine repeats (`artifact`), the table's header on a continuation: furniture with a footprint, no content of the flow, so no break point stands in it (*an artifact is never read*). */
  const copy = (box: Box) => !box.anonymous && hasWord(box.el, ARTIFACT);
  /** Does the walk read this box at all? Not an inline box, nothing inside a monolith, a parallel flow, a row item or a repeated copy — and a row answers once, at its first item (see `rowOf`). */
  const walks = ( box: Box) => {
    if (box.inline || copy(box) || insideMonolith(box) || insideParallel(box) || insideRowItem(box) || climb(box, copy, false)) return false;
    const row = rowOf(box);
    return !row || row[0] === box;
  };
  /**
   * The walk stops at the edge (*the page asks the index*, 2026-09-25): a box the walk reads, in the procession, whose top lies below the limit. Nothing it or anything after it could offer can fit, so the walk takes the Class A boundary before it and stops.
   *
   * A float, an absolutely positioned box and a row are not where it stops: a float's top is where the float was pushed, not the procession's, and a row's first item is not the row's top. The premise is stated rather than proved — that in-flow tops do not go backward in document order — and a negative margin taller than the box above it, or a relative offset, would break it. A table's footer written before its rows broke it too, and is walked where it is laid out instead (`gauge.js`, in display order, case 110).
   */
  const standsBelow = (box: Box, limit: Px, eps: Px) => !rowOf(box) && !parallelBox(box) && box.rect.top > limit + eps;
  return { report, sourceOf, boxes, win, root, styleCache, forcing, styleOfBox, monolithic, insideMonolith, parallelBox, insideParallel, rowOf, insideRowItem, copy, walks, standsBelow };
}

/** Does this feed hold the box the retreat walk stops at — the first in-flow box whose top lies below the page's limit? The check a bounded feed must pass before anything is decided on it (*the Cast-off bounds the feed*, 2026-09-26): a feed that holds that box gives the walk everything it reads, and one that does not stopped above the edge and is poured again. */
export function reachesBelowTheEdge({ report, sourceOf, pageStart, contentHeight, eps = 0.25 }: { report: MeasureReport; sourceOf: (cloneEl: Element) => Element|null; pageStart: Px; contentHeight: Px; eps?: Px; }) {
  return !!firstBelowTheEdge({ report, sourceOf, limit: pageStart + contentHeight, eps });
}

/**
 * The lowest bottom of the page's procession, kept apart for the main flow and for the parallel flows beside it. What decides whether a page is full is the in-flow procession's own bottom: a parallel flow couples through geometry alone, and a float taller than the room left is not the main flow failing to fit, so the two readings are kept apart rather than one replacing the other (the second says a page still owes a continuation after the flow beside it has ended). The procession is the Gauge's answer (`processionOf` with no box), not a filtered box list: a top-level `display: inline` container is in no procession, and its block items are in this one.
 *
 * @remarks Both start at `pageStart`, so an empty procession bottoms out where the page does. Which box is parallel is the host's to say, since the box's source is the host's to find: the driver reads the top-level item the box stands in, a host with one source per box reads the box's own.
 *
 * @param a.parallel - Whether a box of the procession belongs to a parallel flow (out of flow: a float or an absolutely positioned box).
 */
export function processionBottoms({ report, pageStart, parallel }: { report: MeasureReport; pageStart: Px; parallel: (box: Box) => boolean; }): { inFlowBottom: Px; parallelBottom: Px; } {
  let inFlowBottom = pageStart;
  let parallelBottom = pageStart;
  for (const b of report.processionOf()) {
    if (parallel(b)) parallelBottom = Math.max(parallelBottom, b.rect.bottom);
    else inFlowBottom = Math.max(inFlowBottom, b.rect.bottom);
  }
  return { inFlowBottom, parallelBottom };
}

/**
 * Does the in-flow procession fit the page: its bottom, from the page's start, within the content height (and a quarter pixel, the Gauge's rounding).
 *
 * @param a.inFlowBottom - `processionBottoms`' answer.
 */
export function fitsPage({ inFlowBottom, pageStart, contentHeight, eps = 0.25 }: { inFlowBottom: Px; pageStart: Px; contentHeight: Px; eps?: Px; }) {
  return inFlowBottom - pageStart <= contentHeight + eps;
}

/**
 * The first box the retreat walk stops at on a page whose edge lies at `limit` — the first box it reads, in the procession, whose top lies below — or null where the report holds none. The same predicates as {@link reachesBelowTheEdge}, which is this function asked whether there is one; the driver's read-ahead (*first-load feeding*, 2026-10-11) asks it of the tail of a page's own feed, with the next page's edge, to learn how far the next feed must reach.
 *
 * @param a.sourced - only a box with a source element of its own: not an anonymous run, whose start has no address.
 */
export function firstBelowTheEdge({ report, sourceOf, limit, eps = 0.25, sourced = false }: { report: MeasureReport; sourceOf: (cloneEl: Element) => Element|null; limit: Px; eps?: Px; sourced?: boolean; }) {
  const { boxes, walks, standsBelow } = walkOf(report, sourceOf);
  // The plain rectangle test first: `standsBelow` implies it, and it costs no style read, where `walks` climbs the ancestors and reads each one's.
  return boxes.find((box) => box.rect.top > limit + eps && walks(box) && standsBelow(box, limit, eps) && (!sourced || (!box.anonymous && sourceOf(box.el)))) ?? null;
}

/**
 * The candidate collection — every reading a procession offers, judged under its own rules (*a parallel flow is a fragmentainer*, 2026-10-08). A function of the walker (which fixes the procession: the page's, or a flow's own by its root), the boxes in it, the limit and the start of the flow, so the page's procession and a row item's are the same code asked at different edges. Legality is one walk up the ancestor chain (*legality is locally decidable*, C4), and the chain stops at the root: what stands outside a flow does not reach in.
 *
 * **In two phases, and the second only as far as it can matter** (*the break search is cheaper*, 2026-10-12). The readings that need no line measure are collected first: the boundaries between blocks, the gaps at a container's edges, the rows. `y*`, the lowest clean one that fits, is then known, and a between-lines reading is measured only for a box whose lines can reach `y*` or lower (`reachOf`, which is the box's bottom unless its content overflows it); with no clean reading at all nothing is skipped. A reading of a box that cannot reach `y*` is strictly worse than the clean reading at `y*` on the make-up order's third key, whatever its own first two, so `decide` returns the cut it always returned and the walk no longer asks `linesOf` of the line stacks that stand wholly above it.
 *
 * @param a.boxes - the boxes of the procession, in document order.
 * @param a.stats - when given, counts what the collection costs: the boxes it visited, the line stacks it measured and the ones it skipped, and the milliseconds the lines and the end gaps took (`adjudicate` publishes it as the measure's detail).
 */
function collect(w: ReturnType<typeof walkOf>, { boxes, limit, pageStart, eps, stats }: { boxes: Box[]; limit: Px; pageStart: Px; eps: Px; stats?: { boxes: number; lined: number; skipped: number; linesMs: number; gapMs: number; }; }): Candidate[] {
  const { report, win, root, styleOfBox, monolithic, parallelBox, rowOf, copy, walks, standsBelow } = w;
  /**
   * §5.3's *leaving room*, priced (*the fragment that wraps itself*, 2026-09-15). *"When a box breaks, its content box extends to fill any remaining fragmentainer extent (leaving room for any margins/borders/padding applied by `box-decoration-break: clone`)."* So a cut inside a box that clones its decoration costs the page that box's block-end border and padding, on top of the content above it — and every ancestor the same cut breaks costs its own.
   *
   * `from` is the innermost box this cut breaks, which the candidate's own class already decides: a Class A boundary before a box breaks that box's parent and up, the box itself going whole to the next page; every interior reading — B between lines, C in either gap — breaks the box it was taken from. So no new walk, and no guess.
   *
   * Cloned margins are not charged: §5.4's own note truncates them on block-level boxes, and §5.2 truncates a margin adjoining a break in any case.
   */
  const clonedBlockEnd = ( from: Box|null) => {
    let px = 0;
    for (let p = from; p; p = p === root ? null : p.parent) {
      // Safari ships only the prefixed form for inline boxes, and `lib.dom` does not declare it.
      const st: CSSStyleDeclaration&{ webkitBoxDecorationBreak?: string; } = styleOfBox(p);
      if ((st.boxDecorationBreak || st.webkitBoxDecorationBreak) !== 'clone') continue;
      px += (parseFloat(st.borderBottomWidth) || 0) + (parseFloat(st.paddingBottom) || 0);
    }
    return px;
  };

  /** The rise a cut grants inside a table cell it divides: the cell's own nearest, the box included and the root not (a row item's rise is its row's, `rowPlan`). */
  const liftIn = (box: Box) => {
    for (let p: Box|null = box; p && p !== root; p = p.parent) if (styleOfBox(p).display === 'table-cell') return cellLift(w, p);
    return 0;
  };
  /** A box's bottom as a place in the procession: a row ends where its tallest item does, not where the item that happens to stand last in the source does. */
  const bottomOf = ( box: Box) => {
    const row = rowOf(box);
    return row ? Math.max(...row.map((b) => b.rect.bottom)) : box.rect.bottom;
  };
  // An avoid binds always, taller-than-page fragments included. The vacuous-avoid waiver that used to sit here — an avoid on a fragment taller than the page binds nothing — was retracted in the edge design round (2026-07-27; tablet *the page edge is not a break point*, C10). It was a second mechanism for unsatisfiable constraints, firing eagerly per box before the make-up order could speak. The order alone produces what Chromium prints: a clean boundary before the box outranks every avoid-violating interior cut, so the box starts at a fresh page top; on the next page, at a page top and still not fitting, only avoid-violating candidates remain and the order picks among them by shortfall then content. Probes *taller-than-page avoid* (P17a) through *wasteful push* (P17h) pin the behaviour; the waiver's own provenance turned out to be an observation of `.mono`, which carries no avoid at all.
  const crossingAvoid = ( ancestor: Box|null) => {
    for (let p = ancestor; p; p = p === root ? null : p.parent) {
      if (AVOID.has(styleOfBox(p).breakInside)) return true;
    }
    return false;
  };

  /** One item of a row at a height: wholly above it (shown, spent), wholly below it (resumes whole), or divided by it — and then its own walk's verdict, the best the item's own procession offers at or above the height (*a parallel flow is a fragmentainer*, 2026-10-08). Null for the whole plan where a content-bearing item is divided and offers nothing: a height at which an item shows nothing is not a break point inside its row, and the row's boundary is what remains (case 91). */
  const rowPlan = ( row: Box[],  h: Px, requireForced = false) => {
    const plan: RowItem[] = [];
    for (const item of row) {
      // A forced break inside an item ends the item's fragment there whatever else is true of it, and crosses the wall as nothing but the row's cut (§2.1; *a forced break inside a cell*, P37c): the neighbours are divided at the height by their own verdicts.
      if (w.forcing && item.rect.top < h - eps) {
        const forcedAt = flowVerdict(w, item, h, eps, true);
        if (forcedAt) {
          plan.push({ item, state: 'divided', verdict: forcedAt });
          continue;
        }
      }
      if (item.rect.bottom <= h + eps) plan.push({ item, state: 'above', verdict: null });
      else if (item.rect.top >= h - eps) plan.push({ item, state: 'below', verdict: null });
      else {
        // A cell the height divides sets its content from its own top on this page (`cellLift`), so its content is judged that much lower.
        const lift = cellLift(w, item);
        const [begins, reachesBelow] = contentSpanOf(w, item, h + lift, eps);
        if (begins === null) plan.push({ item, state: 'divided', verdict: null }); // holds nothing to show: a stretched box, divided by the geometry alone
        else if (begins >= h + lift - eps) plan.push({ item, state: 'below', verdict: null }); // its content begins at or below the height: the break falls in the gap above it (§4.1's Class C, whatever made the gap — padding, an alignment), and the item resumes whole
        else if (!reachesBelow) plan.push({ item, state: 'done', verdict: null }); // all it has to show stands above the height; only its box reaches below, stretched by the row
        else if (monolithic(item)) plan.push({ item, state: 'held', verdict: null }); // a monolith the height crosses resumes whole: the stated limit, as a float's (the item is the graphic, and nothing inside it is a place)
        else {
          const v = flowVerdict(w, item, h + lift, eps);
          if (!v) {
            // Content crosses the height and the item offers no place above it: it shows nothing here. In the first table row of the group that withdraws the offer (case 91). In a later row of a group a `rowspan` makes, that row moves whole with every row after it, the boundary before it being the break in its column, and the spanning cell is still divided at the height, as Chromium prints it (the essay's case 92).
            if (item.parent === row[0].parent) return null;
            const from = row.findIndex((r) => r.parent === item.parent);
            plan.splice(from);
            for (const rest of row.slice(from)) plan.push({ item: rest, state: 'below', verdict: null });
            break;
          }
          plan.push({ item, state: 'divided', verdict: v });
        }
      }
    }
    if (requireForced && !plan.some((p) => p.verdict?.forced)) return null;
    return plan.some((p) => p.state !== 'below' && p.state !== 'held') ? plan : null;
  };

  // Readings. One raw Y can carry several; each candidate carries its own rules and is judged under them.
  const candidates: (Candidate|Pending)[] = [];
  for (const [docIndex, box] of boxes.entries()) {
    if (!walks(box)) continue;
    const row = rowOf(box);

    // Class A — between siblings: the boundary before this box. Position is the previous sibling's bottom border edge (§5.2: the intervening margins truncate at an unforced cut; the forced case is the driver's, since only the page that begins there knows the break was forced).
    // §4.1 lists Class A points between in-flow block-level boxes (and float-adjacent pairs); an absolutely-positioned box is neither, and §3.1 forbids reading its break-* at all, so it offers and accepts no boundary.
    // The procession is the Gauge's answer now (`report.processionOf`, over `word-space.js`'s one walker): a block item inside an inline container belongs to the enclosing procession, not to the container's, so the boundaries around it are Class A points of the outer flow — which is what §4.1's *"between sibling boxes … in-flow block-level boxes"* says of the anonymous blocks CSS 2.1 §9.2.1.1 breaks such a container into. This line used to read `box.parent.blockChildren` and fall back to a filtered box list, and those two spellings of the same question disagreed about exactly one shape.
    // The root of a flow's own walk stands in no procession of its own: its row-mates are outside it, and a boundary before it is the outer walk's (*a parallel flow is a fragmentainer*, 2026-10-08).
    const siblings = box === root ? [] : report.processionOf(box).filter((b) => !isAbsolutelyPositioned(styleOfBox(b)));
    const si = siblings.indexOf(box);
    if (si > 0) {
      // Two siblings answer here, and they are not always the same one. **The keeps** are the immediately-adjacent box's, because §4.1 names *"a float and an immediately-adjacent in-flow or floated box"* as a Class A pair in as many words — a float's own `break-after` binds the boundary after it, which is §3.1's *should* on floats that this engine honours and Chromium declines. **The position** is the previous in-flow sibling's bottom border edge, because a parallel flow's extent is not a place in the procession the cuts divide (§2.1): the float is laid out beside the content, so the page closes where the previous in-flow box ended and the float's own bottom says nothing about it. Pricing this at the float's bottom is how a 96mm rail put every slab standing beside it off the page — measured, `cases/21-parallel-flows`, where the boundary before the first slab was priced at y 400 in a 264px page area.
      const pair = siblings[si - 1];
      const anchor = last(siblings.slice(0, si).filter((b) => !parallelBox(b))) ?? null;
      // Before the rows of a continuation only the repeated header stands, and a copy is furniture (*an artifact is never read*): a boundary there takes nothing of the box, and would send the page back to where the box began.
      // A table row a `rowspan` from above reaches is inside its group's row: the boundary before it would leave the spanning cell's remainder on no page, and the group's own cut is where that boundary is taken (`rowPlan`).
      const spanned = box.blockChildren.some((c) => { const r = rowOf(c); return !!r && r[0].parent !== box; });
      if (anchor && !spanned && !siblings.slice(0, si).every((b) => parallelBox(b) || copy(b))) {
        candidates.push({
          kind: 'A',
          cls: 'A',
          y: bottomOf(anchor) - liftIn(box.parent as Box),
          docIndex,
          box,
          cost: clonedBlockEnd(box.parent), // the box itself goes whole to the next page; what this boundary breaks is its container and up
          forced: !!root && w.forcing && (breakAfterAvoid(pair, styleOfBox, FORCED) || breakBeforeAvoid(box, styleOfBox, FORCED)),
          violatesAvoid: () => breakAfterAvoid(pair, styleOfBox) || breakBeforeAvoid(box, styleOfBox) || crossingAvoid(box.parent),
          violatesOW: () => false,
          // Separates no line stack, so rule 3 has nothing to say about it. **This zero is load-bearing, and it is spec rather than arithmetic convenience.** It is the whole reason an impossible line stack (T < orphans + widows) moves whole: every interior candidate scores ≥ 1 on the second key, so this boundary outranks all of them — and css-break-3 §3.3 requires exactly that outcome, "If a block contains fewer lines than the value of widows or orphans, the rule simply becomes that all lines in the block must be kept together." What carries it over the rest of the impossible range is §4.4's licensing sentence — "If the above doesn't provide enough break points to keep content from overflowing the fragmentainer, then rule 3 is dropped" — and a retreat that moves the box whole is itself a break point that prevents overflow, so the drop never arrives. §4.5's second worked example (orphans 10, widows 20, 8 lines of room) agrees and does not discriminate: with fewer lines of room than `orphans`, Chromium's rule moves that block whole too. Chromium diverges here, dropping rule 3 per-fragmentainer and cutting at exactly orphans (*the population, scanned*, P25; eight differential seeds — 56, 64, 89, 124, 126, 160, 171, 197), and we are the conforming side — so do not tune this zero toward matching it. Pinned in `test/stonehand.test.js`. There is no impossible-block branch anywhere in this file, and this line is why none is needed.
          owShortfall: () => 0
        });
      }
    }

    /**
     * The walk stops at the edge (*the page asks the index*, 2026-09-25). An in-flow box whose top lies below the limit has just offered the Class A boundary before it, which needs no line measure, and nothing it or anything after it could offer can fit: every one of its readings lies below its top, and so does every box after it in the procession. The `beyond` fallback wants the first boundary past the limit, and that is the one just kept. Before this line the walk went on to the end of the feed and asked `linesOf` of every line stack in it — a `Range.getClientRects` per word, 98 810 on the first page of the synthetic book, its whole word count (`packages/essay/RESULTS.md`).
     *
     * Which boxes it stops at is `standsBelow`'s, in `walkOf` above, because the driver's check on a bounded feed asks the same question and must get the same answer.
     */
    if (standsBelow(box, limit, eps)) break;
    if (stats) stats.boxes++;

    if (row) {
      /**
       * Through the row — the page edge, and an ordinary break rather than a last resort: it is how a two-column layout crosses a page at all. The row is cut at one height and only the height crosses the wall (§2.1); what each item shows and where it resumes is that item's own walk (`flowVerdict`), the same collection the page's procession runs, with the height as its limit and the item's top as its start. The row's shortfall is the sum of its items' verdicts' (Vivliostyle's rule, where each cell is a column with its own candidates and the row costs the sum of their minima), and the make-up order takes the row's cut or, where an item's constraint cannot be met, the boundary before the row, which separates no line stack and so scores zero.
       *
       * **One height is enough**: an item's verdict at a height is the best its own candidates offer at or above it, a set that only grows with the height, so no lower height can score better on any item — the line-bottom heights the first spelling offered (*a cell keeps its own window*, 2026-10-06) were each item cut geometrically at the height, and an item now chooses its own cut. The height is the limit less the block-end decoration the row's ancestors clone (§5.3).
       *
       * **An item that shows nothing withdraws the offer** (case 91; §4.1 grants no break above a block container's first line where there is no gap): the cell's own first line crosses the height, and dividing the row there would leave its whole content after the break. An item's own `break-inside: avoid` is its declaration about itself and is read as one: the item divided at all violates it.
       */
      const top = Math.min(...row.map((b) => b.rect.top));
      const crossing = bottomOf(box) > limit + eps;
      // A row the height does not cross is offered only for a forced break one of its items ends at.
      if (top < limit - eps && (crossing || w.forcing)) {
        const cost = clonedBlockEnd(box.parent);
        const h = limit - cost;
        const plan = rowPlan(row, h, !crossing);
        if (plan) {
          candidates.push({
            kind: 'R',
            cls: 'B', // provisional: css-break-3 has three classes and a row is none of them — what the break IS, in each item, is that item's own. The driver writes the entry's class from the place the main path actually took.
            y: h,
            docIndex,
            box,
            row,
            items: plan,
            forced: plan.some((p) => p.verdict?.forced),
            rowTop: top,
            cost,
            edgeCut: plan.some((p) => p.verdict?.cls === 'LAST_RESORT'),
            violatesAvoid: () => crossingAvoid(box.parent) || plan.some((p) => p.verdict?.violates.avoid || (p.state === 'divided' && AVOID.has(styleOfBox(p.item).breakInside))),
            violatesOW: () => plan.some((p) => (p.verdict?.violates.ow ?? 0) > 0),
            owShortfall: () => plan.reduce((sum, p) => sum + (p.verdict?.violates.ow ?? 0), 0)
          });
        }
      }
      continue; // a row item's interior is the item's own walk's, not this one's
    }

    if (monolithic(box)) continue; // a monolith admits no interior points, at any position in the make-up order (*the line box is the atom*, I3)
    if (parallelBox(box)) continue; // §2.1 again, from the other side: the boundary before a float is a Class A point of the outer procession and was offered above; everything below this line is a reading of the box's interior — its line stack, its end gap, its start gap — and a parallel flow's interior is the oracle's business.

    // Class B — between lines: held in its place and measured after the walk, once the lines worth measuring are known (`betweenLines`, below). A box with block children has no line stack of its own (`linesOf` answers nothing for it, and the lines beside its children are its anonymous boxes').
    if (!box.blockChildren.length) candidates.push({ kind: 'lines', box, docIndex });

    // Class C — container-edge gaps; exists only where the gap is non-zero. The start gap answers to ancestor break-inside and to the keeps of the pair it separates; the end gap answers to break-inside and, where it is offered, to the box's own `break-after` and the next sibling's `break-before` as well (below). The C-gap tie was open residue and the differential resolved it against a live case: when the gap crosses the page edge the tie dissolves and *maximize content before the cut* (C3) rules — the cut falls at the page edge inside the gap (min of gap bottom and limit), which is precisely how Chromium slices a fragmentable box's trailing space. The gap's pixels past the cut continue as the box's shell.
    // The end gap breaks only at the edge (*the end gap breaks only at the edge*, 2026-09-27): offered only where the box's border-box end lies past the limit. A gap that ends within the page sits one block-end border above the Class A boundary after the box, which is deeper, so it was only ever chosen to dodge that boundary's keeps — a heading left at the foot with its border alone on the next page (case 65) — or, as a blank shell at a page's top, to yield the address it came from (case 66, the manual's refusal at page 162). §4.1's Class C is narrower still: a box's block-end padding lies outside its content edge. The gap's base above the limit is the `y - gap.base` guard below. **And it answers to the box's keeps** (amended 2026-10-11, case 104): the guard puts the point below the box's content, so it separates every word of the box from what follows exactly as the Class A boundary after the box would; it is offered where only the block-end decoration crosses the edge, and a heading with `break-after: avoid` must not end the page on it while the clean boundary before the heading stands.
    // Asked only of a box whose border-box end lies past the limit (a pure reordering of the test it had below): the end gap of a line stack is read off its last line, so asking every box would measure every stack the second phase exists to skip.
    const tg = stats ? performance.now() : 0;
    const gap = box.rect.bottom > limit + eps ? report.endGapOf(box) : null;
    if (stats) stats.gapMs += performance.now() - tg;
    if (gap) {
      const y = Math.min(gap.bottom, limit);
      if (y - (gap.base - liftIn(box)) > eps) {
        candidates.push({
          kind: 'C',
          cls: 'C',
          y,
          docIndex,
          box,
          cost: clonedBlockEnd(box),
          // The offered point lies below the box's content (`y - gap.base > eps` above), so it separates every word of the box from what follows, exactly as the boundary after the box would, and it answers to that boundary's keeps as the start gap does (*the end gap breaks only at the edge*, amended 2026-10-11, case 104: a heading's `break-after: avoid` left it at the foot with its padding carried over).
          violatesAvoid: () => crossingAvoid(box) || breakAfterAvoid(box, styleOfBox) || (si >= 0 && si + 1 < siblings.length && breakBeforeAvoid(siblings[si + 1], styleOfBox)),
          violatesOW: () => false,
          owShortfall: () => 0 // separates no line stack, so rule 3 has nothing to say about it
        });
      }
    }
    // A start-gap C is the sibling boundary wearing the container's border and padding: no in-flow content precedes it, so it separates exactly the pair the boundary's keeps protect — it therefore answers to those keeps as well as to break-inside (differential finding: Chromium refuses these cuts under a keep; the pure break-inside reading let one through).
    // The place it names is before the box's first in-flow child, past the gap (*the cut divides its ancestors*, 2026-09-29): the page before carries the box's border, its padding and whatever stands in the gap — an empty float, the clearance under it — and the page after resumes the box divided, its first child whole. So the position is the child's outer top, which is the content edge plus the gap; it used to be the box's top plus its border, which put the padding on the next page and offered a break point §4.1 does not provide (`packages/essay/cases/71-the-box-that-begins-a-page`).
    const startGap = box.blockChildren.length ? report.gapAt({ box, edge: 'start' }) : 0;
    const firstInFlow = startGap > eps ? box.blockChildren.find((c) => !parallelBox(c)) : undefined;
    // A box that opens the page offers no start gap: the page would hold its block-start decoration and nothing else, and the next page would offer the same gap again wherever the box clones its decoration, so the cut is no progress (css-break-3 §4.4 drops an avoid that leaves only this, and Chromium's print never takes it: a row taller than the page under `break-inside: avoid` left a blank first page, and WPT's `table-fragmentation-001c` refused, assessment 2026-11-07, `outer-row-taller-than-page-avoid`).
    if (firstInFlow && !copy(firstInFlow) && box.rect.top > pageStart + eps) {
      const prevSibling = si > 0 ? siblings[si - 1] : null;
      const bs = (win as Window).getComputedStyle(box.el);
      candidates.push({
        kind: 'C',
        cls: 'C',
        y: box.rect.top + parseFloat(bs.borderTopWidth) + parseFloat(bs.paddingTop) + startGap,
        docIndex,
        box,
        child: firstInFlow,
        gap: startGap,
        cost: clonedBlockEnd(box),
        edge: 'start',
        violatesAvoid: () =>
          crossingAvoid(box) ||
          (prevSibling && breakAfterAvoid(prevSibling, styleOfBox)) ||
          breakBeforeAvoid(box, styleOfBox),
        violatesOW: () => false,
        owShortfall: () => 0 // separates no line stack, so rule 3 has nothing to say about it
      });
    }
  }

  /** Class B — between lines: window arithmetic [orphans, T−widows] as line indices. */
  const betweenLines = (box: Box, docIndex: number, out: Candidate[]) => {
    const tl = stats ? performance.now() : 0;
    const lines = report.linesOf(box);
    if (stats) {
      stats.linesMs += performance.now() - tl;
      stats.lined++;
    }
    const T = lines.length;
    if (T < 2) return;
    const st = styleOfBox(box);
    const orphans = parseInt(st.orphans, 10) || 1;
    const widows = parseInt(st.widows, 10) || 1;
    const window_ = classBWindow(T, orphans, widows);
    const lift = liftIn(box);
    for (let k = 0; k < T - 1; k++) {
      out.push({
        kind: 'B',
        cls: 'B',
        y: lines[k].bottom - lift,
        docIndex,
        box,
        cost: clonedBlockEnd(box),
        k,
        T,
        violatesAvoid: () => crossingAvoid(box),
        violatesOW: () => !window_ || k < window_[0] || k > window_[1],
        // How far short, in lines, on each side of the cut — the make-up order's second key. Zero exactly when the cut is inside the window, so this subsumes violatesOW and refines it: where rule 3 cannot be satisfied at all (T < orphans + widows) the minimum is still well defined, which is how a cornered stack picks a cut instead of packing (the third cell of *the impossible block, re-checked*, P24: Chromium takes exactly orphans, not the furthest fitting line).
        owShortfall: () => owShortfall(k, T, orphans, widows)
      });
    }
  };

  // The second phase. The floor is the lowest clean reading that fits among those already collected, filtered exactly as `decide` filters (`fitsOf`), so the reading that sets it is one `decide` will rank. A box whose lines cannot reach it offers only readings strictly below it on the third key, and is not measured.
  const floor = cleanFloorOf((candidates.filter((c) => c.kind !== 'lines') as Candidate[]), limit, pageStart, eps);
  const out: Candidate[] = [];
  for (const c of candidates) {
    if (c.kind !== 'lines') out.push(c);
    // A box whose bottom is at the floor or below it is measured without asking `reachOf`, which is never lower than the bottom.
    else if (floor === -Infinity || c.box.rect.bottom >= floor || report.reachOf(c.box) >= floor) betweenLines(c.box, c.docIndex, out);
    else if (stats) stats.skipped++;
  }
  return out;
}

/** The readings a limit lets the make-up order choose among: those that fit (with §5.3's *leaving room* in it), begin below the flow's start, and are not an edge cut — and, where a row has a forced break in one of its items, no reading beyond that row (*no forced break lies inside an interval*, C1). */
function fitsOf(candidates: Candidate[], limit: Px, pageStart: Px, eps: Px): Candidate[] {
  // The fit, with §5.3's *leaving room* in it: a candidate must leave the page the block-end decoration every broken box it clones will wrap its fragment in. `cost` is zero for every document that does not declare `clone`, which is every document until one does, so this filter is the one it always was there.
  // A row with an item sliced by the edge is not a reading that fits: it is one of the edge's own, and ranks below every reading that does.
  let fits = candidates.filter((c) => !c.edgeCut && c.y + (c.cost ?? 0) <= limit + eps && c.y > pageStart + eps);
  // A forced break inside a row's item is a boundary the flow does not pass (*no forced break lies inside an interval*, C1): what lies beyond the row — every reading below its top but the row's own — is not a cut this flow may take.
  const forcedRow = fits.filter((c) => c.kind === 'R' && c.forced).sort((a, b) => a.docIndex - b.docIndex)[0];
  if (forcedRow) fits = fits.filter((c) => c === forcedRow || c.y <= (forcedRow.rowTop as number) + eps);
  return fits;
}

/** The place of the lowest reading among `candidates` that fits and violates nothing — no avoid, no orphans or widows shortfall — or minus infinity where none does. Asked of the readings that need no line measure: a row, the only reading a forced row could stand beside, is among them, and a between-lines reading is never one. */
function cleanFloorOf(candidates: Candidate[], limit: Px, pageStart: Px, eps: Px) {
  // Lowest on the page first, so the first clean one is the answer and the ancestor walks that score a reading are spent on few.
  const fits = fitsOf(candidates, limit, pageStart, eps).sort((a, b) => b.y - a.y);
  for (const c of fits) if (!c.violatesAvoid() && c.owShortfall() === 0) return c.y;
  return -Infinity;
}

/** The boxes of a flow, its root first, in document order (the report's list is a pre-order and a subtree is contiguous in it). */
function subtreeOf( boxes: Box[],  root: Box) {
  const i = boxes.indexOf(root);
  const out: Box[] = [];
  for (let j = i; i >= 0 && j < boxes.length; j++) {
    let under = j === i;
    for (let p = boxes[j].parent; !under && p; p = p.parent) under = p === root;
    if (!under) break;
    out.push(boxes[j]);
  }
  return out;
}

/**
 * How far a table cell's content rises when a cut divides the cell: the distance from its content box's top to its first line or monolith. A cell's `vertical-align` places its content in the cell's whole height; Chromium's print aligns a divided cell's first fragment within that fragment instead (`FinalizeTableCellLayout`: *the fragment will start at the block-start edge* on a resumption, and the free space is the fragment's own), so content the alignment set below the cut stands above it once the cell is divided. The presentation matches it by pinning the divided cell's height to the page's foot. Zero for anything else, and for a cell aligned at its top.
 *
 * @remarks Under collapsed borders the content box is read with the cell's whole border width where half of it is used, so the rise is under by half a border, never over.
 */
function cellLift(w: ReturnType<typeof walkOf>, cell: Box): Px {
  const st = w.styleOfBox(cell);
  if (st.display !== 'table-cell') return 0;
  const [begins] = contentSpanOf(w, cell, -Infinity, 0);
  return begins === null ? 0 : Math.max(0, begins - (cell.rect.top + (parseFloat(st.borderTopWidth) || 0) + (parseFloat(st.paddingTop) || 0)));
}

/** Where a flow's content stands against a height: where it begins (the top of its first line or monolith, null where it holds none) and whether any of it stands below the height — asked of the leaves that reach below it alone, so a flow of a thousand paragraphs above the foot costs the leaves it needs and not its line stacks (a leaf whose box ends above the height has every line above it too). */
function contentSpanOf( w: ReturnType<typeof walkOf>,  root: Box,  h: Px,  eps: Px): [number|null,boolean] {
  let begins: number|null = null;
  let below = false;
  for (const d of subtreeOf(w.boxes, root)) {
    if (d.inline || d.blockChildren.length) continue;
    const mono = !d.anonymous && w.monolithic(d);
    if (begins !== null && d.rect.bottom <= h + eps) continue;
    const lines = mono ? [] : w.report.linesOf(d);
    const top = lines.length ? lines[0].top : mono ? d.rect.top : null;
    if (top === null) continue;
    begins = Math.min(begins ?? Infinity, top);
    const bottom = lines.length ? lines[lines.length - 1].bottom : d.rect.bottom;
    if (bottom > h + eps) {
      below = true;
      break;
    }
  }
  return [begins, below];
}

/**
 * The verdict of a flow at a height (*a parallel flow is a fragmentainer*, 2026-10-08) — the best cut its own procession offers at or above `limit`, from the flow's top: the candidate collection run over the root's subtree, ranked on the make-up order and taken first, exactly as the page's. Null where the flow shows nothing above the height. Only the height crossed the wall: the flow's constraints are its own and the page's are not read.
 *
 * A fitting candidate always outranks the edge, as on the page (*the edge vs the rules above it*, P23); the edge — a monolith the height crosses, sliced as *the page edge is not a break point* (C10) slices one on the page — is taken only where nothing fits. A flow's first line crossing the height is not sliced: nothing in the flow is too tall for a page, only too tall for the room the page has left, and the row's boundary is where that goes (case 91).
 *
 * @param outer - the walker of the procession that holds the flow; its style cache is shared.
 * @param root - the flow's box: a row item, a carried float.
 * @param forcedOnly - ask only whether the flow ends at a forced break above the height.
 */
function flowVerdict(outer: ReturnType<typeof walkOf>, root: Box, limit: Px, eps: Px, forcedOnly: boolean = false): Verdict|null {
  const w = walkOf(outer.report, outer.sourceOf, root, outer.styleCache, outer.forcing);
  const boxes = subtreeOf(outer.boxes, root);
  const candidates = collect(w, { boxes, limit, pageStart: root.rect.top, eps });
  if (w.forcing) {
    // A forced break is a boundary the flow does not pass: its verdict is the first one above the height, whatever the make-up order would have preferred.
    const first = candidates.filter((c) => c.forced && c.y > root.rect.top + eps && c.y <= limit + eps).sort((a, b) => a.y - b.y || a.docIndex - b.docIndex)[0];
    if (first) return { ...verdict(first), cls: 'A', violates: { avoid: false, ow: 0 } };
  }
  return forcedOnly ? null : decide(w, candidates, boxes, limit, root.rect.top, eps, false);
}

/**
 * The make-up order applied once to what fits, then what lies below it: a row whose item is cut by the edge, the page edge's own cut, and — on the page alone — the first boundary past the limit taken with overflow.
 *
 * @param overflows - whether the flow may overflow its edge (*the build cannot fail*, C2): the page may, an item of a row may not.
 */
function decide(w: ReturnType<typeof walkOf>, candidates: Candidate[], boxes: Box[], limit: Px, pageStart: Px, eps: Px, overflows: boolean): Verdict|null {
  const { insideMonolith, parallelBox, insideParallel, rowOf, insideRowItem, monolithic } = w;
  const fits = fitsOf(candidates, limit, pageStart, eps);

  // The make-up order, applied once. Keys are computed up front rather than inside the comparator: the predicates walk ancestor chains (*legality is locally decidable*, C4), and a sort would call them O(n log n) times.
  const scored = fits.map((c) => ({ c, y: c.y, docIndex: c.docIndex, avoid: c.violatesAvoid() ? 1 : 0, ow: c.owShortfall() }));
  scored.sort(byMakeUpOrder);
  if (scored.length) {
    const best = scored[0];
    return { ...verdict(best.c), cls: best.c.cls, violates: { avoid: !!best.avoid, ow: best.ow } };
  }

  // Below the make-up order entirely, and not about break points at all (*the page edge is not a break point*, C10). The order above ranges over positions the walk may choose; this ranges over the page edge, which nothing chooses — the page simply stops. Reached only when no candidate fits, which is why a clean cut always outranks the edge (*the edge vs the rules above it*, P23). So the cut falls at the limit itself and whatever box straddles it is cut there geometrically, a monolith included: *the line box is the atom* (I3) stands untouched, because this is not a break point being taken inside a monolith, it is the page ending underneath one. The box continues on the next page as a painted shell rather than being lost off the edge — the spec's own remedy ("the UA may also fragment the contents of monolithic elements by slicing the element's graphical representation", css-break-3), and what Chromium print does with an oversized image.
  const edgeRow = candidates.filter((c) => c.edgeCut && c.y > pageStart + eps).sort((a, b) => a.docIndex - b.docIndex)[0];
  if (edgeRow) return { ...verdict(edgeRow), cls: 'LAST_RESORT', violates: { avoid: false, ow: 0, edge: true } };
  const straddler = edgeStraddler(boxes, limit, eps, (box) => insideMonolith(box) || parallelBox(box) || insideParallel(box) || !!rowOf(box) || insideRowItem(box));
  if (straddler && (overflows || (monolithic(straddler) && straddler !== w.root))) {
    return { kind: 'E', box: straddler, y: limit, cls: 'LAST_RESORT', violates: { avoid: false, ow: 0, edge: true } };
  }

  // The edge with nothing beneath it — a page that cannot even begin this box. Fall back to the first boundary past the limit and let it overflow (*the build cannot fail*, C2, and the only lawful way a page's ink exceeds its content box). No boundary at all → null: the feed is one uncuttable run.
  if (!overflows) return null;
  const beyond = candidates.filter((c) => c.y > pageStart + eps).sort((a, b) => a.y - b.y || a.docIndex - b.docIndex);
  if (beyond.length) return { ...verdict(beyond[0]), cls: 'LAST_RESORT', violates: { avoid: false, ow: 0, overflow: true } };
  return null;
}

/**
 * The retreat walk. Returns the winning cut — { cls, kind, box, y, k, T, violates } — or null when the feed offers no boundary at all. `violates` is the chosen cut's own honest account of what it could not satisfy: `{ avoid, ow }`, plus `edge` or `overflow` for the two positions that lie below the make-up order entirely.
 *
 * @param a.report - the Gauge's sealed report.
 * @param a.sourceOf - clone-to-source mapping; law is read from sources, and a clone with no registered source is read as itself.
 * @param a.pageStart - Y where this page's content begins (a continuation's leading margin is already truncated by starting at a border edge).
 * @param a.contentHeight - the page's content height (*render-identical conditions*, I5: the true geometry, not an estimate).
 * @param a.eps - comparison tolerance, far below a line height.
 * @param a.forcing - whether the forced breaks inside the row items of this feed are read, because the grab left one to the Stonehand (*a parallel flow is a fragmentainer*, 2026-10-08).
 */
export function adjudicate({ report, sourceOf, pageStart, contentHeight, eps = 0.25, forcing = false }: { report: MeasureReport; sourceOf: (cloneEl: Element) => Element|null; pageStart: Px; contentHeight: Px; eps?: Px; forcing?: boolean; }): Verdict|null {
  const limit = pageStart + contentHeight;
  const w = walkOf(report, sourceOf, null, new Map<any, any>(), forcing);
  const stats = { boxes: 0, lined: 0, skipped: 0, linesMs: 0, gapMs: 0 };
  const t0 = performance.now();
  const candidates = collect(w, { boxes: w.boxes, limit, pageStart, eps, stats });
  const t1 = performance.now();
  const decided = decide(w, candidates, w.boxes, limit, pageStart, eps, true);
  performance.measure('cicero:collect', { start: t0, end: t1, detail: stats });
  performance.measure('cicero:decide', { start: t1, end: performance.now(), detail: { candidates: candidates.length } });
  return decided;
}

/**
 * The verdict of a parallel flow at a height, for the driver: the flow of a carried float, which the page's cut divides at the height it fell at and which no candidate of the page's procession offers a place in (*a parallel flow is a fragmentainer*, 2026-10-08). `flowVerdict`'s doc says what it returns; a row item's verdict rides the page's own `R` verdict as `items`, so the driver asks this for a flow the page's verdict does not hold.
 *
 * @param a.root - the flow's box.
 * @param a.limit - the height the page's cut fell at.
 */
export function adjudicateFlow({ report, sourceOf, root, limit, eps = 0.25 }: { report: MeasureReport; sourceOf: (cloneEl: Element) => Element|null; root: Box; limit: Px; eps?: Px; }): Verdict|null {
  return flowVerdict(walkOf(report, sourceOf), root, limit, eps);
}

function verdict(c: Candidate): Omit<Verdict,'cls'|'violates'> {
  // `cost` rides out with the rest since *the first fragment is constructed* (2026-09-15): the presentation needs §5.3's *leaving room* as a number, and this is where it was computed. Deriving it a second time at present time is the fork the 2026-08-04 account ruling forbids.
  return { kind: c.kind, box: c.box, y: c.y, k: c.k, T: c.T, edge: c.edge, child: c.child, gap: c.gap, row: c.row, items: c.items, ...(c.forced ? { forced: true } : {}), cost: c.cost ?? 0 };
}

/**
 * The box the page edge crosses (*the page edge is not a break point*, C10) — the graphic actually being sliced, so the deepest straddler wins: an ancestor merely contains the cut, the innermost box is what the edge draws through. Boxes inside a monolith are skipped, so a straddling monolith is itself the deepest qualifying box in its own subtree — one image, not a stack. Document order is pre-order, so the last match is the deepest along its chain.
 *
 * A parallel flow and its interior are skipped too, and it is the same rule as the candidate walk's rather than a second one: *the page edge is not a break point* (C10) leaves a painted shell here, and the tablet's The Flows says a parallel flow's remainder must be live — *"the next page's content lays out beside it, so it is a real box that page's Gauge measures against"*. The driver carries it; naming a float as the straddler would hand the same box to the wrong mechanism and draw a picture of it instead.
 *
 * @param skip - the interiors this walk refuses — a monolith's, a parallel flow's, and the parallel flow itself.
 */
function edgeStraddler(boxes: Box[], limit: Px, eps: Px, skip: (box: Box) => boolean) {
  let found: Box|null = null;
  for (const box of boxes) {
    // An anonymous box has no graphic of its own to slice: the edge draws through the box that holds its lines.
    if (box.inline || box.anonymous || skip(box)) continue;
    if (box.rect.top < limit - eps && box.rect.bottom > limit + eps) found = box;
  }
  return found;
}
