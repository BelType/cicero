/**
 * THE WORDS SHEET: what the engine does to a copy, written once as rules keyed on the words of `data-beltype` (*the piece words*, 2026-10-11; `.claude/plans/cicero-optimisation/data-beltype.md`, step 2).
 *
 * The copy says what it is in words — `split` and its two edges `start` and `end`, `wrapped`, `adjoin`, `away` — and this sheet says what each word does. One sheet does all the engine's trimming and hiding, and none of it is written inline, because an inline declaration would overwrite the author's own inline declaration, lose to the author's own `!important`, and be readable only by asking the inline style (see CHANGELOG 2026-10-11).
 *
 * **The rules are `!important`, in a cascade layer the engine declares first.** css-break-3 §5.2 truncates the margin at a break whatever the author wrote, and so do border and padding where the box does not wrap its fragments whole (§5.4) and the indent that only the box's first line takes: a truncation that an author's `!important` could defeat would be an author's rule outranking the specification. The cascade (css-cascade-5 §6.4.2) reverses layer order for important declarations: *an important declaration in an earlier layer beats one in a later layer, and an unlayered important declaration loses to every layered one*. So a rule that is `!important` in the first layer beats an author's `!important` whether the author layered it or not, and beats the author's normal declarations a fortiori. **Where the rules live is a measured decision.** A layer's place in the order is where it is first named, so the rules ride in the engine's own provision `<style>` (`seam/index.js`), which every host seats in the head before the author's sheets — the CLI, the dev server and the editing tools alike. The same rules in a constructed sheet adopted by script cost BelType's manual 3.5 % of a full run (interleaved runs against the engine before the words sheet: layout 1 295 ms against 1 420, with the rules unlayered, or in the provision `<style>`, back at 1 295), and a layer named by script after the document has been styled invalidates every style and lays it out again; so the adopted sheet and the one-line `<style>` that names the layer are the fallback, for a host that does not carry the provision (the essay's harness, a bare fixture) — slower, and the same in effect. **What the rules cannot beat** is an author's own inline `style` with `!important` — element-attached important declarations outrank every layer — and an author's layer named before the engine's (an HTML-lane document whose own `<style>` precedes the engine's head fragment); both are stated, neither is measured to occur.
 *
 * **Always on, unlike the root's breaks sheet.** The root's sheet (`root.js`) neutralises a copy's native breaks, and the measure takes it out while it reads the sources (`dress(off)`). These rules are different in kind: they trim and hide, the measure feed is laid out under them (a divided box's truncated margin is part of the room the cut was decided against), and no source ever wears a word (*the source document is never written*, C5), so a sheet keyed on words cannot touch a source and has nothing to be taken out for. Present from the first feed: `createMeasureContext` seats it.
 *
 * **The continuation dressing** is the words sheet's other half, for what a margin or an indent is not: a divided box's generated content and its first letter and line, withheld from the piece that did not begin the box and, for `::after`, from the piece that does not end it. It is a sheet of its own, unlayered, made by `ensureContinuationDressing` for any host that presents pieces — the root, or a view that holds its own pages (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`), at the moment that host first presents.
 *
 * **The values sheet** is the other half of the grammar (*Tailwind's trick at run time*): a value word, `slice:2`, reaches CSS as a custom property the registry names (`--beltype-slice: 2`) through one rule per distinct value written, in a constructed sheet of the engine's own, never inline — the attribute stays the one source of truth. It is unlayered and not important: an author may read it, and has no reason to fight it. **The property is registered as an `<integer>` that does not inherit**, because an unregistered custom property inherits and one that differs on the root of every piece differs on every element beneath it: measured on the BGD manual (headless Chromium, four runs each), a full run's presentation took 258 ms with the property unregistered and one rule inserted per number, 166 ms with all the rules delivered in one act, and 140 ms registered — which is what it took before the property existed. The cost of the registration is that a descendant of the piece's root reads the initial `0`, not the piece's number; the number is on the root, and a rule that wants it below writes `[data-beltype~="slice:2"] p`.
 *
 * @packageDocumentation
 */

import { CUT_OFF, LAYER, REGISTRY, RESUMED, selectorOf, WORDS_RULES } from './data-beltype.ts';

export { LAYER, WORDS_RULES };

/** The id of the one-line `<style>` that names the engine's layer first. */
export const LAYERS_ID = '__beltype-layers';

/** The custom property each value word is delivered into, from the registry. */
const PROPERTY_OF = new Map(REGISTRY.filter((e) => e.kind === 'value' && e.property).map((e) => [e.name, (e.property as string)]));

/** Register the value words' properties once per window: an integer that does not inherit (the registry says why). A property already registered is left as it is. */
function registerProperties(win: Window&typeof globalThis) {
  for (const property of PROPERTY_OF.values()) {
    try {
      win.CSS.registerProperty({ name: property, syntax: '<integer>', inherits: false, initialValue: '0' });
    } catch {
      // registered already, by an earlier engine in this window
    }
  }
}

/** What the engine seated in one document by script: the words sheet (only for a host whose provision does not carry the rules), the values sheet (only once a stylesheet names a value's property), and the value words delivered so far. */
export type Dressing = {
  words: CSSStyleSheet | null;
  values: CSSStyleSheet | null;
  delivered: Set<string>;
  /** whether the value words' properties are registered, which is done once a stylesheet the document wears names one. */
  registered: boolean;
};

const DRESSINGS: WeakMap<Document,Dressing> = new WeakMap<any, any>();

/** Does the document's head already carry the rules — in the provision `seam/index.js` writes? Then there is nothing to seat, and nothing to invalidate. */
function providesRules(doc: Document) {
  const provision = doc.head.querySelector('style[data-beltype~="cicero-provision"]');
  return !!provision && (provision.textContent ?? '').includes(WORDS_RULES);
}

/**
 * Make sure the document has the words sheet's rules, and answer its record. A document the provision reached already has them and nothing is seated; any other gets the layer named first in the head and the rules adopted after whatever it wears.
 *
 * **The document is asked, not remembered** ([*the engine asks the document for its sheets*](../../../.claude/decisions/cicero/the-engine-asks-the-document-for-its-sheets.md)), as `ensureContinuationDressing` does: a host that re-seats a kept `Document` empties its adopted sheets, so a later call adopts the words sheet again, and names the layer again, where the document no longer carries them.
 */
export function ensureDressing(doc: Document): Dressing {
  let dressing = DRESSINGS.get(doc);
  if (!dressing) {
    dressing = { words: null, values: null, delivered: new Set<any>(), registered: false };
    DRESSINGS.set(doc, dressing);
    if (providesRules(doc)) return dressing;
    dressing.words = new ((doc.defaultView as Window & typeof globalThis).CSSStyleSheet)();
    dressing.words.replaceSync(WORDS_RULES);
  }
  if (!dressing.words) return dressing;
  if (!doc.getElementById(LAYERS_ID)) {
    const layers = doc.createElement('style');
    layers.id = LAYERS_ID;
    layers.textContent = `@layer ${LAYER};`;
    doc.head.prepend(layers);
  }
  if (!doc.adoptedStyleSheets.includes(dressing.words)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, dressing.words];
  return dressing;
}

/** The continuation dressing each document wears. */
const CONTINUATIONS: WeakMap<Document,CSSStyleSheet> = new WeakMap<any, any>();

/**
 * Make sure the document wears the continuation dressing, and answer its sheet: a piece that resumes a box shows none of the box's beginnings, `::before`, `::marker`, `::first-letter` and `::first-line`, and a piece the cut passes through shows no `::after`. The sheet is made once per document and adopted after whatever the document wears; a later call adopts it again only where the document no longer wears it.
 *
 * **The document is asked, not remembered** ([*the engine asks the document for its sheets*](../../../.claude/decisions/cicero/the-engine-asks-the-document-for-its-sheets.md), 2026-10-20). A host may re-seat a document with `document.open()`, which keeps the `Document` and empties its adopted sheets; a sheet known to be made but no longer worn left the resumed pieces of seven pages their `::first-letter` rule (measured, Caster's DESIGN.md S89).
 *
 * **The five rules are unlayered and important, and keyed on the piece words at every depth** (*the cut divides its ancestors*, 2026-09-29): `fragments.js` marks exactly the proper ancestors of the cut's place, so a list item or a paragraph inside a divided section is dressed as its own box (`cases/75-the-marker-printed-twice`). Measured in Chromium 153: `content: none` on `::marker` withholds a square, a decimal and an author's own `::marker` content placed inside (the text moves to the content edge in all three) and a square placed outside (case 75's print), with no `list-style` needed, which is what reaches the author's `::marker { content }` that `list-style: none` would leave; `all: unset` on `::first-line` is honoured, a first line set at 40px on a 50px line coming back to the paragraph's own 20px, so no property need be named.
 */
export function ensureContinuationDressing(doc: Document): CSSStyleSheet {
  let sheet = CONTINUATIONS.get(doc);
  if (!sheet) {
    sheet = new ((doc.defaultView as Window & typeof globalThis).CSSStyleSheet)();
    sheet.replaceSync(`
    /* A FRAGMENT IS DRESSED AT THE EDGES THE BOX HAS THERE, two rules since the first fragment was constructed (2026-09-15): a fragment that resumes did not begin the box, and one the cut passes through does not end it. ::marker is the list item's first child (css-lists-3 §3.1) and ::first-line its first formatted line (css-pseudo-4 §2.1), and a fragment that resumes has neither. */
    ${RESUMED}::before { content: none !important; }
    ${RESUMED}::marker { content: none !important; }
    ${CUT_OFF}::after { content: none !important; }
    ${RESUMED}::first-letter { all: unset !important; }
    ${RESUMED}::first-line { all: unset !important; }
  `);
    CONTINUATIONS.set(doc, sheet);
  }
  if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  return sheet;
}

/** Which sheets already told us whether they name a property: sheet → the properties they name. A sheet's rules do not change under a run, and an edited document is a new sheet. */
const NAMES: WeakMap<CSSStyleSheet,Map<string,boolean>> = new WeakMap<any, any>();

/**
 * Does any stylesheet the document wears — its own or adopted, the engine's sheets keyed on words left out — name this custom property?
 *
 * **The value words are delivered to CSS only when a stylesheet asks** (*the piece words*, 2026-10-11). The word itself is always written, and a selector on it (`[data-beltype~="slice:2"]`) needs no delivery; what a custom property costs is the style engine's: registering one makes Blink resolve it for every element of the document, and measured on BelType's manual (278 pages, interleaved runs against the engine before this round) the registered property alone was 70 ms of 3 100. A document that never names `--beltype-slice` has nobody to deliver it to. A sheet this realm cannot read counts as naming it: the question is whether a reader could exist, and an unreadable sheet cannot say it has none. (A stylesheet is not the only reader — an inline `style` or a script could read the property — and neither is looked for: the property is documented as a stylesheet's.)
 */
function namedBySheets(doc: Document, property: string): boolean {
  for (const sheet of [...doc.styleSheets, ...doc.adoptedStyleSheets]) {
    if (isWordsSheet(doc, sheet)) continue;
    let known = NAMES.get(sheet);
    if (!known) NAMES.set(sheet, (known = new Map<any, any>()));
    let named = known.get(property);
    if (named === undefined) {
      try {
        named = [...sheet.cssRules].some((rule) => rule.cssText.includes(property));
      } catch {
        named = true;
      }
      known.set(property, named);
    }
    if (named) return true;
  }
  return false;
}

/**
 * Deliver value words to CSS: `slice:2` becomes the rule `[data-beltype~="slice:2"] { --beltype-slice: 2 }`, once per distinct word. A word whose key the registry gives no property is nobody's to deliver and is left alone.
 *
 * **Only for a document that names the property** (`namedBySheets`), and **all at once, before the elements that wear the words exist.** Changing an adopted sheet's rules invalidates the style of the whole document, and the document holds every page of the last presentation: a rule inserted per word, as the pieces were numbered, cost the BGD manual 118 ms of a 258 ms presentation (measured 2026-10-11). So the caller names every word it is about to write, and the sheet is replaced in one act — and not at all when nothing in the list is new.
 */
export function deliverValues(doc: Document, words: Iterable<string>) {
  const dressing = ensureDressing(doc);
  if (!dressing.registered) {
    if (![...PROPERTY_OF.values()].some((property) => namedBySheets(doc, property))) return;
    registerProperties((doc.defaultView as Window & typeof globalThis));
    dressing.registered = true;
  }
  let grew = false;
  for (const word of words) {
    const colon = word.indexOf(':');
    if (colon < 0 || !PROPERTY_OF.has(word.slice(0, colon)) || dressing.delivered.has(word)) continue;
    dressing.delivered.add(word);
    grew = true;
  }
  if (!grew && !dressing.values) return;
  // The document is asked, not remembered: a re-seated document wears no values sheet even when no word is new.
  dressing.values ??= new ((doc.defaultView as Window & typeof globalThis).CSSStyleSheet)();
  if (!doc.adoptedStyleSheets.includes(dressing.values)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, dressing.values];
  if (grew) dressing.values.replaceSync([...dressing.delivered].map((word) => `${selectorOf(word)} { ${PROPERTY_OF.get(word.slice(0, word.indexOf(':')))}: ${word.slice(word.indexOf(':') + 1)}; }`).join('\n'));
}

/** Is this adopted sheet one of the engine's three sheets keyed on words — the words sheet a host without the provision gets, the values sheet, and the continuation dressing? A host reading the sheets the document wears (`seam/client.js`' conditions key) leaves them out, as it leaves out the root's own sheets and the reads' delivery sheet. */
export function isWordsSheet(doc: Document, sheet: CSSStyleSheet) {
  if (sheet === CONTINUATIONS.get(doc)) return true;
  const dressing = DRESSINGS.get(doc);
  return !!dressing && (sheet === dressing.words || sheet === dressing.values);
}
