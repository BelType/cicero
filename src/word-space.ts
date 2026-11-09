/**
 * The word space's one rule about element boundaries, and the map that lets a detached clone ask it.
 *
 * A word is a maximal non-whitespace run of a block's joined text — the tokenization `positions.js` counts in, `fragments.js` consumes in, and `gauge.js` orders by, three implementations that must never disagree. Across a text-node or an inline element seam the run continues, because that is what the page shows: `<em>foo</em>bar` is one word wherever you look at it. **Across a non-inline boundary it stops**, because that is also what the page shows ([*a word stops at a block boundary*](../../../.claude/decisions/cicero/a-word-stops-at-a-block-boundary.md), 2026-09-10; `packages/essay/cases/34-the-word-at-the-seam`; see CHANGELOG 2026-09-10).
 *
 * **The predicate reads computed display and nothing else.** A list of block-level tag names would need no styles and would have caught every seam so far found in real belt output; it is also wrong the first time an author writes `li { display: inline }`, and it would be a second answer to a question `gauge.js` already answers by asking the browser. One answer, asked once.
 *
 * **A tie is not a boundary.** JavaScript's `\s` matches U+00A0, which would read the no-break space an author writes to hold two words together as an ordinary word boundary, offer it to the Compositor as a break candidate like any other, and take it. `BREAKING_SPACE` is the one character class every tokenizer here tests instead ([*a tie is not a break*](../../../.claude/decisions/cicero/a-tie-is-not-a-break.md)).
 *
 * **A clone cannot be asked, so it is handed the answer.** A continuation clone is detached when its words are consumed, and `getComputedStyle` on a detached element returns the empty string rather than a display — the same reason `applyCarriedRemainder` reads the source. So a clone's elements are registered against their sources at clone time, in lockstep, before the Compositor's hints are applied and while child indices still correspond. An element with no registration is treated as inline: that is what an unmapped element actually is here (a `<br>` or a filler span the Compositor inserted), and it is what leaves a caller with no map behaving exactly as before.
 *
 * @packageDocumentation
 */

import { addWord, BREAK, hasWord } from './data-beltype.ts';
import { presentation } from './presenters.ts';
import { RUNNING_PROP } from './gcpm-encoding.ts';

/**
 * A whitespace character a word may be divided at — every one JavaScript's `\s` matches except the three that mean the opposite.
 *
 * U+00A0, the no-break space, is TeX's tie `~` written as a character: the same interword space with no break opportunity in it, which is a matter of legality rather than of price — the candidate simply is not there. css-text-4 §6.5 says outright that CSS defines no prioritization of soft wrap opportunities, so an author has no property that means *do not end a line here* and the tie is the whole vocabulary. U+202F, the narrow no-break space, and U+FEFF, the zero width no-break space, carry the same instruction and are matched by `\s` for the same historical reason, so they go with it.
 *
 * The class is tested one character at a time and carries no `g` flag, so it is safe to share; where a tokenizer wants maximal runs instead it calls `wordRuns()`, which mints its own regex because a `g` flag carries `lastIndex` and a shared one would be state travelling between two tokenizers that must not drift.
 */
export const BREAKING_SPACE = /[^\S\u00A0\u202F\uFEFF]/;

/** The same rule as a maximal non-dividable run: what `\S+` used to be, with the three ties kept inside the word. */
export const wordRuns = () => /[\S\u00A0\u202F\uFEFF]+/g;

/** Scripts written without spaces between words — Han, Hiragana, Katakana, Thai, Lao, Khmer, Myanmar. A browser breaks their lines between letters with no hyphen drawn, which is what makes a line boundary inside such a "word" a silent break (*a line inside a word is a break point*, 2026-09-23), and what the Compositor, which breaks only at spaces, hyphenation points and §6.4's emergency break, refuses to set. */
export const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/**
 * Could the browser have drawn a hyphen at a line boundary between these two characters that the source does not carry? The one question that decides whether a line inside a word may be a cut the fragment can write: a silent break needs nothing at the cut, and a break after U+00AD needs the soft hyphen the source holds written as the hyphenation character (`fragments.js`, *the hyphen is written at the cut*). What is left is a hyphen the browser drew between two letters under `hyphens: auto`, where no character of the source says where.
 *
 * **Answered by measurement, read by the source on both sides.** Under `hyphens: auto` the browser may hyphenate between any two letters of a script that hyphenates, and nothing in the DOM says whether it did; the range rects do, an inked rect for the hyphen on the line the break ends. So the Gauge opens a piece at such a break only where it measured that hyphen (`gauge.js`, `drewHyphen`), and refuses one that drew none, where the page ends a line early rather than print a hyphen the browser did not draw; the fragment writer asks this same predicate of the same characters and adds the hyphenation character after the last kept letter (`fragments.js`). The address carries no mark: the measurement decides which breaks are cuts, and the source decides what the cut writes. `hyphens: none` and `manual` draw one only at a soft hyphen.
 *
 * @param before - the character before the break
 * @param after - the character after it
 * @param hyphens - the box's computed `hyphens`
 */
export function mayBeAutoHyphenated(before: string, after: string, hyphens: string) {
  const letter = ( ch: string) => /\p{L}/u.test(ch) && !UNSPACED_SCRIPT.test(ch);
  return hyphens === 'auto' && letter(before) && letter(after);
}

const ENGINE_TEXT = new WeakSet<any>();

/** Register a text node the engine wrote into a clone — the hyphenation character the Compositor materializes at a break of its own (*the hyphen is written at the cut*, 2026-10-06). Nothing in the DOM changes: the registry sits beside `noteSource` and says only that these characters are not the source's. */
export function noteEngineText(node: Text) {
  ENGINE_TEXT.add(node);
}

/** Is this text node the engine's, and not a character of the source? Every character offset into a word counts the source's characters alone, so an address means the same text in a hinted clone and in the source it was copied from. */
export const isEngineText = ( node: Node) => ENGINE_TEXT.has(node);

/**
 * Does this element end a word — a `<br>` the author wrote ([*a line inside a word is a break point*](../../../.claude/decisions/cicero/a-line-inside-a-word-is-a-break-point.md), 2026-09-23)?
 *
 * **A tag test, and deliberately so.** Everything else here reads computed display, and a `<br>` answers `inline` (Chromium 153, measured) — true, and beside the point: what breaks the line is not its display but HTML's rendering of the element as a line feed, which no CSS property states. So `foo<br>bar` was one word to three of the four tokenizations and two to the Compositor's, and a paragraph of lines joined that way had no break point between them (`packages/essay/cases/63-the-line-inside-a-word`).
 *
 * **The engine's own break is exempt.** The Compositor's hints put a `br` carrying the word `break` (`data-beltype="break"`) into a feed clone, inside a word at a hyphenated break (`exam‐<br>ple`), and the source that clone was copied from carries none — so counting it would make a clone and its source disagree about how many words a leaf holds, which is the identity every address stands on. A plain object tree (the DOM-free suites) answers by its `tagName` and the three attribute verbs. The tag is tested first, so the word is read only of a `<br>`, which is rare in a word walk.
 */
export function isLineBreak(el: Element) {
  if (el?.tagName !== 'BR') return false;
  return !hasWord(el, BREAK);
}

const SOURCE_OF = new WeakMap<any, any>();

/** The `data-beltype` words a run gave the sources, by source element (*one attribute has words*, 2026-10-10): `has:<h>` for each `:has()` argument the element's original satisfies, computed once per run from the originals (`has-words.js`). The source is never written (*the source document is never written*, C5); the words are written onto its copies, as each copy is registered against the source it was made from, and that registration is the one place a copy learns what its original is. Replaced whole by each run, so a word an edit removed is not remembered. */
let WORDS_OF: WeakMap<Element,string[]> = new WeakMap<any, any>();

/**
 * @param map - the run's words, by source element.
 */
export function setSourceWords(map: WeakMap<Element,string[]>) {
  WORDS_OF = map;
}

/** Give a source a word for the copies this run makes from now on; the source itself is not written (C5). */
export function addSourceWord(source: Element, word: string) {
  const list = WORDS_OF.get(source);
  if (!list) WORDS_OF.set(source, [word]);
  else if (!list.includes(word)) list.push(word);
}

/** Does the run's record give this source the word? */
export const sourceHasWord = (source: Element, word: string) => !!WORDS_OF.get(source)?.includes(word);

/** Write the words a source carries onto a copy of it — added to whatever the copy inherited from the source's own attribute, never replacing it. */
function dressCopy(clone: Element, source: Element) {
  const words = WORDS_OF.get(source);
  if (words) for (const word of words) addWord(clone, word);
}

/**
 * Write the words onto a copy and every element under it, in lockstep with the source tree, without registering the copy against its source — for a measuring clone that is read and thrown away (the Compositor's), where registering would change what an unmapped element is treated as.
 *
 * **A presented element under it replaces the copy of its source** (*a copy may be presented*) and is registered, the one registration a measuring copy makes: the element is not a copy of anything, so there is no unmapped reading of it to preserve, and its source is what lets {@link isAtom} answer for it. The walk does not descend into it. The ROOT is the caller's: see {@link measuringCopyOf}.
 */
export function dressWords(clone: Element, source: Element) {
  dressCopy(clone, source);
  for (let i = 0; i < clone.children.length; i++) {
    const child = source.children[i];
    const made = presentation(child);
    if (made) {
      clone.children[i].replaceWith(made);
      noteSource(made, child);
    } else dressWords(clone.children[i], child);
  }
}

/** A MEASURING COPY of a source — deep, dressed, not registered (the Compositor's passes 1 and 2) — or, when the source is itself presented, the presenter's element. The one way a root measuring copy is made, so that a root which is the claimed element is swapped as a descendant is. */
export function measuringCopyOf(source: Element): Element {
  const made = presentation(source);
  if (made) {
    noteSource(made, source);
    return made;
  }
  const clone = (source.cloneNode(true) as Element);
  dressWords(clone, source);
  return clone;
}

const RANGE_OF = new WeakMap<any, any>();

/**
 * The document's one `Range` — every ruler in `src/` reads through it (*the page asks the index*, 2026-09-25).
 *
 * A Range is not free after its last use. Chromium keeps every live Range in a per-document set and updates all of them on every write to a text node, until a garbage collection releases the ones nobody holds: blanking the text of a whole-manual clone costs 1.3 ms with none held and 5.5 s with 200 000 (`packages/essay/RESULTS.md`). The Gauge used to mint one per measured box per page, so the fragment writer's text writes cost whatever the collector had not yet got round to.
 *
 * Sharing is safe because every caller sets both ends and reads before anything else can touch the range; none keeps it across a call into another reader.
 */
export function rangeOf(doc: Document): Range {
  let range = RANGE_OF.get(doc);
  if (!range) RANGE_OF.set(doc, (range = doc.createRange()));
  return range;
}

/** Register one clone element against the source element it was copied from. */
export function noteSource(clone: Element, source: Element) {
  SOURCE_OF.set(clone, source);
  dressCopy(clone, source);
}

/** The source element a clone was copied from, or `null` — the reverse of the map `mapCloneToSource` fills, for a caller that holds a clone and needs the box an author actually declared (the Stonehand reads law from sources; the driver builds addresses from them). */
export const sourceOf = ( clone: Element) => SOURCE_OF.get(clone) ?? null;

/**
 * Register a whole cloned subtree in lockstep, and fill the forward map beside the reverse one ([*the cut is a place in the tree*](../../../.claude/decisions/cicero/the-cut-is-a-place-in-the-tree.md), 2026-09-18).
 *
 * Both directions are needed and neither is derivable from the other cheaply: a clone answers *what did the author declare here* through `SOURCE_OF`, and an address answers *which clone is this box* through `into`. **Must run before anything inserts or removes elements on either side** — before `stripFixedBoxes` and before the Compositor's hints — which is exactly what lets a path be resolved on the source and the clone reached by identity, with no index ever followed on a clone.
 *
 * @param into - the source → clone map to fill; one map per feed is enough, since the blocks a feed carries are disjoint.
 */
export function mapCloneToSource(clone: Element, source: Element, into: Map<Element,Element> = new Map<any, any>()) {
  SOURCE_OF.set(clone, source);
  dressCopy(clone, source);
  into.set(source, clone);
  for (let i = 0; i < clone.children.length; i++) {
    const child = source.children[i];
    // A presented element replaces the copy of its source, in the copy's own place, and the walk stops there (*a copy may be presented*): its children are the presenter's, never the source's. The indices stay in lockstep because one element replaces one element.
    const made = presentation(child);
    if (made) {
      clone.children[i].replaceWith(made);
      noteSource(made, child);
      into.set(child, made);
    } else mapCloneToSource(clone.children[i], child, into);
  }
  // The text nodes are registered at the same moment, for the same reason (*the engine names the source point*, 2026-10-13). A plain object tree (the DOM-free suites) has no `childNodes` and no text.
  const kids = clone.childNodes;
  if (kids) for (let i = 0; i < kids.length; i++) if (kids[i].nodeType === 3) noteText((kids[i] as Text), (source.childNodes[i] as Text));
  return into;
}

/**
 * THE ONE POINT A DEEP COPY PASSES THROUGH (*a copy may be presented*): a deep copy of `source`, its elements registered against their sources in `into`, any presented element — the root itself included — standing where its source's copy would. Returns the element to USE.
 *
 * **The root is why this is a function that returns.** Every entry into the registration walk that stood on a copy made by `cloneNode` had a root with no parent whenever the copy was a direct child of what was being built (an atom in a cut block, a top-level block that is itself the claimed element), where `replaceWith` is a silent no-op; the swap is therefore decided BEFORE the clone is made, for the root, and by the walk for everything under it. Every site that copies an element deep calls this and uses what it returns.
 *
 * @param into - the source → copy map to fill.
 */
export function copyOf(source: Element, into: Map<Element,Element> = new Map<any, any>()): Element {
  const made = presentation(source);
  if (made) {
    noteSource(made, source);
    into.set(source, made);
    return made;
  }
  const clone = (source.cloneNode(true) as Element);
  mapCloneToSource(clone, source, into);
  return clone;
}

/** A SHELL of a source — an element with its tag and attributes and no children — registered against it, or the presenter's element when the source is presented (a concealed shell of an `<object>` is then the presenter's element, concealed by the words the caller writes, and never an `<object>` that starts a fetch). The hollow outside an interval and the chain down to a cut are built of these. */
export function shellOf(source: Element): Element {
  const el = presentation(source) ?? (source.cloneNode(false) as Element);
  noteSource(el, source);
  return el;
}

/** A clone's text node against the source text node it was copied from, and which of its characters are which (*the engine names the source point*, 2026-10-13). `runs` are the stretches of the clone's current data that are still the source's characters, in order (a gap between two is text the engine wrote into the node): clone offsets `[at, at + len)` are source offsets `[from, from + len)`. A removal trims or splits runs and a split of the node hands the tail its share, so the record costs what was removed and never the length of the text. `out` marks characters the copy still holds and the interval does not show: consuming a fragment's words blanks the words and leaves the whitespace between them, so a first fragment's data ends in the spaces of every word cut away, and those are the source's characters (`sourcePoint` names them) on no page (`pointOn` does not). `first` is the source offset the node began at when it was registered: 0 for a node that is a whole copy of its source, more for the tail of a split. */
export type TextRun = { at: number, from: number, len: number, out?: boolean };

export type TextRecord = { source: Text, first: number, runs: TextRun[] };

const TEXT_OF: WeakMap<Text,TextRecord> = new WeakMap<any, any>();

/** Register one clone text node against its source, whole. */
export function noteText(clone: Text, source: Text) {
  TEXT_OF.set(clone, { source, first: 0, runs: clone.data.length ? [{ at: 0, from: 0, len: clone.data.length }] : [] });
}

/** The record of a registered clone text node, or `undefined`. */
export const textRecord = ( node: Text) => TEXT_OF.get(node);

/** Remove ranges of a node's data and record that they went — the one door every removal from a clone's text goes through, so no site can forget. The ranges are in the node's current offsets, may come in any order, and are cut in one pass (a paragraph consumed word by word is one call, not a pass per word). A replacement of the same length, the soft hyphen written as the hyphenation character at a cut in `fragments.js`, is not a removal: it maps one character to one and needs no record. An unregistered node (text the engine wrote) is simply cut. */
export function cutRanges(node: Text, ranges: { start: number; end: number; }[]) {
  const total = node.data.length;
  const cuts = [...ranges].sort((x, y) => x.start - y.start);
  /**
   * @type The stretches that stay.
   */
  const kept: [number,number][] = [];
  let p = 0;
  for (const c of cuts) {
    if (c.start > p) kept.push([p, c.start]);
    p = Math.max(p, c.end);
  }
  if (p < total) kept.push([p, total]);
  const data = node.data;
  node.data = kept.map(([k0, k1]) => data.slice(k0, k1)).join('');
  const rec = TEXT_OF.get(node);
  if (!rec) return;
  const runs: TextRun[] = [];
  let ri = 0;
  let newAt = 0;
  for (const [k0, k1] of kept) {
    while (ri < rec.runs.length && rec.runs[ri].at + rec.runs[ri].len <= k0) ri++;
    for (let rj = ri; rj < rec.runs.length && rec.runs[rj].at < k1; rj++) {
      const r = rec.runs[rj]; // a gap between runs is text the engine wrote (`replaceChars`) and has no source
      const lo = Math.max(k0, r.at);
      const hi = Math.min(k1, r.at + r.len);
      if (hi > lo) runs.push({ at: newAt + lo - k0, from: r.from + lo - r.at, len: hi - lo, ...(r.out && { out: true }) });
    }
    newAt += k1 - k0;
  }
  rec.runs = runs;
}

/** Replace the characters `[start, end)` of a node with `text`. One character for one character maps one to one and records nothing — the soft hyphen written as the hyphenation character at a cut; any other length is a removal and an insertion of the engine's own characters, which have no source (`fragments.js`, *the hyphen is written at the cut*, where the character may be several or none). */
export function replaceChars(node: Text, start: number, end: number, text: string) {
  if (text.length === end - start) {
    node.data = node.data.slice(0, start) + text + node.data.slice(end);
    return;
  }
  cutRanges(node, [{ start, end }]);
  if (!text) return;
  node.data = node.data.slice(0, start) + text + node.data.slice(start);
  const rec = TEXT_OF.get(node);
  if (rec) rec.runs = rec.runs.map((r) => (r.at >= start ? { ...r, at: r.at + text.length } : r));
}

/** Every character of a node's data removed, recorded. */
export const emptyText = (node: Text) => cutRanges(node, [{ start: 0, end: node.data.length }]);

/** Say that the characters `[from, to)` of a node are held by the copy and shown by no page — the whitespace a consumed word leaves behind, on the far side of the cut (*the engine names the source point*). The data is untouched: layout reads it, and collapses it. */
export function leaveOut(node: Text, from: number, to: number) {
  const rec = TEXT_OF.get(node);
  if (!rec || to <= from) return;
  const runs: TextRun[] = [];
  for (const r of rec.runs) {
    const end = r.at + r.len;
    const lo = Math.max(from, r.at);
    const hi = Math.min(to, end);
    if (hi <= lo || r.out) {
      runs.push(r);
      continue;
    }
    if (lo > r.at) runs.push({ at: r.at, from: r.from, len: lo - r.at });
    runs.push({ at: lo, from: r.from + lo - r.at, len: hi - lo, out: true });
    if (hi < end) runs.push({ at: hi, from: r.from + hi - r.at, len: end - hi });
  }
  rec.runs = runs;
}

/**
 * `Text.splitText`, with the tail registered against the same source text — the Compositor splits a clone's text to put a break or a filler inside it, after the clone was registered whole.
 *
 * @returns the tail
 */
export function splitTextAt(node: Text, off: number): Text {
  const tail = node.splitText(off);
  const rec = TEXT_OF.get(node);
  if (!rec) return tail;
  const keep: TextRun[] = [];
  const rest: TextRun[] = [];
  for (const r of rec.runs) {
    const end = r.at + r.len;
    const out = r.out ? { out: true } : {};
    if (end <= off) keep.push(r);
    else if (r.at >= off) rest.push({ ...r, at: r.at - off });
    else {
      keep.push({ at: r.at, from: r.from, len: off - r.at, ...out });
      rest.push({ at: 0, from: r.from + (off - r.at), len: end - off, ...out });
    }
  }
  rec.runs = keep;
  const last = keep.at(-1);
  TEXT_OF.set(tail, { source: rec.source, first: rest[0]?.from ?? (last ? last.from + last.len : rec.first), runs: rest });
  return tail;
}

/** The source point of a point in a registered clone text node, or `null` where the node holds none of the source's characters. A point between two characters names the character after it, and a point at the end the end of the last one — so the first kept character of a continuation is where its offset 0 points, and the end of a first fragment is where its last offset does. */
export function sourceTextPoint(node: Text, offset: number): { node: Text; offset: number; }|null {
  const rec = TEXT_OF.get(node);
  if (!rec || !rec.runs.length || offset < 0 || offset > node.data.length) return null;
  for (const r of rec.runs) if (offset < r.at + r.len) return { node: rec.source, offset: r.from + Math.max(0, offset - r.at) };
  const last = (rec.runs.at(-1) as { from: number, len: number });
  return { node: rec.source, offset: last.from + last.len };
}

/** Where a registered clone text node shows source offset `o`, the characters the interval leaves out not counted: `{ offset, strict }`, or `null` where it does not. `strict` is false for a point that is only the end of the characters shown — a break between two pages, or two pieces of a split, is the end of one and the start of the next, and a strict answer outranks the other. */
export function textPointShowing(node: Text, o: number): { offset: number; strict: boolean; }|null {
  const rec = TEXT_OF.get(node);
  let edge: { offset: number; strict: boolean; }|null = null;
  for (const r of rec?.runs ?? []) {
    if (r.out) continue;
    if (o >= r.from && o < r.from + r.len) return { offset: r.at + o - r.from, strict: true };
    if (o === r.from + r.len) edge = { offset: r.at + r.len, strict: false };
  }
  return edge;
}

/**
 * Does this element's box continue a word across its boundary?
 *
 * True — the run stands — for an inline-level box ({@link isInlineLevel}), and for anything that cannot be asked: a plain object tree (the DOM-free suites feed them), or a detached element with no registered source. False for every box the browser lays out as a block. A `<br>` is an inline box that ends a word anyway, and the tokenizations ask {@link isLineBreak} beside this.
 */
export function isInlineBox(el: Element) {
  const live = SOURCE_OF.get(el) ?? el;
  const win = live.ownerDocument?.defaultView;
  if (!win || live.isConnected !== true) return true;
  return isInlineLevel(win.getComputedStyle(live).display);
}

/** The one-keyword computed displays whose outer display type is `inline`: every `inline-*`, the legacy `-webkit-inline-box`, and the two inner types CSS gives an inline outer default, `ruby` (with its internal boxes) and `math`. */
const INLINE_ALONE = /^(?:inline(?:-\S+)?|-webkit-inline-box|ruby(?:-\S+)?|math)$/;

/**
 * The outer display decides: is a computed `display` inline-level (*the outer display decides*, 2026-09-29)?
 *
 * @remarks
 * CSS Display §2.1 writes `display` as an outer and an inner type, and a computed value serializes in its shortest form: Chromium 153 computes an inline `<math>` as `math` and `<math display="block">` as `block math`, `<ruby>` as `ruby`, `display: inline flow-root` as `inline-block` and `display: flow-root list-item` as itself (measured). So *begins with `inline`* misfiled every inline-level value not spelled that way, and an inline formula was a block child of its paragraph, which lost its line stack and five words at a page foot (`packages/essay/cases/72-the-formula-in-the-divided-paragraph`). The rule is §2.1's own: a value naming two or more keywords is inline-level exactly when one of them is `inline`; a value of one keyword names its inner type alone, and §2.1 defaults the outer type to `block` *"except for ruby, which defaults to inline"* — and MathML Core's `math`, which defaults to inline the same way. Block-level is therefore the default, which is also what keeps a vendor value (`-webkit-box`) and any inner type Chromium ships later on the block side, where a list of block values would misread them. `none` and `contents` answer false, as they always have: `blockChildrenOf` skips both before it asks.
 *
 * @param display - a computed value, as `getComputedStyle` serializes it
 */
export function isInlineLevel(display: string) {
  const keywords = display.split(' ');
  return keywords.length > 1 ? keywords.includes('inline') : INLINE_ALONE.test(display);
}

export const HTML_NS = 'http://www.w3.org/1999/xhtml';
/** Replaced elements, by local name — an HTML element whose content is outside CSS's formatting model. Never by `tagName`: HTML upper-cases a tag name only in its own namespace, so an inline `<svg>` reports `svg`, and a list spelled `'SVG'` matched no drawing the parser ever made (`packages/essay/cases/70-the-drawing-in-the-divided-paragraph`, measured in Chromium 153). SVG and MathML need no entry: the namespace answers for them. */
const REPLACED = new Set(['img', 'video', 'canvas', 'iframe', 'embed', 'object', 'audio', 'input', 'textarea', 'select', 'meter', 'progress']);
/** The inline-level displays whose content is laid out on the holder's lines — an inline box of flow content (`inline`, `inline list-item`) and ruby's. Every other inline-level display is atomic: its inside is a formatting context of its own (`inline-block`, `inline-table`, `inline-flex`, `inline-grid`, `-webkit-inline-box`, `inline flow-root list-item`, `math`). */
const FLOWS_ON_THE_LINE = /^(?:inline|inline list-item|ruby(?:-\S+)?)$/;
const isAtomicInline = (display: string) => isInlineLevel(display) && !FLOWS_ON_THE_LINE.test(display);

/** Each source element's answer to {@link isAtom}, read once and kept. */
const ATOM_OF = new WeakMap<any, any>();

/**
 * An atom — one unit to every walk the engine makes, never entered (*the paragraph is what the browser breaks*, 2026-09-27, clause three; *the procession stops at an atom*, 2026-09-27).
 *
 * A foreign-namespace element (SVG, MathML), a replaced element, or an atomic inline-level box. css-text-4 §6.5: *"For Web-compatibility there is a soft wrap opportunity before and after each replaced element or other atomic inline"*, and there is none inside one — an SVG's text is positioned by SVG at the coordinates its author gave, not set on the paragraph's lines, which is what `packages/essay/cases/68-the-atom-in-the-line` drew when the Compositor walked into a drawing and wrote a break inside its `<text>`. **One predicate, two faces**: an atom whose own box is inline-level is part of its paragraph's line stack and contributes no block child ({@link blockChildrenOf}); one whose own box is block-level is one box of the procession and a monolith (`stonehand.js`' `isMonolith`), css-break-3 §4.1's monolithic replaced element. It lived in `compose-dom.js` until case 70 found the procession walking through the drawing the Compositor had stopped at; it lives here, beside the other predicates over computed display, so the two walks ask one question.
 *
 * The display is read through `sourceStyle`, because the callers hold clones: a feed or presentation clone answers through its registered source, a nowrap clone in the measure container answers for itself. A clone that is neither cannot say whether it is an `inline-block`, and reads as not an atom — the namespace and the tag still answer. An element with no namespace at all is a plain object tree from the DOM-free suites, and reads as HTML.
 *
 * **Read once per source and kept**, as {@link isFixedBox} is and for its reason: `applyHints` asks it of every element of every hinted paragraph on every pour, and the source is never written (*the source document is never written*, C5), so the answer cannot change within a run. Measured 2026-09-27 before the cache: 77 664 style reads in the BGD manual's composed feed where there had been 3 906.
 */
export function isAtom(el: Element): boolean {
  // A presented element answers as the source it stands for (*a copy may be presented*): its own tag is the presenter's, the box is the author's. For any other copy the source has its tag and namespace, so nothing moves.
  const live = SOURCE_OF.get(el) ?? el;
  if (live.namespaceURI != null && live.namespaceURI !== HTML_NS) return true;
  if (REPLACED.has(live.localName)) return true;
  let atom = ATOM_OF.get(live);
  if (atom === undefined) {
    const style = sourceStyle(el);
    atom = !!style && isAtomicInline(style.display);
    if (style) ATOM_OF.set(live, atom);
  }
  return atom;
}

/**
 * The rows among sibling boxes — which of a box's children stand side by side (*every branch gets a place*, 2026-09-21; css-break-3 §2.1, whose list of what fragments independently names the cells of a row, grid items and flex items beside floats).
 *
 * Two tests, and neither alone. The parent must lay its children out side by side — `SIDE_BY_SIDE` below, asked by the caller, which holds the computed style — and that only permits the question: a flex column is a sequence, and a wrapped flex container holds two rows. What answers it is geometry: siblings whose extents overlap on the block axis. Geometry alone is refused for the mirror reason — a negative margin overlaps two ordinary blocks, which are still a sequence.
 *
 * So a row is a group of sibling boxes, never an element. Pure arithmetic over `{ rect: { top, bottom } }`, document order in and out, so the DOM-free suites can feed it object trees. A box of zero extent — an item with nothing left, kept as an empty box on a continuation — joins the row whose extent holds its top, since it is still a column of that row. A group of one is not a row and is not returned.
 */
export function rowsAmong<B extends { rect: { top: number, bottom: number } }>(boxes: Iterable<B>, eps: number = 0.25): B[][] {
  const groups: { boxes: B[]; top: number; bottom: number; }[] = [];
  let current: { boxes: B[]; top: number; bottom: number; }|null = null;
  for (const box of boxes) {
    const { top, bottom } = box.rect;
    // Two boxes of real extent overlap strictly; where either has none, it joins the extent that holds its top — whichever of the two came first.
    const within: (y: number,lo: number,hi: number) => boolean = (y, lo, hi): boolean => y >= lo - eps && y <= hi + eps;
    const joins = current && (bottom - top > eps && current.bottom - current.top > eps ? top < current.bottom - eps && bottom > current.top + eps : bottom - top > eps ? within(current.top, top, bottom) : within(top, current.top, current.bottom));
    if (joins) {
      (current as NonNullable<typeof current>).boxes.push(box);
      (current as NonNullable<typeof current>).bottom = Math.max((current as NonNullable<typeof current>).bottom, bottom);
    } else {
      current = { boxes: [box], top, bottom };
      groups.push(current);
    }
  }
  return groups.filter((g) => g.boxes.length > 1).map((g) => g.boxes);
}

/**
 * The `display` values whose layout sizes a box's children against each other: a table's automatic layout reads every row for its column widths, and a flex or grid container sizes its items together (*the fragment lays out under the feed's conditions*, 2026-10-08).
 *
 * One predicate for the three readers that ask it: the Stonehand's `neverCutInside`, the Gauge's `tracksOf` and the fragment writer's tracks.
 */
export const READS_ITS_CHILDREN = /^(inline-)?(table|flex|grid)$|^table-/;

/** The `display` values whose children may stand side by side — what permits `rowsAmong`'s question. A closed list on purpose: multicol, a line of inline-blocks and an absolutely positioned box are not rows of sibling boxes, and fall to the monolith rule until each has a design of its own. */
export const SIDE_BY_SIDE = new Set(['flex', 'inline-flex', 'grid', 'inline-grid', 'table-row']);

const FIXED = new WeakMap<any, any>();

/**
 * Is this box `position: fixed` — the one kind of authored content with zero footprint wherever it sits (CSS 2.1 §9.6.1; *a fixed box at any depth*, 2026-09-15)? **Or a running element**, since 2026-10-21 (*a running element is a named node*, amended): GCPM §1.2.1's `running()` removes the element from the flow wherever it was declared, so it takes the fixed box's one mechanism, out of the word space, the feed and the presentation at any depth, and never a second. `driver.js`' `fixedBoxes` and `runningBoxes` tell the two apart, because they are delivered differently.
 *
 * Asked through the same map and for the same reason the two predicates around it are: the callers hold clones, and a clone detached from the document has no computed style. A registered source answers; an unregistered element is not a box an author declared and answers false.
 *
 * @remarks
 * **The answer is read once per source element and kept** (*the page asks the index*, 2026-09-25). `stripFixedBoxes` asks it of every element of every feed clone and every presentation clone, about 300 000 style reads a run on the BGD manual for an answer that cannot change: the source is never written (*the source document is never written*, C5), and a host calls `run()` once per frame, so nothing moves a `position` within a run — the essay's client runs its judge and its view over one document whose values do not change between them. Only this predicate is kept: `isInlineBox` and `sourceStyle` are read far less often per clone, and a wider cache would be a wider claim.
 */
export function isFixedBox(el: Element): boolean {
  const live = SOURCE_OF.get(el) ?? el;
  const win = live.ownerDocument?.defaultView;
  if (!win || live.isConnected !== true) return false;
  let fixed = FIXED.get(live);
  if (fixed === undefined) {
    const style = win.getComputedStyle(live);
    FIXED.set(live, (fixed = style.position === 'fixed' || style.getPropertyValue(RUNNING_PROP).trim() !== ''));
  }
  return fixed;
}

const OUTSIDE = new WeakMap<any, boolean>();

/**
 * Is this child a float standing wholly in its parent's padding or border, a hanging number (Codeberg issue 7)? Such a float shortens none of the parent's line boxes, so it is no part of the text being set: the composed mode skips it, in the child check and in the word walk, and leaves it where the browser put it. Any other float still makes the parent a block of floats and refuses.
 *
 * @remarks
 * Asked through the registered source and kept per source, as {@link isFixedBox} is, for the same reasons: a clone detached from the document has no rect, and the source's layout does not move within a run. An unregistered, disconnected element answers false.
 */
export function isOutsideMarker(el: Element): boolean {
  const live = SOURCE_OF.get(el) ?? el;
  const win = live.ownerDocument?.defaultView;
  const parent = live.parentElement;
  if (!win || !parent || live.isConnected !== true) return false;
  let outside = OUTSIDE.get(live);
  if (outside === undefined) {
    outside = false;
    if (win.getComputedStyle(live).float !== 'none') {
      const ps = win.getComputedStyle(parent);
      const p = parent.getBoundingClientRect();
      const f = live.getBoundingClientRect();
      const left = p.left + parseFloat(ps.borderLeftWidth) + parseFloat(ps.paddingLeft);
      const right = p.right - parseFloat(ps.borderRightWidth) - parseFloat(ps.paddingRight);
      const top = p.top + parseFloat(ps.borderTopWidth) + parseFloat(ps.paddingTop);
      const bottom = p.bottom - parseFloat(ps.borderBottomWidth) - parseFloat(ps.paddingBottom);
      outside = !(f.left < right && f.right > left && f.top < bottom && f.bottom > top);
    }
    OUTSIDE.set(live, outside);
  }
  return outside;
}

/** Does this box hold a `position: fixed` box anywhere inside it? The question `root.js` asks to know whether a block may be presented as its original or must be presented as a stripped clone — asked through `isFixedBox`, so the two can never disagree about which boxes count. */
export function holdsFixedBox(el: Element): boolean {
  for (const child of el.children) {
    if (isFixedBox(child) || holdsFixedBox(child)) return true;
  }
  return false;
}

/**
 * Does this box wrap each of its fragments whole — css-break-3 §5.4's `clone` (*the fragment that wraps itself*, 2026-09-15)?
 *
 * Asked through the same map and for the same reason `isInlineBox` is: the caller is `fragments.js`, holding a clone that is detached by the time its decoration is decided, and a detached element has no computed style to ask. An element with no registration reads as `slice`, which is both the property's initial value and what an unmapped element actually wants — a `<br>` or the Compositor's filler span is not a box an author dressed.
 *
 * The prefixed property rides beside the unprefixed one because Safari ships only the prefixed form for inline boxes; reading both costs one `||` and keeps this the one place that knows.
 */
export function clonesDecoration(el: Element) {
  const st = sourceStyle(el);
  return !!st && (st.boxDecorationBreak || (st as CSSStyleDeclaration & { webkitBoxDecorationBreak?: string }).webkitBoxDecorationBreak) === 'clone';
}

/**
 * The block children of a box — one walker, where four places used to answer the question for themselves ([*the cut is a place in the tree*](../../../.claude/decisions/cicero/the-cut-is-a-place-in-the-tree.md), 2026-09-18).
 *
 * CSS 2.1 §9.2.1.1 breaks an inline box around its block-level children into anonymous block boxes, and css-break-3 §2 names the result in passing as a way a box comes to be in fragments — *"block-in-inline splitting (see CSS2§9.2)"*. So a block item inside an inline container is **not** the container's child in the procession the cuts divide; it belongs to the nearest non-inline ancestor's, and an inline box establishes no procession of its own. The Gauge used to give a box an `inline` flag and a list of direct block children, so five list items inside a `display: inline` list were nobody's block children and the procession stepped over them: a page filling exactly at a paragraph's bottom edge resumed past the list, and every item between the two pages was on no page at all (`packages/essay/cases/54-the-list-at-the-seam`).
 *
 * **Read by computed display and nothing else**, the same predicate `isInlineBox` is and for the same reason: a list of block-level tag names is wrong the first time an author writes `li { display: inline }`, and it would be a second answer to a question the browser already answers. A box the author took out of the rendering — `display: none` — is no box at all and contributes nothing. `display: contents` generates no box either and is skipped rather than descended into, which is exactly where the driver's own forcing descent has always left it; neither value appears in this venue's corpus, so the treatment of both is **stated rather than measured**, and a document that draws one is what would settle it.
 *
 * **The walk stops at an atom** ([*the procession stops at an atom*](../../../.claude/decisions/cicero/the-procession-stops-at-an-atom.md), 2026-09-27). css-break-3 §4.1 divides a paragraph *"between line boxes"*, and *"line boxes contain no possible break points"*: an inline atom is part of one of those lines, whatever it holds, and contributes no block child; a block-level atom is one block child and is never entered. SVG's `<text>` computes `display: block` (Chromium 153, measured), so this walk used to go through an inline `<svg>` and seat its `<text>` elements as the paragraph's block children, and the paragraph lost its line stack: a page foot cut it in its end gap and every word after the drawing was on no page (`packages/essay/cases/70-the-drawing-in-the-divided-paragraph`).
 *
 * An element that cannot be asked — a plain object tree in the DOM-free suites, a detached clone with no registered source — reads as inline through `isInlineBox`, so this walk descends into it and finds nothing, which is what leaves a caller with no map behaving exactly as before.
 */
export function blockChildrenOf(el: Element, isInline: (el: Element) => boolean = isInlineBox): Element[] {
  const out: Element[] = [];
  for (const child of el.children ?? []) {
    const display = sourceStyle(child)?.display;
    if (display === 'none' || display === 'contents') continue;
    if (isFixedBox(child)) continue; // zero footprint at any depth, a fixed box or a running element (*a running element is a named node*, amended 2026-10-21): not a block child of anything the flow divides
    if (isAtom(child)) {
      if (!isInline(child)) out.push(child);
      continue;
    }
    if (isInline(child)) out.push(...blockChildrenOf(child, isInline));
    else out.push(child);
  }
  return out;
}

/**
 * A table's children in CSS 2.1 §17.2's display order: its header group before every other row and row group, its footer group after them, and everything else as written. Any other element's children are returned as they are, the same array.
 *
 * @remarks THE WORD SPACE follows this order inside a table (*the-word-space-follows-the-table-display-order*, 2026-11-07), and so does every reader of it: the position index numbers a table's words in it, a path's indices count a table's children in it, the Gauge walks a table's procession in it, and a fragment's two cuts put away the children standing before or after them in it. §17.2 lays a `table-header-group` out *"before all other rows and row groups"* and a `table-footer-group` *"after all other rows and row groups"*, wherever each is written, and Chromium paints them so; numbered in the order written, a header after its rows had its words last and its box first, which lost rows with no message (*thead-after-rows-and-tall-footer-lose-rows*). Only the first group of each kind moves, because §17.2 renders any later one as a row group. A move only ever goes toward the rows, so a table written in HTML's order is returned unchanged. Read by computed display, so a clone answers for its source, and a tree that cannot be asked (the DOM-free suites) keeps the order written.
 *
 * @param parent - the element whose children these are.
 * @param items - its children, or what stands for them (the Gauge's boxes), in the order written.
 * @param elOf - the element an item stands for; `null` for a text node, which stays where it is.
 */
export function inDisplayOrder<T>(parent: Element, items: T[], elOf: (item: T) => Element|null = (item) => item as unknown as Element): T[] {
  if (items.length < 2 || !/^(inline-)?table$/.test(sourceStyle(parent)?.display ?? '')) return items;
  const displays = items.map((item) => {
    const el = elOf(item);
    return el?.nodeType === 1 ? sourceStyle(el)?.display ?? '' : '';
  });
  const h = displays.indexOf('table-header-group');
  const f = displays.indexOf('table-footer-group');
  const body = (i: number) => i !== h && i !== f && /^table-(row|row-group|header-group|footer-group)$/.test(displays[i]);
  let first = -1;
  let last = -1;
  displays.forEach((_, i) => {
    if (!body(i)) return;
    if (first < 0) first = i;
    last = i;
  });
  const early = h >= 0 && first >= 0 && h > first;
  const late = f >= 0 && last >= 0 && f < last;
  if (!early && !late) return items;
  const out: T[] = [];
  items.forEach((item, i) => {
    if (early && i === first) out.push(items[h]);
    if (!((early && i === h) || (late && i === f))) out.push(item);
    if (late && i === last) out.push(items[f]);
  });
  return out;
}

/**
 * Is this a table's footer group written before a row or row group of its table — HTML 4's order, still legal — which CSS 2.1 §17.2 lays out after them all the same?
 *
 * @remarks Asked by the driver alone, for the one shape that stays refused: such a footer taller than the page area (*the footer before the rows*, 2026-10-15). Its words follow the rows in the word space ({@link inDisplayOrder}), so everywhere else it is a footer like any other. Read by computed display, so a clone answers for its source.
 *
 * @param el - a clone or a source element.
 */
export function footerBeforeRows(el: Element) {
  if (sourceStyle(el)?.display !== 'table-footer-group') return false;
  for (let s = el.nextElementSibling; s; s = s.nextElementSibling) if (/^table-row(-group)?$/.test(sourceStyle(s)?.display ?? '')) return true;
  return false;
}

/**
 * The computed style of the box an author declared — the clone's registered source, or the element itself where it is live and connected. `null` for everything else, which is the honest answer rather than a default: a detached clone with no registration is a `<br>` or a filler span the Compositor inserted, and an element nobody declared has no declaration to read.
 *
 * Extracted from `clonesDecoration` when the first fragment came to need two more readings of the same source — its block-end padding, which §5.3's extension is added on top of under `clone`, and its `text-align`, which css-text-3 §7.2 makes the clone's cut line answer to. Three questions, one map, one place that knows a clone cannot be asked about itself.
 */
export function sourceStyle(el: Element): CSSStyleDeclaration|null {
  const live = SOURCE_OF.get(el) ?? el;
  const win = live.ownerDocument?.defaultView;
  if (!win || live.isConnected !== true) return null;
  return win.getComputedStyle(live);
}
