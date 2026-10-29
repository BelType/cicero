/**
 * The rewriter: a stylesheet's text into the forms the browser's parser keeps (*the host rewrites what the parser drops*, 2026-09-14).
 *
 * **And since 2026-10-03 (*a pointer is a read*) a fifth, which the parser keeps and the browser cannot compute**: `target-counter()`, `target-counters()` and `target-text()` in an element's `content`. Chromium keeps the `attr()`-bearing forms in the CSSOM and fails them at computed-value time, and drops a literal-URL form at parse; either way the pseudo-element computes `content: none`. Each function is replaced in place by `var(--beltype-read-…, "")`, the property the engine delivers the value into (`src/reads.js`).
 *
 * **And since 2026-10-06 (*the measure runs under print media*) a sixth, which is not a rename at all**: a group rule whose media list is `print` or `all` is opened and its rules stand at its level, one whose list is `screen` is removed, and a list naming both or carrying a feature is left for the browser. The engine measures in a screen browser, and the paper the pages are for is print; the rules an author wrote for that paper must be the rules the lines are cut under and the page geometry is read from (`.claude/decisions/cicero/the-measure-runs-under-print-media.md`). Both edits keep every line where the author put it.
 *
 * **And since 2026-10-10 (*one attribute has words*) a seventh, which the parser keeps and the engine cannot answer from a hollow copy**: `:has()`. A box outside a page's interval is presented as an element with no children, and nothing is inside it for `:has()` to find. Every `:has(A)`, at any depth and in any grouping rule, becomes `:is(:where([data-beltype~="has:H"]):is(*, A′), :has(A))` — line-preserving, nothing else touched — whose word arm a copy satisfies (the engine writes `has:H` on every copy whose original satisfies `A`) and whose native arm keeps the originals matching; its specificity is the native one exactly. Each rewritten sheet ends with one rule that matches nothing, `:not(*) { --beltype-has-H: "A" }`, carrying each argument so the capture reads it from the CSSOM and never parses a selector back. `H` is six base-36 characters of the argument's canonical text, widened on a collision. **An argument that reads state a word computed once cannot follow** — `:hover`, `:checked`, `:focus-within`, `:target` and their kin, or a `&` — is left unrewritten and keeps today's guard for its document (`kept` names the rule). The spellings are `src/data-beltype.js`'s.
 *
 * **And since 2026-10-19 (*the site reads*) an option for a host with no pages**: with `rewriteSheet(text, { pages: false })`, which the site engine passes, a `content` declaration that reads a page (`target-counter(…, page)`) is left whole, so the screen drops it as it always has rather than showing `p. ` before nothing (ruling R2a); the media pass and the `:has()` union do not run, because they exist for the paper the pages are cut for and for the hollow copies a page holds, and a host with no pages has neither. Every other rename runs as ever, the running element's among them, so the host can see it. Without the option every byte is what it was.
 *
 * **And since 2026-10-21 (*the page carries its conditions*) an eighth, `string()` in an element's `content`**, which Chromium drops at parse in every form (probe P39e): each `string(<name>[, <which>])` is replaced in place by `var(--beltype-string-<name>-<which>, "")`, the keyword written out, the property the page host publishes for the page the site stands on (`src/gcpm-encoding.js`'s `encodeStringProp`, `src/chase.js`'s `setStrings`). A site measured off the page reads the fallback, which is its reservation. With `pages: false` a declaration that reads one is left whole, as a page read is.
 *
 * **And since 2026-10-17 (*the author's sheets in a layer the host names*) a wrap, which renames nothing and is asked for**: with `rewriteSheet(text, { layer })` the rewritten text is put in `@layer <name> { … }`, line-preserving, closed around and opened again after every top-level at-rule a layer may not hold or the engine must still find at the top (`@page`, `@font-face`, `@counter-style`, `@property`, `@layer`, `@import`, `@namespace`, `@charset`), so no walk in `src/` changes. A host names the layer so that its own sheets, layered after, outrank the author's whatever their specificity (the studio experiment's amendments, an extent narrower than another winning by layer order). Without the option every byte is what it was.
 *
 * Chromium refuses four constructs at parse, measured on the parser probe of 2026-09-14: `string-set` and `position: running()` on an element, `content: string()`/`element()` in a margin at-rule, and the whole of any `@page` rule whose selector carries `:blank` or a selector list. The capture reads the browser's parsed rules and nothing else — a ruling that stands — so the host rewrites the sheet into forms the parser keeps, the browser parses it, and the capture reads the CSSOM it always read. The names and forms are `src/gcpm-encoding.js`'s, and nothing else in this package may spell them.
 *
 * **This is the one implementation.** Four hosts call it: this package's own browser client (`seam/client.js`), the essay's client, BelType's editing tools before they adopt a constructed sheet, and since 2026-10-19 the site engine's runtime, with `pages: false`. A second copy anywhere would be a second answer to *what did the author write*.
 *
 * **It lives here because `seam/` may carry a dependency and `src/` may not.** css-tree is BelType core's own parser and this is its second use in the repository, which is the whole argument the decision record makes against writing a third one: a hand-rolled scanner that mishandles a comment, a string escape or a nested at-rule invents declarations, and the fault is invisible until a stranger's sheet finds it.
 *
 * **Surgical edits, never a regeneration.** css-tree parses with positions and every change is a splice into the author's own text: everything outside the edits is byte-for-byte what the author wrote, comments and formatting included, and every rename lands inside the line it was written on — which is what lets BelType's editing tools keep minting provenance against line numbers over the rewritten text. The one change that adds lines is a selector list split, since it repeats a block; that is stated rather than avoided.
 *
 * **Two passes, deliberately.** The first renames declarations, encodes margin-box content terms, and encodes `:blank` into a page name — all of them edits that do not move a rule's boundaries. The second re-parses that result and splits any remaining `@page` selector list into one rule per selector, whose replacement is a whole at-rule and could not be composed with edits inside it. Two parses of a stylesheet are cheap; one pass juggling nested, overlapping edits would not be.
 *
 * @packageDocumentation
 */

import { parse, walk } from './csstree.ts';
import { STRING_SET_PROP, RUNNING_PROP, encodeString, encodeElement, encodePageName, BLANK_SUFFIX, encodeRead, parseReadFunction, READ_PREFIX, encodeStringProp } from '../src/gcpm-encoding.ts';
import { MARGIN_BOXES } from '../src/margin-boxes.ts';
import { FRAGMENT_GUARD, HAS_PROPERTY_PREFIX, HAS_REGISTRY_SELECTOR, encodeHasArgument, encodeHasUnion } from '../src/data-beltype.ts';

/** One splice: the source's `[start, end)` replaced by `text`. */
export type Edit = { start: number, end: number, text: string };

/** Splice a list of non-overlapping `{ start, end, text }` edits into a source string, right to left so earlier offsets stay valid. */
function applyEdits(source: string, edits: Edit[]) {
  if (!edits.length) return source;
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** A node's own source text, by the offsets css-tree reported. Reading the author's bytes rather than regenerating them is what this whole module does, and here it is also what keeps css-tree's generator out of the import graph: it reaches `source-map-js`, a CommonJS package no browser can consume, and this file runs in three browsers. */
const textOf = ( source: string,  node: any) => source.slice(node.loc.start.offset, node.loc.end.offset).trim();

/** A function term's arguments, split on top-level commas. The forms this module reads take identifiers and keywords only, so a plain split is the whole grammar. */
const argsOf = ( source: string,  term: any) => textOf(source, term).replace(/^[^(]*\(/, '').replace(/\)$/, '').split(',').map((a) => a.trim());

/** A CSS string literal for text this module made: the encoded forms carry no quote and no backslash, so quoting is a pair of characters rather than an escaping problem. */
const quote = ( text: string) => `"${text}"`;

/** The parse the media pass reads: the preludes it needs are its own, and the values are not its concern. */
const MEDIA_OPTIONS = { positions: true, parseAtrulePrelude: false, parseValue: false };

/** The parse the rename pass reads: every prelude and value, since the renames are declarations and functions. */
const SHEET_OPTIONS = { positions: true, parseAtrulePrelude: true, parseValue: true, parseCustomProperty: false };

/**
 * A raw span css-tree left in a style block, parsed again as a stylesheet fragment at the span's own offset, or null where there is nothing to read.
 *
 * @remarks The span must hold a brace: a plain declaration swallowed by a nested rule's statement holds none, and the rewrite never edits one. The fragment's `offset`, `line` and `column` are the span's own, so every node it yields carries the author's offsets and the splices made over them land where the author wrote them. A span that does not parse is null, and the browser judges it.
 *
 * @param source - the text the sheet was parsed from.
 * @param raw - a `Raw` node of that parse.
 * @param options - the parse options that sheet was read with.
 * @returns a `StyleSheet` node.
 */
function reparseRaw(source: string, raw: any, options: object): any|null {
  const text = source.slice(raw.loc.start.offset, raw.loc.end.offset);
  if (!text.includes('{')) return null;
  try {
    return parse(text, { ...options, offset: raw.loc.start.offset, line: raw.loc.start.line, column: raw.loc.start.column });
  } catch {
    return null;
  }
}

/**
 * Walk a parsed sheet with a visitor, and with it every nested rule css-tree kept as raw text inside a style block.
 *
 * @remarks css-tree 3.2.1 reads a nested rule as a Rule only when it opens with `&`. A bare `a::after { … }` in a style block comes out as a Declaration whose value is a Raw, and that Raw runs to the next top-level semicolon, so it swallows the rule's body and any plain declaration written after it, and the reads inside that body were never found. The Raw is expanded when the walk reaches it, not when its Block is entered, so the visitor still meets nodes in source order: `foldMedia`'s removal bookkeeping depends on that. A Raw is expanded only where a Block or a Declaration holds it, so a Raw at the top of a sheet keeps the browser's verdict. Each expansion covers a strictly shorter span than the text it came from, so the recursion ends.
 *
 * @param root - a parsed `StyleSheet`.
 * @param source - the text it was parsed from.
 * @param options - the parse options it was read with.
 */
function walkStyled(root: any, source: string, options: object, visitor: { enter?: (node: any,item: any,list: any) => void; leave?: (node: any,item: any,list: any) => void; }) {
  const raws = new WeakSet<any>();
  walk(root, {
    enter( node: any,  item: any,  list: any) {
      if (node.type === 'Block') node.children.forEach(( child: any) => { if (child.type === 'Raw') raws.add(child); });
      else if (node.type === 'Declaration' && node.value?.type === 'Raw') raws.add(node.value);
      if (raws.has(node)) {
        const fragment = reparseRaw(source, node, options);
        if (fragment) walkStyled(fragment, source, options, visitor);
        return;
      }
      visitor.enter?.(node, item, list);
    },
    leave( node: any,  item: any,  list: any) {
      visitor.leave?.(node, item, list);
    }
  });
}

/**
 * The media pass — the print group rules opened, the screen ones removed (*the measure runs under print media*, 2026-10-06).
 *
 * A group rule is decided by its list alone: every query a bare `print` or `all` (with or without `only`) opens it, every query a bare `screen` removes it, and anything else — both media named, a feature (`print and (min-width: …)`), `not`, an empty list — is left exactly as written, so nothing the browser can decide is decided twice. It is `@media` and nothing wider: an `@import` or a `<link>` carrying a media list is not a group rule and is outside the ruling.
 *
 * **Opening deletes the wrapper and nothing inside it**: the prelude through the opening brace, and the closing brace. That keeps every inner edit — including this module's own renames, and a nested group rule's own decision — a separate, non-overlapping splice, which is the whole of how nesting is "the same rule applied again" with no recursion here. **Removing keeps the newlines** of what it removes, so a rule below a removed block is still on the line the author wrote it on and the editing tools' provenance, minted over this text, still names the author's own line.
 *
 * A sheet that does not mention `@media` is not parsed for it.
 *
 * @returns null where nothing was decided.
 */
function foldMedia(source: string): { text: string; opened: number; removed: number; }|null {
  if (!/@media/i.test(source)) return null;
  let ast;
  try {
    ast = parse(source, MEDIA_OPTIONS);
  } catch {
    return null; // the browser will judge a sheet this parser cannot read
  }
  const edits: Edit[] = [];
  let opened = 0;
  let removed = 0;
  let removedUntil = 0; // an edit inside a removed block is moot, and a walk in source order meets the block first
  walkStyled(ast, source, MEDIA_OPTIONS, {
    enter(node) {
      if (node.type !== 'Atrule' || String(node.name).toLowerCase() !== 'media' || !node.loc || !node.block?.loc || !node.prelude?.loc) return;
      if (node.loc.start.offset < removedUntil) return;
      const queries = source.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset).replace(/\/\*[\s\S]*?\*\//g, ' ').toLowerCase().split(',').map((q) => q.trim().replace(/^only\s+/, ''));
      if (queries.every((q) => q === 'print' || q === 'all')) {
        edits.push({ start: node.loc.start.offset, end: node.block.loc.start.offset + 1, text: '' }, { start: node.block.loc.end.offset - 1, end: node.loc.end.offset, text: '' });
        opened++;
      } else if (queries.every((q) => q === 'screen')) {
        edits.push({ start: node.loc.start.offset, end: node.loc.end.offset, text: source.slice(node.loc.start.offset, node.loc.end.offset).replace(/[^\n]/g, '') });
        removedUntil = node.loc.end.offset;
        removed++;
      }
    }
  });
  return opened || removed ? { text: applyEdits(source, edits), opened, removed } : null;
}

/** Is this at-rule one of css-page-3's sixteen margin boxes? */
const isMarginBox = ( name: unknown) => MARGIN_BOXES.includes(String(name).toLowerCase());

/**
 * One `@page` selector's `:blank` folded into its page name.
 *
 * `chapter:blank` → `chapter__beltype-blank`, `:blank` → `__beltype-blank`, `:blank:left` → `__beltype-blank:left`. `:first`, `:left` and `:right` are left exactly where they were, because the parser keeps them and the capture already reads them.
 */
function encodeSelector(selector: string) {
  const s = selector.trim();
  if (!/:blank\b/i.test(s)) return s;
  const rest = s.replace(/:blank\b/gi, '');
  const name = (/^[^:]*/.exec(rest) as RegExpExecArray)[0];
  return encodePageName(name, true) + rest.slice(name.length);
}

/** An `@page` prelude's selectors, split on top-level commas. A page selector holds no parenthesis and no string, so a plain split is the whole grammar (css-page-3 §4.1). */
const selectorsOf = ( prelude: string) => prelude.split(',').map((s) => s.trim()).filter(Boolean);

/** The pseudo-classes whose truth a word computed once, from the originals at the start of a run, cannot follow: the browser's or the user's state, which changes while the document is on screen, and the selectors that read the form's own value or a media element's play state. An argument naming any of them is left to the browser, and the document keeps whole copies. (`:visited` is here for privacy's sake as much as for change: the engine could not read it anyway.) */
const USER_STATE = new Set(['hover', 'active', 'focus', 'focus-visible', 'focus-within', 'checked', 'indeterminate', 'target', 'target-within', 'visited', 'valid', 'invalid', 'user-valid', 'user-invalid', 'in-range', 'out-of-range', 'placeholder-shown', 'blank', 'default', 'autofill', 'open', 'popover-open', 'modal', 'fullscreen', 'picture-in-picture', 'playing', 'paused', 'seeking', 'buffering', 'stalled', 'muted', 'volume-locked', 'current', 'past', 'future', 'state', 'scope']);

/** Text with its comments out and its whitespace collapsed: the form an argument is hashed, carried and asked in, and the form `A′` is written in (so the copy of the argument the union adds holds no newline, and a sheet keeps its line count). */
const canon = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();

/** A 53-bit hash of a string (cyrb53), the same on every host. */
function hash53(text: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** canonical argument text → its word's hash, and the reverse: one process answers one argument with one hash, whichever sheet it is met in, and a collision widens the later one. */
const HASH_OF = new Map<any, any>();
const TEXT_OF = new Map<any, any>();

/** The hash of an argument: the first six base-36 characters of its 53-bit hash, widened a character at a time while another argument holds them. Stable for the life of the realm, so a sheet judged again hashes as it did. */
export function hashOfArgument(canonical: string): string {
  const known = HASH_OF.get(canonical);
  if (known) return known;
  const full = hash53(canonical).toString(36).padStart(11, '0');
  let n = 6;
  while (TEXT_OF.has(full.slice(0, n)) && n < full.length) n++;
  const hash = full.slice(0, n);
  HASH_OF.set(canonical, hash);
  TEXT_OF.set(hash, canonical);
  return hash;
}

/**
 * Rewrite one stylesheet's text, and, when the host names a layer, wrap what the rewrite leaves in it (*the author's sheets in a layer the host names*, 2026-10-17).
 *
 * @remarks Without `layer` the answer is exactly what it was before the option existed, byte for byte and by reference. With it, the rewrite runs first, on the author's own text, and {@link wrapInLayer} wraps the result; `changed` then says whether the TEXT moved (a wrap moves it), and `rewrote` whether anything but the wrap did.
 *
 * @param original - the sheet as the author wrote it.
 * @param options - `pages: false` is a host with no pages (the header says what it leaves).
 * @returns `text` is the source itself, unchanged and identical by reference, where nothing matched. `kept` names the rules whose `:has()` was left alone because its argument reads state (see the header).
 */
export function rewriteSheet(original: string, { layer = null, pages = true }: { layer?: string|null; pages?: boolean; } = {}): { text: string; changed: boolean; rewrote: boolean; layered: boolean; counts: { stringSet: number; running: number; content: number; blank: number; split: number; reads: number; opened: number; removed: number; has: number; }; kept: string[]; } {
  const out = rewriteText(original, pages);
  if (!layer) return { ...out, rewrote: out.changed, layered: false };
  const wrapped = wrapInLayer(out.text, layer);
  return { ...out, text: wrapped.text, changed: out.changed || wrapped.wrapped, rewrote: out.changed, layered: wrapped.wrapped };
}

/** The at-rules a layer block may not hold or the engine must still find at a sheet's top level: `@page` (three walks read it from `sheet.cssRules` by `instanceof CSSPageRule`, the top level only), `@font-face`, `@counter-style`, `@property` (not cascaded, so a layer means nothing to them, and the capture reads `@counter-style` at the top), `@layer` (an author's own layer stays the author's own), and `@import`, `@namespace`, `@charset`, which must precede every other rule. */
const HOISTED = new Set(['page', 'font-face', 'counter-style', 'property', 'layer', 'import', 'namespace', 'charset']);

/** A layer name the wrap accepts: an identifier, or dotted identifiers for a sublayer. */
const LAYER_NAME = /^-?[A-Za-z_][\w-]*(\.-?[A-Za-z_][\w-]*)*$/;

/** Is this a name the wrap can write? */
export const isLayerName = ( name: unknown) => typeof name === 'string' && LAYER_NAME.test(name);

/**
 * THE WRAP — a sheet's text inside `@layer <name> { … }`, line-preserving, hoisting nothing (*the author's sheets in a layer the host names*, 2026-10-17).
 *
 * The block is opened before the first top-level rule that may stand in a layer and closed after the last; around each top-level at-rule of {@link HOISTED} it is closed before and opened again after, on the same lines. A layer may be opened many times and its blocks concatenate (css-cascade-5 §6.4.1), so the cascade is the one a single block would give, every `@page` stays at the top level where the walks find it, source order is kept, and no newline is added: a rule is on the line the author wrote it on, which is what the editing tools' provenance needs. A rule that would only open and close an empty block is never written, so the `@import`s and the `@charset` at the head of a sheet stay first. A sheet that holds nothing but hoisted at-rules (a wrapped sheet among them, whose top level is its own layer blocks) is returned as it is, so the wrap is never applied twice. A sheet css-tree cannot parse is returned as it is too, and stays unlayered: refusing to wrap is never worse than wrapping wrong.
 */
export function wrapInLayer(source: string, layer: string): { text: string; wrapped: boolean; } {
  if (!isLayerName(layer)) throw new TypeError(`wrapInLayer: "${layer}" is not a layer name`);
  if (typeof source !== 'string' || !source) return { text: source, wrapped: false };
  /**
   * @type a parsed `StyleSheet`.
   */
  let ast: any;
  try {
    ast = parse(source, { positions: true, parseAtrulePrelude: false, parseRulePrelude: false, parseValue: false });
  } catch {
    return { text: source, wrapped: false };
  }
  const edits: Edit[] = [];
  let open = false;
  let lastEnd = -1;
  ast.children.forEach(( node: any) => {
    if (!node.loc || node.type === 'Comment') return;
    const hoisted = node.type === 'Atrule' && HOISTED.has(String(node.name).toLowerCase());
    if (hoisted) {
      if (open) edits.push({ start: lastEnd, end: lastEnd, text: ' }' });
      open = false;
      return;
    }
    if (!open) edits.push({ start: node.loc.start.offset, end: node.loc.start.offset, text: `@layer ${layer} { ` });
    open = true;
    lastEnd = node.loc.end.offset;
  });
  if (open) edits.push({ start: lastEnd, end: lastEnd, text: ' }' });
  if (!edits.length) return { text: source, wrapped: false };
  return { text: applyEdits(source, edits), wrapped: true };
}

/**
 * THE REWRITE PROPER, one sheet's text (the header's seven), without the wrap.
 *
 * @param original - the sheet as the author wrote it.
 * @param pages - false for a host with no pages: no media pass, no `:has()` union, and a declaration that reads a page left whole.
 */
function rewriteText(original: string, pages: boolean = true): { text: string; changed: boolean; counts: { stringSet: number; running: number; content: number; blank: number; split: number; reads: number; opened: number; removed: number; has: number; }; kept: string[]; } {
  const counts = { stringSet: 0, running: 0, content: 0, blank: 0, split: 0, reads: 0, strings: 0, opened: 0, removed: 0, has: 0 };
  const kept: string[] = [];
  if (typeof original !== 'string' || !original) return { text: original, changed: false, counts, kept };

  // The media pass first, over the author's own text: every offset below is read from what it leaves, and it never moves a line.
  const folded = pages ? foldMedia(original) : null;
  const source = folded ? folded.text : original;
  if (folded) ({ opened: counts.opened, removed: counts.removed } = folded);

  let ast;
  try {
    ast = parse(source, SHEET_OPTIONS);
  } catch {
    return { text: source, changed: Boolean(folded), counts, kept }; // a sheet this parser cannot read is one the browser will judge for itself; refusing to rewrite is never worse than refusing to render
  }

  const edits: Edit[] = [];
  // A margin at-rule's `content` is the only place the page-side encoding applies, so the walk carries where it is.
  let inMarginBox = 0;
  let inPage = 0;

  // A sheet already carrying the registry rule has been through this pass; its `:has(` are the unions' own native arms, and rewriting them again would nest a union in a union.
  const mayHaveHas = pages && /:has\(/i.test(source) && !source.includes(HAS_PROPERTY_PREFIX);
  /**
   * @type the arguments this sheet's unions carry, by hash
   */
  const registry: Map<string,string> = new Map<any, any>();

  /** The `:has()` rewrite, one rule's selector at a time (the header's seventh): each `:has(A)` a rule's selector holds, at any depth of `:is`, `:not` and `:where`, is replaced by its union; an argument that reads state, or that nests, is left and named. */
  const rewriteHas = (rule: any) => {
    let keptHere = false;
    walk(rule.prelude, {
      visit: 'PseudoClassSelector',
      enter( n: any) {
        if (String(n.name).toLowerCase() !== 'has' || !n.loc) return;
        const list = n.children?.first;
        const items: { canon: string; bare: string; }[] = [];
        /**
         * @type Where the native arm's argument takes the sibling guard: the end of each compound that a leading `+` or `~` reaches, so a copy the engine seats among the root's children is never a sibling the argument finds (case 102).
         */
        const guards: number[] = [];
        let readable = list?.type === 'SelectorList' && list.children?.size > 0;
        if (readable) {
          list.children.forEach(( sel: any) => {
            if (sel.type !== 'Selector' || !sel.loc) { readable = false; return; }
            const parts = sel.children.toArray();
            const lead = parts[0]?.type === 'Combinator';
            const start = lead ? parts[1]?.loc?.start.offset : sel.loc.start.offset;
            if (start == null) { readable = false; return; }
            items.push({ canon: canon(source.slice(sel.loc.start.offset, sel.loc.end.offset)), bare: canon(source.slice(start, sel.loc.end.offset)) });
            // The compounds of the sibling run: from a leading `+` or `~`, each compound up to the next combinator, while that combinator is itself `+` or `~`.
            if (lead && ['+', '~'].includes(parts[0].name)) {
              let compoundEnd = null;
              for (let i = 1; i <= parts.length; i++) {
                const part = parts[i];
                if (part && part.type !== 'Combinator') { compoundEnd = part.loc?.end.offset ?? null; continue; }
                if (compoundEnd !== null) guards.push(compoundEnd);
                compoundEnd = null;
                if (!part || !['+', '~'].includes(part.name)) break;
              }
            }
          });
        }
        let reason = readable ? null : 'an argument this pass cannot read';
        if (readable) {
          walk(n, ( m: any) => {
            if (m === n || reason) return;
            if (m.type === 'PseudoClassSelector' && USER_STATE.has(String(m.name).toLowerCase())) reason = `:${String(m.name).toLowerCase()}`;
            else if (m.type === 'NestingSelector') reason = '&';
          });
        }
        if (reason) {
          if (!keptHere) kept.push(`${canon(source.slice(rule.prelude.loc.start.offset, rule.prelude.loc.end.offset))} (${reason})`);
          keptHere = true;
          return;
        }
        const canonical = items.map((i) => i.canon).join(', ');
        const hash = hashOfArgument(canonical);
        registry.set(hash, canonical);
        const from = n.loc.start.offset + 5;
        const to = n.loc.end.offset - 1;
        let native = '';
        let at = from;
        for (const g of guards.sort((a, b) => a - b)) {
          native += source.slice(at, g) + FRAGMENT_GUARD;
          at = g;
        }
        native += source.slice(at, to);
        edits.push({ start: n.loc.start.offset, end: n.loc.end.offset, text: encodeHasUnion(hash, native, items.map((i) => i.bare).join(', ')) });
        counts.has++;
      }
    });
  };

  walkStyled(ast, source, SHEET_OPTIONS, {
    enter(node) {
      if (mayHaveHas && node.type === 'Rule' && node.prelude?.loc) {
        rewriteHas(node);
        return;
      }
      if (node.type === 'Atrule') {
        const name = String(node.name).toLowerCase();
        if (name === 'page') {
          inPage++;
          // The selector's `:blank`, folded into the page name the parser keeps. The prelude's own span is replaced whole, which cannot overlap an edit inside the block.
          if (node.prelude?.loc) {
            const raw = source.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset);
            const encoded = selectorsOf(raw).map(encodeSelector).join(', ');
            if (encoded !== raw.trim()) {
              edits.push({ start: node.prelude.loc.start.offset, end: node.prelude.loc.end.offset, text: encoded });
              counts.blank++;
            }
          }
        } else if (isMarginBox(name)) inMarginBox++;
        return;
      }

      if (node.type !== 'Declaration' || !node.loc) return;
      const property = String(node.property).toLowerCase();

      // The page side. `content: "a " string(chap, first)` → `content: "a " "__beltype-fn:string(chap,first)"`. Only the function terms move; the value's other terms are the author's and stay as written.
      if (inMarginBox > 0 && property === 'content') {
        walk(node.value, (term) => {
          if (term.type !== 'Function' || !term.loc) return;
          const fn = String(term.name).toLowerCase();
          const args = argsOf(source, term);
          if (fn === 'string' && args[0]) {
            edits.push({ start: term.loc.start.offset, end: term.loc.end.offset, text: quote(encodeString(args[0], args[1] || 'first')) });
            counts.content++;
          } else if (fn === 'element' && args[0]) {
            edits.push({ start: term.loc.start.offset, end: term.loc.end.offset, text: quote(encodeElement(args[0], args[1] || 'first')) });
            counts.content++;
          }
        });
        return;
      }
      if (inPage > 0) return; // every other declaration in a page context is the page's own and the parser keeps it

      // THE READS (*a pointer is a read*, 2026-10-03; `target-counters()` since 2026-10-14): `target-counter()`, `target-counters()` and `target-text()` in an element's `content`, each replaced in place by a read of the custom property the engine delivers it into, `""` its fallback — what a reference to a missing target shows. Chromium keeps the `attr()` forms and fails them at computed-value time, and drops a literal-URL form at parse, so this source pass is the one door that sees every spelling; the value's other terms, and `!important`, are the author's and stay.
      if (property === 'content') {
        const found: { term: any; read: NonNullable<ReturnType<typeof parseReadFunction>>; }[] = [];
        /**
         * @type GCPM's `string()` in the flow (*the page carries its conditions*, 2026-10-21): a question about the page the site stands on, answered by the property the page host publishes.
         */
        const strings: { term: any; prop: string; }[] = [];
        walk(node.value, (term) => {
          if (term.type !== 'Function' || !term.loc) return;
          if (String(term.name).toLowerCase() === 'string') {
            const args = argsOf(source, term);
            if (args[0]) strings.push({ term, prop: encodeStringProp(args[0], args[1] || 'first') });
            return;
          }
          const read = parseReadFunction(term.name, textOf(source, term).replace(/^[^(]*\(/, '').replace(/\)$/, ''));
          if (read) found.push({ term, read });
        });
        if (!pages && (strings.length || found.some(({ read }) => read.fn === 'counter' && read.counter === 'page'))) return; // a host with no pages leaves a declaration that reads one as written
        for (const { term, read } of found) {
          edits.push({ start: term.loc.start.offset, end: term.loc.end.offset, text: `var(${encodeRead(read)}, "")` });
          counts.reads++;
        }
        for (const { term, prop } of strings) {
          edits.push({ start: term.loc.start.offset, end: term.loc.end.offset, text: `var(${prop}, "")` });
          counts.strings++;
        }
        return;
      }

      // The element side, where a custom property survives and cascades. The property name alone is replaced for `string-set`, so the author's value text rides through verbatim; `position: running()` becomes a whole declaration, since its value is an identifier the original wrapped in a function.
      if (property === 'string-set') {
        const colon = source.indexOf(':', node.loc.start.offset);
        if (colon > node.loc.start.offset) {
          edits.push({ start: node.loc.start.offset, end: colon, text: STRING_SET_PROP });
          counts.stringSet++;
        }
        return;
      }
      if (property === 'position') {
        const m = /^running\(\s*([^\s)]+)\s*\)$/i.exec(textOf(source, node.value));
        if (m) {
          // `!important` is the declaration's own and lives outside the value's span, so it is restated rather than dropped: a running element declared important must stay important, or the rewrite would change which rule wins.
          edits.push({ start: node.loc.start.offset, end: node.loc.end.offset, text: `${RUNNING_PROP}: ${m[1]}${node.important ? ' !important' : ''}` });
          counts.running++;
        }
      }
    },
    leave(node) {
      if (node.type !== 'Atrule') return;
      const name = String(node.name).toLowerCase();
      if (name === 'page') inPage--;
      else if (isMarginBox(name)) inMarginBox--;
    }
  });

  const once = applyEdits(source, edits);
  const { text: split0, split } = splitPageSelectorLists(once);
  counts.split = split;
  // The registry rule closes the sheet: one rule that matches nothing, each argument a custom property of it.
  const text = registry.size ? `${split0}${split0.endsWith('\n') ? '' : '\n'}${HAS_REGISTRY_SELECTOR} { ${[...registry].map(([h, a]) => `${HAS_PROPERTY_PREFIX}${h}: ${encodeHasArgument(a)}`).join('; ')} }\n` : split0;
  const changed = edits.length > 0 || split > 0 || Boolean(folded);
  return { text: changed ? text : original, changed, counts, kept };
}

/**
 * The second pass — `@page :left, :right { … }` into two rules with the block repeated.
 *
 * Chromium's parser refuses a page selector list outright, measured in the same probe: the whole rule is dropped, not just the selectors it cannot use. Splitting is the only encoding available, and it is exact — css-page-3 §4.1 says a rule with a selector list *"applies to the pages matching at least one of its selectors"*, and rules of equal specificity accumulate in source order, so N copies in place of one produce the same cascade for every page.
 *
 * **This is the one rewrite that adds lines**, since it repeats a block, so a provenance table minted over the result carries the shift from here down. Named rather than avoided: keeping the line count would mean folding the author's own block onto one line, which costs the same honesty somewhere else.
 */
function splitPageSelectorLists(source: string) {
  let ast;
  try {
    ast = parse(source, { positions: true, parseAtrulePrelude: false, parseValue: false });
  } catch {
    return { text: source, split: 0 };
  }
  const edits: Edit[] = [];
  walk(ast, (node) => {
    if (node.type !== 'Atrule' || String(node.name).toLowerCase() !== 'page') return;
    if (!node.prelude?.loc || !node.block?.loc || !node.loc) return;
    const raw = source.slice(node.prelude.loc.start.offset, node.prelude.loc.end.offset);
    const selectors = selectorsOf(raw);
    if (selectors.length < 2) return;
    const block = source.slice(node.block.loc.start.offset, node.block.loc.end.offset);
    edits.push({ start: node.loc.start.offset, end: node.loc.end.offset, text: selectors.map((sel) => `@page ${sel} ${block}`).join('\n') });
  });
  return { text: applyEdits(source, edits), split: edits.length };
}

/** The console line a host says once per document it rewrote — what moved and why a reader of the sheet will meet two strange forms. */
export function rewriteNote(counts: Partial<Record<string,number>>): string|null {

  const parts = [];
  if (counts.stringSet) parts.push(`${counts.stringSet} string-set`);
  if (counts.running) parts.push(`${counts.running} position: running()`);
  if (counts.content) parts.push(`${counts.content} string()/element()`);
  if (counts.blank) parts.push(`${counts.blank} @page :blank`);
  if (counts.split) parts.push(`${counts.split} @page selector list`);
  if (counts.reads) parts.push(`${counts.reads} target-counter()/target-text()`);
  if (counts.strings) parts.push(`${counts.strings} string() in the flow`);
  const media = [counts.opened && `${counts.opened} @media print/all opened`, counts.removed && `${counts.removed} @media screen removed`].filter(Boolean);
  const has = counts.has ? `${counts.has} :has() rewritten into a union that a data-beltype word on the engine's copies also satisfies, with a rule at the end of the sheet that matches nothing and carries the arguments` : null;
  if (!parts.length) {
    if (has) return `BelType/Cicero: ${media.length ? `${media.join(', ')} (the document is measured under print media), and ` : ''}${has}; your own file is untouched.`;
    return media.length ? `BelType/Cicero: measured this document under print media — ${media.join(', ')} in the document's own sheets; your own file is untouched.` : null;
  }
  return `BelType/Cicero: ${media.length ? `${media.join(', ')} (the document is measured under print media), and ` : ''}rewrote ${parts.join(', ')} into forms this browser's CSS parser keeps — it drops all of them, and the engine reads its rules back through the CSSOM.${has ? ` Also ${has}.` : ''} The sheet you inspect in devtools may carry a "${'__beltype-fn:'}…" string literal, a page name ending "${BLANK_SUFFIX}" and a var(${READ_PREFIX}…) where a target-counter() or target-text() was; your own file is untouched.`;
}
