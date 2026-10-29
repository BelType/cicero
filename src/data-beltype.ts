/**
 * THE `data-beltype` REGISTRY — one attribute of words, its grammar, and every word in use (*one attribute has words*, 2026-10-10; `.claude/plans/cicero-optimisation/data-beltype.md`, the census beside it).
 *
 * BelType marks an element in one place: the attribute `data-beltype`, holding a space-separated list of words. A word is a flag (`split`) or a value written `key:value` (`has:3gv2ab`, `pos:135`), and never contains a space. An element with nothing to say carries no attribute. It is matched with `[data-beltype~="word"]`, the one selector that picks a word out of a list; **the one test for belonging** is that no stylesheet reads the mark with `attr()` (which returns the whole attribute and cannot pick a word) and that its value has no spaces — the marks that fail it (`data-ref-text`, `data-beltype-toc`, Caster's `data-pdf-*`) stay their own attributes, each with its reason in the census.
 *
 * **This module is the grammar and the table, and it imports nothing.** `src/` may import nothing (the engine's no-dependency law), and the engine writes words, so the registry lives where the engine can reach it, on the `gcpm-encoding.js` precedent: the contract both halves import. `seam/`, the essay, the editing tools and Caster import it from here. BelType's core cannot import an unpublished engine, so core keeps its own literals (`transform` in `shell.js`, the line stamp in `node-map.js`) and `test/data-beltype.test.js` pins them equal to this table — two files and a pin, which is how `site-transform.js` already treats the shape it shares with `shell.js`.
 *
 * **Every writer reads, modifies, writes.** A copy of a source inherits whatever attribute the source carried (the belt's line stamp, an author's own `data-beltype`), so a writer adds a word with {@link addWord} and never sets the whole attribute; the attribute is removed when its last word goes. The engine treats a source's attribute as read-only (*the source document is never written*, C5): words are written on copies only.
 *
 * **The artifact word** (2026-10-14) adds `artifact`, PDF's own name for pagination furniture: the copies the engine repeats that a reader does not read — a running element's copy in a margin box, a fixed box's copy after the first page, a table's repeated header or footer group. The word means PDF's artifact and nothing else, and every artifact is `aria-hidden` too (*an artifact is never read*, 2026-10-17). `fragments.js` keeps it out of a box's words and Caster reads it (`packages/caster/src/adapters/intervals.js`).
 *
 * **No key may end with another key** (`pos:` and `xpos:` cannot both exist), because "every element carrying a key" is selected by substring and a substring cannot anchor to the start of a word. {@link assertNoKeySuffix} checks it once, at load.
 *
 * **One rule, one registry.** The registry is a table of facts, each declared once — its name, its kind, what it is computed from, who writes it and, for a value, the custom property a generated sheet delivers it into — so that a later step adds entries and not a second mechanism. It holds the `has:` family, the line stamp `pos:`, `fragment`, the piece words `split`/`start`/`end`/`slice:N`, `fixed`, the engine-created elements' `shell`/`break`/`fill`, the three words the zeroing needs (`wrapped`, `adjoin`, `away`) and `artifact` (*the piece words*, 2026-10-11; see CHANGELOG 2026-10-11); `hollow` is a later step and is not written here.
 *
 * @packageDocumentation
 */

/** The attribute's name. A single place for the literal; the grammar below is the only code that spells the value. */
export const ATTRIBUTE = 'data-beltype';

/** One fact the registry declares. */
export type Entry = {
  /** The flag, or the key of a value word (`has` for `has:<hash>`). */
  name: string;
  kind: 'flag' | 'value';
  /** `reserved` names a key a later step writes, so that no other mark can take it. */
  status: 'in use' | 'reserved';
  /** Who writes it: core, Cicero, or a host (the editing tools, Caster). */
  writer: 'belt' | 'engine' | 'host';
  /** What it is computed from: a fact of the source document, of the author's original tree, of the cut, or of the host. */
  from: 'source' | 'original' | 'cut' | 'host';
  meaning: string;
  /** A value word's custom property: the generated value sheet delivers `key:N` to CSS as `property: N` on every holder (*Tailwind's trick at run time*, one rule per distinct value written). It is registered (`CSS.registerProperty`) with the syntax `<integer>` and `inherits: false`, because an unregistered custom property inherits, and one that differs on the root of every piece differs on every descendant too: measured on the BGD manual, 25 ms of a 140 ms presentation. */
  property?: string;
  /** Who is meant to read it: an author's stylesheet (Cicero only, not portable to Paged.js or the browser's print), the engine and its hosts, or the host alone. */
  facing?: 'author hook' | 'engine' | 'host';
};

/** Every word and key, once. The table `docs/reference.md` documents, in the same order. */
export const REGISTRY: ReadonlyArray<Readonly<Entry>> = Object.freeze(([
  { name: 'transform', kind: 'flag', status: 'in use', writer: 'belt', from: 'source', facing: 'host', meaning: 'the site engine\'s JSON binding block (`<script type="application/json">`)' },
  { name: 'cicero-provision', kind: 'flag', status: 'in use', writer: 'engine', from: 'host', facing: 'host', meaning: 'Cicero\'s own inline provision in the head; the stylesheet rewrite leaves it alone' },
  { name: 'cicero-interface', kind: 'flag', status: 'in use', writer: 'engine', from: 'host', facing: 'host', meaning: 'Cicero\'s own linked interface sheet; the stylesheet rewrite leaves it alone' },
  { name: 'has', kind: 'value', status: 'in use', writer: 'engine', from: 'original', facing: 'engine', meaning: 'the author\'s original satisfies `:has(<argument>)`; the value is six or more base-36 characters hashing the argument\'s canonical text, widened on a collision' },
  { name: 'pos', kind: 'value', status: 'in use', writer: 'belt', from: 'source', facing: 'host', meaning: 'the merged-document START line a block came from, written only when the host asks for stamps (the editing tools\' line map); a copy inherits it by cloning' },
  { name: 'fragment', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'engine', meaning: 'the root of a copy the engine appended to `<beltype-root>`: a fragment, a fixed box\'s per-page copy or a running element\'s (Caster writes it too, on a span it lifts out of a margin cell)' },
  { name: 'split', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'author hook', meaning: 'this box is divided across pages, on every piece' },
  { name: 'start', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'author hook', meaning: 'this piece is dressed as the box\'s beginning: it keeps the box\'s `::before`, marker, first letter, top edge and indent — which includes the painted shell\'s box, divided yet dressed as a start' },
  { name: 'end', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'author hook', meaning: 'this piece holds the box\'s end: it keeps `::after` and the bottom edge' },
  { name: 'slice', kind: 'value', status: 'in use', writer: 'engine', from: 'cut', facing: 'author hook', property: '--beltype-slice', meaning: 'the Nth page of a divided block, 1-based, written on the root of each of its pieces (not on the boxes nested inside it); the custom property does not inherit' },
  { name: 'fixed', kind: 'flag', status: 'in use', writer: 'engine', from: 'original', facing: 'engine', meaning: 'the per-page copy of a `position: fixed` box' },
  { name: 'shell', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'engine', meaning: 'the painted shell\'s wrapper element, which the engine creates around a box the page edge slices' },
  { name: 'break', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'engine', meaning: 'a `<br>` the Compositor inserted at a line it chose' },
  { name: 'fill', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'engine', meaning: 'a filler `<span>` the Compositor inserted to justify a line' },
  { name: 'wrapped', kind: 'flag', status: 'in use', writer: 'engine', from: 'original', facing: 'engine', meaning: 'the box wraps each fragment whole (`box-decoration-break: clone`), so border and padding stay at a cut; decided by the engine because a selector cannot test the property' },
  { name: 'adjoin', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'engine', meaning: 'the first-child chain after a cut BETWEEN boxes: its block-start margin adjoins the cut and is truncated, and the box is not divided' },
  { name: 'away', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'engine', meaning: 'a box put away on this page (`display: none`): kept as an element so structural selectors read as in the source' },
  { name: 'artifact', kind: 'flag', status: 'in use', writer: 'engine', from: 'cut', facing: 'host', meaning: 'a copy the engine repeats that is not the one a reader reads: a running element\'s copy in a margin box, a fixed box\'s copy on every page after the first, and a table\'s repeated header or footer group; PDF\'s own word for pagination furniture, and nothing else. Every artifact is also aria-hidden' }
] as Entry[]).map((e) => Object.freeze(e)));

/** The flags in use. */
export const FLAGS: ReadonlySet<string> = new Set(REGISTRY.filter((e) => e.kind === 'flag').map((e) => e.name));

/** The keys of the value words, in use and reserved. */
export const KEYS: ReadonlySet<string> = new Set(REGISTRY.filter((e) => e.kind === 'value').map((e) => e.name));

/** The bare words the head's three elements already carry. Named once so the readers test a word and not the attribute's presence. */
export const TRANSFORM = 'transform';
export const CICERO_PROVISION = 'cicero-provision';
export const CICERO_INTERFACE = 'cicero-interface';

/** The words step 2 writes, named once: the engine, the editing tools, Caster and the essay spell them through these and never as a literal of their own. */
export const FRAGMENT = 'fragment';
export const SPLIT = 'split';
export const START = 'start';
export const END = 'end';
export const FIXED = 'fixed';
export const SHELL = 'shell';
export const BREAK = 'break';
export const FILL = 'fill';
export const WRAPPED = 'wrapped';
export const ADJOIN = 'adjoin';
export const AWAY = 'away';
/** PDF's own name for pagination furniture: a copy the engine repeats that a reader does not read (the registry entry says which). */
export const ARTIFACT = 'artifact';

/** The words that mark an element as the engine's own — what the "class starts with `__beltype-`" test used to say, as a named set: a divided box (it carried `__beltype-cont` or `-cut`, and a first fragment `-first`), a fixed box's copy, and the three elements the engine creates. `fragment` is not here: a composed block's clone carried no class and was never an engine mark. */
export const ENGINE_MARKS = Object.freeze(new Set([SPLIT, FIXED, SHELL, BREAK, FILL]));

/** The first key in a set that ends with another key in it, as `[longer, shorter]`, or `null`. */
export function keyEndingWithAnother(keys: Iterable<string>): [string,string]|null {
  const list = [...keys];
  for (const a of list) for (const b of list) if (a !== b && a.endsWith(b)) return [a, b];
  return null;
}

/** Refuse a registry in which a key ends with another. Run at load; exported so the test can hand it a bad table. A plain `Error`, because this module may not import the house's error classes — and because a registry that breaks the rule is a defect to fix in the table, not a runtime condition. */
export function assertNoKeySuffix(keys: Iterable<string>) {
  const clash = keyEndingWithAnother(keys);
  if (clash) throw new Error(`data-beltype: the key "${clash[0]}" ends with the key "${clash[1]}", so a substring match for "${clash[1]}:" would find both — rename one`);
}
assertNoKeySuffix(KEYS);

/** A list of words, split. Empty and absent are the same: no words. */
const split = (text: string|null|undefined): string[] => (text ? text.split(/\s+/).filter(Boolean) : []);

/** The minimum an element must answer for the grammar: the three attribute verbs. A plain object tree (the DOM-free suites) may supply them. */
export type Bearer = { getAttribute(name: string): string | null, setAttribute(name: string, value: string): void, removeAttribute(name: string): void };

/** An element's words, parsed: the flags as a set and the values as a map, a value that reads as a number parsed to one. */
export function words(el: Pick<Bearer,'getAttribute'>): { flags: Set<string>; values: Map<string,string|number>; } {
  const flags: Set<string> = new Set<any>();
  const values: Map<string,string|number> = new Map<any, any>();
  for (const word of split(el.getAttribute(ATTRIBUTE))) {
    const colon = word.indexOf(':');
    if (colon < 0) flags.add(word);
    else {
      const value = word.slice(colon + 1);
      values.set(word.slice(0, colon), /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value);
    }
  }
  return { flags, values };
}

/** The value of a key on an element, or `undefined`. The first word with that key wins; a number is a number. */
export const wordOf = (el: Pick<Bearer,'getAttribute'>, key: string): string|number|undefined => words(el).values.get(key);

/** Does the element carry this exact word — a flag (`cicero-provision`) or a whole value word (`has:3gv2ab`)? */
export function hasWord(el: Pick<Bearer,'getAttribute'>, word: string): boolean {
  const text = el.getAttribute(ATTRIBUTE);
  if (!text) return false;
  // The words are written one space apart, and the common reader is a hot path (the engine asks of every put-away box), so the list is searched as a string. An attribute an author spaced with a tab or a newline is split the long way.
  return /[\t\n\r\f]/.test(text) ? split(text).includes(word) : text === word || ` ${text} `.includes(` ${word} `);
}

/** Add a word, keeping every word already there. Read, modify, write — never a bare `setAttribute` of the whole value. Adding a word the element already carries changes nothing. */
export function addWord(el: Bearer, word: string) {
  const text = el.getAttribute(ATTRIBUTE);
  if (!text) {
    el.setAttribute(ATTRIBUTE, word); // the common writer: an element with nothing to say yet
    return;
  }
  if (!hasWord(el, word)) el.setAttribute(ATTRIBUTE, `${split(text).join(' ')} ${word}`);
}

/** Remove a word, keeping the rest; the attribute goes when the last word does. */
export function removeWord(el: Bearer, word: string) {
  const now = split(el.getAttribute(ATTRIBUTE));
  if (!now.includes(word)) return;
  const rest = now.filter((w) => w !== word);
  if (rest.length) el.setAttribute(ATTRIBUTE, rest.join(' '));
  else el.removeAttribute(ATTRIBUTE);
}

/** The selector that picks a word out of the list: `[data-beltype~="word"]`. The hot paths ask the browser (`matches`, `closest`, `querySelector`) with this and never split the attribute themselves. */
export const selectorOf = (word: string): string => `[${ATTRIBUTE}~="${word}"]`;

/** Does the element carry any word of the set? One split of the attribute, whatever the set's size. */
export function hasAnyWord(el: Pick<Bearer,'getAttribute'>, set: ReadonlySet<string>): boolean {
  for (const word of split(el.getAttribute(ATTRIBUTE))) if (set.has(word)) return true;
  return false;
}

/** Is this one of the engine's own marks — see {@link ENGINE_MARKS}? */
export const isEngineMark = (el: Pick<Bearer,'getAttribute'>) => hasAnyWord(el, ENGINE_MARKS);

/** Give a key its value, keeping every other word: the key's old word, if any, goes and `key:value` takes its place. Read, modify, write, as {@link addWord} is. */
export function setValue(el: Bearer, key: string, value: string|number) {
  const prefix = `${key}:`;
  const rest = split(el.getAttribute(ATTRIBUTE)).filter((w) => !w.startsWith(prefix));
  el.setAttribute(ATTRIBUTE, [...rest, `${prefix}${value}`].join(' '));
}

/** Remove the key's word, whatever its value, keeping the rest; the attribute goes with the last word. */
export function removeKey(el: Bearer, key: string) {
  const prefix = `${key}:`;
  const now = split(el.getAttribute(ATTRIBUTE));
  const rest = now.filter((w) => !w.startsWith(prefix));
  if (rest.length === now.length) return;
  if (rest.length) el.setAttribute(ATTRIBUTE, rest.join(' '));
  else el.removeAttribute(ATTRIBUTE);
}

/**
 * The line stamp, read, written and stripped (*the piece words*, 2026-10-11). `pos:<line>` is the merged-document start line of a block, written by the belt when a host asks for stamps; the editing tools read it to open a file at a line, Cicero strips it out of the keys it compares, and Caster pairs a copy with its original by it. Every reader goes through here (or through its own twin, pinned equal by `test/data-beltype.test.js`) so that no one compares the whole attribute, which after the fold also carries the engine's words.
 *
 * `[data-beltype*="pos:"]` selects every stamped element; it is safe because no key ends with `pos` ({@link assertNoKeySuffix}).
 */
export const POS_KEY = 'pos';
export const POS_SELECTOR = '[data-beltype*="pos:"]';

/** The stamp an element carries, as a number, or `null`. */
export function posOf(el: Pick<Bearer,'getAttribute'>): number|null {
  const word = wordOf(el, POS_KEY);
  return typeof word === 'number' ? word : null;
}

/** Put a stamp on an element: the word only, every other word kept. */
export function setPos(el: Bearer, line: number|string) {
  setValue(el, POS_KEY, line);
}

/** Take the stamp off an element: the word only. */
export function stripPos(el: Bearer) {
  removeKey(el, POS_KEY);
}

/** An attribute value with the stamp word out and every other word kept — what a key that must not move when only a stamp moved compares (`composition-key.js`, `seam/client.js`). The empty string where nothing is left. */
export const withoutPos = (value: string): string => split(value).filter((w) => !w.startsWith(`${POS_KEY}:`)).join(' ');

/**
 * The `has:` family's spellings — the forms the rewriter writes and the capture reads back (the one place they are spelled, as `gcpm-encoding.js` is for its four).
 *
 * `:has(A)` becomes `:is(:where([data-beltype~="has:H"]):is(*, A′), :where(:not([data-beltype~="fragment"])):has(A))`, where `A′` is `A` without each item's leading combinator. The native arm keeps the author's originals matching, since the engine presents whole boxes as originals and never writes them; the word arm makes a copy match, because a copy can be hollow and a hollow box has nothing for `:has()` to look into; and **the root of a copy answers to its word alone** — the guard `:where(:not([data-beltype~="fragment"]))` takes the native arm away from it, because a copy's siblings are the other copies in `<beltype-root>`, in page order, and a `:has(~ …)` asked of them is asked of the wrong tree (measured on case 101: the first fragment of a section saw its own continuation, which held the paragraph the rule looks for). The guard is spelled with the word `fragment` (*the piece words*, 2026-10-11). The specificity is exactly the native one — `:where()` weighs nothing, `:is(*, A′)` weighs what `A` weighs — which Chromium 153 measured on nine forms against sixty competitors in both source orders with no mismatch. The rewrite keeps every line where the author put it, and each rewritten sheet ends with a registry rule that matches nothing (`:not(*)`) and carries each argument as a custom property, so the capture reads arguments from the CSSOM without parsing a selector back.
 */

/** The custom property that carries argument `H` on the registry rule. A colon cannot stand in a custom property's name, so the word's `has:H` is `--beltype-has-H` here. */
export const HAS_PROPERTY_PREFIX = '--beltype-has-';

/** The registry rule's selector: it matches no element, ever. */
export const HAS_REGISTRY_SELECTOR = ':not(*)';

/** How every rewritten `:has()` begins. The outer `:is(` opens at index 3. */
const UNION_HEAD = ':is(:where([data-beltype~="has:';

/** The guard, and it weighs nothing: `:where(:not([data-beltype~="fragment"]))` matches an element that is not the root of a copy. It stands twice in a union. Before the native `:has(`, it takes the native arm away from the root of a copy (a copy answers to its word alone). Inside the native argument, after each compound that a leading `+` or `~` reaches, it takes the copies out of the siblings the argument looks at: `<beltype-root>` holds every original in the document's order and then every copy the pages made, so an original shown whole that asks `:has(~ section p.warn)` natively would otherwise find the copies of an earlier section among its later siblings (case 102). */
export const FRAGMENT_GUARD = ':where(:not([data-beltype~="fragment"]))';

/** What stands between the word arm and the native `:has(`. */
const NATIVE_ARM = `, ${FRAGMENT_GUARD}:has(`;

/** The word an element carries when its original satisfies the argument whose hash is `hash`. */
export const hasWordFor = (hash: string) => `has:${hash}`;

/**
 * `:has(A)` as the engine writes it, for argument `A` already canonical.
 *
 * @param argument - `A`, as the author wrote it between the parentheses.
 * @param bare - `A′`: `A` without each item's leading combinator.
 */
export const encodeHasUnion = (hash: string, argument: string, bare: string): string => `${UNION_HEAD}${hash}"]):is(*, ${bare})${NATIVE_ARM}${argument}))`;

/** The index of the parenthesis that closes the one opened at `open`, counting depth and stepping over quoted strings; `-1` where it does not close. */
function closeOf(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '\\') i++;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return -1;
}

/**
 * The union at `at` in `text`, read back: where it ends and the author's `:has(A)`, or `null` where the text after the head is not the shape {@link encodeHasUnion} writes.
 *
 * @param at - the index of `UNION_HEAD` in `text`.
 */
function unionAt(text: string, at: number): { end: number; argument: string; }|null {
  const outerClose = closeOf(text, at + 3);
  if (outerClose < 0) return null;
  const inner = text.slice(at + 4, outerClose);
  const whereClose = closeOf(inner, 6); // ':where(' — the parenthesis is the seventh character
  if (whereClose < 0 || !inner.startsWith(':is(', whereClose + 1)) return null;
  const isClose = closeOf(inner, whereClose + 4);
  if (isClose < 0 || !inner.startsWith(NATIVE_ARM, isClose + 1)) return null;
  const hasOpen = isClose + NATIVE_ARM.length;
  if (closeOf(inner, hasOpen) !== inner.length - 1) return null;
  return { end: outerClose + 1, argument: inner.slice(hasOpen + 1, -1) };
}

/** A selector as the author wrote it: every union {@link encodeHasUnion} wrote turned back into `:has(A)`. What the editing tools' inspector shows, so that a rule the engine rewrote reads as the rule in the author's file. */
export function authorSelectorOf(selector: string): string {
  let out = '';
  let from = 0;
  for (let at = selector.indexOf(UNION_HEAD); at >= 0; at = selector.indexOf(UNION_HEAD, from)) {
    const found = unionAt(selector, at);
    if (!found) {
      out += selector.slice(from, at + UNION_HEAD.length);
      from = at + UNION_HEAD.length;
      continue;
    }
    out += `${selector.slice(from, at)}:has(${found.argument.split(FRAGMENT_GUARD).join('')})`;
    from = found.end;
  }
  return out + selector.slice(from);
}

/** How many `:has(` the text holds that the engine did not rewrite: every `:has(` less the one inside each union. Zero means every `:has()` of the selector is answered by a word. */
export function bareHasCount(selector: string): number {
  const all = selector.split(':has(').length - 1;
  const rewritten = selector.split(UNION_HEAD).length - 1;
  return Math.max(0, all - rewritten);
}

/** Is this the registry rule — the one that matches nothing and carries the arguments? A host that pairs the CSSOM's rules with the author's lines (the editing tools' inspector) has no line to give it. */
export const isHasRegistryRule = (selector: string|null|undefined): boolean => selector === HAS_REGISTRY_SELECTOR;

/** An argument, as the registry rule carries it: a CSS string literal. */
export const encodeHasArgument = (argument: string): string => `"${argument.replace(/[\\"]/g, '\\$&')}"`;

/**
 * An argument read back from the registry rule's custom property: the browser's serialization of the string, unquoted and unescaped.
 *
 * @returns `null` where the value is not a string literal.
 */
export function decodeHasArgument(value: string): string|null {
  const text = value.trim();
  if (text.length < 2 || text[0] !== '"' || text[text.length - 1] !== '"') return null;
  return text.slice(1, -1).replace(/\\(.)/g, '$1');
}

/** THE WORDS SHEET's rules: what the engine does to a copy, as text (*the piece words*, 2026-10-11; `dressing.js` explains where they live and why). Here, beside the words they are keyed on, because the engine's head fragment (`seam/index.js`) carries them and a node-side host must be able to import them without a document. */

/** The cascade layer the engine's trimming and hiding rules live in. */
export const LAYER = '__beltype-dressing';

const w = selectorOf;
/** A piece the opening cut divides: it did not begin the box here (`split` without `start`). The words sheet and the continuation dressing (`dressing.js`) are both keyed on it. */
export const RESUMED = `${w(SPLIT)}:not(${w(START)})`;
/** A piece the closing cut divides: it does not end the box here (`split` without `end`). */
export const CUT_OFF = `${w(SPLIT)}:not(${w(END)})`;
/** A resumed piece the words sheet trims. The painted shell's wrapper is exempt — it is the engine's own element, has no margin, border or padding, and an indent written on it would be inherited by the box it wraps, which the old inline writes never reached. The continuation dressing keys on `RESUMED` itself. */
const RESUMED_BOX = `${RESUMED}:not(${w(SHELL)})`;

/**
 * The rules, as text. Each is a sentence about a word.
 *
 * - `away`: a box put away on this page is not displayed, and it stays an element so every structural selector reads as it does in the source (*every branch gets a place*, 2026-09-21).
 * - A resumed piece gives up the margin that adjoins the break, and the indent (the box is not beginning); and, unless the box wraps each fragment whole (`wrapped`, css-break-3 §5.4's `clone`), its border and padding at that edge.
 * - A resumed piece's counter operations already happened where the box began (`counter-reset`, `counter-increment` and `counter-set` are `none` on it): the page's start delivers the counters as they stood (`chase.js`'s `setCounters`), and a clone that fired them again would count the box twice.
 * - A cut-off piece gives up the margin before the break, and unless `wrapped` its border and padding there.
 * - `adjoin`: the box a bare-path cut resumes at, and the first-child chain through which its margin collapses, give up the margin that adjoins the break (css-break-3 §5.2) and nothing else — they are not divided.
 */
export const WORDS_RULES = `
@layer ${LAYER} {
  ${w(AWAY)} { display: none !important; }
  ${RESUMED_BOX} { margin-top: 0 !important; text-indent: 0 !important; counter-reset: none !important; counter-increment: none !important; counter-set: none !important; }
  ${RESUMED_BOX}:not(${w(WRAPPED)}) { border-top-width: 0 !important; padding-top: 0 !important; }
  ${CUT_OFF} { margin-bottom: 0 !important; }
  ${CUT_OFF}:not(${w(WRAPPED)}) { border-bottom-width: 0 !important; padding-bottom: 0 !important; }
  ${w(ADJOIN)} { margin-top: 0 !important; }
}
`;

