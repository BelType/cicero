/**
 * The Ledger — the single mutable object, custodian of its own laws (tablet: The Model; architecture: The Ledger).
 *
 * A paginated document is a document plus a ledger of cuts; pages are the intervals between consecutive entries. This module is deliberately DOM-free: positions are flat global word indices (src/positions.js — the streamline round's settling, 2026-08-19), boxes are opaque references, and the laws are testable without a browser.
 *
 * Laws enforced here, at their point of enforcement:
 *   *Flow is forward* (I1): entries append-only, positions non-decreasing. Invalidation, downstream-only, is not a verb here: the resumable run is it (*late truth is an edit*, 2026-10-13).
 *   *Breaks are classified* (I3), the classed-only half: an unclassed cut cannot be written, so `createEntry` refuses it and `append` accepts only entries built there.
 *
 * **The laws are stated over the tree** (*a parallel flow is a fragmentainer*, 2026-10-08; the tablet's *a resume point is a path* (I2) as amended in that round). An entry's resume record is a tree — `ResumeNode`, `src/positions.js`: the main flow's node and, under it, one node per parallel flow, recursively — and `Entry.paths` is its wire form, `flattenResume(tree)`, which `treeOf(paths)` reads back. The root bounds the interval and is the only node *flow is forward* (I1) compares: a flow's node sits behind the cut by construction, so the main position alone can run forward. And **a restarted run rewrites an entry whole**: the driver re-cuts from the page before the page holding the edit and writes each kept entry again, so no node of a flow outlives the cut that made it (`driver.js`, `resume.js`).
 *
 * @packageDocumentation
 */

import type { Address } from './positions.ts';

/** A flat position: the global word index `bases[b] + w` an address projects onto (src/positions.js). A transparent alias — the name is for the hover, nothing is branded. */
export type Pos = number;

/** css-break-3's three classes of break point, plus the position below the make-up order entirely (*the build cannot fail*, C2; *the page edge is not a break point*, C10). */
export type CutClass = 'A' | 'B' | 'C' | 'LAST_RESORT';

/** One resume path — one per live flow (*a resume point is a path*, I2): a node of the resume tree with its `flows` left behind, which is the form an entry stores. */
export type ResumePath = {
  /** The flat projection of `cut`. */
  pos: Pos;
  /** THE ADDRESS — `{ path, word, px }`, src/positions.js. */
  cut: Address;
  /** The deepest straddler, a live pointer whose ancestry is resolved from the path (*straddle-heredity*, C6) rather than stored. Opaque here: this module is DOM-free. */
  box?: unknown;
  /** The geometric remainder of a flow that declares a block size, or of an item the row stretches. */
  remainingPx?: number | null;
  /** The path of the row item this path speaks for; absent on the main flow and on a float. */
  item?: number[];
  /** The class of this flow's own cut, where its own walk chose one (`ResumeNode`'s, src/positions.js). */
  cls?: CutClass;
  /** That cut's account of what it could not satisfy. */
  trace?: object;
};

/** What a cut could not satisfy, by the make-up order's own keys (src/stonehand.js), plus the two positions that lie below the order entirely. */
export type Violates = {
  avoid: boolean;
  /** The orphans + widows shortfall, in lines. */
  ow: number;
  /** The page edge's own cut (*the page edge is not a break point*, C10). */
  edge?: boolean;
  /** The first boundary past the limit, taken with overflow (*the build cannot fail*, C2). */
  overflow?: boolean;
};

/** Adjudication's record — what the cut could not satisfy and by how much, which reading won. The Ledger demands only that it be an object; the members are what `driver.js` writes today, every one optional because the terminal entry carries `terminal` alone. */
export type Adjudication = {
  /** The engine's own reading: the three classes, `R` through a row, `E` the page edge. */
  kind?: 'A' | 'B' | 'C' | 'R' | 'E';
  violates?: Violates;
  /** A Class B cut's line index. */
  k?: number;
  /** The cut's Y in the measured flow. */
  y?: number;
  forced?: boolean;
  /** A page nothing flows onto. */
  blank?: boolean;
  flowsOn?: boolean;
  terminal?: boolean;
  namedSwitch?: boolean;
  overflow?: boolean;
};

/** A classed entry, frozen at every level. Built by {@link createEntry} and by nothing else (*breaks are classified*, I3). */
export type Entry = {
  /** The projection of the entry's resume tree, one path per live flow (*a resume point is a path*, I2): the main flow's first, then every other node in post-order — `flattenResume` and `treeOf`, src/positions.js. `paths[0]` bounds the interval; empty for the terminal entry. */
  paths: ReadonlyArray<Readonly<ResumePath>>;
  cls: CutClass;
  trace: Readonly<Adjudication>;
  /** The conditions of the page this entry closes (*geometry changes only at page boundaries*, C8) — `PageConditions`, src/capture.js. Opaque here: the Ledger copies and freezes it and reads nothing from it. */
  closes: Readonly<object>;
  /** The parity a forced `left`/`right`/`recto`/`verso` break still owes the page that resumes here (css-break-3 §3.1's second break): present on the entry that took the forced break and absent everywhere else, because an entry is the resume state and the build loop reads this one thing off it (*the run resumes from an entry*, build two, 2026-10-08). */
  owes?: 'left' | 'right';
};

const CLASSES = new Set(['A', 'B', 'C', 'LAST_RESORT']);

/** Numeric compare of positions; a missing position (terminal entry, no live flow) sorts after everything. Ordering lives here and nowhere else. The character refinement was built without widening it (*a line inside a word is a break point*, 2026-09-23): a page resuming inside word *w* projects to *w*, *flow is forward* (I1) admits the equal position a second cut inside the same word produces, and the address's own order (`positions.js`' `cutAfter`) is what tells two such cuts apart for *the build cannot fail* (C2). */
export function comparePos(a: Pos|null|undefined, b: Pos|null|undefined): -1|0|1 {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The main flow's resume position — `paths[0]` — or null for a terminal entry (paths: [] — no live flow, the document is closed).
 *
 * This is what *flow is forward* (I1) compares, and the distinction is not bookkeeping. The architecture states why the first path is distinguished at all: *the main flow's path is distinguished for one real reason — it bounds the interval*, where a carried path names a single box. A carried parallel flow sits behind the main path by construction (§2.1: the box was laid out beside the flow, its words stand before the cut in document order), so measuring *flow is forward* (I1) against the earliest of all paths let a carried float stand in for the flow and admitted a main position that ran backward — measured 2026-09-07 on `cases/21-parallel-flows`, where a main flow at 34 was admitted after 93 because a carried float sat at 26, and the driver's check for *the build cannot fail* (C2) threw one page later about a walk that had already been written into the Ledger. The plural that *a resume point is a path* (I2) gave this function was accommodated by a minimum; the minimum was the wrong reading of it.
 */
function mainPos(entry: Entry): Pos|null {
  return entry.paths.length === 0 ? null : entry.paths[0].pos;
}

const CONSTRUCTED: WeakSet<Entry> = new WeakSet<any>();

/**
 * Build a classed Entry. This is the only door: adjudication must leave a trace, a class, and the page conditions it closes — an Entry cannot be constructed unclassed (*breaks are classified*, I3).
 *
 * @param e.paths - one resume path per live flow (*a resume point is a path*, I2); empty for the terminal entry. `cut` is the address — `{ path, word, px }`, src/positions.js — `pos` its flat projection, and `box` the deepest straddler, a live pointer whose ancestry is resolved from the path (*straddle-heredity*, C6) rather than stored.
 * @param e.trace - what the cut could not satisfy and by how much, which reading won — adjudication's record.
 * @param e.closes - the conditions of the page this entry closes (*geometry changes only at page boundaries*, C8).
 * @param e.owes - the parity the page that resumes here still owes; recorded only where there is one.
 * @throws Error — bare and deliberate, as everywhere under `src/`, which may not import BelType's error types: on an unknown class, a path without a finite position or a non-empty address, a missing trace, or missing conditions.
 */
export function createEntry({ paths, cls, trace, closes, owes = null }: { paths: ResumePath[]; cls: CutClass; trace: Adjudication; closes: object; owes?: 'left'|'right'|null; }): Entry {
  if (!CLASSES.has(cls)) throw new Error(`unclassed or unknown cut class: ${String(cls)}`);
  if (!Array.isArray(paths)) throw new Error('paths must be an array (empty only for the terminal entry)');
  for (const p of paths) {
    if (!p || typeof p.pos !== 'number' || !Number.isFinite(p.pos)) throw new Error('every resume path needs a finite numeric position (the global word index)');
    // *A resume point is a path* (I2), checked rather than trusted: a resume point resolves to a path. The address is what a page resumes at and the position is its projection, so an entry carrying one without the other is the shape four rounds of literals grew out of.
    if (!p.cut || !Array.isArray(p.cut.path) || p.cut.path.length === 0 || !p.cut.path.every(( i: number) => Number.isInteger(i) && i >= 0)) {
      throw new Error('every resume path needs an ADDRESS — a non-empty path of source child indices (src/positions.js)');
    }
  }
  if (trace == null || typeof trace !== 'object') throw new Error('adjudication must leave a trace');
  if (closes == null || typeof closes !== 'object') throw new Error('an entry closes a page: conditions required');
  const entry = Object.freeze({
    paths: Object.freeze(paths.map((p) => Object.freeze({ ...p }))),
    cls,
    trace: Object.freeze({ ...trace }),
    closes: Object.freeze({ ...closes }),
    ...(owes ? { owes } : {})
  });
  CONSTRUCTED.add(entry);
  return entry;
}

export class Ledger {
  declare _entries: Entry[];
  constructor() {
    this._entries = [];
  }

  /**
   * Append a classed entry. The main flow's position must not run backward (*flow is forward*, I1); nothing may follow the terminal entry.
   *
   * @throws Error — bare, deliberately: an entry {@link createEntry} did not build, anything after the terminal entry, or a main position that runs backward (*flow is forward*, I1).
   */
  append(entry: Entry) {
    if (!CONSTRUCTED.has(entry)) throw new Error('only entries built by createEntry may be appended (classed-only by construction)');
    const last = this._entries[this._entries.length - 1];
    if (last) {
      const lastPos = mainPos(last);
      if (lastPos == null) throw new Error('the terminal entry closed the document; nothing may follow it (I1)');
      const pos = mainPos(entry);
      if (pos != null && comparePos(pos, lastPos) < 0) throw new Error('entry position runs backward (I1: flow is forward)');
    }
    this._entries.push(entry);
  }

  /** Every entry, in order — a copy, so a caller walking a finished run (the resumable run's prior) cannot append to it. */
  entries() {
    return [...this._entries];
  }

  /**
   * @throws Error — bare, deliberately: no entry at `i`.
   */
  at(i: number): Entry {
    if (i < 0 || i >= this._entries.length) throw new Error(`no entry at ${i}`);
    return this._entries[i];
  }

  /** This *is* counter(pages) (*chrome is resolved, never flowed*, I4): every page closes with exactly one entry. */
  get length() {
    return this._entries.length;
  }
}
