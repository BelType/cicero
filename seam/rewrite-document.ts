/**
 * Rewrite the document's own sheets: the browser half of *the host rewrites what the parser drops* (2026-09-14).
 *
 * `rewrite.js` rewrites text; this rewrites a live document, which is what two of the three hosts actually need. Every same-origin `<link rel="stylesheet">` and every `<style>` is read, rewritten, and — only where the rewriter reports a change — replaced in place by a `<style>` holding the new text **at the same position in the document**, so the cascade order is exactly what it was. A document with nothing to rewrite is not touched at all.
 *
 * It lives beside the rewriter rather than inside either client because both clients do the same thing with it: this package's own (`seam/client.js`) and the essay's (`packages/essay/lib/client.js`), which loads the engine over a mount and imports nothing from this package at build time. One implementation, two callers, and the editing tools' dresser calls `rewriteSheet` directly because it holds the text already and never links a sheet.
 *
 * **A cross-origin sheet is skipped and said out loud.** Its rules are unreadable and its text unfetchable, so the honest outcome is a named gap rather than a silent one: a running head declared in a sheet on another origin will not arrive, and the console says which sheet.
 *
 * **With a layer named, every sheet of the document goes into it** (*the author's sheets in a layer the host names*, 2026-10-17): a `<style>` holds its text wrapped (`wrapInLayer`), and every `<link>` becomes a `<style>` of its wrapped text at the same position. **The address is not kept, on a measurement**: `<style>@import url(<the href>) layer(<name>)</style>` would keep it, and Chromium fetches an imported sheet once for every frame that imports it, but it parses it again in each (measured 2026-10-17 in the studio experiment, an 11 MB sheet in four same-origin frames: +9 MB a further frame linked, +61–74 MB imported), so an import buys a host no shared copy a `<style>` does not, and it hides the sheet from every walk that reads `document.styleSheets`' top level (`@page`, `@font-face` for a printer, `position: fixed`). A host that shared a linked sheet's parsed copy across frames loses that sharing under a layer, and the loss is the host's to weigh. **And the engine's root line-height provision moves into the engine's own layer**, the first one: unlayered, it would outrank every rule of the author's now-layered sheets, the author's own root line-height among them, where it was written to lose every tie. **And the order of the two layers is stated first in the head**, `@layer <the engine's>, <the host's>;` in the engine's own layers element (made where it is not there yet): a layer's place is where it is first named, and a host that seats the author's sheets before the engine's head (the HTML lane, the studio, its print frame) would otherwise name the author's layer before the engine's, putting the engine's `!important` trimming below an author's and its provision above the author's normal rules. Without a layer nothing here changes.
 *
 * **The `<link>` is replaced, not merely disabled.** A disabled link leaves the browser's own copy of the rules out of the CSSOM but leaves the element in the document, and the next thing to walk `document.styleSheets` would meet two sheets where the author wrote one.
 *
 * @packageDocumentation
 */

import { rewriteSheet, rewriteNote, isLayerName } from './rewrite.ts';
import { CICERO_INTERFACE, CICERO_PROVISION, LAYER as ENGINE_LAYER, WORDS_RULES, hasWord } from '../src/data-beltype.ts';
import { LAYERS_ID } from '../src/dressing.ts';

/** Is this URL on the document's own origin? A relative href resolves against the document, so the constructor answers both cases at once. */
function sameOrigin(doc: Document, href: string) {
  try {
    return new URL(href, doc.baseURI).origin === (doc.defaultView as Window).location.origin;
  } catch {
    return false;
  }
}

/**
 * Is this node the engine's own, which says `@media screen` and `@media print` on purpose (*the measure runs under print media*, 2026-10-06)?
 *
 * The interface sheet is a `<link>` in the document, and it carries the mark `headHtml()` gives it; the provision beside it carries the same mark. The press sheet is written by `src/root.js` under an id of the house's `__beltype` family, which `client.js` in the essay already treats as scaffolding. A rewrite that opened the interface sheet's print block and removed its screen block would put the print surround on the screen and take the backdrop off it. The dressing sheet is adopted, never a node, so no selector here reaches it.
 */
const isTheEngines = (node: Element) => hasWord(node, CICERO_PROVISION) || hasWord(node, CICERO_INTERFACE) || node.id?.startsWith('__beltype');


/**
 * Rewrite every same-origin sheet the document carries.
 *
 * **A sheet already judged is not judged again** (*the forced-break index is kept across runs*, 2026-10-09). The rewrite is a pure function of one sheet's text, and the text a frame's sheet has cannot change without the host reloading the frame — a changed file reloads it, and a `<style>` edited in place is caught by comparing its text with the text it was judged against. So `judged` remembers, per node, the text it was last judged at (a `<link>` once it was fetched and judged, whatever the rewrite made of it), and a node the memo knows is skipped without a fetch: the cost of a run was almost entirely the round trip, 43–68 ms for twelve links in turn on the BGD manual. The caller owns the memo and passes a fresh one when its conditions moved; a caller that passes none judges everything, as before. **The links are fetched together** and applied in document order, which changes nothing a reader can observe.
 *
 * @param judged - node → the text it was judged against; filled by the call.
 * @param options - `layer` — the cascade layer the host wants the document's own sheets in; absent, the call is what it was before the option existed. `pages: false` — a host with no pages, the site engine (`rewrite.js`'s header says what it leaves).
 */
export async function rewriteDocumentSheets(doc: Document, judged: WeakMap<Element,string> = new WeakMap<any, any>(), { layer = null, pages = true }: { layer?: string|null; pages?: boolean; } = {}): Promise<{ changed: number; skipped: string[]; counts: object; }> {
  if (layer != null && !isLayerName(layer)) throw new TypeError(`rewriteDocumentSheets: "${layer}" is not a layer name`);
  const counts: Record<string,number> = { stringSet: 0, running: 0, content: 0, blank: 0, split: 0, reads: 0, strings: 0, opened: 0, removed: 0, has: 0, layered: 0 };
  if (layer) {
    let order = doc.getElementById(LAYERS_ID);
    if (!order) {
      order = doc.createElement('style');
      order.id = LAYERS_ID;
      doc.head.prepend(order);
    }
    order.textContent = `@layer ${ENGINE_LAYER}, ${layer};`;
    // The provision is the engine's own and is never rewritten; this one move is what a named layer asks of it (the header says why). Its text is the words sheet's rules, already in the engine's layer, then the unlayered root line-height (`seam/index.js`'s `headHtml`), which is what moves.
    for (const node of doc.querySelectorAll('style')) {
      const text = node.textContent ?? '';
      if (!hasWord(node, CICERO_PROVISION) || !text.startsWith(WORDS_RULES)) continue;
      const rest = text.slice(WORDS_RULES.length);
      if (rest.trim() && !rest.trimStart().startsWith('@layer')) node.textContent = `${WORDS_RULES}@layer ${ENGINE_LAYER} { ${rest} }`;
    }
  }
  const skipped: string[] = [];
  const kept: string[] = [];
  let changed = 0;

  // The nodes that need judging: an engine's own never; a `<style>` whose text is not the text it was judged at; a `<link>` the memo has not seen.
  const todo = [...doc.querySelectorAll('link[rel~="stylesheet"], style')].filter((node) => !isTheEngines(node) && (node.tagName === 'STYLE' ? judged.get(node) !== node.textContent : !judged.has(node)));

  // Every text, asked for at once. `null` is a sheet to leave be (no href, or it will not load); `undefined` is a sheet this document cannot read (another origin, or the fetch failed).
  const texts = await Promise.all(todo.map(async (node) => {
    if (node.tagName === 'STYLE') return node.textContent;
    const href = node.getAttribute('href');
    if (!href) return null;
    if (!sameOrigin(doc, href)) return undefined;
    try {
      const res = await (doc.defaultView as Window).fetch(new URL(href, doc.baseURI).href);
      if (!res.ok) return null; // a sheet that will not load is the browser's problem to report, and it reports it already
      return await res.text();
    } catch {
      return undefined;
    }
  }));

  todo.forEach((node, i) => {
    const source = texts[i];
    if (source === undefined) {
      skipped.push((node.getAttribute('href') as string));
      judged.set(node, '');
      return;
    }
    if (source === null) {
      judged.set(node, '');
      return;
    }

    const out = rewriteSheet(source, { layer, pages });
    kept.push(...out.kept);
    if (!out.changed) { // untouched is untouched: a document declaring none of the four keeps its own <link> elements
      judged.set(node, source);
      return;
    }
    for (const k of Object.keys(out.counts)) counts[k] += (out.counts as Record<string, number>)[k] ?? 0;

    changed++;
    if (out.layered) counts.layered++;


    if (node.tagName === 'STYLE') {
      node.textContent = out.text;
      judged.set(node, out.text); // the text the next run will find there
      return;
    }
    const style = doc.createElement('style');
    style.textContent = out.text;
    node.replaceWith(style); // in place, so the sheet keeps its seat in the cascade
    judged.set(style, out.text);
  });

  const note = rewriteNote(counts);
  if (note) console.info(note);
  if (counts.layered) console.info(`BelType/Cicero: the document's own ${counts.layered === 1 ? 'sheet is' : `${counts.layered} sheets are`} in the cascade layer "${layer}", as the host asked; your own files are untouched.`);
  if (kept.length) console.info(`BelType/Cicero: left ${kept.length === 1 ? 'this :has()' : `${kept.length} :has() selectors`} as written — ${kept.slice(0, 3).join('; ')}${kept.length > 3 ? ` and ${kept.length - 3} more` : ''}. Its argument reads state a word computed once cannot follow, so the boxes outside a page's interval stay whole for this document and cost more to build; the pages are the same.`);
  if (skipped.length) console.warn(`BelType/Cicero: ${skipped.length} stylesheet(s) are on another origin and were left as they are — ${skipped.join(', ')}. A named string or a :blank rule declared in one of them cannot reach the engine.`);
  return { changed, skipped, counts };
}
