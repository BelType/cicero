/**
 * THE RIM — the system's edge, where a fact the engine measured before it was true announces that it is (*late truth is an edit*, 2026-10-13; `.claude/decisions/cicero/late-truth-is-an-edit.md`, Decisions three and four; *a box announces its own size*, 2026-10-21; `.claude/decisions/cicero/a-box-announces-its-own-size.md`).
 *
 * It listens on the top-level boxes the intake took, and on nothing else: an `<img>` inside one (`load` and `error`, caught in the capture phase because they do not bubble: a picture still pending at intake, which the first run no longer waits for, and a picture whose `src` changes later are the same event), a custom element whose name is not yet defined (`customElements.whenDefined`, then one animation frame for its `connectedCallback` to have run), and `document.fonts` (`loadingdone`, a fact about the conditions and so about no box).
 *
 * **And the one cause that needs no name: a box's own size.** One `ResizeObserver` over the same boxes reports each one's border box; the report is read only while the box is drawn as itself on a page (the root's `isPresented`, and a reading above zero, since a parked box and a box on a page the browser skips read zero), and it is news only where it stands more than a quarter pixel from the height the last run measured for that box (the driver's table, which the client hands in as `measured`). The ear never measures: the observation is a trigger, and the resume measures. It is never paused; what it hears while a run is called or under way is judged when the runs have ended, against the table they leave, which is what keeps the engine's own presentations silent with no flag on its writes.
 *
 * **And the pieces a built page draws a block through** (*a fragment announces its own size*, 2026-10-22; `.claude/decisions/cicero/a-fragment-announces-its-own-size.md`). A divided block's original is parked, and so is a composed block's and one holding a nested fixed box, so the root names to the rim, through the client, every piece it slots into a built page's flow and every node a presentation takes out (`pieces`), and the same observer watches each from the frame it is built in. **A piece's expected height is its first reading above zero**, the presentation's own; a later reading more than the quarter pixel from it, judged under the same gate as an original's, is a `size` signal naming the piece's source box, the page the piece stands on beside it. The engine's own rebuild of a page makes new pieces with new first readings, so its writes pass with no flag. **Its limits**: a change of the original's tree after the copy was taken reaches no piece and is heard by nothing; a box on a page far from the reader is heard when the page comes near (the hearing probe, P40e), and a piece on a page never yet near has read nothing, so a change made before then, like one landing in the presentation's own frame, is its first reading and passes; and a reflow that keeps a box's height and moves its cut passes unheard, since a cut is a word address and the gate a height.
 *
 * **A picture is news only where its arrival changed its box** (amended 2026-11-08, on Egildo's ruling of that day). A `load` or an `error` is judged when the runs have ended, as a size is: where the box is drawn as itself and the observer's last reading of it stands within the quarter pixel of the height the last run measured, the picture moved nothing and is no signal, which is what an image that declares its `width` and `height` gives; where the observer has read the box as nothing (a page the browser skips), the box's own `offsetHeight` is read instead. A box not drawn as itself while some page is not built is judged again when the observer next reports, since it may stand on that page. Where the reading differs, or the box is not drawn as itself once every page is built (parked, drawn through pieces) or was never measured whole, the rim cannot compare, and the picture is an `image` signal as before. A reading taken before the arrival was laid out passes, and the observer's own `size` hears the box a frame later.
 *
 * **Every signal is one cancelable `beltype:change` on the document**, `detail: { kind, boxes }` with `kind` one of `image`, `element`, `font`, `size` and `boxes` the top-level boxes in document order (empty for a font); a `size` adds `pages`, beside each box the page it was heard on through a piece, or `null` where it was heard as itself. The same name is the one the live-values store dispatches for its writes (`kind: 'store'`, stage 2): the engine learns one name for every late truth and the host cancels one event to own the pace. A host that calls `preventDefault()` has taken it; otherwise `onSignal` runs with the same detail, and the client answers with the resumable run. **The default action is the engine's for an event the rim did not dispatch as well** (the amendment of 2026-10-13): the store's write (`kind: 'store'`) is dispatched by the host's module, which writes its fields synchronously when the dispatch returns un-cancelled, so the rim waits one animation frame and then, if nobody took the pace, hands `{ kind, boxes }` to the same `onSignal`.
 *
 * This module knows no run: it hears, tells, and hands the default action back. The `originals` array is the client's own and is read live — `patch` replaces an entry in it — so a box that left it is never named.
 *
 * @packageDocumentation
 */

/** One animation frame, with the timer that stands in when the frame never comes (a hidden view throttles `requestAnimationFrame` toward zero). */
export const frame = () => new Promise<any>((resolve) => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(undefined); } };
  requestAnimationFrame(go);
  setTimeout(go, 100);
});

/** How far an observed border-box height may stand from the measured one and still be the same: the engine's own quarter pixel, the one the driver's comparisons of a height with the page area allow. */
export const TOLERANCE = 0.25;

/** The faces the document has been told about — loaded before the engine's module ran, or announced by a `loadingdone` since — by what they say about themselves (a descriptor key). */
const announced = new Set<any>();
const keyOf = (f: FontFace&{ variant?: string; }) => [f.family, f.style, f.weight, f.stretch, f.unicodeRange, f.variant, f.featureSettings].join('|');

/** Has a face with this one's descriptor been loaded in this document before? (A face Chromium re-created for a rule it already had: see {@link bringsNewFace}.) */
export const isKnownFace = (f: FontFace) => announced.has(keyOf(f));

/** Take note of the faces already loaded when the engine's module runs: their `loadingdone` came before anyone was listening, and the run that follows measures with them in. */
export function knowLoadedFaces(fonts: FontFaceSet) {
  for (const f of fonts) if (f.status === 'loaded') announced.add(keyOf(f));
}
/** The events the rim dispatched itself, so its listener for everyone else's does not answer them twice. */
const own: WeakSet<Event> = new WeakSet<any>();
/** One verdict per event: the engine's two listeners (the client's epoch and the rim's signal) must agree, and the second to ask must not find the first has already used the news up. */
const verdicts: WeakMap<Event,boolean> = new WeakMap<any, any>();

/**
 * Whether a `loadingdone` brings a face the document has not been told about — the difference between a fact and the browser re-creating one.
 *
 * @remarks Measured 2026-10-13: Chromium rebuilds the `FontFace` objects of the document's own `@font-face` rules whenever the active stylesheets change by anything but an append, and the engine's presentation removes and re-adds its press `<style>` on every run. The rebuilt face loads again from the memory cache and fires `loadingdone` with a face that has the same family, style, weight, stretch and range as the one the document already had, so a document with a webfont used in a margin box re-ran itself forever (361 runs in six seconds). A face is news the first time its descriptor is seen; the conditions a run is valid under are unchanged by a face that says what an old one said (a changed `src` is a changed stylesheet, and the stylesheets' text is already in the run's key). An event that names no face is treated as news.
 *
 * @param event - a `FontFaceSetLoadEvent`.
 */
export function bringsNewFace(event: Event): boolean {
  let verdict = verdicts.get(event);
  if (verdict === undefined) {
    const faces = ([...(event as FontFaceSetLoadEvent).fontfaces ?? []] as FontFace[]);
    verdict = faces.length === 0;
    for (const f of faces) {
      const key = keyOf(f);
      if (!announced.has(key)) { announced.add(key); verdict = true; }
    }
    verdicts.set(event, verdict);
  }
  return verdict;
}

/**
 * @param p.fonts - the document's face set; asked of the document when the caller did not keep it.
 * @param p.originals - the document's top-level boxes in the document's own order, read live.
 * @param p.onSignal - the default action: called for a signal the host did not cancel.
 * @param p.presented - is the box drawn as itself on a built page (`root.js`' `isPresented`)? Absent, no box is, and the `size` kind hears no original.
 * @param p.pageHolding - the page a piece is slotted into (`root.js`' `pageHolding`), asked when a piece is judged changed.
 * @param p.measured - the box's border-box height as the last run measured it, or undefined where it did not.
 * @param p.idle - resolves when no run is under way and nothing the rim told is still being answered: a size is judged then, against the table the run leaves.
 * @param p.unbuilt - whether some page of the presentation is not built yet: a picture's box that is not drawn as itself may stand on it, and is judged again when the observer next reports. Absent, every page is built.
 * @param p.busy - whether a run is under way or a signal is being answered now: asked again just before a size is judged, since a named signal may have come while the ear waited for the frame.
 * @returns `add` subscribes to a box, releasing what the box it replaced (a patched edit) and the box itself already held, so one load is one signal; `pieces` observes the pieces a page was just built with, each beside its source box, and lets go of the ones a presentation took out; `judging` says whether a size or a picture was heard and not yet judged; `stop` releases everything.
 */
export function watchLateTruth({ document: doc, fonts = doc.fonts, originals, onSignal, presented = () => false, pageHolding = () => null, measured = () => undefined, idle = async () => {}, busy = () => false, unbuilt = () => false }: { document: Document; fonts?: FontFaceSet; originals: Element[]; onSignal: (detail: { kind: 'image'|'element'|'font'|'size'|'store'; boxes: Element[]; pages?: Array<number|null>; }) => void; presented?: (box: Element) => boolean; pageHolding?: (piece: Element) => number|null; measured?: (box: Element) => number|undefined; idle?: () => Promise<void>; busy?: () => boolean; unbuilt?: () => boolean; }): { stop: () => void; judging: () => boolean; add: (box: Element,replaced?: Element) => void; pieces: (built: Array<[Element,Element]>,removed: Iterable<Element>) => void; } {
  const win = (doc.defaultView as Window & typeof globalThis);
  let stopped = false;
  /** What each box's listeners hand back. */
  const held: Map<Element,() => void> = new Map<any, any>();
  const releases: Array<() => void> = [];
  /** Undefined element names being waited on → the boxes that hold one. */
  const waiting: Map<string,Set<Element>> = new Map<any, any>();

  /** The `size` kind (*a box announces its own size*, 2026-10-21): one observer over the boxes, never paused. An observation is a trigger and never a measure: the block size it reports is kept only where the box was drawn as itself when the browser laid it out, and judged once the runs have ended and the frame after them has been laid out — a box no page renders reads zero and is spent unread, and a box whose size is the one the last run measured, within {@link TOLERANCE}, is not news, which is what keeps the engine's own presentations silent. */
  const heard: Map<Element,number> = new Map<any, any>();
  /** The pieces a built page draws its blocks through (*a fragment announces its own size*, 2026-10-22): each one's source box and its expected height, which is the first reading above zero the observer reports for it — the presentation's own, since the feed has no number for a constructed first fragment or a two-cut fragment and a second arithmetic for the others is the fork the account ruling forbids. Zero until that reading; an entry leaves with its piece. */
  const pieces: Map<Element,{ source: Element; expected: number; }> = new Map<any, any>();
  /** Each original's last border-box height as the observer reported it, zero included: what a picture's arrival is judged by. */
  const latest: WeakMap<Element,number> = new WeakMap<any, any>();
  /** The boxes a picture loaded or failed in since the last judgment. */
  const loaded: Set<Element> = new Set<any>();
  /**
   * What a picture's arrival in a box is: `same` where the box is drawn as itself at the height the last run measured for it, `later` where it is not drawn as itself while some page is not built (it may stand on that page, and is judged again when the observer next reports), and `moved` otherwise, which is also every box the rim cannot compare.
   *
   * @remarks The height is the observer's last reading, within {@link TOLERANCE}. Where the observer has read nothing above zero (a box on a page the browser skips reads zero, and a box parked when it was observed is never reported until it is laid out), the box is asked its `offsetHeight`, which lays out that one box and rounds to the whole pixel, so the gate there is half a pixel wider.
   */
  const verdict = (box: Element): 'same'|'later'|'moved' => {
    if (!presented(box)) return unbuilt() ? 'later' : 'moved';
    const was = measured(box);
    if (was === undefined) return 'moved';
    const now = latest.get(box);
    if (now) return Math.abs(now - was) <= TOLERANCE ? 'same' : 'moved';
    return box instanceof win.HTMLElement && Math.abs(box.offsetHeight - was) <= 0.5 + TOLERANCE ? 'same' : 'moved';
  };
  let judging = false;
  const observer = new win.ResizeObserver((entries) => {
    const t = performance.now();
    for (const e of entries) {
      const size = e.borderBoxSize[0].blockSize;
      const piece = pieces.get(e.target);
      if (piece) {
        // A piece reads zero where its page is skipped, as an original does; its first reading above zero is what the presentation gave it, and only a later one is news.
        if (size > 0 && piece.expected > 0) heard.set(e.target, size);
        else heard.delete(e.target);
        if (size > 0 && piece.expected === 0) piece.expected = size;
        continue;
      }
      latest.set(e.target, size);
      // Zero is what a box no page renders reads: a parked one, and one slotted into a page whose content the browser skips (`content-visibility: auto` on a page not yet near the reader — measured 2026-10-21: a page shown by a run stopped at it reads zero for one frame). It is not news; a box that comes into view reads again.
      if (size > 0 && presented(e.target)) heard.set(e.target, size);
      else heard.delete(e.target);
    }
    // The run keeps time (*the run keeps time*, 2026-09-25), and so does the ear: inert unless a host reads the measures.
    performance.measure('cicero:size-heard', { start: t, end: performance.now(), detail: { entries: entries.length, kept: heard.size } });
    judge();
  });

  /** Judge what was heard, sizes and pictures, once the runs have ended. */
  function judge() {
    if (judging || (heard.size === 0 && loaded.size === 0)) return;
    judging = true;
    // A frame to gather the batch; the runs' end; then the frame after it and the task after that frame, so the observer has reported what the last presentation left before anything is judged — and again while a run or an answer began in the meantime (the battery's parallel suite once heard a size beside an element and a face that the named signals were about to answer, 2026-10-22).
    const settle = async () => {
      await frame();
      do {
        await idle();
        await frame();
        await new Promise<any>((resolve) => setTimeout(resolve));
      } while (busy());
    };
    settle().then(() => {
      judging = false;
      const t = performance.now();
      const n = heard.size;
      /** The boxes that moved → the page a moved piece of each stands on, the earliest, or null for a box heard as itself. */
      const moved: Map<Element,number|null> = new Map<any, any>();
      for (const [el, size] of heard) {
        const piece = pieces.get(el);
        if (piece) {
          if (Math.abs(size - piece.expected) <= TOLERANCE) continue;
          const page = pageHolding(el);
          if (page === null) continue; // a piece no page holds any more is not news
          const was = moved.get(piece.source);
          moved.set(piece.source, was === undefined ? page : was === null ? null : Math.min(was, page));
          continue;
        }
        const expected = measured(el);
        if (presented(el) && expected !== undefined && Math.abs(size - expected) > TOLERANCE) moved.set(el, null);
      }
      heard.clear();
      const pictures = loaded.size;
      const late = [];
      for (const box of loaded) {
        const v = verdict(box);
        if (v !== 'later') loaded.delete(box);
        if (v === 'moved') late.push(box);
      }
      performance.measure('cicero:size-judged', { start: t, end: performance.now(), detail: { heard: n, moved: moved.size, pictures, late: late.length, later: loaded.size } });
      for (const box of late) moved.delete(box);
      if (late.length) signal('image', late);
      if (moved.size) signal('size', moved.keys(), moved);
    });
  }

  /**
   * @param [pageOf] - a size's: the page each box was heard on through a piece, or null where it was heard as itself.
   */
  function signal(kind: 'image'|'element'|'font'|'size', ofBoxes: Iterable<Element>, pageOf?: Map<Element,number|null>) {
    if (stopped) return;
    const named = new Set(ofBoxes);
    const boxes = originals.filter((box) => named.has(box));
    if (kind !== 'font' && boxes.length === 0) return; // every box it named has left the document
    const detail = pageOf ? { kind, boxes, pages: boxes.map((box) => pageOf.get(box) ?? null) } : { kind, boxes };
    const event = new win.CustomEvent('beltype:change', { bubbles: true, cancelable: true, detail });
    own.add(event);
    if (doc.dispatchEvent(event)) onSignal(detail);
  }

  /**
   * @param [replaced]
   */
  function add(box: Element, replaced?: Element) {
    for (const gone of [replaced, box]) if (gone) { held.get(gone)?.(); held.delete(gone); }
    observer.observe(box, { box: 'border-box' });
    // `load` and `error` do not bubble, so one capturing listener per box hears every picture inside it: the ones pending now, the intake waiting for none since 2026-11-08, and the ones whose `src` changes later, which a listener on the pending alone would miss. Heard, and judged with the sizes: only an arrival that changed the box is a signal.
    const arrived = ( e: Event) => { if (!stopped && (e.target as Element).localName === 'img') { loaded.add(box); judge(); } };
    box.addEventListener('load', arrived, true);
    box.addEventListener('error', arrived, true);
    held.set(box, () => { box.removeEventListener('load', arrived, true); box.removeEventListener('error', arrived, true); observer.unobserve(box); loaded.delete(box); });
    for (const el of [box, ...box.querySelectorAll('*')]) {
      const name = el.localName;
      if (!name.includes('-') || win.customElements.get(name)) continue;
      const sharing = waiting.get(name);
      if (sharing) { sharing.add(box); continue; }
      waiting.set(name, new Set([box]));
      win.customElements.whenDefined(name).then(() => frame()).then(() => {
        const boxes = waiting.get(name);
        waiting.delete(name);
        if (boxes) signal('element', boxes);
      }, () => waiting.delete(name)); // a name the platform refuses to wait on is not a late element
    }
  }

  for (const box of originals) add(box);
  releases.push(() => observer.disconnect());
  const fontsDone = ( event: Event) => { if (bringsNewFace(event)) signal('font', []); };
  fonts.addEventListener('loadingdone', fontsDone);
  releases.push(() => fonts.removeEventListener('loadingdone', fontsDone));

  // An event someone else dispatched (the store's write, `kind: 'store'`) has the same default action, one frame later: the module that dispatched it writes its fields when `dispatchEvent` returns un-cancelled, and the frame is what lets that write come first. A box that is not one of the originals (a nested element, one that left the document) is not named.
  const foreign = ( event: Event) => {
    if (own.has(event)) return;
    const { kind, boxes: named } = (event as CustomEvent<{ kind?: 'image' | 'element' | 'font' | 'size' | 'store', boxes?: unknown }>).detail ?? {};

    if (typeof kind !== 'string') return;
    frame().then(() => {
      if (stopped || event.defaultPrevented) return;
      const boxes = originals.filter((box) => Array.isArray(named) && named.includes(box));
      if (boxes.length > 0 || kind === 'font') onSignal({ kind, boxes });

    });
  };
  doc.addEventListener('beltype:change', foreign);
  releases.push(() => doc.removeEventListener('beltype:change', foreign));

  return {
    add,
    /** Is a size or a picture heard and not yet judged? The client's `settled` waits for it. */
    judging: () => judging,
    pieces(built, removed) {
      for (const el of removed) {
        if (!pieces.delete(el)) continue;
        observer.unobserve(el);
        heard.delete(el);
      }
      for (const [el, source] of built) {
        pieces.set(el, { source, expected: 0 });
        observer.observe(el, { box: 'border-box' });
      }
    },
    stop() {
      stopped = true;
      for (const release of [...held.values(), ...releases.splice(0)]) release();
      held.clear();
    }
  };
}
