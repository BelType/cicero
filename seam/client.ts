/// <reference path="./handle.d.ts" />
/**
 * Cicero's browser entry for the BelType seam (*Cicero enters the seam in beta*, 2026-08-25).
 *
 * Three steps, and no more: adopt the compiled document into `<beltype-root>` as its light DOM (*content is one document*, I6), paginate, present the Ledger's intervals into real `<beltype-page>` frames. The essay package's `lib/client.js` does the same and then measures a second time for the differential's judge; none of that belongs here — a product path that computes evidence nobody reads is a slower product path.
 *
 * **Its imports are ordinary relative paths, and they resolve on disk as well as over the wire** (see CHANGELOG 2026-09-14). `vendorAssets()` in `./index.js` publishes `seam/` and `src/` at their own depths (*the host rewrites what the parser drops*), because the rewriter beside this file imports the encoding contract out of `src/` and no single specifier could have named it both ways. The table and these imports must still be read together.
 *
 * **`run()` may be called again on the frame it presented** (*the run resumes from an entry*, build one, 2026-10-08). The first call takes the intake — the blocks, fixed boxes and running elements, and the geometry table — and keeps it in this module; a later call hands the run the lists it took instead of re-reading `document.body.children`, which by then holds the root and nothing else, and measures the sources where they stand, parked or slotted, with the dressing sheet out of the cascade. The Ledger it returns is byte-equal to the first call's in both modes within one realm and one viewport. Without `resumeAt` the call is a whole run, measured and presented from page one (build two adds the other: see `run`); the editing tools patch their frame and call it with `resumeAt` since build four (`patch`, `box`, `addressOf` below).
 *
 * **The rim is wired here** (`rim.js`, *late truth is an edit*, 2026-10-13; *a box announces its own size*, 2026-10-21): it is handed the top-level boxes, the root's `isPresented`, the table of heights the last run measured (`previous`, beside the warm start's values), whether some page is not built yet, and a way to know the runs have ended, and its signals come back to {@link answerLateTruth}. A box's size is answered as an element is, one resume at the box, or, where it was heard through a piece a page draws it with, one resume at the address the earliest such page begins at (the root's `startOf`, *a fragment announces its own size*, 2026-10-22), three per box until the next whole run whichever of its pieces spoke; a piece's expected height is its first reading, so the root's `onPieces` hands the rim each piece from the frame it is built in; a call of `run()` counts as under way from the moment it is made, so a host that patches a box and runs in the same task is judged after its run and never answered twice. A size a stylesheet caused is a changed condition, and its resume is refused and runs whole, as every resume under moved conditions does; a size a diagram's own `<style>` caused is not, since a sheet inside an `<svg>` is the diagram's and not the document's (*the conditions are the sheets of the document*, 2026-10-22).
 *
 * The first call is made by the shell's bootstrap. `run()` is called by the shell's bootstrap after the compiler's own client stages (mermaid pre-render), because a diagram that has not drawn yet has the wrong height and every cut downstream of it would be adjudicated against a lie.
 *
 * @packageDocumentation
 */

import { paginate, topLevelBlocks, fixedBoxes, runningBoxes, describeConditions } from '../src/driver.ts';
import { assertRenderConditions, awaitFonts } from '../src/measure.ts';
import { pathOf } from '../src/positions.ts';
import { readGeometryTable } from '../src/capture.ts';
import { composeForPresentation } from '../src/compose-dom.ts';
import { attributesOf, CompositionCache } from '../src/composition-key.ts';
import { dress, isDressingSheet } from '../src/root.ts';
import { isDeliverySheet } from '../src/reads.ts';
import { ForcingMemo } from '../src/forcing-memo.ts';
import { isInlineBox, isFixedBox, holdsFixedBox } from '../src/word-space.ts';
import { FRAGMENT, selectorOf } from '../src/data-beltype.ts';
import { present, presenterCount } from '../src/presenters.ts';
import { rewriteDocumentSheets } from './rewrite-document.ts';
import { isLayerName } from './rewrite.ts';
import { watchLateTruth, frame, bringsNewFace, knowLoadedFaces, isKnownFace } from './rim.ts';
import type { Address, indexBlocks } from '../src/positions.ts';
import type { Prior, Progress } from '../src/driver.ts';
import type { BeltypeRoot } from '../src/root.ts';
import type { PageCondition } from '../src/capture.ts';

/**
 * What the first call took at intake, kept for a later call on the same frame — `null` before any presentation. The root is the one `<beltype-root>` this module made; the blocks, fixed boxes and running elements are its light children; the table is the geometry the author's `@page` rules gave, captured before `present()` cleared their margin boxes' `content`.
 * `boxes` is every top-level box the document declared, in the document's own order and whatever kind it became (a block, a fixed box, a running element) — the order intake destroys by appending blocks, then fixed boxes, then running elements, and the one a host that compiled the document again addresses a box by (`patch`).
 * `lifted` is the top-level boxes a fixed box or a running element was lifted out of at intake: each holds one box fewer than the block a host compiles again, so `patch` refuses an edit inside one (*a fixed box refuses only its own block*, 2026-10-22).
 */
let presented: { root: BeltypeRoot; blocks: Element[]; fixed: Element[]; running: ReturnType<typeof runningBoxes>; table: ReturnType<typeof readGeometryTable>; boxes: Element[]; lifted: Set<Element>; undo: () => void; }|null = null;

/** What the last call left, for a call that resumes: its paginate result, the mode it ran in and the conditions it ran under (`conditionsKey`). `null` before any. */
let previous: { result: Prior; composed: boolean; conditions: string; }|null = null;

/** Every box `patch` replaced since `previous` was cut, as the addresses it answered (amended 2026-10-15, beltype#48). A resumed run is told all of them, not only the one it was asked to resume at: a host may patch several boxes and then resume once per box (the studio does, after a select-all edit), and the first of those runs stands on a tree in which every later box is new too, so its convergence must lie past the last of them. A run that leaves a `previous` takes the ones it was handed off the list; a run that throws leaves them, because the `previous` it leaves is the one they were patched against. */
let edited: Address[] = [];

/** The composition cache, kept across calls beside `previous` (*the run resumes from an entry*, build three, 2026-10-08): paragraph key → record, where the key is a paragraph's path, its markup, the width it is set at and the per-block inputs its lines are a function of (`composition-key.js`). It is cleared when the conditions key changes, at the start of the call that sees the change, so a stylesheet, a viewport, a device pixel ratio or a colour scheme that moved is a recomposition of everything and nothing else is. A call that composes nothing (the default mode) leaves it alone. */
const compositionCache = new CompositionCache();

/** The forced-break index's reads, kept across calls beside `previous` (*the forced-break index is kept across runs*, 2026-10-09): the computed style values, page names, block-children lists and child indices of the document's elements, which a resumed run reads from here instead of asking the browser again. It is emptied by the call that does not resume (a whole run on a presented frame, a changed condition, a thrown run) and filled only by calls on a frame already presented — never by the first call after load, whose realm differs from the later ones' (the sources are children of `body` and not of `<beltype-root>`). `patchBox` tells it which box it replaced; `src/forcing-memo.js` has the rest. */
const forcingMemo = new ForcingMemo();

/** The rewrite's verdicts, kept across calls (`rewrite-document.js`): node → the text it was judged against. Replaced by an empty one on the event that clears the composition cache, a change of conditions. */
let judgedSheets: WeakMap<Element,string> = new WeakMap<any, any>();

/** The layer the host named for the document's own sheets (*the author's sheets in a layer the host names*, 2026-10-17), or `null`: the last one a call asked for, so a call that names none (the rim's, through the host's own door) keeps the frame as the host set it. A sheet once wrapped stays wrapped, so this is a property of the frame more than of a call. */
let frameLayer: string|null = null;

/**
 * The faces a layered frame had, loaded again once its pages are presented (*the author's sheets in a layer the host names*, 2026-10-17).
 *
 * @remarks With a layer named, every sheet of the document is a `<style>` the rewrite wrote, its `@font-face` rules among them, and Chromium re-creates the `FontFace` objects of the document's rules when the active stylesheets change by anything but an append (measured 2026-10-13, `rim.js`), which the presentation does. Measured 2026-10-17 in the studio experiment, the faces of a LINKED sheet came back loaded and those of a `<style>` did not: they stood `unloaded` or `loading` after the presentation, so whatever read the pages next read them in a fallback face. A run stopped at a page went on to cut its next page in the fallback (the quiet press, cut twelve pages at a time, cut its thirteenth page a line short of one whole run's, and every page after it moved), and a printer reading the presented pages found a word below a page's clip (the bill's last page in the print frame). The rim does not hear it: a re-created face says what the old one said, so it is not news (`bringsNewFace`). So the style is brought up to date here, which is when the faces are re-created, and every face whose descriptor the document had loaded is loaded again, from the memory cache: awaited when a run stops at a page, so the next slice measures in the faces; started and not awaited when a run completes, so they are `loading` and `document.fonts.ready` waits for them when the call answers, without a task between the presentation and the answer (a host that puts the caret back on the answer lost a keystroke typed in such a gap: measured in the studio experiment, the browser had no caret to type at and fired no beforeinput). Only in a layered frame: a frame no call named a layer for keeps its `<link>`s and answers exactly as before.
 */
async function reloadKnownFaces() {
  if (frameLayer == null) return;
  void document.documentElement.offsetHeight; // the style update that re-creates the faces
  const stale = [...fonts].filter((f) => f.status !== 'loaded' && isKnownFace(f));
  if (stale.length) await Promise.all(stale.map((f) => f.load().catch(() => {})));
}

/** How many times a font finished loading (*late truth is an edit*, 2026-10-13): a face that arrives is a condition of every line, and nothing in the document's stylesheets says so. The count rides in {@link conditionsKey} as the number the run began under, so a run that began before a face arrived is a run under other conditions than the document now has — a resume is refused and the composition cache is cleared, whoever asks for the next run, the rim or the host. */
let fontEpoch = 0;
/** The document's face set, kept: it is the same object for the life of the document, and a test that watches how often the engine asks the document for it (progressive.test.js) counts the intake's and the driver's asks and no others. */
const fonts = document.fonts;
knowLoadedFaces(fonts);
const countFaces = (event: Event) => { if (bringsNewFace(event)) fontEpoch++; };
fonts.addEventListener('loadingdone', countFaces);
/** Set by {@link release}: this module instance is finished with its document, and answers no more. A flag of this instance, never of the classes it defined, which the next document's module scripts inherit from the window. */
let released = false;

/**
 * The run's conditions, as one string (*a break decision is valid only under render-identical conditions* (I5), applied to the memo — Decision one of *the run resumes from an entry*): the measuring realm's media environment — the viewport, the device pixel ratio, the colour scheme — the text of the stylesheets the document wears, as the rewrite and the presentation left them (the document's own: a sheet inside an `<svg>` or inside a copy the engine made is a box's, and what it changes is that box's extent, which the rim hears — *the conditions are the sheets of the document*, 2026-10-22), and the font epoch the run began under, and how many presenters are registered (*a copy may be presented*: a presenter is a condition of every copy, and a registration after a run is seen here as the change it is). The delivered read values are the driver's to compare, not this string's. Taken after a presentation and again before the next run, so the two readings see the same engine litter (the press `<style>` is left out) and a difference between them is the host's own.
 * @param epoch - {@link fontEpoch} as the run began, which is not the count at the moment of asking: a face that arrived during the run must show at the next one.
 */
function conditionsKey(doc: Document, epoch: number) {
  const sheets = wornSheets(doc).map((sheet) => {
    try {
      return [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
    } catch {
      return sheet.href ?? ''; // a sheet this realm cannot read changes only by its address
    }
  });
  const win = (doc.defaultView as Window);
  return JSON.stringify([win.innerWidth, win.innerHeight, win.devicePixelRatio, win.matchMedia('(prefers-color-scheme: dark)').matches, sheets, epoch, presenterCount()]);
}

/**
 * Where a sheet's owner stands that makes the sheet a box's and not the document's (*the conditions are the sheets of the document*, 2026-10-22): inside an `<svg>`, whose rules reach that diagram's subtree and nothing outside it, or inside a copy the engine made.
 *
 * @remarks The copy is found by the fragment word, which is true by construction: `data-beltype.js` defines `fragment` as the root of every copy the engine appends to `<beltype-root>`, and every site that appends one writes it (a fragment, a composed clone, a fixed box's or a running element's per-page copy). The other spelling, any element under the root that is not an original, would need the intake's lists beside every sheet's owner, where the word is one `closest` and says the same thing. Measured 2026-10-22 on the manual under the editing tools: a mermaid diagram's `<style>`, and its copy on every built page, moved the key on every edit and on every scroll.
 */
const BOX_SHEET = `svg, ${selectorOf(FRAGMENT)}`;

/** The stylesheets the document wears that are the document's own — the engine's `__beltype*` litter and a box's own sheet ({@link BOX_SHEET}) left out — in the order {@link conditionsKey} lists them. */
const wornSheets = (doc: Document) => [
  ...[...doc.styleSheets].filter((sheet) => {
    const owner = (sheet.ownerNode as Element | null);
    return !owner?.id?.startsWith('__beltype') && !owner?.closest?.(BOX_SHEET);
  }),
  // The sheets a host adopts — the editing tools' dresser seats the author's whole stylesheet that way — are worn like any other, and the key ignored them until 2026-10-09; the engine's own two (the dressing sheet, the delivery sheet) are litter the key leaves out.
  ...[...(doc.adoptedStyleSheets ?? [])].filter((sheet) => !isDressingSheet(doc, sheet) && !isDeliverySheet(doc, sheet))
];

/** A name for each of {@link wornSheets}, for a sentence that says which one moved: its address' path, else its element's id, else `<style>`. */
const sheetLabels = (doc: Document) => wornSheets(doc).map((sheet) => {
  if (!sheet.ownerNode && !sheet.href) return '<adopted sheet>';
  if (sheet.href) { try { return new URL(sheet.href).pathname; } catch { return sheet.href; } }
  const owner = (sheet.ownerNode as Element | null);
  return owner?.id ? `#${owner.id}` : '<style>';
});

/**
 * Replace the box an edit fell in, in the document this module presented, with the one the host compiled (*the run resumes from an entry*, build four, 2026-10-08).
 *
 * `index` is the top-level box's place in the document's own order (`presented.boxes`) and `path` the element-child indices from it to the box that changed — empty where the top-level box itself did. The answer is the new box's address, the one `run({ resumeAt })` takes, or `null` when the seam will not promise the replacement is sound and the host reloads instead. It refuses when: nothing was presented; the index is not a flow block (a fixed box or a running element is not edited this way); the path does not lead to an element of the same name; a top-level box's own attributes differ (a class that makes a block a running element is the one change the host cannot see); the top-level box is one a fixed box or a running element was lifted out of at intake (the block the host compiled again holds a box the presented block does not, and the paths would disagree about the tree); or the replacement holds a fixed box or a running element of its own (lifting it is a change to the intake's lists, which is a run's work, so the old box is put back and the host reloads). The second test is a computed style, so it is asked once the replacement stands in the tree, parked where it is a new top-level block; a sheet's text is never the reason (*a fixed box refuses only its own block*, 2026-10-22).
 *
 * A new top-level block is parked before anything reads it (`root.js`: *an unplaced original is parked, not unassigned*), because `getComputedStyle` answers nothing for a slottable no slot takes and every reading the composition and the measure take from the source would go blank. A box inside a block is already in the flat tree and needs nothing. The old box is detached; the pages that show it are pages the run is about to cut again, and the ones it does not are not showing it (a page before the restart ends before the box begins, and the clause that an equal address is believed only past the edited box keeps the pages after).
 */
function patchBox(index: number, path: number[], el: Element): Address|null {
  if (!presented) return null;
  const { blocks, boxes, root } = presented;
  const top = boxes[index];
  const b = top ? blocks.indexOf(top) : -1;
  if (b < 0 || presented.lifted.has(top)) return null;
  let old = top;
  for (const i of path) old = old?.children[i];
  if (!facsimile && (el.matches(PDF_OBJECT) || el.querySelector(PDF_OBJECT))) return null; // a PDF the first intake did not meet: the module is not loaded and the presenter is not registered, so the host reloads and the intake does it
  if (!old || old.localName !== el.localName || (path.length === 0 && attributesOf(old) !== attributesOf(el))) return null;
  const park = (root.shadowRoot?.querySelector('slot[data-beltype-park]') as HTMLSlotElement | null | undefined);
  const slot = path.length === 0 ? old.assignedSlot : null;
  const held = slot?.assignedNodes() ?? [];
  old.replaceWith(el);
  if (path.length === 0 && park) park.assign(...(park.assignedNodes() as Array<Element | Text>), el);
  if (isFixedBox(el) || holdsFixedBox(el)) {
    el.replaceWith(old);
    slot?.assign(...(held as Array<Element | Text>)); // a node that leaves its host loses its manual assignment (measured 2026-10-22), so a top-level box goes back to the slot that held it, in its place
    return null;
  }
  forcingMemo.replaced(el); // the memo's one reason to forget: an element took a place another held
  if (path.length === 0) {
    blocks[b] = el;
    boxes[index] = el;
  }
  rim?.add(boxes[index], top); // the replacement may hold a picture still loading, or an element not yet defined
  const address = (handle.addressOf as NonNullable<Handle['addressOf']>)(el);
  if (address) edited.push(address);
  return address;
}

/** THE RIM, from the intake until the frame lets the run go (`rim.js`, *late truth is an edit*): the subscription to the facts that arrive after a measure. `null` before the intake. */
let rim: ReturnType<typeof watchLateTruth>|null = null;
function stopRim() { rim?.stop(); rim = null; }

/**
 * The rim's default action (*late truth is an edit*, Decision four, 2026-10-13): what a signal the host did not cancel does. Signals are coalesced over one animation frame into one batch; a batch that holds a font is one whole run (a face is a condition of every box), and any other — an image, an element, a store's write, a box's size — is one `run({ resumeAt })` per box, the earliest in the document first and one at a time, since convergence is believed past one edited box. A signal that arrives while a run is under way waits for it; a run stopped at a page is let go and the answer stays within the pages it had cut, as an edit's does. The runs go through the host's own door, the `run` property of the handle object this module put on the window, read at each call, so a host that replaces that property (the essay's init scripts and tests do) sees the rim's runs as it sees its own. A host that replaces the whole object `window.__beltypeCicero` does not: the rim keeps calling this module's own handle (so a client that was released, or one a newer client replaced, never reaches into the next document's), and nothing in the repositories searched does that.
 *
 * A box heard through a piece a page draws it with (*a fragment announces its own size*, 2026-10-22) carries the page it was heard on, and its resume is at the address that page begins at, the earliest such page; every other box carries `null` and is resumed at its own address.
 */
let batch: { font: boolean; boxes: Map<Element,number|null>; }|null = null;
/** The answer in progress, or `null`. */
let working: Promise<void>|null = null;

/** How many resumes the `size` kind asked for, per box, since the last whole run (*a box announces its own size*, 2026-10-21). */
const sizeResumes: Map<Element,number> = new Map<any, any>();
/** The resumes a box's own size may ask for before the last layout stands: the reads' own posture for a value that keeps moving its line. */
const SIZE_BUDGET = 3;

/** Spend one of a box's resumes, or refuse: the fourth is refused with one console line naming the box, and the rest in silence until the next whole run. */
function spendSize(box: Element) {
  const n = sizeResumes.get(box) ?? 0;
  sizeResumes.set(box, n + 1);
  if (n === SIZE_BUDGET) console.warn(`BelType/Cicero: this box changed its size again after ${SIZE_BUDGET} runs cut it again, so the last layout stands until the next whole run —`, box);
  return n < SIZE_BUDGET;
}

function answerLateTruth({ kind, boxes, pages = [] }: { kind: 'image'|'element'|'font'|'size'|'store'; boxes: Element[]; pages?: Array<number|null>; }) {
  // A size is answered as an element is, within the box's budget, whichever of its pieces spoke; the page rides beside its box.
  let heard = boxes.map((box, i) => ([box, pages[i] ?? null] as const));
  if (kind === 'size') heard = heard.filter(([box]) => spendSize(box));
  if (kind !== 'font' && heard.length === 0) return;
  batch ??= { font: false, boxes: new Map<any, any>() };
  if (kind === 'font') batch.font = true;
  for (const [box, page] of heard) {
    const was = batch.boxes.get(box);
    batch.boxes.set(box, was === undefined ? page : was === null || page === null ? null : Math.min(was, page));
  }
  working ??= lateTruth().finally(() => { working = null; });
}

async function lateTruth() {
  await frame();
  while (batch) {
    const { font, boxes } = batch;
    batch = null;
    const h = handle;
    try {
      /** One step, after any run under way has ended; `null` where the run before left nothing to answer. */
      const ready = async () => {
        while (live && !live.gate) await live.finished;
        return released ? null : previous?.composed ?? null;
      };
      if (font) {
        const composed = await ready();
        if (composed === null) continue;
        const until = live ? live.progress?.pages ?? null : null;
        if (live) await letGo();
        await h.run({ composed, until });
      } else {
        for (const box of (presented as NonNullable<typeof presented>).boxes.filter((b) => boxes.has(b))) {
          const composed = await ready();
          if (composed === null) break;
          const page = boxes.get(box);
          const resumeAt = page == null ? h.addressOf?.(box) : (presented as NonNullable<typeof presented>).root.startOf(page);
          await h.run({ composed, ...(resumeAt ? { resumeAt } : {}) });
        }
      }
    } catch (error) {
      console.warn('BelType/Cicero: the answer to a late fact failed —', error);
    }
  }
}

/** The calls of `run()` not yet answered, the host's and the rim's alike: a call is under way from the moment it is made, before the run it starts exists. */
const calls: Set<Promise<unknown>> = new Set<any>();

/** Resolves when no call of `run()` is unanswered, no run is under way (a run stopped at a page is at rest) and the rim has nothing pending: when the `size` kind judges what it heard, against the table the last run left. A host that patches a box and calls `run()` in the same task is under way before the next frame, so its presentation is judged after its run and not heard as news. */
async function quiet() {
  while (working || calls.size || (live && !live.gate)) await Promise.race([working, ...calls, live?.finished].filter(Boolean)).catch(() => {});
}

/** Resolves when the rim has nothing pending and no run is under way (a run stopped at a page is at rest). The door a venue test and a host that wants to know it is looking at the settled document call. */
async function settled() {
  while (working || (live && !live.gate)) await (working ?? (live as Session).finished);
}

/** The run that stopped at a page, if there is one (*the pages are cut as far as they are asked*, 2026-10-12): the driver is waiting inside its page loop with its place, its measure context and its Ledger kept, and the pages it has cut are on screen. `run()` with no `resumeAt` on the same mode goes on from here; anything else lets it go. */
let live: Session|null = null;

/** One run, from the call that started it to the moment it is complete or let go. */
export type Session = {
  composed: boolean;
  /** the driver's own promise, resolved only at the document's end. */
  promise: Promise<Awaited<ReturnType<typeof paginate>>>;
  /** how far the host has asked the run to go: a page count, an element (the page that holds it), or null for the end. */
  target: number | Element | null;
  /** what the driver last offered, after its last page. */
  progress: Progress | null;
  /** set while the driver waits at a page: calling it lets the driver go on. */
  gate: (() => void) | null;
  /** set by the call that is waiting for the run to stop or end: called when the driver stops at a page. */
  stopped: (() => void) | null;
  /** the run was let go; the driver is ended the next time it is released. */
  cancelled: boolean;
  /** this run has shown pages of its own before the end (it stopped at a page): what it shows from then on is added to, or replaced from the first page that differs, and the pages the root shows are `shownRows`' first `shown`. */
  partial: boolean;
  /** how many pages of `shownRows` the root shows. */
  shown: number;
  /** the account the root's pages were presented from. */
  shownRows: any[];
  /** this run took the intake (the first call on a frame). */
  fresh: boolean;
  /** {@link fontEpoch} as the run began. */
  epoch: number;
  /** the result this run resumes from, or null. */
  wanted: Prior | null;
  /** settled when the run is complete, failed or let go. */
  finished: Promise<void>;
  /** settles `finished`. */
  done: () => void;
  /** the address' fragment was shown, or there was none. */
  hashed: boolean;
  /** why a resume was not taken, in a sentence, or null. */
  refusal: string | null;
  resumeAt: Address | null;
  /** how many of {@link edited} this run was handed, which the `previous` it leaves takes off the list. */
  taken: number;
};

/** What a driver that was let go rejects with. */
const LET_GO = new Error('BelType/Cicero: the run was let go');

/** The row of an account as the presentation reads it, without the chrome (`closes` is re-read on every presentation): two rows with the same key are the same page. */
const rowKey = (row: any) => JSON.stringify([row.cut, row.carried, row.cls, row.trace, row.blank, row.leadPx, row.usedPx, row.cost, row.tracks, row.extents, row.closes.name, row.closes.pageW, row.closes.pageH, row.closes.contentW, row.closes.contentH]);

/** The first page whose cut differs between what the root shows and an account that has been cut again, or how many pages are shown where none differs: the pages from there on are the ones a presentation replaces. */
function firstDifference(shownRows: any[], shown: number, account: any[]) {
  const n = Math.min(shown, account.length);
  for (let i = 0; i < n; i++) if (shownRows[i] !== account[i] && rowKey(shownRows[i]) !== rowKey(account[i])) return i;
  return n;
}

/** Has the run been cut as far as it was asked? A page count is met by the pages cut; an element by the page that holds its first word. */
function reached(session: Session) {
  const { target, progress } = session;
  if (!progress || target == null) return false;
  return typeof target === 'number' ? progress.pages >= target : progress.held(target);
}

/** The driver's `pace`: called after every page of the first layout. It stops the run where the host asked it to stop — by returning a promise the next call releases — and otherwise lets it go on without a pause. */
function pacer(session: Session, progress: Progress) {
  session.progress = progress;
  if (session.cancelled) return Promise.reject(LET_GO); // a run released while it measures stops at its next page
  if (!reached(session)) return undefined;
  return new Promise<any>((resolve, reject) => {
    session.gate = () => (session.cancelled ? reject(LET_GO) : resolve(undefined));
    session.stopped?.();
  });
}

/** Let go of the run that is stopped at a page: its driver is ended, and the Ledger it had cut so far stays as `previous`, which is what a resumed run starts from. */
async function letGo() {
  const session = (live as Session);
  live = null;
  session.cancelled = true;
  const settled = session.promise.catch(() => {});
  const stopped = !!session.gate;
  session.gate?.();
  await (stopped ? settled : session.finished); // a run that is not stopped is on its way to the end, and the host that started it shows it
}

/**
 * THE INTAKE (*the pages are cut as far as they are asked*, 2026-10-12): the document's boxes become the root's light DOM, parked, before the first cut. A run that can stop at a page measures the sources while pages stand in the document, so it measures them where a resumed run always has. Nothing else in the first call changes: the lists and the geometry table are read first, with the document where it was, exactly as the run read them before.
 *
 * Fonts are awaited here as well as in the driver, because the driver's wait asks the browser which fonts are loading, and a document whose boxes are all parked is laying nothing out: a face the text would have asked for is never asked for. With the document still laid out, a forced layout asks for them, and the wait is real.
 */
async function takeIntake(relaxDpr: boolean) {
  assertRenderConditions(document, { relaxDpr });
  void document.body.offsetHeight;
  await document.fonts.ready;
  await takeFacsimile(); // a presenter is a condition of every copy: registered before the first one, with every size known
  // No image is awaited (ruled 2026-11-08): the driver makes the lazy ones eager, and the rim started below hears every picture's first load as well as a later one, since it listens in the capture phase on each top-level box (`rim.js`), and resumes only where the arrival changed the box.
  const table = readGeometryTable(document);
  await awaitFonts(document, table.furnitureFaces); // before the rim exists: a face only the margin boxes use is otherwise requested after the cuts, and its `loadingdone` would be heard as a late condition
  const blocks = topLevelBlocks(document);
  const fixed = fixedBoxes(document);
  const running = runningBoxes(document);
  // The document's top-level boxes in its own order, taken before the root exists and before the appending below destroys the order: the same filter `topLevelBoxes` (driver.js) applies, which is not exported, and a second copy of this one line is cheaper than a change to `src/`.
  const boxes = [...document.body.children].filter((el) => !el.id.startsWith('__beltype') && !['STYLE', 'SCRIPT'].includes(el.tagName));
  const moved = [...blocks, ...fixed, ...running.map((r) => r.el)].map((el) => ([el, el.parentNode, el.nextSibling] as const));
  const lifted = new Set([...fixed, ...running.map((r) => r.el)].map((el) => boxes.find((box) => box !== el && box.contains(el))).filter((box) => box !== undefined));
  const root = (document.createElement('beltype-root') as BeltypeRoot);
  document.body.appendChild(root);
  root.intake(...blocks, ...fixed, ...running.map((r) => r.el)); // *Content is one document* (I6): the document adopted as the root's light DOM. A running element is adopted and never assigned, which is §1.2.1's *does not display there* with nothing arranged for it.
  root.cutTo = ( el: Element) => cutTo(el);
  root.onPieces = ( built: Array<[Element,Element]>,  removed: Iterable<Element>) => rim?.pieces(built, removed); // the pieces a built page draws its blocks through, which the rim observes from the frame they are built in (*a fragment announces its own size*)
  presented = {
    root,
    blocks,
    fixed,
    running,
    table,
    boxes,
    lifted,
    // A run that fails before it has shown a page puts the document back where it found it, so the host's message — *showing it unpaginated instead* — is true.
    undo() {
      for (const [el, parent, next] of moved.toReversed()) parent?.insertBefore(el, next);
      root.remove();
      stopRim();
      presented = null;
    }
  };
  rim = watchLateTruth({ document, fonts, originals: boxes, onSignal: answerLateTruth, presented: (box) => root.isPresented(box), pageHolding: (piece) => root.pageHolding(piece), measured: (box) => previous?.result.heights?.get(box), idle: quiet, busy: () => !!(working || calls.size || (live && !live.gate)), unbuilt: () => { const b = root.built(); return b.built < b.pages; } });
}

/** The selector of the elements the facsimile presents, and the module itself once the document held one. Loaded here and never earlier: a document without a PDF pays nothing, and pdf.js is not fetched. */
const PDF_OBJECT = 'object[type="application/pdf"]';
let facsimile: typeof import('./facsimile.ts')|null = null;

/** THE FACSIMILE, at intake (*the embedded PDF*, 2026-10-14; `facsimile.js`): when the document holds a PDF `<object>`, load the module, which reads the size of every page the document embeds and registers the presenter — awaited, like fonts and images, because the first cut must be made on the box a page will show. A module that cannot load REFUSES the run, and the document is shown unpaginated with the reason: the static rule in the head hides such an object outside the root, and a measure taken without the presenter would measure it as nothing. */
async function takeFacsimile() {
  if (facsimile || !document.querySelector(PDF_OBJECT)) return;
  let module;
  try {
    module = await import('./facsimile.ts');
  } catch (error) {
    throw new Error(`BelType/Cicero: the document embeds a PDF and the module that draws it did not load (${(error as Error)?.message ?? error})`);
  }
  await module.install(document, present);
  facsimile = module; // only once the presenter is registered: a refusal (a figure with no alt) leaves the next call to try again
}

/** The host's door for "cut as far as this element", for a link into a place the document has not been cut to: a stopped run is asked, a running one is on its way, and a complete document has nothing to cut. */
async function cutTo(el: Element) {
  const session = live;
  if (!session) return;
  if (session.gate) await handle.run({ composed: session.composed, until: el });
  else await session.finished;
}

/**
 * Show the pages the run has cut that the root does not show yet — or, where the run was cut again whole, the pages that differ from the ones it shows — and keep what the doors need.
 *
 * `total` is the page count where the run is complete and `null` where it is not: the pages shown before the end have no total (`counter(pages)` prints nothing) and `pageOf` answers `'not-yet'` beyond them.
 *
 * @param p - `from`..`to` are the pages built anew, in page indices of the account.
 */
function show(session: Session, { account, index, total, from, to, resume }: { account: any[]; index: ReturnType<typeof indexBlocks>; total: number|null; from: number; to: number; resume: { from: number; to: number; oldTo: number; priorLength: number; }|null; }) {
  const { root, blocks, fixed, running, table } = (presented as NonNullable<typeof presented>);
  const composed = session.composed;
  const t = performance.now();
  // The pages a presentation builds anew are the only ones composed for presentation (*the run resumes from an entry*); with none to build there is nothing to compose.
  const rebuilt = resume || from > 0 ? { from, to } : null;
  const resolvedByWidth = composed ? composeForPresentation(document, blocks, account, compositionCache, rebuilt) : null;
  if (composed) performance.measure('cicero:compose-presentation', { start: t, end: performance.now() });
  const started = performance.now();
  root.present({
    account,
    blocks,
    fixed,
    running,
    index,
    total,
    marginBoxesFor: (cond) => table.pageFor((cond as PageCondition)).marginBoxes,
    // Composed content presents through its hinted fragments — an original cannot carry the chosen lines without being written, and *the source document is never written* (C5) forbids it.
    resolvedByWidth,
    // A page a resumed call kept and had not built is built later, and in the composed mode its blocks are composed then (cache hits for every paragraph the cache still holds).
    composeFor: composed ? ( page: number) => composeForPresentation(document, blocks, account, compositionCache, { from: page, to: page }) : null
  }, resume);
  void root.offsetHeight; // the presentation's own layout, inside its measure: a timing that cannot say whether it did the work is not a measurement
  performance.measure('cicero:present', { start: started, end: performance.now(), detail: { pages: account.length, ...(total == null ? { stopped: true } : {}) } });
  session.shown = account.length;
  session.shownRows = account;
  seatDoors(blocks);
  if (!session.hashed) {
    // An address that names a place in the document (`…#chapter`) is a place on a page that may not be built; the browser's own scroll to the fragment ran before there were pages. A place not cut to yet waits for the cut that reaches it.
    const named = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    if (!named || !root.contains(named)) session.hashed = true;
    else if (root.pageOf(named) !== 'not-yet') { root.reveal(named); session.hashed = true; }
  }
}

/** The host's doors onto the presentation, seated on the handle after every presentation (*the engine answers the page*, 2026-09-04; beltype#19, beltype#20). A verb, never the index: the tokenization stays in the realm it is checked in, and a verb survives the parked horizon of the engine leaving this realm where an exposed index holding live DOM references would not. */
function seatDoors(blocks: Element[]) {
  const { root } = (presented as NonNullable<typeof presented>);
  const h = handle;
  h.pageOf = (el, charOffset = 0) => root.pageOf(el, charOffset);
  // The windowing's doors (*only the pages near the reader are built*, 2026-10-12): the pages near the reader are built with the presentation and the rest as the reader nears them or the browser is idle, so a host about to read a page asks for it first. `reveal` builds the page that begins a source element and scrolls its drawn copy into view; `buildPage` builds one page; `buildAll` builds every page and is awaited by whoever reads them all (the printer, a gate); `built` says how many pages have their content.
  h.reveal = (el, options) => root.reveal(el, options);
  h.buildPage = (k) => root.buildPage(k);
  h.buildAll = async () => root.buildAll();
  h.built = () => root.built();
  // And its reverse (*the engine names the source*, 2026-09-21): a host holding an element on a page asks whose box it is. A verb for the same reason — the map holds live DOM references and stays inside.
  h.sourceOf = (el) => root.sourceOf(el);
  // And the same two doors at character level (*the engine names the source point*, 2026-10-13): a DOM point in a copy to the source's, and a source point to the page that shows it. Verbs for the same reason, and exact — the engine recorded what it blanked, so a host aligns nothing and pairs no text nodes by order.
  h.sourcePoint = (node, offset) => root.sourcePoint(node, offset);
  h.pointOn = (node, offset, page) => root.pointOn(node, offset, page);
  // And the address a host gives back to resume from: a source element, and the word of it an edit began at, in the one spelling the Ledger speaks (*the run resumes from an entry*, build two). `null` for an element that is not inside one of the document's top-level blocks. **An inline-level box is not a place the Ledger cuts at**, so the address climbs to the nearest box that is: an edit inside an `<em>` is an edit of the paragraph that holds it, and `{ path to the em, word 0 }` would order against the paragraph's own cuts as a place before them whatever word the em began at (build four).
  h.addressOf = (el, word = 0) => {
    const b = blocks.findIndex((block) => block === el || block.contains(el));
    if (b < 0) return null;
    let box = el;
    while (box !== blocks[b] && isInlineBox(box)) box = (box.parentElement as Element);
    return ({ path: pathOf(box, blocks[b], b), word } as Address);

  };
  // The host's two doors onto the document it compiled again (*the run resumes from an entry*, build four): which source stands at a top-level box of the new document, and the replacement of an edited box with the new document's. Verbs, because the lists they work on are the module's own.
  h.box = (i) => {
    const box = presented?.boxes[i];
    return box && presented?.blocks.includes(box) ? box : null;
  };
  h.patch = (i, path, el) => patchBox(i, path, el);
}

/**
 * Paginate and present the current document, as far as it is asked.
 *
 * **`until` makes the call cut as far as it is asked and stop with its place kept** (*the pages are cut as far as they are asked*, 2026-10-12; `.claude/decisions/cicero/the-pages-are-cut-as-far-as-they-are-asked.md`). A number is a page count; an element is the page that holds its first word. The pages cut are presented into the frame as they are cut — the intake is made before the first cut — and the call answers with how many pages exist and whether the document is `complete`. Called again on the same frame with a further `until`, or with none (to the end), the run goes on from where it stopped: the measure context, the Ledger and the cursor were never let go. Without `until` the call is the whole run it always was, and an `until` past the end is the same run. What is true only at the end waits for it: the page total is blank on every page until the call that completes the document fills it on all of them, a page number the document has not reached yet is reserved at its width and painted invisible, and `pageOf` answers `'not-yet'` for a place beyond the last page.
 *
 * **`composed` is the second mode's one door** (*the composed mode reaches the operator*, 2026-09-10). False — the default, and what every existing caller gets — leaves the lines to the browser and reads what it produced. True gives them to the Compositor: whole-paragraph total-fit over the paragraph's own candidates, Liang hyphenation decided here rather than asked for, and the chosen lines materialised as forced hints. It has always been built and has never been reachable from a document; this argument is the whole of the difference.
 *
 * **A call on a frame already presented, with no `resumeAt` and no run stopped at a page, measures again and presents again, whole.** The filed finding that `run()` adopts the document destructively and is not re-entrant is closed at the seam by build one of *the run resumes from an entry*: the intake is kept, the geometry table is the one captured before the presentation cleared the margin boxes' `content`, and the dressing sheet is out of the cascade while the sources are read.
 *
 * **`resumeAt` makes the call a resumed run** (*the run resumes from an entry*, build two, 2026-10-08): the address of the box edited since the last call, as `addressOf` spells it. The call then reuses the Ledger the last one kept, restarts one page before the page holding that address, stops at the first page that ends where the prior run's page ended, keeps the prior pages after it and refills only the pages it cut again. It falls back to a whole run, silently and correctly, when the last call was in the other mode or under other conditions (`conditionsKey`), or when the document's top-level blocks are not as many as the prior Ledger was cut over — so the result's `resumed` is `null` exactly when nothing was reused. In the composed mode the composition re-composes only the paragraphs the edit touched (build three): the cache is kept across calls and keyed by the paragraph, not the element object. **An edit while the document is not complete resumes within the pages cut and, unless `until` says otherwise, stops at the horizon it had** (an edit beyond it recuts the one page before it and nothing else, since the pages after it do not exist).
 *
 * **`layer` names the cascade layer the host wants the document's own sheets in** (*the author's sheets in a layer the host names*, 2026-10-17): every same-origin sheet the document carries is wrapped in it by the rewrite, so a host's own sheets, layered after it, outrank the author's whatever their specificity. Absent, the frame keeps the layer it was last run with, and a frame no call ever named one for is rewritten exactly as before. A change of name clears the rewrite's verdicts; a sheet already wrapped in the old name keeps it.
 *
 * @returns what the console line reports; the presented pages stay live in the DOM. `pages` is how many are cut; `complete` whether that is the document's end. `resumed` names the pages cut again, from 1: `from` through `to`, with `shift` the pages the run added (or, negative, removed) and `kept` the prior pages after `to` left standing. `why` is a plain sentence, set exactly when `resumed` is `null`: the first run on a frame, no `resumeAt`, another mode, conditions that moved (and which part), a block count that moved, or a reference whose page number sent the run round again. `composition` is the composed mode's count (`null` in the default): `misses` the paragraphs composed, `hits` the ones found already composed, `blocks` their sum, and `laid` the top-level blocks cloned and measured to read their widths (the rest were answered by the cache whole).
 */
export function run(opts?: { composed?: boolean; resumeAt?: Address|null; until?: number|Element|null; layer?: string|null; }): Promise<{ pages: number; ms: number; composed: boolean; complete: boolean; resumed: { from: number; to: number; shift: number; converged: boolean; kept: number; }|null; why: string|null; composition: { blocks: number; hits: number; misses: number; laid: number; }|null; }> {
  if (released) return Promise.reject(new Error('BelType/Cicero: this client was released; the next document loads its own'));
  const call = runOnce(opts);
  calls.add(call);
  const answered = () => calls.delete(call);
  call.then(answered, answered);
  return call;
}

/** {@link run}, once its call is counted. @param [opts] */
async function runOnce({ composed = false, resumeAt = null, until = null, layer = frameLayer }: Parameters<typeof run>[0] = {}) {
  const t0 = performance.now();
  if (layer != null && !isLayerName(layer)) throw new TypeError(`run: "${layer}" is not a cascade layer name`); // before anything is undressed or held
  if (layer !== frameLayer) {
    judgedSheets = new WeakMap<any, any>(); // every sheet is judged again, under the new name
    frameLayer = layer;
  }
  // A run stopped at a page goes on, unless the host asked for something that is not a continuation.
  if (live && !resumeAt && live.composed === composed) return carryOn(live, until, t0);
  if (!resumeAt) sizeResumes.clear(); // a whole run: every box's size may ask again
  if (live) await letGo();

  const first = !presented;
  // A call on a frame this module already presented: the document is the root's light DOM now, so the run is handed what the first call took (*the run resumes from an entry*, build one).
  if (presented) {
    dress(false);
    presented.root.hold(); // the idle build waits while the run measures; `present()` lets it go
  }

  /**
   * The rewrite comes first — before a single style is read (*the host rewrites what the parser drops*, 2026-09-14).
   *
   * Chromium refuses `string-set`, `position: running()`, `content: string()`/`element()` and the whole of an `@page :blank` rule at parse, so none of them is in any CSSOM for the capture to read. The host rewrites each same-origin sheet into forms the parser keeps and replaces it in place; the browser parses the result, and everything downstream reads the CSSOM it always read. A document declaring none of the four is not touched, and the console says once what moved when one is.
   *
   * It is `await`ed because a linked sheet's text comes over the wire. Nothing has measured anything yet, so no decision is taken against the pre-rewrite cascade.
   */
  await rewriteDocumentSheets(document, judgedSheets, { layer: frameLayer });
  // The host-level phases, kept in the User Timing API like the driver's own (*the run keeps time*, 2026-09-25): inert unless a host reads `performance.getEntriesByType('measure')`, and DevTools' Performance panel draws them for free.
  let t = t0;
  performance.measure('cicero:rewrite', { start: t, end: (t = performance.now()) });

  // The DPR half of *render-identical conditions* (I5), relaxed for the preview and never in silence. `measure.js` states the price exactly: decisions taken at DPR ≠ 1 are valid for the screen being looked at, not for print. A beta that swallowed this would be telling the operator its page count means something it does not.
  const relaxDpr = window.devicePixelRatio !== 1;
  if (relaxDpr) {
    console.warn(
      `BelType/Cicero: devicePixelRatio is ${window.devicePixelRatio}, and Cicero's I5 requires 1. ` +
      'Pagination is relaxed for this preview — the cuts below are valid for THIS screen, not for print. ' +
      'For print-valid pagination use a unit-DPR display, or render with --engine pagedjs.'
    );
  }

  // One cache across both halves of the run and across runs: `paginate` composes each block at its page's width to adjudicate, and the presentation wants the same records rather than a second composition of the same paragraphs (the re-homing of *cut-invariance*, C7, is a cache hit), and a later call finds what an earlier one composed. The conditions are read once, here, and a change of them clears the cache; the first call has no cache to clear and does not pay for the reading.
  const conditionsNow = first ? null : conditionsKey(document, fontEpoch);
  if (compositionCache.restart((conditionsNow as string))) judgedSheets = new WeakMap<any, any>(); // the conditions moved: every sheet is judged again, on the next call
  const wanted = !first && resumeAt && previous && previous.composed === composed && previous.conditions === conditionsNow ? previous : null;
  // The reason a resume was not taken (*the engine says why*, 2026-10-08): the host's own refusals are named here, the driver's (a block count that moved, a reference that sent the run round again) come back in its result. Once, the first edit after a load ran whole for no reason anybody could name; this is how the next one is caught.
  const refusal = wanted ? null
    : first ? 'the first run on this frame: there was nothing to resume'
    : !resumeAt ? 'no edit address (resumeAt) was given, so a whole run was asked for'
    : !previous ? 'the run before this one left nothing to resume (it threw, or none finished)'
    : previous.composed !== composed ? `the run before this one was ${previous.composed ? 'composed' : 'in the default mode'} and this one is ${composed ? 'composed' : 'in the default mode'}`
    : describeConditions(previous.conditions, (conditionsNow as string), sheetLabels(document));
  t = performance.now();
  // The forced-break index's memo rides a call that resumes, and starts empty for one that does not; the first call on a frame is offered none and fills none.
  if (!wanted) forcingMemo.clear();

  try {
    if (first) await takeIntake(relaxDpr);
  } catch (error) {
    forcingMemo.clear();
    throw error;
  }
  const { blocks, fixed, running, table } = (presented as NonNullable<typeof presented>);
  const epoch = fontEpoch; // after the intake, which waited for the faces the document asked for

  // An edit while the document is not complete stays within the pages it had cut, unless the host asked for more.
  const horizon = wanted?.result.incomplete ? wanted.result.account.length : null;
  const target = until ?? horizon;

  const session = (({ composed, promise: null, target, progress: null, gate: null, stopped: null, cancelled: false, partial: false, shown: 0, shownRows: [], fresh: first, epoch, wanted: wanted?.result ?? null, hashed: !first, refusal, resumeAt, taken: edited.length } as unknown) as Session);
  session.finished = new Promise<any>((done) => { session.done = (done as () => void); });
  session.promise = paginate(document, {
    relaxDpr,
    composed,
    compositionCache,
    forcingMemo: first ? null : forcingMemo,
    blocks,
    running,
    originals: [...blocks, ...fixed, ...running.map((r) => r.el)],
    table,
    ...(wanted ? { prior: wanted.result, dirtyAt: (resumeAt as Address), edited: edited.slice(0, session.taken) } : {}),
    // Only a run that can be stopped is paced: the straight run is the one it always was.
    ...(target != null ? { pace: (progress) => pacer(session, progress) } : {})
  });
  live = session;
  if (released) session.cancelled = true; // called before the release, so the first page it cuts is its last
  return settle(session, t0);
}

async function carryOn(session: Session, until: number|Element|null, t0: number) {
  session.target = until;
  if (reached(session)) return (handle.last as Awaited<ReturnType<typeof run>>); // already cut as far as it is asked
  dress(false);
  (presented as NonNullable<typeof presented>).root.hold();
  const settled = settle(session, t0);
  const gate = session.gate;
  session.gate = null;
  gate?.();
  return settled;
}

/** Wait for the run to stop at a page or to end, and show what it has: the pages cut since the last presentation if it stopped, the rest of the document and the total if it ended. */
async function settle(session: Session, t0: number) {
  let outcome;
  try {
    outcome = await new Promise<any>((resolve, reject) => {
      session.stopped = () => resolve({ stopped: true });
      session.promise.then((result) => resolve({ result }), reject);
    });
  } catch (error) {
    if (live === session) live = null;
    if (error === LET_GO && released && !session.partial && session.fresh) presented?.undo(); // a first run released before it showed a page
    if (error !== LET_GO) {
      forcingMemo.clear(); // a run that threw filled it with reads no one vouched for
      if (!session.partial && session.fresh) presented?.undo(); // the document goes back as it was, and the host says so truthfully
      else {
        dress(true); // a refused re-run leaves the frame as it found it: presented, and dressed
        presented?.root.release();
      }
    }
    session.done();
    throw error;
  }
  const progress = (session.progress as Progress);

  if (outcome.stopped) {
    // Stopped at a page: the pages cut since the last presentation are shown, without a total, and the run stays where it is.
    const k = progress.pages;
    const from = session.shown;
    const resumed = session.partial || !session.wanted ? null : progress.resumed;
    const prior = session.wanted;
    const resume = resumed && prior ? { from: resumed.from - 1, to: resumed.to - 1, oldTo: resumed.converged ? resumed.to - 1 - resumed.shift : prior.account.length - 1, priorLength: prior.account.length } : session.partial ? { from, to: k - 1, oldTo: from - 1, priorLength: from } : null;
    show(session, { account: progress.account, index: progress.index, total: null, from: resume ? resume.from : 0, to: k - 1, resume });
    session.partial = true;
    const conditions = conditionsKey(document, session.epoch);
    previous = { result: progress.snapshot(), composed: session.composed, conditions };
    edited.splice(0, session.taken);
    session.taken = 0;
    compositionCache.conditions = conditions;
    handle.last = { ...answerOf(session, t0, progress, resumed), complete: false };
    handle.ledger = progress.account;
    console.info(`BelType/Cicero: ${k} pages cut so far, in ${Math.round(performance.now() - t0)} ms — the run is stopped at a page and goes on when asked`);
    await reloadKnownFaces(); // the presentation re-created a layered frame's faces, and the next slice measures in them
    return handle.last;
  }

  // Complete: the run reached the document's end.
  const result0 = outcome.result;
  const { account, wordCounts } = result0;
  performance.measure('cicero:paginate', { start: t0, end: performance.now(), detail: { pages: account.length } });
  const resumed = result0.resumed;
  const shown = session.shown;
  /** The pages the presentation replaces or adds: where the run showed pages of its own, from the first whose cut differs from the one the root shows (the pages after the last shown are added, and a document cut again whole is replaced from where its cut moved); where it did not, the resumed run's own range. */
  const d = session.partial ? firstDifference(session.shownRows, shown, account) : 0;
  const resume = session.partial
    ? { from: d, to: account.length - 1, oldTo: shown - 1, priorLength: shown }
    : resumed && session.wanted ? { from: resumed.from - 1, to: resumed.to - 1, oldTo: resumed.converged ? resumed.to - 1 - resumed.shift : session.wanted.account.length - 1, priorLength: session.wanted.account.length } : null;
  show(session, { account, index: result0.index, total: account.length, from: resume ? resume.from : 0, to: resume ? resume.to : account.length - 1, resume });

  const ms = Math.round(performance.now() - t0);
  const words = wordCounts ? wordCounts.reduce(( a: number,  b: number) => a + b, 0) : null;
  const why = resumed ? null : session.refusal ?? result0.why ?? null;
  console.info(`BelType/Cicero: ${account.length} pages in ${ms} ms${words == null ? '' : ` (${words} flow words accounted)`}${session.composed ? ' — composed: the Compositor chose the lines' : ''}${session.resumeAt && why ? ` — a whole run, not a resume: ${why}` : ''}`);
  const conditions = conditionsKey(document, session.epoch);
  const result = {
    pages: account.length,
    ms,
    composed: session.composed,
    complete: true,
    resumed: resumed ? { from: resumed.from, to: resumed.to, shift: resumed.shift, converged: resumed.converged, kept: resumed.kept } : null,
    why,
    composition: session.composed ? { blocks: compositionCache.hits + compositionCache.misses, hits: compositionCache.hits, misses: compositionCache.misses, laid: compositionCache.laid } : null
  };
  previous = { result: result0, composed: session.composed, conditions };
  edited.splice(0, session.taken);
  session.taken = 0;
  compositionCache.conditions = conditions; // the reading after the presentation, which is the one the next call sees (the first call's was taken before there was any litter to leave out)
  // A host embedding this document (the editing tools' preview iframe, same-origin) reads its own render condition here rather than the devtools console nobody opens — set before returning, on the same handle the bootstrap already holds.
  handle.last = result;
  // The run's Ledger itself, beside the summary and not inside it: `last` is read across frames and serialised by hosts, and the account holds live `box` pointers that no host should be handed by accident. A venue test reads it in-page to compare two runs entry by entry (*the run resumes from an entry*).
  handle.ledger = account;
  if (live === session) live = null;
  // The presentation re-created a layered frame's faces, and a host reads the pages next: their loads are STARTED here and not awaited, so they are `loading` (and `document.fonts.ready` waits for them) by the time the call answers. Awaiting them put a task between the presentation and the answer, and a host that puts the caret back when the run answers (the studio experiment) lost a keystroke typed in that gap: the browser had no caret to type at, and fired no beforeinput.
  void reloadKnownFaces();
  session.done();
  return result;
}

/** What a stop reports. */
function answerOf(session: Session, t0: number, progress: Progress, resumed: any) {
  return {
    pages: progress.pages,
    ms: Math.round(performance.now() - t0),
    composed: session.composed,
    resumed: resumed ? { from: resumed.from, to: resumed.to, shift: resumed.shift, converged: resumed.converged, kept: resumed.kept } : null,
    why: resumed ? null : session.refusal ?? null,
    composition: session.composed ? { blocks: compositionCache.hits + compositionCache.misses, hits: compositionCache.hits, misses: compositionCache.misses, laid: compositionCache.laid } : null
  };
}

// The shell's bootstrap reaches the engine through this handle. Setting it is the module's only load-time effect — rendering waits to be asked, because the bootstrap knows when the document has stopped changing and this module does not. `pageOf` is seated by `run()` rather than here: before a presentation there is no page to answer, and a stub that answered `null` for that reason would be indistinguishable from the refusals that mean something.
// `compositionCache` is the harness's door and the product's none: a venue test clears it to ask for a cold composition in a frame that has composed before, which is the only way a resumed run can be compared with a fresh one that did not borrow its records.
// `forcingMemo` and `forgetJudgedSheets` are the same kind of door, for the same comparison: a venue test empties them to ask what a run costs, and what it cuts, when it borrows nothing from the runs before it (*the forced-break index is kept across runs*).
// `present` is the host's say over what a copy of an element is (*a copy may be presented*, `src/presenters.js`): `present(selector, make)`, registered before the first run. One registered after a run changes the conditions key, so the next call is a whole run on a presented frame — nothing a presenter touched is reused — and a run stopped at a page goes on under the presenters it began with, its pages already built keeping the elements they were built with.
// `measured` is the same kind of door again (*a box announces its own size*): a venue test asks what height the last run measured for a top-level box, the number the `size` kind compares a presented box's observed size with.
// `table` is the geometry the intake captured from the author's `@page` rules, margin boxes and their `content` included, or null before an intake: the root clears every margin box's `content` from the CSSOM when it presents, so a second host in the same document, whose pages are not the root's, cannot read a table of its own from the sheets and takes this one (see CHANGELOG 2026-10-28).
/**
 * Let go of everything this client registered in the page, so a document that replaces it (`document.open()` keeps the `Window`, its `FontFaceSet` and its listeners) is not answered by this one's.
 *
 * It removes the `loadingdone` listener, stops the rim, drops the batch of late truth waiting to be answered and deletes the handle from the window, all before the first `await`. A run stopped at a page is let go and its pages stay on screen. A run under way with a pace (`until`) rejects with the let-go error at its next page, and a first run that has shown nothing puts the document back as it found it; one without a pace finishes and presents. When nothing is under way, the promise resolves, after the root's idle build, observer and window listeners and the facsimile's observer have been let go. A `run()` made afterwards is rejected by name. Calling it again is a no-op.
 *
 * @remarks **Host obligations.** The custom-element registry belongs to the window and is not released: the next document's `<beltype-root>`, `<beltype-page>` and PDF element are built from the classes this module defined, which keep no state about the document they were defined for. The handle is gone, and the next client module runs only under a URL the window has not imported (measured 2026-11-03: the same URL after `document.open()` does not run again, a keyed one does, and a second `customElements.define` of a name throws, which the three definitions guard against). The host keys the URL.
 * @see SPEC.md Article XII.7
 */
export async function release(): Promise<void> {
  if (released) return;
  released = true;
  fonts.removeEventListener('loadingdone', countFaces);
  stopRim();
  batch = null;
  if (window.__beltypeCicero === handle) delete (window as Partial<Window>).__beltypeCicero;
  await Promise.allSettled([...calls]); // a call made before the release has no session yet: it gets one, cancelled, in `runOnce`
  if (live) await letGo();
  stopRim(); // the intake of a call that was under way made one after the first stop
  presented?.root.dispose(); // last, so a presentation that finished above does not arm what it just let go
  facsimile?.dispose();
}

/** THE HANDLE — `window.__beltypeCicero`, the host's one door onto the engine in the page. The calls are set at load; the doors onto the presentation are seated by every presentation ({@link seatDoors}), so they are absent before the first; `last` and `ledger` are the last run's. */
export type Handle = {
  run: typeof run;
  present: typeof present;
  settled: typeof settled;
  compositionCache: CompositionCache;
  forcingMemo: ForcingMemo;
  forgetJudgedSheets: () => void;
  measured: (el: Element) => number | undefined;
  table: ReturnType<typeof readGeometryTable> | null;
  /** The last call's answer. */
  last?: Awaited<ReturnType<typeof run>>;
  /** The last run's account. */
  ledger?: any[];
  pageOf?: BeltypeRoot['pageOf'];
  reveal?: BeltypeRoot['reveal'];
  buildPage?: BeltypeRoot['buildPage'];
  buildAll?: () => Promise<Awaited<ReturnType<BeltypeRoot['buildAll']>>>;
  built?: BeltypeRoot['built'];
  sourceOf?: BeltypeRoot['sourceOf'];
  sourcePoint?: BeltypeRoot['sourcePoint'];
  pointOn?: BeltypeRoot['pointOn'];
  addressOf?: (el: Element, word?: number) => Address | null;
  box?: (i: number) => Element | null;
  patch?: typeof patchBox;
  release: typeof release;
};
const handle: Handle = { run, present, release,
 settled, compositionCache, forcingMemo, forgetJudgedSheets: () => { judgedSheets = new WeakMap<any, any>(); }, measured: (el) => previous?.result.heights?.get(el), get table() { return presented?.table ?? null; } };
window.__beltypeCicero = handle;
