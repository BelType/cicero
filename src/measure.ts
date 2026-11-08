/**
 * The measure pass (first-coding-round.md, item 2): a hidden measurement container at true content width, off-viewport, one block flow, shared by every page of one geometry. The Chase is not in it and does not measure. Geometry comes from clones laid out here; law (break-* constraints, orphans, widows) is read from the source elements in the live document, so neutralization below never blinds legality reading.
 *
 * *Render-identical conditions* (I5) are pinned here: they are asserted at intake (unit DPR, explicit line-height — the DPR ruling), fonts are awaited once before the first measure, and native break properties plus orphans/widows are neutralized in the measure context. They are inert in an unfragmented column anyway — neutralization is stated, not assumed.
 *
 * The first run no longer awaits the document's images (ruled 2026-11-08): it makes them eager ({@link eagerImages}), and the rim answers an arrival that changed a box. A measured slice's own images are still awaited ({@link awaitCloneImages}).
 *
 * @packageDocumentation
 */

/** The measurement context {@link createMeasureContext} hands back: the hidden container, the one act that lays a feed out in it, and its removal. */
export type MeasureContext = ReturnType<typeof createMeasureContext>;

import { ensureDressing } from './dressing.ts';

const CONTAINER_ID = '__beltype-measure';
/** The style text last written to a measure container, so a context can tell whether another context changed it since. */
const APPLIED = new WeakMap<any, any>();
const NEUTRALIZE_ID = '__beltype-neutralize';

/**
 * The intake under *render-identical conditions* (I5): refuse to adjudicate under conditions print will not reproduce. `relaxDpr` is the preview's escape hatch only — decisions are then valid for the screen being looked at, not for print; no gate ever sets it.
 *
 * A vertical or sideways root is refused by name too (Codeberg issue 12): every read in this engine is horizontal, the lines by vertical overlap, the cut by a y, the page area by its height, so under `writing-mode: sideways-lr` on the root the text of a positioned paragraph fell below the clip and was never resumed, and the printer's tiling invariant refused what the engine should have. Vertical writing is outside the beta, and a refusal that says so at intake is cheaper than one three tools later.
 *
 * A right-to-left root or body (`direction: rtl`) is refused by name as well, as out of scope (SPEC II.1, item 6); a vertical box below the root is refused by `readScope` (`src/scope.ts`).
 *
 * @throws Error — bare and deliberate (`src/` may not import BelType's error types): a device pixel ratio other than 1 without `relaxDpr`, a document root whose line-height is not explicit (*render-identical conditions*, I5), a document root whose writing mode is not `horizontal-tb`, or a root or body that computes `direction: rtl`.
 */
export function assertRenderConditions(doc: Document, { relaxDpr = false }: { relaxDpr?: boolean; } = {}) {
  const win = (doc.defaultView as Window & typeof globalThis);
  if (!relaxDpr && win.devicePixelRatio !== 1) {
    throw new Error(`I5: unit device pixel ratio required for adjudication, got ${win.devicePixelRatio}`);
  }
  const root = win.getComputedStyle(doc.documentElement);
  const lh = root.lineHeight;
  if (!/^-?[\d.]+px$/.test(lh)) {
    throw new Error(`I5 (DPR ruling): explicit line-height required, document root computes '${lh}'`);
  }
  const rtl = [root, doc.body ? win.getComputedStyle(doc.body) : null].find((st) => st?.direction === 'rtl');
  if (rtl) {
    throw new Error(`right-to-left text is outside this engine's scope: the document computes direction 'rtl' on its ${rtl === root ? 'root' : 'body'}, and every read here is left to right (the line's start edge, the hanging of a margin, the page's left and right). Write the document ltr, or print it with another engine.`);
  }
  if (root.writingMode && root.writingMode !== 'horizontal-tb') {
    throw new Error(`a vertical or sideways root is outside this engine's beta: the document root computes writing-mode '${root.writingMode}', and every read here is horizontal (the line by vertical overlap, the cut by a y). Write the document horizontal-tb, or print it with another engine.`);
  }
}

/**
 * Await font readiness once — late-arriving truth handled before the first measure, never during adjudication.
 *
 * @remarks `faces` is font preloading by its platform name, `FontFaceSet.load()`: the faces the `@page` margin boxes name ({@link readGeometryTable}'s `furnitureFaces`). Text in a margin box is laid out after the cuts, so a face only page furniture uses would otherwise be requested then, and its `loadingdone` would cost one more whole run. Only the faces asked for are fetched, never every declared face.
 *
 * @param faces - `FontFaceSet.load()` arguments, awaited beside `fonts.ready`.
 */
export async function awaitFonts(doc: Document, faces: string[] = []) {
  // Font preloading (`FontFaceSet.load()`): a face is otherwise requested only when laid-out text uses it. A refused or failed load is the face being requested the old way, later, and not an error here.
  await Promise.all(faces.map((face) => doc.fonts.load(face).catch(() => [])));
  await doc.fonts.ready;
}

/** The `<img>` elements of a scope: a Document answers `images`; an element is asked for its own; a list of elements (the intake's top-level boxes) is asked box by box, each box included. */
const imagesOf = (scope: Document|Element|Element[]): Iterable<HTMLImageElement> => Array.isArray(scope)
  ? scope.flatMap((el) => (el.localName === 'img' ? [(el as HTMLImageElement)] : [...el.querySelectorAll('img')]))
  : (scope as Document).images ?? scope.querySelectorAll('img');

/**
 * Make every `loading="lazy"` image eager, and wait for none: what the first run does with the document's pictures since 2026-11-08.
 *
 * @remarks Egildo ruled on 2026-11-08 that the intake's and the driver's first-run awaits are retired, on the measurement `.claude/plans/quick-rulings-2026-11-08/image-await.md` in the monorepo: on a 59-page document with 60 images served 300 to 800 ms late, the first paint fell from 5.8 s to 0.74 s, the final layout was the same, and with declared sizes nothing moved on arrival. A picture measured before it arrived is late truth, and the rim answers it (`seam/rim.js`, *late truth is an edit*, amended 2026-11-08): one resume where its arrival changed its box, none where it did not. So the fast first paint is the author's to give: an image that declares its `width` and `height` is measured at its size before a byte of it arrives.
 *
 * **A lazy image is still made eager** (*late truth is an edit*, 2026-10-13). Measured that day: a lazy image with no box never issues its request, and a parked original has no box, so it was measured at zero and never revisited. Lazy loading optimises for a viewport, and print has no viewport: there is nothing for it to save, and *the source document is never written* (C5) is untouched because the attribute is set on the original's `loading` property, which is a request for the bytes and not a change to what the document says. The clones the measure container receives copy the attribute, so they are eager too.
 *
 * **It reads the originals and never the copies** (2026-10-08). A presented document carries a clone of every box on every page, and `document.images` met each picture once per copy (19 468 images for 157 real ones on a 123-page manual). A host that has presented hands the top-level boxes it took at intake; a first run has no copies and is handed the document.
 *
 * @param scope - as {@link awaitImages}'s.
 * @returns how many images were looked at, which the run's timing reads and nothing that decides does.
 */
export function eagerImages(scope: Document|Element|Element[]): number {
  let seen = 0;
  for (const img of imagesOf(scope)) {
    seen++;
    if (!img.complete && img.loading === 'lazy') img.loading = 'eager'; // setting it starts the request a lazy image never made
  }
  return seen;
}

/**
 * Await every image in a scope that has not settled, a lazy one made eager first as {@link eagerImages} makes it. Since 2026-11-08 its one caller in the engine is {@link awaitCloneImages}: the first run no longer waits for the document's pictures (*images are awaited at intake*, retired that day for the first run).
 *
 * A failed load settles at its error size: the wait resolves on `error` as it resolves on `load`, because what adjudication needs is that the geometry has stopped changing, not that it is the one the author wanted. `allSettled` for the same reason — one picture that never arrives must not hold the others.
 *
 * @param scope - a Document answers `images`; an element is asked for its own; a list of elements is asked box by box, each box included.
 * @returns how many images were looked at.
 */
export async function awaitImages(scope: Document|Element|Element[]): Promise<number> {
  const pending = [];
  let seen = 0;
  // A snapshot of a live collection, and no event can fire between the test and the listener: the loop is one synchronous turn.
  for (const img of imagesOf(scope)) {
    seen++;
    if (img.complete) continue;
    if (img.loading === 'lazy') img.loading = 'eager'; // before the listeners: setting it starts the request a lazy image never made
    pending.push(new Promise<any>((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }));
  }
  if (pending.length) await Promise.allSettled(pending);
  return seen;
}

/**
 * The clones' images, awaited where they are measured (2026-09-21, found by the Chromium 153 census). **It stays when the first run's two awaits went (ruled 2026-11-08) until the Service Worker case below is measured without it**: the measurement behind that ruling ran under no worker, and with this await gone too its first paint fell again, from 0.74 s to 0.39 s, and undeclared sizes refilled the pages as each picture came.
 *
 * Until 2026-11-08 `awaitImages(doc)` settled the document's own `<img>` elements first, and the engine measures clones of them, mounted in the measure container. That was sound only on an unstated premise: that a clone of a loaded image is available synchronously — HTML's *list of available images*, which lets a second `<img>` for an already-fetched URL be `complete` the moment it is inserted. Chromium 150 honoured it everywhere. **Chromium 153 does not in a document a Service Worker controls**: measured in the editing tools' pane, every clone answered `complete: false` and a height of 0 in the turn it was mounted, and its real height 300 ms later — so every figure measured nothing, the cuts fell late, and the presentation then clipped what the account believed it had placed (the Caster specimen lost Figure 2 and the drawing after it, on no page at all). The CLI's dev server has no worker and was untouched, which is why the battery did not see it.
 *
 * So the premise is checked instead of assumed: after a mount, if any image in the container has not settled, wait for it and lay out again. It costs nothing where the premise holds, and *a measurement the engine has no way to correct must not be taken early* is already this file's rule.
 *
 * @param container - the measure container, just mounted.
 * @returns whether it waited — read by the run's timing (*the run keeps time*) and by nothing that decides.
 */
export async function awaitCloneImages(container: HTMLElement): Promise<boolean> {
  let unsettled = false;
  for (const img of container.querySelectorAll('img')) if (!img.complete) { unsettled = true; break; }
  if (!unsettled) return false;
  await awaitImages(container);
  void container.offsetHeight;
  return true;
}

/** What a page publishes on its host, as a measure container wears it: the page counters reset (`page N pages T`) and the named strings' custom properties (*the page carries its conditions*, 2026-10-21). */
export type PagePublish = { counterReset: string, props: Record<string, string> };

/** The declarations {@link publishOn} last wrote on a container, so the next call takes them off. */
const PUBLISHED: WeakMap<HTMLElement,string[]> = new WeakMap<any, any>();

/** Write a page's published values on the measure container, and take the previous page's off. */
function publishOn(container: HTMLElement, publish: PagePublish|null) {
  for (const prop of PUBLISHED.get(container) ?? []) container.style.removeProperty(prop);
  const written: string[] = [];
  if (publish) {
    if (publish.counterReset) {
      container.style.counterReset = publish.counterReset;
      written.push('counter-reset');
    }
    for (const [prop, value] of Object.entries(publish.props ?? {})) {
      container.style.setProperty(prop, value);
      written.push(prop);
    }
  }
  PUBLISHED.set(container, written);
}

/**
 * Create the measurement context: a hidden container at true content width in the same document (same stylesheets, same cascade — render-identical by construction), plus the stated neutralization of native fragmentation properties inside it.
 *
 * @param contentWidthPx - the page's true content width — the one geometry decisions are valid under (*render-identical conditions*, I5).
 */
export function createMeasureContext(doc: Document, contentWidthPx: number) {
  ensureDressing(doc); // the words sheet is part of the conditions a feed is measured under: a divided box's truncated margin is the room the cut was decided against
  let style = doc.getElementById(NEUTRALIZE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = NEUTRALIZE_ID;
    // Transforms are neutralized too, since 2026-09-15 (*fragmentation comes first*): css-break-3 §5.5 says fragmentation *"occurs before relative positioning, transforms, and any other graphical effects"*, and the Gauge's only rulers — `getBoundingClientRect` and `Range` rects — are both post-transform. So a box turned four degrees measured as its own rotated bounding box, which reaches lower than its lines do, and the cut fell a line early. Neutralizing here is the same act the break properties get and for the same reason: the measure context exists to answer what the layout is, and this is the one property that makes the browser answer about the paint instead. `rotate`/`scale`/`translate` go with `transform` because they are the same three transformations spelled as independent properties, and `perspective` because it is the transform's own third dimension. The presentation is untouched — the author's transform applies there exactly as written, per fragment, which is §5.5's second sentence.
    style.textContent = `#${CONTAINER_ID}, #${CONTAINER_ID} * { break-before: auto !important; break-after: auto !important; break-inside: auto !important; orphans: 2 !important; widows: 2 !important; transform: none !important; rotate: none !important; scale: none !important; translate: none !important; perspective: none !important; }`;
    doc.head.appendChild(style);
  }

  // Each context has a container of its own, so two fills in flight never measure in each other's. They share the one id on purpose, transiently: the neutralizing sheet and `reads.ts` select by it, at the specificity the sheet needs against an author's `!important`.
  const container = doc.createElement('div');
  container.id = CONTAINER_ID;
  doc.body.appendChild(container);
  // flow-root: child margins stay inside, so the container's box is the measured flow's coordinate space. Off-viewport, never display:none — display:none has no geometry.
  const css = `position: absolute; left: -100000px; top: 0; width: ${contentWidthPx}px; display: flow-root;`;
  container.style.cssText = css;
  /** A context can stand idle while another runs (*the pages are cut as far as they are asked*, 2026-10-12), and a host may move what it wears, so every measure makes sure of the sheet, the container and the width before it lays anything out. Where nothing moved, all three are already so. */
  const ensure = () => {
    if (!style.isConnected) doc.head.appendChild(style);
    if (!container.isConnected) doc.body.appendChild(container);
    if (APPLIED.get(container) !== css) container.style.cssText = css;
    APPLIED.set(container, css);
  };
  APPLIED.set(container, css);

  return {
    container,
    /**
     * Lay out a feed of nodes and force one layout. The caller obtains geometry only through a Gauge report taken afterward — obtaining the report seals the mutation phase (*render-identical conditions*, I5, by type; see gauge.js).
     *
     * @param nodes - cloned feed content; never source elements (*the source document is never written*, C5, and never moved).
     * @param publish - what the page the feed is for publishes on its host (*the page carries its conditions*, 2026-10-21), written on the container so a flow site that reads a page fact is measured with it standing; absent, the container carries none, and such a site reads its reservation.
     */
    measure(nodes: Node[], publish: PagePublish|null = null) {
      ensure();
      publishOn(container, publish);
      container.replaceChildren(...nodes);
      void container.offsetHeight; // the one forced layout
      return container;
    },
    dispose() {
      container.remove();
      if (!doc.querySelector(`#${CONTAINER_ID}`)) style.remove();
    }
  };
}
