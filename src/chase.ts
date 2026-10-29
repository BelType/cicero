/**
 * The Chase — `<beltype-page>` (architecture: The Chase; third-coding-round.md item 1). The page frame: it holds, it never decides.
 *
 * Shadow anatomy, probe-proven (*forwarding delivery*, P10, and *tail clipping*, P11): a manual-assignment shadow whose layout engine is one 5×5 grid — margins as the outer tracks, the sixteen margin boxes named into the ring (four fixed corners, twelve flexing edges), the content area spanning the middle nine cells. Content arrives through the content slot, by one of two doors. The root's is the slot chain (`adopt`): the root's named slot lives as this element's light child, and the content slot is assigned that slot element — one level of forwarding. A host that is not the root gives the page its content directly (`setContent`): the nodes become this element's light children and the content slot is assigned them, which is the same place in the flow with one level fewer (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`; *given content*, P42).
 *
 * **The clips, and there are three** (*the page rendering clips at the bleed area*, 2026-09-18, and *the page clips at its bleed area on the block axis too*, 2026-10-02; see CHANGELOG 2026-09-18). `overflow: clip` throughout — layout whole, paint and hit-testing stopped, the box unmoved — and each one answers a different sentence. The **host** clips at the page box, which is css-page-3's own boundary: `bleed` says the page rendering is clipped at the bleed area, and that computes to zero without crop marks, so ink may stand in the page margin on every side, above the page area included. The **flow** clips the foot, and the foot alone: a fragment must not show the tail below its own cut, which is a fact about where the cut fell and not a page-area clip, so the flow's clip is at the cut's own extent and its head is lifted to above the page box, where the host's takes over (`setFlow`). The content area clips nothing. The **furniture layer** clips at the page area on both axes, because CSS 2.1 §9.6.1 says a fixed box larger than the page area is clipped and that is the one place a page-area clip is named at all.
 *
 * **A page is contained** (*the run resumes from an entry*, build two, 2026-10-08): `contain: layout size paint` and `content-visibility: auto`, with `contain-intrinsic-size` the page's own size. The page box is a known rectangle, so refilling one page cannot dirty the next, and a page far from the viewport is neither laid out nor painted until it nears it. Size containment alone was never what made the pages' sizes true — `applyConditions` writes them as literals — so the declaration changes no number any cut was decided on; the battery and Caster's suite are the proof of that. **It does change one thing, and that is why `setCounters` exists** (2026-10-14): `content-visibility: auto` implies style containment, which gives the page its own counter scope, so the document's `counter-reset` is unreachable from inside a page; the page delivers the counters it starts with itself, and the containment stays because it is what makes a page near the reader cheap.
 *
 * `applyConditions` writes the page's own geometry as literal styles — conditions, never conclusions (the tablet's Chase share). The DOM boundary speaks product: beltype-, never the engine's name.
 *
 * **The page carries its conditions as declarations on its own host** (*the page carries its conditions*, 2026-10-21, `.claude/decisions/cicero/the-page-carries-its-conditions.md`), and everything the page holds reads them through the cascade. A number is a counter the host resets (`setCounters`: `page N`, `pages T` once known; the author's counters at the page's start are reset on the flow and on each margin cell instead, because an increment inside the page does not find a counter the host resets); a text is a custom property the host sets (`setStrings`: `--beltype-string-<name>-<which>`); and the browser spells every counter, in every style it knows. A margin box's `content` is transliterated into the page's shadow sheet onto the cell's `::before` (`dress`), never resolved, and whether the box exists is read from that `::before`'s computed `content` (`layoutBands`). A flow site that reads a page fact — `counter(page)`, or a `string()` the host rewrote into a `var()` of the property — reads the same declarations down the flat tree. Nothing else goes on the host: the firewall below is a selector that cannot match, and a `color` on the host would reach every paragraph (P39f), so what the host carries is `counter-reset` and `--beltype-*`, which no author sheet reads by accident.
 *
 * Chrome lives here on purpose. **The law (*content is one document*, I6) seals nothing informational inside shadow DOM**, and a folio is a value with no canonical original anywhere: it does not live once, so it cannot live twice (the design round of 2026-08-04; see CHANGELOG 2026-10-17). What the shadow does cost is real and owned: an author's own stylesheet cannot reach a margin box except through the page context it wrote. A running element is the exception that is not a value, and `setMarginBox` slots it into its cell.
 *
 * @packageDocumentation
 */

import { MARGIN_CELLS, ALIGN_X, ALIGN_Y, HORIZONTAL_BANDS, bandWidths, translateAlignment } from './margin-boxes.ts';
import { counterLevels } from './document-state.ts';
import { encodeStringProp, STRING_KEYWORDS } from './gcpm-encoding.ts';
import { cssString } from './reads.ts';
import type { Decl } from './margin-boxes.ts';
import type { PageGeometry, PageStyle } from './capture.ts';

/**
 * The intrinsic widths already measured, keyed by what they depend on — the page-context sheet's own text, the box's name, and the values its content reads.
 *
 * A running head is the same string on a hundred pages, and measuring it a hundred times would cost two hundred forced layouts to learn one pair of numbers. The key is exactly the measurement's inputs: the dress decides the font, the box's own padding and its `content`, the name decides which `[data-box]` rules apply, and the values the host publishes are what that `content` reads (*the page carries its conditions*, 2026-10-21: the text is the browser's, so the key is what the browser spells it from). Module-level rather than per-document because the key already carries everything that could make two documents disagree.
 */
const INTRINSICS = new Map<any, any>();

/** What a cell's own children add to its intrinsic widths: the text between running elements, and the markup of a running element slotted into it, which is what decides the width the browser is about to measure. */
const cellKey = ( cell: Element) => cell.textContent + [...cell.querySelectorAll('slot')].flatMap((s) => s.assignedNodes({ flatten: true })).map((n) => (n as Node & { outerHTML?: string }).outerHTML ?? n.textContent ?? '')
.join('');

/** The names a transliterated `content` reads off the host: the counters it names and the string properties it reads. */
const readsOf = (text: string) => [...text.matchAll(/counters?\(\s*([\w-]+)/g), ...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);

/**
 * The page context, transliterated — one constructed sheet per distinct page kind, adopted into that page's shadow root (*the page context dresses the host*).
 *
 * The author's resolved `@page` rule becomes five rules and no values are copied anywhere:
 *
 *   :host                                  — every declaration that does not reach a child
 *   .margin-cell                           — every declaration that does, css-page-3 §6's inheritance into the margin boxes
 *   .margin-cell[data-box="<name>"]        — that box's own declarations, (0,2,0) against (0,1,0) so a box's own `color` beats the page context's on specificity alone
 *   .margin-cell[data-box="<name>"]::before — that box's `content`, transliterated (`capture.js`'s `transliterateContent`), and `::after` where a running element splits it: the browser evaluates it against the counters and strings the host publishes (*the page carries its conditions*, 2026-10-21)
 *   .content-area                          — the page box's own `border-*` and `padding-*`, whose used widths the capture has already subtracted from the measure
 *
 * A box's own rule carries its `text-align` and `vertical-align` restated as the two properties a flex cell reads (`margin-boxes.js`'s `translateAlignment`), so an author's alignment beats css-page-3 §6.2's default table on specificity alone — the defaults sit at the same (0,2,0) in the shadow root's own `<style>`, and an adopted sheet is seated after it.
 *
 * **The firewall is a selector that cannot match, and the fourth rule does not open it** *(a page box has a border and a padding, 2026-09-07)*. What the firewall guards is inheritance: an inherited page-context declaration must not descend into slotted content, which inherits from the root element and not from the page (§6). `border` and `padding` inherit into nothing, so a rule carrying only those cannot leak, and the capture's own split is what guarantees it carries only those — `.content-area` takes exactly the two prefixes it withholds from the other three. Putting `color` on `:host` would have leaked it into every paragraph through the flattened tree; that is still true and still refused.
 *
 * **And the fourth rule is where the page's border belongs, not merely where it is convenient.** css-page-3 §3 gives the page box a margin, a border, a padding and a content area, in that order inward; the host is the whole page box and the margin cells occupy its margin area, so the box whose border edge sits just inside the margins is the content area. Its border box is the page box inside its margins, and its content box is therefore the page area — which is why the geometry needs no second arithmetic anywhere.
 *
 * Two properties of the mechanism, both load-bearing and neither arranged: CSSOM seats an adopted sheet after the shadow root's own `<style>`, so the `#fff` above stays the default and the author's ground wins a tie with nothing ordered by hand; and `replaceSync` drops what it cannot parse rather than throwing, so *the build cannot fail* is structural here rather than careful.
 */
const SHEETS = new WeakMap<any, any>(); // Document -> Map(cssText -> CSSStyleSheet). A constructed sheet is realm-bound, so the document is the outer key; the text is the inner one, which makes "one sheet per distinct page kind" fall out with no key to design.

const declarations = ( decls: Decl[]) => decls.map(([prop, value, priority]) => `${prop}: ${value}${priority ? ` !${priority}` : ''};`).join(' ');

function pageStyleText({ host = [], cell = [], area = [], boxes = {} }: Partial<PageStyle> = {}, content: Record<string,{ before: string; after: string|null; }|null> = {}) {
  const parts = [];
  if (host.length) parts.push(`:host { ${declarations(host)} }`);
  if (cell.length) parts.push(`.margin-cell { ${declarations(cell)} }`);
  if (area.length) parts.push(`.content-area { ${declarations(area)} }`);
  for (const [name, decls] of Object.entries(boxes)) parts.push(`.margin-cell[data-box="${name}"] { ${declarations(translateAlignment(decls))} }`);
  for (const [name, value] of Object.entries(content)) {
    if (!value) continue;
    parts.push(`.margin-cell[data-box="${name}"]::before { content: ${value.before}; }`);
    if (value.after) parts.push(`.margin-cell[data-box="${name}"]::after { content: ${value.after}; }`);
  }
  return parts.join('\n');
}

function sheetFor(doc: Document, pageStyle: Partial<PageStyle>|null, content: Record<string,{ before: string; after: string|null; }|null>|null): { sheet: CSSStyleSheet|null; text: string; } {
  const text = pageStyleText(pageStyle ?? {}, content ?? {});
  if (!text) return { sheet: null, text: '' };
  let perDoc = SHEETS.get(doc);
  if (!perDoc) SHEETS.set(doc, (perDoc = new Map<any, any>()));
  let sheet = perDoc.get(text);
  if (!sheet) {
    sheet = new (doc.defaultView as Window & typeof globalThis).CSSStyleSheet();
    sheet.replaceSync(text);
    perDoc.set(text, sheet);
  }
  return { sheet, text };
}

export class BeltypePage extends HTMLElement {
  #cells: Record<string,HTMLElement> = {};
  #bands: Record<string,HTMLElement> = {};
  #contentSlot;
  /** What `setContent` gave the page, so a second call takes it off. */
  #given: Node[] = [];
  #furnitureSlot;
  #flow;
  /** The wrappers `setCounters` seated between the flow and its slot (a counter nested more than once needs one box per level), and the key of the state they deliver. */
  #counterBoxes: HTMLElement[] = [];
  #counterKey = '';
  /** What the host publishes, by name: every counter it resets (the page's two and the author's outermost level) and every string property it sets. Half of a cell's measurement key. */
  #published: Map<string,string> = new Map<any, any>();
  /** The string properties the host carries now, so a page whose strings change takes the old ones off. */
  #stringProps: string[] = [];
  #stringKey = '';
  /** What each box's transliterated `content` reads off the host, written by `dress`. */
  #reads: Record<string,string[]> = {};
  #shadow;
  /** The band's available width, written by `applyConditions` and read by `layoutBands` — the page box inside its left and right margins, which is what §5.3.2 distributes. */
  #bandWidth = 0;
  /** The page's height, written by `applyConditions` and read by `setFlow` — more than the distance from the flow's head to the page box's top edge on every page, which is all the head clip's reach has to be. */
  #pageH = 0;
  /** The page-context sheet's own text, written by `dress` — half the measurement cache's key, since the dress is what decides a cell's font and its own insets. */
  #dressText = '';

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', slotAssignment: 'manual' });
    const doc = this.ownerDocument;

    const style = doc.createElement('style');
    style.textContent = `
      /* The host's clip IS css-page-3's own: the bleed property says the page rendering is clipped at the bleed area, which computes to zero without crop marks, so the boundary is the page box — and the host is the page box (*the page rendering clips at the bleed area*, 2026-09-18). It clips descendants only, so the screen box-shadow the root's sheet puts on this element is untouched, as is the 1px print-safety inset applyConditions takes off the bottom margin track. */
      :host { display: grid; box-sizing: border-box; background: #fff; break-after: page; break-inside: avoid; overflow: clip; contain: layout size paint; content-visibility: auto; }
      /* NO CLIP HERE (*the page clips at its bleed area on the block axis too*, 2026-10-02). This box used to clip the block axis at the page area, and its head was one of the two declarations that hid a band pulled into the page's top margin. What it clipped at the foot the flow already clips, at the cut's own extent, which is the sharper edge (measured: no flow ends past this box's foot on any page of the case corpus); what it clipped at the head is the page box's to clip, and the host does. It stays positioned, because the furniture layer is absolute against it. */
      .content-area { grid-row: 2 / 5; grid-column: 2 / 5; position: relative; }
      /* THE FURNITURE LAYER — CSS 2.1 §9.6.1's page-area clip, which is the one clip at the page area any of these documents names and is stated for fixed boxes alone. It used to fall out of the content area clipping both axes; once that stops, a repeated box needs the rectangle kept for it explicitly. Absolute at inset 0 against the content area makes this layer's own padding box exactly the content area's, so both the containing block a clone's offsets resolve against and the rectangle it is clipped at are the ones they already were — measured on cases 24, 32 and 46 before and after, unmoved to a hundredth of a pixel. The pointer-events pair is not decoration: this layer covers the whole page area and would otherwise swallow every click meant for the flow underneath, which is how a host navigates from a word to its source. The clones take it back, at a specificity an author's own rule still beats. */
      .furniture { position: absolute; inset: 0; overflow: clip; pointer-events: none; }
      .furniture slot::slotted(*) { pointer-events: auto; }
      /* IN FRONT OF THE DOCUMENT CONTENT, which is css-page-3 §3.1 — page-margin boxes *may only paint in front of the document content or behind the document canvas* — and which became reachable the moment content could enter a margin at all. The content area is positioned, so it would otherwise paint above these cells whatever the DOM order; §3.1's own sentence that z-index applies to a margin box *as if it were positioned regardless of the position property's value* is the licence for saying it this way. Not cased: no document here puts a margin box and flowed ink in one place. */
      .band, .margin-cell { position: relative; z-index: 1; }
      .margin-cell { display: flex; overflow: clip; }
      /* A box that is not generated paints nothing (css-page-3 §5.2) — a ground or a border declared on a box with no content has no box to be drawn on. The track stays, since a band's widths are §5.3.2's business and a corner's are fixed; only the paint goes. */
      .margin-cell:not([data-generated]) { visibility: hidden !important; }
      /* A HORIZONTAL BAND IS ITS OWN GRID (the margin boxes flex, 2026-09-14). A CSS grid has one set of column tracks for every row in it, so the outer 5×5 cannot give the top band and the bottom band different divisions — and css-page-3 §5.3.2 sizes each band from its OWN boxes' content, so they routinely want different ones. Equal thirds until layoutBands measures, which is exactly what the page did before this element grew the wrapper. */
      .band { display: grid; grid-template-columns: 1fr 1fr 1fr; min-width: 0; }
      .flow { display: flow-root; }
      ${MARGIN_CELLS.map(([name, , , x, y]) => `.margin-cell[data-box="${name}"] { justify-content: ${ALIGN_X[x]}; align-items: ${ALIGN_Y[y]}; }`).join('\n      ')}
    `;
    this.#shadow.appendChild(style);

    // THE CONTENT AREA COMES FIRST IN TREE ORDER, before every margin cell (*the page carries its conditions*, 2026-10-21). A counter reset on an element is in scope for its following siblings too, and each margin cell resets the author's counters for its own `content` (`setCounters`): a cell standing before the content area in tree order would reach the flow with a second instance of every counter, and a `counters()` there printed `1.1.3` where the document says `1.3` (case 105). The grid places every box by its own area and the cells paint above at `z-index: 1`, so the order moves nothing on the page.
    const area = doc.createElement('div');
    area.className = 'content-area';
    this.#flow = doc.createElement('div');
    this.#flow.className = 'flow';
    this.#contentSlot = doc.createElement('slot');
    this.#flow.appendChild(this.#contentSlot);
    area.appendChild(this.#flow);
    // The furniture layer, after the flow so it paints over it — which is where a fixed box belongs and where its clones already were when they rode the flow's own slot.
    const furniture = doc.createElement('div');
    furniture.className = 'furniture';
    this.#furnitureSlot = doc.createElement('slot');
    furniture.appendChild(this.#furnitureSlot);
    area.appendChild(furniture);
    this.#shadow.appendChild(area);

    // The two horizontal bands, seated across the outer grid's three middle columns — the same span the content area takes, which is why the outer `cw3` arithmetic governs nothing but these three items and does not change.
    for (const [band, row] of ([['top', 1], ['bottom', 5]] as [string, number][])) {
      const el = doc.createElement('div');
      el.className = 'band';
      el.dataset.band = band;
      el.style.gridArea = `${row} / 2 / ${row + 1} / 5`;
      this.#bands[band] = el;
      this.#shadow.appendChild(el);
    }

    for (const [name, row, col] of MARGIN_CELLS) {
      const cell = doc.createElement('div');
      cell.className = 'margin-cell';
      cell.dataset.box = name;
      const band = Object.keys(HORIZONTAL_BANDS).find((b) => (HORIZONTAL_BANDS as Record<string, string[]>)[b].includes(name));
      if (band) {
        // A band's three boxes are its own grid items, in band order; the corners and the six side boxes stay on the outer grid, in columns 1 and 5, which no band touches.
        cell.style.gridColumn = String((HORIZONTAL_BANDS as Record<string, string[]>)[band].indexOf(name) + 1);
        this.#bands[band].appendChild(cell);
      } else {
        cell.style.gridArea = `${row} / ${col}`;
        this.#shadow.appendChild(cell);
      }
      this.#cells[name] = cell;
    }

  }

  /**
   * The page's own geometry as literal styles — explicit pixel tracks throughout, so the content area is exactly contentW × contentH at (left, top) by construction. The host takes a 1px print-safety inset off its bottom margin track: Chromium print rounds the page box down a fraction, and a host taller than the rounded box spills a sliver page (the view gate caught exactly this); the inset lives entirely inside the bottom margin, so content geometry is untouched.
   *
   * **The middle tracks span the page box inside its margins, which is not the same as the page area** *(a page box has a border and a padding, 2026-09-07)*. They used to be `contentW / 3`, which was the same number for as long as a page had no border and no padding; css-page-3 §6 puts both on the list and Chromium takes room for both, so the two parted. The middle band is the content area's own border box, and the border and padding it wears — written by the page-context sheet, from the author's own declarations — take the difference back out. `.content-area` is a stretched grid item, so its border box fills the band and its content box is exactly the page area with nothing to arrange.
   */
  applyConditions({ pageW, pageH, margins }: Pick<PageGeometry,'pageW'|'pageH'|'margins'>) {
    this.style.width = `${pageW}px`;
    this.style.height = `${pageH - 1}px`;
    this.style.containIntrinsicSize = `${pageW}px ${pageH - 1}px`;
    this.#bandWidth = pageW - margins.left - margins.right;
    this.#pageH = pageH;
    const cw3 = this.#bandWidth / 3;
    const ch3 = (pageH - margins.top - margins.bottom) / 3;
    this.style.gridTemplateColumns = `${margins.left}px ${cw3}px ${cw3}px ${cw3}px ${margins.right}px`;
    this.style.gridTemplateRows = `${margins.top}px ${ch3}px ${ch3}px ${ch3}px ${Math.max(0, margins.bottom - 1)}px`;
  }

  /**
   * The page's counters, reset on the page itself (*an author counter is delivered at each page's start*, 2026-10-14; *the page carries its conditions*, 2026-10-21).
   *
   * `content-visibility: auto` on the host implies style containment, which gives the page its own counter scope: the body's `counter-reset` is unreachable from inside and a counter would start again on every page. That containment is why this delivery exists, and it stays because it is what makes a page near the reader cheap. The state is `closes.counters` (`document-state.js`'s `counterStateAt` at the page's first word: every instance in scope, outermost first), written as one `counter-reset` per counter per nesting level, and the browser counts natively inside the page from there.
   *
   * **The page's own two are reset on the host** (ruling 1): `page N` and, once the run is complete, `pages T`. A reset on the host reaches the margin cells in the page's shadow and the flow alike, and one on the flow does not reach the cells, which are outside it (P39g). So `counter(page)` is native wherever it stands, in any style the browser knows, an author's `@counter-style` included (P39h). Until the total is known `pages` is not reset; the cells read it as `""` (the dress's own transliteration), and a flow site reads `0`, the reservation.
   *
   * **The author's counters are not, and that is measured** (2026-10-21, cases 105 and 111). The host is the element that carries the style containment, and a `counter-increment` inside it does not find a counter the host itself resets: the flow's first figure incremented a new counter from zero and printed `Figure 1` on page two where the document's third figure stands. A read finds it, which is why the page's own two, which nothing in the flow increments, can sit there. So the author's outermost level is reset on the flow, where it was, and on each margin cell as well, which is the one other place it is read, and every deeper level is a block of its own around the slot, a real box because Blink does not read the counter properties of a `display: contents` element (measured 2026-10-14). A margin cell sees the outermost level alone, so a margin box's `counters()` shows one level (a stated limit).
   */
  setCounters(state: Record<string,number[]> = {}, { page = null, pages = null }: { page?: number|null; pages?: number|null; } = {}) {
    const levels = counterLevels(state);
    const own: Array<[string,number]> = [...(page != null ? [(['page', page] as [string, number])] : []), ...(pages != null ? [(['pages', pages] as [string, number])] : [])];
    const key = JSON.stringify([own, levels]);
    if (key === this.#counterKey) return;
    this.#counterKey = key;
    const doc = this.ownerDocument;
    const declaration = ( pairs: Array<[string,number]>|undefined) => (pairs ?? []).map(([name, value]) => `${name} ${value}`).join(' ');
    for (const box of this.#counterBoxes) box.remove();
    this.#counterBoxes = [];
    this.style.counterReset = declaration(own);
    this.#flow.style.counterReset = declaration(levels[0]);
    for (const cell of Object.values(this.#cells)) cell.style.counterReset = declaration(levels[0]);
    for (const name of [...this.#published.keys()]) if (!name.startsWith('--')) this.#published.delete(name);
    for (const [name, value] of [...own, ...(levels[0] ?? [])]) this.#published.set(String(name), String(value));
    let parent = this.#flow;
    for (let i = 1; i < levels.length; i++) {
      const box = doc.createElement('div');
      box.style.counterReset = declaration(levels[i]);
      parent.appendChild(box);
      this.#counterBoxes.push(box);
      parent = box;
    }
    parent.appendChild(this.#contentSlot);
  }

  /** The page's named strings, published on the host (*the page carries its conditions*, 2026-10-21, ruling 3): `--beltype-string-<name>-<which>` for each of GCPM's four keywords, the value as a CSS string. A margin cell reads one through its transliterated `content`, and a flow site through the host's rewrite of `string()`; both inherit it down the flat tree, which is why the properties are left unregistered (P39d). The four answers are the driver's (`closes.strings`), decided over the page's interval; nothing is decided here. */
  setStrings(strings: Record<string,Record<string,string>> = {}) {
    const key = JSON.stringify(strings);
    if (key === this.#stringKey) return;
    this.#stringKey = key;
    for (const prop of this.#stringProps) {
      this.style.removeProperty(prop);
      this.#published.delete(prop);
    }
    this.#stringProps = [];
    for (const [name, values] of Object.entries(strings)) {
      for (const which of STRING_KEYWORDS) {
        const prop = encodeStringProp(name, which);
        const value = cssString(values?.[which] ?? '');
        this.style.setProperty(prop, value);
        this.#stringProps.push(prop);
        this.#published.set(prop, value);
      }
    }
  }

  /**
   * The flow's literals, both halves of §5.2 on the view side: shift up by the collapsed leading margin the measure pass truncated (the first box's border top lands exactly at the area's top), and clip at the cut's own extent — a cut line box can overflow contentH while its ink starts above it, and the print text layer keeps ink, so the clip boundary is the Ledger's y, not the content edge.
   *
   * **And at the page area's edge where a block was divided** (*the first fragment is constructed*, 2026-09-15). §5.3 extends a divided box's content box to fill the fragmentainer, so on such a page the ink lawfully runs `extPx + costPx` past the cut and the clip has to follow it — which is exactly the withdrawn decision of *the ink stops at the fragmentainer*, safe now for the reason it was not then: the words after the cut are no longer in the tree, so nothing of the next page's content lies under the widened clip. The two numbers come from the account and sum to the page area by its own arithmetic; on every other page they are zero and this is the clip it always was.
   *
   * **The head of the clip is the page box, the foot is the cut** (*the page clips at its bleed area on the block axis too*, 2026-10-02). `bleed` names one clip and it is at the page box; the foot of the flow is not that clip but the cut, and it stays where it was. So the flow keeps `overflow-y: clip`, whose edge is its padding box, and gives that box a head: a block-start padding of one page's height with an equal negative margin leaves the content exactly where it stood and the clip's head edge above the page box, where the host's own clip takes over. The foot, `lead + used + ext + cost` below the flow's content top, is the same sum as ever, and `.flow` is `box-sizing: content-box`, so the height arithmetic is untouched. A caller that passes no `usedPx` gets no foot clip at all, and the root never does.
   *
   * **On the block axis alone** (*the page rendering clips at the bleed area*, 2026-09-18). Every sentence above is about where the cut fell, and a cut has no opinion about ink to the left or the right; the inline limit is the page box, which the host carries. The pair is what keeps the rest of this true: `clip` does not force the other axis to `auto` as `hidden` would, and it still makes no scroll container.
   */
  setFlow({ leadPx = 0, usedPx = null, extPx = 0, costPx = 0, reservePx = 0 }: { leadPx?: number; usedPx?: number|null; extPx?: number; costPx?: number; reservePx?: number; } = {}) {
    const lead = leadPx || 0;
    if (usedPx == null) {
      this.#flow.style.marginTop = `${-lead}px`;
      return;
    }
    this.#flow.style.marginTop = `${-(lead + this.#pageH)}px`;
    this.#flow.style.paddingTop = `${this.#pageH}px`;
    this.#flow.style.height = `${lead + usedPx + extPx + costPx + reservePx}px`; // reservePx: the room the page gave up to a repeated table footer, which stands below the cut (*the header repeats*)
    this.#flow.style.overflowX = 'visible';
    this.#flow.style.overflowY = 'clip';
  }

  /**
   * The author's own page context, as a sheet rather than as values — see `pageStyleText` above for the rules and the firewall. Null clears, which is a page whose conditions declared nothing.
   *
   * @param content - each margin box's `content`, transliterated (`capture.js`'s `transliterateContent`); `null` for a box that is not generated.
   */
  dress(pageStyle: PageStyle|null, content: Record<string,{ before: string; after: string|null; }|null> = {}) {
    const { sheet, text } = sheetFor(this.ownerDocument, pageStyle, content);
    this.#dressText = text;
    this.#reads = Object.fromEntries(Object.entries(content).map(([name, value]) => [name, value ? readsOf(`${value.before} ${value.after ?? ''}`) : []]));
    this.#shadow.adoptedStyleSheets = sheet ? [sheet] : [];
  }

  /**
   * The twelve flex — css-page-3 §5.3.2 over each horizontal band, on this page (*the margin boxes flex*, 2026-09-14). Called after the band's content is set, since the algorithm's whole input is what the boxes say.
   *
   * **The browser measures; `bandWidths` decides.** §5.3.2's inputs are each box's outer max-content and min-content widths, which are intrinsic sizes of a real box in a real font — the same question *page lengths are measured* answered by seating the value on a probe rather than by writing a unit table, and the same answer here for the same reason. The seat is the cells themselves: the band's tracks are set to `max-content` three times over, the three rects are read, then to `min-content`, and the three read again. Two layouts per band, no element created, and no second copy of the cell's dress to keep honest — a probe would have needed one, since a box's own padding and border count toward the outer width the section distributes.
   *
   * A box that is not generated carries no text and measures zero on both, which is §5.3.2's own assumption (*"boxes that are not generated are assumed to have a width and an outer width of zero"*) rather than a special case in this method.
   *
   * **The side bands keep equal thirds**, and that is a gap rather than a reading: §5.3.2's last paragraph applies the same rules down `@left-top`/`@left-middle`/`@left-bottom` with *width* replaced by *height*, so they are variable in the block direction too. Building it means giving the outer grid's row tracks the band treatment the columns just got, and the venue's print reader divides no side margin into a band, so the result could not be checked. Named on the checklist, not approximated here.
   */
  layoutBands() {
    // css-page-3 §5.2: a box is generated if and only if its computed `content` is not none, and the cell's `::before` carries that `content` (*a margin box exists by its content*, 2026-09-15; *the page carries its conditions*, 2026-10-21). Read here, after the dress and the margin boxes, for all sixteen: the band widths below read it, and an ungenerated cell paints nothing.
    const view = (this.ownerDocument.defaultView as Window);
    for (const cell of Object.values(this.#cells)) {
      const content = view.getComputedStyle(cell, '::before').content;
      cell.toggleAttribute('data-generated', !!content && content !== 'none' && content !== 'normal');
    }
    if (!this.#bandWidth) return;
    for (const [band, names] of Object.entries(HORIZONTAL_BANDS)) {
      const el = this.#bands[band];
      const cells = names.map((n) => this.#cells[n]);
      // Generation is in the key: an empty generated box and an ungenerated one measure the same and must not share an answer. So are the published values the box's `content` reads, which is what its text is now spelled from.
      const generated = cells.map((c) => c.hasAttribute('data-generated'));
      const keys = names.map((n, i) => `${this.#dressText} ${n} ${generated[i]} ${(this.#reads[n] ?? []).map((r) => `${r}=${this.#published.get(r) ?? ''}`).join(',')} ${cellKey(cells[i])}`);
      let pairs = keys.map((k) => INTRINSICS.get(k));
      if (pairs.some((p) => !p)) {
        const read = ( track: string) => {
          el.style.gridTemplateColumns = `${track} ${track} ${track}`;
          return cells.map((c) => c.getBoundingClientRect().width);
        };
        const max = read('max-content');
        const min = read('min-content');
        pairs = keys.map((k, i) => {
          const p = { min: min[i], max: max[i], generated: generated[i] };
          INTRINSICS.set(k, p);
          return p;
        });
      }
      const [wa, wb, wc] = bandWidths({ a: pairs[0], b: pairs[1], c: pairs[2], available: this.#bandWidth });
      el.style.gridTemplateColumns = `${wa}px ${wb}px ${wc}px`;
    }
  }

  /**
   * Adopt the root's named slots as this page's light children and forward each into its own slot (the chain of *forwarding delivery*, P10).
   *
   * **Two slots since the page stopped clipping inline** (*the page rendering clips at the bleed area*, 2026-09-18). The flow and the furniture used to share one, because one clip served both; now the flow's ink may leave the content area sideways and a fixed box's may not, so they are forwarded into two boxes with two clips. The chain is otherwise the one it has always been, once per slot, and the furniture slot is optional so a caller that delivers no fixed box passes nothing.
   */
  adopt(rootSlot: HTMLSlotElement, furnitureSlot: HTMLSlotElement|null = null) {
    this.appendChild(rootSlot);
    this.#contentSlot.assign(rootSlot);
    if (!furnitureSlot) return;
    this.appendChild(furnitureSlot);
    this.#furnitureSlot.assign(furnitureSlot);
  }

  /**
   * Give the page its content directly: the door for a host that is not the root (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`, ruling 3). The nodes become this page's light children and the content slot is assigned them, so they lay out in the flow exactly where the root's forwarded slot's content does.
   *
   * @remarks
   * **The nodes are assigned to the content slot, never appended inside the flow**, and both halves are measured (*given content*, P42, `packages/essay/probes/given-content.js`). Assigned, the content stands where the root's does: the slot is the one `setCounters` moves into its innermost counter box, so the wrappers stand between the flow and the content as they do for the root, the flow's clip and the grid are the same boxes, and every node lands at the root path's offsets to the pixel with the same counters. Appended inside the flow, the nodes would sit in the page's shadow tree, where no author sheet reaches them: the rules that size and number them stop applying, and a host would have to move the wrappers itself. A forwarded slot and a direct node are the same assignment one level apart; manual assignment takes any light child of the host.
   *
   * A second call replaces what the page was given, and no argument clears it. A page takes its content through one door, this one or `adopt`.
   *
   * @param nodes - the page's content in order: its blocks, or a slot of the host's own to forward.
   */
  setContent(...nodes: Node[]) {
    for (const node of this.#given) if (!nodes.includes(node) && node.parentNode === this) (node as ChildNode).remove();
    this.#given = nodes;
    for (const node of nodes) this.appendChild(node); // append first, assign after, as `adopt` does
    this.#contentSlot.assign(...(nodes as Array<Element | Text>));
  }

  /**
   * A margin box's own children: the running elements its `content` places, and any plain string standing between two of them (*the host rewrites what the parser drops*, 2026-09-14). Null or empty clears. Everything else a box says is its transliterated `content`, in the dress (*the page carries its conditions*, 2026-10-21, ruling 2), so a folio or a running head is no longer written here: the browser spells it on the cell's `::before`.
   *
   * **`element()` keeps the slot**: a running element is authored content rather than a value, so *content is one document* (I6) reaches it and it may not be flattened into text. Its part arrives as `{ slot, node }`, a forwarding slot and the root's clone of the element, and this cell takes a slot of its own assigned to that — one more level of exactly the chain the content area uses. What the cell holds is then the author's element, live and styled by the author's own cascade.
   *
   * **A host that is not the root hands the node itself** (see CHANGELOG 2026-10-28). A page outside the root's shadow tree has no shadow tree above it, and a `<slot>` outside one draws nothing, so there is no forwarding slot to give: the part is the node, this page's light child, and the cell's own slot is assigned it directly, the one level `setContent` has. The `{ slot, node }` form is unchanged, and the root keeps handing it.
   */
  setMarginBox(name: string, parts: Array<string|Node|{ slot: HTMLSlotElement; node: Element; }>|null) {
    const cell = this.#cells[name];
    if (!cell) return;
    const doc = this.ownerDocument;
    cell.replaceChildren(...(parts ?? []).map((part) => {
      if (typeof part === 'string') return doc.createTextNode(part);
      if ('nodeType' in part) { // the node itself: an element has a `slot` property of its own, so a node is told apart by the one a plain `{ slot, node }` lacks
        this.appendChild(part); // append first, assign after, as for the forwarding slot
        const slot = doc.createElement('slot');
        slot.assign((part as Element | Text));

        return slot;
      }
      this.appendChild(part.slot); // the forwarding slot lives as this page's light child, which is in the root's shadow tree — where the clone can reach it
      part.slot.assign(part.node); // append first, assign after: the order `adopt` uses, because a slot assigns what it was given once it is inside a shadow tree
      const slot = doc.createElement('slot');
      slot.assign(part.slot);
      return slot;
    }));
  }
}

if (!customElements.get('beltype-page')) customElements.define('beltype-page', BeltypePage);
