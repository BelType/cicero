/**
 * The driver — the build loop: plumbing, not an organ (architecture: The build loop; first-coding-round.md item 5). Cursor from the Ledger, the Cast-off's bound on the feed (the licensed estimate of *render-identical conditions* (I5) — built 2026-09-26, *the Cast-off bounds the feed*; see CHANGELOG 2026-09-26), measure, adjudicate, append, advance. No presentation: pages are Ledger intervals here, and `root.js` presents them.
 *
 * Termination is *the build cannot fail* (C2) alone — there is no zero-progress counter; if the walk ever fails to advance the cursor, that is a defect and this module throws it, never hides it.
 *
 * **A flow's place comes from its own verdict** (*a parallel flow is a fragmentainer*, 2026-10-08): where the page's cut divides a row item or a carried float, the place it resumes at is read off the verdict the Stonehand's walk gave that flow at the cut's height (`verdictPlace`, `rowPlaceOf`, `flowPlaceOf`) — a bare path before a block its avoid keeps whole, a word after the line its orphans and widows allow, the picture the edge slices — and from the geometry only where the flow offers nothing (a stretched box, a monolith that is itself the item). Each node of the tree carries the class and the trace of its own cut. **A forced break inside a box that lays its children side by side is not the grab's** (`rowForced`): the layout says whether the event stands in a row item, the feed is not cut at the word position, and the Stonehand ends the item's fragment at the boundary while the neighbours are divided at the row's height — which is what leaves a cell that fits on the page it fits on (*a forced break inside a cell*, P37c, case 98).
 *
 * **The cut's record is a tree the driver mints whole** (*a parallel flow is a fragmentainer*, 2026-10-08): `placesOf` returns the places it walks as the nested object they are, `carriedFlows` descends the resume block's procession so a float or an absolutely positioned box declared one block deeper is a node of the main flow like a top-level one (beltype#43), and the entry's `paths` is `flattenResume` of the tree — the wire form the account, the ledger and every runner keep, unchanged for a document with no nested flow.
 *
 * **The account carries the conditions the page was decided under** (*the fragment lays out under the feed's conditions*, 2026-10-08; *render-identical conditions*, I5): `tracks`, the column widths or the column list the feed laid every table and grid on the chain of the page's cuts out at (`report.tracksOf`), and `extents`, the distance from each item a row cut divides to the page's foot — both read from the report that decided the page, so the presentation writes them into its fragments (`fragments.js`) and never measures. The feed's own clones are not pinned; they are where the numbers come from.
 *
 * Intake note: the geometry table (src/capture.js) is the Furniture's capture duty pulled forward; the driver consumes it per page (*geometry changes only at page boundaries*, C8). `readPageGeometry` below is the single-geometry legacy reader, kept for the judge measure and the benchmark.
 *
 * @packageDocumentation
 */

import { Ledger, createEntry } from './ledger.ts';
import { assertRenderConditions, awaitCloneImages, awaitFonts, eagerImages, createMeasureContext } from './measure.ts';
import { holdsAnonymousBlocks, takeReport } from './gauge.ts';
import { adjudicate, adjudicateFlow, firstBelowTheEdge, isAbsolutelyPositioned, isOutOfFlow, isMonolith, neverCutInside, reachesBelowTheEdge, processionBottoms, fitsPage } from './stonehand.ts';
import { composeDocument, applyRecordsUnder } from './compose-dom.ts';
import { CompositionCache } from './composition-key.ts';
import { readGeometryTable, effectivePageName, pageRulesOf, styleSheetsOf, registerGcpmProperties, sheetsUseHas, sheetReach, sheetsCountInPseudos } from './capture.ts';
import { snapshotOfStyle } from './forcing-memo.ts';
import { cloneFlowPiece, declineRepeats, mayRepeat, mutateToContinuation, truncateFrom } from './fragments.ts';
import { cutAfter, divides, elAtIn, flattenResume, indexBlocks, inFlowIndex, inRemainders, normalizePath, pathOf, placeAt, remaindersOf } from './positions.ts';
import { documentOpsOf, counterStateAt, pageNumberAt, type PageCounterOps, withoutPageCounters, stringAssignmentsOf, runningAssignmentsOf, namedStringsForPage } from './document-state.ts';
import { RUNNING_PROP } from './gcpm-encoding.ts';
import { ARTIFACT, hasWord } from './data-beltype.ts';
import { blockChildrenOf, footerBeforeRows, inDisplayOrder, isFixedBox, SIDE_BY_SIDE, sourceOf } from './word-space.ts';
import { changedPairs, settleReads } from './reads.ts';
import { converge, holderPage, namesNoPlace, priorKeys, restartPage } from './resume.ts';
import { answerHas, boxesWhoseWordsMoved } from './has-words.ts';
import type { HasMarks } from './has-words.ts';
import type { ForcingMemo, Keep } from './forcing-memo.ts';
import type { Entry } from './ledger.ts';
import type { Box } from './gauge.ts';
import type { PagePublish, MeasureContext } from './measure.ts';
import type { ResumeNode } from './positions.ts';
import type { Verdict, RowItem } from './stonehand.ts';
import type { MeasureReport, Tracks } from './gauge.ts';
import type { ResumePath, CutClass, Adjudication } from './ledger.ts';

/** One box the forcing index walked, with what the old per-page walk read of it (`forcingIndexOf`). */
export type ForcingEvent = {
  /** The top-level block it stands in. */
  b: number;
  el: Element;
  cut: Address;
  /** Its effective page name. */
  name: string;
  /** Its `break-before` is forced. */
  before: boolean;
  beforeParity: 'left' | 'right' | null;
  /** Its `break-after` is forced, read only of an in-flow box. */
  after: boolean;
  afterParity: 'left' | 'right' | null;
  /** The index just past its subtree. */
  end: number;
  /** The word position its start sits at. */
  pos: number;
  inFlow: boolean;
  /** The outermost box around it the bound never cuts inside, or -1. */
  sealedBy: number;
  /** It stands inside a box that lays its children side by side. */
  rowish: boolean;
  /** For a run of lines after a block child, the event is the run's first word in `el`, which holds it, and this is the block child it follows; the feed is cut after it (*the anonymous box is in the procession*). */
  runAfter?: Element;
};

/** One block of a page's feed: its clone, the source it was cloned from, and the address it resumes at. */
export type FeedItem = {
  clone: Element;
  source: Element;
  blockIndex: number;
  cut: Address | null;
  /** A parallel flow the cut before crossed, fed first. */
  carried?: boolean;
  /** The feed is cut inside this block. */
  ends?: boolean;
};

/** Where the build loop stands: the address, its projection, the flows still carried beside it, whether the page began at a forced break, and the parity a forced break still owes. */
export type Cursor = {
  cut: Address;
  pos: number;
  carried?: ReadonlyArray<Readonly<ResumePath>> | null;
  forced?: boolean;
  demandParity?: 'left' | 'right' | null;
};

/** A place a flow resumes at, read off a page's report (`placesOf`, `verdictPlace`): the box, the three kinds of address, and the places of the row items beneath it. */
export type Place = {
  box: Box;
  word: number | null;
  char?: number;
  px: { remaining: number, paint: number | null } | null;
  gap?: boolean;
  flows: Place[];
  /** The row item this place speaks for. */
  itemBox?: Box;
  remainingPx?: number | null;
  cls?: CutClass;
  trace?: Adjudication;
};

const PX_PER: Record<string,number> = { px: 1, pt: 96 / 72, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6 };

function toPx(len: string) {
  const m = /^(-?[\d.]+)([a-z]+)$/.exec(String(len).trim().toLowerCase());
  if (!m || !PX_PER[m[2]]) throw new Error(`unsupported page length: ${len}`);
  return parseFloat(m[1]) * PX_PER[m[2]];
}

/**
 * The message a table shape refuses with (*thead-after-rows-and-tall-footer-lose-rows*, 2026-11-07): the table, by its id or class or its first words, and the shape. The one shape left is a footer group written before its rows and taller than the page area, refused by name as a box taller than its page is rather than lose rows with no message.
 *
 * @param group - the source `tfoot`.
 * @param shape - the shape, in words.
 * @param remedy - what the author can write instead.
 */
function refusedTable(group: Element, shape: string, remedy: string) {
  const table = group.closest('table');
  const words = (table?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const name = table?.id ? `<table id="${table.id}">` : table?.className ? `<table class="${table.className}">` : `the table beginning "${words}"`;
  return `cicero: ${name} has ${shape}, which this engine cannot divide across pages yet; it refuses rather than lose rows. To print it, ${remedy}.`;
}

/** The nearest copy the engine repeats (`artifact`) standing ahead of this element among its siblings in display order (`inDisplayOrder`) — the table's header, in front of its rows, wherever it is written — or null. */
const artifactBefore = ( el: Element|null|undefined) => {
  const isCopy = (s: Element) => typeof s.getAttribute === 'function' && hasWord(s, ARTIFACT);
  const parent = el?.parentElement;
  const written = parent ? [...parent.children] : [];
  const shown = parent ? inDisplayOrder(parent, written) : written;
  if (shown !== written) return shown.slice(0, shown.indexOf(el as Element)).reverse().find(isCopy) ?? null;
  for (let s = el?.previousElementSibling; s; s = s.previousElementSibling) if (isCopy(s)) return s;
  return null;
};

/** Does a copy the engine repeats (`artifact`) stand ahead of this element among its siblings — the table's header, in front of its rows? */
export const standsAfterArtifact = ( el: Element) => artifactBefore(el) !== null;

/**
 * The gap that is not decoration, along the chain above a resumed box (*every branch gets a place*, ruled 2026-09-21; the spent lead of a continuation, `spentLeadOf` in `paginateOnce`): at every level, how far the child stands below its container's own content edge. A block gives zero, since the margins adjoining the break are truncated, and so does a container that clones its decoration, whose leading border and padding are lawfully there (`packages/essay/cases/42-clone-decoration` refused the first spelling of this, which read the box's top against the fragment's and shifted a cloned border off the page). A grid gives its spent tracks and gaps, and a separated table the spacing above the row its page resumes at.
 *
 * @remarks Exported for a host that reads the same report (*the engine knows no view*). A report whose boxes have no `artifact` sibling, as a host's that repeats no header, never takes the branch for the repeated header's copy.
 *
 * @param box - The resumed box, as the report holds it.
 * @param report - The page's report, which the repeated header's copy is looked up in.
 * @param win - The window whose `getComputedStyle` answers for a level's source.
 */
export function gapAbove(box: Box, report: ReturnType<typeof takeReport>, win: Window) {
  let gap = 0;
  for (let child = box, a = box.parent; a; child = a, a = a.parent) {
    const cs = win.getComputedStyle(a.el);
    // A copy the engine repeats ahead of the child (the table's header) is furniture with a footprint, not a spent lead (*the header repeats*): the level owes only what stands above the copy, which under separated borders is the table's `border-spacing` above its first row, and Chromium draws none above a repeated header (*a repeated header joins the rows as Chromium prints them*, 2026-10-22). Under collapsed borders the copy's top is the table's own and nothing is owed.
    if (standsAfterArtifact(child.el)) {
      // The header's copy, never a footer's: the siblings are in display order, where a footer stands after the rows wherever it is written (*the-word-space-follows-the-table-display-order*).
      let copy = cs.borderCollapse === 'separate' ? artifactBefore(child.el) : null;
      while (copy && !/^THEAD$/i.test(copy.tagName)) copy = artifactBefore(copy);
      const box = copy ? report.boxOf(copy) : null;
      if (box) gap += box.rect.top - (a.rect.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0));
      continue;
    }
    gap += child.rect.top - (a.rect.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0));
  }
  return gap;
}

/**
 * The effective page name of the deepest in-flow block that begins where a box does (css-page-3 §8.1): down the box's first in-flow block child while no run of words stands before that child, then `effectivePageName` from the box found. A first in-flow block child begins exactly where its parent does (§3.1.1's own coincidence), so the deepest box that starts the page is the end of the first-child chain.
 *
 * @remarks The driver's `nameAt` asks this of a cut that resumes at a box whole, with the position index's word counts for `runBefore`; a host with no index passes its own reading of the same question (*the engine knows no view*). Two reads are the host's: how a box's style is asked, and whether a run stands before a child.
 *
 * @param el - The box the page begins in.
 * @param reads.runBefore - Whether a line of words stands before `child` in `parent`, which is the page's first content and the container's.
 * @returns `''` for the unnamed page.
 */
export function pageNameDownFrom(el: Element, { styleOf, runBefore, blockChildren = blockChildrenOf }: { styleOf: (el: Element) => CSSStyleDeclaration; runBefore: (parent: Element,child: Element) => boolean; blockChildren?: typeof blockChildrenOf; }): string {
  for (;;) {
    const next = blockChildren(el).find((c) => !isOutOfFlow(styleOf(c)));
    if (!next || runBefore(el, next)) break;
    el = next;
  }
  return effectivePageName(el);
}

/**
 * Read the document's @page geometry from the CSSOM — every sheet the document wears, adopted ones included, and the rules inside its layers and conditions (`capture.ts`'s `pageRulesOf`). Returns page and content box sizes in px.
 *
 * **Margins only, and that is now a stated limit rather than the whole story** *(a page box has a border and a padding, 2026-09-07)*. The capture models a page's `border` and `padding` and subtracts both from the page area; this reader does not, so a document declaring either gets a content box too large here. Its one caller is `packages/essay`'s benchmark, over a corpus that writes `size` and margins into its page rules and nothing else — so the difference is unreachable there. It is not widened rather than left quietly wrong: this is the legacy single-geometry reader, and a second implementation of the page area is exactly what `readGeometryTable` exists to be the only one of.
 */
export function readPageGeometry(doc: Document) {
  const { layered, unlayered } = pageRulesOf(doc);
  for (const rule of [...unlayered, ...layered]) {
    const text = rule.cssText;
    const size = /size:\s*([^;}]+)/.exec(text)?.[1].trim().split(/\s+/) ?? [];
    const marginRaw = /(?:^|[\s{;])margin:\s*([^;}]+)/.exec(text)?.[1].trim().split(/\s+/) ??
      ['top', 'right', 'bottom', 'left'].map((side) => new RegExp(`margin-${side}:\\s*([^;}]+)`).exec(text)?.[1].trim() ?? '0px');
    if (size.length === 0) throw new Error('@page without an explicit size — the corpus always pins geometry (I5)');
    const [w, h] = size.length === 1 ? [size[0], size[0]] : size;
    const [mt, mr = mt, mb = mt, ml = mr] = marginRaw;
    const pageW = toPx(w);
    const pageH = toPx(h);
    const margins = { top: toPx(mt), right: toPx(mr), bottom: toPx(mb), left: toPx(ml) };
    return { pageW, pageH, margins, contentW: pageW - margins.left - margins.right, contentH: pageH - margins.top - margins.bottom };
  }
  throw new Error('no @page rule found');
}

const isForced = ( value: string) => ['page', 'left', 'right', 'recto', 'verso'].includes(value);

/** How many spreads above the mean page the Cast-off feeds the next one (*the Cast-off bounds the feed*, 2026-09-26; the mean and its spread since 2026-10-08). A knob, and only a price: a bound too small pours a page twice, one too large lays out more than it reads, and neither can move a cut. */
const CAST_OFF_SPREADS = 2;

/** Words added to every bound, so an account of one page — whose spread is zero — still feeds past that page's own count, and so a bound read off the page before (`readAhead`) still reaches past the box it names when the next page's layout moves a little. */
const CAST_OFF_FLOOR = 20;

/** What a character is worth in em when page one is estimated from its own size (*first-load feeding*, 2026-10-11): half an em, a Latin text face's average advance. A knob, and only a price, like the spread. */
const CAST_OFF_CHARACTER_EM = 0.5;

/** Characters in an average word of the first-page estimate, the space after it included: five letters and a space. */
const CAST_OFF_WORD_CHARACTERS = 6;

/** The margin the first-page estimate is multiplied by — the same doubling the spread gives the pages after it. A page-one estimate that falls short costs only a pour again. */
const CAST_OFF_FIRST_MARGIN = 2;

/**
 * How many words the first page's feed must reach, estimated from the page's own size and the document's type, or null where either is unusable (*first-load feeding*, 2026-10-11).
 *
 * Before page one nothing is known about words per page, but the content box and the root's `font-size` and `line-height` are: lines that fit are the content height over the line height, words in a line are the content width over `CAST_OFF_WORD_CHARACTERS` characters of `CAST_OFF_CHARACTER_EM` ems each, and the product is multiplied by `CAST_OFF_FIRST_MARGIN`. Null where the font size or the line height is not a positive finite number in pixels — *render-identical conditions* (I5) require the line height explicit, so `normal` never arrives, but a null is the whole feed, as it always was, and never a guess.
 *
 * @remarks
 * Only a bound, like every number here: a feed this estimate leaves short fails `reachesBelowTheEdge` and is poured again with the bound doubled, and a feed that is long lays out more than it reads. Neither moves a cut.
 *
 * Exported for `test/driver.test.js`.
 *
 * @param size - the content box and the root's type, all in pixels.
 */
export function firstPageWords({ contentW, contentH, fontSize, lineHeight }: { contentW: number; contentH: number; fontSize: number; lineHeight: number; }) {
  const usable = [contentW, contentH, fontSize, lineHeight].every((x) => Number.isFinite(x) && x > 0);
  if (!usable) return null;
  const perLine = contentW / (CAST_OFF_CHARACTER_EM * fontSize * CAST_OFF_WORD_CHARACTERS);
  return Math.ceil((contentH / lineHeight) * perLine * CAST_OFF_FIRST_MARGIN);
}

/**
 * How far past the cursor the next feed must reach, in words, read off the account so far — or null, where the feed is to be whole (*the Cast-off bounds the feed*, 2026-09-26).
 *
 * The mean words a page moved, plus `CAST_OFF_SPREADS` standard deviations, plus `CAST_OFF_FLOOR` — over every page so far that was not blank and moved a word, a page's words being its entry's `pos` less the one before it, the first page's start being word zero. Null on page one, which has no page before it, and wherever no page has moved a word yet, which leaves nothing to estimate from — the caller then asks `firstPageWords`.
 *
 * @remarks
 * Until 2026-10-08 the number was three times the words the last page moved, and a page after one that moved no words was fed whole. Simulated over the page counts of three real documents (the BGD manual, BelType's manual, a plain 15 500-word text) the mean and its spread laid out 22–42% fewer words with as few pours or fewer on the uneven ones: tight where pages are alike, generous where they vary, which one page's count cannot tell. A page after a wordless one — a monolith's slice, a page a float filled — is now bounded by the pages before it, and the check below pours it again if that falls short.
 *
 * Exported for `test/driver.test.js`.
 */
export function castOffWords(account: { pos: number|null; blank: boolean; }[]) {
  let n = 0;
  let sum = 0;
  let squares = 0;
  let prev = 0;
  for (const entry of account) {
    if (entry.pos == null) continue;
    const moved = entry.pos - prev;
    prev = entry.pos;
    if (entry.blank || moved <= 0) continue;
    n++;
    sum += moved;
    squares += moved * moved;
  }
  if (!n) return null;
  const mean = sum / n;
  return Math.ceil(mean + CAST_OFF_SPREADS * Math.sqrt(Math.max(0, squares / n - mean * mean)) + CAST_OFF_FLOOR);
}

/**
 * The parity a forced break value demands of the page that resumes, or null where it demands none (*a parity is worth a page*, 2026-09-07).
 *
 * css-break-3 §3.1 spells all four out: `left` and `right` force one or two page breaks so that the next page is formatted as a left or a right page; `recto` and `verso` name the page that is second and first *in a page spread, according to the page progression*. This engine derives parity from the page number with page one a right page, which IS css-page-3 §3.3's left-to-right progression — so here recto is right and verso is left. The two readings are one decision and must move together: the day a right-to-left progression is modelled, this function and `parityAt` below change in the same edit or the engine will be describing two different documents.
 */
export const parityOf = (value: string): 'left'|'right'|null => (value === 'left' || value === 'verso' ? 'left' : value === 'right' || value === 'recto' ? 'right' : null);

/**
 * css-break-3 §4.3's combination rule, and it is one line because the section is: *"When multiple forced break values apply to a single break point, they combine such that all types of break are honored. When left, right, recto, and/or verso are combined, the value specified on the latest element in the flow wins."*
 *
 * So a later parity replaces an earlier one, and a value carrying no parity — a plain `page`, or a named-page switch, which §4.3 makes forcing under another name — honours the parity beside it rather than cancelling it. That is what *all types of break are honored* says when one of the two types is unqualified: a page break and a left page break combine into a left page break.
 *
 * Exported for `test/driver.test.js`, which pins the rule DOM-free; nothing else calls it from outside.
 */
export const combineParity = (earlier: 'left'|'right'|null, later: 'left'|'right'|null) => later ?? earlier;

/**
 * The grab's one question (*the grab descends*, 2026-09-03): what is the first forcing event strictly after the cursor? An event is a flat word position plus its kind, and there are three sources, all of them css-break-3 §4.1 class A points — a forced `break-before` at a box's start word, a forced `break-after` on the box before it, and a named-page switch (§4.3) at the start word of the first box whose effective page name differs from this page's.
 *
 * **An event is always the start of the box that resumes, never the end of the box that closes**, which is why a forced `break-after` is carried forward as `pending` and spent on the next box the walk reaches rather than emitted at its own end edge. The two are the same word position and not the same place: the cursor is a `(block, word)` pair, `nameAt` reads the block tree at it, and the end of block *b* and the start of block *b+1* read different sides of the seam. Measured the moment it was got wrong — the specimen's second table of contents ends with `break-after: page`, and a cursor left at that nav's end made the first paragraph of the chapter after it look like a named-page switch, forcing a page nobody asked for. Deferring also retires the document-end guard: a `break-after` with nothing after it reaches no next box and so commands nothing, which is the old item-granular grab's own silence (it read `items[i - 1]` and never the last item) kept rather than replaced.
 *
 * This used to be a loop over consecutive feed items, and a feed item is a top-level block — so a command declared on a descendant was invisible, which is every heading in every BelType document since the belt began wrapping them in sections. The law (*no forced break lies inside an interval*, C1) always required this reading; the mechanism was narrower than the law. Descending closes it at word granularity, and §3.1.1's child→parent propagation falls out as a corollary rather than as walks: a `break-before` on a first in-flow child sits at the same word position as its container's start edge, and a `break-after` on a last in-flow child at the same position as its container's end, so the descent finds both where a promotion would have put them. `forcedBreakAfter` — the third of the rule's four walks, and the only forced one ever built — is deleted for exactly that reason.
 *
 * What the walk refuses to enter, each for its own citation: an absolutely positioned box (§3.1's must not — it neither carries forcing nor receives it, and §4.3's name switch is forcing under another name), a float's interior (§2.1 — a forced break inside a parallel flow does not affect the content outside it), and a monolith's interior (*the line box is the atom*, I3, and §4.1 in as many words: a forced break inside monolithic content must be ignored). A float's and a monolith's own commands are still read, which keeps case 14's declared §3.1 divergence exactly where the sixth round left it — except `break-after` on an out-of-flow box, which `forcedBreakAfter` never read either and which this walk goes on not reading rather than changing two things at once.
 *
 * `namesOnly` answers the composition region's version of the question. A name switch is the only forcing that changes the measure, so it is the only forcing a region must stop at: lines past a forced break are composed at the right width and merely unused.
 *
 * The event must lie strictly after the cursor, and "after" is asked of the address — see the paragraph below, and the two seams it was measured on. That is the old loop's `i = 1` said in the tree: the box a page begins with never breaks before itself.
 *
 * **The walk is taken once, at intake, and the page asks the list it leaves** (*the page asks the index*, 2026-09-25; `documentOpsOf` is the precedent — one walk, the reads injected, testable over a plain object tree). The walk is the old per-page one exactly: the same order, the same refusals, and per box it records what that walk read on every page — its address, minted once because the source is never written (*the source document is never written*, C5); its effective page name; whether its `break-before` and `break-after` are forced and with what parity; and where its subtree ends. The old walk cost the BGD manual 66 ms a page whatever the cursor, at about 37 style reads per element (`packages/essay/RESULTS.md`), and found forcing on 3 pages of 133.
 *
 * "Strictly after the cursor", asked of the address, and the difference is not pedantry either time it was measured.
 *
 * It was asked of the flat position once, and a shell or end-gap cut leaving the cursor at block b's last word shares that position with block b+1's first — so the comparison answered *not after* about a box the page had not begun with and dropped its `break-before`, five seeds moving from `agree` to `legal-divergence` in exactly the neighbourhoods where a Class C end-gap cut precedes a forced block. Asking the block-and-word pair closed that and left the other half open: two wordless boxes in a row share one word position too, so a forced box standing behind one of them was silently never found. An address tells them apart, because they are two places.
 *
 * **What a page asks, in three steps, and why each is the walk's own answer.** First the box the walk would first see strictly after the cursor: a binary search, because a bare address never precedes the one before it in walk order (normalising drops trailing zeros and cannot reorder two paths). Then what is pending into it: the forced `break-after`s whose subtree closes exactly in front of it — `closing[s]`, combined deepest first where several close at once, so an outer container's parity replaces an inner one's. A box that closes there is the box the cursor is in, or at the start of, ending as the found box begins; one that closed earlier was spent at its own boundary (*a box is not its first child*, 2026-09-26). The old walk, and the index until that date, asked the address instead — *a box whose address is a prefix of the cursor's* — and an address cannot tell a box from its first child, so a first child's `break-after` was spent again on every page inside its parent: four pages for case 64's two. Last, if that first box forces nothing, the walk goes on with nothing pending, and every box it reaches from there is after the cursor — so the next event is the next box that switches name, forces a `break-before`, or has a forced `break-after` close just in front of it, all three precomputed. The worked example is the two decision records'; a random differential against the old walk agreed on 4.5 million questions before it was deleted, and the subtree rule departs from it exactly where the prefix read a first child's `break-after` again.
 *
 * **The same list answers the Cast-off** (*the Cast-off bounds the feed*, 2026-09-26), because it is already every in-flow box in walk order with its address and its subtree's end, which is what a place to cut a feed needs. Two more facts are recorded per box for it: the word position its start sits at, `posOf`'s answer, which never decreases in walk order; and the outermost box around it the bound never cuts inside (`stonehand.js`'s `neverCutInside`), where there is one. `boundAt` below is the question.
 *
 * @param blocks - the top-level blocks, in document order.
 */
export function forcingIndexOf(blocks: Element[], { styleOf, pageNameOf, cutOf, posOf, posOfCut = null, isMonolith: monolith = isMonolith, blockChildren = blockChildrenOf, extentOf = null }: { styleOf: (el: Element) => CSSStyleDeclaration; pageNameOf: (el: Element) => string; cutOf: (el: Element,b: number,word?: number|null) => Address; posOf: (el: Element,b: number) => number; posOfCut?: ((cut: Address) => number)|null; isMonolith?: typeof isMonolith; blockChildren?: typeof blockChildrenOf; extentOf?: ((el: Element) => { before: number; count: number; })|null; }) {
  const events: ForcingEvent[] = [];
  const blockStart: number[] = [];
  /**
   * @param [rowish]
   */
  const visit = (el: Element, b: number, sealedBy: number, rowish: boolean = false) => {
    const st = styleOf(el);
    if (isAbsolutelyPositioned(st)) return; // §3.1's must not: it neither carries forcing nor receives it, so it is not an event at all
    const parallel = isOutOfFlow(st);
    const e: ForcingEvent = { b, el, cut: cutOf(el, b), name: pageNameOf(el), before: isForced(st.breakBefore), beforeParity: parityOf(st.breakBefore), after: false, afterParity: null, end: 0, pos: posOf(el, b), inFlow: !parallel, sealedBy, rowish };
    const k = events.length;
    events.push(e);
    const inner = sealedBy >= 0 ? sealedBy : neverCutInside(el, st) ? k : -1;
    if (!parallel && !monolith(el, st)) {
      const kids = blockChildren(el);
      const runs = !!extentOf && holdsAnonymousBlocks(st.display ?? '');
      const row = rowish || SIDE_BY_SIDE.has(st.display ?? '');
      for (let i = 0; i < kids.length; i++) {
        visit(kids[i], b, inner, row);
        if (!runs) continue;
        // A run of lines after this child is an anonymous block box, and the box a forced `break-after` closing here is pending into: an event at its first word, in the word space of the box that holds it (*the anonymous box is in the procession*). Words standing between the child's end and the next child's start, or this box's end, are the run; none is no box.
        const ext = extentOf as NonNullable<typeof extentOf>;
        const own = ext(el);
        const done = ext(kids[i]);
        const word = done.before + done.count;
        const next = kids[i + 1];
        if ((next ? ext(next).before : own.before + own.count) <= word) continue;
        events.push({ b, el, cut: cutOf(el, b, word - own.before), name: e.name, before: false, beforeParity: null, after: false, afterParity: null, end: events.length + 1, pos: e.pos + word - own.before, inFlow: true, sealedBy: inner, rowish: row, runAfter: kids[i] });
      }
    }
    e.after = !parallel && isForced(st.breakAfter); // a float's own break-after was never read, and still is not
    e.afterParity = parityOf(st.breakAfter);
    e.end = events.length;
  };
  for (let b = 0; b < blocks.length; b++) {
    blockStart.push(events.length);
    visit(blocks[b], b, -1);
  }
  const n = events.length;
  // What the walk carries as `pending` into event k from the boxes that close just in front of it: those whose subtree ends at k, deepest first — a larger index is a deeper box — so the outermost's parity is the one that stands.
  const closing: ({ parity: 'left'|'right'|null; }|null)[] = new Array(n + 1).fill(null);
  for (let j = n - 1; j >= 0; j--) {
    const e = events[j];
    if (e.after) closing[e.end] = { parity: combineParity(closing[e.end]?.parity ?? null, e.afterParity) };
  }
  const nextForced = new Array(n + 1).fill(n);
  for (let k = n - 1; k >= 0; k--) nextForced[k] = closing[k] || events[k].before ? k : nextForced[k + 1];
  const nextName = new Array(n + 1).fill(n);
  for (let k = n - 2; k >= 0; k--) nextName[k] = events[k + 1].name !== events[k].name ? k + 1 : nextName[k + 1];
  const hit = (k: number, pending: { parity: 'left'|'right'|null; }|null, name: string, namesOnly: boolean) => {
    const e = events[k];
    const before = !namesOnly && e.before;
    // §4.3's combination at the one break point where two forced values meet: the `break-after` pending into the box, and the box's own `break-before`, the later element in the flow, whose parity wins where it has one. The address is a copy, so no page can reach into the index through it.
    return { b: e.b, namedSwitch: e.name !== name, el: e.el, cut: { ...e.cut, path: [...e.cut.path] }, parity: combineParity(pending?.parity ?? null, before ? e.beforeParity : null), rowish: e.rowish, runAfter: e.runAfter };
  };
  /** The first event strictly after the cursor — a binary search, because a bare address never precedes the one before it in walk order — or `n` where there is none. */
  const firstAfter = ( cursorCut: Address) => {
    const fromB = cursorCut.path[0];
    if (!(fromB < blocks.length)) return n;
    let lo = blockStart[fromB];
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cutAfter(events[mid].cut, cursorCut, posOfCut)) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
  return {
    size: n,
    /** The first forcing event strictly after `cursorCut` for a page named `name`, or null. */
    find(cursorCut: Address, name: string, { namesOnly = false }: { namesOnly?: boolean; } = {}) {
      const s = firstAfter(cursorCut);
      if (s >= n) return null;
      // Pending into s: the forced break-afters whose subtree closes exactly in front of it — never one that closed earlier, which was spent where it fell (*a box is not its first child*).
      const pending = namesOnly ? null : closing[s];
      if (pending || events[s].name !== name || (!namesOnly && events[s].before)) return hit(s, pending, name, namesOnly);
      const k = s + 1;
      if (k >= n) return null;
      const f = Math.min(events[k].name !== name ? k : nextName[k], namesOnly ? n : nextForced[k]);
      return f < n ? hit(f, namesOnly ? null : closing[f], name, namesOnly) : null;
    },
    /**
     * The Cast-off's place (*the Cast-off bounds the feed*, 2026-09-26): the first block boundary strictly after `cursorCut` whose word position is at least `pos`, where a feed may be cut without moving any box before it — or null, where no such place is left and the feed is the whole remainder.
     *
     * Found in two steps and one rule. The first box strictly after the cursor, as `find` finds it; then the first box from there whose start is at or past `pos`, a second binary search, since word positions never decrease in walk order. The rule: the place is the start of an in-flow box standing inside no box the bound never cuts inside. Where the box found stands inside one, the place moves to the first box after the outermost such box's subtree — past the whole table, the whole flex container — and where it is itself a float, to the first box after the float's own subtree, since a float inside a line stack stands between two of its lines. Moving only ever goes forward, so the feed only grows: the rule can cost work and never a verdict.
     */
    boundAt(cursorCut: Address, pos: number) {
      let lo = firstAfter(cursorCut);
      let hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (events[mid].pos >= pos) hi = mid;
        else lo = mid + 1;
      }
      for (let k = lo; k < n; ) {
        const e = events[k];
        if (e.sealedBy >= 0) k = events[e.sealedBy].end;
        else if (!e.inFlow) k = e.end;
        else if (e.runAfter) k++; // a run's place is the grab's alone: the Cast-off cuts at a box, and moving forward only grows the feed
        else return { b: e.b, el: e.el, cut: { ...e.cut, path: [...e.cut.path] } };
      }
      return null;
    }
  };
}

/**
 * The element children of `root` (the body, unless a host names another) minus engine scaffolding — every top-level box the document declares, in or out of the flow. The two functions below divide it.
 *
 * @param root - the element the boxes stand in.
 */
function topLevelBoxes(doc: Document, root: Element = doc.body) {
  return [...root.children].filter((el) => !el.id.startsWith('__beltype') && !['STYLE', 'SCRIPT'].includes(el.tagName));
}

/**
 * The document's top-level blocks — the flow, which is what the cuts divide. One definition, shared by the build loop and the differential's judge measure.
 *
 * **A host that holds the document's boxes in an element of its own names it** (`root`, defaulting to the body, as the CLI's intake reads them; see CHANGELOG 2026-10-28): the boxes are that element's children, and the answer is otherwise the same.
 *
 * **A `position: fixed` box is not among them** (*the box on every page*, 2026-09-07). CSS 2.1 §9.3.1 renders it *"on every page"* and forbids paginating its content; the Model's answer for it is therefore **zero** — the same answer chrome gets — and zero footprint means no position in the word space, no place in the feed, and nothing for the Stonehand to rank. It is the Furniture's, delivered per page, and the flow behaves exactly as it would if the element were not in the document. Which is what §9.6.1 means and what `cases/24-the-repeated-box` measures: the boundaries are the ones the flow alone would have produced.
 *
 * @param root - the element the boxes stand in.
 */
export function topLevelBlocks(doc: Document, root: Element = doc.body) {
  const win = (doc.defaultView as Window);
  return topLevelBoxes(doc, root).filter((el) => !isFixedBox(el) && !runningIdentOf(win, el));
}

/** The identifier a `position: running()` declaration named, as the host rewrote it, or null. `word-space.js`' `isFixedBox` and `document-state.js`' walk read the same property for a yes or no. */
export const runningIdentOf = ( win: Window,  el: Element) => (win.getComputedStyle(el).getPropertyValue(RUNNING_PROP) || '').trim() || null;

/**
 * The document's running elements, at any depth — GCPM §1.2's third thing that reaches a page from outside the flow (*the host rewrites what the parser drops*, 2026-09-14).
 *
 * §1.2.1: `running()` *"removes the element … from the normal flow, and makes it available to place in a page margin box using `element()`"*. So its footprint is zero, exactly as a fixed box's is and for the same reason — no position in the word space, no place in the feed, nothing for the make-up to rank — and the flow divides precisely where the same document without the element would divide it. It is authored content rather than a resolved value, so *content is one document* (I6) reaches it: it is slotted into the margin cell, not written into one as text.
 *
 * **At any depth since 2026-10-21, by the fixed box's own mechanism** (*a running element is a named node*, amended; `cases/119-the-running-element-inside-a-block`). §1.2.1 says nothing about where the element was declared, and an editor that wraps every block in a `<section>` of its own puts a running element written at the top of the file one level down, where reading the top level alone left it in the flow. `word-space.js`' `isFixedBox` answers a running element too, so the word space, the feed, the presentation and `blockChildrenOf` take it out where they take a nested fixed box out, and this walk stops at a fixed box, which carries what it holds.
 *
 * **Every one of them, in document order** (*a running element is a named node*, 2026-10-21): two elements of one name are two assignments of it, and which one a page shows is GCPM §1.2.3's keyword arithmetic over their positions (`document-state.js`), so this keeps its one job — taking them out of the flow — and decides nothing about which is shown where. Each carries where the flow resumed after it, read here because a host's intake moves the elements: `next`, the next in-flow element after it inside its top-level block, and `block`, that block, or where nothing follows it there, the block the flow goes on with (`blocks.length` after the last); `runningPosition` turns the two into the flat position its assignment is logged at.
 *
 * **The element the boxes stand in is a parameter** (`root`, the body by default; see CHANGELOG 2026-10-28): a host that holds the boxes in an element of its own asks of that element, and `keep` stays the second argument it always was.
 *
 * @param keep - the memo's door (`forcing-memo.js`): what each top-level box holds is kept per box, its block number laid on when the parts are put end to end, so a box an edit did not replace is not walked again (*a resumed run keeps its reads*). Absent, every box is walked.
 * @param root - the element the boxes stand in.
 */
export function runningBoxes(doc: Document, keep: Keep|null = null, root: Element = doc.body): { el: Element; name: string; block: number; next: Element|null; }[] {
  const win = (doc.defaultView as Window);
  const out: { el: Element; name: string; block: number; next: Element|null; }[] = [];
  /** The next in-flow element after `el` inside `holder`, in document order, or null where the flow leaves the block first. */
  const nextInFlow = (el: Element, holder: Element) => {
    for (let e = el; e && e !== holder; e = (e.parentElement as Element)) {
      for (let s = e.nextElementSibling; s; s = s.nextElementSibling) if (!isFixedBox(s)) return s;
    }
    return null;
  };
  const walk = (el: Element, holder: Element, found: { el: Element; name: string; next: Element|null; }[]) => {
    for (const child of el.children) {
      const name = runningIdentOf(win, child);
      if (name) found.push({ el: child, name, next: nextInFlow(child, holder) });
      else if (!isFixedBox(child)) walk(child, holder, found); // a fixed box carries what it holds
    }
    return found;
  };
  /** One top-level box: its own running name, whether it is a block (by `topLevelBlocks`' own filter), and the running elements inside it. */
  const read = (el: Element) => {
    const name = runningIdentOf(win, el);
    const block = !name && !isFixedBox(el);
    return { name, block, inside: block ? walk(el, el, []) : [] };
  };
  let block = 0;
  for (const el of topLevelBoxes(doc, root)) {
    const part = keep ? keep('running', el, () => read(el)) : read(el);
    if (part.name) out.push({ el, name: part.name, block, next: null });
    if (!part.block) continue;
    for (const r of part.inside) out.push({ ...r, block: r.next ? block : block + 1 });
    block++;
  }
  return out;
}

/**
 * The flat position a running element is assigned at: where the flow stood when it was written, the first word after it (*a running element is a named node*, 2026-10-21).
 *
 * @remarks
 * `runningBoxes` took the place at intake, while the document was in its own order: the next in-flow element after it inside its block, or the block the flow goes on with. A host's intake then moves the running elements out of their places, which is why the place is taken before it. Text between the element and that next element is counted before it, so a running element written mid-sentence is assigned at the end of the sentence's run of text, a stated limit no document has asked about.
 */
export const runningPosition = ({ block, next }: { block: number; next: Element|null; }, index: { bases: number[]; wordsBefore: (el: Element) => number; }): number => index.bases[block] + (next ? index.wordsBefore(next) : 0);

/**
 * The document's top-level fixed boxes — the Furniture's second input (tablet, The Page; architecture, The Furniture).
 *
 * Two kinds reach a page from outside the flow and they differ by one word of *content is one document* (I6): a resolved value is not informational and goes to the page's own cells, an authored box is informational and stays light DOM, slotted. This is the second.
 *
 * **At any depth since 2026-09-15** ([*a fixed box at any depth*](../../../.claude/decisions/cicero/a-fixed-box-at-any-depth.md)). This read `doc.body.children` and said so as a limit; CSS 2.1 §9.6.1 says *"for paged media, boxes with fixed positions are repeated on every page"* and says nothing about where the box was declared, so depth was never in the sentence. A nested one used to travel with its block and be repeated by the browser's own print against the sheet, where the venue's reader files it as a margin item rather than as words — `cases/46-the-nested-fixed-box` found it on no page at all.
 *
 * **Zero footprint costs a removal at depth, and the removal is on clones.** A top-level box gets it free: `topLevelBlocks` does not return it, so nothing assigns it and the original stays unrendered. A nested one sits inside a block that is assigned, so it leaves the word space (`positions.js`' `indexBlocks` skips the subtree), the feed (`buildFeed` strips every clone) and the presentation (`root.js` presents a holding block as a stripped clone). The source is untouched throughout, which is *the source document is never written* (C5) and is what lets this be delivered from the source per page.
 *
 * A fixed box inside another fixed box is not returned: its ancestor carries it, and delivering both would draw it twice.
 */
export function fixedBoxes(doc: Document): Element[] {
  const win = (doc.defaultView as Window);
  const out: Element[] = [];
  const walk = ( el: Element) => {
    for (const child of el.children) {
      if (child.id?.startsWith('__beltype') || ['STYLE', 'SCRIPT'].includes(child.tagName)) continue;
      if (isFixedBox(child)) { if (!runningIdentOf(win, child)) out.push(child); } // a running element is out of the flow by the same predicate, and is `runningBoxes`' to deliver
      else walk(child);
    }
  };
  walk(doc.body);
  return out;
}

import type { Address } from './positions.ts';
import type { Laid } from './reads.ts';

/** What a resumed run needs of the run before it: its Ledger, its account, the table of read values it was cut under, and how many top-level blocks it saw. */
export type Prior = {
  ledger: Ledger;
  account: any[];
  delivered: Map<string, Map<string, string>> | null;
  /** the page facts the prior layout was cut under, per page (*the page carries its conditions*): a resumed run starts from them. */
  facts?: PagePublish[] | null;
  blockCount: number;
  /** the words each box's elements got (`has-words.js`), so a box whose words moved while its entry key did not is told apart from one that did not change. */
  hasMarks?: HasMarks;
  /** every top-level block's border-box height as the run measured it (*a box announces its own size*, 2026-10-21): what the seam's rim compares a presented original's observed size with. */
  heights?: Map<Element, number>;
  /** the run before this one stopped at a page and was never taken to the document's end (`pace`, below): its Ledger is the pages cut so far, and a resumed run that converges inside it goes on cutting from the last of them. */
  incomplete?: boolean;
};

/** What a run offers a host that paces it, after every page of its first layout: how many pages are cut, the live account (grown by the run, never by the host), the position index, and what a host needs to decide whether to go on or to let go. */
export type Progress = {
  /** the pages cut so far, kept pages of a resumed run included. */
  pages: number;
  /** the account, one row per page, its `closes.strings` filled for every page cut. */
  account: any[];
  index: ReturnType<typeof indexBlocks>;
  /** whether the page that holds the first word of the source element `el` is cut. An element the position index does not hold answers true: there is nothing to wait for. */
  held: (el: Element) => boolean;
  /** which pages a resumed run has cut again so far (the result's `resumed`, as it stands now), or null for a run that resumed nothing. */
  resumed: { from: number, to: number, shift: number, converged: boolean, kept: number } | null;
  /** the pages cut so far as a {@link Prior}, `incomplete`, for a host that abandons the run and resumes from what it has. */
  snapshot: () => Prior;
};

/**
 * Which part of a run's conditions moved, in a plain sentence — the `why` of a run that could not resume because its conditions were not the previous run's (*say why a run did not resume*, 2026-10-08).
 *
 * @remarks
 * The two strings are the seam's `conditionsKey` readings, a JSON array of the viewport's width and height, the device pixel ratio, whether the colour scheme is dark, the text of every stylesheet the document wears, how many font faces had finished loading when the run began, and how many presenters were registered. A stylesheet is named by its position unless the caller supplies a label for it, and a list that changed length is said as a count, since a position means nothing then.
 *
 * @param labels - a name for each sheet in `after`, in order.
 */
export function describeConditions(before: string, after: string, labels: string[] = []): string {
let a: any[];
let b: any[];
  try { a = JSON.parse(before); b = JSON.parse(after); } catch { return 'the render conditions changed'; }
  const parts: string[] = [];
  if (a[0] !== b[0] || a[1] !== b[1]) parts.push(`the viewport went from ${a[0]}×${a[1]} to ${b[0]}×${b[1]}`);
  if (a[2] !== b[2]) parts.push(`the device pixel ratio went from ${a[2]} to ${b[2]}`);
  if (a[3] !== b[3]) parts.push(`the colour scheme went from ${a[3] ? 'dark' : 'light'} to ${b[3] ? 'dark' : 'light'}`);
  if ((a[5] ?? 0) !== (b[5] ?? 0)) parts.push('a font face finished loading');
  if ((a[6] ?? 0) !== (b[6] ?? 0)) parts.push('a presenter was registered');
  const sa = a[4] ?? [];
  const sb = b[4] ?? [];
  if (sa.length !== sb.length) parts.push(`the document wore ${sa.length} stylesheet${sa.length === 1 ? '' : 's'} and now wears ${sb.length}`);
  else {
    const moved: number[] = sb.flatMap(( text: string,  i: number) => (text !== sa[i] ? [i] : []));
    if (moved.length) parts.push(`${moved.length === 1 ? 'stylesheet' : 'stylesheets'} ${moved.slice(0, 3).map((i) => labels[i] ?? `#${i + 1}`).join(', ')}${moved.length > 3 ? ` and ${moved.length - 3} more` : ''} changed`);
  }
  return `the render conditions changed: ${parts.join('; ') || 'a part this engine cannot name'}`;
}

/**
 * Paginate the document on screen: measure with the measure context, adjudicate with the Stonehand, write the Ledger. Returns the ledger plus a serializable account of the run for the differential.
 *
 * **THE READS are settled here, around the run** (*a pointer is a read*, 2026-10-03): `settleReads` (`reads.js`) delivers every written and cascade read before the first run, reserves every forward page read at `0`, runs, delivers the true pages, and lays the document out again only where a delivered number moved a line, resumed from the first page holding a moved box (*delivery resumes from the moved page*, 2026-10-21) — three runs at most. This is the one door every host enters by — the seam's client, the essay's, the editing tools' frame — so all of them get the loop without knowing it is there. A document that declares no read runs once, as it always did, and its result carries `reads: null`.
 * @param doc - the case document, live; its body's element children (minus engine scaffolding) are the top-level blocks — unless `opts.blocks` hands them over.
 * @param opts - **`blocks`, `running`, `originals` and `table` are the intake's, handed back** (*the run resumes from an entry*, build one, 2026-10-08): a host that has already presented the document no longer has its blocks among `doc.body.children` (they are the root's light children now) and no longer has the author's margin-box `content` in the CSSOM (the presentation cleared it), so it passes the lists and the table it took at intake and the run reads neither from the live document. `originals` is every top-level box the intake took (blocks, fixed boxes, running elements): the searches that look for pictures and for references ask them and never the page copies the presentation made of them (2026-10-08). Absent, the run reads both as it always did, which is every fresh run. composed: the Compositor owns every line — each page's name region is composed at that page's width (cache keyed by the paragraph — its path, its markup, the content width and the per-block inputs, `composition-key.js`; the re-homing of *cut-invariance* (C7) is a cache hit, and so is a paragraph of a later run's new tree) and every feed clone carries the materialized hints. **`prior` and `dirtyAt` make the run resume** (*the run resumes from an entry*, build two, 2026-10-08): `prior` is a previous call's result for this same document and `dirtyAt` the address of the box that was edited since; `edited` names every other box replaced since the prior run, if any (amended 2026-10-15, beltype#48), and the run restarts before the earliest of them all and converges only past the last. The run restarts one page before the page holding that address, with the prior Ledger kept before it, and stops at the first page whose entry has the key a prior page's entry had and whose addresses lie clear of the edit; the prior pages after that one are kept, their addresses unchanged and their page numbers shifted by the pages the run added or removed. What the edit may not touch is the document's structure above and beyond the edited box — the caller's promise, which the tree cannot check — and the run's conditions: a changed delivered read dirties the pages holding its site, and the host (`seam/client.js`) compares the rest and passes no `prior` when they moved. Absent either, the run is a fresh one from page one, exactly as before. The result's `resumed` says which pages were cut again, and `why` — set exactly when `resumed` is `null` — says in a plain sentence why none were. **A resumed run's references start from the numbers the prior run left** (`settleReads`, *warm start*, 2026-10-08). **`forcingMemo` keeps the forced-break index's per-element reads across runs** (*the forced-break index is kept across runs*, 2026-10-09), **and the run-level walks' parts per top-level box** (*a resumed run keeps its reads*, 2026-10-22: the position index, the document ops, the reads' site search and counter walk, the `:has()` answers): the seam passes the memo it filled on a presented frame, the driver reports the boxes `dirtyAt` and `edited` name through its one door, settles it once against the sheets' reach (`settledMemo`) and reads through it, and each walk's own logic is the same code; absent, every read is the browser's, as before. **`pace` lets a host stop the run at a page and have it go on** (*the pages are cut as far as they are asked*, 2026-10-12): it is called after every page of the first layout, with a {@link Progress}, and the run waits for the promise it returns, so a host that returns a pending one has paused the run with its place, its measure context and its Ledger kept, and one that returns nothing has asked for no pause at all. It is not called in a layout the true page numbers sent round again (that layout is not paced, and the host shows it afterwards), and the pages a host is shown before the run is complete carry the reservations of the page reads painted invisible, the page total unknown. Absent, the run goes to the document's end without a pause, exactly as before; the promise returned resolves only there.
 */
export function paginate(doc: Document, opts: { composed?: boolean; compositionCache?: Map<string,object>; relaxDpr?: boolean; blocks?: Element[]; running?: ReturnType<typeof runningBoxes>; originals?: Element[]; table?: ReturnType<typeof readGeometryTable>; prior?: Prior; dirtyAt?: Address; edited?: Address[]; forcingMemo?: ForcingMemo|null; pace?: (progress: Progress) => void|Promise<void>; } = {}) {
  let t0 = performance.now();
  const memo = settledMemo(doc, opts);
  const keep = memo ? memo.keep : null;
  performance.measure('cicero:memo', { start: t0, end: (t0 = performance.now()), detail: { kept: !!memo } });
  // The `:has()` answers, once, before any copy exists (*one attribute has words*, 2026-10-10): the originals are asked in their real place, and the answers are seated for every copy this run makes.
  const boxes = opts.originals ?? topLevelBoxes(doc);
  const hasMarks = answerHas(doc, boxes, keep);
  performance.measure('cicero:has-words', { start: t0, end: performance.now(), detail: { boxes: boxes.length, marked: hasMarks.size, ...(memo ? { memo: memo.tally.has ?? null } : {}) } });
  return settleReads(doc, { run: (laid) => paginateOnce(doc, opts, laid, { boxes, hasMarks, memo }), blocksOf: () => opts.blocks ?? topLevelBlocks(doc), originals: opts.originals ?? opts.blocks ?? null, warm: opts.prior && opts.dirtyAt ? opts.prior.delivered : null, warmFacts: opts.prior && opts.dirtyAt ? opts.prior.facts ?? null : null, hide: !!opts.pace, keep });
}

/**
 * The memo this call reads through, settled once before any walk, or `null` (*the forced-break index is kept across runs*, 2026-10-09; *a resumed run keeps its reads*, 2026-10-22).
 *
 * The boxes a resumed call names as edited — `dirtyAt` and `edited`, resolved against the blocks as they stand now — are reported through the memo's one door, {@link ForcingMemo.replaced}, beside the boxes `patchBox` reported there: a host that edits a box in place, as the venue's pins do, replaces no element and would leave the walks' parts of its box standing. Then the memo is settled against the sheets' reach; a sheet by which a box could change an ancestor's style (`sheetReach` 2) empties it for this call, and the console says so once.
 */
function settledMemo(doc: Document, { forcingMemo = null, prior, dirtyAt, edited = [], blocks }: { forcingMemo?: ForcingMemo|null; prior?: Prior; dirtyAt?: Address; edited?: Address[]; blocks?: Element[]; }): ForcingMemo|null {
  if (!forcingMemo) return null;
  if (prior && dirtyAt) {
    const top = blocks ?? topLevelBlocks(doc);
    for (const at of [dirtyAt, ...edited]) {
      const block = top[at.path[0]];
      if (block) forcingMemo.replaced(elAtIn(block, at.path) ?? block);
    }
  }
  if (forcingMemo.settle(sheetReach(doc))) return forcingMemo;
  if (!forcingMemo.said) {
    forcingMemo.said = true;
    doc.defaultView?.console?.info('BelType/Cicero: a stylesheet uses :has(), an @container rule or a selector the engine cannot read, so the forced-break index and the run-level walks are read afresh on every run rather than kept. The pages are the same; an edit costs more.');
  }
  return null;
}

/**
 * One run: the document laid out once, from its first word to its last, or from the page an edit dirtied to the page where the run converges. A layout the reads send round again resumes from the layout before it, at the boxes whose lines the delivered values moved (*delivery resumes from the moved page*, 2026-10-21): `laid.resume` names them and that layout, and they stand in for `prior`, `dirtyAt` and `edited`.
 * @param opts - as {@link paginate}'s.
 * @param laid - what the reads loop lays this run out under.
 * @param shared - what {@link paginate} read once for every run of the call: the top-level boxes, their `:has()` words, the settled memo.
 */
async function paginateOnce(doc: Document, { composed = false, compositionCache = new CompositionCache(), relaxDpr = false, blocks: intakeBlocks, running: intakeRunning = undefined, originals = undefined, table: intakeTable, prior = undefined, dirtyAt = undefined, edited = [], pace = undefined }: { composed?: boolean; compositionCache?: Map<string,object>; relaxDpr?: boolean; blocks?: Element[]; running?: ReturnType<typeof runningBoxes>; originals?: Element[]; table?: ReturnType<typeof readGeometryTable>; prior?: Prior; dirtyAt?: Address; edited?: Address[]; forcingMemo?: ForcingMemo|null; pace?: (progress: Progress) => void|Promise<void>; } = {}, laid: Laid = { attempt: 0, delivered: null, facts: null, sites: null, index: null, because: [], resume: null }, { boxes: allBoxes = [], hasMarks = new Map<any, any>(), memo = null }: { boxes?: Element[]; hasMarks?: HasMarks; memo?: ForcingMemo|null; } = {}) {
  assertRenderConditions(doc, { relaxDpr });
  // The two rewritten GCPM declarations, registered before anything reads a computed style: unregistered, a custom property inherits, and `string-set` on a heading would reach every descendant of it (*the host rewrites what the parser drops*, 2026-09-14).
  registerGcpmProperties(doc.defaultView);
  // Once each, before the first measure — late-arriving truth never enters adjudication. one call site covers every host, because the seam's bootstrap, the editing tools' `beltype:ready` call and the venue's own client all enter through here. The images are not awaited (ruled 2026-11-08): they are made eager and the run goes on, and an arrival that changes a box is the rim's (`measure.js`'s `eagerImages` carries the reason).
  // The run keeps time in the User Timing API (*the run keeps time*, 2026-09-25): one running timestamp, one `performance.measure` per phase, `detail` carrying the count a reader normalizes by. A measure is read by nothing here and decides nothing.
  let t = performance.now();
  await awaitFonts(doc);
  performance.measure('cicero:fonts', { start: t, end: (t = performance.now()) });
  const images = eagerImages(originals ?? intakeBlocks ?? doc);
  performance.measure('cicero:images', { start: t, end: (t = performance.now()), detail: { images, awaited: false } }); // the eager pass alone: nothing is waited for since 2026-11-08

  const table = intakeTable ?? readGeometryTable(doc);
  await awaitFonts(doc, table.furnitureFaces); // the faces page furniture names, requested now and not when the first margin box is presented (the table is read after the first wait, so its lengths are measured as they always were)
  const win = (doc.defaultView as Window & typeof globalThis);
  const blocks = intakeBlocks ?? topLevelBlocks(doc);
  // The running elements and where each was written, handed back with the blocks by a host that took them at intake, for the same reason: by now the body holds the root and nothing else.
  const running = intakeRunning ?? runningBoxes(doc, memo?.keep);
  /** Whether a box outside an interval may be hollow (*the clone is hollow outside the interval*, 2026-09-27; *one attribute has words*, 2026-10-10). It may, unless a stylesheet the document wears has a `:has(` that nothing answers for: the host rewrites every `:has()` it can into a union that a `has:` word on the copy satisfies (`has-words.js`), and only an argument reading user state (`:hover`, `:checked`, `:focus-within`, `:target`, …) is left alone, with a console line from the rewrite naming the rule. Then every feed is built deep, as before, and the console says so once per run. `root.js` asks the same question of the same sheets when it presents. */
  const hollow = !sheetsUseHas(doc);
  if (!hollow) win.console?.info('BelType/Cicero: a stylesheet uses a :has() the engine cannot answer from the original (its argument reads state that changes, or the sheet was not rewritten), so every box outside a page\'s interval is kept whole rather than hollow — the author\'s :has() may look inside one. The pages are the same; they cost more to build.');
  // The position index (src/positions.js): built once over the untouched sources, it answers every offset query the loop used to re-derive by walking clones. Positions everywhere below are flat global word indices.
  const index = laid.index ?? indexBlocks(blocks, undefined, undefined, memo?.keep);
  const wordCounts = index.wordCounts;
  performance.measure('cicero:index', { start: t, end: (t = performance.now()), detail: { blocks: blocks.length, words: index.total, ...(memo ? { memo: memo.tally.index ?? null } : {}) } });

  /**
   * The one place a cut is minted, and therefore the one place a path is built (*the cut is a place in the tree*, 2026-09-18).
   *
   * There used to be three builders — one for a Class A resume, one for an end-gap shell, one for the edge's — and they disagreed about a convention nobody had written down: two counted a `position: fixed` sibling and the third filtered it out, so a shell was built on the box next door and a page of content reached no page at all (`packages/essay/cases/55-the-shell-behind-the-fixed-box`). The convention is `positions.js`' now, stated where the resolution lives: the indices count in-flow children, a fixed box among them nowhere. A clone is reached through the feed's own source → clone map, never by following an index on it.
   *
   * Normalisation applies to a bare path alone. A path carrying a word or a pixel extent names the box the cut falls inside, and dropping its last index would name that box's parent instead. And a start-edge Class C passes `gap`: its place is inside the box, past a gap that stands between the box's content edge and its first child, so a trailing zero there is a place and not padding (*the cut divides its ancestors*, 2026-09-29).
   */
  const cutTo = (el: Element, b: number, { word = null, char = 0, px = null, gap = false, rawPath = pathOf(el, blocks[b], b) }: { word?: number|null; char?: number; px?: Address['px']; gap?: boolean; rawPath?: number[]; } = {}): Address => {
    const path = rawPath;
    return { path: word == null && px == null && !gap ? normalizePath(path, noRunBefore(el, path.length)) : path, word, ...(char > 0 ? { char } : {}), px };
  };

  /**
   * Where a run stands before a first child, the trailing zero is a place (*the anonymous box is in the procession*, 2026-09-29). `normalizePath` drops a zero because before a first child is the same place as before its parent — which is false where the parent holds a line before that child: an anonymous box stands there, and before the child is after the line. So the zero stays where the parent has a word before the child, read off the position index as a difference of two counts, which is the index's own answer to *is there content before this box in its parent*. An inline image alone before the child has no word and no box (the Gauge's rule), so it counts for nothing here either.
   *
   * @param el - the box the path names
   * @param length - the path's length
   * @returns whether no word stands before the box at depth `n − 1` in its parent, so that its zero may be dropped
   */
  const noRunBefore = (el: Element, length: number): (n: number) => boolean => {
    const chain: Element[] = [];
    for (let e = (el as Element | null), n = length; n > 1 && e; n--, e = e.parentElement) chain[n - 1] = e;
    return (n) => {
      const e = chain[n - 1];
      // The count at each box's entry, the straddled word put back: a box that opens inside a word has no run before it in a parent that opens inside the same word, and has one in a parent whose own text began the word.
      const entered = ( x: Element) => index.wordsBefore(x) + (index.opensInside(x) ? 1 : 0);
      return !e || entered(e) === entered((e.parentElement as Element));
    };
  };

  /** A place the Gauge read on a clone, in the source's coordinates: `consumed` is what the clone had already shown of the leaf. A place in the clone's first word is inside the word the clone resumed in, so its characters count on from the ones already shown; anywhere later they are the word's own. */
  const inSource = (consumed: { word: number; char: number; }, at: { word: number; char?: number; }) => ({ word: consumed.word + at.word, char: at.word === 0 ? consumed.char + (at.char ?? 0) : at.char ?? 0 });

  /** The address a place in a leaf takes: a resume at the leaf's very first character is a place between boxes, and is spelled as the bare path it is. */
  const cutInLeaf = (leaf: Element, b: number, at: { word: number; char: number; }|null, px: Address['px'] = null, gap: boolean = false) => (at && (at.word > 0 || at.char > 0) ? cutTo(leaf, b, { word: at.word, char: at.char, px }) : cutTo(leaf, b, { px, gap }));

  /** The source box an address names. */
  const boxAt = ( cut: { path: number[]; }) => elAtIn(blocks[cut.path[0]] ?? null, cut.path);

  /**
   * The flat projection of an address (`positions.js`): the words before the box the path names, plus the leaf-relative word a line stack carries.
   *
   * One exception, and it is the same one the end-gap branch always carried: a cut in a container's block-end gap resumes at the box's own end, never at `wordsBefore + word` — a box that straddles in from a previous page contains the resume point, and adding its full count on top of the consumption double-counts the words already shown (seed 1 caught exactly that on the streamline round's first battery). The painted shell is the other px cut and takes the ordinary reading: the edge slices the box's graphic, and its words are not consumed at all.
   */
  const posOfCut = ( cut: Address) => {
    const b = cut.path[0];
    const el = boxAt(cut);
    if (!el) return index.posOf(b, 0); // the document's end — the one address no source element answers to
    if (cut.px != null && cut.px.paint == null) return index.posOf(b, index.wordsBefore(el) + index.wordCountIn(el) + (index.opensInside(el) ? 1 : 0));
    return index.posOf(b, index.wordsBefore(el) + (cut.word ?? 0));
  };

  /**
   * The document's own counters, read here (*a counter is read at the start of the page*, 2026-09-14; css-page-3 §6.1's scoping sentence).
   *
   * A margin box asking for an author's counter gets *"exactly … the value it would have if the page-margin box were an element within the document at the start of the page"*, so a page's chrome needs the state of the document's counters at that page's first word — and this is the one place in the engine where the source is still in its real ancestor chain, laid out, with the position index in hand. Measured on `cases/37`: after `root.append(...blocks)` an unassigned slottable still answers `getComputedStyle` for a non-inherited property like `counter-increment`, and answers its inherited properties with their initial values instead of the document's. Counters would survive that; a named string, which this walk is built to serve next, would not. So the reading is taken while nothing is in doubt.
   *
   * The ancestors are `html` and `body` — every top-level block is a body child — and they are recorded before the document's first word, which is what puts a `body { counter-reset }` in force on page one.
   */
  const documentOps = documentOpsOf(blocks, index, {
    styleOf: (el) => win.getComputedStyle(el),
    pseudoStyleOf: sheetsCountInPseudos(doc) ? (el, pseudo) => win.getComputedStyle(el, pseudo) : null,
    ancestors: [doc.documentElement, doc.body].filter(Boolean),
    running: running.map((r) => ({ name: r.name, pos: runningPosition(r, index) })),
    keep: memo?.keep
  });
  // The same walk's second reading (*the host rewrites what the parser drops*, 2026-09-14): every named-string assignment the document makes, with the position it sits at. Evaluated here, where the source is still in its real ancestor chain — `content()` is the element's own text and would come back right from an unassigned slottable, but `counter()` inside a content list would not, and neither would anything inherited.
  const assignments = stringAssignmentsOf(documentOps);
  // And the third (*a running element is a named node*, 2026-10-21): every running-element assignment, the value the element's place in `running`, which the presentation resolves to the element it slots.
  const runningAssignments = runningAssignmentsOf(documentOps);
  performance.measure('cicero:document-ops', { start: t, end: (t = performance.now()), detail: memo ? { memo: memo.tally.ops ?? null } : undefined });

  /** The grab's events, indexed here, once (*the page asks the index*, 2026-09-25) — beside the document's own counters and for the same reason: the source is never written (*the source document is never written*, C5), so what the grab reads about a box is the same on every page, and the walk that asked it of the tree on every page cost the BGD manual 66 ms a page whatever the cursor. `forcingIndexOf` above carries the question and its rules; the page asks `forcing.find`. */
  // The memo, if the seam offered one and the sheets leave it standing (*the forced-break index is kept across runs*, 2026-10-09; settled once for the call by `settledMemo`): the reads below are answered from it where an element was read before, and read from the browser and kept where not.
  memo?.restart();
  const extentOf = (el: Element) => ({ before: index.wordsBefore(el), count: index.wordCountIn(el) });
  const forcing = memo
    ? forcingIndexOf(blocks, {
      styleOf: (el) => ((memo.facts(el, () => snapshotOfStyle(win.getComputedStyle(el))) as unknown) as CSSStyleDeclaration),
      pageNameOf: (el) => memo.pageName(el, () => effectivePageName(el)),
      blockChildren: (el) => memo.blockChildren(el, () => blockChildrenOf(el)),
      cutOf: (el, b, word = null) => cutTo(el, b, { word, rawPath: pathOf(el, blocks[b], b, isFixedBox, (e) => memo.indexIn(e, () => inFlowIndex(e))) }),
      posOf: (el, b) => index.posOf(b, index.wordsBefore(el)),
      posOfCut,
      extentOf
    })
    : forcingIndexOf(blocks, { styleOf: (el) => win.getComputedStyle(el), pageNameOf: effectivePageName, cutOf: (el, b, word = null) => cutTo(el, b, { word }), posOf: (el, b) => index.posOf(b, index.wordsBefore(el)), posOfCut, extentOf });
  performance.measure('cicero:forcing-index', { start: t, end: (t = performance.now()), detail: { events: forcing.size, ...(memo ? { memoHits: memo.hits, memoMisses: memo.misses } : {}) } });

  /**
   * The effective page name at an address: the deepest in-flow block that begins there, then css-page-3 §8.1's ancestor walk from it. A page may begin inside a block whose interior named a different page, so the cursor's block is not the thing to ask.
   *
   * A bare path resumes at a box whole, and a first in-flow block child begins exactly where its parent does (§3.1.1's own coincidence), so the deepest box that starts the page is the end of the first-child chain — which is where the old search for *the box containing word w* arrived, without the ambiguity a wordless first child gave it. A word or a pixel extent names a box the page resumes inside, and that box is itself the deepest; where the old search read the box after an end gap, it was naming the wrong side of a cut that resumes in the gap.
   */
  const nameAt = ( cut: Address) => {
    let el = boxAt(cut);
    if (!el) return '';
    // A line before a child is the page's first content, and it is the container's (*the anonymous box is in the procession*).
    if (cut.word == null && cut.px == null) return pageNameDownFrom(el, { styleOf: (c) => win.getComputedStyle(c), runBefore: (parent, child) => index.wordsBefore(child) !== index.wordsBefore(parent) });
    return effectivePageName(el);
  };

  /**
   * The document's own first page — css-page-3 §3.3, and it is a parity offset rather than a blank entry.
   *
   * *"To explicitly force a document to begin printing on a left or right page, authors can specify a break-before value that propagates a page break to the root. The UA must suppress the first (empty) page(s) in this case (and the `:first` pseudo-class matches the first printed page)."* Suppressing a page is not producing one and then hiding it: the page never exists, so nothing here writes an entry, `counter(page)` still starts at 1 on the page the reader holds, and `:first` still matches page index 0. What changes is the arithmetic that turns a page index into a parity, once and for the whole document.
   *
   * The chain walked is §3.1.1's own: a `break-before` on a first in-flow child propagates to its parent, so the values that reach the root are exactly those declared down the first-in-flow-child chain from the root element. The deepest is the latest element in the flow at that one shared position, so §4.3's rule gives it the win. `page` reaches the root too and demands no parity, which is why the walk asks `parityOf` rather than `isForced`: `html { break-before: page }` before any content forces nothing that could be seen.
   *
   * A value found here is not also emitted by the grab: `forcing.find` refuses anything not strictly after the cursor, and the cursor starts at the document's first word.
   */
  const rootParityDemand = (() => {
    let demand: 'left'|'right'|null = null;
    let el: Element|null = doc.documentElement;
    while (el) {
      const st = win.getComputedStyle(el);
      if (isForced(st.breakBefore)) demand = combineParity(demand, parityOf(st.breakBefore));
      el = blockChildrenOf(el).find((c) => {
        if (c.id?.startsWith('__beltype') || ['STYLE', 'SCRIPT'].includes(c.tagName)) return false;
        const cs = win.getComputedStyle(c);
        return !isOutOfFlow(cs) && !isAbsolutelyPositioned(cs);
      }) ?? null;
    }
    return demand;
  })();

  /** Page index → parity. Page one is a right page (css-page-3 §3.3, left-to-right progression), offset by one where the root demanded a left first page and the empty page that would have produced was suppressed. */
  const parityAt = ( pageIndex: number) => ((pageIndex + (rootParityDemand === 'left' ? 1 : 0)) % 2 === 0 ? 'right' : 'left');

  let ctx: MeasureContext|null = null;
  let ctxWidth: number|null = null;

  /** The rolling read-ahead (*first-load feeding*, 2026-10-11): what the page before measured past its own cut, kept for the page that begins there. `y` is the cut's height in that feed's report, which is where the next page begins on it, and `contentW` the measure it was laid out at. Null where the page before left nothing to read: no adjudicated cut, a fresh run, or a run resumed at a page. */
  let ahead: { report: ReturnType<typeof takeReport>; y: number; contentW: number; }|null = null;

  /**
   * How far the page whose conditions are given must be fed, read off the tail of the feed before it — or null, where there is nothing to read and the caller asks the account instead.
   *
   * The tail past the cut is already laid out, at the width of the next page when that is the same: the first box the retreat walk would stop at on a page that begins at the cut and is `contentH` tall (`firstBelowTheEdge`, the check's own predicates) is the box the next feed must hold, so the bound names the word after that box's first and `CAST_OFF_FLOOR` more — `boundAt` takes the first block boundary past it, which lies after the box. Null where the tail holds no such box (the feed ended first, or was cut at a forced break), where the next page is set at another width, and where the box has no address of its own.
   *
   * @remarks
   * A bound only, like every number here: the next page's layout may move what lies below its edge — an orphan carried over, a float pushed — and a feed read short fails the same `reachesBelowTheEdge` and is poured again.
   */
  const readAhead = (conditions: { contentW: number; contentH: number; }) => {
    if (!ahead || ahead.contentW !== conditions.contentW) return null;
    const box = firstBelowTheEdge({ report: ahead.report, sourceOf, limit: ahead.y + conditions.contentH, sourced: true });
    const entry = box ? index.entryFor(sourceOf(box.el)) : null;
    return entry ? Math.max(1, index.posOf(entry.block, entry.before) + 1 + CAST_OFF_FLOOR - cursor.pos) : null;
  };

  /**
   * The Cast-off (*the Cast-off bounds the feed*, 2026-09-26) — the one licensed estimate of *render-identical conditions* (I5), and it bounds and never decides.
   *
   * `words` is how far past the cursor the feed must reach, in words the account already counts: read off the page before where its feed laid out a whole page beyond the cut (`readAhead`), else the mean words a page moved plus twice their spread, over the pages so far (`castOffWords`). Page one has no page before it, so it is estimated from its own size (`firstPageWords`, *first-load feeding*, 2026-10-11) — and fed whole only where that size is unusable. `bound` names the place the feed is cut at, the forcing index's `boundAt`, or null where the feed is the whole remainder.
   *
   * Nothing decided downstream trusts the estimate: a bounded feed is checked after it is measured and before anything reads it, and a feed found short is poured again (the loop below).
   */
  const castOff = {
    words: ( conditions: { contentW: number; contentH: number; }) => {
      const known = readAhead(conditions) ?? castOffWords(account);
      if (known != null) return known;
      const root = win.getComputedStyle(doc.documentElement);
      return firstPageWords({ contentW: conditions.contentW, contentH: conditions.contentH, fontSize: parseFloat(root.fontSize), lineHeight: parseFloat(root.lineHeight) });
    },
    bound: ( cursor: Cursor,  words: number|null) => (words == null ? null : forcing.boundAt(cursor.cut, cursor.pos + words))
  };

  /**
   * The feed's one surgery: cut a block's clone at a place, `place.el` and everything after it leaving the feed. Two callers — the grab, whose forced event is such a place, and the Cast-off, whose bound is one — and one spelling, so the two can never disagree about what a cut through a feed is. Boxes after the place are put away, never removed (`fragments.js`'s `truncateFrom`), and hollow where the document allows it.
   *
   * Whether the whole block leaves is the address's own question: a bare path that normalised to the block alone is the block's own start, and `buildFeed` stops before it rather than calling this. It used to be `forcedEvent.w <= items[k].startWord`, and a wordless box standing at the boundary shares its word position with the word after it — so a break commanded past such a box read as a break at the item's start and took the box away with the rest (`packages/essay/cases/53-the-plate-before-the-forced-break`).
   *
   * Addressed through the feed's own source → clone map and never by following a child index on the clone. Called before the hints (*the clone is hollow outside the interval*, 2026-09-27), so a composed feed hints only what the page can show; the start cut, which consumes a leaf the hints have to be in, still runs after them.
   *
   * @param who - the caller, for the error.
   */
  const cutCloneAt = (clone: Element, cloneOfSource: Map<Element,Element>, place: { b: number; el: Element; runAfter?: Element; }, who: string) => {
    const target = cloneOfSource.get(place.runAfter ?? place.el);
    if (!target || !clone.contains(target)) throw new Error(`${who} could not address its own place in block ${place.b} — a defect to file, not a bail to hide`);
    if (!place.runAfter) return void truncateFrom(clone, target, { hollow });
    // A run has no element: the feed is cut at the first node after the block child it follows, which stands in the run, so the child stays whole and the run leaves with everything after it.
    let at: Node = target;
    while (!at.nextSibling && at.parentNode && at !== clone) at = at.parentNode;
    if (!at.nextSibling) throw new Error(`${who} found no run after its block child in block ${place.b}: a defect to file, not a bail to hide`);
    truncateFrom(clone, at.nextSibling as ChildNode, { hollow });
  };

  const ledger = new Ledger();

  // The cursor is the document's own first address — the path to block zero, which divides nothing — plus its projection and whatever flows are still running beside it.
  let cursor: Cursor = { cut: { path: [0], word: null, px: null }, pos: 0, carried: null };
  let composition: ReturnType<typeof composeDocument>|null = null;
  let compositionKey: string|null = null;

  // Entry N determines page N+1's conditions (*geometry changes only at page boundaries*, C8): name from the cursor's own address, parity from the page number, :first for page one. A width change re-creates the measure context and recomposes through the cache's width key — *cut-invariance* (C7) suspended locally, exactly as designed; the v3 constraint (widths change only at named-switch boundaries) keeps that suspension off mid-paragraph continuations.
  const conditionsFor = ( pageIndex: number,  { blank = false }: { blank?: boolean; } = {}) => conditionsAt(pageIndex, cursor.cut, cursor.pos, { blank, carried: cursor.carried });

  /** A kept page's `@page` counter rules, by its conditions: one geometry read per kind of page, not one per page per page. */
  const pageCounters = new Map<string, PageCounterOps>();
  const pageCounterOf = (i: number, c: { name: string; parity: 'left'|'right'; blank: boolean; }) => {
    const key = JSON.stringify([c.name, i === 0, c.parity, c.blank]);
    let ops = pageCounters.get(key);
    if (!ops) pageCounters.set(key, ops = table.pageFor({ name: c.name, first: i === 0, parity: c.parity, blank: c.blank }).pageCounter);
    return ops;
  };

  /** The conditions of page `pageIndex`, which begins at `cut` (projected to `pos`) — {@link conditionsFor} with the cursor made a parameter, so a resumed run can write the conditions of a page it keeps from the address that page began at (*the run resumes from an entry*, build two, 2026-10-08). */
  const conditionsAt = (pageIndex: number, cut: Address, pos: number, { blank = false, carried = null }: { blank?: boolean; carried?: Cursor['carried']; } = {}) => {
    const name = nameAt(cut);
    const away = remaindersOf(carried, index.endOf);
    const parity = parityAt(pageIndex);
    const geo = table.pageFor({ name, first: pageIndex === 0, parity, blank });
    // The run's count, an author's reset of the page counter counted on from the page it begins on, and each page's own `@page` counter rules (`document-state.js`'s `pageNumberAt`). Entry `i` closes page `i`, so page `i` begins where entry `i - 1` ended, under the conditions it closes.
    const pageNumber = pageNumberAt(documentOps, pageIndex, pos, { pages: (i) => ({ start: i === 0 ? 0 : account[i - 1].pos ?? 0, blank: account[i].blank === true, counter: pageCounterOf(i, account[i].closes) }), blank, counter: geo.pageCounter, away });
    // The document's counters as they stand at this page's first word — strictly before it, which is §6.1's *spans the page break* in the flat position space (`document-state.js`) — less what the flows carried onto this page have still to show, which stands before that word and is on this page or after it (beltype#43). The page's own two are not among them: they are the host's, and `pageNumber` carries the reset.
    const counters = withoutPageCounters(counterStateAt(documentOps, pos, away));
    return Object.freeze({ ...geo, name, pageNumber, parity, blank, counters, dpr: win.devicePixelRatio });
  };

  /**
   * The account's `closes` whitelist — the conditions that cross a `page.evaluate` boundary in every runner, so what is not named here does not exist downstream. `pageStyle` is named because the Chase dresses from it; `parity` and `blank` are named because the presentation must not re-derive them (the 2026-08-04 account ruling: never derive one fact twice). Parity was derived twice until 2026-09-07 — from `pageNumber` here and from `pageNumber` again in `root.js#present` — and the two agreed only for as long as the arithmetic had no offset in it.
   *
   * one definition, because there are two entry kinds now: an ordinary page and a page nothing flows onto.
   */
  const closesOf = ( c: ReturnType<typeof conditionsAt>) => ({ name: c.name, pageNumber: c.pageNumber, parity: c.parity, blank: c.blank, counters: c.counters ?? {}, pageW: c.pageW, pageH: c.pageH, margins: c.margins, contentW: c.contentW, contentH: c.contentH, pageStyle: c.pageStyle ?? null });

  /**
   * The feed, cloned to its place and hollow outside its interval (*the clone is hollow outside the interval*, 2026-09-27).
   *
   * `place` is where the feed is cut — the grab's forced event or the Cast-off's place, whichever the pour chose — or null for the whole remainder. The blocks are cloned from the cursor's through the place's and no further: the blocks after it were sliced away before any layout the Stonehand ever read. A block's clone is built by `cloneFlowPiece`, deep inside the interval and hollow outside it, so the cursor's block pays for the page and not for the block; then, in this order, its fixed boxes leave, its tail is cut at the place, its hints are applied to what is left, and the start cut consumes the cursor's leaf — *hints first, slicing after* (*cut-invariance*, C7) for the leaf the page resumes in, and nothing hinted that the page does not show.
   *
   * @param who - the caller, for the error.
   */
  const buildFeed = (place: { b: number; el: Element; cut: Address; }|null, who: string) => {
    const items: FeedItem[] = [];
    // One map per feed, both directions, filled as each clone is built (`fragments.js`'s `cloneFlowPiece`): a clone answers what the author declared through the reverse map, and an address reaches its clone through this one. It holds only elements that exist.
    const cloneOfSource: Map<Element,Element> = new Map<any, any>();
    // Carried parallel flows first (tablet, The Flows): a §2.1 box the cut crossed continues here as a live box, not a painted shell, because this page's content lays out beside it — that is the whole difference from a monolith, whose remainder is a picture nothing flows around. These blocks sit behind the cursor, so the ordinary loop below would never re-feed them; they come first because that is where they stood relative to the content the cursor points at.
    const itemsIn = ( b: number) => (cursor.carried ?? []).filter((c) => c.item && c.item[0] === b);
    for (const c of cursor.carried ?? []) {
      if (c.item) continue; // a row item's place is applied inside the block that holds it, below and here alike
      const source = blocks[c.cut.path[0]];
      const { clone } = cloneFlowPiece(source, { start: c.cut, items: itemsIn(c.cut.path[0]), hollow, into: cloneOfSource, composition });
      // The remainder rides beside the address (*a resume point is a path*, I2), and it is what makes the continuation live rather than merely present: a §2.1 box that declares its own block size continues at the extent it has left, not at its declared one. Without it a 96mm rail that had shown 60mm asked for 96mm again on every page it reached and the flow beside it could never close a page (measured, `cases/21-parallel-flows`).
      const node = mutateToContinuation(clone, { cut: c.cut, remainderPx: c.remainingPx ?? null, source, cloneOf: cloneOfSource, items: itemsIn(c.cut.path[0]), hollow });
      items.push({ clone: node, source, blockIndex: c.cut.path[0], cut: c.cut, carried: true });
    }
    const first = cursor.cut.path[0];
    if (place && place.b < first) throw new Error(`${who} named a place in block ${place.b}, before the cursor's block ${first} — a defect to file, not a bail to hide`);
    const last = place ? place.b : blocks.length - 1;
    for (let b = first; b <= last; b++) {
      const source = blocks[b];
      const cut = b === first ? cursor.cut : null;
      const ends = !!place && b === place.b;
      if (ends && place.cut.path.length === 1 && place.cut.word == null) break; // the place is this block's own start: the whole block leaves, exactly as the item-granular grab always cut
      const { clone } = cloneFlowPiece(source, { start: divides(cut) ? cut : null, end: ends ? place.cut : null, items: itemsIn(b), hollow, into: cloneOfSource }); // no composition: the tail is cut first, then the hints
      if (ends) cutCloneAt(clone, cloneOfSource, place, who); // the tail first, so nothing the page does not show is hinted
      if (composition) applyRecordsUnder(clone, source, composition); // hints before the start cut — a continuation keeps exactly the remaining subset of the same chosen lines (*cut-invariance*, C7)
      // The return value matters: a painted shell of the top-level block itself becomes the slice wrapper, and the feed must carry that, not the box it wraps.
      // `forced` is the page's own fact (*the margin after a forced break is preserved*, 2026-09-29): §5.2 keeps the margin after a forced break at any depth, and the presentation hands the same flag from the account's entry, so the two build this continuation alike.
      const node = divides(cut) ? mutateToContinuation(clone, { cut, source, cloneOf: cloneOfSource, items: itemsIn(b), hollow, forced: !!cursor.forced }) : clone;
      items.push({ clone: node, source, blockIndex: b, cut, ...(ends ? { ends: true } : {}) });
    }
    return { items, cloneOfSource };
  };

  /**
   * The words of `leaf` this page's clone has already consumed — nonzero only where the cursor's own address named that same leaf, which is the one place `mutateToContinuation` consumes words at all.
   *
   * This is `positions.js`' clone-side identity, asked as a question about the address instead of derived from a block-absolute word. The Gauge reads a clone, so a Class B reading counts into the words the leaf has left; the address carries a leaf-relative word in source coordinates, so a fresh clone consumes exactly it, and this is the term that converts between the two.
   */
  const consumedIn = (cut: Address|null, leafSource: Element): { word: number; char: number; } => {
    if (!cut) return { word: 0, char: 0 };
    const at = boxAt(cut);
    if (cut.word != null && at === leafSource) return { word: cut.word, char: cut.char ?? 0 };
    /** A box that holds blocks has shown what stands before the cursor's place inside it (*the anonymous box is in the procession*, 2026-09-29). Its lines are read as an anonymous box, whose words are counted in the box's own word space, and the continuation put away everything standing before the place the cursor named inside it — the block children before it, the runs before it, the leaf words a Class B cut consumed. So the words it has already shown are the cursor's projection less its own start, which is the same identity read one level up; a leaf never holds the place of a cursor that is not its own, and reads zero as it always did. */
    if (at && at !== leafSource && leafSource.contains(at)) return { word: posOfCut(cut) - index.posOf(cut.path[0], index.wordsBefore(leafSource)), char: 0 };
    return { word: 0, char: 0 };
  };
  /** The same question asked of the whole cursor: a row's items each resumed at a place of their own, so the words a leaf has already shown may be written on any of the cursor's addresses, the main one or one riding beside it. */
  const consumedAnywhere = ( leafSource: Element) => {
    for (const c of [cursor.cut, ...(cursor.carried ?? []).map((x) => x.cut)]) {
      const at = c ? boxAt(c) : null;
      if (at && (at === leafSource ? c.word != null : leafSource.contains(at))) return consumedIn(c, leafSource);
    }
    return { word: 0, char: 0 };
  };

  const account: any[] = [];

  /** THE MEASURED EXTENTS (*a box announces its own size*, 2026-10-21; `.claude/decisions/cicero/a-box-announces-its-own-size.md`): each top-level block's border-box height, read off the report of a page whose feed held the block whole, so the last such page — the one the block begins on — writes it. A resumed run starts from the table the run before left and refreshes the blocks it measured again. The seam's rim compares a presented original's observed size with it; nothing here reads it. */
  const heights: Map<Element,number> = new Map(prior?.heights ?? []);
  if (prior?.heights) for (const el of (new Set(heights.keys()) as Set<Element> & { difference(other: Set<Element>): Set<Element> }).difference(new Set(blocks))) heights.delete(el); // a box an edit replaced is no longer the document's

  /** The pages' named strings, filled in once the intervals exist (*the host rewrites what the parser drops*, 2026-09-14): GCPM's four keywords are all questions about a page's interval, and an interval is not a thing a page's conditions can hold when they are built, because the end is what the cut decides. Entry `i` closes page `i`, so page `i` runs from the previous entry's position to this one's. They land on the account's own `closes`, and the presentation publishes them on the page's host (`chase.js`'s `setStrings`, *the page carries its conditions*), where a margin box and a flow site read them alike. Run for every page at the end of the run, and for the pages cut so far each time the run is paced (a page shown before the run is complete is shown with its strings). */
  const fillStrings = () => {
    let from = 0;
    /** The remainders the page's opening cut carried in (beltype#43): a page nothing flows onto carries no flow in its row, and the cursor carries the same flows across it. */
    let into = ([] as ReturnType<typeof remaindersOf>);
    for (const entry of account) {
      const away = entry.blank ? into : remaindersOf(entry.carried, index.endOf);
      entry.closes.strings = namedStringsForPage(assignments, from, entry.pos, { into, away });
      entry.closes.running = namedStringsForPage(runningAssignments, from, entry.pos, { into, away }, null);
      if (entry.pos != null) from = entry.pos;
      into = away;
    }
  };

  /** Which pages a resumed run cut again, as the result reports them and as the presentation of a run that stopped needs them: `from` through `to`, from 1, with the pages added or removed (`shift`) and the prior pages after `to` left standing (`kept`). Null for a run that resumed nothing. */
  const resumedNow = () => (resume ? { from: resume.restart + 1, to: converged ? converged.i + 1 : account.length, shift: converged ? converged.i - converged.j : account.length - (priorEntries as Entry[]).length, converged: !!converged, kept: converged ? (priorEntries as Entry[]).length - 1 - converged.j : 0 } : null);

  const progress = (): Progress => {
    fillStrings();
    return {
      pages: account.length,
      account,
      index,
      held: (el) => {
        const at = index.entryFor(el);
        if (!at) return true; // nothing to wait for: the element is outside the flow
        const last = account[account.length - 1];
        const p = index.posOf(at.block, at.before);
        // Behind the last cut and not in a remainder a flow it carries has still to show (beltype#43): the cursor is the page after it, and carries those flows.
        return !!last && (last.pos == null || (last.pos > p && !inRemainders(remaindersOf(cursor.carried, index.endOf), p)));
      },
      resumed: resumedNow(),
      snapshot: () => ({ ledger, account, delivered: laid.delivered, facts: laid.facts ?? null, blockCount: blocks.length, hasMarks, heights, incomplete: true })
    };
  };

  /** Let the host pace the first layout: it may return a promise and hold the run where it stands, or reject it and end the run (the measure context is put away on the way out). */
  const paced = async () => {
    if (!pace || laid.attempt !== 0) return;
    try {
      await pace(progress());
    } catch (error) {
      ctx?.dispose();
      throw error;
    }
  };

  /**
   * Resuming the run from an entry (*the run resumes from an entry*, build two, 2026-10-08; `resume.js` holds the arithmetic and `.claude/decisions/cicero/the-run-resumes-from-an-entry.md` the decisions).
   *
   * A fresh run starts here with an empty Ledger and the cursor at the document's first address. A resumed one starts with the prior run's entries kept up to the restart page — each written again, because its live `box` pointer names a tree this run may not share (*straddle-heredity*, C6) and its conditions are read again from the address the page began at (the counters and the geometry are functions of the tree, so they are asked of the tree) — and the cursor read off the last of them: the address, the carried flows, whether the page began at a forced break, and the parity the entry owes. Nothing else of the prior run is trusted but the presentation literals (`leadPx`, `usedPx`, `cost`, the trace), which are the pages' own outputs.
   *
   * **The restart is one page before the page that holds the edit, and no earlier unless a changed read says so.** A changed delivered value is a changed condition on the page holding its site, which the reservation already bounds: the sites whose value differs from the one the prior ledger was cut under dirty the pages touching their top-level block, the restart moves back to the first of them, and the run may not stop before the last. A value that changed with no site to name it, or a document whose block count moved, restarts at page one. A layout the reads sent round again asks no delivered value: the check after delivery measured them all, and its edits are the boxes whose lines they moved (*delivery resumes from the moved page*).
   */
  // A layout the reads sent round again resumes from the one before it, at the boxes whose lines moved (*delivery resumes from the moved page*, 2026-10-21): an edit like any other, whose tree is the same tree.
  if (laid.attempt !== 0) ({ prior, dirtyAt, edited } = laid.resume ? { prior: laid.resume.prior, dirtyAt: laid.resume.at[0], edited: laid.resume.at.slice(1) } : { prior: undefined, dirtyAt: undefined, edited: [] });
  const priorAll = prior && dirtyAt && prior.blockCount === blocks.length && prior.account.length > 0 ? prior.ledger.entries() : null;
  /** The page the run would restart at, before any changed read moves it back. */
  /** Every box replaced since the prior run: the one the run was told to resume at and any other the host patched before asking (beltype#48 — a host that patches every section and then resumes once per section). */
  const edits = dirtyAt ? [dirtyAt, ...edited] : [];
  const restart0 = priorAll ? Math.min(...edits.map((at) => restartPage(holderPage(priorAll, at, (a, b) => cutAfter(a, b, posOfCut))))) : 0;
  /** The page the run would resume from ends at a place the document does not have: whatever the edit replaced took that address with it, and a run begun there would cut the next page from nowhere. */
  const dangling = priorAll && restart0 > 0 ? namesNoPlace(priorAll[restart0 - 1], (cut) => boxAt(cut) !== null, blocks.length) : false;
  const priorEntries = dangling ? null : priorAll;
  /** Why this run is whole, for the host to say (`why` in the result): the first of the five things `priorEntries` asked, in the order it asked them. */
  const whole = priorEntries ? null
    : laid.attempt !== 0 && !dangling ? `a page number moved the lines of ${(laid.because ?? []).slice(0, 3).join(', ') || 'a reference'}${(laid.because ?? []).length > 3 ? ` and ${(laid.because as string[]).length - 3} more` : ''}, so the run was laid out again whole (attempt ${laid.attempt + 1})`
    : !prior ? 'no previous run was handed to the engine to resume from'
    : !dirtyAt ? 'no edit address (resumeAt) was given'
    : prior.blockCount !== blocks.length ? `the document had ${prior.blockCount} top-level blocks and now has ${blocks.length}`
    : dangling ? `the page the run would resume from ends at a place the document no longer has (page ${restart0} of the run before names no box), so the run was cut whole`
    : 'the previous run cut no pages';
  const geometryByParity = priorEntries ? [...new Set(['', ...(prior as Prior).account.map((r) => r.closes.name)])].some((name) => [false, true].some((blank) => {
    const read = ( parity: 'left'|'right') => { const g = table.pageFor({ name, first: false, parity, blank }); return JSON.stringify([g.pageW, g.pageH, g.margins, g.borders, g.paddings, g.contentW, g.contentH]); };
    return read('left') !== read('right');
  })) : false;
  const resume = priorEntries ? (() => {
    let restart = restart0;
    let atLeast = 0;
    /** The top-level blocks a page covers, from the cut that began it to the cut that ended it. */
    const span = ( j: number) => ({ from: j === 0 ? 0 : (priorEntries as Entry[])[j - 1].paths[0]?.cut.path[0] ?? blocks.length, to: (priorEntries as Entry[])[j].paths[0]?.cut.path[0] ?? Infinity });
    /** A block whose conditions moved dirties the pages touching it: the restart moves back to the first of them, and the run may not stop before the last. */
    const dirty = ( block: number) => {
      const first = (priorEntries as Entry[]).findIndex((_, j) => span(j).to >= block);
      const last = (priorEntries as Entry[]).findLastIndex((_, j) => span(j).from <= block);
      if (first >= 0) restart = Math.min(restart, first);
      atLeast = Math.max(atLeast, last);
    };
    // A layout the reads sent round again is not asked: the check after delivery already measured every site whose value changed, and the ones whose lines moved are its edits.
    const changed = laid.attempt === 0 ? new Set(changedPairs((prior as Prior).delivered ?? new Map<any, any>(), laid.delivered ?? new Map<any, any>())) : new Set<any>();
    if (changed.size) {
      const touched = (laid.sites ?? []).filter((x) => changed.has(`${x.key}|${x.prop}`));
      if ([...changed].some((id) => !touched.some((x) => `${x.key}|${x.prop}` === id))) restart = 0;
      for (const x of touched) {
        const at = index.entryFor(x.el);
        if (!at) continue; // a site outside the flow holds no line any cut reads
        dirty(at.block);
      }
    }
    // A box whose `:has()` words moved is a box that was edited (*one attribute has words*, 2026-10-10). An argument can reach across blocks, so an edit in one block can flip another's tint while that block's entry key stays equal; its pages are cut and shown again like the pages of an edit. A box outside the flow (a fixed box, a running element) is copied onto every page, so its words moving dirties them all.
    for (const box of boxesWhoseWordsMoved((prior as Prior).hasMarks, hasMarks, allBoxes)) {
      const at = index.entryFor(box);
      if (at) dirty(at.block);
      else { restart = 0; atLeast = priorEntries.length - 1; }
    }
    return { restart, atLeast, keys: priorKeys(priorEntries, geometryByParity), dirtyPaths: edits.map((at) => at.path) };
  })() : null;

  /** The cursor the page after `last` begins at: the address, the flows still carried, whether the page began at a forced break, and the parity the entry owes. */
  const cursorAfter = ( last: Entry) => {
    const [main, ...flows] = last.paths;
    return {
      cut: main.cut,
      pos: main.pos,
      carried: flows.length ? flows.map((p) => ({ cut: p.cut, pos: p.pos, box: p.box, remainingPx: p.remainingPx, ...(p.item ? { item: p.item } : {}) })) : null,
      ...(last.trace.forced ? { forced: true } : {}),
      demandParity: last.owes ?? null
    };
  };

  /**
   * A prior page written again at page index `i`, which began at `start`: the same cut, class, trace and presentation literals; the box pointer resolved from the address; the position projected over this run's word space; the conditions read again, so the page number, the parity and the counters are this run's.
   *
   * @param row - its account row.
   */
  const reseat = (entry: Entry, row: any, i: number, start: { cut: Address; pos: number; carried?: Cursor['carried']; }) => {
    const paths = entry.paths.map((p) => ({ ...p, pos: posOfCut(p.cut), box: boxAt(p.cut) }));
    const conditions = conditionsAt(i, start.cut, start.pos, { blank: entry.trace.blank === true, carried: start.carried });
    const written = createEntry({ paths, cls: entry.cls, trace: entry.trace, closes: conditions, owes: entry.owes });
    return {
      entry: written,
      row: { ...row, pos: paths[0] ? paths[0].pos : null, carried: row.carried ? row.carried.map(( c: object,  k: number) => ({ ...c, pos: paths[k + 1].pos })) : null, closes: closesOf(conditions) }
    };
  };
  /** The page after `entry` begins at its main place, with the flows it carries — those the page before carried, where `entry` closed a page nothing flowed onto, since the cursor keeps them across it. */
  const startOf = ( entry: Entry,  before: { carried?: any; }|null = null) => ({ cut: entry.paths[0].cut, pos: entry.paths[0].pos, carried: entry.trace.blank ? before?.carried ?? null : entry.paths.slice(1) });
  let converged: { i: number; j: number; }|null = null;
  if (resume) {
    let start = { cut: cursor.cut, pos: cursor.pos, carried: cursor.carried };
    for (let i = 0; i < resume.restart; i++) {
      const kept = reseat((priorEntries as Entry[])[i], (prior as Prior).account[i], i, start);
      ledger.append(kept.entry);
      account.push(kept.row);
      start = startOf(kept.entry, start);
    }
    if (resume.restart > 0) cursor = cursorAfter(ledger.at(resume.restart - 1));
  }

  /** The header and the footer a divided table repeats (*the header repeats*, 2026-10-14; css2 17.2, which only permits it, and Blink's rule, which the oracle follows). A repeated group is decided once, at the first fragment of its table (the first feed that shows it), from its measured height and its `break-inside`, and the decision rides the account entry of that page (`repeats`) so that every later page, a resumed run and the presentation read it and never measure again. `declined` is the groups that do not repeat; `decided` the groups already judged. Header and footer are judged separately. */
  const hasGroups = blocks.some((b) => typeof b.querySelector === 'function' && b.querySelector('thead, tfoot'));
  const decided = new Set<any>();
  const declined = new Set<any>();
  /** The decisions this page's feeds made, for its entry. */
  let madeHere: { path: number[]; repeat: boolean; }[] = [];
  declineRepeats([]);
  if (resume) {
    for (let i = 0; i < resume.restart; i++) {
      for (const r of (prior as Prior).account[i]?.repeats ?? []) {
        const g = blocks[r.path[0]] ? elAtIn(blocks[r.path[0]], r.path) : null;
        if (!g) continue;
        decided.add(g);
        if (!r.repeat) declined.add(g);
      }
    }
    declineRepeats(declined);
  }

  /**
   * Judge every repeatable group the feed shows for the first time (see `declined`). A group repeats when its height is a quarter of the page area or less (Blink's guard, `table_layout_algorithm.cc`; its other condition, an applicable `break-inside: avoid`, is the UA's own for the groups and reads `auto` in the computed style, measured in the pinned build, so it is not asked). Returns whether a copy of a group just declined is in this feed, which then has to be poured again.
   *
   * @param container - the measure container the feed was laid out in.
   */
  const decideRepeats = (container: Element, conditions: { contentH: number; }) => {
    let repour = false;
    for (const g of container.querySelectorAll('thead, tfoot')) {
      if (!g.getClientRects().length) continue;
      const src = sourceOf(g);
      if (!src || decided.has(src)) continue;
      if (!mayRepeat(src)) continue;
      decided.add(src);
      if (footerBeforeRows(src) && g.getBoundingClientRect().height > conditions.contentH) throw new Error(refusedTable(src, 'a footer group taller than the page area, written before its rows', 'write the footer after the rows, where it is divided like them, or keep it within the page area'));
      const repeat = g.getBoundingClientRect().height <= conditions.contentH / 4;
      const b = blocks.findIndex((block) => block === src || block.contains(src));
      madeHere.push({ path: pathOf(src, blocks[b], b), repeat });
      if (!repeat) {
        declined.add(src);
        declineRepeats(declined);
        if (hasWord(g, ARTIFACT)) repour = true;
      }
    }
    return repour;
  };

  /** The pages after the converged one, kept: the prior pages after the converged one, written again at their shifted indices — every address equal, every page number and parity this run's. Returns the entry the last of them is, which is where a run that goes on cuts from. */
  const keepAfterConvergence = () => {
    if (!converged || !ledger.at(converged.i).paths.length) return null;
    let start = startOf(ledger.at(converged.i));
    for (let j = converged.j + 1; j < (priorEntries as Entry[]).length; j++) {
      const kept = reseat((priorEntries as Entry[])[j], (prior as Prior).account[j], j + converged.i - converged.j, start);
      ledger.append(kept.entry);
      account.push(kept.row);
      if (kept.entry.paths.length) start = startOf(kept.entry, start);
    }
    return ledger.at(ledger.length - 1);
  };

  while (true) {
    /**
     * §3.1's second break, and §4.2.3's whole precondition (*a parity is worth a page*, 2026-09-07).
     *
     * `left`/`right`/`recto`/`verso` *"force one or two page breaks … so that the next page is formatted as"* the side asked for. The first break is the ordinary forced break the grab already consumed (*no forced break lies inside an interval*, C1). The second is owed exactly when the page that would carry the resumed content has the wrong parity, and it costs **a page nothing flows onto** — which is not a gap in the ledger but a real entry with an empty interval, because css-page-3 §4.2.3 then has to be able to select it: *"the :blank pseudo-class matches content-empty pages that appear as a result of forced page breaks. Only the left, right, recto and verso values … can generate pages that match :blank."*
     *
     * One per forcing, by construction rather than by a counter: the demand is consumed here whether or not it is spent, and one page always flips the parity. A parity arithmetic error can therefore cost a wrong page, never a loop — which is the property *the build cannot fail* (C2) wants and a `while` over a predicate would not have given.
     *
     * The cursor does not move, so the page after this one resumes exactly where the forcing said. The blank entry repeats the previous entry's main position, which *flow is forward* (I1) admits (`comparePos` equal is not backward) and which is what an empty interval is.
     */
    const demand = cursor.demandParity ?? null;
    if (demand) cursor = { ...cursor, demandParity: null };
    if (demand && demand !== parityAt(account.length)) {
      const conditions = conditionsFor(account.length, { blank: true });
      const entry = createEntry({
        paths: [{ pos: cursor.pos, box: boxAt(cursor.cut), cut: cursor.cut }],
        cls: 'A',
        trace: { forced: true, blank: true, kind: 'A', violates: { avoid: false, ow: 0 } },
        closes: conditions
      });
      ledger.append(entry);
      account.push({
        cls: entry.cls,
        trace: entry.trace,
        pos: entry.paths[0].pos,
        cut: cursor.cut,
        carried: null,
        // The one field presentation reads to assign nothing. Without it a forcing interior to a block leaves the interval starting inside it, the block loop builds a continuation clone for this page, and the content prints twice.
        blank: true,
        leadPx: 0,
        usedPx: 0,
        cost: 0,
        closes: closesOf(conditions)
      });
      continue;
    }

    t = performance.now();
    const conditions = conditionsFor(account.length);
    const recreated = ctx === null || conditions.contentW !== ctxWidth;
    if (recreated) {
      ctx = createMeasureContext(doc, conditions.contentW);
      ctxWidth = conditions.contentW;
    }
    performance.measure('cicero:conditions', { start: t, end: (t = performance.now()), detail: { page: account.length, recreated } });
    // The grab's question, asked once per page and before composition, because the composition region's end is one of its answers.
    const forcedEvent = forcing.find(cursor.cut, conditions.name);
    performance.measure('cicero:grab', { start: t, end: (t = performance.now()), detail: { page: account.length, from: cursor.cut.path[0], found: !!forcedEvent } });

    if (composed) {
      // Resolve composition for this page's width and name region; the width-keyed cache makes re-entry a pure hit. The region runs from the cursor's block through the block holding the next named-page switch — inclusive, because a switch may now fall inside a block, and that block is then composed at both widths, once on each side, which is *cut-invariance* (C7) suspended locally exactly as the tablet has it. Every other kind of forcing leaves the measure alone and so leaves the region alone.
      const key = `${conditions.contentW}:${conditions.name}`;
      if (compositionKey !== key) {
        const sw = forcing.find(cursor.cut, conditions.name, { namesOnly: true });
        const end = sw ? sw.b + 1 : blocks.length;
        // A fresh run composes from block zero on its first page, so a flow carried from an earlier block finds its records. A run that restarts at a page composes from the cursor's block, and a flow still carried into that page stands in an earlier one: the region reaches back to it (*the run resumes from an entry*, build two; found by 57-the-float-that-is-its-own-line-stack, composed).
        const first = resume && compositionKey === null ? Math.min(cursor.cut.path[0], ...(cursor.carried ?? []).map((c) => c.cut.path[0])) : cursor.cut.path[0];
        composition = composeDocument(doc, blocks.slice(first, end), ctx, compositionCache, { blocks, at: first });
        compositionKey = key;
        performance.measure('cicero:compose', { start: t, end: (t = performance.now()), detail: { page: account.length, blocks: end - first } });
      }
    }

    // The grab consumes forcing (*no forced break lies inside an interval*, C1): a forced break in the feed truncates it — an entry either consumed the forcing or the forcing was not there. A named-page switch is the same shape: geometry changes only at page boundaries (C8), so the switch forces Class A. What changed with *the grab descends* is only where the feed is cut: at the event's word position, which may fall inside a top-level item, rather than always between two of them.
    let forcedNext: Cursor|null = null;
    let namedSwitch = false;
    if (forcedEvent) {
      // `forced` rides the cursor into the next page: §5.2 preserves the margins after a forced break, and only the page that begins there can know that. `demandParity` rides beside it for the same reason — §3.1's second break is a fact about the page that resumes, and the loop's top is where a page learns its own parity.
      forcedNext = { cut: forcedEvent.cut, pos: posOfCut(forcedEvent.cut), forced: true, demandParity: forcedEvent.parity ?? null };
      namedSwitch = forcedEvent.namedSwitch;
    }

    /**
     * Does this page's leading margin survive? css-break-3 §5.2 answers by asking what began the page, and the answer is not always "truncate" — which is what this used to assume unconditionally (`pageStart = report.contentTop`, i.e. start measuring at the first box's border edge and let presentation pull the margin off).
     *
     *   unforced break  — "any margins adjoining the break are truncated to zero"        -> truncate
     *   forced break    — "margins before the break are truncated, but margins after the break are preserved"  -> keep
     *   document start  — no break at all, so §5.2 never speaks; the margin is ordinary flow  -> keep
     *
     * Both non-truncating cases were wrong before 2026-07-29, and neither could be caught by the fuzzed corpus: the generator writes `margin: 0 0 Npx 0`, so no block it draws has a top margin to lose. Measured against Chromium print (*leading margins, three page starts*, P27): a 13-line block with `margin-top: 60px` on a 14-line page renders 11 lines then 2 — we rendered 13 and finished a page early, at the document start and after a forced break alike. A mid-box continuation is unaffected either way: its clone's leading decoration is already truncated by the feed writer (`fragments.js`), so `contentTop` is zero and both branches agree.
     */
    const truncateLead = account.length > 0 && !cursor.forced;
    /**
     * The spent extent at the head of a continuation (*every branch gets a place*, ruled 2026-09-21). What stood before the place a page resumes at is gone from its fragment, and in a block that is the end of it: the leading decoration along the chain is truncated and the resumed box stands at the fragment's top. A grid is the first exception, measured: a row already shown takes its items with it and leaves its track — a sized track whole, any track's `row-gap` — so the page would open on blank (70px, `packages/essay/probes/conservation.js`'s placed grid). A separated table is the second (*a repeated header joins the rows as Chromium prints them*, 2026-10-22): the spacing it puts above the row a page resumes at, or above its repeated header's copy, is a lead too, and the flow is lifted by it. Nothing about grids or tables is learned here. The page simply begins where its first resumed box begins, less whatever leading decoration lawfully stands above it (`gapAbove`): the smallest such gap among the boxes the cursor's places name, read off this page's own report, and the presentation shifts by the same number through `leadPx`, exactly as it already does for a truncated leading margin. Zero for every continuation whose resumed box stands at the fragment's top, which is every one but a grid's and a separated table's.
     *
     * Not asked of a painted shell, whose box is pulled above the page on purpose, nor where any place has no box in this report — an edited document, where the honest answer is no shift.
     */
    const spentLeadOf = (report: MeasureReport, cloneOfSource: Map<Element,Element>) => {
      if (!truncateLead || !divides(cursor.cut)) return 0;
      let lead = Infinity;
      for (const c of [cursor.cut, ...(cursor.carried ?? []).map((x) => x.cut)]) {
        if (c.px?.paint != null) return 0;
        const el = cloneOfSource.get((boxAt(c) as Element));
        const box = el ? report.boxOf(el) : null;
        if (!box) return 0;
        lead = Math.min(lead, gapAbove(box, report, win));
      }
      return lead > 0.25 ? lead : 0;
    };

    /**
     * The pour (*the Cast-off bounds the feed*, 2026-09-26). The feed is cut at most once, and since *the clone is hollow outside the interval* (2026-09-27) it is cloned only as far as the cut: at the grab's forced event where there is one and it is not past the Cast-off's place — the forcing already bounds the feed, and cuts it exactly as it did before this round — and otherwise at the Cast-off's place, where the forced event, if any, lies past the fed content and its truncation has nothing to cut.
     *
     * A bounded feed is checked before anything reads it: it must hold the box the Stonehand's walk stops at, the first in-flow box whose top lies below the limit (`reachesBelowTheEdge`, the walk's own predicates). A feed that holds it is verdict-identical to the whole feed, because the walk reads every box up to that one and nothing after it, and block layout is forward — putting away what follows a boundary moves nothing before it, which is why the place is never inside a box `neverCutInside` names. A feed that does not hold it stopped above the edge, a bound counted in words meeting a table or a figure that carries few words and many pixels, and it is poured again with the bound doubled until the check holds or the feed is whole. A whole feed, forced or not, is not checked: it is the feed every earlier round fed.
     *
     * `forcedNext` keeps its meaning on a bounded page, and it is the same object either way; what the check guarantees is that two of the branches below that read it cannot be reached from a bounded feed — `fits` is false, since a box below the limit is in the procession, and the walk returns a verdict, since the box it stopped at offered the boundary before it or something above it straddles the edge. Both are asserted rather than trusted.
     */
    let words = castOff.words(conditions);
    let pours = 0;
    madeHere = [];
    /** The grab's event is inside a box that lays its children side by side: `true` until the layout says it is not a row's after all. `rowEventIn` says whether the final feed holds it. */
    const rowishEvent = !!forcedEvent && !!forcedEvent.rowish && !forcedEvent.namedSwitch;
    let rowForced = rowishEvent;
    let rowEventIn = false;
    let bounded = false;
    let items: FeedItem[];
    let cloneOfSource: Map<Element,Element>;
    let report: MeasureReport;
    let container: ReturnType<MeasureContext['measure']>;
    let pageStart: number;
    let spentLead: number;
    for (;;) {
      pours++;
      // The place first, then the feed cloned to it (*the clone is hollow outside the interval*, 2026-09-27): neither the Cast-off's place nor the forced event needs anything but the cursor and the index.
      const place = castOff.bound(cursor, words);
      const forcingCuts = !!forcedEvent && !rowForced && (!place || !cutAfter(forcedEvent.cut, place.cut, posOfCut));
      bounded = !forcingCuts && !!place;
      ({ items, cloneOfSource } = buildFeed(forcingCuts ? forcedEvent : bounded ? place : null, forcingCuts ? 'the grab' : 'the Cast-off'));

      performance.measure('cicero:feed', { start: t, end: (t = performance.now()), detail: { page: account.length, blocks: items.length, carried: (cursor.carried ?? []).length, bound: bounded ? words : null, reach: (bounded ? posOfCut((place as NonNullable<typeof place>).cut) : forcingCuts ? posOfCut(forcedEvent.cut) : index.total) - cursor.pos, pours } });
      container = (ctx as MeasureContext).measure(items.map((it) => it.clone), laid.facts?.[account.length] ?? null); // a page fact a flow site reads stands as the run before decided it, or at its reservation (*the page carries its conditions*)
      performance.measure('cicero:layout', { start: t, end: (t = performance.now()), detail: { page: account.length, blocks: items.length } });
      // The clones' own images, settled before the report is taken: a clone of a loaded image is not always available in the turn it is mounted (`measure.js`'s `awaitCloneImages`), and a figure measured at no height moves every cut after it. Kept when the first run's awaits went (2026-11-08), until the Service Worker case is measured without it.
      const waited = await awaitCloneImages(container);
      performance.measure('cicero:clone-images', { start: t, end: (t = performance.now()), detail: { page: account.length, waited } });
      report = takeReport(container, { contentHeight: conditions.contentH });
      performance.measure('cicero:report', { start: t, end: (t = performance.now()), detail: { page: account.length, boxes: report.boxes().length } });

      // A group the feed shows for the first time is judged here, once; a copy of a group that turns out not to repeat is already in this feed, so the page is poured again without it (the one re-pour the rule costs, and only for a footer or a header that is too tall).
      if (hasGroups && decideRepeats(container, conditions)) continue;
      spentLead = spentLeadOf(report, cloneOfSource);
      pageStart = (truncateLead ? report.contentTop : 0) + spentLead;
      if (rowForced) {
        /** A forced break inside a box that lays its children side by side is not the grab's to cut at (*a parallel flow is a fragmentainer*, 2026-10-08; *a forced break inside a cell*, P37c): the cut falls in the item's flow and only the row's height crosses the wall, so the feed is not cut at the event — a word position cannot say a cell's place, and cutting there put away the neighbour cell with everything after the paragraph in document order. Whether the event is inside a row item is a fact of the layout, asked here of the report: the box stands inside an item of a row that is not itself inside another item's, and after a sibling in the item's procession (a break before an item's first block is the item's own start). Where it is not, the grab cuts as it always did. An event past the feed the Cast-off bounded is not this page's, and a longer pour may reach it. */
        const clone = cloneOfSource.get((forcedEvent as NonNullable<typeof forcedEvent>).el);
        const at = clone ? report.boxOf(clone) : null;
        rowEventIn = !!clone;
        if (clone) {
          let item = null;
          let nested = false;
          for (let a = at?.parent ?? null; a; a = a.parent) if (report.rowOf(a)) { if (item) nested = true; else item = a; }
          const sequence = at ? report.processionOf(at) : [];
          if (!at || !item || nested || sequence.indexOf(at) < 1 || at.rect.top <= item.rect.top + 0.25) {
            rowForced = false; // not a row's: the grab's, as before
            continue;
          }
        }
      }
      if (!bounded || reachesBelowTheEdge({ report, sourceOf, pageStart, contentHeight: conditions.contentH })) break;
      // @ts-expect-error `words` is a number wherever the feed is bounded, and a feed that is not bounded broke out above
      words *= 2;
    }

    // The measured extents: a block the feed holds whole, neither resumed nor cut short, is the block's own height at this page's width.
    for (const it of items) {
      if (it.carried || it.ends || divides(it.cut)) continue;
      const box = report.boxOf(it.clone);
      if (box) heights.set(it.source, box.rect.height);
    }

    // A row's forced break is the Stonehand's to place, and the grab's event is spent on it; one the layout showed not to be a row's was cut as the grab always cuts.
    if (rowishEvent && rowForced) {
      forcedNext = null;
      namedSwitch = false;
    }
    const rowForcedActive = rowForced && rowEventIn;

    /** The milliseconds the cut's address-making spends, by piece, for the page's `cicero:address` measure; the pieces overlap (`nested` and `flowPlace` run inside `carried`). */
    const tReport = t;
    let tAddress = t;
    const addr = { carried: 0, nested: 0, flowPlace: 0, rowPlace: 0, flatten: 0, entry: 0 };
    const timed = ( key: keyof typeof addr,  fn: Function) => ( ...args: any[]) => {
      const s = performance.now();
      try {
        return fn(...args);
      } finally {
        addr[key] += performance.now() - s;
      }
    };

    const itemOf = ( box: Box) => {
      let top = box;
      while (top.parent) top = top.parent;
      return items.find((it) => it.clone === top.el);
    };

    /**
     * Where a carried parallel flow resumes — one address (tablet, The Flows; §2.1). Since 2026-10-08 it is read off the flow's own verdict (`flowPlaceOf`) and the geometric walk below is its fallback, for a flow that offers no place above the height; what follows describes that walk.
     *
     * A float was divided by the main flow's cut and never by a candidate of its own, so there was no verdict to read a class off (it has one now, above); the geometry answers the same question the Stonehand's classes answer, and this walk asks it of the flow's own procession: the first box the cut does not leave wholly above it is where the flow resumes, and what kind of address it takes is what the cut did to that box. Wholly below it — a bare path, the box resumes whole. A line stack the cut passes through — its path plus the words on the lines above. A line stack whose lines are all above but whose own extent crosses — a blank shell of what it has left, which is the end gap read from the other side and is exactly what a declared-height paragraph leaves when the cut falls in its own trailing space. A composite — descend, because the cut is inside one of its children. Nothing crossing at all — the flow's own end gap crosses, and the flow itself takes the shell.
     *
     * This replaced a word count summed across every paragraph inside the float, which is words ordering boxes — the one place the round's entry names its candidate as not simply reaching. A box with no words of its own had no coordinate there, so the plate in `packages/essay/cases/56-the-plate-inside-the-carried-float` was consumed as spent from a continuation that had never shown it.
     *
     * **One stated limit, narrowed 2026-10-08: a float that is a monolith straddling the cut resumes whole on the next page** (a monolith inside a float, with nothing in the flow fitting above it, is the edge's own cut now, as on the page), and this page's clipped view of it is left as it is. the remedy that *the page edge is not a break point* (C10) names — slicing the graphic and painting the remainder — is a shell, and the tablet says a parallel flow's remainder must be live rather than painted, so the two answers are not the same answer and choosing between them is a round of its own. Nothing is lost either way: the box arrives whole.
     */
    /**
     * The places of a flow at a cut, as the tree the walk already is (*every branch gets a place*, 2026-09-21; *a parallel flow is a fragmentainer*, 2026-10-08). The result is one place — `box`, `word`, `px`, exactly the address this walk always answered, the flow's own resume point — and under it `flows`: the other places, one for every item of a row the cut passes through, nested as the rows are. A row's items stand beside each other, so one address cannot speak for them: the word space lays the second after the first, and resuming at a place in the second declared the first wholly spent — its remainder on no page, measured in every container that lays boxes side by side (`packages/essay/probes/conservation.js`).
     *
     * So where the walk meets a divided row, every item gets a place of the three kinds the address already has: lines the cut crosses take a path and a word; a box wholly below takes a bare path; an item with nothing left takes its own path and a zero remainder, and is kept as an empty box that holds its column. The last item's place is the flow's own — the one nearest what the flat order always chose, so everything after it is still whole and everything before it is spent unless it has a place of its own — and the earlier items ride beneath it in `flows`, each naming the item it speaks for (`itemBox`) and what it has left (`remainingPx`). An item that holds a row of its own carries that row's earlier items in its `flows`, so the nesting the flat list used to leave in the paths is the tree's.
     */
    const placesOf = (box: Box, cutY: number, eps: number = 0.25): Place => {
      const shellOf = ( b: Box): Place => ({ box: b, word: null, px: { remaining: b.rect.bottom - cutY, paint: null }, flows: [] });
      const spent = ( b: Box): Place => ({ box: b, word: null, px: { remaining: 0, paint: null }, flows: [] });
      /** What the cut did to one box of the flow, or `null` where the box lies wholly above it. */
      const addressOf = (b: Box): Place|null => {
        if (b.rect.bottom <= cutY + eps) return null; // shown whole on the page before
        if (b.rect.top >= cutY - eps) return b.anonymous ? { box: b, ...placeAt(report.wordsOf(b), 0), px: null, flows: [] } : { box: b, word: null, px: null, flows: [] }; // wholly below the cut: the flow resumes AT it — at a run's first word, since a run has no path of its own
        if (b.blockChildren.length) return within(b);
        if (!b.anonymous && isMonolith(b.el, win.getComputedStyle(sourceOf(b.el) ?? b.el), sourceOf(b.el) ?? b.el)) return { box: b, word: null, px: null, flows: [] }; // the stated limit
        const lines = report.linesOf(b);
        const shown = lines.filter((l) => l.bottom <= cutY + eps).length;
        if (shown < lines.length) return { box: b, ...placeAt(report.wordsOf(b), shown), px: null, flows: [] };
        return shellOf(b);
      };
      /** The first box of `b`'s procession the cut does not leave wholly above — and, where that box stands in a row, every item of the row beneath it. */
      const within = (b: Box): Place => {
        for (const child of b.blockChildren) {
          const row = report.rowOf(child);
          if (!row) {
            const at = addressOf(child);
            if (at) return at;
            continue;
          }
          if (row[0] !== child) continue; // a row answers once, at its first item
          if (Math.max(...row.map((r) => r.rect.bottom)) <= cutY + eps) continue;
          if (Math.min(...row.map((r) => r.rect.top)) >= cutY - eps) return { box: child, word: null, px: null, flows: [] }; // the whole row below the cut: it resumes at its first item
          const places = row.map((item) => ({ item, at: addressOf(item) ?? spent(item) }));
          const last = (places.pop() as NonNullable<typeof places[number]>);
          return { ...last.at, itemBox: last.item, flows: [...places.map(({ item, at }) => ({ ...at, itemBox: item, remainingPx: item.rect.top < cutY && item.rect.bottom > cutY ? item.rect.bottom - cutY : null })), ...last.at.flows] };
        }
        return shellOf(b);
      };
      // **A flow that IS the line stack has no children to ask, so the question is asked of the box itself** (`packages/essay/cases/57-the-float-that-is-its-own-line-stack`). The walk used to ask the children alone, so a float holding bare text fell through to the shell and continued as an empty box of the right height — and one standing wholly below the cut was shelled blank at its full extent and never displayed at all.
      return box.blockChildren.length ? within(box) : addressOf(box) ?? shellOf(box);
    };

    /**
     * §2.1's parallel flows, carried (tablet, The Flows). A box laid out beside the flow fragments independently, and its words sit before the cut in document order — so the ordinary consumption would drop it whole, losing whatever the page edge crossed. *the page edge is not a break point* (C10) forbids that: a view cannot destroy what it merely fails to show. Each straddler contributes its own address — the plural *a resume point is a path* (I2) has always carried — and its own geometric remainder beside it.
     *
     * `cutB` is the block the main flow resumes at; a flow at or past it is covered by the ordinary feed. `blocks.length` asks the question for a page the main flow finished.
     */
    /** A verdict as a place (*a parallel flow is a fragmentainer*, 2026-10-08) — the place a flow resumes at, read off the verdict its own walk gave instead of off the geometry alone. The three kinds the address has, spelled as the page's own cut spells them (the minting below, for the main path): a Class A takes a bare path to the box it falls before — a run's first word for an anonymous one; a Class B a line stack's path and the word after line `k`; an end-gap Class C the box's path and the extent it has left; a start-edge Class C the first child, with its gap; the edge's own cut the box and what it has shown and has left; and a cut through a row the places of that row's items. */
    const verdictPlace = (v: Verdict): Place => {
      const tag = { cls: v.cls, trace: { kind: v.kind, violates: v.violates, k: v.k, y: v.y, ...(v.forced ? { forced: true } : {}) } };
      if (v.kind === 'R') return rowPlaceOf(v);
      if (v.kind === 'A') return { ...(v.box.anonymous ? { box: v.box, ...placeAt(report.wordsOf(v.box), 0) } : { box: v.box, word: null }), px: null, flows: [], ...tag };
      if (v.kind === 'B') return { box: v.box, ...placeAt(report.wordsOf(v.box), (v.k as number) + 1), px: null, flows: [], ...tag };
      if (v.kind === 'E') return { box: v.box, word: null, px: { remaining: v.box.rect.bottom - v.y, paint: v.y - v.box.rect.top }, flows: [], ...tag };
      if (v.edge === 'start') return { box: (v.child as Box), word: null, px: null, gap: true, flows: [], ...tag };
      return { box: v.box, word: null, px: { remaining: v.box.rect.bottom - v.y, paint: null }, flows: [], ...tag };
    };

    /** The class and the trace a place carries when a verdict made it, for the node of the tree to keep (`ResumeNode`'s `cls` and `trace`): each flow's own account, beside the entry's, which is the main path's. */
    const tagOf = (p: Place) => (p.cls ? { cls: p.cls, trace: p.trace } : {});

    /** The places of a row cut at a height, one per item, from the verdicts the Stonehand gave each (`v.items`): an item wholly above the height is spent, one wholly below it or held whole (a monolith the height crosses) resumes at its own start, one it divides resumes where its verdict says — or, where it holds nothing to show, where the geometry says. The last item's place is the flow's own and the earlier items ride beneath it, exactly as `placesOf` shapes a row it walks. */
    const rowPlaceOf = (v: Verdict): Place => {
      const cutY = v.y;
      const places = (v.items as RowItem[]).map(({ item, state, verdict }) => ({
        item,
        // An item that is `done` has shown all its content and continues as a shell of what its box has left; the Stonehand said so knowing where a divided cell's content stands (`cellLift`), which the geometry of the feed does not.
        at: state === 'above' ? { box: item, word: null, px: { remaining: 0, paint: null }, flows: [] } : state === 'done' ? { box: item, word: null, px: { remaining: item.rect.bottom - cutY, paint: null }, flows: [] } : state === 'below' || state === 'held' ? { box: item, word: null, px: null, flows: [] } : verdict ? verdictPlace(verdict) : placesOf(item, cutY)
      }));
      const last = (places.pop() as NonNullable<typeof places[number]>);
      return { ...last.at, itemBox: last.item, flows: [...places.map(({ item, at }) => ({ ...at, itemBox: item, remainingPx: item.rect.top < cutY && item.rect.bottom > cutY ? item.rect.bottom - cutY : null })), ...last.at.flows] };
    };

    /** The place a carried parallel flow resumes at, from its own walk's verdict at the height the page's cut fell at, and from the geometry where it offers none (a flow that is a monolith, one that shows nothing above the height). A float's constraints are its own: the page's cut does not read them, and they do not read the page's. */
    const flowPlaceOf = timed('flowPlace', ( box: Box,  cutY: number) => {
      const root = !box.anonymous && isMonolith(box.el, win.getComputedStyle(sourceOf(box.el) ?? box.el), sourceOf(box.el) ?? box.el) ? null : box;
      const v = root ? adjudicateFlow({ report, sourceOf, root, limit: cutY }) : null;
      return v ? verdictPlace(v) : placesOf(box, cutY);
    });

    /** A place as a node of THE RESUME TREE (*a parallel flow is a fragmentainer*, 2026-10-08): the address, its projection, the leaf it names, the extent it has left and — for a row item — `item`, the path of the item it speaks for, which is what tells it from a carried float and what the fragment builders find the item by. The place's own `flows` become the node's, recursively, so a row inside a cell inside a row is the tree it is. */
    const itemNode = (p: Place, blockIndex: number): ResumeNode => {
      const leaf = (sourceOf(p.box.el) as Element);
      const cut = cutInLeaf(leaf, blockIndex, p.word == null ? null : inSource(consumedAnywhere(leaf), (p as { word: number, char?: number })), p.px, !!p.gap);
      return { pos: posOfCut(cut), box: leaf, cut, remainingPx: p.remainingPx ?? null, item: pathOf(sourceOf((p.itemBox as Box).el), blocks[blockIndex], blockIndex), flows: p.flows.map((f) => itemNode(f, blockIndex)), ...tagOf(p) };
    };

    /**
     * §2.1's parallel flows, carried (tablet, The Flows). A box laid out beside the flow fragments independently, and its words sit before the cut in document order — so the ordinary consumption would drop it whole, losing whatever the page edge crossed. *the page edge is not a break point* (C10) forbids that: a view cannot destroy what it merely fails to show. Each straddler contributes its own node of the resume tree — the plural *a resume point is a path* (I2) has always carried — with its own address and its own geometric remainder, and the items of a row it holds beneath it.
     *
     * `cutB` is the block the main flow resumes at; a flow at or past it is covered by the ordinary feed. `blocks.length` asks the question for a page the main flow finished. **A flow behind the cut inside the resume block is carried too** (*a parallel flow is a fragmentainer*, 2026-10-08; beltype#43): the record is a tree and the walk descends the block's procession, so a float or an absolutely positioned box declared one block deeper than the page's flow, standing before the cut and crossing it, is a node of the main flow's `flows` tagged with the path of its own box — the tag a row item takes, and the one the fragment builders keep a box standing before a cut by. `mainCut` is the address the main flow resumes at, which says what stands before it.
     *
     * **A stated limit, filed**: a parallel flow declared inside an in-flow block behind the resume block is not carried (its enclosing block is spent whole and leaves the interval, so there is no fragment of its enclosing block to keep the flow in), nor is one inside a box that reads its children or a monolith.
     */
    const carriedFlows = timed('carried', ( cutY: number,  cutB: number,  mainCut: Address|null) => {
      const out: ResumeNode[] = [];
      for (const item of items) {
        if (item.blockIndex >= cutB) continue; // at or past the resume block: the ordinary feed covers it
        if (!isOutOfFlow(win.getComputedStyle(item.source))) continue; // in-flow blocks behind the cut are spent, exactly as before
        const box = report.boxOf(item.clone);
        if (!box || box.rect.bottom <= cutY) continue; // it ended above the cut — nothing crossed, nothing to carry
        const at = flowPlaceOf(box, cutY);
        const leaf = sourceOf(at.box.el) ?? item.source;
        // A word is leaf-relative in source coordinates, and this page's clone may already have consumed some of that leaf's own words — `consumedIn` is the term between the two, exactly as it is for a Class B cut in the main flow. A resume at the leaf's first word is a place between boxes rather than inside one, so it is spelled as the bare path it is.
        const cut = cutInLeaf(leaf, item.blockIndex, at.word == null ? null : inSource(consumedIn(item.cut, leaf), (at as { word: number, char?: number })), at.px);
        // The remainder is a fact about a box the cut crossed. A flow whose own top lies below the cut has shown nothing of itself and is re-fed whole on the next page, so it has no remainder to state and gets none.
        const remainingPx = box.rect.top < cutY ? box.rect.bottom - cutY : null;
        // Progress or drop (*the build cannot fail*, C2): a carried flow that showed nothing new would carry forever. Termination is never traded for completeness — and a flow that cannot advance is a finding, not a loop. What it carries beneath it goes with it: a voided node voids its subtree.
        if (!item.cut || cutAfter(cut, item.cut, posOfCut)) out.push({ pos: posOfCut(cut), box: item.source, cut, remainingPx, flows: at.flows.map(( f: Place) => itemNode(f, item.blockIndex)), ...tagOf(at) });
      }
      if (mainCut) for (const item of items) if (item.blockIndex === cutB) out.push(...nestedFlows(item, cutY, mainCut));
      return out;
    });

    /** The parallel flows declared inside the resume block and standing before the cut, walked down the block's procession. A box that reads its children, a monolith, a parallel flow (its interior is its own, the tree below reaches it through `placesOf`) and a row item are not descended: the first three have no break point of ours inside them, and a row item's place belongs to the row's cut. */
    const nestedFlows = timed('nested', ( item: FeedItem,  cutY: number,  mainCut: Address) => {
      const out: ResumeNode[] = [];
      const root = report.boxOf(item.clone);
      const walk = ( parent: Box) => {
        for (const child of parent.blockChildren) {
          if (child.anonymous) continue;
          const source = sourceOf(child.el);
          if (!source) continue;
          const style = win.getComputedStyle(source);
          if (isOutOfFlow(style)) {
            const path = pathOf(source, blocks[item.blockIndex], item.blockIndex);
            // Before the cut in document order, and crossing it: a flow after the cut is fed whole by the ordinary feed, one that ended above it has nothing to carry.
            if (child.rect.bottom <= cutY || !cutAfter(mainCut, { path, word: null, px: null }, posOfCut)) continue;
            const at = flowPlaceOf(child, cutY);
            const leaf = sourceOf(at.box.el) ?? source;
            const cut = cutInLeaf(leaf, item.blockIndex, at.word == null ? null : inSource(consumedAnywhere(leaf), (at as { word: number, char?: number })), at.px);
            const prior = (cursor.carried ?? []).find((c) => c.item && c.item.join('.') === path.join('.'));
            if (prior && !cutAfter(cut, prior.cut, posOfCut)) continue; // progress or drop (*the build cannot fail*, C2), as for any carried flow
            out.push({ pos: posOfCut(cut), box: leaf, cut, remainingPx: child.rect.top < cutY ? child.rect.bottom - cutY : null, item: path, flows: at.flows.map(( f: Place) => itemNode(f, item.blockIndex)), ...tagOf(at) });
          } else if (!report.rowOf(child) && !neverCutInside(source, style)) walk(child);
        }
      };
      if (root) walk(root);
      return out;
    });

    // What decides whether this page is full is the in-flow procession's own bottom. `report.flowBottom` is the maximum over every top-level box, a parallel flow's included — right for "did anything overflow this page" and wrong as the thing a cut is driven from, because §2.1 says a parallel flow couples through geometry alone and a float taller than the room left is not the main flow failing to fit. The two readings are kept apart rather than one replacing the other: the second is what says a page still owes a continuation after the flow beside it has ended.
    // The flow's own procession is the Gauge's answer (`processionOf` with no box), not a filtered box list: a top-level `display: inline` container is in no procession, and its block items are in this one — so their extent is counted here where a box-list filter counted neither.
    const { inFlowBottom, parallelBottom } = processionBottoms({ report, pageStart, parallel: (b) => { const it = itemOf(b); return it ? (isOutOfFlow(win.getComputedStyle(it.source)) as boolean) : false; } });
    const fits = fitsPage({ inFlowBottom, pageStart, contentHeight: conditions.contentH });
    /** The footer's reservation (*the header repeats*, 2026-10-14): a fragment that is not the table's last gives up the repeated footer's height from its usable extent (FOP's penalty width, Blink's `repeated_footer_block_size`). "Last" is answered in this same pass, with no loop: the remainder, with its own footer at its end, fits the page (`fits`), or it does not and the footer of the table the page's edge crosses is reserved. */
    let reservePx = 0;
    if (!fits && hasGroups) {
      const ct = container.getBoundingClientRect().top;
      const edge = pageStart + conditions.contentH;
      for (const f of container.querySelectorAll('tfoot')) {
        const src = sourceOf(f);
        // A footer that does not repeat is not reserved: its words follow the rows wherever it is written (*the-word-space-follows-the-table-display-order*), so it stands on the table's last fragment alone, where Chromium prints it.
        if (!f.getClientRects().length || !src || declined.has(src) || !mayRepeat(src)) continue;
        const table = f.closest('table');
        if (!table) continue;
        const r = table.getBoundingClientRect();
        if (r.top - ct < edge && r.bottom - ct > edge) {
          reservePx = f.getBoundingClientRect().height + (parseFloat((String(win.getComputedStyle(table).borderSpacing).split(' ').pop() as string)) || 0);
          break; // ponytail: one table's footer per page, the outermost in document order; a nested table's own footer is not reserved
        }
      }
    }
    const usableH = conditions.contentH - reservePx;
    const parallelCrosses = parallelBottom - pageStart > conditions.contentH + 0.25;
    // The check's first guarantee, asserted: a bounded feed holds a box of the procession below the limit, so it cannot fit, and the three branches below that read `fits` as true are a whole feed's.
    if (bounded && fits) throw new Error(`a bounded feed fit page ${account.length + 1} — the Cast-off's check let a short feed through; a defect to file, not a bail to hide`);
    let entry: Entry;
    let next: Cursor|null = null;
    ahead = null; // spent: this page's pour read it, and only an adjudicated cut below leaves another
    /** The items of a row this page's cut divides, each with the extent from its top to the page's foot (below). */
    const extents: { path: number[]; px: number; }[] = [];
    /** §5.3's *leaving room*, as a view literal (*the first fragment is constructed*). The room the cut left the page for the block-end decoration every broken box it clones will wrap its fragment in — the Stonehand's own `clonedBlockEnd`, priced on the winning candidate and never re-derived. Zero on a forced or terminal entry: no box was divided, so nothing clones anything at this edge. */
    let cutCost = 0;
    /** A start-edge Class C's gap, as the Stonehand priced it (*the cut divides its ancestors*, 2026-09-29). What stands there — an empty float, the clearance under it — gives the box no height once the child after it has left the first fragment, so the gap is not part of the extent the page used: it is where the divided box's content box extends to, §5.3's own sentence, and `usedPx` leaves it to the extension. The flow's clip is the same sum either way. Zero on every other cut. */
    let startGap = 0;

    if (fits && !rowForcedActive && !forcedNext && parallelCrosses) {
      // The main flow is done and a flow beside it is not (§2.1 again, and *the page edge is not a break point*, C10). The entry's main path is the document's end — `pageIntervals` presents nothing for a start there, and the check for *the build cannot fail* (C2) counts a later address as progress — and the flows still running ride beside it, so the next page carries their continuations and nothing else. Closing the document here instead would be losing content at the edge, which is never a lawful outcome.
      // The document's end, as an address: the one path no source element answers to, which `posOfCut` projects onto the word space's total.
      const endCut = { path: [blocks.length], word: null, px: null };
      const carried = carriedFlows(pageStart + conditions.contentH, blocks.length, null);
      entry = createEntry({
        paths: flattenResume({ pos: posOfCut(endCut), cut: endCut, flows: carried }),
        cls: 'A',
        trace: { flowsOn: true, kind: 'A', violates: { avoid: false, ow: 0 } },
        closes: conditions
      });
      next = { cut: endCut, pos: posOfCut(endCut), carried: entry.paths.slice(1) };
    } else if (fits && !rowForcedActive && !forcedNext) {
      entry = createEntry({ paths: [], cls: 'A', trace: { terminal: true }, closes: conditions });
    } else if (fits && !rowForcedActive) {
      entry = createEntry({ paths: [{ pos: (forcedNext as Cursor).pos, box: (forcedEvent as NonNullable<typeof forcedEvent>).el, cut: (forcedNext as Cursor).cut }], cls: 'A', trace: { forced: true, namedSwitch, kind: 'A', violates: { avoid: false, ow: 0 } }, closes: conditions, owes: (forcedNext as Cursor).demandParity });
      next = forcedNext;
    } else {
      performance.measure('cicero:before-verdict', { start: t, end: (t = performance.now()), detail: { page: account.length } });
      const v = adjudicate({ report, sourceOf, pageStart, contentHeight: usableH, forcing: rowForcedActive });
      performance.measure('cicero:stonehand', { start: t, end: (t = performance.now()), detail: { page: account.length } });
      tAddress = t;
      // The check's second guarantee, asserted: the walk stopped at a box inside this feed, so it found a boundary or an edge. A null verdict writes an entry that overflows with the whole feed, and a bounded feed is not the whole of anything.
      if (!v && bounded) throw new Error(`the walk found no boundary in a bounded feed on page ${account.length + 1} — the Cast-off's check let a short feed through; a defect to file, not a bail to hide`);
      if (!v) {
        // One uncuttable run taller than the page: it overflows in place (*the build cannot fail*, C2 — content is never lost).
        if (forcedNext) {
          entry = createEntry({ paths: [{ pos: forcedNext.pos, box: (forcedEvent as NonNullable<typeof forcedEvent>).el, cut: forcedNext.cut }], cls: 'A', trace: { forced: true, namedSwitch, overflow: true, kind: 'A', violates: { avoid: false, ow: 0 } }, closes: conditions, owes: forcedNext.demandParity });
          next = forcedNext;
        } else {
          entry = createEntry({ paths: [], cls: 'A', trace: { terminal: true, overflow: true }, closes: conditions });
        }
      } else {
        cutCost = v.cost ?? 0;
        const item = (itemOf(v.box) as FeedItem);
        const cutB = item.blockIndex;
        /**
         * THE ADDRESS, by class, minted through the one `cutTo` above and against the source the Gauge's box was cloned from.
         *
         * A Class A cut and a start-edge Class C take a bare path to the box the page resumes at — which is the exact form of what a word approximated, since the word space cannot tell *before this box* from *at the word after it* wherever the box has no words. A Class B takes the line stack's own path plus a leaf-relative word. The edge cut and an end-gap Class C take the divided box's path plus the extent it has left, the first painted and the second blank.
         */
        let cut;
        /** The main cut's own row items: nodes of the main flow's `flows`, beside whatever parallel flow the cut crossed. */
        let rowNodes: ResumeNode[] = [];
        /** The place tree a cut through a row walked (`placesOf`), kept for the items it divides (`extents`, below). */
        let rowPlace: Place|null = null;
        let cls = v.cls;
        if (v.kind === 'A' && v.box.anonymous) {
          /** The boundary before a run (*the anonymous box is in the procession*, 2026-09-29). The run has no path of its own, so the place after the block child before it is spelled as the run's first word in its container: the container's path and a word, a Class B address at the run's first line. Two spellings were open and this is the one that holds at every run: the bare path to the next block child would put the run on the page before, and a trailing run has no next child at all. It resumes by consuming the container's words in document order — the block children before the run with them, which are put away wordless, since everything standing before the run's first word is before the cut (`fragments.js`' `consumeLeadingWords`). */
          const leaf = sourceOf(v.box.el);
          const at = inSource(consumedIn(item.cut, leaf), placeAt(report.wordsOf(v.box), 0));
          cut = cutTo(leaf, cutB, { word: at.word, char: at.char });
        } else if (v.kind === 'A') cut = cutTo(sourceOf(v.box.el), cutB);
        else if (v.kind === 'B') {
          const leaf = sourceOf(v.box.el);
          // The Gauge read this page's clone, so the place counts into what the leaf has left; the address carries a leaf-relative word — and a character, where the next line begins inside a word — in source coordinates, and `consumedIn` is the one term between the two (positions.js's identity).
          const at = inSource(consumedIn(item.cut, leaf), placeAt(report.wordsOf(v.box), (v.k as number) + 1));
          cut = cutTo(leaf, cutB, { word: at.word, char: at.char });
        } else if (v.kind === 'R') {
          // Through a row: nothing was chosen inside it, so the address is read off the geometry by the same walk that addresses a carried flow — the last item's place is this cut, and every other item's rides beside it below.
          const at = rowPlaceOf(v);
          rowPlace = at;
          const leaf = sourceOf(at.box.el);
          cut = cutInLeaf(leaf, cutB, at.word == null ? null : inSource(consumedAnywhere(leaf), (at as { word: number, char?: number })), at.px);
          rowNodes = at.flows.map((f) => itemNode(f, cutB));
          // The class is css-break-3's, and it names what the break IS where the main path took it: between lines, in an end gap, or before a box. `kind: 'R'` stays on the trace as the engine's own reading, as `E` does.
          cls = at.word != null ? 'B' : at.px ? 'C' : 'A';
        } else if (v.kind === 'E') {
          // The edge cut (*the page edge is not a break point*, C10). The box's words are not consumed — its graphic continues, painted, on the next page — so the address is the box itself and progress rides the shrinking remainder. `paint` is cumulative from the source box's top, not this page's share: continuations rebuild from the source every cycle, and on the next cycle the box's rect top already sits above the page start by everything shown so far.
          cut = cutTo(sourceOf(v.box.el), cutB, { px: { remaining: v.box.rect.bottom - v.y, paint: v.y - v.box.rect.top } });
        } else if (v.edge === 'start') {
          // Before the box's first in-flow child, past the gap the Stonehand priced: the box is divided there, so the path keeps its zero where the child is the first.
          cut = cutTo(sourceOf((v.child as Box).el), cutB, { gap: true });
          startGap = v.gap ?? 0;
        } else {
          // C in the end gap: the box's content closes with this page (its own words only — siblings after a nested box continue in flow); the box's remainder past the cut — leftover gap space plus bottom decoration — continues as a blank shell of exactly that height. `posOfCut` reads this one address as the box's own end, for the reason stated there.
          cut = cutTo(sourceOf(v.box.el), cutB, { px: { remaining: v.box.rect.bottom - v.y, paint: null } });
        }

        const pos = posOfCut(cut);
        const flows = [...carriedFlows(v.y, cutB, cut), ...rowNodes];
        /** §5.3's extension for a divided item (*the fragment lays out under the feed's conditions*, 2026-10-08). A row is cut through at a height, and the items it divides are each a box that breaks: each one's border box extends to the page area's foot, which is the distance from its top to the foot and a fact of this feed — the main path's extension (`usedPx` to the foot) cannot say it, since a row's cut stands at the edge and its items' lines end above it. Read off the place tree the cut walked; an item wholly shown, wholly below the cut or with nothing left is divided by nothing and gets none. */
        if (rowPlace) {
          const foot = pageStart + usableH;
          (function visit( place: Place) {
            const item = place.itemBox;
            if (item && item.rect.top < v.y - 0.25 && item.rect.bottom > v.y + 0.25) extents.push({ path: pathOf(sourceOf(item.el), blocks[cutB], cutB), px: foot - item.rect.top });
            for (const f of place.flows) visit(f);
          })(rowPlace);
        } else if (v.kind !== 'E') {
          // A table cell the main path's cut divides gets the same extension: Chromium's print aligns a divided cell's content within its first fragment, which reaches the foot, and the Stonehand judged the cut so (`cellLift`).
          const foot = pageStart + usableH;
          for (let p: Box|null = v.kind === 'A' ? v.box.parent : v.box; p; p = p.parent) {
            if (win.getComputedStyle(p.el).display === 'table-cell' && p.rect.top < v.y - 0.25 && p.rect.bottom > v.y + 0.25) extents.push({ path: pathOf(sourceOf(p.el), blocks[cutB], cutB), px: foot - p.rect.top });
          }
        }

        const tf = performance.now();
        const flat = flattenResume({ pos, box: sourceOf(v.box.el), cut, flows });
        addr.flatten += performance.now() - tf;
        entry = createEntry({
          // The box is a live pointer; the chain above it is resolved from the address rather than stored — it was write-only in production and left with the streamline round.
          paths: flat,
          cls,
          // The trace carries the cut's own account of what it could not satisfy (the make-up order's keys), not a rung name. It is strictly more informative: a rung said which permissions were active, this says what was actually spent — which is what the differential's honesty check needs, and what a reader of a Ledger wants to know.
          trace: { kind: v.kind, violates: v.violates, k: v.k, y: v.y, ...(v.forced ? { forced: true } : {}) },
          closes: conditions
        });
        // `demandParity` is a forced break's own (§3.1's second break); a row's forced break hands it on like the grab's does.
        next = { cut, pos, carried: entry.paths.slice(1), ...(v.forced && rowForcedActive && (forcedEvent as NonNullable<typeof forcedEvent>).parity ? { demandParity: (forcedEvent as NonNullable<typeof forcedEvent>).parity } : {}) };
        ahead = { report, y: v.y, contentW: conditions.contentW };
      }
    }

    /** The bottom of a page that no cut closed, parallel flows nested in a block included (*a parallel flow is a fragmentainer*, 2026-10-08). `report.flowBottom` is the maximum over the top-level boxes, a top-level float's own among them; a float one block deeper does not hold its enclosing block open, so on the document's last page the flow's clip at this number hid the carried float's remainder (case 96: five of its seven lines). The nested box counts only where it ends inside the page area — one that does not is cut at the area's edge, the limit `carriedFlows` states. */
    function nestedFlowBottom() {
      let bottom = report.flowBottom;
      const foot = pageStart + usableH;
      for (const box of report.boxes()) {
        const src = box.parent && sourceOf(box.el);
        if (src && isOutOfFlow(win.getComputedStyle(src))) bottom = Math.max(bottom, Math.min(box.rect.bottom, foot));
      }
      return bottom;
    }

    performance.measure('cicero:address', { start: tAddress, end: performance.now(), detail: { page: account.length, ...addr } });
    performance.measure('cicero:adjudicate', { start: tReport, end: (t = performance.now()), detail: { page: account.length, cls: entry.cls, kind: entry.trace.kind ?? null } });
    ledger.append(entry);
    /** The tracks the page was decided under (*the fragment lays out under the feed's conditions*, 2026-10-08; *render-identical conditions*, I5). Every table and grid that either end of this page's fragments passes through — the boxes on the chain of the cursor's places and of the entry's places, a row item's included — with the column widths or the column list this feed laid them out at, read from the report that decided the page. They ride the account as literals, and the presentation writes them into the fragments (`fragments.js`' `pinTracks`): the feed holds the box whole, a fragment holds it with what lies outside its interval put away, and a box that reads its children is not the same box. The feed's own clones are never pinned — they are what the numbers are read from. */
    const tracks: ({ path: number[]; }&Tracks)[] = [];
    {
      const seen = new Set<any>();
      const places = [...(cursor.carried ?? []), ...entry.paths].flatMap((p) => [p.cut.path, ...(p.item ? [p.item] : [])]);
      for (const path of [cursor.cut.path, ...places]) {
        const block = blocks[path[0]];
        for (let el = block ? boxAt({ path }) : null; el; el = el === block ? null : el.parentElement) {
          if (seen.has(el)) continue;
          seen.add(el);
          const clone = cloneOfSource.get(el);
          const box = clone ? report.boxOf(clone) : null;
          const read = box ? report.tracksOf(box) : null;
          if (read) tracks.push({ path: pathOf(el, block, path[0]), ...read });
        }
      }
    }
    account.push({
      cls: entry.cls,
      trace: entry.trace,
      pos: entry.paths[0] ? entry.paths[0].pos : null,
      // The address, read from the entry's own path and re-encoded nowhere (the 2026-08-04 account ruling). It replaces `posBlock`, `resumePath`, and a shell's path with its two extents — four literals seated in four rounds, each one more way of saying *where* beside a `pos` that could not. The block is `cut.path[0]`, which the view reads directly rather than decomposing the flat position, because the word space under-determines block seams wherever a block has no words (case 04's plate).
      cut: entry.paths[0] ? entry.paths[0].cut : null,
      // The parallel flows this cut crossed, each with its own address and its own geometric remainder — the plural of *a resume point is a path* (I2), realized. A carried float can be a wordless figure (tablet, The Flows). Read from the entry's own paths, one source. The presentation feeds them onto the next page as live boxes.
      carried: entry.paths.length > 1 ? entry.paths.slice(1).map((p) => ({ pos: p.pos, cut: p.cut, remainingPx: p.remainingPx ?? null, ...(p.item ? { item: p.item } : {}), ...(p.cls ? { cls: p.cls, trace: p.trace } : {}) })) : null,
      // An ordinary page: content flowed onto it. The blank branch at the loop's top is the only writer of `true`.
      blank: false,
      // §5.2's page-start half, view side: the leading margin the measure pass truncated (positions are border edges — contentTop is exactly that margin). Presentation compensates by this literal, or the whole page renders low and un-clips the straddler's tail. Zero when the margin was not truncated (document start, or after a forced break — see `truncateLead`): there is nothing to compensate, and `.flow` is `display: flow-root`, so the margin stays inside the flow box and `usedPx` already counts it.
      leadPx: (truncateLead ? report.contentTop : 0) + spentLead,
      // The tracks the feed laid its tables and grids out at, and the extents of the items its cut divides, for the fragments of this page to be written (above).
      tracks,
      extents,
      // The table groups judged on this page and the room the page gave up to a repeated footer (*the header repeats*).
      repeats: madeHere,
      reservePx,
      // The page's used extent: the cut's own y (or the whole flow when everything fit). The presentation clips the flow here, not at the content edge — a cut line box can overflow contentH while its glyph ink still starts above it, and ink is what the print text layer keeps.
      usedPx: (entry.trace.y ?? nestedFlowBottom()) - pageStart - startGap,
      // The room §5.3 asks the cut to leave, beside `usedPx` and `leadPx` — the third number the presentation needs to know where this page's ink stops, and the one the first fragment's extension is the difference of.
      cost: cutCost,
      closes: closesOf(conditions)
    });

    // Convergence (*the run resumes from an entry*): the entry just written has the key a prior page's entry had, at an index the shift accounts for, with its addresses clear of the edit — so the pages after it are the prior pages after that one, and the run need not cut them.
    if (resume && !converged) {
      const j = converge({ keys: resume.keys, entry, geometryByParity, dirtyPaths: resume.dirtyPaths, atLeast: resume.atLeast });
      if (j >= 0) {
        converged = { i: account.length - 1, j };
        // The prior run stopped at a page (`pace`) and the document goes on past its last: the pages it cut are kept as they are, and the run cuts on from the last of them rather than ending here (*the pages are cut as far as they are asked*).
        if ((prior as Prior).incomplete) {
          const last = keepAfterConvergence();
          if (last?.paths.length) {
            cursor = cursorAfter(last);
            await paced();
            continue;
          }
        }
        break;
      }
    }
    if (!next) break;
    // Progress under *the build cannot fail* (C2), asked of the address (`positions.js`' `cutAfter`): a later place in the tree, a later word in the same line stack, entering a shell, or a shell that shrank — a monolith taller than a page slices down page by page at one address, and the remainder is what moves. Beside it, a carried parallel flow that showed more of itself, which is real progress and not a courtesy: a float tall enough to fill a page legitimately leaves the main flow standing still while the document advances, and a check blind to it would call correct behaviour a defect.
    const speaksFor = ( c: { item?: number[]; cut: Address; }) => (c.item ?? [c.cut.path[0]]).join('.'); // a carried float is its block; a row item is its own path
    const carriedBefore = new Map((cursor.carried ?? []).map((c) => [speaksFor(c), c.cut]));
    const carriedAdvanced = (next.carried ?? []).some((c) => cutAfter(c.cut, carriedBefore.get(speaksFor(c)) ?? null, posOfCut));
    if (!(carriedAdvanced || cutAfter(next.cut, cursor.cut, posOfCut))) {
      throw new Error(`the walk failed to advance at [${cursor.cut.path}]${cursor.cut.word == null ? '' : ` word ${cursor.cut.word}${cursor.cut.char ? ` char ${cursor.cut.char}` : ''}`} — a defect to file, not a bail to hide (C2)`);
    }
    cursor = next;
    await paced();
  }

  (ctx as MeasureContext).dispose();

  // The prior pages after the converged one, written again at their shifted indices: every address equal, every page number and parity this run's. (A prior that stopped at a page was kept above, where the run went on from it.)
  if (converged && !(prior as Prior).incomplete) keepAfterConvergence();

  /**
   * The page's named strings, filled in once the intervals exist (*the host rewrites what the parser drops*, 2026-09-14).
   *
   * GCPM's four keywords are all questions about a page's interval — the first assignment on it, the last, whether the assigning element opened it, whether it carries one at all — and an interval is not a thing a page's conditions can hold when they are built, because they are built at the page's start and the end is what the cut decides. So the readings ride the account afterwards, as one pass over the entries the loop just wrote: entry `i` closes page `i`, so page `i` runs from the previous entry's position to this one's, and the last page runs to the document's end.
   *
   * They land on the account's own `closes` — the narrow slice the presentation reads — and the presentation publishes them on the page's host (`chase.js`'s `setStrings`, *the page carries its conditions*).
   */
  fillStrings();

  // `index` rides out with the rest (BelType's spine round, purely additive): the position index is built here over the untouched sources and answers block-of-element and words-before-element in O(1), so a caller holding a source element — a host that knows which node an edit touched — can ask where in the paginated document that node's words begin without rebuilding anything. `wordCounts` stays beside it, unchanged, for every consumer that already reads it.
  const resumed = resumedNow();
  return { ledger, account, conditions: account.length ? { ...account[0].closes } : null, wordCounts, index, composition, compositionCache, blockCount: blocks.length, hasMarks, heights, resumed, why: resume ? null : whole };
}
