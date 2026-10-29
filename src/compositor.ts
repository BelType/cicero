/**
 * The Compositor — whole-paragraph line breaking (tablet, The Line; architecture, The Compositor; second-coding-round.md item 1). One of the system's two deciders; this module is the decision alone: DOM-free, widths through an injected provider (the whole-line Range policy lives in the provider, built browser-side by compose-dom.js), output is a Hints value the feed writer materializes.
 *
 * Knuth–Plass-shaped total-fit dynamic programming over break candidates: word boundaries plus hyphenation offsets (Liang's, or an author's soft hyphens — the caller supplies them; this module does not know where they came from). Badness is slack against the measure under the alignment's stretch model, and there are two of those (see `STRETCH` below) — aesthetic error only, never geometric: a chosen line fits because its measured width is the oracle's own. Demerits add hyphen, consecutive-hyphen, and last-line-orphan penalties. Ties break toward earlier breaks (candidates priced ascending, replaced only on strictly lower total) — a total order, no randomness, so the determinism that *cut-invariance* (C7) relies on holds by construction.
 *
 * Each node reads only its feasible window (*the composition lays out once*, 2026-09-27): its predecessors are scanned downward and the scan stops at the first overfull span, on the premise that for a fixed end a span starting earlier is never narrower. What was read is then priced in ascending order, so the choice and its tie-breaking are the ones pricing every predecessor would make. On BelType's own manual it took the composition's Range reads from 6.2 to 4.8 million.
 *
 * Degenerates resolve like the browser: when nothing fits from a node, the shortest possible line is taken overfull with crushing (but finite) demerits — the paragraph always composes (the spirit of *the build cannot fail*, C2), and the fragment's nowrap keeps the overflow from cascading.
 *
 * @packageDocumentation
 */

/** A place in a run: `{ word: i, char: 0 }` is the boundary before word `i`, and `char > 0` is an offset inside word `i`. */
export type RunPosition = {
  word: number;
  char: number;
};

/** A chosen break. `glyph` is written only where it is `false` — css-text-4 §6.4's emergency break, which shows no hyphen — so a break that shows one keeps the two-field shape it has always had. */
export type Break = RunPosition & { glyph?: boolean };

/** The width provider, injected: the whole-line Range policy lives in the provider, built browser-side by compose-dom.js. */
export type Measure = {
  /** The whole-span reading from position `a` to position `b`, in px; the span excludes the hyphen glyph (this module adds `hyphenWidth` for hyphenated line ends). */
  width: (a: RunPosition, b: RunPosition) => number;
  hyphenWidth: number;
  spaceWidth: number;
  /** The block's own font size. Required for ragged alignment, which prices a rag against it; justified setting never reads it. */
  emWidth?: number;
};

/** One chosen line — what the fit assertion and the cross-check read. */
export type Line = {
  from: Break;
  to: Break;
  /** The measured width in px, hyphen glyph included where the line ends on one. */
  width: number;
  /** The measure this line was set against, in px — line 1's is debited by the indent. */
  avail: number;
  overfull: boolean;
};

/** The Compositor's whole output (architecture: `Hints`) — what the feed writer materializes. */
export type Hints = {
  /** The chosen breaks, in document order; the run's end is not among them. */
  breaks: Break[];
  lines: Line[];
  lineCount: number;
  /** The justify filler, serialized as a literal: the last line's slack. */
  fillerPx: number;
};

const EPS = 0.05; // px — width comparisons; under the fit epsilon everywhere else
const LINE_PENALTY = 10;
const HYPHEN_DEMERITS = 2500;
const CONSECUTIVE_HYPHEN_DEMERITS = 3000;
const LAST_LINE_ORPHAN_DEMERITS = 5000;
const OVERFULL_DEMERITS = 1e7;
/** css-text-4 §6.4's emergency break: dearer than any hyphen and cheaper than an overflow, which is the whole ordering the section asks for once the candidates only exist where they are needed. */
const EMERGENCY_DEMERITS = 1e5;
const BADNESS_CAP = 10000;
/** The rag a ragged line may leave before it starts reading as a hole, in ems of the block's own size — `ragged2e`'s `\rightskip = 0pt plus 2em`, and the value that puts the optimisation back where LaTeX's `1fil` takes it away (*the rag is priced once*). A judgement with a lineage, not a measurement: nothing this engine can run knows whether 2 is better than 1.5, so changing it is a decision and not a tuning. */
const RAG_TOLERANCE_EM = 2;

/**
 * Two stretch models, because there are two kinds of glue (*the rag is priced once*, 2026-09-10).
 *
 * Badness is slack divided by *what the line is willing to stretch*, cubed — the book's own `lines-2`, and Knuth's. What a line is willing to stretch depends on what its glue is.
 *
 * **Justified**: the interword gaps stretch, half a space each (TeX's cmr posture — cmr10's space is 3.33pt with 1.66pt of stretch). So the denominator counts gaps, and a line's badness is how hard each of them has to work.
 *
 * **Ragged** (`left`, `right`, `center`): nothing stretches. The slack is the rag at the line's end, and the number of words behind it is an accident of their lengths. So the denominator is one tolerance, `RAG_TOLERANCE_EM` ems of the block's own size — TeX's `\rightskip`, expressed as this module's own constant.
 *
 * **What this replaced, and what it cost.** Ragged setting used to divide by `gaps × one whole space`, which is the justified arithmetic with the unit swapped. It made the same visible rag cost about ten times more behind five words than behind eleven: 29.1px of rag scored badness 686 on a six-word line and 64 on a twelve-word one, in the same 306px measure. Measured on `packages/essay/cases/08-the-monolith`, where it bought a whole extra line — the closing paragraph set in 11 where the browser wraps 10 — and thirty-four of the venue's thirty-five documents are ragged, so it was the normal path and not an edge.
 */
const STRETCH: Record<string,number> = { justify: 0.5 };

/**
 * Compose one run: choose its line breaks by total fit.
 *
 * @param p.words - the run's words, in order (a run is an author-<br>-free stretch; the caller partitions).
 * @param p.hyphenOffsets - ascending character offsets where word i may break (Liang candidates, author soft hyphens); default none.
 * @param p.measure - the width provider.
 * @param p.available - the line measure in px.
 * @param p.indent - first-line text-indent in px — debits line 1's measure.
 * @param p.breakAnywhere - css-text-4 §6.4's `overflow-wrap: break-word | anywhere`, which lets *"an otherwise unbreakable sequence of characters be broken at an arbitrary point if there are no otherwise-acceptable break points in the line"*, and says outright that **no hyphenation character is inserted**. Such a break is a node like any other, marked `glyph: false`, so it costs no hyphen advance and carries no hyphen demerit.
 * @throws Error — bare and deliberate (`src/` may not import BelType's error types): ragged alignment with no usable `measure.emWidth`, a refusal rather than a NaN.
 */
export function compose({ words, hyphenOffsets = () => [], measure, available, indent = 0, align = 'left', breakAnywhere = false }: { words: string[]; hyphenOffsets?: (wordIndex: number) => number[]; measure: Measure; available: number; indent?: number; align?: 'left'|'right'|'center'|'justify'; breakAnywhere?: boolean; }): Hints {
  const N = words.length;
  if (N === 0) return { breaks: [], lines: [], lineCount: 0, fillerPx: 0 };

  /**
   * A word that will not fit a line of its own — §6.4's *"otherwise unbreakable sequence of characters … too long to fit within the line box"*.
   *
   * **The condition is what makes an emergency break a last resort by construction rather than by price.** §6.4 admits one only *if there are no otherwise-acceptable break points in the line*, which is a statement about a line and not a cost to trade off; asking it of the word is the checkable form of it, and it means the candidates simply do not exist anywhere they would be wrong. A price alone could not have done that: the demerits of an ordinary line are unbounded in practice (badness cubed, capped, then squared), so any finite emergency price would eventually beat a merely ugly line.
   */
  const overlong = ( i: number) => measure.width({ word: i, char: 0 }, { word: i + 1, char: 0 }) > available + EPS;

  // Nodes: the start boundary, every candidate break in document order, the end boundary.
  const nodes: Break[] = [{ word: 0, char: 0 }];
  for (let i = 0; i < N; i++) {
    const chars = new Map<any, any>();
    for (const c of hyphenOffsets(i)) if (c > 0 && c < words[i].length) chars.set(c, true);
    if (breakAnywhere && overlong(i)) {
      // Code-point boundaries, not UTF-16 indices: §6.4 requires grapheme clusters to stay together, and a surrogate pair is the half of that this engine can honour without a segmenter. Combining marks are not handled and are stated as a limit rather than approximated.
      let off = 0;
      for (const ch of words[i]) {
        off += ch.length;
        if (off > 0 && off < words[i].length && !chars.has(off)) chars.set(off, false);
      }
    }
    // `glyph` is written only where it is false. A break that shows a hyphen keeps the two-field shape it has always had, so nothing downstream and no existing pin has to learn a field to go on meaning what it meant — which is also the cheapest possible statement that this change is inert wherever §6.4's property is not declared.
    for (const c of [...chars.keys()].sort((a, b) => a - b)) nodes.push(chars.get(c) ? { word: i, char: c } : { word: i, char: c, glyph: false });
    if (i < N - 1) nodes.push({ word: i + 1, char: 0 });
  }
  nodes.push({ word: N, char: 0 });
  const last = nodes.length - 1;

  /** A break that shows a hyphen: any break inside a word except §6.4's emergency ones. */
  const hyphenated = ( n: Break) => n.char > 0 && n.glyph !== false;

  const ragged = !(align in STRETCH);
  const stretchUnit = (STRETCH[align] ?? 0.5) * measure.spaceWidth;
  // A refusal rather than a NaN: `2 * undefined` is NaN, a NaN badness loses every comparison in the scan below, and the paragraph comes out looking composed. The venue's oldest scar is a run that reported success while checking nothing.
  const ragTolerance = ragged ? RAG_TOLERANCE_EM * (measure.emWidth as number) : 0;
  if (ragged && !(ragTolerance > 0)) throw new Error(`the ragged stretch model needs the block's own em: measure.emWidth is ${measure.emWidth}`);

  // Words fully inside the line (for gap count and the orphan check): a line from a to b spans the word starts in (a.word, b.word] adjusted for partial edges.
  const gapsIn = ( a: Break,  b: Break) => {
    const firstWhole = a.char > 0 ? a.word + 1 : a.word;
    const lastWord = b.char > 0 ? b.word : b.word - 1;
    return Math.max(0, lastWord - firstWhole);
  };

  const lineWidth = ( a: Break,  b: Break) => measure.width(a, b) + (hyphenated(b) ? measure.hyphenWidth : 0);

  const best = new Array(nodes.length).fill(null);
  best[0] = { total: 0, prev: -1, width: 0, avail: 0, overfull: false };

  /** The widths read for the current node, by predecessor: the feasible window, and `j = 0` where a negative indent makes it the one exception. */
  const feasibleW = new Array(nodes.length);
  const feasibleJ: number[] = [];

  for (let k = 1; k < nodes.length; k++) {
    const isLast = k === last;
    let choice = null;
    /** The feasible window. The premise, stated so it can be broken: for a fixed end, a span that starts earlier is never narrower — a Range's rect over one nowrap line is the union of what it holds, and an earlier start holds everything a later one does. So once the span from `j` is overfull, every `j` below it is too against the same measure, and the scan stops there. Every `j` above 0 has the same measure; `j = 0` alone is debited the indent, which a positive indent makes narrower (overfull wherever the `j` above it is, so the stop stands) and a negative one wider — so under a negative indent a scan that stopped above it reads it on its own. */
    feasibleJ.length = 0;
    let stoppedAt = -1;
    for (let j = k - 1; j >= 0; j--) {
      if (!best[j]) continue;
      const W = lineWidth(nodes[j], nodes[k]);
      if (W > available - (j === 0 ? indent : 0) + EPS) {
        stoppedAt = j;
        break;
      }
      feasibleW[j] = W;
      feasibleJ.push(j);
    }
    if (indent < 0 && stoppedAt > 0) {
      const W = lineWidth(nodes[0], nodes[k]);
      if (W <= available - indent + EPS) {
        feasibleW[0] = W;
        feasibleJ.push(0);
      }
    }
    const sawFeasible = feasibleJ.length > 0;
    // Priced ascending — the order the tie-breaking below was written for.
    for (let f = feasibleJ.length - 1; f >= 0; f--) {
      const j = feasibleJ[f];
      const avail = available - (j === 0 ? indent : 0);
      const W = feasibleW[j];
      let badness = 0;
      if (!isLast) {
        const slack = Math.max(0, avail - W);
        const gaps = gapsIn(nodes[j], nodes[k]);
        const r = ragged ? slack / ragTolerance : slack / (gaps > 0 ? gaps * stretchUnit : measure.spaceWidth);
        badness = Math.min(BADNESS_CAP, 100 * r * r * r);
      }
      let d = (LINE_PENALTY + badness) ** 2;
      if (hyphenated(nodes[k])) d += HYPHEN_DEMERITS;
      if (hyphenated(nodes[k]) && hyphenated(nodes[j])) d += CONSECUTIVE_HYPHEN_DEMERITS;
      if (nodes[k].glyph === false) d += EMERGENCY_DEMERITS;
      if (isLast && k - 1 >= 0 && j !== 0 && gapsIn(nodes[j], nodes[k]) === 0) d += LAST_LINE_ORPHAN_DEMERITS;
      const total = best[j].total + d;
      if (!choice || total < choice.total - 1e-9) choice = { total, prev: j, width: W, avail, overfull: false };
    }
    if (!choice && !sawFeasible) {
      // Nothing fits: take the shortest line from the nearest reachable node — overfull, crushing demerits, but the paragraph composes (the spirit of *the build cannot fail*, C2).
      for (let j = k - 1; j >= 0; j--) {
        if (!best[j]) continue;
        const avail = available - (j === 0 ? indent : 0);
        const W = lineWidth(nodes[j], nodes[k]);
        choice = { total: best[j].total + OVERFULL_DEMERITS + (W - avail) ** 2, prev: j, width: W, avail, overfull: true };
        break;
      }
    }
    best[k] = choice;
  }

  // Read back the chosen chain.
  const chain = [];
  for (let k = last; k > 0; k = best[k].prev) chain.push(k);
  chain.reverse();

  const lines = [];
  let from = 0;
  for (const k of chain) {
    lines.push({ from: nodes[from], to: nodes[k], width: best[k].width, avail: best[k].avail, overfull: best[k].overfull });
    from = k;
  }
  const breaks = chain.slice(0, -1).map((k) => nodes[k]);
  const lastLine = lines[lines.length - 1];
  const fillerPx = Math.max(0, lastLine.avail - lastLine.width);

  return { breaks, lines, lineCount: lines.length, fillerPx };
}
