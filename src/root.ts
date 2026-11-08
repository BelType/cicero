/**
 * The root — `<beltype-root>` (architecture: The Chase, slot-versus-fragment reconciliation; third-coding-round.md item 2). The document lives once as this element's light DOM (*content is one document*, I6); the shadow holds the pages; `present` projects the Ledger's intervals into them by imperative slot assignment.
 *
 * Reconciliation, per the architecture: whole boxes are assigned as originals — live, accessible; a straddler's original goes to the page where it begins (the flow clips its tail at the cut; *tail clipping*, P11) and every later page receives a continuation fragment built by the same machinery the measure feed used (src/fragments.js), dressed and `aria-hidden` (assistive technology reads everything once, from originals). In composed mode, composed content presents through its hinted fragments — an original cannot carry the chosen lines without being written (*the source document is never written*, C5, forbids it), so the fragment is the sole rendering and is not aria-hidden; the original stays in the light DOM, unassigned and unrendered, the canonical source.
 *
 * **Every fragment of a block is built with the page's tracks and extents** (*the fragment lays out under the feed's conditions*, 2026-10-08): the account entry's literals, filtered to the block, are handed to `continuationClone`, `firstFragmentClone` and `fragmentOf` alike, which write them (`fragments.js`' `pinTracks`, `pinExtents`).
 *
 * **Every page is a sheet at once and its content is built where the reader is** (*only the pages near the reader are built*, 2026-10-12, `.claude/decisions/cicero/only-the-pages-near-the-reader-are-built.md`). `present()` builds each page's size, page context, clip and margin boxes and keeps the context its content is a function of on the page's record; `#buildContent` then constructs the fragments and seats the originals for the pages in view (in the presentation's own frame), for a page an `IntersectionObserver` says has come near, for a page a door asks for (`buildPage`, `buildAll`, `reveal`, a link to `#x`, the print event) and, in idle slices, for the rest. A page once built stays built. The cuts are decided before any of this and none is read or moved by it.
 *
 * **A margin box's running element is the page's answer, never the root's choice** (*a running element is a named node*, 2026-10-21, `.claude/decisions/cicero/a-running-element-is-a-named-node.md`). The run hands back its list of running elements and each page's `closes.running` names, per name and keyword, the element's place in that list; `#chrome` slots a clone of that element, and slots nothing where the place is `null`, a page before the name's first assignment or a `first-except` on the page that assigns. The page's strings travel the other door, custom properties on its host, because a node is not a value.
 *
 * The continuation dressing (`content: none !important` on a divided box's ::before/::after and ::marker, blanket `all: unset !important` on its ::first-letter and ::first-line — over the marks `fragments.js` writes on every divided box, at every depth) is `dressing.js`' `ensureContinuationDressing`, which any host that presents pieces adopts, and the root adopts it first. Three sheets of the root's own carry everything else: one document-level constructed sheet with the fixed box's re-homing, one rule in a sheet of its own that a measure takes out (`break-before: auto !important`, see `dress`), and one press sheet of literals — per-geometry `@page` rules and per-page `page:` assignments (*named pages in print*, P13, and *honest document*, P14: named pages and fixed page boxes print exactly).
 *
 * @packageDocumentation
 */

import './chase.ts';
import { markCont, markCut, cloneFlowPiece, continuationClone, declineRepeats, firstFragmentClone, fragmentOf } from './fragments.ts';
import { pointShownBy, sourcePointOf } from './source-point.ts';
import { copyOf, holdsFixedBox, sourceOf } from './word-space.ts';
import { holdsPresented } from './presenters.ts';
import { transliterateContent, neutralizeMarginBoxes, sheetsUseHas } from './capture.ts';
import { ARTIFACT, decodeFragment, addWord, FIXED, FRAGMENT, selectorOf, setValue, wordOf } from './data-beltype.ts';
import { deliverValues, ensureContinuationDressing, ensureDressing, isWordsSheet } from './dressing.ts';
import { carriedPast, divides, elAtIn, extensionPx, flattenResume, flowsOf, indexBlocks, pageIntervals, pageOfPos, widthKeyOf, wordsBeforeChar } from './positions.ts';
import type { BeltypePage } from './chase.ts';
import type { Address } from './positions.ts';
import type { CompositionRecord } from './compose-dom.ts';
import type { transliterateContent as TransliterateContent } from './capture.ts';

/** One page interval of a presentation, as `positions.js`' `pageIntervals` builds it. */
export type Page = ReturnType<typeof pageIntervals>[number];
/** The composed records by width key, then by source element: what `present()` takes as `resolvedByWidth`. */
export type ResolvedByWidth = Map<string, Map<Element, CompositionRecord>>;
/** One entry of the driver's account, opaque here but for what `positions.js` reads off it. */
export type AccountRow = Record<string, any> & { usedPx: number };
/** A page's margin boxes, each box's `content` transliterated: `#marginPlan`'s answer. */
export type MarginPlan = Array<[string, ReturnType<typeof TransliterateContent>]>;

/** What a page's content is built from: everything the call that cut the page knew that its fragments are a function of (`present`'s own note on `ctx`). */
export type PresentContext = {
  account: AccountRow[];
  pages: Page[];
  blocks: Element[];
  fixed: Element[];
  hollow: boolean;
  resolvedByWidth: ResolvedByWidth | null;
  composeFor: ((page: number) => ResolvedByWidth) | null;
  composed: { from: number, to: number } | null;
  /** the pages composed later, by `composeFor`. */
  alsoComposed?: Set<number>;
  holdsFixed: (el: Element) => boolean | undefined;
  holdsPresented: (el: Element) => boolean | undefined;
  numberPiece: (clone: Element, b: number, page: number) => void;
  constructedBefore: (b: number, page: number) => boolean;
};

/** What one presented page owns (`#records`' own note). */
export type PageRecord = {
  page: BeltypePage;
  rootSlot: HTMLSlotElement;
  furnitureSlot: HTMLSlotElement;
  nodes: Element[];
  assigned: Element[];
  conts: Array<[Element, number]>;
  pieces: Array<[Element, number]>;
  constructsFirst: number;
  chrome: string;
  built: boolean;
  extPx: number;
  k: number;
  ctx: PresentContext;
};

const PRESS_STYLE_ID = '__beltype-press';
const FRAGMENT_SELECTOR = selectorOf(FRAGMENT);
let fixedSheet: CSSStyleSheet|null = null;
/** The one rule of the dressing that a measure must not see, in a sheet of its own so it can be taken out without disturbing the rest (see {@link dress}). */
let breaksSheet: CSSStyleSheet|null = null;

/**
 * The root's dressing, in the order the document wears it: the continuation dressing (`dressing.js`), the fixed box's re-homing, and the neutralized break properties.
 *
 * **`[data-beltype~="fixed"]` is three answers at once** (*the box on every page*, 2026-09-07; CSS 2.1 §9.3.1 and §9.6.1), and each is a sentence rather than a preference.
 *
 * `absolute` rather than `fixed` is what makes the repetition ours. A clone left as `position: fixed` would be repeated by the browser's own print, against the sheet — which is exactly the placement `cases/24-the-repeated-box` had recorded as a divergence nobody had decided. Absolute against the page frame's `.content-area`, the one positioned box in that shadow, makes the containing block the **page area**: css-page-3 §3 makes the page area the initial containing block for paged media, and §9.6.1 names the initial containing block when it says parts outside it will not print. Measured against Chromium's own print, which resolves a `left: 2mm` to the page margin plus 2mm and not to the sheet's own corner. CSS 2.1 §9.3.1's *"fixed with respect to the page box"* is the anchoring — the box does not travel with the content — and not the rectangle offsets resolve against; the two sentences are read together and neither is dropped.
 *
 * **The clip is the Chase's `.furniture` layer, and it stopped being free on 2026-09-18** (*the page rendering clips at the bleed area*). It used to need no rule at all: `.content-area` carried `overflow: clip` on both axes, so §9.6.1's *"boxes with fixed position that are larger than the page area are clipped"* fell out of the containing block being the page area — which [*the box on every page*](../../../.claude/decisions/cicero/the-box-on-every-page.md) recorded as the argument for that seat rather than a convenience of it. Once the content area stops clipping, first on the inline axis and then, on 2026-10-02, on the block axis too, that argument buys none of the rule, so the clones are delivered into a layer of their own whose padding box is exactly the rectangle their offsets already resolved against. §9.6.1 is the one page-area clip any of these documents names, and it is now the only one this engine performs.
 *
 * `!important` because the author wrote `fixed` and meant it. This is a decision product, and the whole point of *decisions land only as fragment hints or per-page literals* (C5) is that the decision lands on the clone and never on the source.
 *
 * **The root's two sheets are made once per realm and worn by the document, so the document is asked whether it still wears them, as `ensureContinuationDressing` asks of its own** ([*the engine asks the document for its sheets*](../../../.claude/decisions/cicero/the-engine-asks-the-document-for-its-sheets.md), 2026-10-20). A host may replace the document's adopted sheets between runs: the editing tools' kept print frame re-seats a new document with `document.open()`, which keeps the `Document` and its `Window`, and empties `adoptedStyleSheets`. Remembering only that the sheets were made, the second run went without them, and the resumed pieces of seven pages lost the `::first-letter` rule, which moved their justified gaps by one layout unit (measured, Caster's DESIGN.md S89).
 */
function ensureDressingSheet(doc: Document) {
  ensureContinuationDressing(doc);
  if (fixedSheet) {
    if (!doc.adoptedStyleSheets.includes(fixedSheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, fixedSheet, (breaksSheet as CSSStyleSheet)];
    return;
  }
  fixedSheet = new ((doc.defaultView as Window & typeof globalThis)).CSSStyleSheet();
  // A fixed box's per-page clone: absolute against the page area, clipped by it, the author's own offsets unchanged. See this function's own note.
  fixedSheet.replaceSync(`${selectorOf(FIXED)} { position: absolute !important; }`);
  breaksSheet = new ((doc.defaultView as Window & typeof globalThis)).CSSStyleSheet();
  // Forcing was consumed by the grab (*no forced break lies inside an interval*, C1) and geometry by the conditions (*geometry changes only at page boundaries*, C8): presented content must not re-fire native break properties inside a page box — a surviving break-before: page splits the host mid-frame in print.
  breaksSheet.replaceSync('beltype-root, beltype-root * { break-before: auto !important; break-after: auto !important; }');
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, fixedSheet, breaksSheet];
}

/**
 * Take the breaks sheet out of the cascade, or put it back — the measure's half of re-entry (*the run resumes from an entry*, build one, 2026-10-08).
 *
 * The sheet's `break-before: auto !important` is written for the presented fragments and, in a selector that cannot tell a fragment from an original, reaches every source in the root as well — and a source is exactly what the grab, the keeps and the parity demand read their forced and avoided breaks from. A run over a presented document would therefore see no forcing at all and cut a different Ledger. The sheet is presentation, not measure, so a host about to measure a document it has already presented takes it out and a complete presentation puts it back; the first run of a frame has no sheet yet and this is a no-op.
 *
 * **It is its own sheet, and a presentation of a document still being cut leaves it out** (*the pages are cut as far as they are asked*, 2026-10-12). The rest of the dressing — the continuation suppression and the fixed box's re-homing — is what a page looks like and stays in force on every presentation; this rule is the only one a measure cannot live beside, and a break property outside a fragmentation context does nothing on a screen. Toggling it between two slices restyled every element under the root each time (measured on the BGD manual in the editing tools, about 5 ms a stop, a third of the cost of stopping); left out for the length of the run and put back once at its end, it costs what it cost a whole run.
 */
export function dress(on: boolean) {
  if (breaksSheet) breaksSheet.disabled = !on;
}

/** Is this adopted sheet one of the engine's own — the root's two, or the sheets keyed on words (`dressing.js`: the words sheet, the values sheet and the continuation dressing)? A host reading the sheets the document wears (`seam/client.js`' conditions key) leaves them out. */
export const isDressingSheet = (doc: Document, sheet: CSSStyleSheet) => sheet === fixedSheet || sheet === breaksSheet || isWordsSheet(doc, sheet);

/** What {@link BeltypeRoot.pageOf} answers for a place the document has not been cut to yet: a string rather than a symbol, because the host that asks lives in another realm (a frame) as often as not. */
export const NOT_YET = 'not-yet';

export class BeltypeRoot extends HTMLElement {
  /** The host's way of asking the engine to cut as far as an element, set by the seam's client: a link into a place the document has not been cut to yet waits on it, then follows. Absent, such a link is followed as the browser follows it. */
  cutTo: ((el: Element) => Promise<unknown>)|null = null;
  /** The host's ear for the pieces a built page draws its blocks through, set by the seam's client (*a fragment announces its own size*, 2026-10-22): called with the flow pieces a page's content was just built with, each beside the source block it is a piece of — a constructed first fragment, a continuation, a two-cut fragment, a composed clone and the clone a nested fixed box left; never an original, a fixed box's per-page copy or a running element's — and with the nodes a presentation took out of the pages it unbuilt. Absent, nobody is told. */
  onPieces: ((built: Array<[Element,Element]>,removed: Element[]) => void)|null = null;
  #shadow;
  /** The last presentation's page intervals and position index — kept, not discarded, so `pageOf` answers over the same table the frames were built from (*the engine answers the page*). Null before the first `present()`. */
  #pages: Page[]|null = null;
  #index: ReturnType<typeof indexBlocks>|null = null;
  /** How many pages the document has, or null while it is still being cut: the chrome's `counter(pages)` and `pageOf`'s "not yet" both read it. */
  #total: number|null = null;
  /** What each presented page owns, by page index: the frame, its two slots, the root's light children it appended for it, everything its slots hold, and the chrome it last drew. Kept between calls so a resumed run can refill some pages and leave the rest where they stand (*the run resumes from an entry*, build two). Empty before the first `present()`. */
  #records: PageRecord[] = [];
  /** The list a page's running-element clones are collected into while its margin boxes are applied. */
  #collect: Element[]|null = null;
  /** The observer that builds a page when it comes near (*only the pages near the reader are built*), the record each observed page element belongs to, the page the reader was last known at (the idle build starts there), and the idle build's own state: the pending request, whether it is a real idle callback, whether a run holds it, whether the three events are listened to, and the time spent building. */
  #observer: IntersectionObserver|null = null;
  #byPage: WeakMap<Element,PageRecord> = new WeakMap<any, any>();
  #focus = 0;
  #idle: number|null = null;
  #idleIsRic = false;
  #held = false;
  #listening = false;
  /** What undoes each window listener {@link dispose} must take off. */
  #offs: Array<() => void> = [];
  #buildMs = 0;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', slotAssignment: 'manual' });
    const style = this.ownerDocument.createElement('style');
    style.textContent = `
      :host { display: block; }
      @media screen { beltype-page { margin: 0 auto 16px; box-shadow: 0 1px 4px rgba(0,0,0,.3); } }
    `;
    this.#shadow.appendChild(style);
  }

  /** The parking slot, made on first use: it renders nothing and takes every light child no page has taken. */
  #parking() {
    let park = (this.#shadow.querySelector('slot[data-beltype-park]') as HTMLSlotElement | null);
    if (!park) {
      park = this.ownerDocument.createElement('slot');
      park.setAttribute('data-beltype-park', '');
      park.style.display = 'none';
      this.#shadow.appendChild(park);
    }
    return (park as HTMLSlotElement);
  }

  /**
   * THE INTAKE: the document's boxes become this element's light DOM (*content is one document*, I6), and are parked at once — before the first cut, not at the first presentation (*the pages are cut as far as they are asked*, 2026-10-12). A run that can stop at a page measures the sources while pages stand in the document, so it measures them where a resumed run always has: inside the root, in the flat tree under a slot that renders nothing, where `getComputedStyle` answers (*an unplaced original is parked, not unassigned*). Appended without parking they would answer nothing at all.
   *
   * @param boxes - the top-level boxes: the blocks, then the fixed boxes, then the running elements. A fixed box or running element inside a block comes in with its block.
   */
  intake(...boxes: Element[]) {
    this.append(...boxes);
    this.#parking().assign(...this.children);
  }

  /**
   * Materialize the account's pages. Blocks must be light children of this element (the document adopted at intake).
   * @param p.account - the driver's account — one entry per page: `{ cls, trace, pos, cut, carried, blank, leadPx, usedPx, cost, closes }`.
   * @param p.blocks - the top-level source blocks, in order.
   * @param p.fixed - the document's top-level `position: fixed` boxes (`driver.js`'s `fixedBoxes`) — the Furniture's second delivery, one clone per page.
   * @param p.running - the document's running elements in document order (`driver.js`'s `runningBoxes`, the same list the run was handed) — GCPM §1.2's own delivery, one clone per page into the margin cell `element()` names, of the element the page's `closes.running` places there (*a running element is a named node*, 2026-10-21).
   * @param p.index - the position index the run built over these same blocks (`paginate`'s result carries it); absent, it is built here. Handing it over saves a walk of every word of the document (*the run resumes from an entry*, build two: 65 ms on the manual).
   * @param p.marginBoxesFor - raw margin-box values for a page's conditions (the capture table's `pageFor(...).marginBoxes`).
   * @param p.resolvedByWidth - composed mode: Map(widthKey → resolved Map(el → record)) — each page picks the resolved map for its own content width. On a resumed call it holds the blocks of the pages the call cuts again and no others.
   * @param p.composeFor - composed mode: the host's way of composing one page's blocks, asked when a page the call kept (and had not built) is built later and `resolvedByWidth` has nothing for it.
   * @param p.total - how many pages the document has, which is `account.length` where the run is complete and `null` where it is not: the pages cut so far are shown without a total (`counter(pages)` prints nothing) and `pageOf` answers {@link NOT_YET} for what is not cut (*the pages are cut as far as they are asked*, 2026-10-12).
   * @param resume - **Refill only the pages a resumed run cut again** (*the run resumes from an entry*, build two, 2026-10-08), in page indices of this account: `from` through `to` are built anew and replace the pages `from` through `oldTo` of the last presentation, whose count was `priorLength`; every page outside them is a page the last presentation showed at the same interval, kept with its DOM and read again — its folio, the page count, its strings and its counters, the side it now falls on, its slot's name — because the numbers moved while the content did not, and a total is drawn on the pages before the edit as much as on those after it. A call whose numbers do not add up to the last presentation's is a whole presentation, as is a call with no `resume`: the fallback is never a failure. **`from` may be `to + 1`** (nothing is built, the pages around only read again): the call that completes a document whose last page was already shown, which learns the total and nothing else. Pages cut after the last presentation are `from` through `to` with `oldTo` just before `from`: the presentation grows at its end.
   */
  present({ account, blocks, fixed = [], running = null, marginBoxesFor, resolvedByWidth = null, composeFor = null, index: ofRun = null, total = account.length }: { account: AccountRow[]; blocks: Element[]; fixed?: Element[]; running?: { el: Element; }[]|null; index?: ReturnType<typeof indexBlocks>|null; marginBoxesFor: (cond: { name: string; first: boolean; parity: string; }) => object; resolvedByWidth?: ResolvedByWidth|null; composeFor?: ((page: number) => ResolvedByWidth)|null; total?: number|null; }, resume: { from: number; to: number; oldTo: number; priorLength: number; }|null = null) {
    const doc = this.ownerDocument;
    let t = performance.now();
    // The table groups the run judged not to repeat (*the header repeats*, 2026-10-14), read from the account the pages were cut under — the run decides once, at a table's first fragment, and every fragment built here, a page near the reader or a page rebuilt later, reads the same answer.
    declineRepeats(account.flatMap((row) => (row.repeats ?? []).filter(( r: { repeat: boolean; path: number[]; }) => !r.repeat).map(( r: { repeat: boolean; path: number[]; }) => (blocks[r.path[0]] ? elAtIn(blocks[r.path[0]], r.path) : null)).filter(Boolean)));
    ensureDressingSheet(doc);
    ensureDressing(doc);
    dress(total != null); // a document still being cut stays measurable: see `dress`
    // Which source blocks hold a nested fixed box — asked once over the sources, where they are still connected and have a computed style to give, rather than per page.
    const cache: Map<Element,boolean> = new Map<any, any>();
    const holdsFixed = ( el: Element) => {
      if (!cache.has(el)) cache.set(el, holdsFixedBox(el));
      return cache.get(el);
    };
    // The same question for a presented element (*a copy may be presented*): a block that holds one is shown through a copy, so that the original — whose `<object>` the host has a drawing for — stays parked. Asked once per source, like the fixed box, for the same reason: the selectors are the registry's and a source is never written.
    const presentedCache: Map<Element,boolean> = new Map<any, any>();
    const holdsPresentedBox = ( el: Element) => {
      if (!presentedCache.has(el)) presentedCache.set(el, holdsPresented(el));
      return presentedCache.get(el);
    };
    // A box outside a page's interval is kept hollow unless a stylesheet has a `:has(` selector that could look inside it — the driver's own question, asked of the same sheets (*the clone is hollow outside the interval*, 2026-09-27).
    const hollow = !sheetsUseHas(doc);
    // Once this call's own margin-box literals are about to be written into the shadow DOM below,
    // the author's own @page rules have nothing left to contribute — clear their content so the
    // browser's native cascade cannot paint a second, uncontrolled copy of it (the second channel a named page cannot close).
    neutralizeMarginBoxes(doc);

    // The page intervals first: the plan below needs to know how many pages there are to decide whether a resumed presentation adds up.
    const index = ofRun ?? indexBlocks(blocks);
    const pages = pageIntervals(account, index.bases, index.endOf);
    /** The page each block began on, which is what makes `slice:N` a number (*the piece words*, 2026-10-11): the Nth piece of a divided block is the Nth page it has been on. Read off the intervals — a block is on every page from the one whose interval first reaches it to the one whose cut divides it — and so true for the pages a resumed presentation keeps as well as the ones it builds. */
    const began = new Map<any, any>();
    let mostPieces = 1;
    for (const pg of pages) {
      if (pg.blank) continue;
      const last = pg.end == null ? blocks.length - 1 : (divides(pg.end.cut) ? pg.end.b : pg.end.b - 1);
      for (let b = pg.start.b; b <= last && b < blocks.length; b++) {
        if (!began.has(b)) began.set(b, pg.index);
        else mostPieces = Math.max(mostPieces, pg.index - (began.get(b) as number) + 1);
      }
    }
    // Every number a piece can wear is delivered before any piece is built: one change to the values sheet, and not one per number while the pages stand in the document (`deliverValues` says what that cost).
    deliverValues(doc, Array.from({ length: mostPieces }, (_, i) => `slice:${i + 1}`));
    /** Write the piece's number on the root of a fragment, and deliver the word to CSS. The number is `slice:N` on the fragment's root: the Nth page the block has been on. */
    const numberPiece = ( clone: Element,  b: number,  page: number) => {
      const n = page - (began.get(b) ?? page) + 1;
      if (wordOf(clone, 'slice') !== n) setValue(clone, 'slice', n);
    };

    /** Which pages are built, which are kept (*the run resumes from an entry*, build two). A resumed presentation takes the last one apart only between `from` and `oldTo`: those pages and every fragment they owned leave, and the pages around them stay. The numbers must add up — as many pages kept after the run as the last presentation had after its own — or the whole of the last presentation goes, as it always did. */
    const priorLength = this.#records.length;
    const resuming = !!resume && priorLength === resume.priorLength && resume.from <= resume.to + 1 && resume.oldTo < priorLength && priorLength - 1 - resume.oldTo === pages.length - 1 - resume.to && pages.length > resume.to;
    const firstBuilt = resuming ? resume.from : 0;
    const lastBuilt = resuming ? resume.to : pages.length - 1;
    /** The page element the rebuilt pages are seated before: the first kept one after them, or none. */
    const ahead = resuming ? this.#records[resume.oldTo + 1]?.page ?? null : null;
    let keptBefore: PageRecord[] = [];
    let keptAfter: PageRecord[] = [];
    if (resuming) {
      keptBefore = this.#records.slice(0, resume.from);
      keptAfter = this.#records.slice(resume.oldTo + 1);
      for (const record of this.#records.slice(resume.from, resume.oldTo + 1)) {
        this.#observer?.unobserve(record.page);
        record.page.remove();
        for (const node of record.nodes) node.remove();
        this.onPieces?.([], record.nodes);
      }
    } else {
      // Clear a previous presentation: pages, root slots, and every fragment we appended.
      this.#observer?.disconnect();
      for (const el of [...this.#shadow.querySelectorAll('beltype-page')]) el.remove();
      const gone = [...this.children].filter((el) => el.matches(FRAGMENT_SELECTOR) || el.tagName === 'SLOT');
      for (const el of gone) el.remove();
      this.onPieces?.([], gone);
    }
    /** What the pages that stay still hold in their slots: not parked, or the park would take it from them. */
    const kept = new Set([...keptBefore, ...keptAfter].flatMap((r) => [...r.nodes, ...r.assigned]));
    performance.measure('cicero:present-setup', { start: t, end: (t = performance.now()), detail: { resuming } });

    /**
     * The parking slot (*an unplaced original is parked, not unassigned*, 2026-09-21).
     *
     * Every light child is assigned here first, to a slot that renders nothing; the page slots below take what they place — a manual assignment to a second slot removes it from the first — and what stays parked is exactly the originals no page shows: a divided block's, a composed block's, a fixed box's, a running element's. The reason is one sentence of CSSOM: `getComputedStyle` answers no declarations for an element outside the flat tree, and a slottable no slot takes is outside it. Chromium 150 answered anyway; Chromium 153 does not, and every reading this engine takes "from the source" (`word-space.js`'s `sourceStyle` and the four predicates over it) went blank in silence — a `clone` box dressed as `slice`, seven narrated cases red. Parked, an original is in the flat tree under a `display: none` slot: it has no box and no ink, and it has a computed style, inherited properties included, which the unassigned original never answered correctly on any build.
     */
    this.#parking().assign(...[...this.children].filter((el) => !kept.has(el)));

    // Reconstruct page intervals from the account, exactly as the driver's cursor advanced. Each endpoint carries the account's own address — the block is `cut.path[0]` and is never decomposed from the flat position, because the word space under-determines block seams wherever a block has no words (case 04's plate), so the view reads the tree fact it was handed. The index over the same source blocks supplies only the bases arithmetic. The construction is `positions.js`' since *the engine answers the page*: the frames and `pageOf` read one table, and it is pure arithmetic, so it is checked without a browser.
    this.#index = index;
    this.#pages = pages;
    const wasTotal = this.#total;
    this.#total = total;

    /** The block a page's closing cut hands to a constructed first fragment, or -1: the page divides its last block and does not also resume it. One definition for the loop below and for the pages it does not build. */
    const constructsFirstOf = ( pg: typeof pages[number]) => {
      const dividesLast = !pg.blank && pg.end != null && divides(pg.end.cut);
      return dividesLast && !(pg.start.b === (pg.end as NonNullable<typeof pg.end>).b && divides(pg.start.cut)) ? (pg.end as NonNullable<typeof pg.end>).b : -1;
    };
    /** The page that presents each block through a constructed first fragment, by block index — what makes the continuations after it read copies rather than hidden ones, since nothing else reads the tail. A fact of the intervals alone, so a page built later asks it without the pages before it having been built. */
    const consAt = new Map<any, any>();
    for (const pg of pages) {
      const b = constructsFirstOf(pg);
      if (b >= 0 && !consAt.has(b)) consAt.set(b, pg.index);
    }
    /** The blocks presented through a constructed first fragment on the pages up to the last one this call builds — the seed of the aria-hidden pass over the pages kept after them. */
    const constructed = new Set([...consAt].filter(([, page]) => page <= lastBuilt).map(([b]) => b));
    /** What a page's content is built from (*only the pages near the reader are built*, 2026-10-12): everything this call knew that a page's fragments are a function of, kept by each record so the build can happen later — on the next frame, when the reader comes near, or in idle time — from the call that cut the page and no other. A call that keeps a page (a resumed presentation) gives it the new context, and the page's index in it, since the numbers around a kept page moved while its content did not. */
    const ctx: PresentContext = {
      account,
      pages,
      blocks,
      fixed,
      hollow,
      resolvedByWidth,
      composeFor,
      /** The pages (indices of this call's account) whose blocks `resolvedByWidth` holds; every page when the call is a whole presentation. */
      composed: resuming ? { from: firstBuilt, to: lastBuilt } : null,
      holdsFixed,
      holdsPresented: holdsPresentedBox,
      numberPiece,
      constructedBefore: ( b: number,  page: number) => (consAt.get(b) ?? Infinity) < page
    };
    const built: PageRecord[] = [];
    for (const pg of pages.slice(firstBuilt, lastBuilt + 1)) {
      const entry = account[pg.index];
      /** The root's light children this page owns: its running elements now, and its fragments and repeated boxes once its content is built. */
      const nodes: Element[] = [];
      const page = (doc.createElement('beltype-page') as BeltypePage);
      page.applyConditions(pg.closes);
      const cost = entry.cost ?? 0;
      const extPx = extensionPx(pg, entry);
      page.setFlow({ leadPx: entry.leadPx, usedPx: entry.usedPx, extPx, costPx: extPx > 0 ? cost : 0, reservePx: entry.reservePx ?? 0 });
      // The root slot lives as the page's light child — the page sits in our shadow, so the slot is in the root's shadow tree, where it can take the root's light children (the chain of *forwarding delivery*, P10). Its sibling carries the furniture, which since *the page rendering clips at the bleed area* is clipped by a different box than the flow is: the flow may reach the page margin and a fixed box may not (CSS 2.1 §9.6.1).
      const rootSlot = doc.createElement('slot');
      rootSlot.name = `iv-${pg.index}`;
      const furnitureSlot = doc.createElement('slot');
      furnitureSlot.name = `fx-${pg.index}`;
      page.adopt(rootSlot, furnitureSlot);
      this.#shadow.insertBefore(page, ahead);

      const plan = this.#marginPlan(pg, account, marginBoxesFor);
      this.#collect = nodes;
      this.#chrome(page, pg, plan, running);
      this.#collect = null;
      built.push({ page, rootSlot, furnitureSlot, nodes, assigned: [], conts: [], pieces: [], constructsFirst: constructsFirstOf(pg), chrome: this.#chromeKey(pg, plan), built: false, extPx, k: pg.index, ctx });
    }

    performance.measure('cicero:present-built', { start: t, end: (t = performance.now()), detail: { built: built.length } });
    /** The pages that stand are read again, not built (*the run resumes from an entry*, build two) — those before the rebuilt ones as well as those after, because a total (`counter(pages)`) is drawn on every page. Their content is the content they showed — same interval, same cut — and what moved is what is read off the whole: the folio, the page count, the strings, the counters, the side the page now falls on, and the name of the slot the page bears. A page whose chrome comes out as it was is left alone; a page whose chrome moved lets go of its running-element clones, dresses and draws its margin boxes again, and measures its bands. The `aria-hidden` of a kept continuation says whether the block's first fragment was constructed, a fact about the pages before it, so it too is read again. */
    this.#records = [...keptBefore, ...built, ...keptAfter];
    // A presentation that only adds pages to one that had no total, and still has none, leaves every page it holds as it was: the pages before the new ones have the same cuts, the same numbers and the same strings, and no total to draw (*the pages are cut as far as they are asked*). Re-reading them would make a document cut in n slices cost n squared.
    const grows = resuming && wasTotal === null && total === null && resume.oldTo === resume.from - 1;
    for (let k = 0; resuming && k < pages.length; k++) {
      if (k >= firstBuilt && k <= lastBuilt) continue;
      if (grows && k < firstBuilt) continue;
      const record = this.#records[k];
      const pg = pages[k];
      record.ctx = ctx;
      record.k = k;
      record.rootSlot.name = `iv-${k}`;
      record.furnitureSlot.name = `fx-${k}`;
      const plan = this.#marginPlan(pg, account, marginBoxesFor);
      const chrome = this.#chromeKey(pg, plan);
      if (chrome !== record.chrome) {
        for (const node of record.nodes) if (!record.assigned.includes(node)) node.remove();
        record.nodes = record.nodes.filter((node) => record.assigned.includes(node));
        this.#collect = record.nodes;
        this.#chrome(record.page, pg, plan, running);
        this.#collect = null;
        record.chrome = chrome;
      }
    }
    if (resuming) {
      const seen = new Set(constructed);
      for (let k = lastBuilt + 1; k < pages.length; k++) {
        const record = this.#records[k];
        for (const [clone, b] of record.conts) {
          if (seen.has(b)) clone.removeAttribute('aria-hidden');
          else clone.setAttribute('aria-hidden', 'true');
        }
        // The pages are the same, but a page counted from a block's first one may have moved: the pieces are numbered again.
        for (const [clone, b] of record.pieces) numberPiece(clone, b, k);
        if (record.constructsFirst >= 0) seen.add(record.constructsFirst);
      }
    }

    performance.measure('cicero:present-reread', { start: t, end: (t = performance.now()), detail: { kept: keptAfter.length } });
    this.#pressSheet(doc, pages);
    performance.measure('cicero:present-press', { start: t, end: (t = performance.now()) });
    // Pages added far below the last page the reader's neighbourhood reached are the observer's: asking where they stand would make the browser lay the whole document out again for a page nobody is near (*the pages are cut as far as they are asked*).
    this.#window(built, grows && !this.#records[firstBuilt - 1]?.built && firstBuilt > 0);
    performance.measure('cicero:present-window', { start: t, end: performance.now(), detail: { pages: this.#records.filter((r) => r.built).length } });
  }

  /**
   * A page's margin boxes, as a plan: each box's `content` transliterated (*the page carries its conditions*, 2026-10-21) — plain data, which is what lets a resumed presentation compare two plans without drawing either.
   *
   * The page's conditions are read, never re-derived. Parity used to be recomputed here from the page number, which agreed with the driver's own derivation for exactly as long as that derivation had no offset in it — css-page-3 §3.3's suppressed first page gives it one, and two derivations of one fact is the fork the 2026-08-04 account ruling exists to forbid. `blank` rides beside it: §4.2.3 says a blank page is still matched by its parity and its name, so it takes its margin boxes from the same table under one more condition.
   */
  #marginPlan(pg: Page, account: AccountRow[], marginBoxesFor: (cond: { name: string; first: boolean; parity: string; blank: boolean; }) => object): MarginPlan {
    const raw = marginBoxesFor({ name: pg.closes.name, first: pg.index === 0, parity: pg.closes.parity, blank: pg.blank });
    return (Object.entries(raw).map(([box, value]) => [box, transliterateContent(value, { pagesKnown: this.#total != null })]) as MarginPlan);
  }

  /** What a page's chrome is a function of: its conditions, its plan, and what its host publishes. A kept page whose key is unchanged is left alone. */
  #chromeKey(pg: Page, plan: MarginPlan) {
    return JSON.stringify([pg.closes.name, pg.closes.parity, pg.index === 0, pg.blank, plan, pg.closes.pageNumber, this.#total, pg.closes.counters, pg.closes.strings ?? {}, pg.closes.running ?? {}]);
  }

  /**
   * A page's chrome, drawn: the page context and the boxes' transliterated `content` dressed into its shadow, the page's counters and strings published on its host, the running elements slotted, the bands measured.
   *
   * The counters and the strings are the document's own state as the driver read it — the counters at this page's first word, the four readings of every named string over this page's interval (`closes`). Never re-derived here, which the 2026-08-04 account ruling forbids and which nothing in this realm could do anyway: by now the source blocks have been adopted and a reading taken here would answer about a different tree. The bands are measured last, because css-page-3 §5.3.2 sizes a band from what its boxes say (*the margin boxes flex*, 2026-09-14); the page is in the shadow tree by then, so the intrinsic widths are measurable. The flow's content is not in the page yet (*only the pages near the reader are built*) and a band reads none of it.
   */
  #chrome(page: BeltypePage, pg: Page, plan: MarginPlan, running: { el: Element; }[]|null) {
    page.dress(pg.closes.pageStyle, Object.fromEntries(plan.map(([box, t]) => [box, t && { before: t.before, after: t.after }])));
    page.setCounters(pg.closes.counters, { page: pg.closes.pageNumber, pages: this.#total });
    page.setStrings(pg.closes.strings ?? {});
    for (const [box, t] of plan) page.setMarginBox(box, t ? t.parts.map((part) => (typeof part === 'string' ? part : this.#runningPart(pg.closes.running?.[part.element]?.[part.which], running))) : null);
    page.layoutBands();
  }

  /**
   * Draw again the chrome of every standing page that shows the running element at `at`, with nothing cut and nothing built (*the run resumes from an entry*, amended 2026-11-08): the seam's client replaced that element and the run's list now names the new one.
   *
   * @remarks A running element's edit is a chrome event: it is out of the flow, so no cut reads it, and which element a page shows is the page's `closes.running`, a fact about positions that did not move. So each page whose `closes.running` names the place lets go of its running-element clones and has its chrome drawn as a kept page whose chrome moved has it drawn in {@link present}, the bands measured again because a margin box sizes from what it says; its content, its key and every other page are left as they are.
   * @param at - the element's place in `running`.
   * @param running - the run's list, the new element in its place.
   * @param marginBoxesFor - as {@link present} takes it.
   * @returns how many pages were drawn again.
   */
  redrawRunning(at: number, running: { el: Element; }[], marginBoxesFor: (cond: { name: string; first: boolean; parity: string; blank: boolean; }) => object): number {
    let drawn = 0;
    for (const record of this.#records) {
      const pg = record.ctx.pages[record.k];
      if (!Object.values(pg.closes.running ?? {}).some((which) => Object.values(which as object).includes(at))) continue;
      for (const node of record.nodes) if (!record.assigned.includes(node)) node.remove();
      record.nodes = record.nodes.filter((node) => record.assigned.includes(node));
      this.#collect = record.nodes;
      this.#chrome(record.page, pg, this.#marginPlan(pg, record.ctx.account, marginBoxesFor), running);
      this.#collect = null;
      drawn++;
    }
    return drawn;
  }

  /**
   * GCPM §1.2's `element()`, delivered — a clone of the running element per page, forwarded into the margin cell through a slot.
   *
   * **One clone per page, and it is forced rather than chosen**, exactly as a fixed box's is: a light-DOM element can be assigned to one slot only, so a single element cannot be on two pages. The clones are decision products under *decisions land only as fragment hints or per-page literals* (C5); the source stays unassigned and unrendered in the light DOM, which is also what satisfies §1.2.1's *"does not display there"*. Every clone is `aria-hidden`, the first page's too: a running head is furniture on every page, and an artifact is never read (`.claude/decisions/cicero/an-artifact-is-never-read.md`).
   *
   * **Slotted rather than written in**, which is the whole reason this is not a string: the clone stays light DOM, so the author's own stylesheet still reaches it — `.rh em { font-style: italic }` matches a clone of `.rh` exactly as it matched the original. What it does not carry is §1.2.1's other half: a slotted element inherits from its flattened-tree parent, which is the margin cell, so an inherited property comes from the page context rather than from the element's original position. That is a stated limit, and on a running head it is usually the answer an author wanted — the box's own `font-size` is what dresses it.
   *
   * **Which element is the page's answer, never this method's** (*a running element is a named node*, 2026-10-21): the driver read GCPM §1.2.3's keyword over the page's interval, as it reads a named string's, and `closes.running` carries the element's place in the run's list. A page before the name's first assignment, a `first-except` on the page that assigns it, and an identifier no element claims all arrive as no place, and yield nothing at all: a box with no content rather than a refusal.
   *
   * @param at - the element's place in `running`.
   */
  #runningPart(at: number|null|undefined, running: { el: Element; }[]|null) {
    const source = at == null ? null : running?.[at]?.el;
    if (!source) return '';
    const clone = copyOf(source); // a margin cell's copy names the running element it is a copy of (*the engine names the source*) — or is the host's presenter, when the running element is itself presented
    addWord(clone, FRAGMENT);
    addWord(clone, ARTIFACT); // every copy a margin cell receives is furniture, the first page's too; the original stays in the light DOM as the source
    clone.setAttribute('aria-hidden', 'true'); // an artifact is never read, so a running head is read on no page (`.claude/decisions/cicero/an-artifact-is-never-read.md`)
    this.appendChild(clone);
    this.#collect?.push(clone);
    // The slot is handed over unassigned: the page appends it first and assigns after, the same order `adopt` uses for the content slot and for the same reason — a slot assigns what it is given once it is inside a shadow tree.
    return { slot: this.ownerDocument.createElement('slot'), node: clone };
  }

  /**
   * The rest of a page: its content, built (*only the pages near the reader are built*, 2026-10-12; `.claude/decisions/cicero/only-the-pages-near-the-reader-are-built.md`). The page's fragments and repeated boxes are constructed, appended to the root and seated in the page's two slots; the originals that stand whole on it are assigned to its slot (they were parked, and a manual assignment to a second slot removes an element from the first). A page is built once and stays built: there is no eviction, and a page the next call cuts again is a new page, built afresh.
   *
   * Everything it reads is the record's own context — the call that cut the page — so it is the same content the page showed when every page was built at once, and presenting after deciding is untouched: no cut is read or moved here.
   */
  #buildContent(record: Record<string,any>) {
    if (record.built) return;
    const t = performance.now();
    const ctx = record.ctx;
    const pg = ctx.pages[record.k];
    const entry = ctx.account[pg.index];
    const doc = this.ownerDocument;
    const { rootSlot, furnitureSlot, extPx } = record;
    /** The continuation fragments this page seats, with the block each continues. */
    const conts: Array<[Element,number]> = [];
    /** Every fragment this page seats that is a piece of a divided block, with its block: the roots that wear `slice:N`, which a resumed presentation numbers again on the pages it keeps. */
    const pieces: Array<[Element,number]> = [];
    const own = ( el: Element) => {
      this.appendChild(el);
      record.nodes.push(el);
    };
    /**
     * The page's closing cut, and what it divides (*the first fragment is constructed*, 2026-09-15).
     *
     * A cut falling inside the interval's last block divides it, and that block is then presented through a first fragment rather than through the original — unless this page also resumes it, in which case the fragment is an intermediate continuation and the words after the cut are still in the clone, so neither the extension nor the widened clip may be delivered.
     *
     * **And not on a page a parallel flow crosses.** A carried §2.1 box is still an original with its own tail under the clip, so moving the clip to the page area's edge would show that tail. Stated as a limit in the record, cased by nothing today, and the symmetric construction for a carried flow is a round of its own.
     *
     * The extension's own conditions are `positions.js`'s `extensionPx`, which is the account's arithmetic and is unit-tested there — including the one this round added, that a page ending in a shell takes none (*the end gap takes no extension*, 2026-09-15). The construction of the fragment is still decided here, because it is about the tree.
     */
    const dividesLast = !pg.blank && pg.end != null && divides(pg.end.cut);
    const resumesLast = dividesLast && pg.start.b === pg.end.b && divides(pg.start.cut);
    const constructsFirst = dividesLast && !resumesLast;
    const composition = this.#compositionFor(ctx, pg);
    const assignees: Element[] = [];
    // A page nothing flows onto (css-break-3 §3.1's second break; css-page-3 §4.2.3) takes no flow content — the guard is load-bearing rather than tidy, since a forcing interior to a block leaves this page's interval starting mid-block and the loop below would build a continuation clone for it and print the same words twice. It still takes its margin boxes and, below, its fixed boxes: CSS 2.1 §9.6.1 says *every* page, and a page's blankness is a fact about the flow — §3.2 calls a page content-empty when its page area carries no printable content, and its own example leaves a page number on such a page, so furniture no more fills a blank page than a running head does.
    // Carried parallel flows first, live (tablet, The Flows): a §2.1 box the previous cut crossed, resuming at its own word. It stands before the interval's own blocks exactly as it stood on the page it began, and it is an ordinary box rather than a painted shell because this page's content lays out beside it — which is the whole difference from a monolith's remainder.
    // A row item's place rides the same list and is not a flow of its own: it is applied inside the fragment of the block that holds it, start and end alike (*every branch gets a place*).
    // Read through the resume tree (*a parallel flow is a fragmentainer*, 2026-10-08): the items of block `b` are the item nodes beside the main flow's cut and the items each carried float holds beneath it, each with the items nested under it, handed to the builders in the wire form they take.
    const itemsAt = ( end: { carried?: any[]; }|null|undefined,  b: number) => flattenResume({ pos: 0, cut: (null as never), flows: flowsOf(end?.carried ?? []).flatMap((n) => (n.item ? [n] : n.flows)).filter((n) => n.item?.[0] === b) }).slice(1);
    /** The tracks this page's feed laid its tables and grids out at, for block `b` (*the fragment lays out under the feed's conditions*, 2026-10-08) — the account's literals, handed to every fragment the block is built as. */
    const tracksAt = ( b: number) => (entry.tracks ?? []).filter(( t: { path: number[]; }) => t.path[0] === b);
    const extentsAt = ( b: number) => (entry.extents ?? []).filter(( t: { path: number[]; }) => t.path[0] === b);
    for (const cf of (pg.blank ? [] : pg.start.carried ?? [])) {
      if (cf.item) continue;
      const source = ctx.blocks[cf.cut.path[0]];
      if (!source) continue;
      // The address and the remainder are both the account's own literals, not re-derived here: the measure feed built this same continuation at this same place and this same extent, and one fact with two derivations is how the account ruling's fork starts again.
      const clone = continuationClone(source, { cut: cf.cut, remainderPx: cf.remainingPx ?? null, composition, items: itemsAt(pg.start, cf.cut.path[0]), hollow: ctx.hollow, tracks: tracksAt(cf.cut.path[0]), extents: extentsAt(cf.cut.path[0]) });
      addWord(clone, FRAGMENT);
      markCont(clone);
      clone.setAttribute('aria-hidden', 'true');
      ctx.numberPiece(clone, cf.cut.path[0], pg.index);
      pieces.push([clone, cf.cut.path[0]]);
      own(clone);
      assignees.push(clone);
    }
    // The interval's closing block is shown only where the cut divides it; a cut that normalised to the block's own boundary ends the page before it, and the block opens the next page whole.
    const lastB = pg.blank ? -1 : (pg.end == null ? ctx.blocks.length - 1 : (divides(pg.end.cut) ? pg.end.b : pg.end.b - 1));
    for (let b = pg.start.b; b <= lastB && b < ctx.blocks.length; b++) {
      const source = ctx.blocks[b];
      const partialStart = b === pg.start.b && divides(pg.start.cut);
      if (partialStart) {
        // A continuation: the same construction the measure feed used, dressed, aria-hidden (its content already reads from the page where the box began).
        // A fragment that also ends on this page is built by both cuts: what lies after the closing cut is not in the tree (`fragmentOf`).
        const endsHere = dividesLast && b === lastB;
        const clone = endsHere
          ? fragmentOf(source, { start: pg.start.cut, end: pg.end.cut, startItems: itemsAt(pg.start, b), endItems: itemsAt(pg.end, b), extPx, composition, hollow: ctx.hollow, forced: pg.start.forced === true, tracks: tracksAt(b), extents: extentsAt(b) })
          : continuationClone(source, { cut: pg.start.cut, composition, items: itemsAt(pg.start, b), hollow: ctx.hollow, forced: pg.start.forced === true, tracks: tracksAt(b), extents: extentsAt(b) });
        addWord(clone, FRAGMENT);
        markCont(clone);
        if (dividesLast && b === lastB) markCut(clone); // an intermediate fragment: it neither begins the box nor ends it
        // A continuation is hidden from assistive technology only where the box was read whole on an earlier page. Where the page before showed a constructed first fragment, nothing reads the tail unless this does — so the document is read once either way, and find-in-page lands on the page the word is actually on.
        if (!ctx.constructedBefore(b, pg.index)) clone.setAttribute('aria-hidden', 'true');
        ctx.numberPiece(clone, b, pg.index);
        pieces.push([clone, b]);
        own(clone);
        conts.push([clone, b]);
        assignees.push(clone);
      } else if (constructsFirst && b === lastB) {
        /**
         * The first fragment, constructed — the third reason this file assigns a clone rather than the original, beside composed content and a block holding a nested fixed box.
         *
         * The straddler used to be the original, clipped by the flow at the cut's own extent. That could carry neither §5.3's extension nor §5.4's cloned block-end decoration nor §5.5's per-fragment rotation origin, because all three want a property of the first fragment and the original is the whole box. It is built by the same machinery the continuation is built by, mirrored — one implementation, so the two halves of a divided box cannot disagree about where the boundary was.
         *
         * It is not `aria-hidden`: it is the reading copy. The original stays in the light DOM, unassigned, canonical (*content is one document*, I6), and the cost this section already owned for a composed block now touches every divided block's first page as well — a clone matches `:nth-child` and `:last-child` against its cloned position.
         */
        const clone = firstFragmentClone(source, { cut: pg.end.cut, extPx, composition, items: itemsAt(pg.end, b), hollow: ctx.hollow, tracks: tracksAt(b), extents: extentsAt(b) });
        addWord(clone, FRAGMENT);
        markCut(clone); // `split start`: the constructed first fragment, dressed as the box's beginning and cut off before its end
        ctx.numberPiece(clone, b, pg.index);
        pieces.push([clone, b]);
        own(clone);
        assignees.push(clone);
      } else if (composition || ctx.holdsFixed(source) || ctx.holdsPresented(source)) {
        /**
         * A clone rather than the original, for one of two reasons.
         *
         * **Composed content** presents through its fragment — an original cannot carry the Compositor's chosen lines without being written, and *the source document is never written* (C5) forbids that. The fragment is the sole rendering, not hidden; the original stays canonical and unrendered.
         *
         * **A block holding a nested `position: fixed` box** presents through a clone the box has left (*a fixed box at any depth*, 2026-09-15). Zero footprint means the box is not rendered from where it sits, and a top-level one gets that by never being assigned; a nested one is inside this block, so this block is what has to arrive without it. The Furniture then delivers it below, once per page, against the page area. The cost is the one this section already owns for a composed block: this block is read from a clone, and it is narrow — only a block that declares a fixed box inside itself.
         */
        const { clone } = cloneFlowPiece(source, { composition });
        addWord(clone, FRAGMENT);
        own(clone);
        assignees.push(clone);
      } else {
        assignees.push(source); // the original, live and accessible
      }
    }
    /**
     * The Furniture's second delivery — a fixed box, on this page (*the box on every page*, 2026-09-07; CSS 2.1 §9.3.1 and §9.6.1).
     *
     * **N pages means N clones, and that is forced rather than chosen.** A light-DOM element can be assigned to one slot only, so a single element cannot be on two pages; the clones are decision products under *decisions land only as fragment hints or per-page literals* (C5), exactly as continuation clones are, and the source is never written — which is why the `position: absolute` that re-homes them lands on a class the dressing sheet carries rather than on the author's own element.
     *
     * The original stays in the light DOM, unassigned and unrendered, the canonical source — the arrangement composed mode already uses for a hinted block. The first clone is the one assistive technology reads; the rest are `aria-hidden`, so the document is read once, in order, exactly as the continuation clones' own cost note says.
     *
     * **Into the page's furniture slot, not its flow slot** (*the page rendering clips at the bleed area*, 2026-09-18). They rode the flow's own slot for as long as one clip served both, and they are separated now because the two clips have parted: the flow may put ink in the page margin and a fixed box may not, §9.6.1 naming the page area for it in as many words. The layer they land in sits after the flow and is positioned, so they paint over it exactly as they did, and their order among themselves is still the author's.
     */
    const furniture: Element[] = [];
    for (const source of ctx.fixed) {
      const clone = copyOf(source); // every page's copy names the one box the author declared (*the engine names the source*)
      addWord(clone, FRAGMENT);
      addWord(clone, FIXED);
      // Every box is read once, on the first page: it is the same box repeated, not a new one per page. Hiding by clone index rather than by page would have hidden a second fixed box on page one, which is a different box and owed its own reading.
      if (pg.index > 0) {
        clone.setAttribute('aria-hidden', 'true');
        addWord(clone, ARTIFACT); // a repeat of the box on a later page is furniture; the first page's copy is the one read
      }
      own(clone);
      furniture.push(clone);
    }
    rootSlot.assign(...assignees);
    furnitureSlot.assign(...furniture);
    record.assigned = [...assignees, ...furniture];
    record.conts = conts;
    record.pieces = pieces;
    record.built = true;
    this.#buildMs += performance.now() - t;
    // Every assignee that is a copy is a piece; an original names no source.
    if (this.onPieces) this.onPieces(assignees.flatMap((el) => { const source = sourceOf(el); return source ? [([el, source] as [Element, Element])] : []; }), []);
  }

  /** The composed records a page's blocks are set from: the call's own map when it holds the page, else the host composes the page now (a page a resumed call kept and had not built) and the result joins the map. Null in the default mode. */
  #compositionFor(ctx: PresentContext, pg: Page): Map<Element,CompositionRecord>|null {
    if (!ctx.resolvedByWidth) return null;
    const key = widthKeyOf(pg.closes.contentW);
    const covered = !ctx.composed || (pg.index >= ctx.composed.from && pg.index <= ctx.composed.to) || ctx.alsoComposed?.has(pg.index);
    if (!covered && ctx.composeFor) {
      for (const [width, records] of ctx.composeFor(pg.index)) {
        const have = ctx.resolvedByWidth.get(width);
        if (have) for (const [el, record] of records) have.set(el, record);
        else ctx.resolvedByWidth.set(width, records);
      }
      (ctx.alsoComposed ??= new Set<any>()).add(pg.index);
    }
    return ctx.resolvedByWidth.get(key) ?? null;
  }

  /**
   * The first view: the pages in view and one viewport's height above and below it are built now, in the frame the presentation ends in, so the reader never sees a sheet waiting for its words. The sheets all exist (their sizes are literals), so the rectangles are true before a word is built; they are read first and the pages built after, which keeps the reads on one layout. Then the observer takes over the rest, and the idle build is asked for.
   *
   * @param fresh - the records this call made, which the observer has not seen.
   * @param beyond - the call only added pages after a page that is not built: none of them is near the reader, whatever their number, and no rectangle is asked.
   */
  #window(fresh: PageRecord[], beyond: boolean = false) {
    const view = this.ownerDocument.defaultView;
    const height = view?.innerHeight || 0;
    const near: PageRecord[] = [];
    for (const record of beyond ? [] : this.#records) {
      if (record.built) continue;
      const box = record.page.getBoundingClientRect();
      if (box.top > 2 * height) break;
      if (box.bottom >= -height) near.push(record);
    }
    for (const record of near) this.#buildContent(record);
    if (typeof IntersectionObserver === 'function' && view) {
      this.#observer ??= new view.IntersectionObserver((entries) => this.#seen(entries), { root: this.ownerDocument, rootMargin: '100% 0px 100% 0px' });
      for (const record of fresh) {
        this.#byPage.set(record.page, record);
        this.#observer.observe(record.page);
      }
    }
    this.#held = false;
    this.#kick();
    this.#listen();
  }

  /** The observer's answer: a page that came near is built at once, whatever the idle build has done. */
  #seen(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const record = this.#byPage.get(entry.target);
      if (!record) continue;
      this.#focus = record.k;
      this.#buildContent(record);
    }
    this.#kick();
  }

  /** Ask for the idle build, once: the unbuilt pages are built in slices as the browser has idle time, nearest the reader first. */
  #kick() {
    if (this.#idle != null || this.#held || !this.#records.some((r) => !r.built)) return;
    const view = (this.ownerDocument.defaultView as Window & typeof globalThis);
    const slice = ( deadline: { didTimeout: boolean; timeRemaining: () => number; }) => {
      this.#idle = null;
      if (this.#held) return;
      const stop = performance.now() + (deadline.didTimeout ? 8 : Math.min(Math.max(deadline.timeRemaining(), 2), 12));
      let record;
      while ((record = this.#nextUnbuilt()) && (this.#buildContent(record), performance.now() < stop));
      if (record) this.#kick();
      else this.#finished();
    };
    this.#idle = typeof view.requestIdleCallback === 'function'
      ? view.requestIdleCallback(slice, { timeout: 500 })
      : view.setTimeout(() => slice({ didTimeout: true, timeRemaining: () => 8 }), 30);
    this.#idleIsRic = typeof view.requestIdleCallback === 'function';
  }

  /** Stop a pending idle slice. */
  #unkick() {
    if (this.#idle == null) return;
    const view = (this.ownerDocument.defaultView as Window & typeof globalThis);
    if (this.#idleIsRic) view.cancelIdleCallback(this.#idle);
    else view.clearTimeout(this.#idle);
    this.#idle = null;
  }

  /** The unbuilt page nearest the one the reader was last known to be at. */
  #nextUnbuilt() {
    const records = this.#records;
    const at = Math.min(Math.max(this.#focus, 0), records.length - 1);
    for (let d = 0; d < records.length; d++) {
      if (records[at + d] && !records[at + d].built) return records[at + d];
      if (d && records[at - d] && !records[at - d].built) return records[at - d];
    }
    return null;
  }

  /** Every page is built: say so on the timeline, once. */
  #finished() {
    performance.mark('cicero:idle-built', { detail: { pages: this.#records.length, ms: Math.round(this.#buildMs) } });
  }

  /** The three events the windowing owes the browser a page for: a link to a place in this document, a changed fragment, and print. Set once, on the first presentation. */
  #listen() {
    if (this.#listening) return;
    this.#listening = true;
    const view = (this.ownerDocument.defaultView as Window & typeof globalThis);
    const targetOf = ( hash: string) => {
      const id = hash.length > 1 ? decodeFragment(hash) : '';
      const found = id ? this.ownerDocument.getElementById(id) ?? this.ownerDocument.getElementsByName(id)[0] : null;
      return found && this.contains(found) ? found : null;
    };
    // Before the browser follows a link, the page that holds its target is built, so the default action (the scroll, the URL, `:target`) finds a box to scroll to. The click is not intercepted: a modified click, a middle click and a link in another tab are the browser's.
    this.addEventListener('click', (e) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const href = ((link?.getAttribute('href') ?? null) as string | null);
      const target = href && targetOf(href);
      if (!target) return;
      if (this.cutTo && this.pageOf(target) === NOT_YET) {
        // A target the document has not been cut to yet: the browser would follow the link to a box that does not exist. The cut is asked for, and the link followed when its page is there (*the pages are cut as far as they are asked*).
        e.preventDefault();
        void this.cutTo(target).then(() => { view.location.hash = href; this.reveal(target); });
        return;
      }
      this.#ensure(target);
    }, true);
    // And after it, the place is shown: a target that is no box of its own — a divided block, drawn on its pages through copies — is scrolled to where its copy is. An address typed into the bar while the document is still being cut asks for the cut the same way.
    const onHash = () => {
      const target = targetOf(view.location.hash);
      if (!target) return;
      if (this.cutTo && this.pageOf(target) === NOT_YET) void this.cutTo(target).then(() => this.reveal(target));
      else this.reveal(target);
    };
    const onPrint = () => void this.buildAll();
    view.addEventListener('hashchange', onHash);
    view.addEventListener('beforeprint', onPrint);
    this.#offs.push(() => view.removeEventListener('hashchange', onHash), () => view.removeEventListener('beforeprint', onPrint));
  }

  /** Build the page that begins the element, when the engine can name it.@param [charOffset] @returns the page's index, or null. */
  #ensure(el: Element, charOffset: number = 0): number|null {
    const at = this.pageOf(el, charOffset);
    if (typeof at !== 'number') return null; // not found, or not cut yet: no page to build
    this.buildPage(at);
    return at;
  }

  /**
   * @returns how many pages there are and how many have their content.
   */
  built(): { pages: number; built: number; } {
    return { pages: this.#records.length, built: this.#records.filter((r) => r.built).length };
  }

  /**
   * Build one page's content now, if it is not built (*only the pages near the reader are built*). The synchronous door for a host that is about to read the page: the editing tools asking where an element is drawn, the printer.
   *
   * @param k - the page's index, from zero.
   * @returns whether the page exists.
   */
  buildPage(k: number): boolean {
    const record = this.#records[k];
    if (!record) return false;
    this.#buildContent(record);
    return true;
  }

  /** Build every page's content now, and return how many pages that built. Synchronous, because a `beforeprint` handler cannot wait; the seam's `buildAll()` wraps it in a promise for the hosts that can. Called by whoever is about to read all the pages — the printer, a test, a gate — and by the print event. */
  buildAll(): number {
    this.#unkick();
    let n = 0;
    for (const record of this.#records) {
      if (record.built) continue;
      this.#buildContent(record);
      n++;
    }
    if (n) this.#finished();
    return n;
  }

  /** Is this light child drawn as itself, slotted into a built page and not parked (*a box announces its own size*, 2026-10-21)? A parked original renders nothing and reads zero, and so does one a page presents through a fragment, a divided or composed block's. */
  isPresented(el: Element): boolean {
    const slot = el.assignedSlot;
    return !!slot && slot.getRootNode() === this.#shadow && !slot.hasAttribute('data-beltype-park');
  }

  /** The page a light child is slotted into, by index from zero, or `null` where no built page holds it (*a fragment announces its own size*, 2026-10-22): the page a changed piece stands on, asked when the rim judges it. */
  pageHolding(el: Element): number|null {
    const k = this.#records.findIndex((r) => r.built && r.assigned.includes(el));
    return k < 0 ? null : k;
  }

  /** The address page `k` begins at, the account's own: the cut that closed the page before it, or the document's first address for the first page; `null` for a page the last presentation does not have. The entry a resume at a page restarts from (*a fragment announces its own size*, 2026-10-22). */
  startOf(k: number): Address|null {
    return this.#pages?.[k]?.start.cut ?? null;
  }

  /** Pause the idle build while a run measures, and let it go when the run presents (or throws). A page that comes near still builds. */
  hold() {
    this.#held = true;
    this.#unkick();
  }

  /** Let go of what this root registered outside itself: the idle build, the observer and the window's listeners. The root is finished with after it; the class is not, since the window keeps it. */
  dispose() {
    this.#held = true;
    this.#unkick();
    this.#observer?.disconnect();
    this.#observer = null;
    for (const off of this.#offs.splice(0)) off();
    this.#listening = false;
  }

  release() {
    this.#held = false;
    this.#kick();
  }

  /**
   * Show a source element: the page that begins it is built, and the copy of it that page shows — the original where it stands whole, a fragment's counterpart where the page divides its block — is scrolled into view. The one door every jump goes through (a link to `#x`, the editing tools' follow, a hash on the address); `scrollIntoView` on the source itself would find a box only when the source happens to be the thing drawn.
   *
   * @param el - an element of the document the last presentation showed.
   * @returns whether a drawn copy was found and scrolled to.
   */
  reveal(el: Element, { block = 'start' }: { block?: ScrollLogicalPosition; } = {}): boolean {
    const at = this.#ensure(el);
    const record = at == null ? null : this.#records[at];
    let shown = null;
    for (const a of record?.assigned ?? []) {
      if (a === el || a.contains(el)) { shown = el; break; }
      const origin = sourceOf(a);
      if (origin === el) { shown = a; break; }
      if (origin?.contains(el)) {
        shown = [...a.querySelectorAll('*')].find((d) => sourceOf(d) === el) ?? null;
        if (shown) break;
      }
    }
    if (!shown) return false;
    shown.scrollIntoView({ block, inline: 'nearest' });
    return true;
  }

  /**
   * The page bearing character `charOffset` of source element `el` — the engine's answer to *where did this land*, and the only one it gives (*the engine answers the page*, 2026-09-04; beltype#19, beltype#20). Zero-based page index, or `null`.
   *
   * `el` is a source element — a top-level block presented by the last `present()`, or any element descended from one — never a continuation fragment. `charOffset` counts into that element's own joined text, the space a text editor already holds; the char→word step is `positions.js`' own walk, so no consumer ever reimplements this engine's tokenization.
   *
   * **`'not-yet'` ({@link NOT_YET}) is the third answer, and the only one a document that is still being cut gives for a place beyond its last page**: nothing is wrong, the pages have not been cut that far, and a host that wants the page asks the engine to cut as far as the element (`run({ until: el })`) and asks again.
   *
   * `null` means the position space cannot discriminate, and it is a real answer rather than a failure: nothing presented yet, an element the index does not hold, an offset past the element's text, a character inside a monolith the presentation cut geometrically (every shell slice carries the same word position), or a word-empty block spanning pages. A consumer cannot detect any of these, which is why they are the engine's to state.
   */
  pageOf(el: Element, charOffset: number = 0): number|null|typeof NOT_YET {
    if (!this.#pages || !this.#index) return null;
    const entry = this.#index.entryFor(el);
    if (!entry) return null;
    const within = wordsBeforeChar(el, charOffset);
    if (within == null) return null;
    const q = { b: entry.block, w: entry.before + within };
    // A document cut only as far as it was asked has a horizon, and a position at or past it is a place no page has been cut for yet — which is not `null`, the refusal that says the position space cannot discriminate (*the pages are cut as far as they are asked*, 2026-10-12). A word-empty element standing exactly at the horizon is answered as not yet cut, the conservative side.
    if (this.#total == null) {
      const end = this.#pages.at(-1)?.end;
      // A word in a remainder the last cut carries is behind it in the document and on no page cut yet (beltype#43).
      if (end && (q.b > end.b || (q.b === end.b && q.w >= end.w) || carriedPast(end, q))) return NOT_YET;
    }
    return pageOfPos(this.#pages, q, this.#index.wordCounts);
  }

  /**
   * The source element a presented element is a copy of — the engine's answer to *whose box is this*, and the reverse of the question `pageOf` takes (*the engine names the source*, 2026-09-21). The element in the adopted document, or `null`.
   *
   * Every clone this presentation makes is registered element by element before anything is stripped, hinted or consumed (`word-space.js`' `mapCloneToSource`), so the answer holds at any depth of a first fragment, a continuation, a composed block's fragment, a fixed box's per-page copy and a running element's — by identity, never by a rule about stamps, tags or positions that a printer would have to keep in step with `fragments.js`.
   *
   * `null` names one thing: this element is not a copy of anything the author wrote. An original answers `null` because it IS the source; the engine's own marks — a slice shell, the Compositor's breaks and fillers — answer `null` because no author declared them; and so does an element outside this root. Elements only: a text node has no answer here, since a continuation's consumed characters are blanked and trimmed and no offset inside a fragment is an offset inside its source.
   */
  sourceOf(el: Element): Element|null {
    return el && this.contains(el) ? sourceOf(el) : null;
  }

  /**
   * The source point of a DOM point inside a presented copy — *the engine names the source point* (2026-10-13), the character-level refinement of `sourceOf`. `node` is a Text node (`offset` a character offset) or an Element (`offset` a child index), as in a DOM boundary point.
   *
   * Exact, never aligned: the answer is what `fragments.js` recorded when it blanked and trimmed the copy (`word-space.js`' `cutText`), so a host pairs no text nodes by order — a hollow box keeps its tag and loses the text node its source has, and every walk by order is off by one after it — and compares no strings. A point in an original is answered unchanged. `null` names a point in nothing the author wrote: an engine mark, text the engine wrote, a box the copy put away, a text node with none of its characters left, a node outside the root. An element point is structural (the boundary before the same author's child, past the engine's marks) and claims nothing about what is shown.
   */
  sourcePoint(node: Node, offset: number): { node: Node; offset: number; }|null {
    return sourcePointOf(this, node, offset);
  }

  /**
   * The point on page `page` (zero-based, `pageOf`'s own convention) that shows a source point — *the engine names the source point*. The original itself where that page presents the original, else the copy's point; `null` where the page does not show it (the character is not in that page's fragment, or the box holding it is hollow there) or there is no such page.
   *
   * A source point at a page break is shown at the end of the page before and the start of the page after, and each answers its own. The page's content is built if it is not built yet.
   * @param sourceNode - a node of the adopted source.
   */
  pointOn(sourceNode: Node, offset: number, page: number): { node: Node; offset: number; }|null {
    const record = Number.isInteger(page) ? this.#records[page] : null;
    if (!record || !sourceNode || !this.buildPage(page)) return null;
    return pointShownBy(new Set([...record.assigned, ...record.nodes]), sourceNode, offset);
  }

  /**
   * The press sheet: fixed page boxes print one-to-one (*honest document*, P14), differing geometries via named @page rules and per-page `page:` literals (*named pages in print*, P13). Appended last so it outcascades the author's own @page, and named so it outranks it on css-page-3 §4.4's specificity as well.
   *
   * **Every inset is zeroed, not only the margin** *(a page box has a border and a padding, 2026-09-07)*. The page box the Press hands the print path is a frame and nothing else: each `<beltype-page>` is already the whole page box, margins and all, and every inset the author declared is drawn inside it by the Chase. An author's bare `@page` rule stays in the document throughout — its non-page rules keep styling the light-DOM content — so a `border` or a `padding` on it would otherwise apply a second time, to the real print page box, and shrink the printable area under a host sized for the whole sheet. Measured the day the two were modelled: a 5mm border and a 5mm padding on a 120×90mm page made every presented page print as two, four pages becoming eight, with the page count on screen still correct. Zeroing the margin alone had been enough for exactly as long as the other two were withheld.
   */
  #pressSheet(doc: Document, pages: Page[]) {
    doc.getElementById(PRESS_STYLE_ID)?.remove();
    const geometries: Map<string,{ name: string; w: number; h: number; }> = new Map<any, any>();
    for (const pg of pages) {
      const key = `${pg.closes.pageW}x${pg.closes.pageH}`;
      if (!geometries.has(key)) geometries.set(key, { name: `__bt-g${geometries.size}`, w: pg.closes.pageW, h: pg.closes.pageH });
    }
    const pageEls = ([...this.#shadow.querySelectorAll('beltype-page')] as BeltypePage[]);
    pages.forEach((pg, i) => {
      pageEls[i].style.page = (geometries.get(`${pg.closes.pageW}x${pg.closes.pageH}`) as { name: string }).name;
    });
    const style = doc.createElement('style');
    style.id = PRESS_STYLE_ID;
    style.textContent = [...geometries.values()]
      .map((g) => `@page ${g.name} { size: ${g.w}px ${g.h}px; margin: 0; border: 0; padding: 0; }`)
      .concat(['@media print { body { margin: 0 !important; padding: 0 !important; } }'])
      .join('\n');
    doc.head.appendChild(style);
  }
}

if (!customElements.get('beltype-root')) customElements.define('beltype-root', BeltypeRoot);
