import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPositionIndex, indexBlocks as indexBlocksTyped, wordsBeforeChar, pageIntervals as pageIntervalsTyped, pageOfPos, pageContaining, remaindersOf, extensionPx as extensionPxTyped, presentationWidths as presentationWidthsTyped, widthKeyOf, elAt, elAtIn, pathOf as pathOfTyped, normalizePath, pathAfter, cutAfter, divides, flattenResume as flattenResumeTyped, flowsOf, treeOf } from '../src/positions.ts';
import { byShape } from './fakes.ts';

const pathOf = byShape(pathOfTyped);
const indexBlocks = byShape(indexBlocksTyped);
const extensionPx = byShape(extensionPxTyped);
const presentationWidths = byShape(presentationWidthsTyped);
const flattenResume = byShape(flattenResumeTyped);
const pageIntervals = byShape(pageIntervalsTyped);

// Plain-object stand-ins: the builder touches only childNodes/nodeType/data, by contract.
const t = (data: any) => ({ nodeType: 3, data });
const el = (...childNodes: any[]) => ({ nodeType: 1, childNodes });

test('arithmetic core: bases, posOf, blockOf, split', () => {
  const idx = createPositionIndex({ wordCounts: [5, 0, 4], elementWords: new Map<any, any>() });
  assert.deepEqual(idx.bases, [0, 5, 5, 9]);
  assert.equal(idx.total, 9);
  assert.equal(idx.posOf(2, 3), 8);
  assert.equal(idx.blockOf(0), 0);
  assert.equal(idx.blockOf(4), 0);
  // The seam fallback: gi 5 skips the word-empty block 1 and resolves to the block whose word range contains it. This is the PROBE-SIDE approximation only — presentation reads the account's carried block literal, because a wordless block (a plate) makes the seam genuinely ambiguous (case 04).
  assert.equal(idx.blockOf(5), 2);
  assert.deepEqual(idx.split(5), { b: 2, w: 0 });
  assert.deepEqual(idx.split(8), { b: 2, w: 3 });
  // Past the end clamps to the last block (terminal-adjacent arithmetic, never a crash).
  assert.equal(idx.blockOf(9), 2);
});

test('builder tokenizes like joinedWords: seams join, whitespace splits', () => {
  const em = el(t('cd'));
  const block = el(t('ab'), em, t(' ef  gh'));
  const idx = indexBlocks([block]);
  // "abcd" is ONE word across the text/element seam; then "ef", "gh".
  assert.deepEqual(idx.wordCounts, [3]);
  // The straddling word belongs to where its first part lies: before `em`, not inside it — so `em` holds no word of its own. But `em` OPENS INSIDE that word, and `before` names the word its first character is part of, "abcd" at index 0, not the count the walk had reached: a character of `em` is then asked at the page its word is printed on (*an element that opens inside a word is placed one word late*, case 114, 2026-10-19). Pinned at 1 until P38 measured it on every element of a paragraph: four characters of a page's last word answered the next page.
  assert.equal(idx.wordsBefore(em), 0, 'the word em opens inside');
  assert.equal(idx.opensInside(em), true);
  assert.equal(idx.wordCountIn(em), 0);
  assert.equal(idx.blockOfEl(em), 0);
  assert.equal(idx.opensInside(block), false, 'the block opens at a word\'s start');
});

test('an element that opens inside a word is placed at that word, and its own words count on from it', () => {
  // KaTeX's shape: `<span>p0w</span><span>0</span><span>90</span>` is one word, and every span after the first opens inside it; then `p0w18<code>1</code>` ends a word in an element.
  const a = el(t('p0w'));
  const b = el(t('0'));
  const c = el(t('90'));
  const katex = el(a, b, c);
  const code = el(t('1'));
  const block = el(t('one two '), katex, t(' three p0w18'), code, t(' four'));
  const idx = indexBlocks([block]);
  assert.deepEqual(idx.wordCounts, [6], 'one, two, p0w090, three, p0w181, four — the formula is one word, and so is the word the code ends');
  assert.equal(idx.wordsBefore(katex), 2, 'the formula opens at its word\'s start');
  assert.equal(idx.wordsBefore(a), 2);
  assert.equal(idx.wordsBefore(b), 2, 'the second span is asked at the formula\'s word, not the next');
  assert.equal(idx.wordsBefore(c), 2);
  assert.equal(idx.opensInside(b) && idx.opensInside(c) && !idx.opensInside(a) && !idx.opensInside(katex), true);
  assert.equal(idx.wordsBefore(code), 4, 'the code is asked at the word it ends');
  assert.equal(idx.opensInside(code), true);
  assert.equal(idx.wordCountIn(katex), 1, 'the formula holds its word, whose first part is inside it');
  assert.equal(idx.wordCountIn(b), 0, 'a span that opens inside a word holds none of its own');
});

test('builder attributes words to the element holding their first part', () => {
  const inner = el(t('bb cc'));
  const outer = el(t('aa '), inner, t(' dd'));
  const block = el(outer);
  const idx = indexBlocks([block]);
  assert.deepEqual(idx.wordCounts, [4]);
  assert.equal(idx.wordsBefore(outer), 0);
  assert.equal(idx.wordCountIn(outer), 4);
  assert.equal(idx.wordsBefore(inner), 1);
  assert.equal(idx.wordCountIn(inner), 2);
  assert.equal(idx.posOf(0, idx.wordsBefore(inner)), 1);
});

test('word state resets between blocks, never inside one', () => {
  const b0 = el(t('aa'));
  const b1 = el(t('bb'));
  const idx = indexBlocks([b0, b1]);
  assert.deepEqual(idx.wordCounts, [1, 1]);
  assert.equal(idx.posOf(1, 0), 1);
});

test('offsets refuse elements outside the index — sources only, never clones', () => {
  const idx = indexBlocks([el(t('aa'))]);
  assert.throws(() => idx.wordsBefore(el()), /SOURCE elements only/);
});

// --- the engine answers the page (2026-09-04; beltype#19, beltype#20) ---

test('the char step counts words in the SAME tokenization as the builder', () => {
  // "aa b" + "cd" + " ef" — the inline seam joins "b"+"cd" into one word, exactly as indexBlocks does.
  const block = el(t('aa b'), el(t('cd')), t(' ef'));
  assert.equal(indexBlocks([block]).wordCounts[0], 3, 'the builder sees three words');
  assert.equal(wordsBeforeChar(block, 0), 0);
  assert.equal(wordsBeforeChar(block, 2), 1, 'after "aa", before the space');
  // The seam word "bcd" spans offsets 3..5. A character inside a word is THAT WORD'S (*a parallel flow is a fragmentainer*, 2026-10-08), so the count is the words wholly before it: "aa" alone, at the word's first character and at every other. The old count included the word the offset was inside, which answered the NEXT word's position for every character after a word's first — pinned here at 2 until P38 measured it (ten of 1 200 characters on another page than the one their word is printed on, those of a page's last word).
  assert.equal(wordsBeforeChar(block, 3), 1, 'the first character of the seam word: only "aa" is wholly before it');
  assert.equal(wordsBeforeChar(block, 4), 1, 'inside the seam word, across the element seam: still only "aa"');
  assert.equal(wordsBeforeChar(block, 5), 1, 'the last character of the seam word: only "aa" is wholly before it');
  assert.equal(wordsBeforeChar(block, 6), 2, 'the space after the seam word: "aa" and the seam word are both wholly before it');
  assert.equal(wordsBeforeChar(block, 9), 3, 'the end of the text: all three words are before it');
});

test('the char step refuses rather than clamps', () => {
  const block = el(t('aa'));
  assert.equal(wordsBeforeChar(block, 10), null, 'past the text is a refusal — a clamped offset answers for a character that does not exist');
  assert.equal(wordsBeforeChar(block, -1), null);
  assert.equal(wordsBeforeChar(block, 2), 1, 'the offset one past the last character is the text end, and it is legal');
});

/**
 * THE ADDRESS — `{ path, word, px }` — resolved, normalised and compared, all of it DOM-free by construction (*the cut is a place in the tree*, 2026-09-18).
 *
 * The indices count IN-FLOW children, which is the only reading that resolves in every tree a path is resolved in — the fixed predicate is injected here for the same reason `indexBlocks`' is, so an object tree can be asked a question only a computed style could otherwise answer.
 */
const box = (...children: any[]) => ({ nodeType: 1, childNodes: children, children, parentElement: null });
const link = (el: any) => { for (const c of el.children ?? []) { c.parentElement = el; link(c); } return el; };

test('a path counts IN-FLOW children from the block down, and elAt walks it back', () => {
  const plate = box();
  const caption = box();
  const figure = box(plate, caption);
  const rail = box(); // a `position: fixed` sibling: NOT counted — it is in no flow, and the three trees a path is resolved in do not all hold it
  const p = box();
  const block = link(box(rail, p, figure));
  const fixed = (el: any) => el === rail;
  assert.deepEqual(pathOf(figure, block, 3, fixed), [3, 1], 'the figure is the block’s second IN-FLOW child, the fixed rail passed over');
  assert.deepEqual(pathOf(plate, block, 3, fixed), [3, 1, 0]);
  assert.deepEqual(pathOf(block, block, 3, fixed), [3], 'the block itself is the bare path');
  assert.equal(elAtIn(block, [3, 1, 0], fixed), plate, 'and back again — the round trip is the whole contract');
  assert.equal(elAt([null, null, null, block], [3, 1, 1], fixed), caption);
  assert.equal(elAtIn(block, [3, 9], fixed), null, 'a path the tree no longer answers refuses rather than guesses');
  // The control, and it is the defect this exists to keep out: counting the rail puts every index one box along, which is a shell built on the box next door.
  assert.deepEqual(pathOf(figure, block, 3, () => false), [3, 2]);
});

test('a bare path drops its trailing zeros — before a first child is before its parent', () => {
  assert.deepEqual(normalizePath([2, 0, 0]), [2], 'nothing stands before the box at any level, so the cut is the block’s own boundary');
  assert.deepEqual(normalizePath([2, 1, 0]), [2, 1]);
  assert.deepEqual(normalizePath([0]), [0], 'a block index is never dropped');
  assert.deepEqual(normalizePath([2, 0, 1]), [2, 0, 1], 'an interior zero is a place, not padding');
});

test('order over addresses: a shorter path is the earlier place, and a word breaks the tie inside one box', () => {
  assert.equal(pathAfter([3], [2, 4]), true);
  assert.equal(pathAfter([2], [2, 4]), false, 'the block’s own start precedes everything inside it');
  assert.equal(pathAfter([2, 4], [2]), true);
  assert.equal(pathAfter([2, 1], [2, 1]), false);
  // Two wordless boxes in a row share one word position and are two places; this is what tells them apart.
  assert.equal(cutAfter({ path: [0, 2], word: null, px: null }, { path: [0, 1], word: null, px: null }), true);
  assert.equal(cutAfter({ path: [0, 1], word: 5, px: null }, { path: [0, 1], word: 2, px: null }), true, 'a later word in the same line stack');
  assert.equal(cutAfter({ path: [0, 1], word: 2, px: null }, { path: [0, 1], word: 5, px: null }), false);
  // A later line inside the same word (*a line inside a word is a break point*): a thirty-line word divided on two pages in a row is two cuts at one word, and C2 must read the second as progress.
  assert.equal(cutAfter({ path: [0, 1], word: 0, char: 144, px: null }, { path: [0, 1], word: 0, char: 72, px: null }), true, 'a later character in the same word');
  assert.equal(cutAfter({ path: [0, 1], word: 0, char: 72, px: null }, { path: [0, 1], word: 0, char: 144, px: null }), false);
  assert.equal(cutAfter({ path: [0, 1], word: 1, px: null }, { path: [0, 1], word: 0, char: 144, px: null }), true, 'the next word follows any character of the one before');
  assert.equal(cutAfter({ path: [0, 1], word: null, px: { remaining: 40, paint: null } }, { path: [0, 1], word: null, px: null }), true, 'entering a shell');
  assert.equal(cutAfter({ path: [0, 1], word: null, px: { remaining: 20, paint: 10 } }, { path: [0, 1], word: null, px: { remaining: 40, paint: 5 } }), true, 'a shell that shrank');
  assert.equal(cutAfter({ path: [0, 1], word: null, px: { remaining: 40, paint: 5 } }, { path: [0, 1], word: null, px: { remaining: 40, paint: 5 } }), false, 'a shell that did not');
  assert.equal(cutAfter({ path: [0], word: null, px: null }, null), true, 'a flow carried for the first time has shown itself');
});

test('divides: a bare path at a block boundary divides nothing, and everything else divides', () => {
  assert.equal(divides({ path: [2], word: null, px: null }), false, 'the block presents WHOLE on the next page, as its original');
  assert.equal(divides({ path: [2, 0], word: null, px: null }), true);
  assert.equal(divides({ path: [2], word: 4, px: null }), true, 'a top-level paragraph IS the line stack');
  assert.equal(divides({ path: [2], word: null, px: { remaining: 12, paint: null } }), true);
  assert.equal(divides(null), false);
});

// An account is one entry per page: `pos` the flat position the NEXT page resumes at, `cut` its address.
const bare = (b: any) => ({ path: [b], word: null, px: null });
const acct = (...rows: any[]) => rows.map(([pos, b, px = null]) => ({ pos, cut: { path: [b], word: null, px }, closes: {} }));

test('page intervals reconstruct [start, end) from the account, last page open', () => {
  const bases = [0, 4, 9];
  const pages = pageIntervals(acct([4, 1], [null, null]), bases);
  assert.equal(pages.length, 2);
  assert.deepEqual({ b: pages[0].start.b, w: pages[0].start.w }, { b: 0, w: 0 });
  assert.deepEqual({ b: pages[0].end.b, w: pages[0].end.w }, { b: 1, w: 0 });
  assert.deepEqual({ b: pages[1].start.b, w: pages[1].start.w }, { b: 1, w: 0 });
  assert.equal(pages[1].end, null, 'the last page runs to the document end');
});

test('a position resolves to the one page whose interval contains it', () => {
  const bases = [0, 4, 9];
  const wordCounts = [4, 5];
  // Page 0 holds block 0 and the first two words of block 1; page 1 holds the rest.
  const pages = pageIntervals(acct([6, 1], [null, null]), bases);
  assert.equal(pageOfPos(pages, { b: 0, w: 0 }, wordCounts), 0);
  assert.equal(pageOfPos(pages, { b: 0, w: 3 }, wordCounts), 0);
  assert.equal(pageOfPos(pages, { b: 1, w: 1 }, wordCounts), 0, 'the last word still on page 0');
  assert.equal(pageOfPos(pages, { b: 1, w: 2 }, wordCounts), 1, 'the resume word opens page 1');
  assert.equal(pageOfPos(pages, { b: 1, w: 4 }, wordCounts), 1);
});

test('a shell cut refuses: every slice of a sliced monolith carries the same word position', () => {
  const bases = [0, 4];
  // Page 0 closes with a SHELL in block 0 — the monolith was cut geometrically, so the position did not move.
  const pages = pageIntervals(acct([0, 0, { remaining: 120, paint: 260 }], [null, null]), bases);
  assert.equal(pageOfPos(pages, { b: 0, w: 0 }, [4]), null, 'the record cannot say which slice bears the character');
});

test('a target`s page is the arithmetic alone: a chapter with an end-gap cut in it still places its headings (*a pointer is a read*)', () => {
  // One top-level block of 20 words — a BelType chapter. Page 0 closes in an END GAP at word 8 (a px cut, no paint); page 1 closes at word 15; page 2 runs to the end.
  const bases = [0, 20];
  const account = [
    { pos: 8, cut: { path: [0, 2], word: null, px: { remaining: 12, paint: null } }, closes: {} },
    { pos: 15, cut: { path: [0, 4], word: null, px: null }, closes: {} },
    { pos: null, cut: null, closes: {} }
  ];
  const pages = pageIntervals(account, bases);
  assert.equal(pageOfPos(pages, { b: 0, w: 10 }, [20]), null, 'pageOf refuses the whole block');
  assert.equal(pageContaining(pages, { b: 0, w: 3 }), 0);
  assert.equal(pageContaining(pages, { b: 0, w: 8 }), 1, 'the word after the gap opens page 1');
  assert.equal(pageContaining(pages, { b: 0, w: 15 }), 2);
});

test('a word-empty block spanning pages refuses', () => {
  const bases = [0, 0, 3];
  // Block 1 is the plate: zero words, geometry across the seam. Page 0 closes inside it.
  const pages = pageIntervals(acct([0, 1], [null, null]), bases);
  assert.equal(pageOfPos(pages, { b: 1, w: 0 }, [0, 0, 3]), null, 'no word position to compare — three seam addresses share one integer');
});

/** An account whose middle page is the one §3.1's second break costs: page 0 closes with a forced break INTERIOR to block 1, at word 2; page 1 is blank; page 2 carries the resumed content. */
const withBlank = () => [
  { pos: 6, cut: { path: [1, 3], word: null, px: null }, blank: false, closes: {} },
  { pos: 6, cut: { path: [1, 3], word: null, px: null }, blank: true, closes: {} },
  { pos: null, cut: null, blank: false, closes: {} }
];

test('a page nothing flows onto is an empty interval the view must be told about (css-page-3 §4.2.3)', () => {
  const pages = pageIntervals(withBlank(), [0, 4, 9]);
  assert.equal(pages[1].blank, true, 'the blank flag reaches the view');
  assert.equal(pages[0].blank, false);
  assert.deepEqual({ b: pages[1].start.b, w: pages[1].start.w }, { b: 1, w: 2 }, 'it opens where the forcing said');
  assert.deepEqual({ b: pages[1].end.b, w: pages[1].end.w }, { b: 1, w: 2 }, 'and closes there: the interval is empty');
  // The load-bearing part: the interval alone does NOT say "assign nothing" — it starts mid-block, which the presentation reads as a continuation to build. Only the flag says it.
  assert.ok(pages[1].start.w > 0, 'a forcing interior to a block leaves the blank page starting mid-block');
});

test('a blank page is never the answer to a position query — its interval contains nothing', () => {
  const pages = pageIntervals(withBlank(), [0, 4, 9]);
  assert.equal(pageOfPos(pages, { b: 1, w: 1 }, [4, 5]), 0, 'the last word before the forcing');
  assert.equal(pageOfPos(pages, { b: 1, w: 2 }, [4, 5]), 2, 'the resumed word skips the blank page');
});

test('the non-throwing door: an element outside the index is a refusal, not a programmer error', () => {
  const idx = indexBlocks([el(t('aa'))]);
  assert.equal(idx.entryFor(el(t('zz'))), null, 'a query refuses where an offset lookup throws');
});

/**
 * THE BLOCK SEAM — the defect of *a word stops at a block boundary*, asserted on both sides of it in one test, because the two tokenizations agreeing is the whole property. A plain-object tree cannot be asked what its display is, so the predicate is injected: `block: true` on a stand-in means the browser lays it out as a block.
 *
 * The document is `cases/34-the-word-at-the-seam` in miniature: `<p>…cd</p><p>ef…</p>`, no whitespace anywhere near the seam. Fused, it is one word and `wordsBefore` of the second paragraph answers 1, which is what made a continuation consume `ef` and print it nowhere.
 */
test('a word stops at a block boundary, and both tokenizations stop at the same one', async () => {
  const joinedWords = byShape((await import('../src/fragments.ts')).joinedWords);
  const isInline = (el: any) => !el.block;
  const p0 = { nodeType: 1, block: true, childNodes: [t('ab cd')] };
  const p1 = { nodeType: 1, block: true, childNodes: [t('ef gh')] };
  const section = el(p0, p1);

  const idx = indexBlocks([section], isInline);
  assert.deepEqual(idx.wordCounts, [4], 'ab, cd, ef, gh — the seam is not a word');
  assert.equal(idx.wordsBefore(p1), 2, 'the second paragraph starts after two words, not one');
  assert.equal(wordsBeforeChar(section, 5, isInline), 2, 'the same count, through the character door');

  const words = joinedWords(section, isInline).map((w: any) => w.text);
  assert.deepEqual(words, ['ab', 'cd', 'ef', 'gh'], 'the clone side divides the seam in the same place');

  // The fused reading, kept as the thing that must NOT come back: one predicate away, `cd` and `ef` are one word, and consuming two words takes `ef` with them.
  const fused = joinedWords(section, () => true).map((w: any) => w.text);
  assert.deepEqual(fused, ['ab', 'cdef', 'gh']);
  assert.deepEqual(indexBlocks([section], () => true).wordCounts, [3]);
});

test('an inline seam still joins — the rule is about block boundaries and nothing else', async () => {
  const joinedWords = byShape((await import('../src/fragments.ts')).joinedWords);
  const isInline = (el: any) => !el.block;
  const em = { nodeType: 1, childNodes: [t('cd')] };
  const block = { nodeType: 1, block: true, childNodes: [t('ab'), em, t(' ef')] };
  assert.deepEqual(indexBlocks([block], isInline).wordCounts, [2]);
  assert.deepEqual(joinedWords(block, isInline).map((w: any) => w.text), ['abcd', 'ef']);
});

/** A `<br>` ENDS A WORD (*a line inside a word is a break point*, 2026-09-23), in every tokenization — and the engine's own `br` (the word `break`) does not, because the Compositor puts one inside a word at a hyphenated break in a clone whose source carries none. `cases/63-the-line-inside-a-word`'s joined block in miniature: `ab<br>cd`, no whitespace beside the break. */
test('an author\'s <br> ends a word in every tokenization, and the engine\'s own break does not', async () => {
  const joinedWords = byShape((await import('../src/fragments.ts')).joinedWords);
  const bearing = (value: any) => ({ getAttribute: (k: any) => (k === 'data-beltype' ? value : null) });
  const br = { nodeType: 1, tagName: 'BR', ...bearing(null), childNodes: [] };
  const block = { nodeType: 1, childNodes: [t('ab'), br, t('cd ef')] };
  assert.deepEqual(indexBlocks([block], () => true).wordCounts, [3], 'ab, cd, ef — the break is a boundary although the box is inline');
  assert.equal(wordsBeforeChar(block, 2, () => true), 1, 'the character door agrees: ab lies wholly before cd');
  assert.deepEqual(joinedWords(block, () => true).map((w: any) => w.text), ['ab', 'cd', 'ef'], 'the clone side divides at the same place');

  const hinted = { nodeType: 1, tagName: 'BR', ...bearing('break'), childNodes: [] };
  const clone = { nodeType: 1, childNodes: [t('ex‐'), hinted, t('ample')] };
  assert.deepEqual(indexBlocks([clone], () => true).wordCounts, [1], 'a composed hyphen break stays inside its word');
  assert.deepEqual(joinedWords(clone, () => true).map((w: any) => w.text), ['ex‐ample']);
});

/** THE HYPHEN THE COMPOSITOR WROTE IS A PART THAT HOLDS NO CHARACTERS (*the hyphen is written at the cut*, 2026-10-06): the clone's word is the source's word, its text carries the source's characters alone, and the hyphen is still a part of it, so consuming the whole word takes it too. */
test('the clone side counts the source\'s characters in a word and keeps the engine\'s hyphen as a part with none', async () => {
  const joinedWords = byShape((await import('../src/fragments.ts')).joinedWords);
  const noteEngineText = byShape((await import('../src/word-space.ts')).noteEngineText);
  const hyphen = t('‐');
  noteEngineText(hyphen);
  const hinted = { nodeType: 1, tagName: 'BR', getAttribute: (k: any) => (k === 'data-beltype' ? 'break' : null), childNodes: [] };
  const clone = { nodeType: 1, childNodes: [t('abcdefgh'), hyphen, hinted, t('­ijklmnop p0w024')] };
  const words = joinedWords(clone, () => true);
  assert.deepEqual(words.map((w: any) => w.text), ['abcdefgh­ijklmnop', 'p0w024'], 'the source\'s word, soft hyphen and all, with no hyphen the engine wrote in it');
  assert.deepEqual(words[0].parts.map((p: any) => !!p.engine), [false, true, false], 'the hyphen is a part, between the two halves');
  assert.equal(indexBlocks([{ nodeType: 1, childNodes: [t('abcdefgh­ijklmnop p0w024')] }], () => true).wordCounts[0], words.length, 'the source counts the same words');
});

test('a fixed subtree is not in the word space, at any depth', () => {
  // CSS 2.1 §9.6.1 repeats a fixed box on every page and says nothing about depth, so its footprint is zero wherever it sits — and a footprint of zero means no position in the word space. The clone side agrees by construction: `fragments.js`' stripFixedBoxes removes the box before `joinedWords` ever tokenizes it, and the two tokenizations must never disagree.
  const rail = el(t('RAIL'));
  const deep = el(t('one two'), el(t('three'), rail), t('four'));
  const idx = indexBlocks([deep], () => false, (node: any) => node === rail);
  assert.deepEqual(idx.wordCounts, [4], 'RAIL is not a word of the flow');
  assert.equal(idx.wordsBefore(deep), 0);
  assert.equal(idx.wordCountIn(deep), 4);
  // And the control: without the predicate the same tree counts five, which is what the engine did until 2026-09-15.
  assert.deepEqual(indexBlocks([deep], () => false, () => false).wordCounts, [5]);
});

/** §5.3's extension, the account's own arithmetic (*the end gap takes no extension*, 2026-09-15). Plain objects, because that is exactly what it reads: an interval from `pageIntervals` and the account entry that closes it. */
const cut = (path: any, word: any = null, px: any = null) => ({ path, word, px });
const pg = (over: any = {}) => ({
  blank: false,
  start: { b: 0, w: 0, cut: cut([0]), carried: null },
  end: { b: 0, w: 40, cut: cut([0], 40), carried: null },
  closes: { contentH: 240 },
  ...over
});

test('the extension is the room the cut left, and zero wherever no content resumes', () => {
  // The ordinary divided block: the page area less the cut's own extent less what the fit charged for cloned decoration.
  assert.equal(extensionPx(pg(), { usedPx: 230, cost: 0 }), 10);
  assert.equal(extensionPx(pg(), { usedPx: 230, cost: 4 }), 6, 'the cloned block end is room the extension may not take');
  assert.equal(extensionPx(pg(), { usedPx: 240, cost: 0 }), 0, 'a cut at the page area edge leaves no room');
  assert.equal(extensionPx(pg(), { usedPx: 250, cost: 0 }), 0, 'and an overflowing one leaves none either, rather than a negative');
  assert.equal(extensionPx(pg(), { usedPx: 200, cost: 0, reservePx: 25 }), 15, "the room given up to a repeated footer is not the extension's to take (the header repeats)");
  assert.equal(extensionPx(pg(), { usedPx: 230, cost: 0, reservePx: 0 }), 10, 'no reservation changes nothing');

  // THE ROUND'S OWN CLAUSE. §5.3 extends a box's content box "before the content resumes on the next fragmentainer"; a cut in a container's block-end gap resumes no content — what continues is the box's own padding and border — so no extension is owed. A page ending in a shell IS that page.
  assert.equal(extensionPx(pg({ end: { b: 0, w: 40, cut: cut([0, 1], null, { remaining: 20, paint: null }), carried: null } }), { usedPx: 230, cost: 0 }), 0);

  // The three the first-fragment round settled, kept here so a later edit cannot quietly drop one.
  assert.equal(extensionPx(pg({ blank: true }), { usedPx: 230, cost: 0 }), 0, 'a page nothing flowed onto divides nothing');
  assert.equal(extensionPx(pg({ end: null }), { usedPx: 230, cost: 0 }), 0, 'the last page closes the document and divides nothing');
  assert.equal(extensionPx(pg({ end: { b: 0, w: 0, cut: cut([0]), carried: null } }), { usedPx: 230, cost: 0 }), 0, 'a cut at a block boundary divides no block');
  // This read 0 until *every branch gets a place* (2026-09-21), with the reason *an intermediate fragment, whose tail is still in the clone*. The tail is not in the clone any more — `fragments.js`'s `fragmentOf` builds a middle fragment by both cuts — so the reason is gone and the exception with it. What remains of it is the painted shell, whose slice is left to itself.
  assert.equal(extensionPx(pg({ start: { b: 0, w: 12, cut: cut([0], 12), carried: null } }), { usedPx: 230, cost: 0 }), 10, 'a middle fragment holds exactly its interval, and takes the extension like a first one');
  assert.equal(extensionPx(pg({ start: { b: 0, w: 0, cut: cut([0], null, { remaining: 300, paint: 240 }), carried: null } }), { usedPx: 230, cost: 0 }), 0, 'a fragment that resumes as a painted shell is a slice, and a slice is not extended');
  assert.equal(extensionPx(pg(), { usedPx: 230, cost: 0, carried: [{ pos: 3, item: [0, 1] }] }), 10, "a row item's place rides the carried list and is no flow of its own");
  assert.equal(extensionPx(pg(), { usedPx: 230, cost: 0, carried: [{ pos: 3 }] }), 0, 'a page a parallel flow crosses carries an original with its own tail under the clip');
});

test("a shell is the end gap only where nothing resumes beside it: a divided row's last item may end in one and the cells still reach the foot", () => {
  const shell = (remaining: any, paint: any = null) => cut([0, 0, 0, 1], null, { remaining, paint });
  const row = (end: any, carried: any) => [pg({ end: { b: 0, w: 40, cut: end, carried: null } }), { usedPx: 230, cost: 0, carried }];
  assert.equal(extensionPx(...row(shell(86), [{ pos: 3, item: [0, 0, 0, 0], cut: cut([0, 0, 0, 0], 15) }])), 10, 'the other item resumes at a word: content resumes past the cut');
  assert.equal(extensionPx(...row(shell(86), [{ pos: 3, item: [0, 0, 0, 0], cut: cut([0, 0, 0, 0]) }])), 10, 'and so does an item that resumes at its own start');
  assert.equal(extensionPx(...row(shell(86), [{ pos: 3, item: [0, 0, 0, 0], cut: cut([0, 0, 0, 0], null, { remaining: 0, paint: null }) }])), 0, 'an item with nothing left resumes nothing: the exception stands');
  assert.equal(extensionPx(...row(shell(86), null)), 0, 'no item beside it at all: the end gap of a block');
  assert.equal(extensionPx(...row(shell(86, 12), [{ pos: 3, item: [0, 0, 0, 0], cut: cut([0, 0, 0, 0], 15) }])), 0, 'a painted shell is the edge cut and takes none');
});

test('the presentation composes each width over the blocks its own pages show — parity and :first included', () => {
  // Case 49's shape: a right page at 302.36px showing blocks 0–1, then a left page at 245.67px showing blocks 2–3. The width that used to go uncomposed is the second.
  const bases = [0, 2, 38, 40];
  const account = [
    { pos: 38, cut: bare(2), closes: { contentW: 302.3622 } },
    { pos: null, cut: null, closes: { contentW: 245.6693 } }
  ];
  const widths = presentationWidths(pageIntervals(account, bases), 4);
  assert.deepEqual([...widths.keys()], [widthKeyOf(302.3622), widthKeyOf(245.6693)]);
  assert.deepEqual(widths.get('302.36').blocks, [0, 1, 2], 'the closing block is included even where the cut falls at its start — one harmless extra composition');
  assert.deepEqual(widths.get('245.67').blocks, [2, 3]);

  // A page nothing flows onto needs nothing; a carried flow brings its own block; two pages of one width share one entry.
  const withBlank = [
    { pos: 10, cut: bare(1), closes: { contentW: 300 }, carried: [{ cut: bare(3) }] },
    { pos: 10, cut: bare(1), blank: true, closes: { contentW: 200 } },
    { pos: null, cut: null, closes: { contentW: 300 } }
  ];
  const w2 = presentationWidths(pageIntervals(withBlank, [0, 4, 12, 20]), 4);
  assert.deepEqual([...w2.keys()], ['300'], 'the blank page’s width is never composed');
  assert.deepEqual(w2.get('300').blocks, [0, 1, 2, 3]);
  const carried = presentationWidths([{ start: { b: 1, w: 0, carried: [{ cut: bare(0) }] }, end: { b: 2, w: 0 }, closes: { contentW: 100 }, blank: false }], 3);
  assert.deepEqual(carried.get('100').blocks, [0, 1, 2], 'a parallel flow carried onto a page is composed at that page’s width');
  assert.equal(presentationWidths(pageIntervals(account, bases), 0).size, 0, 'no blocks, nothing to compose');
});

// --- the resume tree and its wire form (*a parallel flow is a fragmentainer*, 2026-10-08) ---

const cutAt = (...path: any[]) => ({ path, word: null, px: null });
const place = (pos: any, path: any, extra: any = {}) => ({ pos, cut: cutAt(...path), ...extra });

test('a block break in a word does not straddle: a space, a new block or a line break ends the word the offset is in', () => {
  // "ab" <p>cd</p> "ef": a block boundary ends a run (word-space.js), so offset 2 is the first character of "cd" and offset 4 of "ef" — no word straddles either.
  const block = el(t('ab'), { nodeType: 1, childNodes: [t('cd')], style: 'block' }, t('ef'));
  const inline = (n: any) => n.style !== 'block';
  assert.equal(wordsBeforeChar(block, 2, inline), 1);
  assert.equal(wordsBeforeChar(block, 3, inline), 1, 'inside "cd"');
  assert.equal(wordsBeforeChar(block, 4, inline), 2, 'the first character of "ef" after the block: "ab" and "cd" are wholly before it');
});

test('flattenResume writes the main path first and every other node in post-order; treeOf reads it back', () => {
  // The main flow, a float carrying a divided row of three items (the last one is the float's own place), and a main row item with a nested item.
  const tree = {
    ...place(93, [4, 1]),
    flows: [
      { ...place(30, [1, 0, 2], { remainingPx: 12 }), flows: [place(10, [1, 0, 0], { item: [1, 0, 0], remainingPx: null }), place(20, [1, 0, 1], { item: [1, 0, 1], remainingPx: 5 })] },
      place(60, [4, 0, 0], { item: [4, 0, 0], remainingPx: 3 })
    ]
  };
  tree.flows[0].flows[0].flows = [];
  tree.flows[0].flows[1].flows = [];
  tree.flows[1].flows = [];
  const flat = flattenResume(tree);
  assert.deepEqual(flat.map((p: any) => p.pos), [93, 10, 20, 30, 60], 'the root first, then a float after the items that stand before its place, then the main row item');
  assert.ok(flat.every((p: any) => !('flows' in p)), 'the wire form carries the fields of a path and not the tree');
  assert.deepEqual(treeOf(flat), tree, 'and the round trip is the identity');
  assert.deepEqual(flattenResume(treeOf(flat)), flat);
});

test("a node keeps the class and the trace of its own cut through the wire form and back (a parallel flow is a fragmentainer)", () => {
  const trace = { kind: 'B', violates: { avoid: false, ow: 1 }, k: 2, y: 120 };
  const tree = { ...place(93, [4, 1]), flows: [{ ...place(30, [4, 0, 0], { item: [4, 0, 0], remainingPx: 3, cls: 'A', trace }), flows: [] }] };
  const flat = flattenResume(tree);
  assert.equal(flat[1].cls, 'A');
  assert.deepEqual(flat[1].trace, trace);
  assert.ok(!('cls' in flat[0]), "the main path's class is the entry's, and a node a verdict did not make carries none");
  assert.deepEqual(treeOf(flat), tree);
});

test('a row item belongs to the nearest item that holds it, in any order', () => {
  const outer = place(50, [2, 0, 0], { item: [2, 0, 0], remainingPx: 1 });
  const inner = place(40, [2, 0, 0, 1, 0], { item: [2, 0, 0, 1, 0], remainingPx: 2 });
  const deeper = place(30, [2, 0, 0, 1, 0, 3], { item: [2, 0, 0, 1, 0, 3], remainingPx: 3 });
  for (const order of [[deeper, inner, outer], [outer, inner, deeper], [inner, outer, deeper]]) {
    const [outerNode] = flowsOf(order);
    assert.equal(outerNode.pos, 50);
    assert.deepEqual(outerNode.flows.map((n) => n.pos), [40], 'the outer item holds the inner one');
    assert.deepEqual(outerNode.flows[0].flows.map((n) => n.pos), [30], 'and the inner holds the deeper one, not the outer');
  }
});

test('a float adopts the items before it; the items left at the end are the main flow\'s', () => {
  const main = place(90, [3, 0, 1]);
  const itemA = place(10, [1, 0, 0], { item: [1, 0, 0] });
  const floatA = place(20, [1, 0, 1]);
  const itemB = place(70, [3, 0, 0], { item: [3, 0, 0] });
  const tree = treeOf([main, itemA, floatA, itemB]);
  assert.deepEqual(tree!.flows.map((n) => [n.pos, n.flows.map((m) => m.pos)]), [[20, [10]], [70, []]]);
});

test('the terminal entry has no tree and a missing tree has no paths', () => {
  assert.equal(treeOf([]), null);
  assert.deepEqual(flattenResume(null), []);
  assert.deepEqual(flattenResume(treeOf([place(5, [0])])), [place(5, [0])], 'a lone main path is a tree of one node and back');
});

/** MEMBERSHIP IS NOT ORDER (beltype#43, case 112's shape): block 0 is a float of 20 words, block 1 the paragraph beside it, 30 words. Page 0 shows the float's first twelve words and the paragraph's first twelve; its cut is in the paragraph at word 12 and carries the float from its word 12. Page 1 shows the float's last eight and the paragraph's next twelve; page 2 the rest. */
test('a word in a carried float`s remainder is on the page the float continues on, not the page its document position falls in', () => {
  const bases = [0, 20, 50];
  const account = [
    { pos: 32, cut: { path: [1], word: 12, px: null }, carried: [{ pos: 12, cut: { path: [0], word: 12, px: null }, remainingPx: 160 }], closes: {} },
    { pos: 44, cut: { path: [1], word: 24, px: null }, carried: null, closes: {} },
    { pos: null, cut: null, carried: null, closes: {} }
  ];
  const pages = pageIntervals(account, bases);
  assert.deepEqual(remaindersOf(account[0].carried, (p) => bases[p[0] + 1]), [{ b: 0, from: 12, to: 20 }]);
  for (let w = 0; w < 12; w++) assert.equal(pageContaining(pages, { b: 0, w }), 0, `float word ${w} on page 0`);
  for (let w = 12; w < 20; w++) assert.equal(pageContaining(pages, { b: 0, w }), 1, `float word ${w} carried to page 1`);
  assert.equal(pageContaining(pages, { b: 1, w: 11 }), 0);
  assert.equal(pageContaining(pages, { b: 1, w: 12 }), 1);
  assert.equal(pageContaining(pages, { b: 1, w: 24 }), 2);
  assert.throws(() => pageIntervals([{ ...account[0], carried: [{ ...account[0].carried![0], item: [0, 1] }] }], bases), /endOf/, 'a flow below the top level needs the index');
});
