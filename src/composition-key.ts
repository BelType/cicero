/**
 * The composition cache's key, and the cache that lives across runs (*the run resumes from an entry*, build three, 2026-10-08; .claude/decisions/cicero/the-run-resumes-from-an-entry.md, Decision three).
 *
 * The cache is keyed by the paragraph, not by the source element object (see CHANGELOG 2026-10-08): an object key hits only within one run, and every paragraph misses after the belt hands over a new tree. A paragraph is composed from its words, its markup, the width it is set at and a handful of the block's own style inputs, and none of that is an object: **the key is the paragraph's path, its markup and the width it is set at, plus the per-block style inputs the lines are a function of**, as one string. Two paragraphs of two trees that agree on all of it compose to the same lines, so a record composed once is found again wherever the paragraph stands now.
 *
 * @remarks
 * **The record is tree-independent already, so nothing is re-bound.** What a composition stores is `{ align, avail, hyphenChar, runs: [{ start, breaks, lines, fillerPx }], lineCount }`: word and character indices, pixel widths and strings, and no element. `applyHints` resolves them against whatever tree it is handed, by the word list that tree's paragraph yields. So the stored value is the record as it was, and the only thing that changed is where it is looked for.
 *
 * **Markup, not text** — the record says "text", and text alone is wrong the moment an inline element wraps a word: `**dog**` is the same text and a different width. The shape is the paragraph's own serialized markup, which holds its text, its inline elements, their classes and every attribute that can reach a width; only the editing host's line stamps (the `pos:` word of `data-beltype`, one per mapped node and a merged-document line number, so an edit above shifts every stamp below it) are taken out, because they are not text and no paragraph's lines depend on them.
 *
 * **The path is the address's, in full.** An insertion or a removal of a top-level block above a paragraph shifts its path and therefore misses it; that is the record's own choice (path and text) and it costs a recomposition of what stands below the edit, never a wrong line. Dropping the block index from the key would trade that for hits across a re-numbering, and is a one-line change if a measurement ever wants it.
 *
 * **The per-block inputs ride in the key** because the lines are a function of them and none of them is in the markup: they are read from the source's computed style, where an ancestor's class or a sibling rule can change them with the paragraph untouched. The caller names them (`compose-dom.js`: the alignment, the indent, the hyphenation trio and the language, the break-anywhere flag, the font and spacing the widths are read in, and the ancestors' attributes a descendant selector can reach an inline through).
 *
 * **A second level answers a top-level block the edit did not touch without laying it out.** The width a paragraph is set at (its `avail`, the other half of the key) is read from a layout, and laying out the whole region to read it is what a resumed run cannot afford: the manual's remaining region is 357 ms of clones and layout before any paragraph is looked up. But a block's layout is a function of its own subtree, the width it is laid out at and the CSS, and of nothing in any other block except a float standing beside it and the sibling selectors that read its neighbour. So the cache also keeps, per top-level block, the records its paragraphs resolved to (`blockKey`: the block's index, the width, its markup, its previous sibling's own attributes and whether it is the last), and a block whose key it knows is answered whole — no clone, no layout, no style read. It is switched off, for the whole call, wherever a float has been seen in the window the entry was laid out in or in a block now laid out (`floaty`), because a float is the one thing that carries one block's geometry into another's.
 *
 * A change of the run's conditions clears the cache whole — the stylesheets' text after the seam's rewrite, the viewport, the device pixel ratio, the colour scheme (`seam/client.js`' `conditionsKey`) — because a record is only valid under the conditions it was composed in, and the cache is the memo of a pure function whose conditions are those.
 *
 * @packageDocumentation
 */

import { ATTRIBUTE, withoutPos } from './data-beltype.ts';

/** The editing host's line stamp, the one word the belt writes only when a host asks and that moves with every edit above it: in serialized markup, the `pos:` word of the `data-beltype` attribute. */
const WORDS = new RegExp(` ${ATTRIBUTE}="([^"]*)"`, 'g');

/**
 * A paragraph's markup as the key reads it: the serialized element with the editing host's line stamps taken out — the `pos:` word only, so the engine's own words and an author's stay, and the attribute goes when nothing else is left in it.
 *
 * @param markup - the paragraph's `outerHTML`.
 */
export const shapeOf = (markup: string): string => markup.replace(WORDS, (_all, value) => {
  const rest = withoutPos(value);
  return rest ? ` ${ATTRIBUTE}="${rest}"` : '';
});

/** An element's name and attributes with the editing host's line stamp taken out — the stamp is a merged-document line number and an edit above shifts it without touching the box (the same exclusion {@link shapeOf} makes). */
export const attributesOf = (el: Element): string => el.localName + [...el.attributes].map((a) => {
  const value = a.name === ATTRIBUTE ? withoutPos(a.value) : a.value;
  return a.name === ATTRIBUTE && !value ? '' : ` ${a.name}="${value}"`;
}).join('');

/** The key of a paragraph: its path, its shape, the width it is set at and the per-block inputs the lines are a function of, as one string, so two keys compare by `===` and index a `Map`. */
export const paragraphKey = ({ path, markup, width, inputs }: { path: ReadonlyArray<number>; markup: string; width: number; inputs: ReadonlyArray<unknown>; }): string => JSON.stringify([path, markup, width, inputs]);

/** The key of a top-level block: its index (`:nth-child`), the width it is laid out at, its markup, its previous sibling's own attributes (a sibling combinator reads no more of it) and whether it is the last (`:last-child`), as one string. */
export const blockKey = ({ index, width, markup, before, last }: { index: number; width: number; markup: string; before: string; last: boolean; }): string => JSON.stringify([index, width, shapeOf(markup), before, last]);

/** What a top-level block resolved to, kept so that the next call need not lay it out. */
export type BlockMemo = {
  /** the record of each composable element, by its preorder ordinal in the block (the block itself is 0) — the same ordinal in any tree with the same markup. */
  records: Array<[number, object]>;
  /** a float was seen in the window the block was laid out in, so its neighbours' geometry reached into it and no neighbour may be answered without a layout. */
  floaty: boolean;
  /** the paragraphs of the block the Compositor declined for a line inside a word, which the console reports by count on every run. */
  refused: number;
};

/** The cache: key → record, living across `run()` calls on the seam, with the run's tally (a hit is a composition not performed, a miss one performed, `laid` a top-level block cloned and laid out) and the conditions it is valid under. `blocks` is the second level: block key → what the block resolved to. */
export class CompositionCache extends Map<string, object> {
  /** Compositions found, since the last restart. */
  hits = 0;
  /** Compositions performed, since the last restart. */
  misses = 0;
  /** Top-level blocks cloned and laid out, since the last restart: those no block memo answered. */
  laid = 0;
  blocks: Map<string,BlockMemo> = new Map<any, any>();
  conditions: string|null = null;

  /**
   * Begin a run: the tally starts again, and the records are dropped unless `conditions` are the ones they were composed under.
   *
   * @param conditions - the run's conditions as one string.
   * @returns whether the cache was cleared.
   */
  restart(conditions: string): boolean {
    this.hits = 0;
    this.misses = 0;
    this.laid = 0;
    if (this.conditions === conditions) return false;
    this.clear();
    this.blocks.clear();
    this.conditions = conditions;
    return true;
  }
}

/** Look a record up, counting a hit where the cache keeps a tally. A plain `Map` is a cache too — the venue's harness hands one in — and counts nothing. */
export function lookup(cache: Map<string,object>, key: string): object|undefined {
  const record = cache.get(key);
  if (record !== undefined && cache instanceof CompositionCache) cache.hits++;
  return record;
}

/** Store a composition just performed, counting a miss where the cache keeps a tally. */
export function remember(cache: Map<string,object>, key: string, record: object) {
  cache.set(key, record);
  if (cache instanceof CompositionCache) cache.misses++;
}
