import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, createEntry, comparePos } from '../src/ledger.ts';
import { flattenResume, treeOf } from '../src/positions.ts';

const conditions = { contentW: 500, contentH: 700, orphans: 2, widows: 2 };
/** A path's ADDRESS (src/positions.js), which `createEntry` requires beside its flat projection: these laws range over the projection, so any well-formed address will do and the block index is made to match the position for readability. */
const at = (pos) => ({ path: [pos], word: null, px: null });
const entry = (pos, cls = 'A', extra = {}) =>
  createEntry({ paths: pos == null ? [] : [{ pos, cut: at(pos), ...extra }], cls, trace: { rung: 0 }, closes: conditions });

test('comparePos is numeric and terminal sorts last', () => {
  assert.equal(comparePos(12, 13), -1);
  assert.equal(comparePos(200, 199), 1);
  assert.equal(comparePos(12, 12), 0);
  assert.equal(comparePos(null, 9999), 1);
  assert.equal(comparePos(0, null), -1);
  assert.equal(comparePos(null, null), 0);
});

test('an unclassed cut cannot be written (I3)', () => {
  assert.throws(() => createEntry({ paths: [{ pos: 0, cut: at(0) }], cls: 'X', trace: {}, closes: conditions }), /unclassed/);
  assert.throws(() => createEntry({ paths: [{ pos: 0, cut: at(0) }], cls: undefined, trace: {}, closes: conditions }), /unclassed/);
});

test('a path needs a finite numeric position — the flat projection is what these laws order by', () => {
  assert.throws(() => createEntry({ paths: [{ pos: [1, 0] }], cls: 'A', trace: {}, closes: conditions }), /numeric position/);
  assert.throws(() => createEntry({ paths: [{ pos: NaN }], cls: 'A', trace: {}, closes: conditions }), /numeric position/);
});

test('and it needs an ADDRESS beside it — I2, checked rather than trusted', () => {
  // *A resume point resolves to a path, never a bare offset into text.* An entry carrying a position and no address is the shape four rounds of literals grew out of, so the door refuses it.
  assert.throws(() => createEntry({ paths: [{ pos: 4 }], cls: 'A', trace: {}, closes: conditions }), /ADDRESS/);
  assert.throws(() => createEntry({ paths: [{ pos: 4, cut: { path: [] } }], cls: 'A', trace: {}, closes: conditions }), /ADDRESS/);
  assert.throws(() => createEntry({ paths: [{ pos: 4, cut: { path: [0, -1] } }], cls: 'A', trace: {}, closes: conditions }), /ADDRESS/);
  assert.doesNotThrow(() => createEntry({ paths: [{ pos: 4, cut: { path: [1, 2], word: 3, px: null } }], cls: 'A', trace: {}, closes: conditions }));
});

test('adjudication must leave a trace and page conditions', () => {
  assert.throws(() => createEntry({ paths: [], cls: 'A', trace: null, closes: conditions }), /trace/);
  assert.throws(() => createEntry({ paths: [], cls: 'A', trace: {}, closes: null }), /conditions/);
});

test('append accepts only createEntry products', () => {
  const l = new Ledger();
  assert.throws(
    () => l.append({ paths: [{ pos: 0, cut: at(0) }], cls: 'A', trace: {}, closes: conditions }),
    /classed-only/
  );
});

test('entries are frozen — decisions are records, not state', () => {
  const e = entry(37, 'B');
  assert.throws(() => {
    'use strict';
    e.cls = 'C';
  });
  assert.throws(() => {
    'use strict';
    e.paths[0].pos = 99;
  });
});

test('append enforces forward flow (I1)', () => {
  const l = new Ledger();
  l.append(entry(10));
  l.append(entry(20, 'B'));
  assert.throws(() => l.append(entry(15)), /forward/);
  assert.equal(l.length, 2);
});

test('equal consecutive positions are legal — a shell taller than a page stands still while its remainder shrinks', () => {
  const l = new Ledger();
  l.append(entry(10));
  l.append(entry(10, 'C'));
  assert.equal(l.length, 2);
});

test('a multi-path entry is admitted on its main path, behind carried flows and all (I2 plural)', () => {
  const l = new Ledger();
  l.append(entry(10));
  const parallel = createEntry({ paths: [{ pos: 30, cut: at(30) }, { pos: 12, cut: at(12) }], cls: 'B', trace: {}, closes: conditions });
  l.append(parallel);
  assert.throws(() => l.append(entry(11)), /forward/);
});

test('I1 is measured on the MAIN path — a carried flow behind it cannot disarm the check', () => {
  const l = new Ledger();
  // `cases/21-parallel-flows`' own numbers: the main flow cut at 93 with a float carried at 26 beside it, and the next page's walk chose a candidate INSIDE that float, at 34.
  l.append(createEntry({ paths: [{ pos: 93, cut: at(93) }, { pos: 26, cut: at(26) }], cls: 'C', trace: {}, closes: conditions }));
  // 34 runs backward from 93. Measuring against the earliest of all paths compared it to the carried float's 26 instead and admitted it — the entry was written, and the driver's C2 check threw a page later about a walk that had already been recorded.
  assert.throws(() => l.append(entry(34)), /forward/);
  assert.equal(l.length, 1);
  // And the main path is the one that binds in the other direction too: a later main position is admitted however far behind its own carried flow sits.
  l.append(createEntry({ paths: [{ pos: 100, cut: at(100) }, { pos: 30, cut: at(30) }], cls: 'A', trace: {}, closes: conditions }));
  assert.equal(l.length, 2);
});

test('nothing may follow the terminal entry (I1)', () => {
  const l = new Ledger();
  l.append(entry(10));
  l.append(entry(null)); // terminal: no live flow, document closed
  assert.throws(() => l.append(entry(50)), /terminal/);
  assert.equal(l.length, 2);
});

test('length is the page count (I4)', () => {
  const l = new Ledger();
  assert.equal(l.length, 0);
  l.append(entry(5));
  l.append(entry(12));
  l.append(entry(null));
  assert.equal(l.length, 3);
  assert.equal(l.at(1).paths[0].pos, 12);
  assert.throws(() => l.at(3), /no entry/);
});

// --- the laws over the resume tree (*a parallel flow is a fragmentainer*, 2026-10-08) ---

/** A node of the resume tree: a flow's place and the flows standing inside its box. */
const node = (pos, flows = [], extra = {}) => ({ pos, cut: at(pos), flows, ...extra });
/** An entry written from a tree, as the driver writes one: `paths` is the tree's wire form. */
const fromTree = (tree) => createEntry({ paths: flattenResume(tree), cls: 'B', trace: {}, closes: conditions });

test('append-only holds over the tree: only the ROOT is compared, however deep a flow sits (I1)', () => {
  const l = new Ledger();
  // The main flow at 93; a float at 26 beside it; a row item at 12 inside the float. Every node of the tree sits behind the root.
  l.append(fromTree(node(93, [node(26, [node(12, [], { item: [3, 0] })])])));
  // A later root is admitted however far behind its nodes sit, and the stored record is still the tree it was written from.
  l.append(fromTree(node(100, [node(30)])));
  assert.deepEqual(treeOf(l.at(0).paths).flows.map((f) => [f.pos, f.flows.map((i) => i.pos)]), [[26, [12]]], 'the entry reads back as the tree it projects');
  // A root that runs backward is refused, whatever its flows: a deep node cannot disarm the check, and cannot satisfy it either.
  assert.throws(() => l.append(fromTree(node(95, [node(120)]))), /forward/);
  assert.equal(l.length, 2);
});
