/**
 * The capture slice — author paged-media CSS into ledger-world terms, one CSSOM walk plus a measurement (third-coding-round.md item 4; architecture, The Furniture: this slice is pulled forward until the organ exists in full).
 *
 * Probe-grounded (*capture in the CSSOM*, P16): named and pseudo `@page` variants carry clean selectors in the screen CSSOM, margin at-rules survive inside `CSSPageRule`, and the element's `page` property reads from computed style. So the whole geometry table plus folio content comes from one walk; the css-tree source-text pass remains the cross-engine fallback and the GCPM-properties path, design-side.
 *
 * The measurement is the other half, and it is the ruling that page lengths are measured: a page length is resolved by seating the raw declared value on an engine-owned off-viewport probe dressed in the page context's own conditions and reading the browser's px back, because the browser is the oracle and a hand-rolled unit table is a second length engine. Absolute units keep the spec-ratio fast path below — those six are the specification's definitional constants, not an opinion, and keeping them makes every existing document's numbers bit-identical. Only what the table cannot answer reaches the probe, and only what the probe cannot honestly answer is refused by name. Every refusal lands at intake, through the sweep at the end of `readGeometryTable`, never from inside the per-page loop. **And a length is seated on the property it was declared on** (*a page box has a border and a padding*, 2026-09-07), which is one more thing the browser answers instead of this file: `thin` is a border width and nothing else, a negative padding is invalid where a negative margin is not, and a percentage is legal on a padding and refused on a border. Seating everything on `margin-top` would have measured all three as a margin and got two of them wrong.
 *
 * Scope of the slice: `size`, margins, folio-bearing margin boxes (`content: counter(page) | counter(pages) | "string"` sequences, or none/normal). Cascade per css-page-3 §4.4's (f, g, h) specificity: a named match outranks pseudo-classes, `:first` and `:blank` outrank parity, parity outranks the bare rule; equal specificity, later wins. One recorded constraint (v3 corpus honors it): content width changes only at named-page boundaries — `:first`, `:blank` and parity variants may vary vertical margins only, so no paragraph ever straddles two content widths (*cut-invariance*, C7, never suspends mid-paragraph).
 *
 * @packageDocumentation
 */

import { MARGIN_BOXES } from './margin-boxes.ts';
import { expandBox } from './box-shorthand.ts';
import { CUSTOM_PROPS, decodeContentFn, decodePageName, encodeStringProp } from './gcpm-encoding.ts';
import { HAS_PROPERTY_PREFIX, bareHasCount, decodeHasArgument, isHasRegistryRule } from './data-beltype.ts';

import type { Decl } from './margin-boxes.ts';
import { pairsOf, type counterStateAt, type PageCounterOps } from './document-state.ts';
import type { Px } from './gauge.ts';

export type Side = 'top' | 'right' | 'bottom' | 'left';

/** One value per side of a box. */
export type Sides<T> = Record<Side, T>;

/** The author's own page context for one condition, as declaration triples in ascending specificity — what the Chase dresses a page from (*the page context dresses the host*). */
export type PageStyle = {
  /** The declarations that reach no child: the page host's. */
  host: Decl[];
  /** The declarations that reach a child: the margin cells inherit them (css-page-3 §6). */
  cell: Decl[];
  /** The page box's border and padding, which the content area wears. */
  area: Decl[];
  /** Each margin box's own declarations, `content` excluded. */
  boxes: Record<string, Decl[]>;
};

/** The geometry table's answer for one page condition — what {@link readGeometryTable}'s `pageFor` returns. */
export type PageGeometry = {
  pageW: Px;
  pageH: Px;
  margins: Sides<Px>;
  /** Zero on every side whose style draws no border. */
  borders: Sides<Px>;
  paddings: Sides<Px>;
  /** The page area's width — see {@link pageArea}. */
  contentW: Px;
  contentH: Px;
  /** Raw `content` values per margin box, transliterated per page by {@link transliterateContent}. */
  marginBoxes: Record<string, string>;
  pageStyle: PageStyle;
  /** What the page context's rules do to the page counter, which `document-state.ts`'s `pageNumberAt` applies and the host never wears. */
  pageCounter: PageCounterOps;
};

/** What a page is asked for by: the four conditions css-page-3 §4 selects `@page` rules on. */
export type PageCondition = {
  /** The page name; `''` is the unnamed page. */
  name?: string;
  first?: boolean;
  parity?: 'left' | 'right';
  /** A content-empty page parity forcing produced (§4.2.3). */
  blank?: boolean;
};

/** A page's conditions (*geometry changes only at page boundaries*, C8), as the driver's `conditionsFor` builds them from the geometry table — what a Ledger entry `closes`. */
export type PageConditions = PageGeometry & { name: string, pageNumber: number, parity: 'left' | 'right', blank: boolean, counters: ReturnType<typeof counterStateAt>, dpr: number };

/** The account's `closes` — the whitelist of {@link PageConditions} that crosses a `page.evaluate` boundary (the driver's `closesOf`), plus the page's named strings, which the driver writes after the build. */
export type Closes = {
  name: string;
  pageNumber: number;
  parity: 'left' | 'right';
  blank: boolean;
  counters: ReturnType<typeof counterStateAt>;
  pageW: Px;
  pageH: Px;
  margins: Sides<Px>;
  contentW: Px;
  contentH: Px;
  pageStyle: PageStyle | null;
  /** Per named string, GCPM §1.1.2's four readings for this page (`document-state.js`'s `namedStringsForPage`). */
  strings?: Record<string, Record<string, string>>;
  /** Per running element's name, GCPM §1.2.3's four readings for this page by the same arithmetic: the element's place in the run's list of running elements, or `null` for none (*a running element is a named node*, 2026-10-21). */
  running?: Record<string, Record<string, number | null>>;
};

/** The property a probed length is seated on — the one it was declared on (*a page box has a border and a padding*). */
export type ProbeSeat = 'marginTop' | 'paddingTop' | 'borderTopWidth';

export type Resolve = (raw: string, basePx: Px | null, where: string, prop?: ProbeSeat) => Px;

/** A declaration block, iterated for its property names. A page rule's own block is a `CSSPageDescriptors`, which the CSSOM derives from `CSSStyleDeclaration` and `lib.dom` declares without its iterator — so that one is cast where it is read. */
export type DeclarationBlock = Iterable<string> & Pick<CSSStyleDeclaration, 'getPropertyValue' | 'getPropertyPriority'>;

/** A rule inside a `CSSPageRule`: a `CSSMarginRule` where the engine exposes one (`name`), else a rule answering `selectorText`. */
export type MarginRuleLike = CSSRule & { name?: string, selectorText?: string, style: CSSStyleDeclaration };

const PX_PER: Record<string,number> = { px: 1, pt: 96 / 72, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6 };

/**
 * Every sheet the document wears — `document.styleSheets` first, then `document.adoptedStyleSheets`.
 *
 * `document.styleSheets` holds only the sheets a document links or embeds; a constructed `CSSStyleSheet` handed to `adoptedStyleSheets` is not among them. The capture reads the author's `@page` world out of the CSSOM, so a host that materializes the author's stylesheets rather than linking them — BelType's editing tools do exactly that, and their Dresser is the first — would have handed this walk the shell's mechanics default and nothing else: silently wrong geometry, which is the failure a paginating engine can least afford. Reading both lists is the whole fix ([the capture reads adopted sheets](../../../.claude/decisions/cicero/the-capture-reads-adopted-sheets.md)).
 *
 * The order is the cascade's, not a preference: CSSOM seats every adopted sheet after every document sheet, so document sheets come first here and the later-wins rule inside `readGeometryTable` stays the browser's own. An engine's own adopted sheets are no exception and need none — `root.js`'s dressing sheet is adopted after the capture has run and carries no `@page`.
 */
export function styleSheetsOf(doc: Document): CSSStyleSheet[] {
  return [...doc.styleSheets, ...(doc.adoptedStyleSheets || [])];
}

/**
 * Whether a selector could look inside a hidden box and nothing answers for it — any rule of any sheet the document wears with a `:has(` the host did not rewrite into a union (*the clone is hollow outside the interval*, 2026-09-27; *one attribute has words*, 2026-10-10).
 *
 * A box outside a fragment's interval is kept hollow, an element with no children, and every structural selector matches it as it matched the deep clone it replaced — except a `:has()` whose argument reaches inside it. Since 2026-10-10 the host rewrites every `:has()` it can (`seam/rewrite.js`) into a union whose second arm reads a word the engine writes on the copy (`data-beltype.js`, `has-words.js`), so a hollow copy matches as its original does and the answer here is NO for a document whose `:has()` arguments are all rewritten. What is left is the `:has()` whose argument reads state a word computed once cannot follow — `:hover`, `:checked`, `:focus-within`, `:target` and their kin — and a sheet no host rewrote at all: for those the fragments are built deep, as before. Grouping rules, nested rules and imported sheets are walked, since a selector inside `@media` or `@layer` still matches; a sheet the engine cannot read answers yes, because it might. The reading is textual and counts: a rule whose selector holds more `:has(` than unions has one that nothing answers for.
 */
export function sheetsUseHas(doc: Document): boolean {
  return someRule(doc, (rule) => !!rule.selectorText && bareHasCount(rule.selectorText) > 0);
}

/** Whether a rule sets a counter on a `::before` or an `::after`: only then does the counter walk ask every element's pseudo-elements for their counters (`document-state.ts`'s `documentOpsOf`), which costs two style reads an element. A sheet the engine cannot read answers yes. */
export function sheetsCountInPseudos(doc: Document): boolean {
  return someRule(doc, (rule) => !!rule.selectorText && /::?(?:before|after)\b/i.test(rule.selectorText) && /\bcounter-(?:reset|increment|set)\s*:/.test((rule as CSSStyleRule).style?.cssText ?? ''));
}

/** The arguments the host rewrote, read back from the registry rules (`:not(*) { --beltype-has-<h>: "<A>" }`, one per rewritten sheet): hash → the argument's canonical text. The capture reads the CSSOM and nothing else, so the arguments come from the rule the rewriter appended and no selector is ever parsed back. */
export function hasArgumentsOf(doc: Document): Map<string,string> {
  const found: Map<string,string> = new Map<any, any>();
  someRule(doc, (rule) => {
    const style = (rule as CSSStyleRule).style;
    if (!isHasRegistryRule(rule.selectorText) || !style) return false;
    for (const name of (style as Iterable<string>)) {
      if (!name.startsWith(HAS_PROPERTY_PREFIX)) continue;
      const argument = decodeHasArgument(style.getPropertyValue(name));
      if (argument != null) found.set(name.slice(HAS_PROPERTY_PREFIX.length), argument);
    }
    return false;
  });
  return found;
}

/** Does any rule of any sheet the document wears satisfy `test`? Grouping rules, nested rules and imported sheets are walked; a sheet the engine cannot read answers yes, because it might say anything. */
function someRule(doc: Document, test: (rule: CSSRule&{ selectorText?: string; }) => boolean): boolean {
  const inRules = (rules: CSSRuleList): boolean => {
    for (const rule of (rules as Iterable<CSSRule & { selectorText?: string, cssRules?: CSSRuleList, styleSheet?: CSSStyleSheet | null }>)) {
      if (test(rule)) return true;
      if (rule.cssRules && inRules(rule.cssRules)) return true;
      if (rule.styleSheet && inSheet(rule.styleSheet)) return true;
    }
    return false;
  };
  const inSheet = (sheet: CSSStyleSheet): boolean => {
    let rules;
    try { rules = sheet.cssRules; } catch { return true; } // a sheet the engine cannot read might say anything
    return inRules(rules);
  };
  return styleSheetsOf(doc).some(inSheet);
}

/**
 * The properties that paint and move no box, the one list the sheets' reach reads a rule's declarations against (ruled 2026-11-08): a style rule whose every declaration sets one of these is passed over by {@link sheetReach} and {@link topLevelReach} whatever its selector, because the reach asks whether an edit can move another box's facts, and a colour, a shadow or an opacity moves none.
 *
 * @remarks
 * Closed and short on purpose. The CSSOM lists a rule's declarations as longhands, so `background` arrives as its `background-*` longhands and `border-color` as the four sides', and both families are taken by their prefix and suffix besides the names here. Anything else counts as layout, custom properties (`--x`) included, since one may feed a layout value through `var()`. Four were weighed and left out: `visibility`, whose `collapse` removes a table row or column from the layout; and `filter`, `backdrop-filter` and `will-change`, which make a containing block for a fixed or absolutely positioned descendant and so move it.
 */
export const PAINT_ONLY: ReadonlySet<string> = new Set(['color', 'background', 'border-color', 'outline-color', 'text-decoration-color', 'text-emphasis-color', 'caret-color', 'accent-color', 'column-rule-color', 'opacity', 'mix-blend-mode', 'box-shadow', 'text-shadow', 'cursor', 'pointer-events', 'user-select', 'forced-color-adjust', 'color-scheme', 'print-color-adjust']);

const paints = (name: string) => PAINT_ONLY.has(name) || name.startsWith('background-') || (name.startsWith('border-') && name.endsWith('-color'));

/** Whether a rule's own declarations, read through `rule.style`, all paint: a rule with none does too. A rule with no `style` is not a style rule and answers no. */
function paintOnly(rule: CSSRule & { style?: CSSStyleDeclaration }): boolean {
  const style = rule.style;
  if (!style || typeof style.length !== 'number') return false;
  for (let i = 0; i < style.length; i++) if (!paints(style.item(i))) return false;
  return true;
}

/** Whether every rule under a grouping rule paints, nested rules and grouping rules within it included; a rule that is neither a style rule nor a grouping rule answers no. */
function allPaint(rules: CSSRuleList | ArrayLike<CSSRule> | undefined): boolean {
  for (const rule of Array.from((rules ?? []) as ArrayLike<CSSRule & { style?: CSSStyleDeclaration, cssRules?: CSSRuleList }>)) {
    if (rule.style ? !paintOnly(rule) : !rule.cssRules) return false;
    if (rule.cssRules && !allPaint(rule.cssRules)) return false;
  }
  return true;
}

/** The rule that set a reach and the sheet it stands in, which the memo's console notice names (ruled 2026-11-08): `selector` is a style rule's `selectorText`, `null` for an `@container` or `@scope` rule or a sheet the engine cannot read; `sheet` the sheet's `href`, or `<style> n` with its place among the document's sheets, counted from 1. */
export type ReachCulprit = { selector: string | null; sheet: string; kind: 'style' | 'container' | 'scope' | 'unreadable' };

/** A reach with the first rule that set it and how many more rules reached as far, {@link sheetReachOf}'s and {@link topLevelReachOf}'s answer. */
export type Reach = { reach: 0|1|2; culprit: ReachCulprit | null; count: number };

/** Every rule of every sheet the document wears, with its sheet's name, walked as {@link someRule} walks them but to the end; a sheet the engine cannot read is handed to `unread`. */
function eachRule(doc: Document, visit: (rule: CSSRule & { selectorText?: string, cssRules?: CSSRuleList }, sheet: string) => void, unread: (sheet: string) => void) {
  const inRules = (rules: CSSRuleList, sheet: string) => {
    for (const rule of (rules as Iterable<CSSRule & { selectorText?: string, cssRules?: CSSRuleList, styleSheet?: CSSStyleSheet | null }>)) {
      visit(rule, sheet);
      if (rule.cssRules) inRules(rule.cssRules, sheet);
      if (rule.styleSheet) inSheet(rule.styleSheet, sheet);
    }
  };
  const inSheet = (sheet: CSSStyleSheet, name: string) => {
    const own = sheet.href ?? name;
    let rules;
    try { rules = sheet.cssRules; } catch { unread(own); return; }
    inRules(rules, own);
  };
  styleSheetsOf(doc).forEach((sheet, i) => inSheet(sheet, `<style> ${i + 1}`));
}

/** A tally of what reached how far: the highest level, the first rule at it, and the rules after it at the same level. */
function reachTally() {
  const found: Reach = { reach: 0, culprit: null, count: 0 };
  const add = (reach: 0|1|2, culprit: ReachCulprit) => {
    if (reach > found.reach) Object.assign(found, { reach, culprit, count: 0 });
    else if (reach > 0 && reach === found.reach) found.count++;
  };
  return { found, add };
}

/** A grouping rule's kind where it is one the reach answers 2 for unless every rule under it paints, else `null`. */
const queried = (rule: CSSRule): 'container' | 'scope' | null => {
  const kind = rule.constructor?.name;
  return kind === 'CSSContainerRule' ? 'container' : kind === 'CSSScopeRule' ? 'scope' : null;
};

/**
 * How far a box's attributes can reach through the sheets the document wears, read off the selectors (*the forced-break index is kept across runs*, 2026-10-09) — what the forcing index's memo needs to know to say which of its answers an edit made stale, when the unit of replacement is `patchBox`'s, a box at any depth ({@link topLevelReach} reads the same sheets for a whole top-level box).
 *
 * 0: nothing but the box and what is below it; a descendant combinator or a child combinator reads a box's ancestors, which an edit does not change. 1: a sibling — `+`, `~` or `:nth-child(… of …)`, by which a box's attributes decide the style of the boxes after it (or beside it) and what they hold. 2: an ancestor or anything at all — `:has(`, an `@container` rule (a size the edit moves), or a sheet the engine cannot read. Blink's invalidation sets draw the same line and take the same fallback: where a selector defeats the reasoning, widen. The reading is textual and errs only toward more reach — a `+` in a selector's attribute value is read as a combinator — which costs speed and never a stale answer.
 *
 * @remarks
 * A rule whose declarations all paint ({@link PAINT_ONLY}) is passed over before its selector is read, and an `@container` rule every rule under which paints answers nothing of itself; its nested rules are read as rules (ruled 2026-11-08).
 */
export function sheetReach(doc: Document): 0|1|2 {
  return sheetReachOf(doc).reach;
}

/** {@link sheetReach} with the first rule that set the reach and how many more reached as far, for the memo's console notice. */
export function sheetReachOf(doc: Document): Reach {
  const { found, add } = reachTally();
  eachRule(doc, (rule, sheet) => {
    if (rule.constructor?.name === 'CSSContainerRule') {
      if (!allPaint(rule.cssRules)) add(2, { selector: null, sheet, kind: 'container' });
      return;
    }
    const text = rule.selectorText;
    if (!text || paintOnly(rule)) return;
    const culprit: ReachCulprit = { selector: text, sheet, kind: 'style' };
    if (text.includes(':has(')) return add(2, culprit);
    // Parenthesised arguments and attribute selectors out of the way first: `:nth-child(2n+1)` and `[lang~=en]` are not combinators, and `:nth-child(2 of .x)` is the one `nth` form that looks sideways.
    if (/:nth-[\w-]+\([^)]*\sof\s/.test(text) || /[+~]/.test(text.replace(/\[[^\]]*\]/g, '').replace(/:nth-[\w-]+\([^)]*\)/g, ''))) add(1, culprit);
  }, (sheet) => add(2, { selector: null, sheet, kind: 'unreadable' }));
  return found;
}

/**
 * How far an edit's effect can travel through the sheets when the unit of replacement is a whole top-level box (*the forced-break index is kept across runs*, amended 2026-10-25): what {@link ForcingMemo.settle}, told these boxes, needs to say which top-level boxes' kept parts an edit made stale. Named for its unit, as `sheetReach` is the reading for `patchBox`'s, a box replaced at any depth.
 *
 * @remarks
 * A host that holds its own pages replaces only whole top-level boxes and reads each replaced box again whole, so the one question left is whether another top-level box's style can move, and it can only through a selector that relates top-level boxes to one another or matches their common ancestors. 0: none can. 1: a box's style can depend on the boxes before it, so the boxes from the earliest change on are stale: a `+` or `~` whose left side can be a top-level box, `:nth-child(… of …)` on one, and on one, where an edit inserted, removed or moved a top-level box, `:first-child` and `:nth-child()`, or where an edit changed any, `:first-of-type` and `:nth-of-type`. 2: a box's style can depend on the boxes after it or on an ancestor's match, and nothing is trusted: a `:has()` whose subject can be an ancestor of the boxes, a `:has()` opening with `+` or `~` whose subject can be a top-level box (it depends on the boxes after it, so the boxes before an edit are stale), `:nth-last-child(… of …)` on one, the last and only structural forms on one under the same conditions as the first forms, an `@container` or `@scope` rule, a sheet the engine cannot read, and every selector the reading cannot place.
 *
 * Whether a compound can be a top-level box is asked of the document, not read off the text: the selector up to that compound, every pseudo-class and pseudo-element taken out (which only widens what it matches) but a `:is()`, `:where()`, `:not()` or other wrapper of plain compounds, which asks no more than a tag or a class does, is matched against each box as it stands, and the compound alone against each box an edit took out (`before` less `boxes`), which is detached and has no context to match in. A selector is asked once per call, a box at a time until one answers yes; where `matches` throws, the answer is yes.
 *
 * A nested rule is read as it matches: its `&` is its parent's selector in `:is()`, as CSS Nesting defines it. Conservative by construction, and these are the cases it does not read, each answered 2: a `:is()`, `:where()`, `:not()` or other wrapper whose argument holds a combinator and also a sibling combinator, a `:has(` or a structural pseudo-class, which takes in a nested rule whose parent's selector holds them (a wrapper with a bare `*` among its arguments constrains nothing and is passed over, which is how the engine's own `:has()` union reads); a `&` in a rule nested in no style rule; a selector whose quotes or brackets do not close; a relative selector at the top of a rule. The pseudo-classes `sheetReach` passes over (`:target`, `:checked`, `:dir()`) are passed over here too.
 *
 * A rule whose declarations all paint ({@link PAINT_ONLY}) is passed over before its selector is read, so a paint-only `p + p` or `body:has(.x) p` reaches nothing, and an `@container` or `@scope` rule every rule under which paints answers nothing of itself; the walk reads its nested rules as rules (ruled 2026-11-08).
 *
 * The unit's promise, which the host keeps: a top-level box whose name or attributes change is a new element, and the element it replaced is among `before`.
 *
 * @param boxes - the top-level boxes as they stand: the element children of their one parent, in order.
 * @param before - the top-level boxes the memo was last settled with (`ForcingMemo`'s `boxes`), empty where it keeps nothing.
 */
export function topLevelReach(doc: Document, boxes: ArrayLike<Element>, before: ArrayLike<Element> = []): 0|1|2 {
  return topLevelReachOf(doc, boxes, before).reach;
}

/** {@link topLevelReach} with the first rule that set the reach, its sheet, and how many more rules reached as far, for the memo's console notice (ruled 2026-11-08). The number alone stays `topLevelReach`'s answer, which a view adapter imports. */
export function topLevelReachOf(doc: Document, boxes: ArrayLike<Element>, before: ArrayLike<Element> = []): Reach {
  const now = Array.from(boxes);
  const was = Array.from(before);
  const here = new Set(now);
  const gone = was.filter((el) => !here.has(el));
  const at = new Map(was.map((el, i) => [el, i]));
  // Nothing is kept where nothing was settled before, so no structural answer can be stale.
  const changed = was.length > 0 && (was.length !== now.length || now.some((el, i) => el !== was[i]));
  const shaped = was.length > 0 && (was.length !== now.length || now.some((el, i) => at.has(el) && at.get(el) !== i));
  const parent = now[0]?.parentElement ?? null;
  const ancestors: Element[] = [];
  for (let a = parent; a; a = a.parentElement) ancestors.push(a);
  const asked: Map<string,boolean> = new Map<any, any>();
  const some = ( els: Element[],  selector: string) => els.some((el) => { try { return el.matches(selector); } catch { return true; } });
  const once = ( key: string,  ask: () => boolean) => { let v = asked.get(key); if (v === undefined) asked.set(key, (v = ask())); return v; };
  const ctx: ReachContext = {
    top: (prefix, compound) => once(`t${prefix}\n${compound}`, () => some(now, prefix) || some(gone, compound)),
    ancestor: (prefix) => once(`a${prefix}`, () => !parent || some(ancestors, prefix)),
    shaped,
    changed
  };
  const { found, add } = reachTally();
  eachRule(doc, (rule, sheet) => {
    const kind = queried(rule);
    if (kind) {
      if (!allPaint(rule.cssRules)) add(2, { selector: null, sheet, kind });
      return;
    }
    if (!rule.selectorText || rule.constructor?.name === 'CSSPageRule' || paintOnly(rule)) return;
    const text = resolvedSelector(rule);
    if (text != null && !CROSSING.test(text)) return;
    const r = text == null ? 2 : selectorListReach(text, ctx);
    if (r) add(r, { selector: rule.selectorText, sheet, kind: 'style' });
  }, (sheet) => add(2, { selector: null, sheet, kind: 'unreadable' }));
  return found;
}

/** What {@link topLevelReach} asks of the document while it reads a selector. */
export type ReachContext = {
  /** Whether the selector up to a compound can match a top-level box, or the compound alone a box an edit took out. */
  top: (prefix: string, compound: string) => boolean;
  /** Whether the selector up to a compound can match an ancestor of the top-level boxes. */
  ancestor: (prefix: string) => boolean;
  /** Whether a top-level box was inserted, removed or moved since the boxes before. */
  shaped: boolean;
  /** Whether any top-level box is not the one that stood in its place before. */
  changed: boolean;
};

/** A style rule's selector as it matches: a rule nested in a style rule (through any grouping rules between them) has each `&` read as the parent's selector in `:is()`, and an item with no `&` the parent's as its ancestor, which is CSS Nesting's own definition, resolved up the chain; `null` for a `&` in a rule nested in no style rule, or text that does not close. */
function resolvedSelector(rule: CSSRule&{ selectorText?: string; }): string|null {
  const own = (rule.selectorText as string);
  let parent: any = rule.parentRule;
  while (parent && parent.selectorText == null) parent = parent.parentRule;
  if (!parent || parent.constructor?.name === 'CSSPageRule') return own.includes('&') ? null : own;
  const outer = resolvedSelector(parent);
  const m = maskSelector(own);
  if (outer == null || m == null) return null;
  const is = `:is(${outer})`;
  return splitList(m, 0, m.length).map(([s, e]) => {
    const item = own.slice(s, e).split('');
    return m.slice(s, e).includes('&') ? item.map((c, i) => (m[s + i] === '&' ? is : c)).join('') : `${is} ${item.join('').trim()}`;
  }).join(', ');
}

/** The text by which a selector can reach across top-level boxes; a selector without it is passed over unparsed. */
const CROSSING = /[+~]|:has\(|:(?:nth-|first-|last-|only-)/i;

/** The structural pseudo-classes, each with the change that moves its answer and the reach it then has: the first forms look at the boxes before, the last and only forms at the boxes after. */
const STRUCTURAL: Record<string,['shaped'|'changed',1|2]> = {
  'first-child': ['shaped', 1], 'nth-child': ['shaped', 1], 'last-child': ['shaped', 2], 'nth-last-child': ['shaped', 2], 'only-child': ['shaped', 2],
  'first-of-type': ['changed', 1], 'nth-of-type': ['changed', 1], 'last-of-type': ['changed', 2], 'nth-last-of-type': ['changed', 2], 'only-of-type': ['changed', 2]
};

/** The pseudo-classes whose argument is a selector list matched against the element itself. */
const WRAPPERS = new Set(['is', 'where', 'not', 'matches', 'any', '-webkit-any', '-moz-any']);

/** Selector text with what stands inside a string, an attribute selector or an escape written over with `_`, at the same offsets, so the structure is read off by position and the author's text taken from the same offsets; `null` where a quote or a bracket does not close. */
function maskSelector(text: string): string|null {
  const m = text.split('');
  let quote: string|null = null;
  let bracket = false;
  for (let i = 0; i < m.length; i++) {
    const c = text[i];
    if (c === '\\') { m[i] = '_'; if (i + 1 < m.length) m[++i] = '_'; }
    else if (quote) { if (c === quote) quote = null; else m[i] = '_'; }
    else if (c === '"' || c === "'") quote = c;
    else if (bracket) { if (c === ']') bracket = false; else m[i] = '_'; }
    else if (c === '[') bracket = true;
  }
  return quote || bracket ? null : m.join('');
}

/** The ranges of `m` from `s` to `e` divided at each comma outside parentheses. */
function splitList(m: string, s: number, e: number): [number,number][] {
  const out: [number,number][] = [];
  let depth = 0;
  let from = s;
  for (let i = s; i < e; i++) {
    if (m[i] === '(') depth++;
    else if (m[i] === ')') depth--;
    else if (m[i] === ',' && depth === 0) { out.push([from, i]); from = i + 1; }
  }
  out.push([from, e]);
  return out;
}

/** A complex selector's compounds, each with the combinator before it (`null` before the first, unless the selector is relative); `null` where the parentheses do not balance or two combinators stand together. */
function compoundsOf(m: string, s: number, e: number): { comb: string|null; s: number; e: number; }[]|null {
  const out: { comb: string|null; s: number; e: number; }[] = [];
  let depth = 0;
  let start = -1;
  let comb: string|null = null;
  for (let i = s; i < e; i++) {
    const c = m[i];
    if (depth === 0 && /[>+~\s]/.test(c)) {
      if (start >= 0) { out.push({ comb, s: start, e: i }); start = -1; comb = ' '; }
      if (c === '>' || c === '+' || c === '~') { if (comb !== null && comb !== ' ') return null; comb = c; }
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return null;
    if (start < 0) start = i;
  }
  if (depth !== 0) return null;
  if (start >= 0) out.push({ comb, s: start, e });
  else if (comb !== null && comb !== ' ') return null;
  return out;
}

/** The pseudo-classes and pseudo-elements of one compound, at its own level: the name, the whole range and the argument's. */
function pseudosOf(m: string, s: number, e: number): { name: string; s: number; e: number; arg: [number,number]|null; }[] {
  const out: { name: string; s: number; e: number; arg: [number,number]|null; }[] = [];
  for (let i = s; i < e; i++) {
    if (m[i] !== ':') continue;
    let j = m[i + 1] === ':' ? i + 2 : i + 1;
    const from = j;
    while (j < e && /[\w-]/.test(m[j])) j++;
    const name = m.slice(from, j).toLowerCase();
    let arg: [number,number]|null = null;
    if (m[j] === '(') {
      let depth = 1;
      let k = j + 1;
      for (; k < e && depth > 0; k++) if (m[k] === '(') depth++; else if (m[k] === ')') depth--;
      arg = [j + 1, k - 1];
      j = k;
    }
    out.push({ name, s: i, e: j, arg });
    i = j - 1;
  }
  return out;
}

/** The author's compound with its pseudo-classes and pseudo-elements taken out, `*` where nothing is left: it matches every element the compound matches, and more. A wrapper whose argument is a list of plain compounds stays, since it asks of the element only what a tag, a class or an attribute asks, and matches as exactly as they do. */
function stripPseudos(t: string, m: string, s: number, e: number, pseudos: { name: string; s: number; e: number; arg: [number,number]|null; }[]) {
  let out = '';
  let from = s;
  for (const p of pseudos) {
    if (WRAPPERS.has(p.name) && p.arg && plainList(m, p.arg)) continue;
    out += t.slice(from, p.s);
    from = p.e;
  }
  return (out + t.slice(from, e)).trim() || '*';
}

/** Is a wrapper's argument a list of compounds with no pseudo-class, no pseudo-element and no combinator? */
function plainList(m: string, [s, e]: [number,number]) {
  return splitList(m, s, e).every(([a, b]) => {
    const parts = compoundsOf(m, a, b);
    return parts?.length === 1 && !parts[0].comb && !m.slice(a, b).includes(':');
  });
}

function selectorListReach(text: string, ctx: ReachContext): 0|1|2 {
  const m = maskSelector(text);
  if (m == null) return 2;
  let reach: 0|1|2 = 0;
  for (const [s, e] of splitList(m, 0, m.length)) {
    const r = complexReach(text, m, s, e, ctx);
    if (r > reach) reach = r;
    if (reach === 2) break;
  }
  return reach;
}

function complexReach(t: string, m: string, s: number, e: number, ctx: ReachContext): 0|1|2 {
  const parts = compoundsOf(m, s, e);
  if (!parts || !parts.length || parts[0].comb) return 2;
  let reach: 0|1|2 = 0;
  let prefix = '';
  let last = '';
  for (const [i, part] of parts.entries()) {
    const pseudos = pseudosOf(m, part.s, part.e);
    const compound = stripPseudos(t, m, part.s, part.e, pseudos);
    // A sibling combinator relates two top-level boxes where its left side can be one: the box on its right then depends on the boxes before it.
    if ((part.comb === '+' || part.comb === '~') && ctx.top(prefix, last)) reach = 1;
    prefix = i ? `${prefix} ${part.comb === ' ' ? '' : part.comb} ${compound}` : compound;
    const r = pseudosReach(t, m, pseudos, prefix, compound, ctx);
    if (r > reach) reach = r;
    if (reach === 2) return 2;
    last = compound;
  }
  return reach;
}

function pseudosReach(t: string, m: string, pseudos: { name: string; arg: [number,number]|null; }[], prefix: string, compound: string, ctx: ReachContext): 0|1|2 {
  let reach: 0|1|2 = 0;
  const top = () => ctx.top(prefix, compound);
  for (const { name, arg } of pseudos) {
    let r: 0|1|2 = 0;
    if (name === 'has' && arg) {
      // The subject's match moves with what the argument finds: an ancestor's moves the style below it everywhere, and a top-level box's moves with the boxes after it where the argument opens sideways.
      if (ctx.ancestor(prefix)) return 2;
      if (splitList(m, arg[0], arg[1]).some(([a, b]) => /^\s*[+~]/.test(m.slice(a, b))) && top()) return 2;
    } else if ((name === 'nth-child' || name === 'nth-last-child') && arg && /\sof\s/i.test(m.slice(arg[0], arg[1]))) {
      if (top()) r = name === 'nth-child' ? 1 : 2;
    } else if (STRUCTURAL[name]) {
      const [when, how] = STRUCTURAL[name];
      if (ctx[when] && top()) r = how;
    } else if (WRAPPERS.has(name) && arg) {
      r = wrapperReach(t, m, arg, prefix, compound, ctx);
    }
    if (r > reach) reach = r;
    if (reach === 2) return 2;
  }
  return reach;
}

/** A wrapper's argument: a compound alone is the element's own and is read as the compound's; a complex one is placed nowhere, and holding anything that crosses it answers 2. */
function wrapperReach(t: string, m: string, [s, e]: [number,number], prefix: string, compound: string, ctx: ReachContext): 0|1|2 {
  const items = splitList(m, s, e);
  if (items.some(([a, b]) => m.slice(a, b).trim() === '*')) return 0;
  let reach: 0|1|2 = 0;
  for (const [a, b] of items) {
    const parts = compoundsOf(m, a, b);
    if (!parts || !parts.length) return 2;
    const r = parts.length === 1 && !parts[0].comb ? pseudosReach(t, m, pseudosOf(m, parts[0].s, parts[0].e), prefix, compound, ctx) : CROSSING.test(m.slice(a, b)) ? 2 : 0;
    if (r > reach) reach = r;
    if (reach === 2) return 2;
  }
  return reach;
}

const PROBE_ID = '__beltype-page-length';
const PROBE_PROP = '--__beltype-page-length';
/** A length no stylesheet would ever mean, so a registered custom property falling back to it is unambiguous evidence of an invalid-at-computed-value-time declaration. */
const PROBE_SENTINEL = -999983;

/** The absolute-unit fast path: the spec's own definitional ratios (1in = 96px). Returns null — never throws — for anything the table cannot answer, which is the probe's cue rather than the render's end. */
function absoluteToPx(raw: string): Px|null {
  const m = /^(-?[\d.]+)([a-z]+)$/.exec(raw);
  if (!m || !PX_PER[m[2]]) return null;
  return parseFloat(m[1]) * PX_PER[m[2]];
}

/** A refusal, in `measure.js`'s intake style: a bare Error naming the exact declaration and why measurement cannot honestly answer it. */
function refuse(raw: string, where: string, why: string) {
  return new Error(`unresolvable page length '${raw}' in ${where} — ${why}. Page lengths are resolved by measuring them on the live document, so any length the browser can resolve is supported; this one it cannot.`);
}

/**
 * A per-document length resolver: the Oracle probe (page lengths are measured, decision 2).
 *
 * The probe is `measure.js`'s `createMeasureContext` precedent applied to a smaller question — an engine-owned, `__beltype`-prefixed wrapper, off-viewport and never `display: none` (display:none has no geometry), appended under the live `body` so the root's font size and the root's custom properties are inherited rather than reconstructed. The raw value is seated as `margin-top` on an inner element (margins accept negatives and percentages, which `width` does not) and read back through `getComputedStyle`, whose resolved value for a laid-out box is the used value in px.
 *
 * The percentage base is per axis, and this is the whole reason `basePx` is a parameter rather than a field. css-page-3 §6: percentages on the page context's margins are relative to the containing block's width for left and right and to its height for top and bottom — the page context deliberately differs from an ordinary element, which takes the inline size on all four sides. Since the probe's inner element is an ordinary element, dressing the wrapper's `width` with the governing page dimension makes one mechanism serve both axes: `pageW` for left/right, `pageH` for top/bottom. Measured against Chromium's own print before this was built (`10%` on a 320×460pt page: 32pt left, ~45.6pt top).
 */
function createLengthResolver(doc: Document) {
  const win = (doc.defaultView as Window & typeof globalThis);
  const memo: Map<string,Px|null> = new Map<any, any>();
  let probe: { wrapper: HTMLDivElement; inner: HTMLDivElement; }|null = null;
  let registered = false;

  function openProbe() {
    const wrapper = doc.createElement('div');
    wrapper.id = PROBE_ID;
    // flow-root so the inner element's margin stays inside the wrapper's box rather than collapsing out of it — the same reason the measure context declares it.
    wrapper.style.cssText = 'position: absolute; left: -100000px; top: 0; display: flow-root;';
    // The page context's font: `rem` resolves against the root regardless, but `em` resolves against the element's own, and the page context's font IS the root's (measured — `2em` and `2rem` print identically in a page margin).
    wrapper.style.fontSize = win.getComputedStyle(doc.documentElement).fontSize;
    const inner = doc.createElement('div');
    // A border width's used value is zero unless a style is set, so the probe carries one: without it every border on every page would measure 0 and the page area would be too wide by the border the author declared. What a page's own border-style is worth is a separate question and the capture answers it separately — this is the probe's own dress, not a reading.
    inner.style.borderStyle = 'solid';
    wrapper.appendChild(inner);
    doc.body.appendChild(wrapper);
    return { wrapper, inner };
  }

  /**
   * Does this value resolve at all, or is it invalid at computed-value time?
   *
   * An unresolvable `var()` computes to 0, which a margin read cannot tell from an honest 0 — and an engine that lays out against a silent zero is the confetti finding by another road. A registered custom property falls back to its `initialValue` instead, so the sentinel makes failure legible. Consulted only when it can matter (a `var(`-bearing value that measured 0), because registering a property is a document-wide act and this one is `__beltype`-prefixed but still global.
   */
  function resolvesAtAll(p: { wrapper: HTMLDivElement; inner: HTMLDivElement; }, raw: string) {
    if (!registered) {
      if (typeof win.CSS?.registerProperty !== 'function') return true; // no detector in this engine: take the browser's zero rather than refuse a value we have no way to judge
      try {
        win.CSS.registerProperty({ name: PROBE_PROP, syntax: '<length-percentage>', inherits: false, initialValue: `${PROBE_SENTINEL}px` });
      } catch {
        // already registered in this document — the registry is global and cannot be un-registered, which is fine: the name is ours.
      }
      registered = true;
    }
    p.inner.style.setProperty(PROBE_PROP, '');
    p.inner.style.marginTop = '';
    p.inner.style.setProperty(PROBE_PROP, raw);
    p.inner.style.marginTop = `var(${PROBE_PROP})`;
    void p.wrapper.offsetHeight;
    const px = parseFloat(win.getComputedStyle(p.inner).marginTop);
    p.inner.style.setProperty(PROBE_PROP, '');
    p.inner.style.marginTop = '';
    return px !== PROBE_SENTINEL;
  }

  /**
   * The measurement itself. Returns px, or null where the browser resolves the value to nothing.
   *
   * `prop` is the property the value was declared on, and it is load-bearing rather than tidy: the CSS parser's own per-property validity is the syntax gate below, so `thin` measures as a border width and refuses as a margin, `-5px` measures as a margin and refuses as a padding, and a percentage measures on both of those and refuses on a border. Each of those is the browser's answer to a question this file would otherwise have had to hold a table about.
   */
  function compute(raw: string, basePx: Px, prop: ProbeSeat): Px|null {
    const p = probe ?? openProbe();
    try {
      p.wrapper.style.width = `${basePx}px`;
      // Reset then assign: a value the CSS parser refuses never enters the declaration at all, so an empty read-back is a free syntax gate before any measurement is trusted (measured — `2foo`, `garbage` and `red` all stay empty).
      p.inner.style[prop] = '';
      p.inner.style[prop] = raw;
      if (p.inner.style[prop] === '') return null;
      void p.wrapper.offsetHeight;
      const px = parseFloat(win.getComputedStyle(p.inner)[prop]);
      p.inner.style[prop] = '';
      if (!Number.isFinite(px)) return null;
      if (px === 0 && raw.includes('var(') && !resolvesAtAll(p, raw)) return null;
      return px;
    } finally {
      if (!probe) p.wrapper.remove(); // a resolution outside the intake sweep leaves nothing behind
    }
  }

  /** One layout per distinct (declared length, governing dimension, seat) — never per page, never one axis's answer handed to the other, and never one property's answer handed to another. */
  function measured(raw: string, basePx: Px, prop: ProbeSeat): Px|null {
    const key = `${raw}|${basePx}|${prop}`;
    if (memo.has(key)) return (memo.get(key) as Px | null);
    const px = compute(raw, basePx, prop);
    memo.set(key, px);
    return px;
  }

  return {
    /** Hold one probe open for the duration of the intake sweep, so a document's whole geometry costs one element rather than one per length. */
    hold() {
      if (!probe) probe = openProbe();
    },
    dispose() {
      if (probe) {
        probe.wrapper.remove();
        probe = null;
      }
    },
    /**
     * One declared page length in px, or a refusal by name.
     *
     * @param rawIn - the declared value, verbatim.
     * @param basePx - the percentage base — the page dimension css-page-3 §6 gives this side — or null where there is no containing block at all.
     * @param where - names the declaration, so a refusal says which one.
     * @param prop - the property the value was declared on — the probe's seat, and the browser's own validity gate for it. Defaults to `margin-top`, the seat every page margin has always used.
     * @throws Error — bare and deliberate (`src/` may not import BelType's error types): a relative length where there is no percentage base, `auto`, or a value the browser resolves to nothing.
     */
    resolve(rawIn: string, basePx: Px|null, where: string, prop: ProbeSeat = 'marginTop'): Px {
      const raw = String(rawIn).trim().toLowerCase();
      const fast = absoluteToPx(raw);
      if (fast !== null) return fast;
      // A `size` is resolved before either page dimension exists, so it has no percentage base; css-page-3 §7.1 gives `size` no percentage values at all. Every other length the browser resolves is measured as a margin's is: an `em` resolves against the root's font, which the probe's wrapper wears (Codeberg issue 10; until 2026-11-07 every relative unit refused here).
      if (basePx === null && raw.includes('%')) throw refuse(raw, where, 'a `size` descriptor is resolved before either page dimension exists, and css-page-3 §7.1 gives `size` no percentage values at all');
      if (raw === 'auto') throw refuse(raw, where, '`auto` on a page margin means UA-determined, and the probe would read it as a plain 0 — a number this engine would then lay out against as though the author had written one');
      const px = measured(raw, basePx ?? 0, prop);
      if (px === null) throw refuse(raw, where, 'the browser resolves it to nothing — an unknown unit, a malformed value, or a custom property that is never declared');
      return px;
    }
  };
}

/**
 * The media names css-page-3 §7.1 lists for `<page-size>`, in millimetres, portrait; the `landscape` and `portrait` keywords are handled at parse.
 *
 * @remarks
 * The list is the one in the specification's `size` property (`packages/essay/book/spec/css-page-3.json`, `page-size-prop`): A5, A4, A3, B5, B4, JIS-B5, JIS-B4, letter, legal, ledger, and nothing else. `A6` is not on it, and Chromium's own print refuses it too: `size: A6` prints the letter default (measured 2026-10-14), so it stays refused by name rather than being written down here. Each value is the standard's; the comment beside it is what Chromium's print gave, so a disagreement is visible at the line.
 */
const SIZE_NAMES: Record<string,[number,number]> = {
  a3: [297, 420], // css-page-3 A3 297 × 420mm; Chromium 297.01 × 420.20mm
  a4: [210, 297], // css-page-3 A4 210 × 297mm; Chromium 209.89 × 297.01mm
  a5: [148, 210], // css-page-3 A5 148 × 210mm; Chromium 148.17 × 209.89mm
  b4: [250, 353], // css-page-3 B4 250 × 353mm; Chromium 250.11 × 353.14mm
  b5: [176, 250], // css-page-3 B5 176 × 250mm; Chromium 176.02 × 250.11mm
  'jis-b4': [257, 364], // css-page-3 JIS-B4 257 × 364mm; Chromium 257.22 × 364.07mm (added 2026-10-14: the table lacked it)
  'jis-b5': [182, 257], // css-page-3 JIS-B5 182 × 257mm; Chromium 182.03 × 257.22mm (added 2026-10-14: the table lacked it)
  letter: [215.9, 279.4], // css-page-3 letter 8.5 × 11in; Chromium 215.90 × 279.40mm
  legal: [215.9, 355.6], // css-page-3 legal 8.5 × 14in; Chromium 215.90 × 355.60mm
  ledger: [279.4, 431.8] // css-page-3 ledger 11 × 17in; Chromium 279.40 × 431.80mm
};

/** css-page-3 §7.1's two orientation keywords. */
const ORIENTATIONS = new Set(['portrait', 'landscape']);

/** Is this `size` an orientation keyword and nothing else? Then it turns the sheet the cascade already gave ({@link sizeToPx}). */
export const isOrientationOnly = (tokens: string[]) => tokens.length === 1 && ORIENTATIONS.has(tokens[0].toLowerCase());

/**
 * A `size` descriptor's tokens → [widthPx, heightPx]. Handles lengths, named sizes, and orientation keywords. A `size` is resolved before either page dimension is known, so its lengths get a null percentage base, and a percentage refuses by name (css-page-3 §7.1).
 *
 * @remarks
 * An orientation keyword turns whatever sheet stands beside it: `landscape` puts the longer side across, `portrait` down, for a named size and for a pair of lengths alike. §7.1 says a keyword alone means the UA's default sheet turned that way; this engine pins geometry (I5) and has no default sheet, so `pageFor` hands the keyword the sheet the cascade's less specific rule gave (the WPT print reftests' `@page :first { size: portrait }` on their 5 in by 3 in default), and a keyword with no such sheet refuses by name (Codeberg issue 10; until 2026-11-07 it refused as the length `undefined`).
 */
export function sizeToPx(tokens: string[], resolve: Resolve): [Px,Px] {
  const t = tokens.map((s) => s.toLowerCase());
  const orientation = t.find((s) => ORIENTATIONS.has(s)) ?? null;
  const rest = t.filter((s) => !ORIENTATIONS.has(s));
  const where = 'a `size` descriptor';
  let w;
  let h;
  if (rest.length && SIZE_NAMES[rest[0]]) {
    [w, h] = SIZE_NAMES[rest[0]].map((mm) => mm * PX_PER.mm);
  } else if (rest.length === 1) {
    w = h = resolve(rest[0], null, where);
  } else if (rest.length === 0) {
    throw refuse(orientation ?? '', where, 'an orientation keyword alone means the UA\'s default sheet turned that way, and this engine has none: declare the sheet in a less specific @page rule, or beside the keyword');
  } else {
    [w, h] = [resolve(rest[0], null, where), resolve(rest[1], null, where)];
  }
  if (orientation === 'landscape') return [Math.max(w, h), Math.min(w, h)];
  if (orientation === 'portrait') return [Math.min(w, h), Math.max(w, h)];
  return [w, h];
}

/**
 * The root's custom properties substituted into a page-context value (css-page-3 §4.1: the page context inherits from the root element, so a `var()` there reads the root's value). The probe already inherits them for a longhand it seats, but a shorthand goes through `expandBox` before any probe, and `--margin: 20px 40px` must be split before it is seated (Codeberg issue 10, `page-context-inherits-from-root-custom-property`). A property the root does not declare takes the `var()`'s fallback, or stays as written for the probe to refuse by name.
 */
function substituteRootVars(doc: Document, text: string): string {
  if (!text.includes('var(')) return text;
  const root = (doc.defaultView as Window).getComputedStyle(doc.documentElement);
  let out = text;
  for (let i = 0; i < 8 && out.includes('var('); i++) {
    const next = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (whole, name: string, fallback: string|undefined) => root.getPropertyValue(name).trim() || fallback?.trim() || whole);
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * What Cicero owns: the one criterion, and it is deliberately not a CSS opinion.
 *
 * A declaration inside `@page` is the author's unless it is one of three things: a property the Chase itself writes on the page host (its grid, its box model, its print mechanics), a geometry input this file already models (`size` and the margins), or something measured and not yet modelled. Nothing else disqualifies a declaration, and no list of "properties we support" exists anywhere in this engine — that is the whole point of *the page context dresses the host*. Rebuild this as a whitelist of understood properties and the rule is gone.
 *
 * `border` and `padding` were the third kind until 2026-09-07 and are the second now (*a page box has a border and a padding*): measured 2026-09-04 against Chromium's own print, both are honoured and both take room from the page area — a 5 px border moves the first printed item 5 px, a 30 px padding moves it 30 — and the capture models both since it can subtract what it models. They stay out of the host's and the cells' declarations, because the page's border is drawn between the margin area and the padding area and the host is the whole page box; they go to the content area instead, whose border box is exactly the page box inside its margins, and whose content box is therefore the page area by construction. So the author's `border-style`, `border-color` and `border-image-*` ride across verbatim beside the widths the capture measured, and the engine still learns no property name: the split is by where the declaration belongs on the Chase, not by what it is called.
 *
 * Prefixes, not exact names, because the CSSOM hands back longhands: `border` expands to twenty-two of them (`border-image-*` included), `padding` and `margin` to four each — measured, not assumed.
 */
const OWNED_EXACTLY = new Set([
  'size', // the descriptor readGeometryTable resolves
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', // the page box's own size; css-page-3 §6 gives these special used-value rules
  'display', 'box-sizing', // the Chase's 5x5 grid mechanism
  'break-after', 'break-inside' // the Chase's print mechanics: a page host must break after itself
]);
const OWNED_PREFIXES = ['margin', 'border', 'padding', 'grid-template'];

/** The two the content area wears rather than the host: geometry the capture models and paint that belongs on the same box as the geometry. A subset of `OWNED_PREFIXES`, deliberately — nothing here reaches `:host` or `.margin-cell`, and the split is one list minus another rather than two lists that can disagree. */
const AREA_PREFIXES = ['border', 'padding'];

function ownedByCicero(prop: string) {
  return OWNED_EXACTLY.has(prop) || OWNED_PREFIXES.some((p) => prop.startsWith(p));
}

/**
 * What the Chase owns on a margin cell, which is less than on the page host: a cell's `margin-*`, `border-*` and `padding-*` are the box's own (css-page-3 §5.3.2 distributes the boxes' outer widths, padding and border included, and `chase.js`'s `layoutBands` measures them on the cell), where the page box's are the geometry the capture models and the content area wears. Until 2026-11-07 the host's filter was applied to the boxes too, and `@top-left { padding-bottom: 5mm }` reached no cell (Codeberg issue 3). The `width` family stays withheld: §5.3.2's answer for a box that declares one is not built, and the cell's grid seat is the Chase's.
 */
function ownedOnCell(prop: string) {
  return OWNED_EXACTLY.has(prop) || prop.startsWith('grid-template');
}

/** One declaration block's `border-*` and `padding-*` triples, in the block's own order — the page box's border and padding, which the Chase writes on the content area. Order and `!important` carried for the same reason `declarationsOf` carries them: they are the cascade. */
function areaDeclarationsOf(style: DeclarationBlock) {
  const out: Decl[] = [];
  for (const prop of style ?? []) {
    if (!AREA_PREFIXES.some((p) => prop.startsWith(p))) continue;
    out.push([prop, style.getPropertyValue(prop), style.getPropertyPriority(prop)]);
  }
  return out;
}

/** One declaration block as `[property, value, priority]` triples, in the block's own order, minus what Cicero owns — on the page host by default, on a margin cell where `owned` is {@link ownedOnCell}. Order and `!important` are carried because they are the cascade: the triples are re-emitted into one rule, where later wins and important beats normal exactly as the author wrote them. */
function declarationsOf(style: DeclarationBlock, owned: (prop: string) => boolean = ownedByCicero) {
  const out: Decl[] = [];
  for (const prop of style ?? []) {
    if (owned(prop)) continue;
    out.push([prop, style.getPropertyValue(prop), style.getPropertyPriority(prop)]);
  }
  return out;
}

/** The three counter properties, each with the value an unnumbered name takes. */
const PAGE_COUNTER_PROPS: Record<string, number> = { 'counter-reset': 0, 'counter-increment': 1, 'counter-set': 0 };

/**
 * A page rule's declarations with the page counter taken out of its `counter-reset`, `counter-increment` and `counter-set`: the page number is `pageNumberAt`'s, written on the host as `page N`, and an increment the host wore beside it was added to N (`@page { counter-increment: page 2 }` printed 3, 4, 5 where Chromium prints 2, 4, 6) while the host's inline reset hid every `@page` reset. Another counter's pair stays where it was.
 */
function withoutPageCounter(decls: Decl[]): Decl[] {
  return decls.flatMap((d): Decl[] => {
    const fallback = PAGE_COUNTER_PROPS[d[0]];
    if (fallback === undefined) return [d];
    const pairs = pairsOf(d[1], fallback);
    if (!pairs.some(([name]) => name === 'page')) return [d];
    const rest = pairs.filter(([name]) => name !== 'page');
    return rest.length ? [[d[0], rest.map(([name, value]) => `${name} ${value}`).join(' '), d[2]]] : [];
  });
}

/** The page counter's value in each of a condition's three winning counter declarations, `null` where the winner names no `page`: the cascade over the applicable rules, in ascending specificity, `!important` beating normal. */
function pageCounterOf(rules: Array<{ style: Decl[] }>): PageCounterOps {
  const winners: Record<string, Decl> = {};
  for (const r of rules) for (const d of r.style) if (d[0] in PAGE_COUNTER_PROPS && (d[2] === 'important' || winners[d[0]]?.[2] !== 'important')) winners[d[0]] = d;
  const pageOf = (prop: string) => {
    const pair = pairsOf(winners[prop]?.[1], PAGE_COUNTER_PROPS[prop]).findLast(([name]) => name === 'page');
    return pair ? pair[1] : null;
  };
  return { reset: pageOf('counter-reset'), increment: pageOf('counter-increment'), set: pageOf('counter-set') };
}

/**
 * The faces page furniture asks for, as `FontFaceSet.load()` arguments (the platform's font preloading) — read from the `@page` rules' own declarations, where the families are already in hand.
 *
 * @remarks A face is requested only when laid-out text uses it, and the margin boxes are laid out after the cuts: a folio or a running head set in a webfont no flow text uses was requested when the first page was presented, and its `loadingdone` was a late condition that cost one more whole run (*late truth is an edit*, the Verdict's 2026-10-13 amendment). Each rule yields the page context's family, weight and style, and each margin box's own over them (the cells inherit the page context, css-page-3 §6). Only faces a rule names are listed, never every declared face — a document may declare eighteen it never sets a glyph in. A declaration the CSSOM left as `var()` or a keyword that is not a value is skipped: the browser refuses such a `load()` and the face is then requested the old way.
 */
function furnitureFacesOf(rules: Array<{ style: Decl[]; boxStyles: Record<string,Decl[]>; }>): string[] {
  const faceOf = (decls: Decl[]): Record<string,string> => {
    const out: Record<string,string> = {};
    for (const [prop, value] of decls) if (['font-family', 'font-weight', 'font-style'].includes(prop) && value && !/var\(|^(inherit|initial|unset|revert)/.test(value)) out[prop] = value;
    return out;
  };
  const specs = new Set<any>();
  for (const r of rules) {
    const page = faceOf(r.style);
    for (const own of [{}, ...Object.values(r.boxStyles).map(faceOf)]) {
      const face = { ...page, ...own };
      if (face['font-family']) specs.add(`${face['font-style'] ?? 'normal'} ${face['font-weight'] ?? 'normal'} 16px ${face['font-family']}`);
    }
  }
  return [...specs];
}

/**
 * Every margin box's own declarations, `content` excluded — that one is delivered as a shadow literal (*chrome is resolved, never flowed*, I4) and stripped from the author's sheet by `neutralizeMarginBoxes`.
 *
 * Deliberately a second walk beside `marginBoxesOf` rather than a widening of it: that function's content-gated table is css-page-3 §5.2's own condition — *a page-margin box is generated if and only if the computed value of its content property is not none* — so a box that declares no content is rightly absent from it (*a margin box exists by its content*, 2026-09-15, which closed the question NEEDED-FIXES §2.1 had left open). This one reports every box the CSSOM presents, because the dress is written for the page kind once; whether a box is generated on a given page is decided later, by its resolved content, and a box that is not paints none of what is written here.
 */
function marginBoxStylesOf(rule: CSSPageRule) {
  const out: Record<string,Decl[]> = {};
  for (const child of ((rule.cssRules ?? []) as Iterable<MarginRuleLike>)) {
    const name = (child.name ?? child.selectorText ?? '').replace(/^@/, '');
    if (!MARGIN_BOXES.includes(name)) continue;
    const decls = declarationsOf(child.style, ownedOnCell).filter(([prop]) => prop !== 'content');
    if (decls.length) out[name] = decls;
  }
  return out;
}

/**
 * Does this declaration reach a child? — the Oracle answering, not a table.
 *
 * css-page-3 §6: the page-margin boxes inherit from the page context, and the document's own content does not — it inherits from the root element. So the page context's declarations split in two, and the split is by inheritance. A hard-coded list of inherited properties would be a second CSS database inside this engine, which is the mistake [page lengths are measured](../../../.claude/decisions/cicero/page-lengths-are-measured.md) removed when it deleted the unit table: the browser knows, and the browser is here.
 *
 * The measurement is a declaration on a parent and two children — one under it, one under an untouched sibling. Comparing the two children rather than child against parent is what keeps a non-inherited property whose value happens to equal its initial value from reading as inherited; and it makes the question the one that actually matters, *does this declaration reach a child*, which answers correctly for `inherit`, `unset` and custom properties without knowing what any of them are.
 */
function createInheritanceProbe(doc: Document) {
  const win = (doc.defaultView as Window);
  const memo: Map<string,boolean> = new Map<any, any>();
  let probe: { wrap: HTMLDivElement; styled: HTMLDivElement; under: HTMLDivElement; control: HTMLDivElement; }|null = null;

  function open() {
    const wrap = doc.createElement('div');
    wrap.id = '__beltype-inheritance';
    wrap.style.cssText = 'position: absolute; left: -100000px; top: 0;';
    const styled = doc.createElement('div');
    const plain = doc.createElement('div');
    const under = doc.createElement('div');
    const control = doc.createElement('div');
    styled.appendChild(under);
    plain.appendChild(control);
    wrap.append(styled, plain);
    doc.body.appendChild(wrap);
    return { wrap, styled, under, control };
  }

  return {
    reaches([prop, value, priority]: Decl): boolean {
      const key = `${prop}|${value}|${priority}`;
      if (memo.has(key)) return (memo.get(key) as boolean);
      const p = (probe ??= open());
      p.styled.style.setProperty(prop, value, priority);
      const hit = win.getComputedStyle(p.under).getPropertyValue(prop) !== win.getComputedStyle(p.control).getPropertyValue(prop);
      p.styled.style.removeProperty(prop);
      memo.set(key, hit);
      return hit;
    },
    dispose() {
      if (probe) {
        probe.wrap.remove();
        probe = null;
      }
    }
  };
}

/**
 * A declared border width takes room only where the same side's style draws a border (*a page box has a border and a padding*, 2026-09-07).
 *
 * CSS's own rule, not a policy: `border-style` is `none` initially and a `none` or `hidden` border computes to a used width of zero however wide it was declared. `@page { border: 5mm }` therefore declares five millimetres and takes nothing, while `@page { border: 5mm solid }` takes five on every side. The declaration block is read rather than a computed style — nothing computes a page context — so the absence of a style declaration IS the initial value, and this is the one place that has to know it.
 *
 * @param style - the side's declared `border-*-style`, or null where none was declared.
 */
export const borderIsDrawn = (style: string|null) => style != null && style !== 'none' && style !== 'hidden';

/**
 * THE PAGE AREA — the page box less its margins, its drawn borders and its paddings, per side (css-page-3 §3: *"The content area of a page box is called the page area"*, and the page box's areas are computed exactly as a block box's).
 *
 * It was margins alone until 2026-09-07, which is why a document declaring either of the other two composed against a page area too wide by twice its padding. Pure arithmetic, exported so it can be pinned without a browser — the hazard the pin exists for is not the subtraction but the pairing: left and right belong to the width and top and bottom to the height, and six terms in two sums is exactly the shape a transposition hides in.
 */
export function pageArea({ pageW, pageH, margins, borders, paddings }: { pageW: Px; pageH: Px; margins: Sides<Px>; borders: Sides<Px>; paddings: Sides<Px>; }): { contentW: Px; contentH: Px; } {
  return {
    contentW: pageW - margins.left - margins.right - borders.left - borders.right - paddings.left - paddings.right,
    contentH: pageH - margins.top - margins.bottom - borders.top - borders.bottom - paddings.top - paddings.bottom
  };
}

/** The floor, in pixels: css-break-3 §4 assumes a fragmentainer's block size is at least this *"to guarantee progress"*, and the same number is taken for the inline size, since a page area a pixel wide holds no line box either. */
export const MIN_PAGE_AREA_PX = 1;

/**
 * The intake floor — a page area at or below one pixel is refused by name (*a page too small to be a page*, 2026-09-07).
 *
 * css-break-3 §4: *"To guarantee progress, fragmentainers are assumed to have a minimum block size of 1px regardless of their used size."* Cicero guarantees progress by another route — the page edge takes the first boundary past the limit — and that route has no floor under it: fed an 8pt page whose declared margins made the page area negative, the driver did not throw. It presented twenty-three intervals and printed **twenty-nine pages of scraps**, reporting no page error, because the advance check of *the build cannot fail* (C2) was satisfied the whole way down: the walk *does* advance, one fragment at a time, indefinitely.
 *
 * So this is not a layout problem the engine should try harder at. It is a declaration the engine should refuse, in exactly the voice *render-identical conditions* (I5) refuses an unstated line-height and `resolve` refuses a length the browser cannot answer — and the scar behind it is the one worth restating: **a defect that produces confetti is harder to diagnose than one that produces an exception.** Every check in the case that found this failed, and not one of them named the page size.
 *
 * Refused at intake like every other refusal in this file: the sweep at the end of `readGeometryTable` reaches every condition a document can produce, so a page nobody has flowed onto yet still refuses before the first measure rather than pages in.
 *
 * @param where - names the page, so a refusal says which one.
 * @throws Error — bare and deliberate (`src/` may not import BelType's error types): a page area at or below {@link MIN_PAGE_AREA_PX} on either axis.
 */
export function assertPageArea({ contentW, contentH }: { contentW: Px; contentH: Px; }, where: string) {
  const bad = [];
  if (!(contentW > MIN_PAGE_AREA_PX)) bad.push(`${contentW.toFixed(2)}px wide`);
  if (!(contentH > MIN_PAGE_AREA_PX)) bad.push(`${contentH.toFixed(2)}px tall`);
  if (!bad.length) return;
  throw new Error(`${where} leaves a page area ${bad.join(' and ')} — css-break-3 §4 assumes a fragmentainer of at least ${MIN_PAGE_AREA_PX}px, and a page area at or below that cannot be laid out at all. This engine would not fail on it, which is worse: it would paginate scraps indefinitely. Check the declared size against the margins, borders and paddings that apply to this page.`);
}


/**
 * Parse one @page rule's selector into { name, first, blank, parity } predicates (null = unconstrained).
 *
 * The specificity is a tuple, not a weighted sum. css-page-3 §4.4 computes a page selector's specificity as (f, g, h) — page type names, then `:first` and `:blank`, then `:left` and `:right` — compared in that order, exactly as an ordinary selector's three counts are. A weighted sum reproduced that ordering for as long as `g` could only ever be 1, and `:blank` is the value that breaks it: `:first:blank` would count 2 at `g` and outrank a page name under any weighting that also let `:first` outrank parity. The tuple has no such tuning to get wrong, and it moves nothing that stood: for every selector without `:blank` the two orders agree term for term.
 */
function parseSelector(sel: string|null|undefined): { name: string|null; first: boolean; blank: boolean; parity: 'left'|'right'|null; specificity: [number,number,number]; } {
  const s = (sel ?? '').trim();
  // The page name carries `:blank`, because the parser refuses the pseudo-class and keeps an identifier (*the host rewrites what the parser drops*, 2026-09-14). A bare `:blank` decodes to a blank condition with no name at all, which is what keeps its specificity at §4.4's (0,1,0) instead of a page type's (1,0,0).
  const { name, blank } = decodePageName(s.replace(/:.*$/, '') || null);
  const first = s.includes(':first');
  const parity = s.includes(':left') ? 'left' : s.includes(':right') ? 'right' : null;
  return { name, first, blank, parity, specificity: [name ? 1 : 0, (first ? 1 : 0) + (blank ? 1 : 0), parity ? 1 : 0] };
}

/** Lexicographic compare of two (f, g, h) page-selector specificities — ascending, so a later application wins in `pageFor`'s accumulation. */
function compareSpecificity(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Margin-box declarations out of a CSSPageRule — via the child CSSMarginRule objects (the pinned Chromium has them; `margin-box-padding.browser.ts` asserts it). Returns { 'bottom-center': rawContentValue, ... }. */
function marginBoxesOf(rule: CSSPageRule): Record<string,string> {
  const out: Record<string,string> = {};
  for (const child of ((rule.cssRules ?? []) as Iterable<MarginRuleLike>)) {
    const name = (child.name ?? child.selectorText ?? '').replace(/^@/, '');
    if (MARGIN_BOXES.includes(name)) {
      const content = child.style?.getPropertyValue('content');
      if (content) out[name] = content.trim();
    }
  }
  return out;
}

/**
 * Every `@page` rule the document wears, wherever it stands: at a sheet's top, or inside an `@layer`, a `@supports` or an `@media` that holds, or an imported sheet. `layered` loses to `unlayered`, as the cascade has it, whatever their order.
 *
 * @remarks ponytail: the layers keep their document order, not their declared order; a page rule that must win over another layer is unlayered, as BelType's own is.
 */
export function pageRulesOf(doc: Document): { layered: CSSPageRule[]; unlayered: CSSPageRule[] } {
  const win = doc.defaultView as Window & typeof globalThis;
  const found: { layered: CSSPageRule[]; unlayered: CSSPageRule[] } = { layered: [], unlayered: [] };
  const rulesOf = (sheet: CSSStyleSheet): Iterable<any> => {
    try { return sheet.cssRules; } catch { return []; } // cross-origin sheet: not ours to read
  };
  const walk = (rules: Iterable<any>, inLayer: boolean) => {
    for (const rule of rules) {
      if (rule instanceof win.CSSPageRule) (inLayer ? found.layered : found.unlayered).push(rule);
      else if (rule.constructor?.name === 'CSSLayerBlockRule') walk(rule.cssRules, true);
      else if (rule.constructor?.name === 'CSSSupportsRule') { if (win.CSS?.supports?.(rule.conditionText)) walk(rule.cssRules, inLayer); }
      else if (rule.constructor?.name === 'CSSMediaRule') { if (win.matchMedia(rule.media.mediaText).matches) walk(rule.cssRules, inLayer); }
      else if (rule.constructor?.name === 'CSSImportRule' && rule.styleSheet) walk(rulesOf(rule.styleSheet), inLayer || rule.layerName != null);
    }
  };
  for (const sheet of styleSheetsOf(doc)) walk(rulesOf(sheet), false);
  return found;
}

/**
 * Clear every author @page margin-box's own `content` declaration in the live CSSOM — never its `size`/`margin`, never anything outside a margin-at-rule. Called once the geometry table above has already read what it needs from these rules (the second channel a named page cannot close).
 *
 * Margin-box chrome is delivered exclusively as a shadow-DOM literal (chase.js's own note under *content is one document*, I6: "it does not live once, so it cannot live twice"), but the author's own @page rules stay linked in the document throughout — their non-page rules keep styling the light-DOM content, so the whole stylesheet can never simply be disabled. Once the press sheet (root.js) renames every `<beltype-page>` to a synthetic geometry name, no author rule with a page-name selector (`@page title`, `@page :left`, …) can be name-matched by the browser's own native cascade any more — only the bare, unnamed base rule still matches every page unconditionally, becoming a second, uncontrolled channel that paints the very same chrome the shadow DOM already delivers correctly. `cases/17-the-borrowed-dress` found this the hard way: a named page's `content: normal` override was honored inside the shadow DOM (confirmed by direct inspection) while the printed page still showed the un-overridden base string, painted by this exact channel. Clearing `content` closes it by construction, for every page, independent of the precise cascade mechanism that let it through.
 */
export function neutralizeMarginBoxes(doc: Document) {
  const { layered, unlayered } = pageRulesOf(doc);
  for (const rule of [...layered, ...unlayered]) {
    if (!rule.cssRules) continue;
    for (const child of (rule.cssRules as unknown as Iterable<MarginRuleLike>)) {
      const name = (child.name ?? child.selectorText ?? '').replace(/^@/, '');
      if (MARGIN_BOXES.includes(name)) child.style?.removeProperty('content');
    }
  }
}

/** A `content` value's terms, as written: a quoted string, a function with its arguments (parentheses balanced, strings inside them skipped), or any other run of non-space characters. */
export function contentTerms(raw: string): string[] {
  const out = [];
  let i = 0;
  const n = raw.length;
  /** The index just past the string that opens at `j`. */
  const pastString = (j: number) => {
    const q = raw[j];
    for (j++; j < n && raw[j] !== q; j++) if (raw[j] === '\\') j++;
    return j + 1;
  };
  while (i < n) {
    if (/\s/.test(raw[i])) { i++; continue; }
    const from = i;
    if (raw[i] === '"' || raw[i] === "'") i = pastString(i);
    else {
      while (i < n && !/\s/.test(raw[i])) {
        if (raw[i] === '(') {
          let depth = 0;
          for (; i < n; i++) {
            if (raw[i] === '"' || raw[i] === "'") { i = pastString(i) - 1; continue; }
            if (raw[i] === '(') depth++;
            else if (raw[i] === ')' && --depth === 0) { i++; break; }
          }
          break;
        }
        i++;
      }
    }
    out.push(raw.slice(from, i));
  }
  return out;
}

/**
 * A margin box's `content`, transliterated for the page's shadow sheet (*the page carries its conditions*, 2026-10-21, ruling 2): never resolved, so the browser evaluates it against the counters and the strings the page host publishes.
 *
 * Every term is the author's as written but two. A `string()` the host encoded as a literal (`gcpm-encoding.js`'s `decodeContentFn`) becomes a read of the property the page publishes it in, `var(--beltype-string-<name>-<which>, "")`. And while the document is not yet cut to its end, `counter(pages)` and `counters(pages, …)` become `""`: the page total is blank until the call that knows it (*the pages are cut as far as they are asked*, Egildo's ruling 2 of 2026-10-12), and a counter cannot print nothing. `counter(page)`, an author's counter, any style the browser knows (an author's `@counter-style` included, P39h), `attr()` and the rest are left for the browser.
 *
 * `element()` is not a value, and splits the value: the terms before the first running element go to the cell's `::before`, the terms after the last to its `::after`, and the running elements themselves, each with its keyword (*a running element is a named node*, 2026-10-21), with any plain string standing between two of them, are the cell's own children (`parts`), which the presentation slots in. A term other than a string between two running elements is dropped, a stated limit no document has asked about.
 *
 * @param raw - the captured value, as {@link PageGeometry}'s `marginBoxes` holds it.
 * @param options - `pagesKnown` false while the run is not complete.
 * @returns `null` for none, normal or nothing declared: the box is not generated (css-page-3 §5.2). Otherwise `before` is always a value, `""` at the least, so the cell's computed `content` says the box exists.
 */
export function transliterateContent(raw: string|null|undefined, { pagesKnown = true }: { pagesKnown?: boolean; } = {}): { before: string; after: string|null; parts: Array<string|{ element: string; which: string; }>; }|null {
  if (!raw || raw === 'none' || raw === 'normal') return null;
  const segments: string[][] = [[]];
  const parts: Array<string|{ element: string; which: string; }> = [];
  for (const term of contentTerms(raw)) {
    const quoted = /^(["'])(.*)\1$/s.exec(term);
    const fn = quoted ? decodeContentFn(quoted[2]) : null;
    if (fn?.fn === 'element') {
      parts.push({ element: fn.ident, which: fn.which });
      segments.push([]);
      continue;
    }
    const seg = (segments.at(-1) as string[]);
    if (fn?.fn === 'string') seg.push(`var(${encodeStringProp(fn.name, fn.which)}, "")`);
    else if (!pagesKnown && /^counters?\(\s*pages\s*[,)]/i.test(term)) seg.push('""');
    else seg.push(term);
  }
  // The strings between two running elements are the cell's own text, in order among them.
  if (segments.length > 2) {
    const woven: Array<string|{ element: string; which: string; }> = [];
    parts.forEach((part, k) => {
      woven.push(part);
      if (k < parts.length - 1) for (const t of segments[k + 1]) { const q = /^(["'])(.*)\1$/s.exec(t); if (q) woven.push(q[2]); }
    });
    parts.splice(0, parts.length, ...woven);
  }
  const after = parts.length && (segments.at(-1) as string[]).length ? (segments.at(-1) as string[]).join(' ') : null;
  return { before: segments[0].length ? segments[0].join(' ') : '""', after, parts };
}

/**
 * Register the two rewritten GCPM declarations, at intake.
 *
 * A custom property inherits unless it is registered otherwise, and neither original does: an unregistered `--beltype-string-set` on an `h2` would reach every descendant of that heading, and the document-state walk — which reads every element — would record one assignment per descendant at a deeper position. Registering with `inherits: false` hands the browser's own cascade the whole question, which is the point of the encoding.
 *
 * Guarded the way `createLengthResolver`'s probe guards it: an engine with no `registerProperty` gets the unregistered behaviour rather than a refusal, and a second registration of the same name throws and is ignored — the call is idempotent because a document may be paginated more than once in one realm.
 *
 * @returns Whether the realm could register at all.
 */
export function registerGcpmProperties(win: (Window&typeof globalThis)|null|undefined): boolean {
  if (typeof win?.CSS?.registerProperty !== 'function') return false;
  for (const name of CUSTOM_PROPS) {
    try {
      win.CSS.registerProperty({ name, syntax: '*', inherits: false });
    } catch { /* already registered in this realm, which is the only way this throws for a syntax the browser accepted once */ }
  }
  return true;
}

/**
 * Read the document's whole @page world from the CSSOM into a geometry table.
 *
 * @returns `marginBoxes` as raw content values, transliterated per page via {@link transliterateContent}; `furnitureFaces` the `FontFaceSet.load()` arguments for the faces the margin boxes name.
 * @throws Error — bare and deliberate (`src/` may not import BelType's error types): no `@page` rule at all, and at intake every refusal `resolve` and {@link assertPageArea} make; `pageFor` itself throws, lazily, for a condition with no explicit size.
 */
export function readGeometryTable(doc: Document): { pageFor: (cond?: PageCondition) => PageGeometry; furnitureFaces: string[]; } {
  type PageRuleRecord = {
    sel: ReturnType<typeof parseSelector>;
    size: string[] | null;
    style: Decl[];
    area: Decl[];
    boxStyles: Record<string, Decl[]>;
    margins: Sides<string | null>;
    borderWidths: Sides<string | null>;
    borderStyles: Sides<string | null>;
    paddings: Sides<string | null>;
    marginBoxes: Record<string, string>;
    /** Written by the split pass, before `pageFor` reads it. */
    split: { host: Decl[], cell: Decl[] };
  };
  const rules: PageRuleRecord[] = [];
  const { layered, unlayered } = pageRulesOf(doc);
  for (const rule of [...layered, ...unlayered]) {
    const sel = parseSelector(rule.selectorText);
    // The rule's own declaration block, never its serialized text: `rule.cssText` carries the nested margin boxes inside it, so a regex over it credits a folio's `margin-top` to the page and reads a running head's `font-size` as the page's `size` (a page rule reads its own declarations; the arithmetic is on the checklist, the case is `15-the-margin-box`). `size` is a descriptor rather than a property and is exposed here anyway — measured, not assumed.
    const declared = ( prop: string) => rule.style?.getPropertyValue(prop).trim() || null;
    const size = declared('size')?.split(/\s+/) ?? null;
    // Longhands only: the CSSOM has already expanded whatever shorthand was written, and re-expanding it here would re-implement the browser's own work.
    //
    // Except where it has expanded nothing. A shorthand carrying a `var()` is held in pending substitution — the block answers `margin` with the author's text and every one of `margin-top`…`margin-left` with the empty string — so reading longhands alone reports no declaration at all, and the page lays out against a default. That is not a plausible failure: measured 2026-09-09, `@page { margin: var(--outer) }` with `--outer: 12mm` composed against BelType's own inlined default of 20mm and against 0 in a bare document, both silently, and the case is `33-the-shorthand-the-cssom-cannot-expand`. So the shorthand is consulted only when all four longhands are empty, which is exactly the pending-substitution state and nothing else — the browser expands every shorthand it can, so a non-empty longhand means there is nothing here to do. `expandBox` hands back the author's raw values, which the resolver then seats and measures per side exactly as it does a longhand's; nothing about lengths is decided here.
    //
    // Its reach is one level: `border: 5px var(--style)` leaves `border-width` empty too, and that stays unread. Naming it rather than widening the door — a shorthand of shorthands is a second expansion with a second grammar, and no document has asked for it.
    const perSide: (prefix: string,suffix?: string) => Sides<string|null> = (prefix, suffix = ''): Sides<string|null> => {
      const sides = { top: declared(`${prefix}-top${suffix}`), right: declared(`${prefix}-right${suffix}`), bottom: declared(`${prefix}-bottom${suffix}`), left: declared(`${prefix}-left${suffix}`) };
      if (sides.top || sides.right || sides.bottom || sides.left) return sides;
      const shorthand = declared(`${prefix}${suffix}`);
      return (shorthand && expandBox(substituteRootVars(doc, shorthand))) || sides;
    };
    rules.push(({
      sel,
      size,
      style: declarationsOf((rule.style as CSSPageDescriptors & Iterable<string>)),
      area: areaDeclarationsOf((rule.style as CSSPageDescriptors & Iterable<string>)),
      boxStyles: marginBoxStylesOf(rule),
      margins: perSide('margin'),
      // A border width's used value is zero unless a style is set, so the style is read beside the width and the two are accumulated separately — a `@page { border: 5px }` declares a width and no style, and takes no room at all.
      borderWidths: perSide('border', '-width'),
      borderStyles: perSide('border', '-style'),
      paddings: perSide('padding'),
      marginBoxes: marginBoxesOf(rule)
    } as PageRuleRecord));
  }
  if (!rules.length) throw new Error('no @page rule found — the corpus and the venue always pin geometry (I5)');

  // The split, once per rule set rather than once per page: each surviving declaration goes to the margin cells if it reaches a child and to the host otherwise (css-page-3 §6). The set of declarations is fixed by the rules, so one probe answers for the whole document and `pageFor` is left with nothing but accumulation.
  const inheritance = createInheritanceProbe(doc);
  try {
    for (const r of rules) {
      r.split = { host: [], cell: [] };
      for (const decl of withoutPageCounter(r.style)) (inheritance.reaches(decl) ? r.split.cell : r.split.host).push(decl);
    }
  } finally {
    inheritance.dispose();
  }

  const resolver = createLengthResolver(doc);
  const resolve: Resolve = (raw, basePx, where, prop) => resolver.resolve(raw, basePx, where, prop);

  /**
   * `blank` is the fourth condition since parity forcing was built (*a parity is worth a page*): css-page-3 §4.2.3's `:blank` matches a content-empty page produced by `left`/`right`/`recto`/`verso`, and nothing else about such a page changes — it keeps its parity and its page name, so a blank right page is matched by `@page :blank` and `@page :right` alike, which is the specification's own example. Only a `:blank` rule is gated on it.
   *
   * @throws Error — bare and deliberate: a condition whose cascade yields no `size`, tagged `noExplicitSize` for the intake sweep; and every refusal `resolve` and {@link assertPageArea} make.
   */
  function pageFor({ name = '', first = false, parity = 'right', blank = false }: PageCondition = {}): PageGeometry {
    const applicable = rules
      .filter((r) => (r.sel.name === null || r.sel.name === name) && (!r.sel.first || first) && (!r.sel.blank || blank) && (!r.sel.parity || r.sel.parity === parity))
      .sort((a, b) => compareSpecificity(a.sel.specificity, b.sel.specificity)); // ascending: later application wins

    let size: string[]|null = null;
    const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
    const margins: Sides<string|null> = { top: null, right: null, bottom: null, left: null };
    const borderWidths: Sides<string|null> = { top: null, right: null, bottom: null, left: null };
    const borderStyles: Sides<string|null> = { top: null, right: null, bottom: null, left: null };
    const paddings: Sides<string|null> = { top: null, right: null, bottom: null, left: null };
    const marginBoxes: Record<string,string> = {};
    // The author's own style for this condition, accumulated in ascending specificity — the rules are already sorted that way, so appending reproduces the cascade inside the single rule these triples are re-emitted into: later wins, `!important` beats normal, and this file decides none of it.
    const pageStyle: PageStyle = { host: [], cell: [], area: [], boxes: {} };
    for (const r of applicable) {
      if (r.size) size = isOrientationOnly(r.size) && size ? [...size.filter((t) => !ORIENTATIONS.has(t.toLowerCase())), ...r.size] : r.size; // a keyword alone turns the sheet the cascade gave (`sizeToPx`)
      for (const side of SIDES) {
        if (r.margins[side] != null) margins[side] = r.margins[side];
        if (r.borderWidths[side] != null) borderWidths[side] = r.borderWidths[side];
        if (r.borderStyles[side] != null) borderStyles[side] = r.borderStyles[side];
        if (r.paddings[side] != null) paddings[side] = r.paddings[side];
      }
      Object.assign(marginBoxes, r.marginBoxes);
      pageStyle.host.push(...r.split.host);
      pageStyle.cell.push(...r.split.cell);
      pageStyle.area.push(...r.area);
      for (const [box, decls] of Object.entries(r.boxStyles)) pageStyle.boxes[box] = [...(pageStyle.boxes[box] ?? []), ...decls];
    }
    if (!size) {
      const e: Error&{ noExplicitSize?: boolean; } = new Error(`@page for '${name || '(default)'}' has no explicit size — always pin geometry (I5)`);
      e.noExplicitSize = true; // the intake sweep below tolerates this refusal and this one only (page lengths are measured, decision 6)
      throw e;
    }
    const label = `@page '${name || '(default)'}'`;
    const [pageW, pageH] = sizeToPx(size, resolve);
    // Per-axis percentage bases, css-page-3 §6, and the sentence covers both: *"Percentage values on the margin and padding properties are relative to the dimensions of the containing block. For right and left values, percentages are relative to the width of the containing block; for top and bottom values, percentages are relative to the height."* A border width takes no percentage at all, so its base is never consulted — the declaration would not have reached the CSSOM.
    const basePx = ( side: Side) => (side === 'top' || side === 'bottom' ? pageH : pageW);
    const four: (declared: Sides<string|null>,fallback: string,name: string,prop: ProbeSeat) => Sides<Px> = (declared, fallback, name, prop): Sides<Px> => (Object.fromEntries(SIDES.map((side) => [side, resolve(declared[side] ?? fallback, basePx(side), `${label} ${name}-${side}`, prop)])) as Sides<Px>);
    const m = four(margins, '0px', 'margin', 'marginTop');
    const p = four(paddings, '0px', 'padding', 'paddingTop');
    // A declared width counts only where the same side's style draws a border. The style itself is not modelled beyond that — it rides to the content area with the rest of the author's declarations, and this reads it for one bit.
    const b = (Object.fromEntries(SIDES.map((side) => [side, borderIsDrawn(borderStyles[side]) ? resolve(borderWidths[side] ?? 'medium', basePx(side), `${label} border-${side}-width`, 'borderTopWidth') : 0])) as Sides<Px>);
    const area = pageArea({ pageW, pageH, margins: m, borders: b, paddings: p });
    assertPageArea(area, label);
    return { pageW, pageH, margins: m, borders: b, paddings: p, ...area, marginBoxes, pageStyle, pageCounter: pageCounterOf(applicable) };
  }

  /**
   * The intake sweep (*page lengths are measured*, decision 3). Every reachable condition is resolved once, here — where the document is live and the fonts are awaited — so an unresolvable length refuses at intake rather than throwing from inside the per-page loop, pages deep, after the measure context has been built. The set is finite and small: each declared page name plus the unnamed page, × `:first`, × parity. Afterwards the memo answers every per-page call, so `pageFor` stays synchronous and keeps its signature.
   *
   * Lengths only, and since 2026-09-07 the page area they add up to. A condition whose cascade yields no `size` still refuses on the clock it has always refused on — lazily, when content reaches it. Sweeping that eagerly would refuse every declared-but-unreached named page and stop documents rendering that render today, which is a second behavioral change and a strictly worse one. The page-area floor is not that shape: it fires on a condition whose lengths all resolved and whose arithmetic then came out at nothing, which is a document that is wrong rather than a page nobody reached.
   */
  resolver.hold();
  try {
    const names = new Set(['']);
    for (const r of rules) if (r.sel.name) names.add(r.sel.name);
    for (const name of names) {
      for (const first of [false, true]) {
        for (const parity of (['right', 'left'] as Array<'left' | 'right'>)) {
          for (const blank of [false, true]) {
            try {
              pageFor({ name, first, parity, blank });
            } catch (e) {
              if (!(e as { noExplicitSize?: boolean } | null | undefined)?.noExplicitSize) throw e;
            }
          }
        }
      }
    }
  } finally {
    resolver.dispose();
  }

  return { pageFor, furnitureFaces: furnitureFacesOf(rules) };
}

/**
 * A box's effective page name (css-page-3 §8.1): its own computed `page` when that is not `auto`, else the nearest ancestor's non-auto value, else the unnamed page — the root's `auto` IS the unnamed page, which is where the walk ends.
 *
 * The walk is the whole of what *the grab descends* needed here. `page` is not an inherited property in the CSSOM, so `getComputedStyle(section).page` reads `''` when the name is declared on a descendant and `getComputedStyle(h2).page` reads `'auto'` when it is declared on an ancestor: a single lookup is correct about the element it is handed and says nothing about the element's page. For a top-level block, whose ancestors are `body` and `html` at `auto`, the walk answers exactly what the single lookup answered — which is why no standing named-page number moves with it.
 *
 * @returns `''` for the unnamed page.
 */
export function effectivePageName(el: Element): string {
  for (let e = (el as Element | null); e; e = e.parentElement) {
    const p = (e.ownerDocument.defaultView as Window).getComputedStyle(e).page;
    if (p && p !== 'auto') return p;
  }
  return '';
}
