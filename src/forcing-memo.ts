/// <reference lib="dom" />
/**
 * The forcing index's reads, kept across runs (*the forced-break index is kept across runs*, 2026-10-09).
 *
 * `forcingIndexOf` walks every element of the document once per run and asks the browser the same few things of each: nine computed style values, the effective page name, the block children, and the child-index path. The source is never written (*the source document is never written*, C5), so those answers are a function of the element and of the sheets, and an edit replaces one box with a new element object: the new box's whole subtree misses by construction, and every other element's answer stands. This is that memo — `WeakMap`s keyed by the element, kept by the seam beside the previous run's result — and nothing else is kept: the flat arrays, the word positions and the normalisation of the address are rebuilt every run from the new position index, because a word-count change moves every later position and rebuilding them costs about a millisecond. `forcingIndexOf` itself is untouched; the memo wraps the reads it is handed.
 *
 * **What an edit can make stale, and what `settle` forgets** (the survey: `.claude/prior-art/reports/incremental-indexes-2026-10-08.md`). Under sheets that reach no further than an element's own ancestors, the patch contract (`seam/client.js` `patchBox`: the ancestors of the replaced box keep their name, attributes and child count) leaves exactly one thing stale: the block-children list of each ancestor, which names the old box. Two more are forgotten for safety: the child indices of the box's siblings (an inline `position: fixed` on the new box would shift the in-flow indices after it). Where a sheet holds a selector by which a box can change a sibling's style (`+`, `~`, `:nth-child(… of …)` — `capture.js`' `sheetReach` says 1), the whole subtree of the box's parent is forgotten; where one can change an ancestor's (`:has(`, `@container`, an unreadable sheet — 2), nothing is trusted: the memo is emptied and the run reads afresh, as it did before the memo existed. This is Blink's invalidation statement made once as a scan of the sheets, with Blink's fallback — where a selector defeats the reasoning, widen.
 *
 * **The reach is a statement about the sheets and the unit of replacement** (amended 2026-10-25). The paragraph above is `patchBox`'s unit, a box at any depth, and `settle(reach)` without boxes. A host that holds its own pages replaces only whole top-level boxes and reads each replaced box again whole; it settles with the top-level boxes as they stand, `settle(reach, boxes)`, under `capture.js`' `topLevelReach`, and the memo keeps the boxes it was last settled with (`boxes`) to compare. At 0 the replaced and moved boxes are read again and every other part is kept; at 1 every box from the earliest change on (the first place the order differs from the boxes before, or a replaced box's place if earlier) is forgotten too, the earlier ones kept; at 2 the memo is emptied and refused, as under the other unit. Wherever the order moved, the parent's children lists and the boxes' in-flow indices are forgotten.
 *
 * **Why not record the reads dynamically, as comemo does.** Validating a recorded `getComputedStyle` read costs the read, which is what recomputation costs: the bargain comemo needs fails here.
 *
 * **The run-level walks keep their parts here too** (*a resumed run keeps its reads*, 2026-10-22). The position index (`positions.js`' `indexBlock`, a moved block's part stamped with its new number where the parts are laid), the running elements (`driver.js`' `runningBoxes`), the document ops (`document-state.js`' `blockOpsOf`, once without marks and once under the reads' marks), the reads' site search (`reads.js`' `findSites` and `findPageSites`, per box and selector) and the `:has()` answers (`has-words.js`' `askBox`) are each taken per top-level box and kept in one map keyed by the box, which the walks reach through {@link ForcingMemo.keep}; the run's whole view of each is the parts laid end to end, a part's positions offset by its block's base. One door forgets them with the rest: `settle` drops the part of the top-level box that holds each replaced box (or is it, where the run's own edit address names a box edited in place), every part where a top-level box is replaced under a sheet of reach 1, and everything at reach 2; `clear` empties them with the conditions. The `:has()` answer of a top-level box to an argument that opens with `+` or `~` depends on the boxes after it and is asked again every run.
 *
 * **Who must keep the promise.** The host: a box replaced any other way than `patchBox` (which calls {@link ForcingMemo.replaced}) must be reported the same way or the run must ask for a fresh memo. Under the top-level unit, a top-level box whose name or attributes change is a new element, and the box it replaced is reported too. The seam fills the memo only from runs on a presented frame, never from the first run after load, whose realm (the sources are children of `body`, not of `<beltype-root>`) can answer a `body > …` or `:first-child` selector otherwise than later runs do.
 *
 * @see .claude/decisions/cicero/the-forced-break-index-is-kept-across-runs.md
 * @packageDocumentation
 */

/** The computed style properties `forcingIndexOf` and the predicates it calls (`isAbsolutelyPositioned`, `isOutOfFlow`, `isMonolith`, `neverCutInside`, `notYetDivided`) read of a box, and so the whole of a snapshot. `test/forcing-memo.test.js` records the reads of a real walk against this list. */
export const FORCING_STYLE_READS = Object.freeze(['position', 'float', 'display', 'overflowX', 'overflowY', 'columnCount', 'columnWidth', 'breakBefore', 'breakAfter']);

/** The door a run-level walk asks a per-box part through (*a resumed run keeps its reads*, 2026-10-22): `kind` names the walk, `box` is the top-level box the part is of, `read` takes the part, and `still`, where given, says whether a kept part still answers this run's question. {@link ForcingMemo.keep} is the one implementation; a walk handed none reads every box. */
export type Keep = <T>(kind: string, box: object, read: () => T, still?: (value: T) => boolean) => T;

/** A plain copy of the properties in {@link FORCING_STYLE_READS}, in place of the live declaration they were read from. */
export function snapshotOfStyle(st: CSSStyleDeclaration): Record<string,string> {
  const out: Record<string,string> = {};
  for (const name of FORCING_STYLE_READS) out[name] = (st as any)[name];
  return out;
}

export class ForcingMemo {
  /** Lookups answered from the memo, and lookups that read the browser, since the last {@link ForcingMemo.restart}. */
  hits = 0;
  misses = 0;
  /** Whether the console has said, for this memo's life, that a sheet's reach put it out of use. */
  said = false;
  #facts: WeakMap<Element,Record<string,string>> = new WeakMap<any, any>();
  #pageName: WeakMap<Element,string> = new WeakMap<any, any>();
  #children: WeakMap<Element,Element[]> = new WeakMap<any, any>();
  #index: WeakMap<Element,number> = new WeakMap<any, any>();
  #replaced: Element[] = [];
  /** The run-level walks' parts, per top-level box: box → walk → its part (*a resumed run keeps its reads*). */
  #parts: WeakMap<object,Map<string,unknown>> = new WeakMap<any, any>();
  /** Per walk, the boxes whose part was kept and the boxes read, since the last {@link ForcingMemo.settle}. */
  tally: Record<string,{ kept: number; read: number; }> = {};
  /** The top-level boxes of the last settle under the top-level unit, in order. */
  #boxes: Element[] = [];

  /** The top-level boxes the memo was last settled with under the top-level unit, in order, which `capture.js`' `topLevelReach` takes as `before`; empty where it keeps nothing. */
  get boxes() {
    return this.#boxes;
  }

  /** Forget everything: the conditions moved, the run was not a resume, or it threw. */
  clear() {
    this.#facts = new WeakMap<any, any>();
    this.#pageName = new WeakMap<any, any>();
    this.#children = new WeakMap<any, any>();
    this.#index = new WeakMap<any, any>();
    this.#replaced = [];
    this.#parts = new WeakMap<any, any>();
    this.#boxes = [];
  }

  /** Begin a run: the tally starts again. */
  restart() {
    this.hits = 0;
    this.misses = 0;
  }

  /** Record that `el` took the place of another box in the document. The forgetting waits for {@link ForcingMemo.settle}, because how far it reaches is a question about the sheets and the sheets are read when the run begins. */
  replaced(el: Element) {
    this.#replaced.push(el);
  }

  /**
   * Apply the boxes replaced since the last run, under the reach the sheets give for the unit of replacement: without `boxes`, `patchBox`'s, a box at any depth (`capture.js`' `sheetReach`: 0 own ancestors, 1 siblings, 2 anything); with them, a whole top-level box (`topLevelReach`: 0 nothing crosses, 1 the boxes from the earliest change on, 2 anything).
   * @param boxes - the top-level boxes as they stand, the element children of their one parent in order, for a host that replaces only whole top-level boxes.
   * @returns whether the memo may be read from and filled this run.
   */
  settle(reach: 0|1|2, boxes?: ArrayLike<Element>): boolean {
    if (boxes) return this.#settleTopLevel(reach, Array.from(boxes));
    const replaced = this.#replaced;
    this.#replaced = [];
    this.tally = {};
    if (reach >= 2) {
      this.clear();
      return false;
    }
    // The parts are per top-level box, so the box that holds a new one — or the box itself, where the run's own edit address names a box edited in place — is read again whole. A box no kept box holds is a top-level box, and replaced under a sheet that reaches a sibling it may change the next box's style: then every part goes.
    const holders = replaced.map((el) => {
      const chain = [];
      for (let a = el.parentElement; a; a = a.parentElement) if (this.#parts.has(a)) chain.push(a);
      return { el, chain };
    });
    if (reach === 1 && holders.some(({ chain }) => chain.length === 0)) this.#parts = new WeakMap<any, any>();
    for (const { el, chain } of holders) {
      this.#parts.delete(el);
      for (const a of chain) this.#parts.delete(a);
    }
    for (const el of replaced) {
      const parent = el.parentElement;
      for (let a = parent; a; a = a.parentElement) this.#children.delete(a);
      if (!parent) continue;
      for (const sibling of parent.children) this.#index.delete(sibling);
      if (reach === 1) this.#forgetSubtree(parent);
    }
    return true;
  }

  /** {@link ForcingMemo.settle} for the top-level unit. Each replaced box is read again whole, its part and its facts being of a new element or of one that moved; the parent's children lists and the boxes' indices are forgotten wherever the order moved; at reach 1 so is every box from the earliest change on, which is the first place the order differs from the boxes before, or a replaced box's place if earlier (a box the order cannot place counts as the first); at 2 everything, and the memo is refused. */
  #settleTopLevel(reach: 0|1|2, boxes: Element[]) {
    const replaced = this.#replaced;
    const before = this.#boxes;
    this.#replaced = [];
    this.tally = {};
    if (reach >= 2) {
      this.clear();
      this.#boxes = boxes;
      return false;
    }
    this.#boxes = boxes;
    const at = new Map(boxes.map((el, i) => [el, i]));
    const was = new Set(before);
    let first = 0;
    while (first < before.length && first < boxes.length && before[first] === boxes[first]) first++;
    for (const el of replaced) {
      let top: Element|null = el;
      while (top && !at.has(top)) top = top.parentElement;
      // A box an edit took out is placed by the order; any other element no box holds, nowhere.
      if (top) first = Math.min(first, (at.get(top) as number));
      else if (!was.has(el)) first = 0;
      if (top) { this.#parts.delete(top); this.#forgetSubtree(top); }
    }
    if (first < Math.max(before.length, boxes.length)) {
      for (let a = boxes[0]?.parentElement ?? null; a; a = a.parentElement) this.#children.delete(a);
      for (const el of boxes) this.#index.delete(el);
    }
    if (reach === 1) for (let i = first; i < boxes.length; i++) { this.#parts.delete(boxes[i]); this.#forgetSubtree(boxes[i]); }
    return true;
  }

  #forgetSubtree(el: Element) {
    this.#facts.delete(el);
    this.#pageName.delete(el);
    this.#children.delete(el);
    this.#index.delete(el);
    for (const child of el.children) this.#forgetSubtree(child);
  }

  #get<T>(map: WeakMap<Element,T>, el: Element, read: () => T): T {
    let value = map.get(el);
    if (value === undefined) {
      this.misses++;
      map.set(el, (value = read()));
    } else {
      this.hits++;
    }
    return value;
  }

  facts(el: Element, read: () => Record<string,string>) { return this.#get(this.#facts, el, read); }

  pageName(el: Element, read: () => string) { return this.#get(this.#pageName, el, read); }

  blockChildren(el: Element, read: () => Element[]) { return this.#get(this.#children, el, read); }

  /** The element's index among its parent's in-flow children. */
  indexIn(el: Element, read: () => number) { return this.#get(this.#index, el, read); }

  /** A run-level walk's part for one top-level box, kept from an earlier run where the box was not forgotten since and `still` accepts it, and read and kept otherwise. An arrow, so a walk is handed `memo.keep` itself. */
  keep: Keep = (kind, box, read, still) => {
    let mine = this.#parts.get(box);
    if (!mine) this.#parts.set(box, (mine = new Map<any, any>()));
    const count = (this.tally[kind] ??= { kept: 0, read: 0 });
    if (mine.has(kind)) {
      const value = (mine.get(kind) as any);
      if (!still || still(value)) {
        count.kept++;
        return value;
      }
    }
    count.read++;
    const value = read();
    mine.set(kind, value);
    return value;
  };
}
