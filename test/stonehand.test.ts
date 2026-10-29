/** Pure-arithmetic corners of the Stonehand — window arithmetic and the monolith predicate run DOM-free. The walk itself is gated by the differential harness, not unit-approximated here. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { classBWindow, isMonolith, owShortfall, byMakeUpOrder, MAKE_UP_ORDER, adjudicate as adjudicateTyped, adjudicateFlow as adjudicateFlowTyped } from '../src/stonehand.ts';
import { byShape, fakeElement, fakeStyle } from './fakes.ts';

const adjudicate = byShape(adjudicateTyped);
const adjudicateFlow = byShape(adjudicateFlowTyped);

/** A DOM-free stand-in for one measured page: the Gauge's report shape plus the computed styles the walk reads from sources. `adjudicate` touches only `el.tagName`, `el.ownerDocument.defaultView.getComputedStyle`, and the report's geometric primitives, so a plain object tree is a faithful subject — the same posture the Ledger's laws are tested under. */
function measuredPage(specs: any, { rows = [] as string[][] } = {}) {
  const DEFAULTS = { breakBefore: 'auto', breakAfter: 'auto', breakInside: 'auto', orphans: '1', widows: '1', position: 'static', float: 'none', overflowX: 'visible', overflowY: 'visible', borderTopWidth: '0px', borderBottomWidth: '0px', paddingTop: '0px', paddingBottom: '0px', boxDecorationBreak: 'slice' };
  const styles = new Map<any, any>();
  const doc = { defaultView: { getComputedStyle: (el: any) => styles.get(el) ?? DEFAULTS } };
  const boxes: any[] = [];
  const linesOf = new Map<any, any>();
  const gapOf = new Map<any, any>();
  const overflowing = new Set<any>();
  const build = (spec: any, parent: any, depth: any) => {
    const el = { tagName: spec.tag ?? 'DIV', ownerDocument: doc };
    styles.set(el, { ...DEFAULTS, ...(spec.style ?? {}) });
    const box = { el, parent, depth, rect: { top: spec.top, bottom: spec.bottom }, inline: false, children: [], blockChildren: [], name: spec.name };
    boxes.push(box);
    if (parent) {
      parent.children.push(box);
      parent.blockChildren.push(box);
    }
    linesOf.set(box, spec.lines ?? []);
    gapOf.set(box, spec.gap ?? null);
    if (spec.overflows) overflowing.add(box);
    for (const child of spec.children ?? []) build(child, box, depth + 1);
    return box;
  };
  for (const s of specs) build(s, null, 0);
  const report = {
    boxes: () => boxes,
    // The Gauge's procession, for a tree with no inline boxes in it: the nearest non-inline ancestor's block children, or the flow's own. The stub draws every box block-level, so the walk up through inline parents the real report performs has nothing to skip — what this stands in for is the ANSWER, which is the Gauge's to give since `word-space.js`' one walker replaced the Stonehand's own filtered box list.
    processionOf: (b: any = null) => (b && b.parent ? b.parent.blockChildren : boxes.filter((x) => !x.parent)),
    // The Gauge's rows, named by the boxes' names: the side-by-side siblings a box stands among, or null.
    rowOf: (b: any) => {
      const names = rows.find((r) => r.includes(b.name));
      return names ? names.map((n: any) => boxes.find((x) => x.name === n)) : null;
    },
    linesOf: (b: any) => linesOf.get(b) ?? [],
    wordsOf: () => [],
    endGapOf: (b: any) => gapOf.get(b) ?? null,
    // The Gauge's bound on a line stack without measuring it: the box's bottom, or infinity where its content overflows (`spec.overflows`).
    reachOf: (b: any) => (overflowing.has(b) ? Infinity : b.rect.bottom),
    gapAt: () => 0
  };
  return { report, sourceOf: (el: any) => el, boxes };
}

/** Line boxes at the given tops, one height. */
const linesAt = (tops: any, h = 16) => tops.map((t: any) => ({ top: t, bottom: t + h, rectTop: t }));

test('class B window is [orphans-1, T-widows-1] in line indices', () => {
  assert.deepEqual(classBWindow(10, 2, 2), [1, 7]); // cut after lines 2..8 (1-based): 2 lines stay, 2 lines go
  assert.deepEqual(classBWindow(4, 2, 2), [1, 1]); // exactly one legal cut
  assert.equal(classBWindow(3, 2, 2), null); // T < orphans + widows: empty window
  assert.deepEqual(classBWindow(2, 1, 1), [0, 0]); // minimal stack, minimal constraints
  assert.equal(classBWindow(1, 1, 1), null); // a single line admits no B cut
  assert.deepEqual(classBWindow(6, 0, 0), [0, 4], 'zero clamps to one line per side — a cut always leaves a line on each side');
});

test('the monolith predicate: replaced elements and true scroll containers; hidden/clip fragment (may-zone, answered by the differential against Chromium print)', () => {
  // The shape a DOM element answers with: an HTML tag name in capitals, its local name in lower case, and its namespace — the predicate reads the last two.
  const el = (tag: any) => fakeElement({ tagName: tag, localName: tag.toLowerCase(), namespaceURI: 'http://www.w3.org/1999/xhtml' });
  const visible = { overflowY: 'visible', overflowX: 'visible' };
  assert.equal(isMonolith(el('IMG'), fakeStyle(visible)), true);
  assert.equal(isMonolith(el('CANVAS'), fakeStyle(visible)), true);
  assert.equal(isMonolith(el('DIV'), fakeStyle(visible)), false);
  assert.equal(isMonolith(el('DIV'), fakeStyle({ overflowY: 'scroll', overflowX: 'visible' })), true);
  assert.equal(isMonolith(el('DIV'), fakeStyle({ overflowY: 'visible', overflowX: 'auto' })), true);
  assert.equal(isMonolith(el('DIV'), fakeStyle({ overflowY: 'hidden', overflowX: 'visible' })), false, 'Chromium print slices overflow:hidden — observed, adopted');
  assert.equal(isMonolith(el('DIV'), fakeStyle({ overflowY: 'clip', overflowX: 'clip' })), false);
  assert.equal(isMonolith(el('P'), fakeStyle(visible)), false);
});

test('a block-level drawing is a monolith, read by local name and namespace, never by tagName (case 70)', () => {
  const visible = { overflowY: 'visible', overflowX: 'visible' };
  const SVG = 'http://www.w3.org/2000/svg';
  // An inline <svg> in an HTML document reports `svg` for both names (Chromium 153, measured); a list compared against tagName in capitals never matched it.
  assert.equal(isMonolith(fakeElement({ tagName: 'svg', localName: 'svg', namespaceURI: SVG }), fakeStyle(visible)), true);
  assert.equal(isMonolith(fakeElement({ tagName: 'text', localName: 'text', namespaceURI: SVG }), fakeStyle(visible)), true, 'every element of the drawing is inside the atom, and is one with it');
  assert.equal(isMonolith(fakeElement({ tagName: 'math', localName: 'math', namespaceURI: 'http://www.w3.org/1998/Math/MathML' }), fakeStyle(visible)), true);
  assert.equal(isMonolith(fakeElement({ tagName: 'VIDEO', localName: 'video', namespaceURI: 'http://www.w3.org/1999/xhtml' }), fakeStyle(visible)), true);
  assert.equal(isMonolith(fakeElement({ tagName: 'SVG', localName: 'svg-like', namespaceURI: 'http://www.w3.org/1999/xhtml' }), fakeStyle(visible)), false, 'a capitalised tagName is not what is asked');
});

test('the make-up order names its three keys, in the order things yield (I3)', () => {
  assert.deepEqual(MAKE_UP_ORDER, ['avoid', 'orphans-widows', 'content']);
});

test('the orphans/widows shortfall is zero exactly inside the window, and exact outside it', () => {
  // T=10, orphans 2, widows 2 -> window [1, 7] in line indices.
  for (let k = 1; k <= 7; k++) assert.equal(owShortfall(k, 10, 2, 2), 0, `k=${k} is inside the window`);
  assert.equal(owShortfall(0, 10, 2, 2), 1, 'one line before the cut, orphans wants two');
  assert.equal(owShortfall(8, 10, 2, 2), 1, 'one line after the cut, widows wants two');
  // Boundary exactness: k+1 === orphans and T-k-1 === widows are both clean, one line further is not.
  assert.equal(owShortfall(3, 12, 4, 4), 0, 'k+1 === orphans is clean');
  assert.equal(owShortfall(2, 12, 4, 4), 1, 'one short of orphans costs exactly one');
  assert.equal(owShortfall(7, 12, 4, 4), 0, 'T-k-1 === widows is clean');
  assert.equal(owShortfall(8, 12, 4, 4), 1, 'one short of widows costs exactly one');
  // The empty window (T < orphans + widows): no cut is clean, and the cheapest is not a point but a
  // PLATEAU — every position that splits the deficit evenly costs the same. So the shortfall alone
  // does not choose; C3 chooses within the plateau, and takes its furthest member. That is exactly
  // what Chromium was measured doing when cornered (P24's third cell: T=20, orphans=widows=12 on a
  // 14-line page, cut after 12 lines — the plateau's last member, not the furthest fitting line).
  assert.equal(classBWindow(20, 12, 12), null);
  const costs = Array.from({ length: 19 }, (_, k) => owShortfall(k, 20, 12, 12));
  const min = Math.min(...costs);
  assert.ok(min > 0, 'every cut in an impossible stack costs something');
  assert.equal(min, 4, 'the deficit is 4 lines however it is split');
  assert.deepEqual(
    costs.flatMap((cost, k) => (cost === min ? [k] : [])),
    [7, 8, 9, 10, 11],
    'the cheapest cuts form a plateau'
  );
  assert.deepEqual(
    [...costs.flatMap((cost, k) => (cost === min ? [{ avoid: 1, ow: cost, y: k, docIndex: 0 }] : []))].sort(byMakeUpOrder)[0].y,
    11,
    'C3 breaks the plateau toward the furthest — cut after exactly `orphans` lines'
  );
  // Zero clamps to one, as the window does.
  assert.equal(owShortfall(0, 2, 0, 0), 0);
});

test('the make-up order: avoid dominates the shortfall, the shortfall dominates content (I3, C3)', () => {
  const c = (avoid: any, ow: any, y: any, docIndex = 0) => ({ avoid, ow, y, docIndex });
  const best = (...cs: any[]) => [...cs].sort(byMakeUpOrder)[0];

  // A clean candidate outranks any violating one, however much content the violator would keep.
  assert.deepEqual(best(c(0, 0, 10), c(1, 0, 900)), c(0, 0, 10));
  assert.deepEqual(best(c(0, 0, 10), c(0, 1, 900)), c(0, 0, 10));

  // Lexicographic, not additive: no shortfall, however large, is as bad as violating an avoid.
  assert.deepEqual(best(c(1, 0, 900), c(0, 999, 10)), c(0, 999, 10), 'rule 3 yields before the avoids (P20)');

  // Among candidates equally bad, the smaller shortfall wins — a yielded constraint still pulls.
  assert.deepEqual(best(c(1, 5, 900), c(1, 1, 10)), c(1, 1, 10), 'this is the seed-88 case in miniature');

  // Only when violation is equal does C3 speak, and then it takes the furthest.
  assert.deepEqual(best(c(0, 0, 10), c(0, 0, 900)), c(0, 0, 900));
  assert.deepEqual(best(c(1, 2, 10), c(1, 2, 900)), c(1, 2, 900));

  // Coincident boundaries resolve by flow position descending, so zero-height boxes fall on the earlier side.
  assert.deepEqual(best(c(0, 0, 100, 3), c(0, 0, 100, 7)), c(0, 0, 100, 7));

  // The order is total: sorting is stable under permutation of the same set.
  const set = [c(1, 3, 50), c(0, 0, 10), c(0, 2, 80), c(1, 0, 900)];
  const forward = [...set].sort(byMakeUpOrder);
  const backward = [...set].reverse().sort(byMakeUpOrder);
  assert.deepEqual(forward, backward);
});

test('an impossible line stack moves whole — css-break-3 §3.3 and §4.5, and no branch anywhere says so', () => {
  const c = (avoid: any, ow: any, y: any, docIndex = 0) => ({ avoid, ow, y, docIndex });
  const best = (...cs: any[]) => [...cs].sort(byMakeUpOrder)[0];
  // The candidate set a walk produces for a block whose stack cannot satisfy rule 3: the Class A
  // boundary before it (separates no lines, so shortfall zero) and every interior Class B cut.
  const stack = (T: any, orphans: any, widows: any) => ({
    boundary: c(0, 0, 100),
    interior: Array.from({ length: T - 1 }, (_, k) => c(0, owShortfall(k, T, orphans, widows), 200 + k))
  });

  // §3.3, normative and explicit: "If a block contains fewer lines than the value of widows or
  // orphans, the rule simply becomes that all lines in the block must be kept together." T=3
  // against widows 4 — differential seed 89's own numbers.
  {
    const [T, orphans, widows] = [3, 1, 4];
    assert.ok(T < Math.max(orphans, widows), '§3.3 applies literally');
    assert.equal(classBWindow(T, orphans, widows), null, 'no interior cut is clean');
    const { boundary, interior } = stack(T, orphans, widows);
    assert.ok(interior.every((x) => x.ow > 0), 'every interior candidate falls short');
    assert.deepEqual(best(boundary, ...interior), boundary, 'the block is kept together');
  }

  // The range §3.3 does not name, which §4.5's second worked example settles by demonstration
  // (orphans 10, widows 20, 8 lines of room): "it must NOT be split (that would violate the
  // orphans constraint), so it must move as a block to the next page" — a retreat, not a dropped
  // rule 3. T=7 against orphans 4 and widows 4 is differential seed 64.
  {
    const [T, orphans, widows] = [7, 4, 4];
    assert.ok(Math.max(orphans, widows) <= T && T < orphans + widows, 'impossible, but outside §3.3 literal reach');
    const { boundary, interior } = stack(T, orphans, widows);
    assert.deepEqual(best(boundary, ...interior), boundary, 'the block still moves whole');
    // Chromium cuts at exactly orphans here instead (P25; six seeds) — it drops rule 3 per
    // fragmentainer where §4.4 licenses the drop only when nothing prevents overflow. Ours is the
    // conforming side, so this assertion is a conformance pin, not a preference.
    assert.ok(best(boundary, ...interior) !== interior[orphans - 1]);
  }

  // And the contrast that proves the boundary's zero is doing the work: cornered at a page top,
  // with no boundary candidate to be had, the same order cuts at exactly orphans — which is where
  // the drop IS licensed, and where we and Chromium agree (P18C's nine cells, P24's third).
  {
    const [T, orphans, widows] = [7, 4, 4];
    const { interior } = stack(T, orphans, widows);
    assert.equal(best(...interior).y - 200 + 1, orphans, 'exactly orphans lines stay on the page');
  }
});

/** §2.1 — a parallel flow contributes geometry and nothing else (tablet, The Flows). Three readings, each a defect measured on `cases/21-parallel-flows` before the round of 2026-09-07: the float's interior offered candidates, an in-flow box's Class A boundary was priced at the float's bottom, and the page edge named the float as the box it was slicing. */
test("a float offers no candidate from its interior — §2.1, the tablet's The Flows", () => {
  // A 370px rail beside two slabs in a 100px page area. The rail's first paragraph has an end gap crossing the limit, so the C-gap rule would put a candidate at exactly 100 — the furthest position on the page, and the winner under C3 if the interior were offered at all.
  const { report, sourceOf } = measuredPage([
    { name: 'h1', top: 0, bottom: 20, lines: linesAt([0]) },
    {
      name: 'rail',
      top: 30,
      bottom: 400,
      style: { float: 'left' },
      children: [
        { name: 'rail-p1', top: 34, bottom: 300, lines: linesAt([34, 50]), gap: { base: 66, bottom: 300 } },
        { name: 'rail-p2', top: 310, bottom: 396, lines: linesAt([310, 326]), gap: { base: 342, bottom: 396 } }
      ]
    },
    { name: 'slab1', top: 30, bottom: 80, lines: linesAt([30, 46]) },
    { name: 'slab2', top: 90, bottom: 140, lines: linesAt([90, 106]) }
  ]);
  const v = adjudicate({ report, sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(v.box.name, 'slab2', 'the cut is in the main flow, not inside the rail');
  assert.equal(v.kind, 'A');
  // And the position is the previous IN-FLOW sibling's bottom border edge. The rail is slab2's neighbour in the sense §4.1 means — the pair whose keeps bind — but its own bottom, 400, is not a place in the procession the cuts divide.
  assert.equal(v.y, 80, "priced at slab1's bottom, not at the rail's");
});

test("an in-flow box's Class A boundary is priced at the previous IN-FLOW sibling — §2.1 and §5.2", () => {
  // Nothing but the boundary before the first slab fits: the slab has one line and no gap, and the rail is 370px tall. Priced at the rail's bottom that boundary is off the page, and the only thing left is the page edge — which is how a whole flow used to end up behind a float.
  const { report, sourceOf } = measuredPage([
    { name: 'h1', top: 0, bottom: 20, lines: linesAt([0]) },
    { name: 'rail', top: 30, bottom: 400, style: { float: 'left' } },
    { name: 'slab1', top: 30, bottom: 95, lines: linesAt([30]) }
  ]);
  const v = adjudicate({ report, sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(v.cls, 'A');
  assert.equal(v.y, 20, "the page closes at the heading's bottom border edge");
  assert.equal(v.box.name, 'slab1');
});

test('the page edge never names a float as the box it slices — C10 versus The Flows', () => {
  // A float alone, taller than the page. C10's painted shell is for a box whose remainder is a picture; a parallel flow's remainder must be LIVE, and the driver carries it. So the walk offers nothing and says so, rather than handing the same box to the wrong mechanism.
  const { report, sourceOf } = measuredPage([{ name: 'rail', top: 0, bottom: 400, style: { float: 'left' } }]);
  assert.equal(adjudicate({ report, sourceOf, pageStart: 0, contentHeight: 100 }), null);
  // The control: the same geometry IN FLOW is sliced at the edge, which is what makes this a rule about parallel flows rather than about tall boxes.
  const inFlow = measuredPage([{ name: 'slab', top: 0, bottom: 400 }]);
  const v = adjudicate({ report: inFlow.report, sourceOf: inFlow.sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(v.cls, 'LAST_RESORT');
  assert.equal(v.kind, 'E');
  assert.equal(v.box.name, 'slab');
});

test("§5.3's *leaving room*: a cut inside a cloned box is charged its block-end border and padding", () => {
  // A box of five 20px lines-as-children inside a 100px page, with a 4px border and 10px padding it clones onto every fragment. Under `slice` the boundary before the fifth child fits at y 84; under `clone` the fragment must also carry 14px of border and padding at its own block end, so 84 + 14 overflows and the cut retreats one child.
  const kids = [0, 1, 2, 3, 4].map((i) => ({ name: `k${i}`, top: 14 + i * 20, bottom: 34 + i * 20, lines: linesAt([14 + i * 20], 20) }));
  const box = (decoration: any) => ({
    name: 'box',
    top: 0,
    bottom: 128,
    style: { borderTopWidth: '4px', borderBottomWidth: '4px', paddingTop: '10px', paddingBottom: '10px', boxDecorationBreak: decoration },
    children: kids.map((k) => ({ ...k }))
  });
  const sliced = measuredPage([box('slice')]);
  const a = adjudicate({ report: sliced.report, sourceOf: sliced.sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(a.cls, 'A');
  assert.equal(a.y, 94, 'slice: the boundary before the fifth child, at the fourth child\'s bottom border edge');

  const cloned = measuredPage([box('clone')]);
  const b = adjudicate({ report: cloned.report, sourceOf: cloned.sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(b.cls, 'A');
  assert.equal(b.y, 74, 'clone: 74 + 14 fits where 94 + 14 does not — the charge is the container\'s, read one level up from the boundary');
});

test('the cloned charge is the ancestors the cut BREAKS, never the box that moves whole', () => {
  // The boundary before `k1` breaks the container and not `k1`, so `k1`'s own cloned decoration is not charged: it goes to the next page entire, where its own layout carries it.
  const { report, sourceOf } = measuredPage([
    {
      name: 'plain',
      top: 0,
      bottom: 90,
      children: [
        { name: 'k0', top: 0, bottom: 40, lines: linesAt([0], 20) },
        { name: 'k1', top: 40, bottom: 90, style: { borderBottomWidth: '25px', paddingBottom: '25px', boxDecorationBreak: 'clone' }, lines: linesAt([40], 20) }
      ]
    }
  ]);
  const v = adjudicate({ report, sourceOf, pageStart: 0, contentHeight: 60 });
  assert.equal(v.y, 40, "k1's own 50px of cloned decoration is not charged to a boundary that hands it over whole");
  assert.equal(v.box.name, 'k1');
});

test('the walk stops at the edge: a box below the limit offers its boundary and is never asked for its lines', () => {
  // A 90px paragraph on a 100px page, then two paragraphs far below it. Asked of every box, the walk measures all three line stacks; stopped at the edge, the third is never reached and the second offers only the boundary before it (*the page asks the index*).
  const specs = [
    { name: 'p1', top: 0, bottom: 90, lines: linesAt([0, 16, 32, 48, 64]) },
    { name: 'p2', top: 5000, bottom: 5032, lines: linesAt([5000, 5016]), gap: { base: 5032, bottom: 5040 } },
    { name: 'p3', top: 6000, bottom: 6032, lines: linesAt([6000, 6016]) }
  ];
  const measured = measuredPage(specs);
  const before = adjudicate({ report: measured.report, sourceOf: measured.sourceOf, pageStart: 0, contentHeight: 100 });
  const guarded = measuredPage(specs);
  const far = new Set(guarded.boxes.filter((b) => b.rect.top > 100));
  const { linesOf, endGapOf } = guarded.report;
  guarded.report.linesOf = (b) => { if (far.has(b)) throw new Error(`the walk read the lines of ${b.name}, below the edge`); return linesOf(b); };
  guarded.report.endGapOf = (b) => { if (far.has(b)) throw new Error(`the walk read the end gap of ${b.name}, below the edge`); return endGapOf(b); };
  const after = adjudicate({ report: guarded.report, sourceOf: guarded.sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(after.box.name, 'p2', 'the boundary before the first box below the edge is still offered, and it is the furthest that fits');
  assert.deepEqual({ ...after, box: after.box.name }, { ...before, box: before.box.name });
});

/** *A parallel flow is a fragmentainer* (2026-10-08): the candidate collection is a function of a procession, a limit and a start, run over a row item's own subtree with the row's height as its limit, and the row is priced by what its items' own verdicts cost. Pure arithmetic over injected providers; the cases (91, 95, 98, 99) are the proof against Chromium. */
const cell = (name: any, top: any, bottom: any, children: any, style: any = {}) => ({ name, top, bottom, style, children });
const para = (name: any, top: any, tops: any, h = 16, style: any = {}, extra: any = {}) => ({ name, top, bottom: top + tops.length * h, style, lines: linesAt(tops, h), ...extra });

test("a flow's verdict at a height is the best cut its OWN procession offers at or above it — an avoid inside it is spent first (case 95)", () => {
  // A cell of a paragraph (2 lines, 0–32) and a kept paragraph (4 lines, 32–96), cut at 70: the lines of the kept paragraph standing above it are legal cuts only by yielding the avoid, and the boundary before it, at 32, is clean.
  const { report, sourceOf, boxes } = measuredPage([
    cell('td', 0, 96, [para('p1', 0, [0, 16]), para('keep', 32, [32, 48, 64, 80], 16, { breakInside: 'avoid' })])
  ]);
  const v = adjudicateFlow({ report, sourceOf, root: boxes[0], limit: 70 });
  assert.equal(v.kind, 'A');
  assert.equal(v.box.name, 'keep');
  assert.equal(v.y, 32);
  assert.deepEqual(v.violates, { avoid: false, ow: 0 });
});

test("a flow's constraints are its own: nothing outside the root reaches in (C4)", () => {
  // The same cell inside a container that forbids breaking inside it. The container is outside the root, so the cell's cut is as free as it was.
  const { report, sourceOf, boxes } = measuredPage([
    { name: 'outer', top: 0, bottom: 96, style: { breakInside: 'avoid' }, children: [cell('td', 0, 96, [para('p1', 0, [0, 16, 32, 48, 64, 80])])] }
  ]);
  const td = boxes.find((b) => b.name === 'td');
  const v = adjudicateFlow({ report, sourceOf, root: td, limit: 70 });
  assert.equal(v.kind, 'B');
  assert.equal(v.violates.avoid, false, "the container's avoid does not cross the wall");
  assert.equal(v.y, 64);
});

test('a row is cut at the height its items each divide by their own verdicts — and a content-bearing item that shows nothing withdraws the offer (case 91)', () => {
  const page = (secondCellLine: any) =>
    measuredPage(
      [
        para('p0', 0, [0], 20),
        { name: 'tr', top: 20, bottom: 90, children: [cell('c1', 20, 90, [], {}), cell('c2', 20, 90, [], {})] }
      ].map((spec: any) => (spec.name === 'tr' ? { ...spec, children: [{ ...spec.children[0], lines: linesAt([20, 36, 52, 68], 16) }, { ...spec.children[1], lines: secondCellLine }] } : spec)),
      { rows: [['c1', 'c2']] }
    );
  // Both cells have a line above the foot at 40: the first is divided after its first line (bottom 36), the second has shown its one line (bottom 36) and is done.
  const a = page(linesAt([20], 16));
  const r = adjudicate({ report: a.report, sourceOf: a.sourceOf, pageStart: 0, contentHeight: 40 });
  assert.equal(r.kind, 'R');
  assert.deepEqual(r.items.map((i: any) => i.state), ['divided', 'done']);
  assert.equal(r.items[0].verdict.kind, 'B');
  assert.equal(r.items[0].verdict.y, 36);
  // The second cell's one line is 30px tall and crosses the foot: it has content and shows none of it above, so the row is not divided there. The boundary before the row remains.
  const b = page(linesAt([20], 30));
  const w = adjudicate({ report: b.report, sourceOf: b.sourceOf, pageStart: 0, contentHeight: 40 });
  assert.equal(w.kind, 'A');
  assert.equal(w.box.name, 'tr');
  assert.equal(w.y, 20);
});

test("an item whose content begins below the height resumes whole — the break falls in the gap above it, and the row is still divided (case 93)", () => {
  const { report, sourceOf } = measuredPage(
    [
      para('p0', 0, [0], 20),
      { name: 'tr', top: 20, bottom: 120, children: [{ ...cell('c1', 20, 120, []), lines: linesAt([20, 36, 52, 68], 16) }, { ...cell('c2', 20, 120, []), lines: linesAt([84], 16) }] }
    ],
    { rows: [['c1', 'c2']] }
  );
  const v = adjudicate({ report, sourceOf, pageStart: 0, contentHeight: 60 });
  assert.equal(v.kind, 'R');
  assert.deepEqual(v.items.map((i: any) => i.state), ['divided', 'below']);
});

test("a row's shortfall is the SUM of its items' verdicts — orphans and widows and avoids, inside blocks as well as lines", () => {
  // A row at the top of the page (no boundary before it), each cell one paragraph of four lines with orphans and widows 2, the foot at 24 leaving one line above it: each item's best cut is short by one, and the row's offer by two. The second cell's paragraph is kept as well, which the row spends as an avoid.
  const style = { orphans: '2', widows: '2' };
  const { report, sourceOf } = measuredPage(
    [{ name: 'tr', top: 0, bottom: 64, children: [cell('c1', 0, 64, [para('a', 0, [0, 16, 32, 48], 16, style)], style), cell('c2', 0, 64, [para('b', 0, [0, 16, 32, 48], 16, { ...style, breakInside: 'avoid' })], style)] }],
    { rows: [['c1', 'c2']] }
  );
  const v = adjudicate({ report, sourceOf, pageStart: 0, contentHeight: 24 });
  assert.equal(v.kind, 'R');
  assert.deepEqual(v.items.map((i: any) => i.verdict.violates.ow), [1, 1]);
  assert.deepEqual(v.violates, { avoid: true, ow: 2 });
});

test("a forced break inside an item is the item's verdict and crosses the wall as nothing but the row's cut (P37c; case 98)", () => {
  // The first cell ends at a forced break at 40; the second is ten lines that fit above the foot. The row lies wholly above the foot and is offered for the forced break alone, and only when the forced breaks are being read.
  const specs = [
    { name: 'tr', top: 0, bottom: 200, children: [cell('c1', 0, 80, [para('a0', 0, [0, 16], 20, { breakAfter: 'page' }), para('a1', 40, [40, 56], 20)]), { ...cell('c2', 0, 200, []), lines: linesAt([0, 20, 40, 60, 80], 20) }] }
  ];
  const off = measuredPage(specs, { rows: [['c1', 'c2']] });
  assert.equal(adjudicate({ report: off.report, sourceOf: off.sourceOf, pageStart: 0, contentHeight: 260 }), null, 'unread, the row fits and nothing is cut');
  const on = measuredPage(specs, { rows: [['c1', 'c2']] });
  const v = adjudicate({ report: on.report, sourceOf: on.sourceOf, pageStart: 0, contentHeight: 260, forcing: true });
  assert.equal(v.kind, 'R');
  assert.equal(v.forced, true);
  assert.deepEqual(v.items.map((i: any) => i.state), ['divided', 'above']);
  assert.equal(v.items[0].verdict.box.name, 'a1');
  assert.equal(v.items[0].verdict.y, 40, "the first cell's fragment ends where the forced break stands");
  assert.equal(v.y, 260, 'the row is cut at the page height, not at the forced break: the neighbour is divided at the foot by its own verdict');
});

test("a monolith the height crosses is sliced by the edge when nothing in its flow fits, and the row that holds it ranks below every cut that does (C10)", () => {
  // A cell opening with a 300px picture, a row at the top of a 100px page: no candidate fits in the cell, so its verdict is the edge's own through the picture. With a boundary before the row available, the row is not cut through it.
  const picture = { name: 'img', top: 0, bottom: 300, style: { overflowY: 'auto' } };
  const top = measuredPage([{ name: 'tr', top: 0, bottom: 320, children: [cell('c1', 0, 320, [picture, para('a1', 300, [300, 316])]), { ...cell('c2', 0, 40, []), lines: linesAt([0, 16], 16) }] }], { rows: [['c1', 'c2']] });
  const v = adjudicate({ report: top.report, sourceOf: top.sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(v.kind, 'R');
  assert.equal(v.cls, 'LAST_RESORT');
  assert.equal(v.items[0].verdict.kind, 'E');
  assert.equal(v.items[0].verdict.box.name, 'img');
  const mid = measuredPage([para('p0', 0, [0], 20), { name: 'tr', top: 20, bottom: 340, children: [cell('c1', 20, 340, [{ ...picture, top: 20, bottom: 320 }, para('a1', 320, [320, 336])]), { ...cell('c2', 20, 60, []), lines: linesAt([20, 36], 16) }] }], { rows: [['c1', 'c2']] });
  const w = adjudicate({ report: mid.report, sourceOf: mid.sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(w.kind, 'A', 'a clean boundary before the row outranks slicing the picture inside it');
  assert.equal(w.box.name, 'tr');
});

/** *The break search is cheaper* (2026-10-12): the collection measures a box's lines only where they can still reach the lowest clean reading that fits, `y*`. A reading of a box that cannot is strictly worse than the one at `y*` on the make-up order's third key, so the verdict must be the one the collection that measures everything gives. Each case runs both, the second by a report whose `reachOf` says every box may reach anywhere. */
const keyOf = (v: any) => v && { kind: v.kind, box: v.box?.name, y: v.y, k: v.k, T: v.T, cls: v.cls, violates: v.violates };
/** The boxes whose line stacks the walk asked for, by name. */
function asking(measured: any) {
  const asked = new Set<any>();
  const linesOf = measured.report.linesOf;
  measured.report.linesOf = (b: any) => (asked.add(b.name), linesOf(b));
  return asked;
}
const fullOf = (measured: any) => ({ ...measured.report, reachOf: () => Infinity });
/** The verdict with the second phase pruning, the verdict without, and the stacks each measured. */
function bothWays(specs: any, contentHeight: any, opts: any = {}, rows: string[][] = []) {
  const a = measuredPage(specs, { rows });
  const askedA = asking(a);
  const pruned = adjudicate({ report: a.report, sourceOf: a.sourceOf, pageStart: 0, contentHeight, ...opts });
  const b = measuredPage(specs, { rows });
  const askedB = asking(b);
  const full = adjudicate({ report: fullOf(b), sourceOf: b.sourceOf, pageStart: 0, contentHeight, ...opts });
  assert.deepEqual(keyOf(pruned), keyOf(full), 'the cut is the cut the collection that measures everything makes');
  return { pruned, askedA, askedB };
}

test('the second phase measures only the line stacks that can still reach the lowest clean reading', () => {
  // Five paragraphs of four lines and a long one crossing the foot: the boundary before the long one, at 256, is clean and fits, so the stacks standing wholly above it offer only readings below it and are never asked.
  const specs = [para('p1', 0, [0, 16, 32, 48]), para('p2', 64, [64, 80, 96, 112]), para('p3', 128, [128, 144, 160, 176]), para('p4', 192, [192, 208, 224, 240]), para('p5', 256, [256, 272, 288, 304, 320, 336, 352, 368])];
  const { pruned, askedA, askedB } = bothWays(specs, 300);
  assert.equal(pruned.kind, 'B', 'the long paragraph is cut between its lines: that is the furthest clean reading');
  assert.equal(pruned.box.name, 'p5');
  assert.deepEqual([...askedA].sort(), ['p4', 'p5'], 'p4 ends exactly at the floor, which a strict test keeps; p1 to p3 are skipped');
  assert.deepEqual([...askedB].sort(), ['p1', 'p2', 'p3', 'p4', 'p5'], 'the collection that measures everything asks them all');
});

test('with no clean reading that fits, nothing is skipped', () => {
  // Every boundary is kept (break-before: avoid on each box), so the readings that need no lines are all unclean and there is no floor: every stack is measured, as before.
  const keep = { breakBefore: 'avoid' };
  const specs = [para('p1', 0, [0, 16, 32, 48], 16, keep), para('p2', 64, [64, 80, 96, 112], 16, keep), para('p3', 128, [128, 144, 160, 176], 16, keep)];
  const { askedA } = bothWays(specs, 150);
  assert.deepEqual([...askedA].sort(), ['p1', 'p2', 'p3']);
});

test("a box whose content overflows it is measured whatever its bottom says — lines below a box's bottom can win (the Gauge's reachOf)", () => {
  // A 10px-tall paragraph whose lines (18px pitch) run on to 112, then boxes below. The boundary before the last box, at 90, is clean; a line of the overflowing paragraph ends at 94, which is lower, clean and fits the 100px page. Bounded by its border box the paragraph would be skipped and the cut would be 90; the Gauge says it overflows, and the cut is the line.
  const p = (extra: any) => para('p1', 40, [40, 58, 76, 94], 18, {}, { bottom: 50, ...extra });
  const specs = (extra: any) => [para('p0', 0, [0, 16], 20), p(extra), para('p2', 50, [50, 66], 20), para('p3', 90, [90, 106], 20)];
  const flagged = bothWays(specs({ overflows: true }), 100);
  assert.equal(flagged.pruned.kind, 'B');
  assert.equal(flagged.pruned.box.name, 'p1');
  assert.equal(flagged.pruned.y, 94);
  assert.ok(flagged.askedA.has('p1'));
  // The control: the same page with the doubt withheld is the wrong cut, which is why the doubt is asked.
  const naive = measuredPage(specs({}));
  const wrong = adjudicate({ report: naive.report, sourceOf: naive.sourceOf, pageStart: 0, contentHeight: 100 });
  assert.equal(wrong.kind, 'A');
  assert.equal(wrong.y, 90);
});

test("the floor is taken over what the forced row leaves, not over what it removes (C1)", () => {
  // A forced row at 128 with its first cell kept (an avoid the row spends), then a paragraph below it whose boundary at 328 is clean but lies beyond the row, and so is no cut this flow may take. The boundary before the row is kept; the lowest clean reading the row leaves is the line at 112, in p2, whose bottom stands above 328. Floored at 328 p2 would be skipped and the cut would be the boundary at 64.
  const a0 = para('a0', 128, [128, 144], 20, { breakAfter: 'page' });
  const a1 = para('a1', 168, [168, 184], 20);
  const specs = [
    para('p1', 0, [0, 16, 32, 48]),
    para('p2', 64, [64, 80, 96, 112]),
    { name: 'tr', top: 128, bottom: 328, style: { breakBefore: 'avoid' }, children: [cell('c1', 128, 208, [a0, a1], { breakInside: 'avoid' }), { ...cell('c2', 128, 328, []), lines: linesAt([128, 148, 168, 188, 208], 20) }] },
    para('p3', 328, [328, 344, 360, 376])
  ];
  const { pruned } = bothWays(specs, 400, { forcing: true }, [['c1', 'c2']]);
  assert.equal(pruned.kind, 'B');
  assert.equal(pruned.box.name, 'p2');
  assert.equal(pruned.y, 112);
});

test("§5.3's cost is part of the fit that sets the floor: a clean boundary a cloned border pushes past the foot sets none", () => {
  // The boundary before p3, at 96, is clean but its cut would cost the cloned container's 30px border: 126 on a 100px page. It sets no floor, so p2's lines (which end at 80 and fit with the border) are measured and the cut is the line at 64.
  const box = (name: any, top: any, tops: any) => para(name, top, tops);
  const specs = [{ name: 'cl', top: 0, bottom: 200, style: { boxDecorationBreak: 'clone', borderBottomWidth: '30px' }, children: [box('p1', 0, [0, 16]), box('p2', 32, [32, 48, 64, 80]), box('p3', 96, [96, 112])] }];
  const { pruned, askedA } = bothWays(specs, 100);
  assert.equal(pruned.kind, 'B');
  assert.equal(pruned.box.name, 'p2');
  assert.ok(askedA.has('p2'));
});

test('on pages of every shape the cut with the second phase is the cut without it', () => {
  // A seeded fuzz: stacks of paragraphs and containers, keeps, orphans and widows, cloned borders, end gaps, boxes whose lines overflow them, and limits anywhere on the page.
  let seed = 20261012;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (n: any) => Math.floor(rnd() * n);
  let skipped = 0;
  for (let page = 0; page < 3000; page++) {
    let y = 0;
    let id = 0;
    const style = () => ({ orphans: String(1 + pick(3)), widows: String(1 + pick(3)), ...(rnd() < 0.15 ? { breakInside: 'avoid' } : {}), ...(rnd() < 0.12 ? { breakBefore: 'avoid' } : {}), ...(rnd() < 0.12 ? { breakAfter: 'avoid' } : {}) });
    const paragraph = () => {
      const n = 1 + pick(8);
      const top = y;
      const overflows = rnd() < 0.04;
      const spec = para(`p${id++}`, top, Array.from({ length: n }, (_, i) => top + i * 16), 16, style(), { ...(overflows ? { bottom: top + 16, overflows: true } : {}), ...(rnd() < 0.1 ? { gap: { base: top + n * 16, bottom: top + n * 16 + 8 } } : {}) });
      y = spec.bottom + (rnd() < 0.3 ? 8 : 0);
      return spec;
    };
    const specs: any[] = [];
    for (let i = 3 + pick(10); i > 0; i--) {
      if (rnd() < 0.25) {
        const top = y;
        const clone = rnd() < 0.3;
        const kids = Array.from({ length: 2 + pick(3) }, paragraph);
        specs.push({ name: `d${id++}`, top, bottom: y, style: { ...style(), ...(clone ? { boxDecorationBreak: 'clone', borderBottomWidth: '10px' } : {}) }, children: kids });
      } else specs.push(paragraph());
    }
    const a = measuredPage(specs);
    const asked = asking(a);
    const limit = 30 + pick(500);
    const pruned = adjudicate({ report: a.report, sourceOf: a.sourceOf, pageStart: 0, contentHeight: limit });
    const b = measuredPage(specs);
    const askedFull = asking(b);
    const full = adjudicate({ report: fullOf(b), sourceOf: b.sourceOf, pageStart: 0, contentHeight: limit });
    assert.deepEqual(keyOf(pruned), keyOf(full), `page ${page} at ${limit}`);
    skipped += askedFull.size - asked.size;
  }
  assert.ok(skipped > 1000, `the fuzz exercised the skipping (${skipped} stacks skipped)`);
});
