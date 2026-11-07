/**
 * The document's state at a position — what the author's counters stood at, at some point in the flow (*a counter is read at the start of the page*, 2026-09-14).
 *
 * **The name is the interface, and it is deliberately wider than counters.** css-page-3 §6.1's scoping sentence and GCPM's named strings ask the same question of the same document: *at this position, what did the author's machinery stand at* — one for a counter, one for a string. So this module answers a position, and counters were the first thing it held; **since 2026-09-14 (*the host rewrites what the parser drops*) `string-set` is the second, and it is a second kind of operation on the same log rather than a second walk of the same tree** — which is what the module was named for and what it was built to take.
 *
 * **`position: running()` is the third, since 2026-10-21** (*a running element is a named node*, `.claude/decisions/cicero/a-running-element-is-a-named-node.md`): a running element is an assignment of its name, logged at the position the flow stood at where it was written, at any depth, since it is out of the flow and has no word of its own, and its value is its place in the run's list of running elements (`runningAssignmentsOf`). `namedStringsForPage` answers GCPM §1.2.3's four keywords for `element()` with the arithmetic it answers §1.1.2's for `string()`, `null` the empty value; a second implementation of the keywords is refused.
 *
 * Two halves, split on the DOM. `documentOpsOf` walks the element tree once in document order and reads `counter-reset`, `counter-increment`, `counter-set` and the rewritten `string-set` off a `styleOf` it is handed — the only thing here that needs a browser, and `styleOf`, `textOf` and `attrOf` are all injected so a plain object tree can exercise it. `counterStateAt` replays the log up to a position and `stringAssignmentsOf` replays the whole of it, both pure: CSS 2.1's *Nested counters and scope* and GCPM's `<content-list>` are arithmetic over a stack and a term list, checkable without a browser.
 *
 * **The readers are the door** (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`, ruling 3), and `documentOpsOf` is kept over them. A host that holds its document elsewhere than in `<beltype-root>` computes the same counter and string state by supplying `styleOf`, `textOf` and `attrOf`, with the blocks, the ancestors and the position index it has. Nothing on the path from `documentOpsOf` through `blockOpsOf` to `counterStateAt`, `stringAssignmentsOf`, `namedStringsForPage` and `counterStatesAfter` reaches `document`, the root or any node beyond the blocks and ancestors it is handed: the walk descends through each element's `children`, the defaults of `textOf` and `attrOf` read the element they are given, and the replays read only the log. The index (`positions.js`' `indexBlocks`) reads each block's `childNodes`, `nodeType` and `data` on its own, so the blocks need not share a parent; its two style questions, inline and fixed, are parameters too, and their defaults ask the element's own window.
 *
 * **A named string's value is evaluated at the element, its own counter operations already in force.** GCPM §1.1.1: *"the content values of named strings are assigned at the point when the content box of the element is first created"* — so `h2 { counter-increment: chapter; string-set: head "Chapter " counter(chapter) }` reads the chapter the heading itself opens, not the one before it. That is why the evaluation rides the same replay instead of asking `counterStateAt` afterwards.
 *
 * **A position is the flat word index** (`positions.js`), and an operation applies when its position is strictly before the one asked about — and not inside a remainder a carried flow has still to show, which stands before the page's first word in document order and is on that page or after it (beltype#43; `positions.js`' `remaindersOf`). That is §6.1's *"the deepest element in the normal flow that spans the page break"* said in this engine's own space: an element whose first word is the page's first word begins on the new page and does not span the break, so its own operation is not yet in force, while an element that spans the break started before that word and is included. The ancestors above the top-level blocks sit at position **−1** — they open before the document's first word and span every break there is — which is what makes the first page's answer fall out of the same comparison rather than needing a case of its own.
 *
 * **What is not read, each a real gap and each showing as a counter reading low.** A list item's implicit increment, so a `counter(list-item)` an author's own content reads, a margin box's among them, reads low on a page a list continues onto; the list's markers are right since 2026-11-07, because each divided `<ol>`'s copy carries a `start` of HTML's own numbering (`fragments.js`'s `numberDividedLists`); css-lists-3's `reversed()` counters; and a top-level `position: fixed` box, which is not among the flow blocks the position index is built over. `display: none` elements are skipped, which is CSS 2.1's own rule rather than an omission. A `::before`'s and an `::after`'s counters are read since 2026-11-07, where a sheet sets one (`pseudoStyleOf`). **And `content(before)`, `content(after)` and `content(first-letter)` are read as `content()`** — a stated limit rather than a discovered one: a native pseudo-element's own string is generated content this walk does not see, and answering the element's text is the nearest honest answer there is. Where a printer's preparation made a `::before` or an `::after` real, as Caster's does before the cut, the elements it made carry `data-beltype-generated` (`GENERATED_ATTRIBUTE`): `content()` leaves them out and `content(before)` and `content(after)` read them (ruled 2026-11-07).
 *
 * @packageDocumentation
 */

import { STRING_SET_PROP, RUNNING_PROP } from './gcpm-encoding.ts';
import { format as formatCounter } from './counter-styles.ts';
import { inRemainders } from './positions.ts';
import { GENERATED_ATTRIBUTE } from './data-beltype.ts';
import type { Keep } from './forcing-memo.ts';

/** One term of a `<content-list>`, as {@link parseStringSet} reads it. */
export type Term = { kind: 'string', value: string } | { kind: 'content', which: string } | { kind: 'attr', name: string } | { kind: 'counter', name: string, style: string } | { kind: 'counters', name: string, separator: string, style: string };

/** One entry of the log {@link documentOpsOf} writes: an element's counter operations, its named-string assignments, its mark, or a running element's assignment. */
export type Op = {
  reset: [string, number][];
  increment: [string, number][];
  set: [string, number][];
  /** The rewritten `string-set`'s pairs, with the text and attributes their terms name. */
  strings: { name: string, terms: Term[], text: string, before?: string, after?: string, attrs: Record<string, string> }[] | null;
  /** The flat word position the operation sits at. */
  pos: number;
  /** The element's depth in the tree; `Infinity` for a running element. */
  depth: number;
  /** The element itself, where it was marked. */
  mark?: object;
  /** A running element's name and its place in the run's list. */
  running?: { name: string, at: number };
};

/** `counter-reset: a 2 b` → `[['a', 2], ['b', 0]]`. The computed value normalizes name/value pairs, but an absent number still defaults per property, so the default is a parameter. `none` and the empty string yield nothing. */
export function pairsOf(value: unknown, fallback: number): [string,number][] {
  const out: [string,number][] = [];
  const tokens = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens[0] === 'none') return out;
  for (let i = 0; i < tokens.length; i++) {
    // `reversed(name)` is css-lists-3's and is not modelled — it is skipped by name rather than mis-read as a counter called `reversed(name)`.
    if (/^reversed\(/i.test(tokens[i])) {
      if (/^-?\d+$/.test(tokens[i + 1] ?? '')) i++;
      continue;
    }
    const name = tokens[i];
    const next = tokens[i + 1];
    if (/^-?\d+$/.test(next ?? '')) {
      out.push([name, parseInt(next, 10)]);
      i++;
    } else {
      out.push([name, fallback]);
    }
  }
  return out;
}

/** One element's three counter declarations, or `null` where it has none — the log holds only elements that do something, since the replay's scope arithmetic reads an operation's depth and never an element's mere presence. */
function opOf(style: { counterReset?: unknown; counterIncrement?: unknown; counterSet?: unknown; }) {
  const reset = pairsOf(style.counterReset, 0);
  const increment = pairsOf(style.counterIncrement, 1);
  const set = pairsOf(style.counterSet, 0);
  return reset.length || increment.length || set.length ? { reset, increment, set } : null;
}

/**
 * A custom property off whatever `styleOf` answered — a `CSSStyleDeclaration` in a browser, a plain object in a test.
 *
 * The browser answers custom properties through `getPropertyValue` alone (there is no camel-cased alias for them), and a plain object tree answers by key. Asking the declaration first is what keeps the test double a plain object with the property's own name as its key rather than a hand-rolled stub of the CSSOM.
 */
const customOf = ( style: any,  prop: string) => (typeof style?.getPropertyValue === 'function' ? style.getPropertyValue(prop) : style?.[prop]) ?? '';

/**
 * A `<content-list>` into terms — GCPM §1.1.1's own grammar and no more of CSS than it needs.
 *
 * `[<string> | <counter()> | <counters()> | <content()> | <attr()>]+`, and the whole declaration is a comma-separated list of `<custom-ident> <content-list>` pairs. The scanner reads quoted strings whole (a comma inside one is not a separator) and functions to their matching parenthesis, which is what makes the top-level comma split safe; everything else is an identifier.
 *
 * @returns one entry per pair, in declaration order.
 */
export function parseStringSet(value: unknown): { name: string; terms: Term[]; }[] {
  const src = String(value ?? '').trim();
  if (!src || src === 'none') return [];
  const tokens: Array<{ t: 'comma'; }|{ t: 'string'; value: string; }|{ t: 'fn'; name: string; args: string; }|{ t: 'ident'; value: string; }> = [];
  for (let i = 0; i < src.length; ) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === ',') { tokens.push({ t: 'comma' }); i++; continue; }
    if (ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1);
      if (end === -1) return []; // an unterminated string is not a content list; refuse the whole declaration rather than invent a term
      tokens.push({ t: 'string', value: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const word = (/^[^\s,()"']+/.exec(src.slice(i)) as RegExpExecArray)[0];
    i += word.length;
    if (src[i] === '(') {
      let depth = 0;
      let j = i;
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')' && --depth === 0) break;
      }
      if (j >= src.length) return [];
      tokens.push({ t: 'fn', name: word.toLowerCase(), args: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    tokens.push({ t: 'ident', value: word });
  }

  const pairs: { name: string; terms: Term[]; }[] = [];
  let current: { name: string; terms: Term[]; }|null = null;
  for (const tok of tokens) {
    if (tok.t === 'comma') { current = null; continue; }
    if (!current) {
      if (tok.t !== 'ident') return pairs; // a pair must open with the named string's own identifier
      current = { name: tok.value, terms: [] };
      pairs.push(current);
      continue;
    }
    if (tok.t === 'string') { current.terms.push({ kind: 'string', value: tok.value }); continue; }
    if (tok.t === 'fn') {
      const args = splitArgs(tok.args);
      if (tok.name === 'content') current.terms.push({ kind: 'content', which: (args[0] ?? 'text').toLowerCase() });
      else if (tok.name === 'attr') current.terms.push({ kind: 'attr', name: unquote(args[0] ?? '') });
      else if (tok.name === 'counter') current.terms.push({ kind: 'counter', name: args[0] ?? '', style: args[1] ?? 'decimal' });
      else if (tok.name === 'counters') current.terms.push({ kind: 'counters', name: args[0] ?? '', separator: unquote(args[1] ?? ''), style: args[2] ?? 'decimal' });
      continue;
    }
    // A bare identifier where a term was expected is the next pair's name where the author left the comma out; nothing in the grammar makes it a term.
    current = { name: tok.value, terms: [] };
    pairs.push(current);
  }
  return pairs.filter((p) => p.terms.length);
}

/** A function's arguments, split on top-level commas and trimmed; a quoted separator keeps its quotes for `unquote` to take. */
function splitArgs(raw: string) {
  const out: string[] = [];
  let buf = '';
  let quote: string|null = null;
  let depth = 0;
  for (const ch of String(raw)) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const unquote = ( s: string) => (/^(["']).*\1$/.test(s) ? s.slice(1, -1) : s);

/** The whitespace collapsing GCPM asks for: `content()` is *"the string value of the element, determined as if `white-space: normal` had been set"*. */
export const collapse = ( text: unknown) => String(text ?? '').replace(/\s+/g, ' ').trim();

/** An element's text without the elements a printer made from its generated content ({@link GENERATED_ATTRIBUTE}): css-gcpm-3's `content()`, the element's text and not its pseudo-elements'. An element holding none answers its `textContent`, as before. */
export function contentTextOf(el: any): string {
  if (!el?.querySelector?.(`[${GENERATED_ATTRIBUTE}]`)) return el?.textContent ?? '';
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === 3 || node.nodeType === 4) out += node.data;
    else if (node.nodeType === 1 && !node.hasAttribute(GENERATED_ATTRIBUTE)) out += contentTextOf(node);
  }
  return out;
}

/** The text of an element's own `::before` or `::after` where a printer made it real: its children carrying {@link GENERATED_ATTRIBUTE} with that value, or `null` where it has none. */
function generatedTextOf(el: any, which: 'before'|'after'): string|null {
  const made = [...(el?.children ?? [])].filter((child: any) => child.getAttribute?.(GENERATED_ATTRIBUTE) === which);
  return made.length ? made.map((child: any) => child.textContent).join('') : null;
}

/** One element's entry in the log, or `null` where it does nothing and is not marked: its three counter declarations, its rewritten `string-set` with the text and attributes its terms name, and the mark, read off the one `styleOf` answer. */
function opAt(el: any, pos: number, depth: number, { styleOf, textOf, attrOf, marks }: { styleOf: (el: any) => any; textOf: (el: any) => string; attrOf: (el: any,name: string) => string|null; marks: Set<object>|null; }) {
  const style = styleOf(el) ?? {};
  const op = opOf(style);
  // The rewritten `string-set`, read off the same declaration. The element's own text and the attributes its terms name are taken here, while the source is still in its real ancestor chain — the pure replay below evaluates the terms and never touches a node.
  const pairs = parseStringSet(customOf(style, STRING_SET_PROP));
  const strings = pairs.length
    ? pairs.map(({ name, terms }) => ({
      name,
      terms,
      text: collapse(textOf(el)),
      ...Object.fromEntries((['before', 'after'] as const).flatMap((which) => {
        const made = terms.some((t) => t.kind === 'content' && t.which === which) ? generatedTextOf(el, which) : null;
        return made === null ? [] : [[which, collapse(made)]];
      })),
      attrs: Object.fromEntries(terms.filter((t) => t.kind === 'attr').map((t) => [t.name, attrOf(el, t.name) ?? '']))
    }))
    : null;
  const mark = marks?.has(el) ? el : null;
  return op || strings || mark ? { reset: [], increment: [], set: [], ...op, strings, pos, depth, ...(mark ? { mark } : {}) } : null;
}

/** A pseudo-element's counter operations, or `null` where it has none or is not generated: a `::before` or an `::after` whose `content` is `none` or `normal` is no box, and its computed `counter-increment` counts nothing (measured 2026-11-07: Chromium answers `fig 1` for it and the counter stays at 0). */
function pseudoOpOf(el: any, pseudo: '::before'|'::after', styleOf: ((el: any, pseudo: '::before'|'::after') => any)|null|undefined) {
  const style = styleOf?.(el, pseudo);
  return style && !/^(?:none|normal)?$/.test(String(style.content ?? '').trim()) ? opOf(style) : null;
}

/** One top-level block's part of the log: its operations in document order, each with its position and depth relative to the block — the words of the block before the element, and its depth below the block (*a resumed run keeps its reads*, 2026-10-22). {@link documentOpsOf} lays the parts end to end, a part's positions offset by its block's base and its depths by the ancestors above the blocks. */
export function blockOpsOf(block: any, index: { wordsBefore: (el: any) => number; wordCountIn?: (el: any) => number; }, reads: { styleOf: (el: any) => any; textOf: (el: any) => string; attrOf: (el: any,name: string) => string|null; marks: Set<object>|null; pseudoStyleOf?: ((el: any, pseudo: '::before'|'::after') => any)|null; }) {
  const ops: Op[] = [];
  const walk = ( el: any,  depth: number) => {
    const style = reads.styleOf(el) ?? {};
    if (style.display === 'none') return; // CSS 2.1 §12.4.3: an element with `display: none` does not increment or reset counters
    // A `position: fixed` box has zero footprint at any depth (*a fixed box at any depth*, 2026-09-15), so it has no position in the word space this log is ordered by — `indexBlocks` skips it and so does this. A counter operation or a `string-set` inside such a box is therefore unread, which is exactly what was already true of a top-level fixed box and is recorded on the checklist beside it.
    if (style.position === 'fixed' || String(customOf(style, RUNNING_PROP)).trim()) return;
    const pos = index.wordsBefore(el);
    const op = opAt(el, pos, depth, reads);
    // A `::before` is the element's first child and an `::after` its last (CSS 2.1 §12.1), so their counter operations are logged one level down, the one at the element's first word and the other at its end. The element's named strings and its mark are evaluated after its `::before`: the number a heading or a figure prints there is the one its `string-set` and a `target-counter()` to it read.
    const before = pseudoOpOf(el, '::before', reads.pseudoStyleOf);
    if (before) {
      if (op && (op.reset.length || op.increment.length || op.set.length)) ops.push({ ...op, strings: null, mark: undefined });
      ops.push({ ...before, strings: op?.strings ?? null, pos, depth: depth + 1, ...(op?.mark ? { mark: op.mark } : {}) });
    } else if (op) ops.push(op);
    for (const child of el.children ?? []) walk(child, depth + 1);
    const after = index.wordCountIn ? pseudoOpOf(el, '::after', reads.pseudoStyleOf) : null;
    if (after) ops.push({ ...after, strings: null, pos: pos + (index.wordCountIn as (el: any) => number)(el), depth: depth + 1 });
  };
  walk(block, 0);
  return ops;
}

/**
 * The counter operations of a document, in document order, each with the flat word position it sits at and its depth in the tree.
 *
 * @param blocks - the top-level flow blocks, in order — `driver.js`'s `topLevelBlocks`.
 * @param index - the position index (`positions.js`), which holds every element inside every block.
 * @param opts.styleOf - the computed style of an element — injected, so a plain object tree exercises this without a browser.
 * @param opts.pseudoStyleOf - the computed style of an element's `::before` or `::after`, whose counter operations are logged as the element's first and last child's; absent, a pseudo-element's counters are unread. The `::after` needs the index's `wordCountIn`.
 * @param opts.textOf - an element's text; absent, {@link contentTextOf}, its `textContent` without what a printer made from its generated content.
 * @param opts.attrOf - an element's attribute; absent, its `getAttribute`.
 * @param opts.ancestors - the elements above the blocks, outermost first (`html`, `body`). They open before the document's first word and are recorded at position −1.
 * @param opts.marks - elements whose counters are asked about after their own operations (`counterStatesAfter`): each is logged even where it does nothing, carrying itself as `mark`, so the replay reaches it in document order (*a pointer is a read*, 2026-10-03).
 * @param opts.running - the document's running elements in document order (`driver.js`' `runningBoxes`), each with the flat position the flow stood at where it was written (`driver.js`' `runningPosition`): each is logged as an assignment of its name there, carrying its place in this list as `running.at` (*a running element is a named node*, 2026-10-21). A running element is out of the flow at any depth, so the walk does not enter one, and its own counters and strings are unread, as a fixed box's are.
 * @param opts.keep - the memo's door (`forcing-memo.js`): each block's {@link blockOpsOf} part is asked of it, and a part kept from an earlier run is laid in place of a walk (*a resumed run keeps its reads*, 2026-10-22). A part read under marks is kept apart from one read without, and answers only while the marks that fall in its block are the ones it was read under (the position index says which block a mark is in). Absent, every block is walked.
 */
export function documentOpsOf(blocks: ArrayLike<Element>, index: { bases: number[]; wordsBefore: (el: any) => number; wordCountIn?: (el: any) => number; entryFor?: (el: any) => { block: number; }|null; }, { styleOf, pseudoStyleOf = null, textOf = contentTextOf, attrOf = (el, name) => el.getAttribute(name), ancestors = [], marks = null, running = [], keep = null }: { styleOf: (el: any) => object; pseudoStyleOf?: ((el: any, pseudo: '::before'|'::after') => object)|null; textOf?: (el: any) => string; attrOf?: (el: any,name: string) => string|null; ancestors?: Element[]; marks?: Set<object>|null; running?: ReadonlyArray<{ name: string; pos: number; }>; keep?: Keep|null; }) {
  const reads = { styleOf, textOf, attrOf, marks, pseudoStyleOf };
  const ops: Op[] = [];
  ancestors.forEach((el, i) => {
    const op = opAt(el, -1, i, reads);
    if (op) ops.push(op);
  });
  const base = ancestors.length;
  /** The marks in each block, for a kept part's `still`: a part read under other marks is not this call's answer. */
  let marksIn: Map<number,Set<object>>|null = null;
  if (keep && marks) {
    marksIn = new Map<any, any>();
    for (const m of marks) {
      const b = index.entryFor?.(m)?.block;
      if (b == null) continue;
      if (!marksIn.has(b)) marksIn.set(b, new Set<any>());
      (marksIn.get(b) as Set<object>).add(m);
    }
  }
  for (let b = 0; b < blocks.length; b++) {
    const start = index.bases[b];
    const mine = marksIn?.get(b) ?? new Set<any>();
    const read = () => ({ ops: blockOpsOf(blocks[b], index, reads), marks: mine });
    const part = keep
      ? keep(`${marks ? 'ops:marked' : 'ops'}${pseudoStyleOf ? ':pseudo' : ''}`, blocks[b], read, marks ? ( p: { marks: Set<object>; }) => p.marks.size === mine.size && [...mine].every((m) => p.marks.has(m)) : undefined)
      : read();
    for (const op of part.ops) ops.push({ ...op, pos: start + op.pos, depth: base + op.depth });
  }
  if (!running.length) return ops;
  // A running element has no word of its own, so it joins the log at the position the flow stood at, before every operation past it: the log stays in position order, which the replay's early stop needs. Its depth is infinite, so it ends no counter scope.
  const merged: Op[] = [];
  let r = 0;
  for (const op of ops) {
    for (; r < running.length && running[r].pos < op.pos; r++) merged.push(runningOp(running[r], r));
    merged.push(op);
  }
  for (; r < running.length; r++) merged.push(runningOp(running[r], r));
  return merged;
}

/** One running element's operation in the log. */
const runningOp = (r: { name: string; pos: number; }, at: number): Op => ({ reset: [], increment: [], set: [], strings: null, running: { name: r.name, at }, pos: r.pos, depth: Infinity });

/**
 * The document's counters at a position — every operation strictly before it, replayed under CSS 2.1's *Nested counters and scope*.
 *
 * A `counter-reset` on an element creates a new instance whose scope is that element, its descendants and its following siblings — so an instance dies when the walk leaves the element's parent, which in a depth-tagged log is the moment an operation arrives at a depth at or above the creating element's. A second reset at the same depth is a following sibling opening a new scope, so it replaces its predecessor rather than nesting inside it; a reset deeper than an open instance nests, which is what `counters()` reports. *"If 'counter-increment' refers to a counter that is not in the scope of any 'counter-reset', it is assumed that the counter has been reset by that element"* — the root here, depth 0, value 0.
 *
 * @param pos - the flat word position asked about — for a page, its first word.
 * @param away - the remainders the page's opening cut carries in (`positions.js`' `remaindersOf`): an operation before `pos` inside one of them is on this page or a later one, not on a page before it, and is not yet in force (beltype#43). The replay still runs in document order.
 * @returns per counter name, the values of every instance in scope, outermost first. Plain data, so it crosses a `page.evaluate` boundary in the account's `closes` like every other condition.
 */
export function counterStateAt(ops: ReturnType<typeof documentOpsOf>, pos: number, away: ReadonlyArray<{ from: number; to: number; }> = []): Record<string,number[]> {
  return replay(ops, { until: pos, away });
}

/** What the page context's own rules do to the page counter on one page: the `page` value of the winning `counter-reset`, `counter-increment` and `counter-set` of the `@page` rules that apply to it, `null` where the winning declaration names no `page` (`capture.ts`'s `pageFor`). */
export type PageCounterOps = { reset: number | null, increment: number | null, set: number | null };

/** No page-context rule touches the page counter. */
export const NO_PAGE_COUNTER_OPS: PageCounterOps = Object.freeze({ reset: null, increment: null, set: null });

/**
 * The page number of page `pageIndex`, which begins at `pos`: the run's own count, with an element's reset of the page counter counted on from the page it begins on, and the page context's own `counter-reset`, `counter-increment` and `counter-set` applied as Chromium's print applies them.
 *
 * @remarks
 * css-page-3 names a reset of the page counter only in the page context, but an author writes `counter-reset: page 1` on a chapter or on each letter of a print run to number its pages from one, and once the engine applies it the pages after must count on from there rather than stay at the value (Codeberg issue 1). The page counter is the page's own, reset on the host as `page N` (`chase.js`'s `setCounters`), so the reset is folded into N here and never delivered as an author counter: delivered, it reset the flow and the margin cells to the same value on every later page in the reset's scope. `target-counter()` to a page reads the same N (`reads.js`'s `pageValues`), so a reference answers the value the counter has at its target (Codeberg issue 2).
 *
 * The last `counter-reset` or `counter-set` of `page` at or before `pos` is the one in force: **at**, not strictly before, because the element that begins on the page is the one that numbers it, where an author counter's reset waits for the next page (css-page-3 §6.1 is about author counters). Scope is not replayed, since the page counter has one instance: a reset stands until the next one, whatever the depth of either. A reset on an element that begins mid-page numbers the next page.
 *
 * **A blank page the engine makes to bring the element to its side begins where the element does and stands before it** (Codeberg issue 13): the reset is not in force on it, so it continues the count it stands in, and it is not counted toward the pages after it, so the element's page bears the value. A blank page inside the scope, after the element began, counts as every page does.
 *
 * **The page context's rules are the page box's, and each page box is its own scope.** Measured 2026-11-07 on Chromium's print (`test/browser/page-context-counters.browser.ts`): every page adds its `counter-increment` of `page`, or 1 where none is declared, to the count the pages carry; a `counter-set` sets that count, and the pages after count on from it (`@page :first { counter-set: page 7 }` prints 7, 8, 9); a `counter-reset` opens a counter of the page box's own, so the page prints the reset value plus that page's own declared increment and the pages after continue the count as though it had not been there (`@page :first { counter-reset: page 10 }` prints 10, 1, 2, and with `@page { counter-increment: page 2 }` beside it 12, 2, 4). An element's reset is applied to the count before the page's own rules, and the page it begins on takes no implicit increment. Until 2026-11-07 these declarations reached the page host as author style, where `counter-increment: page 2` added to the host's `page N` and the host's inline reset hid every `@page` reset: 3, 4, 5 for Chromium's 7, 2, 4.
 *
 * @param pages - each page before `pageIndex`, by index: its first word position, whether it is blank, and its page context's rules.
 * @param blank - whether page `pageIndex` is one the engine made blank.
 * @param counter - page `pageIndex`'s page context's rules.
 * @param away - the remainders the page's opening cut carries in, as for {@link counterStateAt}.
 */
export function pageNumberAt(ops: ReadonlyArray<Op>, pageIndex: number, pos: number, { pages, blank = false, counter = NO_PAGE_COUNTER_OPS, away = [] }: { pages: (i: number) => { start: number; blank: boolean; counter?: PageCounterOps; }; blank?: boolean; counter?: PageCounterOps; away?: ReadonlyArray<{ from: number; to: number; }>; }): number {
  const inForce = (at: number, start: number, isBlank: boolean) => at < start || (at === start && !isBlank);
  const resets: { pos: number; value: number; }[] = [];
  for (const op of ops) {
    if (op.pos > pos) break;
    for (const [name, value] of [...op.reset, ...op.set]) if (name === 'page') resets.push({ pos: op.pos, value });
  }
  /** The last element reset in force on a page; the current page alone knows the remainders it carries in. */
  const resetOn = (start: number, isBlank: boolean, current: boolean) => {
    let found: { pos: number; value: number; }|null = null;
    for (const r of resets) if (inForce(r.pos, start, isBlank) && !(current && away.length && inRemainders(away, r.pos))) found = r;
    return found;
  };
  let count = 0;
  let shown = 0;
  let before: { pos: number; value: number; }|null = null;
  for (let i = 0; i <= pageIndex; i++) {
    const page = i === pageIndex ? { start: pos, blank, counter } : pages(i);
    const own = page.counter ?? NO_PAGE_COUNTER_OPS;
    const reset = resets.length ? resetOn(page.start, page.blank, i === pageIndex) : null;
    const elementReset = reset !== null && reset !== before;
    before = reset;
    if (elementReset) count = (reset as { value: number }).value;
    if (own.reset !== null) {
      // The page box's own counter: it shows here and the count goes on beneath it.
      shown = own.set ?? own.reset + (own.increment ?? 0);
      continue;
    }
    count += own.increment ?? (elementReset ? 0 : 1);
    if (own.set !== null) count = own.set;
    shown = count;
  }
  return shown;
}

/** The author's counters alone: the page's own two, `page` and `pages`, are the host's (`pageNumberAt`), and delivered as an author's they would reset the flow and the cells under the host's. */
export function withoutPageCounters(state: Record<string,number[]>): Record<string,number[]> {
  if (!('page' in state) && !('pages' in state)) return state;
  const out = { ...state };
  delete out.page;
  delete out.pages;
  return out;
}

/** One replay, two readers. `counterStateAt` stops at a position and returns the state there; `stringAssignmentsOf` runs the log out and is handed the state at each element that assigns a named string. Written once because the scope arithmetic is the delicate part and two copies of it would agree only until one of them was fixed. */
function replay(ops: ReadonlyArray<Op>, { until = Infinity, onOp = null, away = ([] as ReadonlyArray<{ from: number, to: number }>) }: { until?: number; onOp?: ((op: Op,counters: Record<string,number[]>) => void)|null; away?: ReadonlyArray<{ from: number; to: number; }>; } = {}): Record<string,number[]> {
  /**
   * @type name → [{ depth, value }], innermost last.
   */
  const scopes: Map<string,{ depth: number; value: number; }[]> = new Map<any, any>();
  const stackOf = ( name: string) => ((scopes.get(name) ?? (scopes.set(name, []), scopes.get(name))) as { depth: number, value: number }[]);
  const snapshot = () => {
    const out: Record<string,number[]> = {};
    for (const [name, stack] of scopes) if (stack.length) out[name] = stack.map((s) => s.value);
    return out;
  };
  for (const op of ops) {
    if (!(op.pos < until)) break; // the log is in non-decreasing position order, so the first operation at or after the position ends the replay
    if (away.length && inRemainders(away, op.pos)) continue; // behind the position in document order, and not yet shown: a carried flow's remainder (beltype#43)
    // Entering an element at depth d ends every instance created deeper than d: their creating element's parent has been left behind.
    for (const stack of scopes.values()) while (stack.length && stack[stack.length - 1].depth > op.depth) stack.pop();
    for (const [name, value] of op.reset) {
      const stack = stackOf(name);
      while (stack.length && stack[stack.length - 1].depth >= op.depth) stack.pop(); // a following sibling's reset replaces, it does not nest
      stack.push({ depth: op.depth, value });
    }
    for (const [name, delta] of op.increment) {
      const stack = stackOf(name);
      if (!stack.length) stack.push({ depth: 0, value: 0 });
      stack[stack.length - 1].value += delta;
    }
    for (const [name, value] of op.set) {
      const stack = stackOf(name);
      if (!stack.length) stack.push({ depth: op.depth, value: 0 });
      stack[stack.length - 1].value = value;
    }
    // after the element's own counter operations, which is GCPM's *at the point when the content box of the element is first created*, and CSS 2.1 §12.4's order for a `target-counter()` too.
    if (onOp && (op.strings || op.mark)) onOp(op, snapshot());
  }
  return snapshot();
}

/** One `<content-list>` term against the element's own facts and the counter state in force at it. */
function evaluateTerm(term: Term, { text, before, after, attrs, counters }: { text: string; before?: string; after?: string; attrs: Record<string,string>|null|undefined; counters: Record<string,number[]>; }): string {
  switch (term.kind) {
    case 'string': return term.value;
    // `before` and `after` read the pseudo a printer made real, where it did; otherwise they and `first-letter` are read as `text`: a native pseudo-element's own string is generated content this walk does not see, and the module header states the limit rather than pretending to four readings.
    case 'content': return (term.which === 'before' ? before : term.which === 'after' ? after : undefined) ?? text;
    case 'attr': return attrs?.[term.name] ?? '';
    case 'counter': return formatCounter(counterValue(counters, term.name), term.style);
    case 'counters': return counterValues(counters, term.name).map((v) => formatCounter(v, term.style)).join(term.separator);
    default: return '';
  }
}

/**
 * Every named-string assignment the document makes, in document order.
 *
 * @returns plain data, so it crosses a `page.evaluate` boundary and needs no DOM to have produced it.
 */
export function stringAssignmentsOf(ops: ReturnType<typeof documentOpsOf>): { name: string; value: string; pos: number; }[] {
  const out: { name: string; value: string; pos: number; }[] = [];
  replay(ops, {
    onOp: (op, counters) => {
      for (const s of op.strings ?? []) out.push({ name: s.name, pos: op.pos, value: s.terms.map((t) => evaluateTerm(t, { text: s.text, before: s.before, after: s.after, attrs: s.attrs, counters })).join('') });
    }
  });
  return out;
}

/**
 * Every running-element assignment the document makes, in document order — the third kind of operation in the log, and the one whose value is a node (*a running element is a named node*, 2026-10-21).
 *
 * @remarks
 * The value is the element's place in the run's list of running elements, plain data like a string's value, so `namedStringsForPage` answers GCPM §1.2.3's four keywords for `element()` with the arithmetic it answers §1.1.2's for `string()`, and the presentation resolves the place to the element it slots. Nothing about a running element depends on a counter, so it is read off the log rather than replayed.
 *
 * @param ops - logged with `running`.
 */
export const runningAssignmentsOf = (ops: ReturnType<typeof documentOpsOf>): { name: string; value: number; pos: number; }[] => (ops.filter((op) => op.running) as Array<Op & { running: { name: string, at: number } }>).map((op) => ({ name: op.running.name, value: op.running.at, pos: op.pos }));

/**
 * The counters each marked element sees after its own operations — what `target-counter(<url>, <name>)` retrieves (*a pointer is a read*, 2026-10-03).
 *
 * @remarks
 * css-content-3 §2.6.1 retrieves *"the value of the innermost counter with a given name"* at the target, and a counter an element increments is shown by that element already incremented: CSS 2.1 §12.4 applies an element's resets, then its increments, then uses the counters (its own `::before` reads the new value). So this is `counterStateAt` with one variant, ordered by the document and not by the flat position: `counterStateAt` reads strictly before a word, which is the page's question, and two elements opening at one word — a section and its heading — are one position and two places in this log. The replay is the same one, so an ancestor's reset is honoured and a nested reset opens an inner counter, exactly as for the page.
 *
 * @param ops - logged with `marks`.
 * @returns per marked element, every counter in scope, outermost first.
 */
export function counterStatesAfter(ops: ReturnType<typeof documentOpsOf>): Map<object,Record<string,number[]>> {
  const out = new Map<any, any>();
  replay(ops, { onOp: (op, counters) => { if (op.mark) out.set(op.mark, counters); } });
  return out;
}

/**
 * GCPM §1.1.2's four keywords, for one page, per named string.
 *
 * *"The entry value for a page is the assignment in effect at the end of the previous page"* — the last assignment strictly before the page's first word, which is the same strictness the counters read (an element whose first word IS the page's first word begins on this page and has not yet assigned anything to the one before). Then: `first` is the first assignment on the page, or the entry value; `start` is the first assignment **if the assigning element is the first element on the page** — its position is the page's own start — and the entry value otherwise; `last` is the exit value, the assignment in effect at the page's end; and `first-except` is `first` except that the page where the value is assigned reads the empty string.
 *
 * An entry value where nothing has ever been assigned is the empty string, which is §1.1.2's own *"the entry value may be empty if the element hasn't yet appeared"*.
 *
 * **An assignment is on the page its element is on, and that is not the flat interval alone** (beltype#43, 2026-10-15): a word in the remainder of a flow the page's opening cut carries is on this page although it stands before `start`, and a word in a remainder its closing cut carries is on a later one although it stands before `end` (`positions.js`' `remaindersOf`). Order among the page's assignments, and among the pages before it, stays document order.
 *
 * **And for `element()`** (*a running element is a named node*, 2026-10-21): GCPM §1.2.3 gives it the same four keywords, so the same arithmetic answers it over `runningAssignmentsOf`'s log, with `null` for the empty value, no element, where a string has `''`.
 *
 * @param start - the page's first word position.
 * @param end - the next page's first word position, or null on the last page.
 * @param carried - the remainders the page's opening cut carries in, and those its closing cut carries away.
 * @param empty - the entry value where nothing has been assigned, and `first-except` on the page that assigns.
 */
export function namedStringsForPage<V>(assignments: ReadonlyArray<{ name: string; value: V; pos: number; }>, start: number, end: number|null, { into = [], away = [] }: { into?: ReadonlyArray<{ from: number; to: number; }>; away?: ReadonlyArray<{ from: number; to: number; }>; } = {}, empty: V|'' = ''): Record<string,Record<'first'|'start'|'last'|'first-except',V|''>> {
  const out: Record<string,Record<'first'|'start'|'last'|'first-except',V|''>> = {};
  for (const name of new Set(assignments.map((a) => a.name))) {
    const mine = assignments.filter((a) => a.name === name);
    const before = mine.filter((a) => a.pos < start && !inRemainders(into, a.pos));
    const entry = before.length ? before[before.length - 1].value : empty;
    const on = mine.filter((a) => ((a.pos >= start && (end == null || a.pos < end)) || inRemainders(into, a.pos)) && !inRemainders(away, a.pos));
    out[name] = {
      first: on.length ? on[0].value : entry,
      start: on.length && on[0].pos === start ? on[0].value : entry,
      last: on.length ? on[on.length - 1].value : entry,
      'first-except': on.length ? empty : entry
    };
  }
  return out;
}

/** `counter(name)`'s value — the innermost instance in scope, or zero where the document never mentioned the name. */
export const counterValue = ( state: Record<string,number[]>|null|undefined,  name: string) => (state?.[name]?.length ? state[name][state[name].length - 1] : 0);

/** `counters(name, sep)`'s values — every instance in scope, outermost first; empty where the document never mentioned the name, which is the empty string the function then produces. */
export const counterValues = ( state: Record<string,number[]>|null|undefined,  name: string) =>
 state?.[name] ?? [];

/**
 * A counter state as the page-start delivery writes it: one list per nesting level, outermost first, each of the `[name, value]` pairs that have an instance at that level (*an author counter is delivered at each page's start*, 2026-10-14).
 *
 * @remarks `chase.js` writes level zero as the flow's own `counter-reset` and each deeper level on a box of its own, because a `counter-reset` creates one instance per counter per element and a nested instance wants an element inside the one before it.
 *
 * @param state - `counterStateAt`'s answer.
 */
export function counterLevels(state: Record<string,number[]>|null|undefined): [string,number][][] {
  const levels: [string,number][][] = [];
  for (const [name, values] of Object.entries(state ?? {})) values.forEach((value, i) => (levels[i] ??= []).push([name, value]));
  return levels;
}
