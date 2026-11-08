/**
 * Composition's browser half — the width provider and the feed writer (architecture: The Compositor, "Materialization" and "Measurement"; second-coding-round.md items 3–4). The Compositor itself (compositor.js) is DOM-free; everything DOM lives here:
 *
 *   - the whole-line Range width provider, read on an unbroken nowrap clone in the measure context (the measurement policy — one Range per candidate span, 0.031px against the render where summing words drifts 4× worse);
 *   - hint application into feed clones (*decisions land only as fragment hints or per-page literals*, C5 — decision products only): `white-space: nowrap`, `<br data-beltype="break">` replacing the inter-word space, the hyphenation character before a hyphenated break (css-text-4 §6.3.2's, U+2010 where the author left it to the engine, and nothing at all at §6.4's emergency breaks), `text-align-last: justify` + the `fill` inline-block filler for justified text;
 *   - the document compose pass and its cache — per paragraph (its path, its markup, the width it is set at and the per-block inputs its lines are a function of: `composition-key.js`); the re-homing that *cut-invariance* (C7) allows is a cache hit, a recompile's new tree is a cache hit, invalidation rides the rim and the run's conditions.
 *
 * An author's own `<br>` partitions a paragraph into independently composed runs and keeps its unmarked self; each justified run gets its own filler, so the line before an author break also reads ragged-natural.
 *
 * @packageDocumentation
 */

import { compose, HYPHENATE_LIMIT_LINES } from './compositor.ts';
import { addWord, AWAY, BREAK, FILL, hasWord } from './data-beltype.ts';
import { createMeasureContext } from './measure.ts';
import { indexBlocks, pageIntervals, presentationWidths } from './positions.ts';
import { hyphenationOffsets, languageFor, resolveLimits } from './hyphenate.ts';
import { BREAKING_SPACE, measuringCopyOf, HTML_NS, isAtom, isFixedBox, isInlineBox, isInlineLevel, noteEngineText, rangeOf, sourceOf, splitTextAt, UNSPACED_SCRIPT } from './word-space.ts';
import { attributesOf, blockKey, CompositionCache, lookup, paragraphKey, remember, shapeOf } from './composition-key.ts';
import type { Hints, Measure, RunPosition } from './compositor.ts';
import type { HyphenateLimits, Language } from './hyphenate.ts';

/** One word of a paragraph, as `collectWords` reads it: the text nodes it spans, or the one atom it is. */
export type TextPart = { node: Text, start: number, end: number };

export type TextWord = { text: string, parts: TextPart[], atom?: undefined };

export type AtomWord = { text: string, parts: [{ atom: Element }], atom: true };

export type Word = TextWord | AtomWord;

/** What `composeDocument` resolves a paragraph to and `applyHints` materializes: the Compositor's hints for each author-break run, with the facts of the block they were composed under. */
export type CompositionRecord = {
  align: 'left' | 'right' | 'center' | 'justify';
  avail: number;
  hyphenChar: string;
  /** each run's hints, `start` its first word's index in the paragraph. */
  runs: Array<Hints & { start: number }>;
  lineCount: number;
};


/** The computed displays of a block container, one of which a paragraph's own box must have (*the paragraph is what the browser breaks*, clause one). */
const PARAGRAPH_DISPLAY = new Set(['block', 'flow-root', 'list-item', 'table-cell', 'table-caption']);
/** The text an atom stands for in a word list — U+FFFC, the object replacement character, which is what it is. One character, so no hyphenation or emergency candidate can fall inside it. */
const ATOM_TEXT = '\uFFFC';

/**
 * A paragraph is what the browser breaks (*the paragraph is what the browser breaks*, 2026-09-27) — the Compositor composes an element only where the browser would otherwise be the one choosing among soft wrap opportunities. Five clauses, each asked of the element's own computed style or its pseudo-elements':
 *
 * 1. an HTML-namespace block container establishing an inline formatting context — `block`, `flow-root`, `list-item`, `table-cell` or `table-caption`, every child inline-level or an author's `<br>` — and standing inside no atom, since an atomic inline's interior is parked with the browser's lines;
 * 2. its own `white-space` is `normal`: css-text-4 §5.1's `nowrap` leaves no soft wrap opportunity to choose among, and §6.5 makes a preserved segment break a forced one, so a `<pre>` keeps its author's lines (`packages/essay/cases/67-the-code-block-set-as-prose`);
 * 3. atoms are units, never entered — `collectWords` below;
 * 4. at least one word outside its atoms;
 * 5. no inline `::before` or `::after` in its lines, its own or an inline's inside it — generated text the Compositor never measures (*the composition refuses generated text*, 2026-10-03; `holdsGeneratedText` below).
 *
 * It used to ask only the children's display, so a `<pre>`, an SVG's `<text>` and an inline `<code>` were paragraphs. The children's display is asked through `word-space.js`' `isInlineBox`, the procession's one predicate (*the outer display decides*, 2026-09-29): it used to be a second copy of the `inline` prefix test, so a paragraph holding an inline formula, whose `<math>` computes `math`, was refused here while the procession, once fixed, divided it. Every refusal here is silent: a refused block keeps the browser's lines, which are the only lines it has.
 */
export function isComposable(el: Element) {
  if (el.namespaceURI !== HTML_NS) return false;
  const win = (el.ownerDocument.defaultView as Window);
  const cs = win.getComputedStyle(el);
  if (!PARAGRAPH_DISPLAY.has(cs.display) || cs.whiteSpace !== 'normal') return false;
  for (const child of el.children) {
    if (child.tagName === 'BR') continue;
    if (!isInlineBox(child)) return false;
  }
  for (let a = el.parentElement; a; a = a.parentElement) if (isAtom(a)) return false;
  if (inColumns(el)) return false;
  if (holdsGeneratedText(el, win)) return false;
  return collectWords(el).words.some((w) => !w.atom);
}

/**
 * A sixth clause: a block in a multi-column container, or itself one, keeps the browser's lines. The Compositor has one measure per block and reads it from the block's own box, not from a column's, so a `columns: 3` box 210px wide was set at the container's measure, the longest line 356px against a column of 70. Refused like a block beside a float, with a console line (`refusedInColumns`); the real fix is a per-column measure and the fragmentation of a multi-column box, which is not this engine's yet.
 */
export function inColumns(el: Element) {
  const win = el.ownerDocument.defaultView as Window;
  for (let a: Element | null = el; a; a = a.parentElement) {
    const cs = win.getComputedStyle(a);
    if (cs.columnCount !== 'auto' || cs.columnWidth !== 'auto') return true;
  }
  return false;
}

/**
 * Does this pseudo-element put a box in its element's lines? Its `content` must generate one — `none` and `normal` do not — and its outer display must be inline: a `display: block` `::after` is a block of its own after the lines, not text in them.
 *
 * @param style - the pseudo-element's computed style.
 */
const inTheLine = (style: CSSStyleDeclaration) => !!style.content && style.content !== 'none' && style.content !== 'normal' && isInlineLevel(style.display);

/**
 * A fifth clause: no generated text in the line ([*the composition refuses generated text*](../../../.claude/decisions/cicero/the-composition-refuses-generated-text.md), 2026-10-03).
 *
 * The Compositor composes a paragraph from its own words (`collectWords` walks text nodes) and pins the chosen lines with an inline `white-space: nowrap`; an inline `::before` or `::after` of the paragraph, or of an inline inside it, is text in the same lines that it never measured and that its `nowrap` then forbids to wrap. Measured on case 82's twin, every entry's number a literal: the default mode and Chromium print eleven pages, the composed mode ten, the two-digit number that wraps in the browser kept on its title's line; and on a paragraph of eleven lines whose `::after` wraps onto a twelfth, one page where the browser prints two. Teaching the Compositor to measure generated text is a round of its own; until then such a paragraph keeps the browser's lines, which are the lines its generated text is measured in.
 */
function holdsGeneratedText(el: Element, win: Window) {
  // ponytail: two pseudo-element style reads per element of every candidate paragraph; a test of the sheets' selectors would be cheaper if it ever shows in a profile.
  for (const e of [el, ...el.querySelectorAll('*')]) {
    if (inTheLine(win.getComputedStyle(e, '::before')) || inTheLine(win.getComputedStyle(e, '::after'))) return true;
  }
  return false;
}

/**
 * Words and author-break runs of an element, with DOM points. A word is a maximal non-whitespace run of text not crossing a <br>; nested inlines merge (parts). Returns { words: [{ text, parts: [{node, start, end}] }], runs: [{ start, end }] } where runs index into words, end exclusive.
 *
 * **An atom is a word of its own and is never entered** (*the paragraph is what the browser breaks*, clause three): `{ text: U+FFFC, parts: [{ atom }], atom: true }`, with a word boundary on both sides, which is §6.5's soft wrap opportunity before and after it. A unit rather than a transparent element, because a transparent one is measured into a line only when a span reaches past it, and a break placed right after it would leave it on that line with its width unread.
 */
export function collectWords(el: Element): { words: Word[]; runs: { start: number; end: number; }[]; } {
  const words: Word[] = [];
  const runStarts = [0];
  let current: TextWord|null = null;
  (function walk( node: Node) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const s = (child as Text).data;
        let i = 0;
        while (i < s.length) {
          if (BREAKING_SPACE.test(s[i])) { current = null; i++; continue; }
          let j = i;
          while (j < s.length && !BREAKING_SPACE.test(s[j])) j++;
          if (current) {
            current.text += s.slice(i, j);
            current.parts.push({ node: (child as Text), start: i, end: j });
          } else {
            current = { text: s.slice(i, j), parts: [{ node: (child as Text), start: i, end: j }] };
            words.push(current);
          }
          i = j;
        }
      } else if (child.nodeType === 1 && (child as Element).tagName === 'BR') {
        current = null;
        if (words.length && runStarts[runStarts.length - 1] !== words.length) runStarts.push(words.length);
      } else if (child.nodeType === 1 && isAtom((child as Element))) {
        words.push({ text: ATOM_TEXT, parts: [{ atom: (child as Element) }], atom: true });
        current = null;
      } else if (child.nodeType === 1) {
        walk(child);
      }
    }
  })(el);
  const runs = runStarts.map((start, i) => ({ start, end: runStarts[i + 1] ?? words.length })).filter((r) => r.end > r.start);
  return { words, runs };
}

/** DOM point (node, offset) for a character offset inside a word. An atom's two points are the boundary before it and the boundary after it, in its parent. */
function pointInWord(word: Word, charOff: number, atEnd: boolean = false): [Node,number] {
  if (word.atom) {
    const el = word.parts[0].atom;
    const at = Array.prototype.indexOf.call((el.parentNode as Node).childNodes, el);
    return [(el.parentNode as Node), charOff > 0 ? at + 1 : at];
  }
  let remaining = charOff;
  for (const part of word.parts) {
    const len = part.end - part.start;
    if (remaining < len || (atEnd && remaining === len)) return [part.node, part.start + remaining];
    remaining -= len;
  }
  const last = word.parts[word.parts.length - 1];
  return [last.node, last.end];
}

/** The node a word begins with — the atom itself, or the text node holding its first character — which is what a break written before the word stands in front of. */
function firstNodeOf(word: Word): Element|Text {
  return word.atom ? word.parts[0].atom : word.parts[0].node;
}

/** The whole-span width provider over an unbroken nowrap clone's word list (positions are run-relative; `base` rebases). `emWidth` is the block's own font size, which the ragged stretch model prices a rag against (*the rag is priced once*). */
function makeProvider(doc: Document, words: Word[], base: number, hyphenWidth: number, spaceWidth: number, emWidth: number): Measure {
  const range = rangeOf(doc);
  return {
    width( a: RunPosition,  b: RunPosition) {
      const first = words[base + a.word];
      const lastWord = b.char > 0 ? words[base + b.word] : words[base + b.word - 1];
      const [sn, so] = a.char > 0 ? pointInWord(first, a.char) : pointInWord(first, 0);
      const [en, eo] = b.char > 0 ? pointInWord(lastWord, b.char, true) : pointInWord(lastWord, lastWord.text.length, true);
      range.setStart(sn, so);
      range.setEnd(en, eo);
      return range.getBoundingClientRect().width;
    },
    hyphenWidth,
    spaceWidth,
    emWidth
  };
}

/**
 * css-text-4 §6.3.2's `hyphenate-character`, read rather than assumed (*the properties the line already had*, 2026-09-07).
 *
 * The engine wrote a literal U+002D HYPHEN-MINUS and measured one, in two places, and the property says otherwise twice over. `auto` means *"the user agent should find an appropriate string based on the content language's typographic conventions"*, and the section names the usual answer in as many words: **U+2010 HYPHEN is most typically used to indicate that a word has been split.** An author may name any string, *"specifying the empty string is valid, and causes the UA to break at hyphenation opportunities without inserting a visible hyphenation character"* — so the empty string is a value and not an absence, and it falls out of this returning `''` and the measurement returning 0.
 *
 * The computed value arrives as a CSS string with its quotes on (`"="`), which is unwrapped here and nowhere else.
 */
export function hyphenCharOf(style: { hyphenateCharacter?: string; }): string {
  const raw = (style.hyphenateCharacter || 'auto').trim();
  if (raw === 'auto' || raw === '') return '‐';
  const q = raw[0];
  if (q !== '"' && q !== "'") return raw;
  return raw.slice(1, -1).replace(/\\(.)/g, '$1');
}

/**
 * css-text-4 §6.3.4's `hyphenate-limit-chars` as three values, `null` for each `auto`.
 *
 * Computed as *"three values, each either the auto keyword or an integer"*, and the section's own defaulting is applied here rather than in the trie: *"if the third value is missing, it is the same as the second. If the second value is missing, then it is auto."*
 */
function limitCharsOf(style: CSSStyleDeclaration): HyphenateLimits {
  const raw = (style.hyphenateLimitChars || 'auto').trim();
  if (raw === 'auto') return {};
  const parts = raw.split(/\s+/).map((v) => (v === 'auto' ? null : parseInt(v, 10)));
  const [total = null, before = null] = parts;
  const after = parts.length >= 3 ? parts[2] : before;
  return { total: Number.isFinite(total) ? total : null, before: Number.isFinite(before) ? before : null, after: Number.isFinite(after) ? after : null };
}

/**
 * The hyphen probe: a span holding the hyphenation character, seated as the last child of a nowrap clone so it is read in the element's own style context. An empty character seats nothing and measures 0, which is exactly what §6.3.2's empty string asks for.
 *
 * **Seated before the layout, never between reads** (*the composition lays out once*, 2026-09-27). Every probe of a region goes in before `ctx.measure` lays the clones out, is read in one pass after it and removed in one pass before any width is read. Written, read and removed one paragraph at a time, each probe laid the whole measure container out again — every clone of the region — which was 63 s of the 84 BelType's own manual spent composing.
 */
function seatHyphenProbe(el: Element, ch: string): HTMLSpanElement|null {
  if (ch === '') return null;
  const probe = el.ownerDocument.createElement('span');
  probe.textContent = ch;
  el.appendChild(probe);
  return probe;
}

/** The probe's advance, read through the document's one Range. */
function probeWidth(probe: HTMLSpanElement|null) {
  if (!probe) return 0;
  const r = rangeOf(probe.ownerDocument);
  r.selectNodeContents(probe);
  return r.getBoundingClientRect().width;
}

/** Inter-word space advance (includes word-spacing): the gap between the first two words, or a quarter em when the run has one word (only badness denominators ever read it then). */
function measureSpaceWidth(doc: Document, words: Word[], el: Element) {
  if (words.length >= 2) {
    const r = rangeOf(doc);
    const [sn, so] = pointInWord(words[0], words[0].text.length, true);
    const [en, eo] = pointInWord(words[1], 0);
    r.setStart(sn, so);
    r.setEnd(en, eo);
    const w = r.getBoundingClientRect().width;
    if (w > 0) return w;
  }
  return parseFloat((el.ownerDocument.defaultView as Window).getComputedStyle(el).fontSize) * 0.25;
}

function alignOf(style: CSSStyleDeclaration): 'left'|'right'|'center'|'justify' {
  const a = style.textAlign;
  if (a === 'justify') return 'justify';
  if (a === 'right' || a === 'end') return 'right';
  if (a === 'center') return 'center';
  return 'left';
}

/**
 * Candidate offsets for one word: the author's soft hyphens always; Liang's patterns when `hyphens: auto` governs and the language is known.
 *
 * §6.3.4's limits bind both, and the reading is stated because it is the section's own and it is unqualified: *"if the word does not meet the required minimum number of characters in the word / before the hyphen / after the hyphen, then the word must not be hyphenated"* — a sentence about the word rather than about where the opportunity came from. A soft hyphen an author wrote inside a word the limits exclude is therefore not taken, which is a real cost and is what the specification says.
 */
function candidatesFor(word: string, hyphensMode: string, lang: Language|null, limits: HyphenateLimits): number[] {
  if (hyphensMode === 'none') return [];
  const bare = word.replace(/­/g, '');
  const { before, after, total } = lang ? resolveLimits(lang, limits) : { before: limits.before ?? 0, after: limits.after ?? 0, total: limits.total ?? 0 };
  const allowed = ( off: number) => bare.length >= total && off >= before && bare.length - off >= after;
  const offsets: number[] = [];
  let soft = 0; // soft hyphens are not characters of the word for §6.3.4's counting
  for (let i = 1; i < word.length - 1; i++) {
    if (word[i] !== '­') continue;
    if (allowed(i - soft)) offsets.push(i);
    soft++;
  }
  if (hyphensMode === 'auto' && lang) {
    for (const off of hyphenationOffsets(bare, lang, limits)) if (!offsets.includes(off)) offsets.push(off);
  }
  return offsets.sort((a, b) => a - b);
}

/** Two border-box rects overlapping in both axes, sub-pixel noise excluded. The geometry half of the beside-a-float refusal below, exported so it is checkable without a browser; what it cannot say is which boxes were handed to it, which is the case runner's job. */
export function overlaps(a: { top: number; bottom: number; left: number; right: number; }, b: { top: number; bottom: number; left: number; right: number; }, eps: number = 0.5) {
  return b.bottom > a.top + eps && b.top < a.bottom - eps && b.right > a.left + eps && b.left < a.right - eps;
}

/**
 * Whether the browser renders this element — the condition under which its computed style says what the author's cascade said (*the composition refuses an unrendered source*, 2026-09-15).
 *
 * A walk, not an inspection of values, because the failing case answers plausible ones: a detached element's computed style is empty strings, but a light child of a shadow host that no slot is assigned to — every block between the intake into `<beltype-root>` and `present()` — answers a full declaration with its inherited properties at their initial values. So: connected, and climbing from the element, every light child of a shadow host it passes has a slot, a shadow root climbs to its host and an assigned child climbs through its slot. A closed or user-agent shadow root is invisible to `shadowRoot` and reads as rendered, which is the limit of what a page script can know.
 */
function inFlatTree(el: Element) {
  if (!el.isConnected) return false;
  let node: Node|null = el;
  while (node) {
    const parent: ParentNode|null = node.parentNode;
    if (!parent || parent.nodeType === 9) return true;
    if (parent.nodeType === 11) {
      node = (parent as ShadowRoot).host;
      continue;
    }
    if ((parent as Element).shadowRoot) {
      if (!((node as Element).assignedSlot)) return false;
      node = (node as Element).assignedSlot;
      continue;
    }
    node = parent;
  }
  return true;
}

/** The width key: a record is valid for one content width only (*geometry changes only at page boundaries* (C8), and *cut-invariance* (C7) suspends across a width change — the stale hazard of *the width-keyed cache* (P15), fixed here). */
const widthKey = ( avail: number) => Math.round(avail * 100) / 100;

/** The computed properties a paragraph's widths are read in and that its markup does not carry: the font and the spacing the browser sets its glyphs with. They ride in the key (`composition-key.js`) beside the properties `composeDocument` reads for the Compositor itself — alignment, indent, hyphenation and language — because a rule on an ancestor can move any of them with the paragraph untouched. */
const WIDTH_INPUTS: (keyof CSSStyleDeclaration)[] = ['font', 'letterSpacing', 'wordSpacing', 'textTransform', 'fontKerning', 'fontFeatureSettings', 'fontVariantLigatures', 'fontVariantNumeric', 'textRendering', 'tabSize'];

/**
 * Compose every composable element under the given top-level source blocks, against the measure context at its current width. Two batched layouts: one raw (content widths in situ), one nowrap (advance widths).
 *
 * **The cache is keyed by the paragraph, not by the element object** (*the run resumes from an entry*, build three): `paragraphKey` over the paragraph's path, its markup, the width it is set at and the per-block inputs its lines are a function of. A paragraph re-entering at a width it has seen is a pure hit (the re-homing of *cut-invariance*, C7), a new width composes fresh, and a paragraph of a new tree whose path, markup, width and inputs are what they were is a hit too, which is what a recompile hands over. The stored value is the record as composed — word indices and pixel widths, no element — so nothing is re-bound. `cache` may be any `Map` (the venue's harness hands one in); a `CompositionCache` also counts hits and misses for the run.
 *
 * **A top-level block the cache has already resolved is not laid out** (the block memo, `composition-key.js`): given `of`, a `CompositionCache` answers a block whose index, width, markup and neighbour are what they were from the records its paragraphs resolved to, with no clone, no layout and no style read; only the blocks it cannot answer are cloned and measured, together, in one batch. A float anywhere puts every block back in the batch (`floaty`), because a float is what carries one block's geometry into another's: seen in a block laid out now, the call is laid out again whole.
 *
 * Returns Map(sourceElement → record) resolved for this pass's width, for this tree; application must use the resolved map, never the cache.
 *
 * @param blocks - the top-level source blocks to compose under.
 * @param ctx - the measure context.
 * @param of - where `blocks` stand in the document: `blocks` is the document's whole list of top-level blocks (a block's neighbours are read from it), `at` the document index of the first of the given blocks or of each. The path in a key starts with the index, and the block memo needs the neighbours; absent, a block's index is its place in `blocks` and there is no block memo.
 */
export function composeDocument(doc: Document, blocks: Element[], ctx: any, cache: Map<string,object> = new CompositionCache(), of: { blocks: Element[]; at: number|number[]; }|null = null): Map<Element,CompositionRecord> {
  const win = (doc.defaultView as Window & typeof globalThis);
  const resolved: Map<Element,CompositionRecord> = new Map<any, any>();
  const indexOf = ( i: number) => (of ? (typeof of.at === 'number' ? of.at + i : of.at[i]) : i);
  const tally = cache instanceof CompositionCache ? cache : null;

  // The block memo: which blocks are answered without a layout.
  const memoKeys = tally && of ? blocks.map((el, i) => {
    const at = indexOf(i);
    return blockKey({ index: at, width: parseFloat(ctx.container.style.width), markup: el.outerHTML, before: of.blocks[at - 1] ? attributesOf(of.blocks[at - 1]) : '', last: at === of.blocks.length - 1 });
  }) : null;
  const memos = memoKeys ? memoKeys.map((k) => tally?.blocks.get(k)) : null;
  const trustMemo = !!memos && !memos.some((m) => m?.floaty);

  // What a descendant selector can reach an inline through is on the paragraph's ancestors: their attributes, from the paragraph up to its top-level block, memoized so an ancestor is read once.
  const ancestry: Map<Element,string> = new Map<any, any>();
  const tops = new Set(blocks);
  const ancestryOf: (el: Element) => string = (el): string => {
    let sig = ancestry.get(el);
    if (sig === undefined) {
      sig = tops.has(el) || !el.parentElement ? attributesOf(el) : `${ancestryOf(el.parentElement)}>${attributesOf(el)}`;
      ancestry.set(el, sig);
    }
    return sig;
  };

  /** Clone, measure and compose the blocks at `todo` (indices into `blocks`), in one batch. Returns whether any of them floats, and the paragraphs it refused for a line inside a word; the caller reports them, counting the blocks it did not lay out too. */
  const lay = (todo: number[]) => {
    const sources = todo.map((i) => blocks[i]);
    if (tally) tally.laid += todo.length;

    // Pass 1 — content widths in situ: raw clones of all blocks, parallel-walked back to sources.
    // A measuring copy is a copy: it carries the words its original's `:has()` answers gave, so a width a `:has()` rule decides is measured as the original has it (`has-words.js`).
    const rawClones = sources.map((el) => measuringCopyOf(el));
    const cloneToSource: Map<Element,Element> = new Map<any, any>();
    // The address's path to each source (`positions.js`: the in-flow element-child indices below the top-level block, the block's own document index first), minted on the walk that pairs a clone with its source. A `position: fixed` box is in no flow and in no path, and its own subtree stands under `-1`.
    const pathToSource: Map<Element,number[]> = new Map<any, any>();
    const mapTrees: (clone: Element,source: Element,path: number[]) => void = (clone, source, path): void => {
      cloneToSource.set(clone, source);
      pathToSource.set(source, path);
      let k = 0;
      for (let i = 0; i < clone.children.length; i++) {
        const child = source.children[i];
        mapTrees(clone.children[i], child, isFixedBox(child) ? [...path, -1] : [...path, k++]);
      }
    };
    rawClones.forEach((c, k) => mapTrees(c, sources[k], [indexOf(todo[k])]));
    ctx.measure(rawClones);

    /**
     * §2.1's price to the Compositor, refused rather than paid wrong. `avail` below is the block's own content-box width — and a block laid out beside a float does not have that width for its lines: the float shortens every line box it reaches into. The DP would then choose lines against a measure the browser will never give them, and neither composed check can see it — fit-by-construction compares to the same wrong `avail`, and the line-count cross-check measures the hinted clone, which has exactly the lines the hints force. Measured on `cases/21-parallel-flows`: five slabs composed at 366px where their lines had about 230, one paragraph set in 2 lines where the browser wraps 3.
     *
     * So the engine **does not compose such a block**: its lines stay the browser's, and the console says so on every run. That is the tablet's own posture — *uniform law, never uniform pixels* — applied where a decision cannot be made under *render-identical conditions* (I5), and a refusal a reader can see beats a composition that is quietly wrong. The real fix is a per-line measure: `compose()` taking `availableAt(lineIndex)`, with the DP state extended to (node, line) and the widths read from the float's rect against the block's content box — the same state extension `looseness` needs, which is why it is one build and not two. Recorded as a standing limit in the checklist, not as a to-do here.
     */
    const floats: { el: Element; rect: DOMRect; }[] = [];
    for (const clone of cloneToSource.keys()) {
      if (win.getComputedStyle(clone).float !== 'none') floats.push({ el: clone, rect: clone.getBoundingClientRect() });
    }
    // A float's own descendants are laid out in the float's own formatting context at the float's own width, which is exactly what their rect reports — nothing is refused there. What is refused is a block the float reaches into: a sibling it stands beside, or an ancestor whose line boxes it is nested in.
    const intrudedByFloat: (clone: Element,rect: { top: number; bottom: number; left: number; right: number; }) => boolean = (clone, rect): boolean => floats.some((f) => !f.el.contains(clone) && overlaps(rect, f.rect));
    /** The block's content box: a float wholly in the padding or the border (a hanging number) shortens none of its line boxes, so it is the content box the float's rect is compared with. */
    const contentBoxOf = (cs: CSSStyleDeclaration, rect: DOMRect) => {
      const left = rect.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      const top = rect.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
      return { left, top, right: rect.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight), bottom: rect.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom) };
    };
    const refusedBesideFloat = [];
    /** A second refusal, of the same kind and for the same reason (*a line inside a word is a break point*, 2026-09-23). The Compositor's break opportunities are spaces, hyphenation points and css-text-4 §6.4's emergency break; a block whose text the browser may break anywhere else — `word-break: break-all`, `line-break: anywhere`, or a script written without spaces (`word-space.js`' `UNSPACED_SCRIPT`) — reaches it as words it cannot divide. Measured on `packages/essay/cases/63-the-line-inside-a-word`: a thirty-line `break-all` paragraph was one word to the DP, set on one nowrap line, and twenty-one of its thirty lines were on no page. So such a block keeps the browser's lines, and the console says so; the real fix is the Compositor learning UAX #14's opportunities, which is a later round. */
    const refusedUnspaced = [];
    /** A third refusal: a block in a multi-column container (`inColumns`). */
    const refusedInColumns = [];

    const jobs = [];
    for (const [clone, source] of cloneToSource) {
      if (!isComposable(clone)) {
        if (inColumns(clone) && PARAGRAPH_DISPLAY.has(win.getComputedStyle(clone).display)) refusedInColumns.push(source);
        continue;
      }
      const cs = win.getComputedStyle(clone);
      const rect = clone.getBoundingClientRect();
      if (floats.length && intrudedByFloat(clone, contentBoxOf(cs, rect))) {
        refusedBesideFloat.push(source);
        continue;
      }
      const avail = rect.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const key = widthKey(avail);
      if (!inFlatTree(source)) {
        throw new Error(`the composition reads a block's alignment, indent and hyphenation from its source, and this <${source.tagName.toLowerCase()}> is in no flat tree — detached, or a slottable no slot is assigned to — where its computed style answers empty strings or initial values. Compose before the document is adopted into <beltype-root>, as seam/client.js does.`);
      }
      // The key reads the source's own style, so the flat-tree check above comes first now and not only on a miss: a hit reads the source too.
      const sourceStyle = win.getComputedStyle(source);
      const langAttr = source.closest('[lang]')?.getAttribute('lang');
      const hyphensMode = sourceStyle.hyphens || 'manual';
      const align = alignOf(sourceStyle);
      const indent = parseFloat(sourceStyle.textIndent) || 0;
      const hyphenChar = hyphenCharOf(sourceStyle);
      const limits = limitCharsOf(sourceStyle);
      const breakAnywhere = ['anywhere', 'break-word'].includes(sourceStyle.overflowWrap);
      const paragraph = paragraphKey({
        path: (pathToSource.get(source) as number[]),
        markup: shapeOf(source.outerHTML),
        width: key,
        inputs: [align, indent, hyphensMode, langAttr ?? null, hyphenChar, limits.total, limits.before, limits.after, breakAnywhere, sourceStyle.wordBreak, sourceStyle.lineBreak, ...WIDTH_INPUTS.map((name) => sourceStyle[name]), ancestryOf(source)]
      });
      const hit = lookup(cache, paragraph);
      if (hit) {
        resolved.set(source, (hit as CompositionRecord));
        continue;
      }
      if (sourceStyle.wordBreak === 'break-all' || sourceStyle.lineBreak === 'anywhere' || UNSPACED_SCRIPT.test(source.textContent ?? '')) {
        refusedUnspaced.push(source);
        continue;
      }
      jobs.push({
        source,
        avail,
        paragraph,
        align,
        indent,
        hyphensMode,
        lang: languageFor(langAttr),
        // The three css-text-4 properties the line already had and this module was not reading (2026-09-07). All three are inherited, so the block's own computed style is the whole answer.
        hyphenChar,
        limits,
        breakAnywhere
      });
    }

    if (jobs.length) {
      // Pass 2 — advance widths: unbroken nowrap clones, all in one layout, each carrying its hyphen probe; Ranges are read lazily during each DP.
      const nowrapClones = jobs.map((j) => {
        const c = (measuringCopyOf(j.source) as HTMLElement);
        c.style.whiteSpace = 'nowrap';
        c.style.width = 'max-content';
        c.style.textIndent = '0';
        return c;
      });
      // A nested paragraph is measured inside shallow copies of its ancestors up to its top-level block, or it loses what it inherits from them and what a descendant selector reads: a pull quote's `blockquote { font: italic 22px serif }` measured at the measure container's 16px set lines 22% too wide for the box (`composed-pull-quote-overrun`). ponytail: shallow copies carry attributes only, so a sibling selector (`p + p`, `:first-child`) still reads the lone copy; clone the earlier siblings too if one is ever measured wrong.
      const measureRoots = jobs.map((j, i) => {
        let top: Element = nowrapClones[i];
        for (let cur = j.source; !tops.has(cur) && cur.parentElement; cur = cur.parentElement) {
          const wrap = cur.parentElement.cloneNode(false) as Element;
          wrap.appendChild(top);
          top = wrap;
        }
        return top;
      });
      const probes = jobs.map((job, i) => seatHyphenProbe(nowrapClones[i], job.hyphenChar));
      ctx.measure(measureRoots);
      // One pass reading, one pass removing: the removal is the last write, so the layout it forces is the last one the composition pays for. `collectWords` runs after it, or a probe's character would be a word.
      const hyphenWidths = probes.map(probeWidth);
      for (const probe of probes) probe?.remove();
      jobs.forEach((job, i) => {
        const el = nowrapClones[i];
        const hyphenWidth = hyphenWidths[i];
        const { words, runs } = collectWords(el);
        const spaceWidth = measureSpaceWidth(doc, words, el);
        /**
         * The em a rag is priced against (*the rag is priced once*), read where the widths are read.
         *
         * It is measured on the nowrap clone, beside the space, and not on the source — for the reason the space is: a tolerance has to be commensurate with the advances the DP compares it to, and those advances come from this element's layout. Reading it from the source would be reading a second element's font in the hope that it is the same one.
         *
         * It is also the only reading that cannot come back empty. `getComputedStyle` answers with an empty declaration for an element in no flat tree — a detached node, or a block already moved into `<beltype-root>`'s light DOM and not yet assigned a slot — and `parseFloat('')` is `NaN`, which `compose()` refuses rather than composing against (measured in the wild, 2026-09-10: *the ragged stretch model needs the block's own em* on an operator's document). The nowrap clone is in the measure container by construction, so it is always laid out and always has a font size. **The other per-block facts still come off the source and still can**: alignment, indent and the hyphenation trio degrade to `''`, `0` and `''` in silence there, which is a hazard this reading removes from one property and not from four — recorded on the checklist rather than fixed here.
         */
        const emWidth = parseFloat(win.getComputedStyle(el).fontSize);
        // `hyphenChar` rides the record because `applyHints` has the record and nothing else, and the character is a property of the source's own style rather than of the width the record was composed at.
        const record: CompositionRecord = { align: job.align, avail: job.avail, hyphenChar: job.hyphenChar, runs: [], lineCount: 0 };
        for (let r = 0; r < runs.length; r++) {
          const runWords = words.slice(runs[r].start, runs[r].end);
          const result = compose({
            words: runWords.map((w) => w.text),
            hyphenOffsets: (i2) => candidatesFor(runWords[i2].text, job.hyphensMode, job.lang, job.limits),
            measure: makeProvider(doc, words, runs[r].start, hyphenWidth, spaceWidth, emWidth),
            available: job.avail,
            indent: r === 0 ? job.indent : 0,
            align: job.align,
            breakAnywhere: job.breakAnywhere,
            limitLines: HYPHENATE_LIMIT_LINES
          });
          record.runs.push({ start: runs[r].start, ...result });
          record.lineCount += result.lineCount;
        }
        remember(cache, job.paragraph, record);
        resolved.set(job.source, record);
      });
    }


    return { floaty: floats.length > 0, refusedBesideFloat, refusedUnspaced, refusedInColumns };
  };

  let todo = blocks.map((_, i) => i).filter((i) => !(trustMemo && memos?.[i]));
  let laid = lay(todo);
  // A float in a block laid out now reaches blocks the memo answered: lay everything out together, once more, as a call without a memo would.
  if (laid.floaty && todo.length < blocks.length) {
    resolved.clear();
    todo = blocks.map((_, i) => i);
    laid = lay(todo);
  }
  const answeredBy = new Set(todo);
  let refusedFromMemo = 0;
  blocks.forEach((el, i) => {
    if (answeredBy.has(i)) return;
    const memo = memos?.[i];
    if (!memo) return;
    const els = [el, ...el.querySelectorAll('*')];
    for (const [ordinal, record] of memo.records) resolved.set(els[ordinal], (record as CompositionRecord));
    if (tally) tally.hits += memo.records.length;
    refusedFromMemo += memo.refused;
  });
  // What the blocks laid out now resolved to, for the next call. A window with a float in it is marked, and no block of it is answered unseen again.
  if (tally && memoKeys) {
    for (const i of todo) {
      const el = blocks[i];
      const records: Array<[number,object]> = [];
      [el, ...el.querySelectorAll('*')].forEach((e, ordinal) => {
        const record = resolved.get(e);
        if (record) records.push([ordinal, record]);
      });
      tally.blocks.set(memoKeys[i], { records, floaty: laid.floaty, refused: laid.refusedUnspaced.filter((src) => el.contains(src)).length });
    }
  }
  const { refusedBesideFloat, refusedUnspaced, refusedInColumns } = laid;

  // Never in silence — the render-conditions rule, applied to a decision the engine declines to take rather than to one it takes under a relaxation.
  if (refusedBesideFloat.length) {
    win.console?.warn(
      `BelType/Cicero: ${refusedBesideFloat.length} block(s) sit beside a float and are NOT composed by this engine — ` +
      'their lines are the browser\'s, because a float shortens line boxes and the Compositor has one measure per block, not one per line. ' +
      'The pages are honest; the line breaking in those blocks is not this engine\'s.'
    );
  }

  if (refusedInColumns.length) {
    win.console?.warn(
      `BelType/Cicero: ${refusedInColumns.length} block(s) sit in a multi-column container and are NOT composed by this engine — ` +
      'their lines are the browser\'s, because the Compositor has one measure per block, not one per column. ' +
      'The pages are honest; the line breaking in those blocks is not this engine\'s.'
    );
  }

  const refusedCount = refusedUnspaced.length + refusedFromMemo;
  if (refusedCount) {
    win.console?.warn(
      `BelType/Cicero: ${refusedCount} block(s) may break lines inside a word — word-break: break-all, line-break: anywhere, or a script written without spaces — and are NOT composed by this engine; ` +
      'their lines are the browser\'s, because the Compositor breaks only at spaces, hyphenation points and overflow-wrap\'s emergency break. ' +
      'The pages are honest; the line breaking in those blocks is not this engine\'s.'
    );
  }

  return resolved;
}

/** Materialize a record's hints into a pristine clone of the same element (*the source document is never written*, C5: clones only). Splits are applied in reverse document order so earlier DOM points stay valid. */
export function applyHints(el: HTMLElement, record: CompositionRecord) {
  const doc = el.ownerDocument;
  const { words } = collectWords(el);

  type HintOp = { word: Word, char: number, glyph: boolean, filler?: undefined, afterWord?: undefined } | { filler: number, afterWord: Word, word?: undefined, char?: undefined };
  const ops: HintOp[] = [];
  for (let r = 0; r < record.runs.length; r++) {
    const rec = record.runs[r];
    for (const brk of rec.breaks) {
      ops.push({ word: words[rec.start + brk.word], char: brk.char, glyph: brk.glyph !== false });
    }
    if (record.align === 'justify' && rec.fillerPx > 0.05) {
      // The run's filler sits after its last word — before the author <br> that closes the run, or at the paragraph's end. The run's length is its end node's word index.
      const runLength = rec.lines.length ? rec.lines[rec.lines.length - 1].to.word : 0;
      ops.push({ filler: rec.fillerPx, afterWord: words[rec.start + runLength - 1] });
    }
  }

  // Reverse document order: later words first, and within a word the boundary op (char 0) never coexists with a hyphen op at the same word.
  const docOrder = ( op: HintOp) => {
    const w = op.word ?? op.afterWord;
    return words.indexOf(w) * 1000 + (op.char ?? 999);
  };
  ops.sort((a, b) => docOrder(b) - docOrder(a));

  for (const op of ops) {
    if (op.filler != null) {
      const span = doc.createElement('span');
      addWord(span, FILL);
      span.style.display = 'inline-block';
      span.style.width = `${op.filler}px`;
      if (op.afterWord.atom) {
        const atom = firstNodeOf(op.afterWord);
        (atom.parentNode as Node).insertBefore(span, atom.nextSibling);
        continue;
      }
      const [node, off] = (pointInWord(op.afterWord, op.afterWord.text.length, true) as [Text, number]);
      // Never manufacture an empty trailing text node: at the node's end, insert after it directly.
      if (off >= node.data.length) (node.parentNode as Node).insertBefore(span, node.nextSibling);
      else (node.parentNode as Node).insertBefore(span, splitTextAt(node, off));
      continue;
    }
    const br = doc.createElement('br');
    addWord(br, BREAK);
    if (op.char > 0) {
      const [node, off] = (pointInWord(op.word, op.char) as [Text, number]);
      const after = splitTextAt(node, off);
      // The hyphenation character is the author's, or U+2010 where they left it to the engine (css-text-4 §6.3.2). An emergency break under §6.4 writes none at all: *"no hyphenation character is inserted at the break point"*, in as many words, and the empty string an author may name reaches the same place by a different route.
      const ch = op.glyph ? record.hyphenChar ?? '‐' : '';
      if (ch) {
        // The hyphen is the engine's text and not a character of the source: registered, so a word's characters count the source's alone (*the hyphen is written at the cut*, 2026-10-06).
        const written = doc.createTextNode(ch);
        noteEngineText(written);
        (node.parentNode as Node).insertBefore(written, after);
      }
      (node.parentNode as Node).insertBefore(br, after);
    } else {
      // The inter-word space stays in front of the break: the browser's end-of-line trimming discards it visually (the glue is spent), while the text stream keeps its word boundary — the Gauge tokenizes joined text, and a space-less break would merge the two words across the line edge. An atom is stood in front of whole.
      if (op.word.atom) {
        const atom = firstNodeOf(op.word);
        (atom.parentNode as Node).insertBefore(br, atom);
        continue;
      }
      const [node, off] = (pointInWord(op.word, 0) as [Text, number]);
      const target = off > 0 ? splitTextAt(node, off) : node;
      (target.parentNode as Node).insertBefore(br, target);
    }
  }

  el.style.whiteSpace = 'nowrap';
  if (record.align === 'justify') el.style.textAlignLast = 'justify';
}

/**
 * Apply every cached record under a cloned top-level block (a walk of the clone, each box paired with the source it was copied from). Used by the feed writer and by anything serializing the hinted document.
 *
 * **A box `fragments.js` put away is passed over** (*the clone is hollow outside the interval*, 2026-09-27): it is on no page, it may be hollow, and a deep one has had its text emptied, so there is nothing of it to hint and no word its record could name. The feed cuts its tail before it hints, which is what makes this *hints after the cut* for everything the page does not show; every leaf the page shows gets its whole record, as before.
 */
export function applyRecordsUnder(clone: Element, source: Element, cache: Map<Element,CompositionRecord>) {
  if (hasWord(clone, AWAY)) return;
  const rec = cache.get(source);
  if (rec) {
    applyHints((clone as HTMLElement), rec);
    return;
  }
  // Each child is paired with the box it was copied from, never with the child at its index: a box the copy has left (a nested fixed box, stripped before the hints) shifts every index after it. A clone nothing registered (the venue's plain `cloneNode` copies) keeps its source's own order.
  for (let i = 0; i < clone.children.length; i++) applyRecordsUnder(clone.children[i], sourceOf(clone.children[i]) ?? source.children[i], cache);
}

/** Verification helpers (harness.md, composed mode): actual line widths of an applied element — words regrouped by every <br> (ours and the author's), one whole-line Range per group — and the record's per-line avail list, flattened. Fit by construction: widths[i] ≤ avails[i] + eps; the line count doubles as the Gauge cross-check's expectation. */
export function appliedLineWidths(el: Element): number[] {
  const doc = el.ownerDocument;
  const { words } = collectWords(el); // splits at every br, ours and the author's alike
  const brs = [...el.querySelectorAll('br')];
  const range = rangeOf(doc);
  const widths: number[] = [];
  let current: Word[] = [];
  let bi = 0;
  const flush = () => {
    if (!current.length) return;
    const [sn, so] = pointInWord(current[0], 0);
    const last = current[current.length - 1];
    const [en, eo] = pointInWord(last, last.text.length, true);
    range.setStart(sn, so);
    range.setEnd(en, eo);
    widths.push(range.getBoundingClientRect().width);
    current = [];
  };
  const wordAfterBr: (word: Word,br: Element) => boolean = (word, br): boolean => !!(firstNodeOf(word).compareDocumentPosition(br) & Node.DOCUMENT_POSITION_PRECEDING);
  for (const word of words) {
    while (bi < brs.length && wordAfterBr(word, brs[bi])) {
      flush();
      bi++;
    }
    current.push(word);
  }
  flush();
  return widths;
}

/** Flattened per-line avail list from a record, matching appliedLineWidths order. */
export function recordAvails(record: CompositionRecord): number[] {
  return record.runs.flatMap((r) => r.lines.map((l) => l.avail));
}


/**
 * The composed mode's presentation input: every composable block resolved at the width of the page it will be set on, keyed by that width for `root.present()` (*the composed mode reaches the operator*, 2026-09-10).
 *
 * `composeDocument` composes against one measure context at one width, and a document has as many widths as its pages' conditions give it (*geometry changes only at page boundaries*, C8) — a named page's, and a parity's or a `:first`'s. **The widths and the blocks each needs are read off the account** (*the presentation composes the pages it has*, 2026-09-15), because the walk decided every page's conditions and composed its region at that page's own width: `presentationWidths` in `positions.js` answers which blocks each width must cover, and the records land under `widthKeyOf`, which is what `present()` looks a page up by. This used to group blocks by the top-level block's page name and compose each group at `pageFor({ name })`, which has no parity and no `:first` — so a page whose width only a parity rule decided, or whose name was declared below the top level, found no record and printed the browser's lines under a cut decided on the Compositor's (`packages/essay/cases/49-the-page-a-parity-narrows`).
 *
 * **Those twenty lines lived in `packages/essay`'s own client and nowhere else**, which is why this function exists rather than a second copy of them: the venue holds how we know and the engine holds what is true, and a product path that only the harness can walk is on the wrong side of that. Now the seam's client and the venue's call the same one.
 *
 * The contexts are disposed as they are finished — `createMeasureContext` seats a hidden container and a neutralisation sheet in the document, and a preview that left one per page name behind would be measuring against its own litter on the next run.
 *
 * @param blocks - the top-level source blocks, in document order — the same list `paginate` indexed.
 * @param account - the driver's account, one entry per page, whose `closes` carry each page's decided conditions.
 * @param cache - the composition cache (paragraph key → record), shared with `paginate` so a block composed for adjudication is not composed again for presentation, and with the next `run()` so a paragraph composed here is not composed again there.
 * @param only - the pages (indices, inclusive) a resumed presentation builds anew (*the run resumes from an entry*, build two): the pages that stay are not presented again, so their blocks are not composed again either.
 * @returns width key → (source element → record), the shape `present()` takes as `resolvedByWidth`.
 */
export function composeForPresentation(doc: Document, blocks: Element[], account: object[], cache: Map<string,object> = new CompositionCache(), only: { from: number; to: number; }|null = null): Map<string,Map<Element,CompositionRecord>> {
  const index = indexBlocks(blocks);
  const pages = pageIntervals(account, index.bases, index.endOf).filter((pg) => !only || (pg.index >= only.from && pg.index <= only.to));
  const byWidth = new Map<any, any>();
  for (const [key, { contentW, blocks: indices }] of presentationWidths(pages, blocks.length)) {
    const ctx = createMeasureContext(doc, contentW);
    byWidth.set(key, composeDocument(doc, indices.map((b) => blocks[b]), ctx, cache, { blocks, at: indices }));
    ctx.dispose();
  }
  return byWidth;
}
