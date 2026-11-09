/**
 * THE READS — `target-counter()`, `target-counters()` and `target-text()`, delivered ([*a pointer is a read*](../../../.claude/decisions/cicero/a-pointer-is-a-read.md), decided 2026-10-03 and built the same day).
 *
 * A read is a site that shows a fact about another node. Chromium keeps a `target-counter(attr(href url), page)` declaration and fails it at computed-value time, so the host rewrites the function in place into `var(--beltype-read-…, "")` (`seam/rewrite.js`, the names `gcpm-encoding.js`'s) and this module puts the value into that property. The author's declaration stays where the author wrote it, so the author's cascade still decides which rule wins, and nothing is written on an author's element: the values arrive in one constructed sheet the engine adopts on the document, one rule per distinct target, keyed by the attribute the function reads — `:where([href="#x"])::before, :where([href="#x"])::after { --beltype-read-counter-attr-href-page-decimal: "4" }`. A literal address needs no key: its value is one per property, so its rule is `::before, ::after`. The capture reads adopted sheets (*the capture reads adopted sheets*), and an adopted sheet reaches the light DOM wherever it stands — the measure container's clones, the presented originals and their fragments alike.
 *
 * **Every read has a moment, and the moment says when it is delivered.** A written fact — `target-text()`, the target's own text — and a cascade fact — `target-counter()` of an author's counter, the counter after the target's own operations — are known before the run and delivered as their true values before it begins. A layout fact — `target-counter(<url>, page)`, the page the target's first word lands on — exists only once the pages do: it is reserved as `"0"` for the first run, delivered true after it, and the blocks that hold such reads are measured again, and only a block whose lines moved sends the run again with the delivered values standing, resumed from the first page that holds a moved box and stopped where it converges (*delivery resumes from the moved page*, 2026-10-21). Three runs at most; the build cannot fail, so on exhaustion the last true values stand and the console names the references that still moved.
 *
 * **A missing target shows nothing**: no declaration is delivered for it, the fallback `""` stands, the pseudo-element still has its box (the leader the author drew still draws), and the console names the link once per paginate.
 *
 * **The loop is a consumer's too, over a chain of its own** (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`, ruling 3). `settleReads`'s `run` and `blocksOf` are the door: a view that holds its own pages settles through this loop, with a `run` that refills the dirty entries of its chain, and never through a copy of it. What the loop assumes of its host, read in its body and its helpers: the sites are found in `doc`'s sheets and matched among `originals` (the whole document where none are given), and a site or a target counts only where it stands inside `blocksOf()`'s blocks, since the position index places it; so `originals` are the boxes that hold the blocks, never a presented copy of them. A target is the first element in tree order carrying the id among `originals` (`doc.getElementById`'s answer where none are given), which holds where the source boxes precede every copy that keeps the id, as `<beltype-root>` keeps its originals before its copies, or where the copies carry no id; a host's own element that carries an author's id is outside the originals and is never a target, and a `target-text()` target outside `blocksOf()`'s blocks shows nothing, as a counter or page target there does. The blocks are any elements in document order: nothing asks that they share a parent or be `body`'s children, since the position index, the counter walk and `pathOf` each walk one block on its own. The counter walk's ancestors are `html` and `body`, the two the driver's own walk reads, so another ancestor of the blocks must carry no counter operation. A changed site is measured on a clone of its block in the measure container, at its page's content width, the ruler the run measures with. The run's result carries an `account` whose entries have the driver's shape (`pos`, `cut`, `carried`, `blank`, `trace.forced`, and `closes` with `pageNumber`, `contentW`, `contentH` and `strings`), every address in `blocksOf()`'s numbering, and the `index` it was handed; and, where its pages publish values of their own, `laidFacts`, the page values each page was laid out under (a flow site reads them), which the loop compares the truth with in place of the table it handed the run (a run that returns none was laid out under the table it was handed, as the driver's is; see CHANGELOG 2026-10-28); a layout sent round again is handed `resume.at`, the addresses of the moved boxes, which such a `run` maps to the entries they dirty. The values reach every element in `doc`'s own tree through one adopted sheet, and the page facts are the page hosts' (`chase.js`). One assumption was the root's alone and is a parameter: the sheet that hides a reservation scopes its rules to `beltype-root`, and `hide` names another scope.
 *
 * @packageDocumentation
 */

import { READ_PREFIX, STRING_KEYWORDS, STRING_PROP_PREFIX, decodeRead, encodeStringProp, splitTopLevel } from './gcpm-encoding.ts';
import { sheetsCountInPseudos, styleSheetsOf } from './capture.ts';
import { format as formatCounter } from './counter-styles.ts';
import { collapse, contentTextOf, counterStatesAfter, counterValue, counterValues, documentOpsOf } from './document-state.ts';
import { indexBlocks, pageContaining, pageIntervals, pathOf } from './positions.ts';
import { isInlineBox } from './word-space.ts';
import { composeResumed } from './resume.ts';
import { createMeasureContext } from './measure.ts';
import { takeReport } from './gauge.ts';
import { cloneFlowPiece } from './fragments.ts';

import type { ReadFn } from './gcpm-encoding.ts';
import type { PagePublish } from './measure.ts';
import type { Address } from './positions.ts';
import type { Resumed } from './resume.ts';
import type { Keep } from './forcing-memo.ts';

/** One reference: an element whose `::before` or `::after` reads one property. */
export type Site = {
  /** The element the pseudo-element belongs to. */
  el: Element;
  /** The custom property its `content` reads. */
  prop: string;
  /** What the property means. */
  read: ReadFn;
  /** The address as written: the attribute's value, or the literal URL. */
  link: string | null;
  /** The selector the delivery is keyed by — `[href="#x"]`, `''` for a literal address — or null where the element carries no such attribute. */
  key: string | null;
  /** The element the address names, or null. */
  target: Element | null;
  /** The pseudo-elements the rule that reads the property styles — both where its selector names neither — which is what {@link hideReservations} hides while the number is a reservation. */
  pseudos: ('before' | 'after')[];
};

/** key → property → a CSS string literal. */
export type Values = Map<string, Map<string, string>>;

/** What one layout is laid out under, as the loop hands it to the run. */
export type Laid = {
  /** zero for the first layout. */
  attempt: number;
  /** the table the document-level sheet carries for this layout. */
  delivered: Values | null;
  /** the page values a flow site reads, per page, as the layout before decided them, or null for the reservation. */
  facts: PagePublish[] | null;
  sites: Site[] | null;
  /** the position index the loop already built. */
  index: ReturnType<typeof indexBlocks> | null;
  /** the references whose page number moved a line of their own in the layout before. */
  because?: string[];
  /** on a layout after the first: the layout before it, as the run returned it, and the addresses of the boxes whose lines the delivered values moved, which the run resumes from as from an edit (*delivery resumes from the moved page*, 2026-10-21). */
  resume?: { prior: any, at: Address[] } | null;
};

/** How many times the run may be laid out, the first layout and the resumes the delivered values send, before the last values are left standing (*a pointer is a read*: three, pagedNG's budget; a budget on resumes since *delivery resumes from the moved page*). */
export const MAX_RUNS = 3;

/** The reservation a forward layout read stands at during the first run, Egildo's ruling of 2026-10-03: wrong for nearly every reference, so nothing rests on it, and never printed, because the loop keeps the last true values. */
export const RESERVATION = '0';

/** A CSS string literal for any text: a quote, a backslash and a line break escaped, nothing else. */
export const cssString = (text: string) => `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\u0000-\u001f\u007f]/g, (ch) => `\\${ch.charCodeAt(0).toString(16)} `)}"`;

/** The selector a delivery is keyed by: the attribute the function reads, at the value this element carries. */
export const attrSelector = (attr: string, value: string) => `[${attr}=${cssString(value)}]`;

/**
 * The fragment an address names in this document, or null where it names none — no fragment, or a URL that points at another document (css-content-3 §2.6.1: *"the user agent must treat that as an error"*).
 *
 * @param link - the address as written.
 * @param baseURI - the document's base, which a relative address resolves against.
 * @param documentURL - the document's own URL.
 */
export function fragmentOf(link: string|null, baseURI: string, documentURL: string): string|null {
  if (link == null) return null;
  const v = link.trim();
  let url;
  try {
    url = new URL(v, baseURI);
  } catch {
    return null;
  }
  if (!v.startsWith('#') && url.href.split('#')[0] !== String(documentURL).split('#')[0]) return null;
  if (!url.hash || url.hash === '#') return null;
  try {
    return decodeURIComponent(url.hash.slice(1));
  } catch {
    return url.hash.slice(1);
  }
}

/** A rule's selector, the element it styles: the pseudo-elements a read stands in taken off each selector of the list. `a::after` → `a`; a bare `::after` → `*`. */
export function hostSelector(selector: string) {
  return splitTopLevel(selector)
    .map((s) => s.replace(/::?(?:before|after)\b/gi, '').trim())
    .map((s) => (!s ? '*' : /[>+~]$/.test(s) ? `${s} *` : s))
    .join(', ');
}

/**
 * A nested rule's selector list, resolved against its parent's resolved selector, so the result is a selector the document can ask on its own.
 *
 * @remarks
 * Chromium's CSSOM serialises a nested rule with its `&` explicit (`& a::after`). A selector with no `&` is the relaxed form: a descendant of its parent, or a child when it leads with a combinator (`> a`). Each `&` becomes `:is(<parent>)`, which keeps a parent's selector list one selector, so nesting two deep composes.
 *
 * @param selector - the nested rule's selector list, as the CSSOM spells it.
 * @param parent - the parent's resolved selector, or null at the top level, where there is nothing to resolve against.
 */
export function resolveNested(selector: string, parent: string|null): string {
  if (parent == null) return selector;
  // ponytail: a `&` inside a string or an attribute value is replaced too; a tokenizer would tell it apart, and no authored read needs one yet.
  return splitTopLevel(selector)
    .map((s) => (s.includes('&') ? s.replace(/&/g, () => `:is(${parent})`) : `:is(${parent}) ${s}`))
    .join(', ');
}

/** The deliveries as a sheet's text, one rule per key. Pure, so the shape is pinned without a browser. */
export function deliverySheetText(values: Values): string {
  const rules = [];
  for (const [key, props] of values) {
    if (!props.size) continue;
    const decls = [...props].map(([p, v]) => `${p}: ${v};`).join(' ');
    rules.push(key ? `:where(${key})::before, :where(${key})::after { ${decls} }` : `::before, ::after { ${decls} }`);
  }
  return rules.join('\n');
}

/** Two value tables, compared: the `key|prop` pairs whose value differs, either way. */
export function changedPairs(a: Values, b: Values) {
  const out: string[] = [];
  for (const [x, y] of [[a, b], [b, a]]) {
    for (const [key, props] of x) {
      for (const [prop, v] of props) {
        const id = `${key}|${prop}`;
        if (y.get(key)?.get(prop) !== v && !out.includes(id)) out.push(id);
      }
    }
  }
  return out;
}

const put = (into: Values, key: string|null, prop: string, value: string) => {
  if (key == null) return;
  if (!into.has(key)) into.set(key, new Map<any, any>());
  (into.get(key) as Map<string, string>).set(prop, value);
};

const merged = (...tables: Values[]): Values => {
  const out: Values = new Map<any, any>();
  for (const t of tables) for (const [key, props] of t) for (const [p, v] of props) put(out, key, p, v);
  return out;
};

const isPageRead = ( r: ReadFn) => r.fn === 'counter' && r.counter === 'page';

/**
 * The value a `target-counters()` read delivers: every instance of its counter in scope at the target, outermost first, each formatted in the read's style, joined by its separator.
 *
 * @remarks
 * The state is the counters after the target's own operations, as `target-counter()`'s is. A counter the document never mentioned has no instances and shows the empty string, the value `counters()` gives it (`counterValues`); `target-counter()` shows zero for one. `target-counters()` of the page counter is refused at parse, so no page read reaches here.
 */
export const countersText = (state: Record<string,number[]>|null|undefined, read: { counter: string; style: string; separator: string; }): string => counterValues(state, read.counter).map(( v: number) => formatCounter(v, read.style)).join(read.separator);

/**
 * Every style rule in the document's sheets that declares a `content`, with its selector resolved and the pseudo-elements it names — the one CSSOM walk {@link findSites} and {@link findPageSites} share.
 *
 * @remarks
 * Grouping rules, imported sheets and nested style rules are walked: a nested rule's selector is resolved against its parent's ({@link resolveNested}), and a nested declarations rule takes its parent's selector as its own.
 */
function contentRules(doc: Document): { selector: string; content: string; pseudos: ('before'|'after')[]; }[] {
  const rules: { selector: string; content: string; pseudos: ('before'|'after')[]; }[] = [];
  /**
   * @param selector - the rule's resolved selector.
   */
  const note = (selector: string, style: CSSStyleDeclaration) => {
    const content = style.getPropertyValue('content');
    if (!content) return;
    const named = [...new Set([...selector.matchAll(/::?(before|after)\b/gi)].map((m) => (m[1].toLowerCase() as 'before' | 'after')))];
    rules.push({ selector, content, pseudos: named.length ? named : ['before', 'after'] });
  };
  /**
   * @param parent - the resolved selector of the style rule this list nests in, null at the top level.
   */
  const visit = (list: CSSRuleList, parent: string|null) => {
    for (const rule of (list as Iterable<CSSRule & { selectorText?: string, style?: CSSStyleDeclaration, cssRules?: CSSRuleList, styleSheet?: CSSStyleSheet | null }>)) {
      if (rule.type === 1 && rule.selectorText != null && rule.style) {
        const selector = resolveNested(rule.selectorText, parent);
        note(selector, rule.style);
        if (rule.cssRules) visit(rule.cssRules, selector);
        continue;
      }
      // A nested declarations rule carries no selector of its own: its declarations are its parent's.
      if (parent != null && rule.selectorText == null && rule.style) {
        note(parent, rule.style);
        continue;
      }
      try {
        if (rule.cssRules) visit(rule.cssRules, parent);
        if (rule.styleSheet) visit(rule.styleSheet.cssRules, null);
      } catch { /* a sheet this realm cannot read declares nothing this engine can deliver */ }
    }
  };
  for (const sheet of styleSheetsOf(doc)) {
    try { visit(sheet.cssRules, null); } catch { /* as above */ }
  }
  return rules;
}

/**
 * The elements a rule's selector matches, the pseudo-element taken off, among the originals (or the whole document), never inside the measure container.
 *
 * @param keep - the memo's door (`forcing-memo.js`): what a selector matched in a top-level box is kept per box and selector, and asked again only of a box forgotten since (*a resumed run keeps its reads*, 2026-10-22).
 */
function elementsOf(doc: Document, selector: string, originals: Element[]|null, keep: Keep|null = null): Element[] {
  const els: Element[] = [];
  try {
    const host = hostSelector(selector);
    for (const scope of originals ?? [doc]) {
      const matched = () => {
        const out: Element[] = [];
        if (scope !== (doc as unknown) && (scope as Element).matches(host)) out.push((scope as Element));
        for (const el of scope.querySelectorAll(host)) out.push(el);
        return out;
      };
      const kept: Map<string,Element[]>|null = keep && scope !== (doc as unknown) ? keep('sites', scope, () => new Map<any, any>()) : null;
      let found = kept?.get(host);
      if (!found) {
        found = matched();
        kept?.set(host, found);
      }
      els.push(...found);
    }
  } catch { return []; }
  return els.filter((el) => !el.closest('#__beltype-measure'));
}

/** One flow site that reads a fact about the page it stands on (*the page carries its conditions*, 2026-10-21): an element whose `::before` or `::after` reads `counter(page)`, `counter(pages)` or a named string's page property. */
export type PageSite = {
  el: Element;
};

/**
 * Every flow site that reads a page fact, found in the CSSOM: a style rule whose `content` names the page counters or reads a `--beltype-string-` property the host's rewrite put there, and every element its selector matches. The host publishes the values (`chase.js`), so a site needs no delivery of its own; what it needs is the check, because the value is a layout fact and its width may move a line.
 *
 * @param originals - as {@link findSites}.
 * @param keep - as {@link findSites}.
 * @returns null where no rule reads a page fact.
 */
export function findPageSites(doc: Document, originals: Element[]|null = null, keep: Keep|null = null): PageSite[]|null {
  const rules = contentRules(doc).filter((r) => r.content.includes(STRING_PROP_PREFIX) || /counters?\(\s*pages?\s*[,)]/.test(r.content));
  if (!rules.length) return null;
  const seen = new Set<any>();
  const sites: PageSite[] = [];
  for (const { selector } of rules) {
    for (const el of elementsOf(doc, selector, originals, keep)) {
      if (seen.has(el)) continue;
      seen.add(el);
      sites.push({ el });
    }
  }
  return sites.length ? sites : null;
}

/** The flow sites that read the page total, as the rule that reads it names them: what {@link hideReservations} paints invisible while the total is unknown, since a flow site reads `0` until then (`chase.ts`'s `setCounters`). A `counter(page)` and a named string are true from the first page and are not among them. */
export function totalSites(doc: Document): Pick<Site,'key'|'pseudos'>[] {
  return contentRules(doc)
    .filter((r) => /counters?\(\s*pages\s*[,)]/.test(r.content))
    .map((r) => ({ key: hostSelector(r.selector), pseudos: r.pseudos }));
}

/** What every page of a run publishes, as the measure wears it: the page's number and the document's total, and its named strings' properties (`chase.js`'s `setCounters` and `setStrings`, the same values). */
export function pageFactsOf(account: Array<{ closes: { pageNumber: number; strings?: Record<string,Record<string,string>>; }; }>): PagePublish[] {
  return account.map((entry) => {
    const props: Record<string,string> = {};
    for (const [name, values] of Object.entries(entry.closes.strings ?? {})) for (const which of STRING_KEYWORDS) props[encodeStringProp(name, which)] = cssString(values?.[which] ?? '');
    return { counterReset: `page ${entry.closes.pageNumber} pages ${account.length}`, props };
  });
}

/**
 * Every reference in the document, found in the CSSOM: a style rule whose `content` reads a `--beltype-read-` property, and every element its selector matches.
 *
 * @remarks
 * The selector is asked with the pseudo-element taken off, so an element is a site where the author's rule matches it — whether a later rule overrides its `content` is the browser's cascade, and a value delivered to an element that never reads it costs one declaration and shows nothing. Grouping rules, imported sheets and nested style rules are walked: a nested rule's selector is resolved against its parent's ({@link resolveNested}), so `& a::after` inside `.toc` is asked as `:is(.toc) a`, and a nested declarations rule takes its parent's selector as its own. A `&` inside a string or an attribute value is a stated limit (see {@link resolveNested}).
 *
 * **The search reads the originals and never the copies** (2026-10-08). A document that has been presented carries a clone of every box on every page it shows (`[data-beltype~="fragment"]`), and a search over the whole document met each reference once per copy — 4 836 sites for 39 real ones on a 123-page manual, each one a site the loop then walked. A host that has presented hands the top-level boxes it took at intake; the search asks each of them, and a first run, which has no copies to meet, asks the document.
 *
 * @param originals - the intake's top-level boxes (blocks, fixed boxes, running elements); absent, the whole document is searched.
 * @param keep - the memo's door (`forcing-memo.js`): the elements each rule's selector matched in each of the originals are kept per box (*a resumed run keeps its reads*, 2026-10-22). The rules are read from the sheets every call, and a site's link and target from the element every call: a target may stand in a box an edit replaced.
 * @returns null where the document declares no read, which is every document but a few.
 */
export function findSites(doc: Document, originals: Element[]|null = null, keep: Keep|null = null): Site[]|null {
  const rules: { selector: string; props: string[]; pseudos: ('before'|'after')[]; }[] = contentRules(doc)
    .filter((r) => r.content.includes(READ_PREFIX))
    .map((r) => ({ selector: r.selector, props: [...r.content.matchAll(/var\(\s*(--beltype-read-[^\s,)]+)/g)].map((m) => m[1]), pseudos: r.pseudos }));
  if (!rules.length) return null;

  const sites: Site[] = [];
  const seen: Map<Element,Set<string>> = new Map<any, any>();
  for (const { selector, props, pseudos } of rules) {
    for (const el of elementsOf(doc, selector, originals, keep)) {
      for (const prop of props) {
        const read = decodeRead(prop);
        if (!read) continue;
        const mine = seen.get(el) ?? seen.set(el, new Set<any>()).get(el);
        if ((mine as Set<string>).has(prop)) continue; // two rules reading one property on one element are one reference
        (mine as Set<string>).add(prop);
        const link = read.attr != null ? el.getAttribute(read.attr) : read.url;
        const fragment = fragmentOf(link, doc.baseURI, doc.URL);
        sites.push({
          el,
          prop,
          read,
          link,
          key: read.attr != null ? (link == null ? null : attrSelector(read.attr, link)) : '',
          target: fragment == null ? null : targetOf(doc, fragment, originals),
          pseudos
        });
      }
    }
  }
  return sites.length ? sites : null;
}

/** The element a fragment names: `doc.getElementById`'s answer, or, where the host hands its originals, the first element carrying the id among them, so a host's own element that shares an author's id is never a target. */
function targetOf(doc: Document, fragment: string, originals: Element[]|null): Element|null {
  const first = doc.getElementById(fragment);
  if (!originals || !first || originals.some((box) => box.contains(first))) return first;
  const selector = `[id="${fragment.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\a ')}"]`;
  for (const box of originals) {
    const el = box.id === fragment ? box : box.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/** The engine's one delivery sheet per scope, replaced at every delivery and withdrawn when a paginate finds nothing to deliver. A scope is any object the host holds for one view of the document (the document itself where none is named), so two hosts in one document keep a sheet each (fix/scope-per-view, 2026-11-08). */
const SHEETS = new WeakMap<object, CSSStyleSheet>();

/** The text each engine sheet last carried: a sheet whose text is unchanged is not rewritten, since `replaceSync` restyles the document whether or not anything differs (*the reads loop writes only what changed*, CHANGELOG Unreleased). */
const SHEET_TEXT = new WeakMap<any, string>();
const write = (sheet: any, text: string) => { if (SHEET_TEXT.get(sheet) !== text) { sheet.replaceSync(text); SHEET_TEXT.set(sheet, text); } };

/** Every sheet the engine made, whatever its scope: what {@link isDeliverySheet} asks. */
const OWN = new WeakSet<object>();

/** Deliver a table of values: one constructed sheet per scope, adopted once, its text replaced. The rules still reach every element of `doc` that matches, scope or none: the scope keeps the sheets apart, not the elements. */
export function deliver(doc: Document, values: Values, scope: object = doc) {
  let sheet = SHEETS.get(scope);
  if (!sheet) {
    sheet = new ((doc.defaultView as Window & typeof globalThis).CSSStyleSheet)();
    SHEETS.set(scope, sheet);
    OWN.add(sheet);
  }
  write(sheet, deliverySheetText(values));
  if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
}

/** The engine's one hiding sheet per scope: the rule that paints a reservation invisible while the pages are still being cut (*the pages are cut as far as they are asked*, 2026-10-12). */
const HIDERS = new WeakMap<object, CSSStyleSheet>();

/** Is this adopted sheet one of the engine's own — the delivery sheet (the values a run delivered, rewritten every run) or the sheet that hides a reservation until its true number is delivered? */
export const isDeliverySheet = (doc: Document, sheet: CSSStyleSheet) => OWN.has(sheet);

/**
 * The hiding sheet's text: one rule per distinct address the reserved page reads are keyed by, naming the pseudo-elements that read them, scoped to the presented document (`beltype-root`, or the scope a host that is not the root names). Pure, so the shape is pinned without a browser.
 *
 * @remarks
 * `visibility: hidden` keeps the box and so its width — the line does not move when the number arrives — and takes the whole pseudo-element's ink with it, which for a contents entry whose leader is drawn by the same `::after` is the leader too, until the number is true. A literal address (`url(#x)`) is keyed by nothing and its delivery rule applies to every pseudo-element of the document, so there is nothing to scope the hiding to: it is left showing the reservation (a stated limit).
 *
 * @param sites - the page reads that are still at the reservation.
 * @param scope - the selector of the element the presented pages stand in.
 */
export function hideSheetText(sites: Pick<Site,'key'|'pseudos'>[], scope: string = 'beltype-root'): string {
  const byKey: Map<string,Set<string>> = new Map<any, any>();
  for (const s of sites) {
    if (!s.key) continue;
    if (!byKey.has(s.key)) byKey.set(s.key, new Set<any>());
    for (const p of s.pseudos) (byKey.get(s.key) as Set<string>).add(p);
  }
  return [...byKey].map(([key, pseudos]) => [...pseudos].map((p) => `${scope} :where(${key})::${p}`).join(', ') + ' { visibility: hidden !important; }').join('\n');
}

/**
 * Paint the reservations invisible: the page numbers the cuts so far do not know yet (*the pages are cut as far as they are asked*, Egildo's ruling 1 of 2026-10-12, on the note's recommendation). A document shown before it is complete must not show `0` where a page number will stand.
 *
 * @param selector - as {@link hideSheetText}'s `scope`.
 * @param scope - the host's token for this view, as {@link deliver}'s.
 */
export function hideReservations(doc: Document, sites: Pick<Site,'key'|'pseudos'>[], selector: string | undefined = undefined, scope: object = doc) {
  const text = hideSheetText(sites, selector);
  if (!text) return;
  let sheet = HIDERS.get(scope);
  if (!sheet) {
    sheet = new ((doc.defaultView as Window & typeof globalThis).CSSStyleSheet)();
    HIDERS.set(scope, sheet);
    OWN.add(sheet);
  }
  write(sheet, text);
  if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
}

/** Take the hiding sheet off: the true numbers are delivered, or there is nothing left to hide. */
export function showReservations(doc: Document, scope: object = doc) {
  const sheet = HIDERS.get(scope);
  if (sheet && doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
}

/** Take the delivery sheet off the document, where one was adopted — a second paginate of a document that no longer declares a read leaves nothing behind. */
export function withdraw(doc: Document, scope: object = doc) {
  const sheet = SHEETS.get(scope);
  if (sheet && doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
  showReservations(doc, scope);
}

/**
 * The written and cascade facts, before any run: every `target-text()`, and every `target-counter()` and `target-counters()` of a counter other than `page`.
 *
 * @param context - `index`: the position index over these blocks, where the caller has built it (the run's own is the same walk); `keep`: the memo's door, through which the counter walk takes the parts of the blocks no edit replaced (`document-state.js`' `documentOpsOf`).
 * @returns `unread`: references to a target the counter walk never reaches (inside a `display: none` subtree or a fixed box), which show nothing.
 */
export function staticValues(sites: Site[], { doc, blocks, index = null, keep = null }: { doc: Document; blocks: Element[]; index?: ReturnType<typeof indexBlocks>|null; keep?: Keep|null; }): { values: Values; unread: Site[]; } {
  const values: Values = new Map<any, any>();
  const unread = [];
  const counted = sites.filter((s) => s.target && (s.read.fn === 'counter' || s.read.fn === 'counters') && !isPageRead(s.read));
  let states = new Map<any, any>();
  if (counted.length) {
    const win = (doc.defaultView as Window);
    const ops = documentOpsOf(blocks, index ?? indexBlocks(blocks), {
      styleOf: (el) => win.getComputedStyle(el),
      pseudoStyleOf: sheetsCountInPseudos(doc) ? (el, pseudo) => win.getComputedStyle(el, pseudo) : null,
      ancestors: [doc.documentElement, doc.body].filter(Boolean),
      marks: new Set(counted.map((s) => (s.target as Element))),
      keep
    });
    states = counterStatesAfter(ops);
  }
  for (const s of sites) {
    if (!s.target || isPageRead(s.read)) continue;
    if (s.read.fn === 'text') {
      // css-content-3 §2.6.3's `content` keyword is the element's string value, `content()`'s own reading (document-state's `contentTextOf` and `collapse`, which leave out what a printer made from generated content); `before`, `after` and `first-letter` are read as `content`, the same stated limit `string-set` has.
      put(values, s.key, s.prop, cssString(collapse(contentTextOf(s.target))));
      continue;
    }
    const state = states.get(s.target);
    if (!state) { unread.push(s); continue; }
    if (s.read.fn === 'counters') { put(values, s.key, s.prop, cssString(countersText(state, s.read))); continue; }
    put(values, s.key, s.prop, cssString(formatCounter(counterValue(state, s.read.counter), s.read.style)));
  }
  return { values, unread };
}

/**
 * The layout facts, after a run: the page each page read's target lands on, as the ledger assigned it — the page whose interval holds the target's first word, over the intervals `root.pageOf` reads (`positions.js`'s `pageContaining`).
 *
 * @remarks
 * Two stated limits, both the word space's: a target with no word of its own lands where the next word does, and a word inside a box sliced at the page edge reads the last slice's page. `pageOf`'s refusals are not taken here, because they are about the whole top-level block, and a top-level block in a BelType document is a chapter: they left 19 of the manual's 191 contents entries without a number (measured). A target outside the flow (a running element, a fixed box) has no page and shows nothing.
 */
export function pageValues(sites: Site[], { account, index }: { account: Array<{ pos: number|null; closes: { pageNumber: number; }; }>; index: ReturnType<typeof indexBlocks>; }): { values: Values; unplaced: Site[]; } {
  const pages = pageIntervals(account, index.bases, index.endOf);
  const values: Values = new Map<any, any>();
  const unplaced = [];
  for (const s of sites) {
    if (!s.target || !isPageRead(s.read)) continue;
    const entry = index.entryFor(s.target);
    const page = entry ? pageContaining(pages, { b: entry.block, w: entry.before }) : null;
    if (page == null) { unplaced.push(s); continue; }
    put(values, s.key, s.prop, cssString(formatCounter(account[page].closes.pageNumber, (s.read as { style: string }).style)));
  }
  return { values, unplaced };
}

/**
 * The value every page read whose target exists starts the first run at: the reservation, or — where a resumed run is handed the values the run before it delivered — the value that run left, for every reference it knew.
 *
 * @param warm - the table the previous run's layout was cut under (*warm start*, 2026-10-08).
 */
export function reservations(sites: Site[], warm: Values|null = null): Values {
  const values: Values = new Map<any, any>();
  for (const s of sites) if (s.target && isPageRead(s.read)) put(values, s.key, s.prop, warm?.get(s.key ?? '')?.get(s.prop) ?? cssString(RESERVATION));
  return values;
}

/**
 * The lines of the box each site stands in, as the Gauge reads them: its height and the line of every word. Measured on a clone of the site's top-level block at the content width of the page the site is on — the run's own measure, the same ruler — so two readings taken either side of a delivery say whether the delivery moved a line.
 *
 * **A site that reads a page fact is measured with its page's values standing** (*the page carries its conditions*, 2026-10-21): `publishFor` hands the values a page publishes, which the measure container wears, so the clone reads them as the presented page does; such sites are grouped by their page as well as their block.
 *
 * @param publishFor - the page facts to measure under; absent, none, as every cross-reference is measured.
 */
export function linesOfSites<S extends { el: Element }>(doc: Document, sites: S[], { account, index }: { account: Array<{ closes: { contentW: number; contentH: number; }; }>; index: ReturnType<typeof indexBlocks>; }, blocks: Element[], publishFor: ((page: number) => PagePublish|null)|null = null): Map<S,string> {
  const pages = pageIntervals((account as any), index.bases, index.endOf);
  const groups: Map<string,{ b: number; page: number; sites: S[]; }> = new Map<any, any>();
  for (const s of sites) {
    const entry = index.entryFor(s.el);
    if (!entry) continue; // a site outside the flow (a running element's, a fixed box's) holds no line the cuts read
    const page = pageContaining(pages, { b: entry.block, w: entry.before }) ?? 0;
    const id = `${entry.block}|${account[page].closes.contentW}${publishFor ? `|${page}` : ''}`;
    if (!groups.has(id)) groups.set(id, { b: entry.block, page, sites: [] });
    (groups.get(id) as { sites: S[] }).sites.push(s);
  }
  const out = new Map<any, any>();
  for (const { b, page, sites: group } of groups.values()) {
    const { contentW, contentH } = account[page].closes;
    const ctx = createMeasureContext(doc, contentW);
    const { clone, cloneOf } = cloneFlowPiece(blocks[b]);
    const report = takeReport(ctx.measure([clone], publishFor?.(page) ?? null), { contentHeight: contentH });
    for (const s of group) {
      let box = null;
      for (let e = cloneOf.get(s.el) ?? null; e && !box; e = e.parentElement) {
        const b2 = report.boxOf(e);
        if (b2 && !b2.inline) box = b2;
      }
      out.set(s, box ? `${box.rect.height}:${report.wordsOf(box).map((w) => w.line).join(',')}` : '');
    }
    ctx.dispose();
  }
  return out;
}

/** The page each flow site stands on: the page whose interval holds the site's element's first word (`positions.js`'s `pageContaining`), as `linesOfSites` groups it. A site outside the flow has none. */
function sitePages(sites: PageSite[], { account, index }: { account: Array<{ pos: number|null; }>; index: ReturnType<typeof indexBlocks>; }): Map<PageSite,number> {
  const pages = pageIntervals((account as any), index.bases, index.endOf);
  const out = new Map<any, any>();
  for (const s of sites) {
    const entry = index.entryFor(s.el);
    const page = entry ? pageContaining(pages, { b: entry.block, w: entry.before }) : null;
    if (page != null) out.set(s, page);
  }
  return out;
}

/** The address of the box a site's lines stand in, at its first word: the nearest box the Ledger cuts at, climbing as the seam's `addressOf` climbs, since an inline box is not a place a page resumes at. This is the edit a delivery that moved the site's lines makes (*delivery resumes from the moved page*, 2026-10-21). Null for a site outside the flow. */
function boxAddress(site: { el: Element; }, index: ReturnType<typeof indexBlocks>, blocks: Element[]): Address|null {
  const entry = index.entryFor(site.el);
  if (!entry) return null;
  const block = blocks[entry.block];
  let box = site.el;
  while (box !== block && box.parentElement && isInlineBox(box)) box = box.parentElement;
  return { path: pathOf(box, block, entry.block), word: 0, px: null };
}

/**
 * The loop: reserve, run, deliver, check, and resume only from a moved line (*a pointer is a read*; *delivery resumes from the moved page*). `paginate` is its one caller inside the engine, so every host of the root — the seam's client, the essay's, the editing tools' frame — gets it by entering the engine the one way they all do; a view that holds its own pages calls it with a `run` of its own (the module header says what the loop assumes of it).
 *
 * **The run is told what it lays out under** (*the run resumes from an entry*, build two, 2026-10-08): `run` is handed `{ attempt, delivered, sites, index }` — which attempt this is (zero for the first), the table of values the document-level sheet carries for that layout, the sites, and the position index the settle loop already built — and the result comes back with the table the layout it returns was cut under. A resumed run compares the two tables across calls, and a delivered value that changed is a changed condition on the page holding its site.
 *
 * **A resumed run starts from the numbers the run before it left** (*warm start*, 2026-10-08; LaTeX's `.aux` file, Typst's convergence loop). `warm` is the table the previous run's layout was cut under: every page read it knew starts at its value there, a reference it did not know at the reservation. The first run is then laid out under numbers that are nearly always the true ones, `changed` below is empty for every reference whose page did not move, and the lines are checked only for the ones whose page did — an edit that shifts no page checks nothing, where the reservation made every page read a changed one and measured the lot (78 ms of 180 on a 123-page manual). Nothing else moves: the loop still stops on a layout whose delivered numbers are its own, still runs three at most, and still leaves the true numbers standing.
 *
 * **The `delivered` it returns is the table the layout is valid under**, which is the numbers it was cut under unless the loop ended on a layout the true numbers do not move a line of: then it is the true numbers, because the lines are what the cut reads and the check just showed them equal. Returning the reservation there (what the first run of every document that did not need a second ended on) would make the next resumed run's warm start the reservation again, and the next edit measure every reference once more.
 *
 * **A flow site that reads a page fact joins the check** (*the page carries its conditions*, 2026-10-21). `counter(page)`, `counter(pages)` and a `string()` the host rewrote are published by the page host, so such a site needs no delivery; what it needs is the check, because its value is a layout fact. The first run is measured with no page values standing — the measure has no page, so the site reads its reservation, `0` for a counter nobody reset and the fallback `""` for a string — and afterwards each site's block is measured again with its page's values set on the measure container (`pageFactsOf`); a moved line sends the run round again with every page's values standing as this run decided them (`facts`), and the loop stops where a run produces the values it was laid out under, three runs at most, exactly as a cross-reference's does.
 *
 * **A layout sent round again resumes from the one before it** (*delivery resumes from the moved page*, 2026-10-21). A delivered value that moves a line is an edit at its site's page, so `run` is handed `resume`, the layout just checked and the addresses of the boxes whose lines moved, and the driver restarts one page before the first of them, re-cuts, and stops where it converges past the last, exactly as it resumes from a host's edit. The result's `resumed` and `why` stay the call's: two resumes compose into one from the prior the host handed (`resume.js`' `composeResumed`), a whole layout anywhere in the loop makes `resumed` null, and each resumed layout leaves a `cicero:reads-run` measure naming the pages it cut again.
 *
 * @param how - `run` lays the document out once, whole or resumed (`because`: the references whose page number moved a line of their own in the run before, when this is not the first; `facts`: the page values a flow site reads, per page, as the run before decided them, or null for the reservation; it returns `laidFacts` beside `account` when the page values it was laid out under are not the ones it was handed); `blocksOf` names the top-level blocks; `originals` the intake's top-level boxes, where the document has been presented (see {@link findSites}); `warm` and `warmFacts` the tables the previous run's layout was cut under, for a run that resumes; `hide` that pages are shown before the run is complete (*the pages are cut as far as they are asked*), so the reservations still standing are painted invisible until the true numbers are delivered, under `<beltype-root>` for `true` and under the selector a string names for a host that is not the root; `scope` an object the host holds for this view (the document where absent), which keeps this view's delivery and hiding sheets apart from another view's in the same document; `keep` the memo's door, through which the site search, the position index and the counter walk take the parts of the boxes no edit replaced (*a resumed run keeps its reads*, 2026-10-22). A `run` that answers `complete: false` laid out only part of the document (a view's chain that stopped short): the loop ends there, without checking or delivering page values, so the reservations stay hidden and the values it returns are the ones that layout was cut under; the driver's own run is always complete.
 */
export async function settleReads<R extends { account: any[], index: ReturnType<typeof indexBlocks>, resumed?: Resumed | null, why?: string | null, laidFacts?: PagePublish[] | null, complete?: boolean }>(doc: Document, { run, blocksOf, originals = null, warm = null, warmFacts = null, hide = false, keep = null, scope = doc }: { run: (laid: Laid) => Promise<R>; blocksOf: () => Element[]; originals?: Element[]|null; warm?: Values|null; warmFacts?: PagePublish[]|null; hide?: boolean|string; keep?: Keep|null; scope?: object; }): Promise<R&{ resumed: Resumed|null; why: string|null; delivered: Values|null; facts: PagePublish[]|null; reads: { references: number; pageSites: number; runs: number; unsettled: string[]; }|null; }> {
  let t = performance.now(); // the site search is the reads' own cost and is inside their measure (*a resumed run keeps its reads*, 2026-10-22)
  const found = findSites(doc, originals, keep);
  const pageSites = findPageSites(doc, originals, keep);
  if (!found && !pageSites) {
    withdraw(doc, scope);
    const once = await run({ attempt: 0, delivered: null, facts: null, sites: null, index: null });
    return { ...once, resumed: once.resumed ?? null, why: once.why ?? null, delivered: null, facts: null, reads: null };
  }
  const sites = found ?? [];
  const name = ( s: Site|PageSite) => ('read' in s ? `<${s.el.tagName.toLowerCase()}${s.link == null ? '' : ` ${s.read.attr ?? 'url'}="${s.link}"`}>` : `<${s.el.tagName.toLowerCase()}${s.el.id ? ` id="${s.el.id}"` : ''}>`);
  const named = ( list: Array<Site|PageSite>) => [...new Set(list.map(name))].join(', ');
  const blocks = blocksOf();
  // A text target counts only inside the blocks, as every other target does through the position index and the counter walk: an element outside them (a host's own) is no target, and the reference shows nothing.
  for (const s of sites) if (s.target && s.read.fn === 'text' && !blocks.some((b) => b.contains(s.target))) s.target = null;
  // One walk of the words, shared with the run (*the run resumes from an entry*, build two: 60 ms of every manual run was this walk, done twice). The counter log is not shared, and the reason is worth a line: it is read here before the run registers the GCPM properties, and an unregistered `string-set` inherits, so a log taken now would assign every heading's string to its descendants too.
  const index = indexBlocks(blocks, undefined, undefined, keep);
  const fixed = staticValues(sites, { doc, blocks, index, keep });
  const paged = sites.filter((s) => s.target && isPageRead(s.read));
  let delivered = reservations(sites, warm);
  if (found) deliver(doc, merged(fixed.values, delivered), scope);
  else withdraw(doc, scope);
  if (hide) hideReservations(doc, [...paged.filter((s) => delivered.get(s.key ?? '')?.get(s.prop) === cssString(RESERVATION)), ...(pageSites ? totalSites(doc) : [])], hide === true ? undefined : hide, scope);
  performance.measure('cicero:reads', { start: t, end: (t = performance.now()), detail: { references: sites.length, pageSites: pageSites?.length ?? 0 } });

  let runs = 0;
  let moved: Array<Site|PageSite> = [];
  let because: Array<Site|PageSite> = [];
  let unplaced: Site[] = [];
  let result;
  let laidUnder: Values;
  /** The page values the layout is cut under: the reservation (null) on a first run. */
  let facts: PagePublish[]|null = warmFacts;
  let laidFacts: PagePublish[]|null;
  /** What the next layout resumes from: the layout just checked and the boxes whose lines moved. */
  let resume: Laid['resume'] = null;
  /** The call's own `resumed` and `why`, relative to the prior the host handed. */
  let resumed: Resumed|null = null;
  let why: string|null = null;
  for (;;) {
    laidUnder = merged(fixed.values, delivered);
    laidFacts = facts;
    const started = performance.now();
    result = await run({ attempt: runs, delivered: found ? laidUnder : null, facts: laidFacts, sites: found, index, because: because.map(name), resume });
    laidFacts = result.laidFacts ?? laidFacts; // the page values the layout was cut under are the run's to say; a run that says none was cut under the ones it was handed
    if (runs === 0) {
      resumed = result.resumed ?? null;
      why = result.why ?? null;
    } else {
      performance.measure('cicero:reads-run', { start: started, end: performance.now(), detail: { run: runs + 1, resumed: result.resumed ?? null, why: result.why ?? null } });
      resumed = composeResumed(resumed, result.resumed ?? null);
      if (!resumed) why ??= result.why ?? null;
    }
    runs++;
    t = performance.now();
    if (result.complete === false) { // a partial chain is not the document: its pages place only the targets cut so far, so the reservations stay hidden and the table it was laid out under stays the warm one
      facts = laidFacts;
      break;
    }
    showReservations(doc, scope); // the run is complete: what was reserved is delivered true on the next lines, or was true already
    const truth = pageValues(paged, result);
    unplaced = truth.unplaced;
    const changed = new Set(changedPairs(delivered, truth.values));
    // The page facts the sites read, as this run decided them, against the ones it was laid out under: a site whose page's values differ is a site to check.
    const truthFacts = pageSites ? pageFactsOf(result.account) : null;
    const pageOfSite = pageSites ? sitePages(pageSites, result) : new Map<any, any>();
    const factOf = ( table: PagePublish[]|null,  page: number) => table?.[page] ?? null;
    const shifted = (pageSites ?? []).filter((s) => { const page = pageOfSite.get(s); return page != null && JSON.stringify(factOf(laidFacts, page)) !== JSON.stringify(factOf(truthFacts, page)); });
    if (!changed.size && !shifted.length) { // converged: the values this run was laid out with are the values it produced
      facts = laidFacts;
      break;
    }
    const touched = paged.filter((s) => changed.has(`${s.key}|${s.prop}`));
    const before = linesOfSites(doc, touched, result, blocks);
    const beforePage = linesOfSites(doc, shifted, result, blocks, (page) => factOf(laidFacts, page));
    if (found) deliver(doc, merged(fixed.values, truth.values), scope);
    delivered = truth.values;
    facts = truthFacts;
    const after = linesOfSites(doc, touched, result, blocks);
    const afterPage = linesOfSites(doc, shifted, result, blocks, (page) => factOf(truthFacts, page));
    moved = [...touched.filter((s) => before.get(s) !== after.get(s)), ...shifted.filter((s) => beforePage.get(s) !== afterPage.get(s))];
    performance.measure('cicero:reads-check', { start: t, end: (t = performance.now()), detail: { run: runs, changed: changed.size, shifted: shifted.length, moved: moved.length } });
    if (!moved.length) break; // the true values stand on this layout and move none of its lines
    if (runs >= MAX_RUNS) break; // the build cannot fail: the last true values stand, and the console says which still moved
    because = moved;
    const at = (moved.map((s) => boxAddress(s, index, blocks)).filter(Boolean) as Address[]);
    resume = at.length ? { prior: result, at } : null;
    moved = [];
  }

  const missing = sites.filter((s) => !s.target);
  if (missing.length) console.warn(`BelType/Cicero: ${named(missing)} — a target-counter()/target-text() reference names no element in this document, and shows nothing.`);
  if (fixed.unread.length) console.warn(`BelType/Cicero: ${named(fixed.unread)} — the counter of a target this engine's counter walk does not reach (display: none, or inside a fixed box) is not read, and the reference shows nothing.`);
  if (unplaced.length) console.warn(`BelType/Cicero: ${named(unplaced)} — this target is outside the flow (a running element, a fixed box), so it lands on no page and the reference shows nothing.`);
  if (moved.length) console.warn(`BelType/Cicero: after ${runs} runs the page numbers of ${named(moved)} still move their own lines — the last true values stand, on a layout measured with the values before them.`);
  const pageReads = sites.filter((s) => isPageRead(s.read)).length;
  if (moved.length) console.info(`BelType/Cicero: ${sites.length} reference(s) read (${pageReads} page, ${sites.length - pageReads} counter or text) and ${pageSites?.length ?? 0} site(s) reading their own page; the pages settled in ${runs} run${runs === 1 ? '' : 's'}.`);
  return { ...result, resumed, why, delivered: found ? (moved.length ? laidUnder : merged(fixed.values, delivered)) : null, facts: moved.length ? laidFacts : facts, reads: { references: sites.length, pageSites: pageSites?.length ?? 0, runs, unsettled: moved.map(name) } };
}
