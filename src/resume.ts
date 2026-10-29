/**
 * The run resumes from an entry — the DOM-free arithmetic (*the run resumes from an entry*, build two, 2026-10-08; .claude/decisions/cicero/the-run-resumes-from-an-entry.md, Decisions one, two and four).
 *
 * An entry closes a page and is the resume state of the next, so recomposition to convergence is three small questions asked of entries and nothing else: which page does an edit dirty and where does the run restart; is the entry just written the one the prior run wrote at some page; and may the answer be believed. The driver asks them and the Ledger answers; this module holds the answers as pure functions, so the laws are tested without a browser.
 *
 * **The key is the address under the run's conditions** (Decision one). In it: every live flow's address — the place in the tree, the word, the character, the pixel extent of a divided box — and the remainder and the row item a carried flow rides with, the cut's class, whether the page began at a forced break, whether it is a page nothing flows onto, the end of the document, and the parity a forcing ahead still owes. Out of it: the flat projection `pos`, the page number, the presentation literals and the trace's measured `y`. Parity is in it only where it can change a cut — a geometry that differs between left and right pages, or an owed parity, which makes the next page blank or not by the side it falls on.
 *
 * @packageDocumentation
 */

import { pathAfter } from './positions.ts';

import type { Entry } from './ledger.ts';
import type { Address } from './positions.ts';

/** One path of an entry, as the key reads it. */
const pathKey = (p: Readonly<Entry['paths'][number]>) => [p.cut.path, p.cut.word ?? null, p.cut.char ?? 0, p.cut.px ? [p.cut.px.remaining, p.cut.px.paint] : null, p.remainingPx ?? null, p.item ?? null];

/**
 * The key of an entry — a string, so two keys compare by `===` and a prior run's keys index in a `Map`.
 *
 * @remarks
 * `y` is out because it is a measurement the cut was chosen from and not a part of the place the next page resumes at; the survey found it byte-stable between runs, but a key that compared it would call a one-pixel float wobble a moved page.
 *
 * @param geometryByParity - whether the document's geometry differs between its left and right pages — computed once per run from the geometry table, not per entry.
 */
export function keyOf(entry: Entry, geometryByParity: boolean): string {
  const t = entry.trace;
  return JSON.stringify([
    entry.paths.map(pathKey),
    entry.cls,
    t.forced === true,
    t.blank === true,
    t.terminal === true,
    t.flowsOn === true,
    entry.owes ?? null,
    geometryByParity || entry.owes ? (entry.closes as { parity?: string }).parity : null
  ]);
}

/** A prior run's keys, indexed: key → the page indices that wrote it, ascending. Several pages share a key only where a blank page repeats a forced one's address, and the key tells those two apart. */
export function priorKeys(entries: ReadonlyArray<Entry>, geometryByParity: boolean): Map<string,number[]> {
  const keys: Map<string,number[]> = new Map<any, any>();
  entries.forEach((e, j) => {
    const k = keyOf(e, geometryByParity);
    const list = keys.get(k);
    if (list) list.push(j);
    else keys.set(k, [j]);
  });
  return keys;
}

/** Whether one path is the other or a prefix of it — the same box, or a box and something inside it. */
const related = (a: number[], b: number[]) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * May an entry's addresses be believed as equal to a prior one's — that is, do they lie clear of the edit?
 *
 * @remarks
 * An address names a place by a leaf-relative word, so an edit that changes how many words a leaf holds changes what every address inside that leaf means: the same index names other text, and the pages after it were laid from text that is not there any more. So the main flow must have left the edited box behind it entirely — a later leaf, a later block — and a carried flow must not stand inside the box or in an ancestor of it that has not reached it. The record's key says an equal address means an equal page; this is the clause it did not state, that it means so only for text the edit did not touch.
 *
 * Every box replaced since the prior run is an edited box, not only the one the run was told to resume at (amended 2026-10-15, beltype#48): a host that patches several boxes and then resumes once per box has, on its first resume, a tree in which the later boxes are new too, and a prior page kept after a convergence that lies between two of them is cut at addresses into boxes that are gone. So the main flow must have left every edited box behind it, and no carried flow may stand inside or above any of them.
 *
 * @param dirtyPaths - the paths of the edited boxes.
 */
export function clearOfEdit(entry: Entry, dirtyPaths: ReadonlyArray<number[]>): boolean {
  if (entry.paths.length === 0) return true;
  const [main, ...carried] = entry.paths;
  return dirtyPaths.every((dirty) => !related(main.cut.path, dirty) && pathAfter(main.cut.path, dirty) && carried.every((c) => !related(c.cut.path, dirty)));
}

/**
 * The page of the prior run that the new entry closes, or -1: the entry's key found among the prior keys at a page no earlier than `atLeast`, and its addresses clear of the edit. The difference between the index the new run stands at and the index returned is the page shift — pages added or removed so far.
 *
 * @param p.keys - the prior run's, from {@link priorKeys}.
 * @param p.entry - the entry the new run just wrote.
 * @param p.dirtyPaths - every box replaced since the prior run.
 * @param p.atLeast - the first prior page that may answer: the run is told how far it must reach before it may stop.
 */
export function converge({ keys, entry, geometryByParity, dirtyPaths, atLeast }: { keys: Map<string,number[]>; entry: Entry; geometryByParity: boolean; dirtyPaths: ReadonlyArray<number[]>; atLeast: number; }): number {
  const found = keys.get(keyOf(entry, geometryByParity));
  if (!found) return -1;
  const j = found.find((x) => x >= atLeast);
  return j !== undefined && clearOfEdit(entry, dirtyPaths) ? j : -1;
}

/**
 * The page whose interval holds an address: the first whose closing entry stands past it, or the page after the last entry where none does. A terminal entry holds everything left.
 *
 * @param after - `positions.js`' `cutAfter`, with whatever projection the caller owns.
 */
export function holderPage(entries: ReadonlyArray<Entry>, address: Pick<Address,'path'>&Partial<Address>, after: (a: any,b: any) => boolean): number {
  const at = { word: null, px: null, ...address };
  const wholeBox = (address.word ?? 0) === 0;
  for (let k = 0; k < entries.length; k++) {
    if (entries[k].paths.length === 0) return k;
    const cut = entries[k].paths[0].cut;
    // A cut inside the edited box is past the box's start, whatever the box holds now: it is an address into the tree the edit replaced, which may name nothing in the tree that is there (a chapter that gained a child), and `after` reads the new tree.
    if ((wholeBox && cut.path.length > address.path.length && address.path.every((n, i) => n === cut.path[i])) || after(cut, at)) return k;
  }
  return entries.length;
}

/** Where the run restarts: one page before the page that holds the edit. A cut reads the boxes it pushed to the next page — a widow rule counts the lines of the paragraph's tail, a keep reads the box it carries over — so an edit standing on page *k* can move page *k−1*'s cut, and a restart at *k* would keep a cut the fresh run does not make. */
export const restartPage = (holder: number): number => Math.max(0, holder - 1);

/**
 * Does a page of the prior run end at a place the document no longer has?
 *
 * @remarks
 * The run restarts from the cut of the page before the restart page, and that cut is an address into the tree the prior run was cut from. An edit that replaced a box takes the addresses inside it along, so a kept page whose cut names a box that is not there is not a page to resume from: read against the new tree it projects to the start of the block, and the run would begin its next page at a place that is nowhere in particular and converge, pages later, onto a Ledger that is not the whole run's. The document's end is an address no box answers to, and is not one that dangles.
 *
 * @param resolves - whether the address names a box in the document as it stands.
 * @param blockCount - the document's top-level blocks.
 */
export const namesNoPlace = (entry: Entry, resolves: (cut: Entry['paths'][number]['cut']) => boolean, blockCount: number): boolean => entry.paths.some((p) => p.cut.path[0] < blockCount && !resolves(p.cut));

/** Which pages a resumed run cut again: `from` through `to`, from 1, with the pages it added or removed (`shift`, negative for removed), whether it converged, and the prior pages after `to` it kept. */
export type Resumed = {
  from: number;
  to: number;
  shift: number;
  converged: boolean;
  kept: number;
};

/**
 * Two resumes, one after the other, as one resume from the first one's prior: a run the reads sent round again resumes from the layout before it (*delivery resumes from the moved page*, 2026-10-21), and the host that asked for the first knows only its own prior.
 *
 * @remarks
 * The pages before the earlier `from` are the prior's in both, and a page after `to` is kept from the prior only if both kept it: the second run's page past its own `to` is the first run's page `shift` earlier, which is the prior's only past the first run's `to`. The pages between the two ranges, where one run kept and the other cut, are counted as cut: one range cannot say two shifts, and a page counted as cut is only presented again.
 *
 * @param a - the first run's, relative to the prior the host handed.
 * @param b - the second run's, relative to the first run's layout.
 * @returns null where either ran whole, since a whole run kept nothing of what came before it.
 */
export function composeResumed(a: Resumed|null, b: Resumed|null): Resumed|null {
  if (!a || !b) return null;
  const converged = a.converged && b.converged;
  return {
    from: Math.min(a.from, b.from),
    to: converged ? Math.max(b.to, a.to + b.shift) : b.to + b.kept,
    shift: a.shift + b.shift,
    converged,
    kept: converged ? Math.min(a.kept, b.kept) : 0
  };
}
