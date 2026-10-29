/**
 * THE FACSIMILE — a page of another PDF, drawn by pdf.js, as what a copy of a PDF `<object>` is (*a copy may be presented*, stage 2 of the embedded-PDF round, 2026-10-14; `.claude/decisions/cicero/a-copy-may-be-presented.md`).
 *
 * The author writes the platform's own markup, untouched: `<object type="application/pdf" data="allegato.pdf#page=2">` with a fallback `<img alt="…">` inside, and `object.insert { page: insert; … }` for whatever CSS it wants. The browser would hand that to its own PDF viewer, which a copy of it must never do (a copy is made for every page that shows one, for every measurement and for every read) and which no page of ours can draw into a cut. So this module registers a PRESENTER (`src/presenters.js`) for `object[type="application/pdf"]`: every copy Cicero makes of such an element is {@link make}'s element instead.
 *
 * **The element is itself an `<object>`** — a customized built-in, `<object is="beltype-facsimile">` (`class extends HTMLObjectElement`, registered with `{ extends: 'object' }`) — because the author's CSS addresses `object`, and an element of another name would match none of it. It carries the source's attributes EXCEPT `data` and `type`: with neither, the browser fetches nothing, starts no viewer and shows the element's children, which once the page is drawn are exactly one `<canvas>`. Measured 2026-10-14 (`.claude/plans/the-embedded-pdf/results.md`, stage 2 phase A): the canvas shows on screen and in Chromium's own print with no plug-in text; an author rule sizes the element; a clone of it is upgraded again, though its canvas holds no pixels (`cloneNode` copies none, which is why the drawing is the element's own, done when it is connected and seen). **The `is` value is NOT an attribute** — `createElement('object', { is })` upgrades the element and sets none — so the element sets the attribute itself, and `object[is="beltype-facsimile"]` (Caster's selector) matches it and every clone.
 *
 * **The element's contract**, which Caster reads and never the canvas: `data-src` — the same-origin PDF URL, no fragment; `data-page` — the one-based page, absent for page 1; `role="img"` and `aria-label` — the fallback image's `alt`; `contenteditable="false"`; the source's other attributes (class, id, style, width, height …); no child at all until the page is drawn and then exactly one `<canvas>` (a copy that is not yet drawn is an empty box, the size its ratio gives it), and no text. NO pdf.js text layer: a selectable layer would be words the document does not hold, and neither the word space nor Caster's conservation of words may ever see them.
 *
 * **The size is known before the first cut, the rule images follow** (`.claude/decisions/cicero/images-are-awaited-at-intake.md`): {@link install} opens each PDF the document holds with pdf.js and reads the page's size WITHOUT drawing it, awaited before the first run, and {@link make} gives each copy an `aspect-ratio` from that cache synchronously — unless the author's CSS fixes both dimensions of the source, or names an aspect ratio itself. The drawing comes later and may come as late as it likes: pixels move no layout. A size that is learned only after a measure (an element a host added by an edit, a file that was not there at intake) is late truth, and goes through the rim as one `beltype:change` for the box (`seam/rim.js`, *late truth is an edit*).
 *
 * **`make` runs often** — for every copy, each page that shows one, each hollow shell, each measuring copy — and so it is cheap and synchronous and starts no work: the drawing is deferred to when the element is connected AND seen (an `IntersectionObserver`), and what it draws is cached per (url, page, width, device pixel ratio). An element in the measure container does not draw at all.
 *
 * Loaded only when the document holds a matching element (`seam/client.js`, at intake): a document without a PDF pays nothing, and pdf.js is not fetched. pdf.js is vendored — `pdfjs-dist`, pinned exactly, its module and worker published by `vendorAssets()` at `cicero/seam/pdfjs.js` and `cicero/seam/pdfjs-worker.js` (the one entries of that table that are not the file of their own name).
 *
 * @packageDocumentation
 */

/** The selector a source matches, and the presenter is registered for. */
export const SOURCE = 'object[type="application/pdf"]';
/** The customized built-in's name, and the value of the `is` attribute every presented element carries. */
export const TAG = 'beltype-facsimile';

export type PageSize = {
  /** the page's width at scale 1, in PDF points, after `/Rotate`. */
  width: number;
  height: number;
};

/** pdf.js, imported once. The specifiers are URLs published by `vendorAssets()`, never a bare package name: this module runs in a browser, which has no resolution of its own, and in two hosts that do not share one. */
let pdfjsLoading: Promise<any>|null = null;
const loadPdfjs = () => pdfjsLoading ??= import(/* @vite-ignore */ new URL('./pdfjs.js', import.meta.url).href).then((pdfjs) => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdfjs-worker.js', import.meta.url).href;
  return pdfjs;
});

/** Opened documents by URL, kept for the life of the page; a failed open is forgotten, so the next ask tries again. */
const opened: Map<string,Promise<any>> = new Map<any, any>();
function openDocument(url: string) {
  let doc = opened.get(url);
  if (!doc) {
    doc = loadPdfjs().then((pdfjs) => pdfjs.getDocument({ url }).promise);
    opened.set(url, doc);
    doc.catch(() => opened.delete(url));
  }
  return doc;
}

/** The page sizes read so far, by `url#page`. A size is a number of a file; it is what `aspect-ratio` is made from. */
const sizes: Map<string,PageSize> = new Map<any, any>();
/** Page sizes being read, so two copies asking at once open the file once. */
const reading: Map<string,Promise<PageSize>> = new Map<any, any>();

const keyOf = (url: string, page: number) => `${url}#${page}`;

/**
 * The size of one page of a file, read WITHOUT drawing it.
 *
 * @param page - one-based.
 * @throws {Error} naming the URL, when the file cannot be opened as a PDF or has no such page.
 */
function readSize(url: string, page: number): Promise<PageSize> {
  const key = keyOf(url, page);
  let pending = reading.get(key);
  if (!pending) {
    pending = openDocument(url).then(async (doc) => {
      if (page > doc.numPages) throw new Error(`the file has ${doc.numPages} page${doc.numPages === 1 ? '' : 's'} and the object asks for page ${page}`);
      const view = (await doc.getPage(page)).getViewport({ scale: 1 });
      const size: PageSize = { width: view.width, height: view.height };
      sizes.set(key, size);
      return size;
    }).catch((error) => { throw new Error(`BelType/Cicero: <object data="${url}"> cannot be read as a PDF — ${error?.message ?? error}`); });
    reading.set(key, pending);
    pending.then(() => reading.delete(key), () => reading.delete(key));
  }
  return pending;
}

/** Where a source's PDF is, and which page: `data` resolved against the document, the fragment taken apart as RFC 8118 writes it (`#page=2`, or `#page=2&zoom=50`; none means page 1). */
export function locate(source: Element): { url: string; page: number; pageGiven: boolean; } {
  const href = new URL(source.getAttribute('data') ?? '', source.ownerDocument.baseURI);
  const wanted = Number(new URLSearchParams(href.hash.slice(1)).get('page'));
  href.hash = '';
  const pageGiven = Number.isInteger(wanted) && wanted >= 1;
  return { url: href.href, page: pageGiven ? wanted : 1, pageGiven };
}

/**
 * The alternative text a source carries — its fallback image's `alt`. A PDF page with none is a figure Caster would refuse (PDF/UA wants one), so the refusal is made here, at intake, by name.
 *
 * @throws {Error} naming the element, when there is no fallback `<img>` with a non-blank `alt`.
 */
function altOf(source: Element): string {
  const alt = source.querySelector('img')?.getAttribute('alt')?.trim();
  if (!alt) throw new Error(`BelType/Cicero: <object type="application/pdf" data="${source.getAttribute('data')}"> has no fallback <img alt="…"> — the page it embeds would be a figure with no alternative text, and the print refuses that. Write the fallback inside the object: <object …><img src="…" alt="what the page shows"></object>.`);
  return alt;
}

/**
 * The element a copy of `source` is: an `<object is="beltype-facsimile">`, in the contract the header states, with no child yet. Cheap and synchronous, and it starts nothing.
 *
 * @param source - a `<object type="application/pdf">`, parked or placed; its specified lengths are readable, its used width and height are not (measured: a parked source answers `50%` for a percentage width).
 * @throws {Error} when the source has no fallback `alt`.
 * @remarks The element has no child until {@link draw} gives it its canvas (*a facsimile's copy holds its box off screen*, CHANGELOG 2026-10-28). An `<object>` with a child and no `data` decides at its first layout to render the child, which is a reattach of its layout tree, and on a page the browser skips (`content-visibility: auto`, *a page is contained*) a read from script lays the subtree out for the length of the read, drops the reattach when it puts the subtree back, and leaves the copy with no box at all. Measured 2026-10-28: the same copy with no child keeps its box on every read.
 */
export function make(source: Element): HTMLObjectElement {
  const doc = source.ownerDocument;
  const el = (doc.createElement('object', { is: TAG }) as HTMLObjectElement);
  for (const { name, value } of source.attributes) if (name !== 'data' && name !== 'type' && name !== 'is') el.setAttribute(name, value);
  const { url, page, pageGiven } = locate(source);
  el.setAttribute('is', TAG);
  el.setAttribute('data-src', url);
  if (pageGiven) el.setAttribute('data-page', String(page));
  else el.removeAttribute('data-page');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', altOf(source));
  el.setAttribute('contenteditable', 'false');
  const size = sizes.get(keyOf(url, page));
  if (size) {
    const style = source.ownerDocument.defaultView?.getComputedStyle(source);
    // The author who names a ratio has said what the box is. Otherwise the page's own ratio is given ALWAYS, and CSS decides whether it counts: `aspect-ratio` has no effect on a box whose width and height are both definite, and it is exactly what a percentage height needs when it falls back to `auto` (no definite containing-block height). A parked source answers SPECIFIED values (`100%`), so this module cannot tell those two cases apart and must not try — measured in the studio: `width: 100%; height: 100%` left a 267 px box with no ratio, painted only in its top 150 px.
    if (style && style.aspectRatio === 'auto') el.style.aspectRatio = `${size.width} / ${size.height}`;
  }
  return el;
}

/** What is drawn, by `url|page|width|dpr`: one off-screen canvas per distinct box, so every page that shows a figure of the same size copies pixels and a file is rendered once. Bounded: the oldest goes first. */
const drawn: Map<string,Promise<HTMLCanvasElement>> = new Map<any, any>();
const KEPT = 24;

function drawing(url: string, page: number, cssWidth: number, dpr: number): Promise<HTMLCanvasElement> {
  const key = `${url}|${page}|${cssWidth}|${dpr}`;
  let pending = drawn.get(key);
  if (!pending) {
    pending = (async () => {
      const pdfPage = await (await openDocument(url)).getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: (cssWidth * dpr) / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await pdfPage.render({ canvasContext: (canvas.getContext('2d') as CanvasRenderingContext2D), canvas, viewport }).promise;
      return canvas;
    })();
    drawn.set(key, pending);
    pending.catch(() => drawn.delete(key));
    if (drawn.size > KEPT) drawn.delete((drawn.keys().next().value as string));
  }
  return pending;
}

/** Whether a failure has been told already, by `url#page`: a console that repeats one line per copy says nothing. */
const told: Set<string> = new Set<any>();

/**
 * The late fact: this box's size was not known when it was measured and is now. One cancelable `beltype:change` for the top-level box that holds the source, the rim's own name (`seam/rim.js`), so the host may take the pace and otherwise the engine answers with the resumable run.
 *
 * @param el - a presented element on a page.
 */
function lateSize(el: HTMLElement) {
  const handle = (window as any).__beltypeCicero;
  const source = handle?.sourceOf?.(el);
  if (!source) return;
  let box = source;
  while (box.parentElement && box.parentElement.localName !== 'beltype-root') box = box.parentElement;
  document.dispatchEvent(new CustomEvent('beltype:change', { bubbles: true, cancelable: true, detail: { kind: 'element', boxes: [box] } }));
}

/** Drawing waits until the element is where a reader could see it: the browser says so (an intersection, a little ahead of the viewport), and only then is its box laid out — a page the engine has built outside the view may have its contents skipped, and an element asked for its width at the moment it is connected would answer 0 and never be drawn. A copy in the measure container sits far off screen and is never intersected, which is what leaves a measurement undisturbed. */
let seen: IntersectionObserver|null = null;
const watcher = () => seen ??= new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) { seen?.unobserve(entry.target); draw((entry.target as HTMLObjectElement)); }
}, { rootMargin: '300px' });

/** The drawn page, at the box's width. The canvas takes the page's own ratio and the CSS says how it sits (`object-fit: contain`, in the box the author sized). */
async function draw(el: HTMLObjectElement) {
  if (!el.isConnected || el.closest('#__beltype-measure')) return; // a measuring copy is measured, never drawn — the Gauge's container by its own id (as `src/reads.js` names it), never every id that begins `__beltype`, which a host's own wrappers may wear (the studio's `#__beltype-studio`, measured: every copy stayed blank)
  const url = el.getAttribute('data-src');
  const cssWidth = el.clientWidth;
  if (!url || cssWidth === 0) return; // not laid out: a concealed shell, or a box with no width yet
  const page = Number(el.getAttribute('data-page') ?? 1);
  const known = sizes.has(keyOf(url, page));
  try {
    const dpr = window.devicePixelRatio || 1;
    const from = await drawing(url, page, cssWidth, dpr);
    if (!el.isConnected) return;
    let canvas = el.querySelector('canvas');
    if (!canvas) {
      canvas = el.ownerDocument.createElement('canvas');
      canvas.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain';
      el.append(canvas);
    }
    canvas.width = from.width;
    canvas.height = from.height;
    (canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(from, 0, 0);
    if (!known) { await readSize(url, page); lateSize(el); }
  } catch (error) {
    const key = keyOf(url, page);
    if (!told.has(key)) { told.add(key); console.warn(`BelType/Cicero: the page ${page} of ${url} could not be drawn —`, (error as Error | undefined)?.message ?? error)
; }
  }
}

/**
 * Define the element, read the size of every page the document embeds and register the presenter — before the first run (the intake calls this first, and awaits it), because a presenter is a condition of every copy and a registration after a run is a whole run.
 *
 * Every source is checked for its alt text here, so a document that would print a figure with none is refused at the door and not after the cuts. A PDF that cannot be read is TOLD and not refused: the box has no ratio from the cache, nothing is drawn in it, and its size, if the file turns up later, arrives through the rim; a missing page number is the same — except that it is the author's mistake, and the message says so.
 *
 * @param present - `window.__beltypeCicero.present`, handed in so this module imports nothing from the engine.
 * @throws {Error} when a source has no fallback `alt`.
 */
export async function install(doc: Document, present: (selector: string,make: (source: Element) => Element) => void): Promise<void> {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, class extends HTMLObjectElement {
      connectedCallback() { watcher().observe(this); }
      disconnectedCallback() { watcher().unobserve(this); }
    }, { extends: 'object' });
  }
  const reads: Promise<unknown>[] = [];
  for (const source of doc.querySelectorAll(SOURCE)) {
    altOf(source);
    const { url, page } = locate(source);
    reads.push(readSize(url, page).catch((error) => {
      const key = keyOf(url, page);
      if (!told.has(key)) { told.add(key); console.warn(String(error?.message ?? error)); }
    }));
  }
  await Promise.all(reads);
  present(SOURCE, make);
}
