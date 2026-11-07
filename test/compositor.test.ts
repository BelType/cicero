/** Compositor unit tests — the DP against a monospace arithmetic provider, no browser. Hand-computed expectations; the browser fixtures (compose-dom) pin real geometry separately. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose as composeTyped } from '../src/compositor.ts';
import { overlaps } from '../src/compose-dom.ts';
import { byShape } from './fakes.ts';

const compose = byShape(composeTyped);

function monoProvider(words: any, { charW = 10, spaceW = 10, hyphenW = 10, emW = 40 } = {}) {
  function width(a: any, b: any) {
    let px = 0;
    let first = true;
    const lastWord = b.char > 0 ? b.word : b.word - 1;
    for (let i = a.word; i <= lastWord; i++) {
      const start = i === a.word && a.char > 0 ? a.char : 0;
      const end = i === b.word && b.char > 0 ? b.char : words[i].length;
      if (!first) px += spaceW;
      px += (end - start) * charW;
      first = false;
    }
    return px;
  }
  // `emWidth` is a quarter of it by default, which is about what a real face gives a space — the ratio matters, because the ragged tolerance is 2em and the justified one is half a space per gap (*the rag is priced once*).
  return { width, hyphenWidth: hyphenW, spaceWidth: spaceW, emWidth: emW };
}

const W4 = 'aaaa'; // 40px

test('a 1-word last line beats a 1-word middle line (orphan demerits < badness)', () => {
  const words = [W4, W4, W4, W4, W4];
  const r = compose({ words, measure: monoProvider(words), available: 100, align: 'justify' });
  assert.deepEqual(r.breaks, [{ word: 2, char: 0 }, { word: 4, char: 0 }]); // (2,2,1)
  assert.equal(r.lineCount, 3);
  assert.ok(r.lines.every((l: any) => l.width <= l.avail + 0.05));
});

/**
 * THE RAG IS PRICED ONCE (2026-09-10) — a ragged line's badness divides its slack by a single 2em tolerance, not by the number of gaps behind it. The defect it closes is that the same visible rag cost ten times more on a short line than on a long one, which is the justified arithmetic applied where nothing justifies.
 *
 * Hand-checked, at charW 10, spaceW 10, em 40 (a quarter-em space, as a real face gives), measure 1000, so the tolerance is 80px. Thirteen words of 7, 11, 11, 10, 6, 6, 4, 7, 5, 9, 7, 4 and 11 characters, and two chains:
 *
 *   A — break after word 11: line 1 is 930px (rag 70, 10 gaps), line 2 carries two words.
 *   B — break after word 12: line 1 is 980px (rag 20, 11 gaps), line 2 carries one, so the last-line orphan charge of 5000 applies.
 *
 * PER GAP (what this used to do): A's rag is 70/(10 × 10) = 0.7, badness 34.3, demerits 1,963; B's is 20/(11 × 10) = 0.18, badness 0.6, demerits 113 — but B pays the orphan, so A wins at 2,063 against 5,212. **A 70px rag came out cheaper than a one-word last line, because ten gaps were standing behind it.**
 *
 * ONCE, AGAINST 2em: A's rag is 70/80 = 0.875, badness 67, demerits 5,929; B's is 20/80 = 0.25, badness 1.6, demerits 134. B wins at 5,234 against 6,029 — the rag is now worth more than the orphan, which is the whole point: 70px of 1000 is a 7% rag whichever line it ends. (Justified setting reaches chain B here too, by its own road — half a space per gap makes A's rag badness 274 — so this paragraph discriminates the ragged model against its own past and not the two alignments against each other. The four justified tests around it are what pin that side.)
 */
test('a ragged line pays for its rag, not for the words behind it', () => {
  const lengths = [7, 11, 11, 10, 6, 6, 4, 7, 5, 9, 7, 4, 11];
  const words = lengths.map((n) => 'a'.repeat(n));
  const r = compose({ words, measure: monoProvider(words), available: 1000, align: 'left' });
  assert.deepEqual(r.breaks, [{ word: 12, char: 0 }], 'chain B — the 20px rag, not the 70px one');
  assert.equal(r.lines[0].width, 980);
  assert.equal(r.lineCount, 2);
});

/** A provider with no em refuses rather than composing against NaN. The venue's own scar: a badness that is NaN loses every comparison silently and the paragraph comes out looking composed. */
test('a ragged composition without an em is refused, not guessed', () => {
  const words = ['aaaa', 'aaaa', 'aaaa'];
  const { emWidth, ...noEm } = monoProvider(words);
  assert.throws(() => compose({ words, measure: noEm, available: 100, align: 'left' }), /emWidth/);
  assert.doesNotThrow(() => compose({ words, measure: noEm, available: 100, align: 'justify' }), 'justified setting never needed one');
});

test('exact-total tie breaks toward the earlier break', () => {
  // (1,2,1) and (2,1,1) have exactly equal totals; the ascending scan keeps the earlier predecessor.
  const words = [W4, W4, W4, 'aaaaaaa'];
  const r = compose({ words, measure: monoProvider(words), available: 100, align: 'justify' });
  assert.deepEqual(r.breaks, [{ word: 1, char: 0 }, { word: 3, char: 0 }]);
});

test('a hyphen candidate rescues an impossible fit', () => {
  const words = [W4, 'bbbbbbbbbb'];
  const r = compose({
    words,
    hyphenOffsets: (i: any) => (i === 1 ? [4] : []),
    measure: monoProvider(words),
    available: 100,
    align: 'left'
  });
  assert.deepEqual(r.breaks, [{ word: 1, char: 4 }]); // "aaaa bbbb-" exactly fills the measure
  assert.equal(r.lines[0].width, 100); // 40 + 10 + 40 + hyphen 10
  assert.ok(!r.lines.some((l: any) => l.overfull));
});

test('an overwide single word composes overfull, never a mid-word cut', () => {
  const words = ['cccccccccccccccccccc']; // 200px in a 100px measure
  const r = compose({ words, measure: monoProvider(words), available: 100 });
  assert.deepEqual(r.breaks, []);
  assert.equal(r.lineCount, 1);
  assert.equal(r.lines[0].overfull, true);
});

test('overflow-wrap: the same word is divided rather than overflowed, and no hyphen is written', () => {
  // css-text-4 §6.4: an otherwise unbreakable sequence may be broken at an arbitrary point, and "no hyphenation character is inserted at the break point".
  const words = ['cccccccccccccccccccc']; // 200px in a 100px measure
  const r = compose({ words, measure: monoProvider(words), available: 100, breakAnywhere: true });
  assert.equal(r.lineCount, 2);
  assert.deepEqual(r.breaks, [{ word: 0, char: 10, glyph: false }], 'divided at exactly the measure, and marked as showing no hyphen');
  assert.equal(r.lines[0].width, 100, 'no hyphen advance is charged: ten characters, not nine and a hyphen');
  assert.ok(!r.lines.some((l: any) => l.overfull));
});

test('overflow-wrap: a word that fits a line of its own is never divided', () => {
  // The condition is §6.4's own — "an otherwise unbreakable sequence of characters too long to fit within the line box" — asked of the word, so the candidates do not exist anywhere they would be wrong. Four words of 40px in a 100px measure divide two and two; nothing here is overlong.
  const words = [W4, W4, W4, W4];
  const plain = compose({ words, measure: monoProvider(words), available: 100, align: 'justify' });
  const anywhere = compose({ words, measure: monoProvider(words), available: 100, align: 'justify', breakAnywhere: true });
  assert.deepEqual(anywhere.breaks, plain.breaks, 'the property changes nothing where no word is overlong');
});

test('overflow-wrap: a hyphen point inside the overlong word outranks an emergency break', () => {
  // Nineteen characters in a 100px measure, so both candidates give two lines: the hyphen at 9 (nine characters and a hyphen, then ten) and the emergency at 10 (ten, then nine). The hyphen costs 2500 demerits and the emergency 100000, so the division that shows a hyphen wins — which is the ordering §6.4 asks for, an emergency break being the last resort within its own line.
  const words = ['ccccccccccccccccccc'];
  const r = compose({ words, hyphenOffsets: (i: any) => (i === 0 ? [9] : []), measure: monoProvider(words), available: 100, breakAnywhere: true });
  assert.deepEqual(r.breaks, [{ word: 0, char: 9 }], 'the hyphen point, and it keeps its two-field shape');
  assert.equal(r.lines[0].width, 100, 'nine characters and a hyphen');
});

test('text-indent debits only the first line', () => {
  const words = [W4, W4, W4, W4];
  const r = compose({ words, measure: monoProvider(words), available: 100, indent: 30, align: 'justify' });
  assert.equal(r.lines[0].avail, 70);
  for (const l of r.lines.slice(1)) assert.equal(l.avail, 100);
  assert.ok(r.lines.every((l: any) => l.width <= l.avail + 0.05));
});

test('filler arithmetic: measure minus the last line’s natural width', () => {
  const words = [W4, W4, W4];
  const r = compose({ words, measure: monoProvider(words), available: 100, align: 'justify' });
  assert.equal(r.lineCount, 2);
  assert.equal(r.fillerPx, 100 - 40); // last line is one 40px word
});

test('a single-line paragraph takes no breaks; filler covers the whole slack', () => {
  const words = [W4];
  const r = compose({ words, measure: monoProvider(words), available: 100, indent: 20, align: 'justify' });
  assert.deepEqual(r.breaks, []);
  assert.equal(r.lines[0].avail, 80); // the only line is line 1: indent debits it
  assert.equal(r.fillerPx, 40);
});

test('deterministic: same inputs, same hints', () => {
  const words = ['aa', 'bbbb', 'cc', 'ddddddd', 'ee', 'ffff', 'gg', 'hhhhh'];
  const args = { words, measure: monoProvider(words), available: 90, align: 'left' };
  assert.deepEqual(compose(args), compose(args));
});

test('empty run composes to nothing', () => {
  const r = compose({ words: [], measure: monoProvider([]), available: 100 });
  assert.deepEqual(r, { breaks: [], lines: [], lineCount: 0, fillerPx: 0 });
});


/** The beside-a-float refusal's geometry (css-break-3 §2.1, the Compositor's side of it). A block laid out beside a float has line boxes the float shortens, and this pass reads one measure per block — so such a block is not composed at all and its lines stay the browser's, stated on the console. This test pins the overlap predicate that decides which blocks those are; that they are the right blocks is `cases/21-parallel-flows`, printed against Chromium's own column. */
test('a float overlapping a block in both axes is a float that shortens its lines', () => {
  const block = { top: 100, bottom: 200, left: 0, right: 400 };
  assert.equal(overlaps(block, { top: 50, bottom: 300, left: 0, right: 130 }), true, 'a rail standing beside it');
  assert.equal(overlaps(block, { top: 150, bottom: 160, left: 300, right: 400 }), true, 'a small float nested in its lines');
  assert.equal(overlaps(block, { top: 0, bottom: 99, left: 0, right: 130 }), false, 'a float that ended above it');
  assert.equal(overlaps(block, { top: 201, bottom: 400, left: 0, right: 130 }), false, 'a float that starts below it');
  assert.equal(overlaps(block, { top: 100, bottom: 200, left: 500, right: 600 }), false, 'a float in another column entirely');
  assert.equal(overlaps(block, { top: 200, bottom: 300, left: 0, right: 130 }), false, 'edge-to-edge is not an overlap');
});

/**
 * THE SCAN READS THE FEASIBLE WINDOW (*the composition lays out once*, 2026-09-27) — the fixed `compose` against the scan it replaced, over random paragraphs.
 *
 * `compose` walks each node's predecessors downward and stops at the first overfull span, on the premise that for a fixed end a span starting earlier is never narrower; it then prices what it read in ascending order, which keeps the tie-breaking. The reference below is the scan as it stood before that round, copied rather than imported — it prices every `j < k` and skips the overfull ones — and lives here, not in `src/`, because its only job is to be the answer. The provider is additive over random integer character and space widths, so the premise holds by construction and exact ties are common. Every result is compared whole: breaks, lines, filler.
 */
function bruteForceCompose({ words, hyphenOffsets = (_i: any): number[] => [], measure, available, indent = 0, align = 'left', breakAnywhere = false }: any) {
  const EPS = 0.05;
  const N = words.length;
  if (N === 0) return { breaks: [], lines: [], lineCount: 0, fillerPx: 0 };
  const overlong = (i: any) => measure.width({ word: i, char: 0 }, { word: i + 1, char: 0 }) > available + EPS;
  const nodes: { word: number; char: number; glyph?: boolean }[] = [{ word: 0, char: 0 }];
  for (let i = 0; i < N; i++) {
    const chars = new Map<any, any>();
    for (const c of hyphenOffsets(i)) if (c > 0 && c < words[i].length) chars.set(c, true);
    if (breakAnywhere && overlong(i)) {
      let off = 0;
      for (const ch of words[i]) {
        off += ch.length;
        if (off > 0 && off < words[i].length && !chars.has(off)) chars.set(off, false);
      }
    }
    for (const c of [...chars.keys()].sort((a, b) => a - b)) nodes.push(chars.get(c) ? { word: i, char: c } : { word: i, char: c, glyph: false });
    if (i < N - 1) nodes.push({ word: i + 1, char: 0 });
  }
  nodes.push({ word: N, char: 0 });
  const last = nodes.length - 1;
  const hyphenated = (n: any) => n.char > 0 && n.glyph !== false;
  const ragged = align !== 'justify';
  const stretchUnit = 0.5 * measure.spaceWidth;
  const ragTolerance = ragged ? 2 * measure.emWidth : 0;
  const gapsIn = (a: any, b: any) => Math.max(0, (b.char > 0 ? b.word : b.word - 1) - (a.char > 0 ? a.word + 1 : a.word));
  const lineWidth = (a: any, b: any) => measure.width(a, b) + (hyphenated(b) ? measure.hyphenWidth : 0);
  const best = new Array(nodes.length).fill(null);
  best[0] = { total: 0, prev: -1, width: 0, avail: 0, overfull: false };
  for (let k = 1; k < nodes.length; k++) {
    const isLast = k === last;
    let choice = null;
    let sawFeasible = false;
    for (let j = 0; j < k; j++) {
      if (!best[j]) continue;
      const avail = available - (j === 0 ? indent : 0);
      const W = lineWidth(nodes[j], nodes[k]);
      if (W > avail + EPS) continue;
      sawFeasible = true;
      let badness = 0;
      if (!isLast) {
        const slack = Math.max(0, avail - W);
        const gaps = gapsIn(nodes[j], nodes[k]);
        const r = ragged ? slack / ragTolerance : slack / (gaps > 0 ? gaps * stretchUnit : measure.spaceWidth);
        badness = Math.min(10000, 100 * r * r * r);
      }
      let d = (10 + badness) ** 2;
      if (hyphenated(nodes[k])) d += 2500;
      if (hyphenated(nodes[k]) && hyphenated(nodes[j])) d += 3000;
      if (nodes[k].glyph === false) d += 1e5;
      if (isLast && j !== 0 && gapsIn(nodes[j], nodes[k]) === 0) d += 5000;
      const total = best[j].total + d;
      if (!choice || total < choice.total - 1e-9) choice = { total, prev: j, width: W, avail, overfull: false };
    }
    if (!choice && !sawFeasible) {
      for (let j = k - 1; j >= 0; j--) {
        if (!best[j]) continue;
        const avail = available - (j === 0 ? indent : 0);
        const W = lineWidth(nodes[j], nodes[k]);
        choice = { total: best[j].total + 1e7 + (W - avail) ** 2, prev: j, width: W, avail, overfull: true };
        break;
      }
    }
    best[k] = choice;
  }
  const chain: any[] = [];
  for (let k = last; k > 0; k = best[k].prev) chain.push(k);
  chain.reverse();
  const lines: any[] = [];
  let from = 0;
  for (const k of chain) {
    lines.push({ from: nodes[from], to: nodes[k], width: best[k].width, avail: best[k].avail, overfull: best[k].overfull });
    from = k;
  }
  const lastLine = lines[lines.length - 1];
  return { breaks: chain.slice(0, -1).map((k) => nodes[k]), lines, lineCount: lines.length, fillerPx: Math.max(0, lastLine.avail - lastLine.width) };
}

/** A seeded generator (mulberry32), so a failure names a seed that reproduces it. */
function seeded(seed: any) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An additive provider over per-character widths and per-gap space widths: a span is the characters it holds and the spaces between its words, so a span that starts earlier holds more and is never narrower. It counts its reads. */
function additiveProvider(words: any, charW: any, spaceW: any, { hyphenW, emW }: any) {
  const provider = {
    reads: 0,
    width(a: any, b: any) {
      provider.reads++;
      const lastWord = b.char > 0 ? b.word : b.word - 1;
      let px = 0;
      for (let i = a.word; i <= lastWord; i++) {
        const start = i === a.word && a.char > 0 ? a.char : 0;
        const end = i === b.word && b.char > 0 ? b.char : words[i].length;
        for (let c = start; c < end; c++) px += charW[i][c];
        if (i > a.word) px += spaceW[i - 1];
      }
      return px;
    },
    hyphenWidth: hyphenW,
    spaceWidth: spaceW.length ? spaceW[0] : 4,
    emWidth: emW
  };
  return provider;
}

test('the downward scan chooses exactly what pricing every predecessor chose', () => {
  let paragraphs = 0;
  let nothingFits = 0;
  let readsBefore = 0;
  let readsAfter = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const rnd = seeded(seed);
    const pick = (xs: any) => xs[Math.floor(rnd() * xs.length)];
    const n = 1 + Math.floor(rnd() * 24);
    const words = Array.from({ length: n }, () => 'a'.repeat(1 + Math.floor(rnd() * (rnd() < 0.1 ? 22 : 9))));
    const charW = words.map((w) => Array.from(w, () => pick([5, 6, 7, 8])));
    const spaceW = Array.from({ length: Math.max(0, n - 1) }, () => pick([3, 4, 5]));
    const hyphens = words.map((w) => (w.length > 3 && rnd() < 0.6 ? [...new Set(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => 1 + Math.floor(rnd() * (w.length - 1))))].sort((a, b) => a - b) : []));
    // Some measures are narrower than the widest word, so nothing fits from some nodes and the overfull fallback runs.
    const available = pick([30, 45, 60, 80, 110, 160, 240]);
    const args = {
      words,
      hyphenOffsets: (i: any) => hyphens[i],
      available,
      indent: pick([-30, -8, 0, 0, 12, 25]),
      align: pick(['left', 'right', 'center', 'justify']),
      breakAnywhere: rnd() < 0.25
    };
    const extra = { hyphenW: pick([0, 4, 6]), emW: pick([12, 16]) };
    const before = additiveProvider(words, charW, spaceW, extra);
    const after = additiveProvider(words, charW, spaceW, extra);
    const expected = bruteForceCompose({ ...args, measure: before });
    const actual = compose({ ...args, measure: after });
    assert.deepEqual(actual, expected, `seed ${seed}: the scan chose differently from the reference`);
    paragraphs++;
    if (expected.lines.some((l) => l.overfull)) nothingFits++;
    readsBefore += before.reads;
    readsAfter += after.reads;
    assert.ok(after.reads <= before.reads, `seed ${seed}: the downward scan read ${after.reads} spans where pricing every predecessor read ${before.reads}`);
  }
  assert.equal(paragraphs, 3000);
  assert.ok(nothingFits > 50, `only ${nothingFits} paragraphs reached the overfull fallback — the corpus must exercise it`);
  assert.ok(readsAfter < readsBefore, 'the scan reads less, or it bought nothing');
});

test('a negative indent gives the first line more room than any other, and the scan still finds it', () => {
  // Words of 10, 50, 40, 40 and 40px, spaces of 10, a 90px measure and a first line 30px wider. The first three words make 120px, which only the first line can hold. Scanning down from the node after them, one word back fits (40px) and two words back does not (100px), so the scan stops above node 0 — which alone would have found the one line that fits exactly. It must check node 0 on its own, or the first line is set with one ragged word.
  const words = ['a', 'aaaaa', W4, W4, W4];
  const args = { words, measure: monoProvider(words), available: 90, indent: -30, align: 'justify' };
  const r = compose(args);
  assert.deepEqual(r.breaks, [{ word: 3, char: 0 }], 'three words on the first line, two on the second');
  assert.equal(r.lines[0].avail, 120);
  assert.equal(r.lines[0].width, 120);
  assert.deepEqual(r, bruteForceCompose({ ...args, measure: monoProvider(words) }));
});

/** css-text-4 §6.3.5's `hyphenate-limit-lines` (Codeberg issue 5): with a candidate at every letter, total fit prefers tight hyphenated lines and stacks them; a limit makes the run a constraint. */
const runsOf = (r: any) => {
  let best = 0;
  let cur = 0;
  for (const b of r.breaks) {
    cur = b.char > 0 ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
};
const every = (words: string[]) => (i: number) => Array.from({ length: words[i].length - 1 }, (_, c) => c + 1);

test('a limit on consecutive hyphenated lines holds where total fit alone stacks them', () => {
  const words = ['abcdefghijklm', 'abcdefghijklm', 'abcdefghijklm', 'abcdefghijklm', 'abcdefghijklm', 'abcdefghijklm', 'abc'];
  const free = compose({ words, hyphenOffsets: every(words), measure: monoProvider(words), available: 100, align: 'justify' });
  assert.ok(runsOf(free) > 2, `the case stacks hyphens without a limit: ${JSON.stringify(free.breaks)}`);
  assert.deepEqual(compose({ words, hyphenOffsets: every(words), measure: monoProvider(words), available: 100, align: 'justify', limitLines: null }).breaks, free.breaks, 'no limit is the composition it always was');
  for (const limit of [1, 2]) {
    const r = compose({ words, hyphenOffsets: every(words), measure: monoProvider(words), available: 100, align: 'justify', limitLines: limit });
    assert.ok(runsOf(r) <= limit, `limit ${limit}: ${JSON.stringify(r.breaks)}`);
    assert.ok(!r.lines.some((l: any) => l.overfull));
  }
});

test('a limit that leaves a paragraph no way through is not a reason for it not to compose', () => {
  const words = ['x'.repeat(30)];
  const r = compose({ words, hyphenOffsets: every(words), measure: monoProvider(words), available: 100, align: 'left', limitLines: 1 });
  assert.equal(runsOf(r), 3, 'one word across four lines ends three on a hyphen, the limit set aside');
  assert.ok(!r.lines.some((l: any) => l.overfull));
});
