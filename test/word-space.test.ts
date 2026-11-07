/**
 * THE TIE, in the three tokenizers that must never disagree.
 *
 * `il gatto nero dorme e riposa tranquillo` written with a no-break space between `e` and `riposa` is the sentence the report was filed on ([beltype#30](https://github.com/egildo/beltype/issues/30), [*a tie is not a break*](../../../.claude/decisions/cicero/a-tie-is-not-a-break.md)). JavaScript's `\s` matches U+00A0, so THE word space read the tie as an ordinary boundary, the Compositor was offered a break candidate there like any other, and it took it — the one thing the author wrote the tie to forbid. Every check here is the same claim from a different side: `e riposa` is ONE word, so the candidate does not exist.
 *
 * DOM-free, like the rest of this package's suites: `indexBlocks` and `joinedWords` take plain-object trees by contract, and the Compositor takes a word list and an arithmetic width provider. The Gauge's `measureWords` is the third tokenizer and cannot be reached without a browser; what it shares is `wordRuns()`, and that is checked directly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockChildrenOf as blockChildrenOfTyped, BREAKING_SPACE, cutRanges as cutRangesTyped, dressWords as dressWordsTyped, leaveOut as leaveOutTyped, mapCloneToSource as mapCloneToSourceTyped, noteSource as noteSourceTyped, noteText as noteTextTyped, replaceChars as replaceCharsTyped, rowsAmong, setSourceWords as setSourceWordsTyped, sourceOf as sourceOfTyped, sourceTextPoint as sourceTextPointTyped, splitTextAt as splitTextAtTyped, textPointShowing as textPointShowingTyped, wordRuns } from '../src/word-space.ts';
import { indexBlocks } from '../src/positions.ts';
import { joinedWords as joinedWordsTyped } from '../src/fragments.ts';
import { compose } from '../src/compositor.ts';
import { byShape } from './fakes.ts';

const joinedWords = byShape(joinedWordsTyped);
const blockChildrenOf = byShape(blockChildrenOfTyped);
const setSourceWords = byShape(setSourceWordsTyped);
const mapCloneToSource = byShape(mapCloneToSourceTyped);
const sourceOf = byShape(sourceOfTyped);
const noteSource = byShape(noteSourceTyped);
const dressWords = byShape(dressWordsTyped);
const noteText = byShape(noteTextTyped);
const cutRanges = byShape(cutRangesTyped);
const sourceTextPoint = byShape(sourceTextPointTyped);
const leaveOut = byShape(leaveOutTyped);
const textPointShowing = byShape(textPointShowingTyped);
const splitTextAt = byShape(splitTextAtTyped);
const replaceChars = byShape(replaceCharsTyped);

const TIE = ' ';
const SENTENCE = `il gatto nero dorme e${TIE}riposa tranquillo`;

const t = (data: any) => ({ nodeType: 3, data });
const el = (...childNodes: any[]) => ({ nodeType: 1, childNodes });

test('the character class divides an ordinary space and never a tie', () => {
  for (const ch of [' ', '\t', '\n', '\r', '\f', ' ', '　']) assert.equal(BREAKING_SPACE.test(ch), true, JSON.stringify(ch));
  for (const ch of [' ', ' ', '﻿']) assert.equal(BREAKING_SPACE.test(ch), false, JSON.stringify(ch));
  assert.equal(BREAKING_SPACE.test('e'), false, 'and a letter is not a space');
});

test('the Gauge’s run rule keeps the tie inside the word', () => {
  assert.deepEqual([...SENTENCE.matchAll(wordRuns())].map((m) => m[0]), ['il', 'gatto', 'nero', 'dorme', `e${TIE}riposa`, 'tranquillo']);
});

test('the position index counts six words, not seven', () => {
  const idx = indexBlocks([el(t(SENTENCE))]);
  assert.deepEqual(idx.wordCounts, [6]);
});

test('the clone side joins the same six, tie included, across an inline seam', () => {
  // The tie survives an inline element boundary too, which is the two rules meeting: the seam joins the run and the tie keeps it whole.
  const emphasis = el(t(`riposa`));
  const idx = joinedWords(el(t(`dorme e${TIE}`), emphasis, t(' tranquillo')));
  assert.deepEqual(idx.map((w: any) => w.text), ['dorme', `e${TIE}riposa`, 'tranquillo']);
});

/** The same monospace arithmetic `compositor.test.js` composes against: every character one unit, every space one. */
function monoProvider(words: any, { charW = 10, spaceW = 10 } = {}) {
  const width = (a: any, b: any) => {
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
  };
  return { width, hyphenWidth: charW, spaceWidth: spaceW, emWidth: 4 * charW };
}

/** The words a composition made, one string per line. */
const linesOf = (words: any, composed: any) => composed.lines.map((line: any) => words.slice(line.from.word, line.to.char > 0 ? line.to.word + 1 : line.to.word).join(' '));

test('the Compositor mints no break at the tie, and the line that stranded the article is gone', () => {
  // At this measure the old tokenization is what the report measured: the DP prefers the break the tie forbids. Both compositions are run here, because the fix is a candidate that no longer EXISTS rather than a price, and the only way to show a missing candidate is to show the composition that had it.
  const divided = [...SENTENCE.matchAll(/\S+/gu)].map((m) => m[0]);
  assert.deepEqual(linesOf(divided, compose({ words: divided, measure: monoProvider(divided), available: 230 })), ['il gatto nero dorme e', 'riposa tranquillo']);

  const words = [...SENTENCE.matchAll(wordRuns())].map((m) => m[0]);
  const composed = compose({ words, measure: monoProvider(words), available: 230 });
  // Every candidate the DP is offered is a word boundary or a hyphenation offset inside a word, and a tied word has neither inside it: `hyphenationOffsets` refuses anything that is not letters end to end.
  assert.ok(composed.breaks.every((b) => b.char === 0), 'no break lands inside a word');
  assert.deepEqual(linesOf(words, composed), ['il gatto nero dorme', `e${TIE}riposa tranquillo`]);
});


const at = (name: any, top: any, bottom: any) => ({ name, rect: { top, bottom } });
const names = (rows: any) => rows.map((row: any) => row.map((b: any) => b.name));

test('siblings that overlap on the block axis are a row, and a sequence is not', () => {
  assert.deepEqual(names(rowsAmong([at('a', 0, 240), at('b', 0, 240)])), [['a', 'b']]);
  assert.deepEqual(names(rowsAmong([at('a', 0, 100), at('b', 100, 200)])), [], 'a flex column: the parent permits the question and the geometry answers no');
});

test('a wrapped container holds two rows, and a lone last item is no row', () => {
  assert.deepEqual(names(rowsAmong([at('c', 0, 40), at('d', 0, 40), at('a', 50, 290), at('b', 50, 290), at('e', 300, 320)])), [['c', 'd'], ['a', 'b']]);
});

test('items of unequal extent are one row, measured against the row and not the neighbour', () => {
  assert.deepEqual(names(rowsAmong([at('tall', 0, 240), at('short', 0, 40), at('late', 60, 120)])), [['tall', 'short', 'late']]);
});

test('an item with nothing left is still a column of its row', () => {
  assert.deepEqual(names(rowsAmong([at('spent', 0, 0), at('long', 0, 120)])), [['spent', 'long']]);
  assert.deepEqual(names(rowsAmong([at('long', 0, 120), at('spent', 0, 0)])), [['long', 'spent']]);
});

/** THE PROCESSION STOPS AT AN ATOM (*the procession stops at an atom*, 2026-09-27; `packages/essay/cases/70-the-drawing-in-the-divided-paragraph`). SVG's `<text>` computes `display: block`, so a walk that descends through every inline box went through an inline `<svg>` and seated its text as the paragraph's block children. An object tree standing for case 70's paragraph and its block-level control: the display each element would compute is handed in as `isInline`, and the namespace answers what an atom is. */
test('an inline atom contributes no block child, a block-level atom is one, and neither is entered', () => {
  const HTML = 'http://www.w3.org/1999/xhtml';
  const SVG = 'http://www.w3.org/2000/svg';
  const box = (name: any, ns: any, inline: any, ...children: any[]) => ({ name, localName: name, namespaceURI: ns, inline, children });
  const inlineDrawing = box('svg', SVG, true, box('text', SVG, false), box('text', SVG, false));
  const blockDrawing = box('svg', SVG, false, box('text', SVG, false), box('text', SVG, false));
  const blockInInline = box('div', HTML, false);
  const p = box('p', HTML, false, box('em', HTML, true, blockInInline), inlineDrawing, blockDrawing);
  const isInline = (e: any) => e.inline;
  assert.deepEqual(blockChildrenOf(p, isInline).map((e: any) => e.name), ['div', 'svg'], 'CSS 2.1 §9.2.1.1 still seats a block inside an inline box; the drawings seat only themselves, and only where they are block-level');
  assert.equal(blockChildrenOf(p, isInline)[1], blockDrawing);
  assert.deepEqual(blockChildrenOf(box('p', HTML, false, inlineDrawing), isInline), [], 'a paragraph holding only an inline drawing keeps its line stack');
});

/** WHETHER A LINE INSIDE A WORD MAY BE A CUT (*a line inside a word is a break point*, 2026-09-23; *the hyphen is written at the cut*, 2026-10-06): a silent break yes, and a break after a soft hyphen yes — the fragment writes the hyphen the source holds — but a break the browser may have hyphenated between two letters under `hyphens: auto` no, where no character of the source says where, and the answer is the refusal. */
test('a break is refused only where the browser may have drawn a hyphen the source does not hold: between two hyphenable letters under hyphens: auto', async () => {
  const mayBeAutoHyphenated = byShape((await import('../src/word-space.ts')).mayBeAutoHyphenated);
  assert.equal(mayBeAutoHyphenated('­', 'b', 'manual'), false, 'a soft hyphen is the source\'s own, and the fragment writes the hyphen the browser drew there');
  assert.equal(mayBeAutoHyphenated('­', 'b', 'auto'), false, 'under auto too: the soft hyphen says where');
  assert.equal(mayBeAutoHyphenated('a', 'b', 'manual'), false, 'break-all or an emergency break under manual draws none');
  assert.equal(mayBeAutoHyphenated('a', 'b', 'auto'), true, 'under auto the browser may have hyphenated, and nothing says it did not');
  assert.equal(mayBeAutoHyphenated('語', '本', 'auto'), false, 'CJK breaks between letters with no hyphen, whatever hyphens says');
  assert.equal(mayBeAutoHyphenated('1', '2', 'auto'), false, 'digits are not hyphenated');
});

/** THE ENGINE'S TEXT IS NOT THE SOURCE'S (*the hyphen is written at the cut*, 2026-10-06): the registry is a WeakSet beside `noteSource`, and says only that a text node's characters are the engine's. */
test('a text node the engine wrote is registered as such, and nothing else is', async () => {
  const { noteEngineText: noteEngineTextTyped, isEngineText: isEngineTextTyped } = await import('../src/word-space.ts');
  const noteEngineText = byShape(noteEngineTextTyped);
  const isEngineText = byShape(isEngineTextTyped);
  const written = { nodeType: 3, data: '‐' };
  const author = { nodeType: 3, data: 'exam' };
  noteEngineText(written);
  assert.equal(isEngineText(written), true);
  assert.equal(isEngineText(author), false);
});

/** THE OUTER DISPLAY DECIDES (*the outer display decides*, 2026-09-29): every value here is one Chromium 153 was measured computing. An inline formula is `math` and a block one `block math`; a prefix test on `inline` read both as block-level, and a paragraph holding the first lost its line stack (`packages/essay/cases/72-the-formula-in-the-divided-paragraph`). */
test('a computed display is inline-level when its outer keyword is inline, and block-level by default', async () => {
  const isInlineLevel = byShape((await import('../src/word-space.ts')).isInlineLevel);
  for (const d of ['inline', 'inline-block', 'inline-table', 'inline-flex', 'inline-grid', '-webkit-inline-box', 'inline list-item', 'inline flow-root list-item', 'math', 'ruby', 'ruby-text']) assert.equal(isInlineLevel(d), true, d);
  for (const d of ['block', 'flow-root', 'flex', 'grid', 'table', 'list-item', 'flow-root list-item', '-webkit-box', 'block math', 'block ruby', 'table-row', 'table-cell', 'table-caption', 'none', 'contents']) assert.equal(isInlineLevel(d), false, d);
});

// ── the words a copy is dressed with (*one attribute has words*, 2026-10-10) ───────────────────────

/** An element with the attribute verbs and a children list, the shape the copy registrations read. */
function bearer(attr: any, ...children: any[]) {
  const attrs = new Map(attr == null ? [] : [['data-beltype', attr]]);
  return { children, attrs, getAttribute: (k: any) => attrs.get(k) ?? null, setAttribute: (k: any, v: any) => attrs.set(k, v), removeAttribute: (k: any) => attrs.delete(k) };
}

test('a copy is dressed with its original\'s words as it is registered, added to whatever it inherited, and the original is never written', () => {
  const li = bearer(null);
  const p = bearer('pos:12', li);
  setSourceWords(new WeakMap([[p, ['has:aaaaaa']], [li, ['has:bbbbbb', 'has:cccccc']]]));
  const copy = bearer('pos:12', bearer(null));
  mapCloneToSource(copy, p);
  assert.equal(copy.attrs.get('data-beltype'), 'pos:12 has:aaaaaa', 'the stamp the clone inherited is kept');
  assert.equal(copy.children[0].attrs.get('data-beltype'), 'has:bbbbbb has:cccccc', 'and every element of the copy that matches is dressed, not only the block root');
  assert.equal(sourceOf(copy), p);
  assert.equal(p.attrs.get('data-beltype'), 'pos:12', 'the source is read-only');
  assert.equal(li.attrs.has('data-beltype'), false);
  setSourceWords(new WeakMap<any, any>());
});

test('noteSource dresses one hollow copy; dressWords dresses a measuring clone without registering it', () => {
  const src = bearer(null, bearer(null));
  setSourceWords(new WeakMap([[src.children[0], ['has:dddddd']]]));
  const hollow = bearer(null);
  noteSource(hollow, src.children[0]);
  assert.equal(hollow.attrs.get('data-beltype'), 'has:dddddd');
  const measuring = bearer(null, bearer(null));
  dressWords(measuring, src);
  assert.equal(measuring.children[0].attrs.get('data-beltype'), 'has:dddddd');
  assert.equal(sourceOf(measuring.children[0]), null, 'an unmapped element is still treated as inline: the measuring clone is not registered');
  setSourceWords(new WeakMap<any, any>());
});

// ── the source point of a character (*the engine names the source point*, 2026-10-13) ───────────────

/** A text node with the two verbs the record's writers call. */
function textNode(data: any) {
  return {
    nodeType: 3,
    data,
    splitText(off: any) {
      const tail = textNode(this.data.slice(off));
      this.data = this.data.slice(0, off);
      return tail;
    }
  };
}

test('a text copy keeps, through any removal, which of its characters are the source\'s', () => {
  const source = textNode('one two three four');
  const copy = textNode(source.data);
  noteText(copy, source);
  // The words "one" and "three" go, one pass, and the spaces stay (consuming a fragment's words).
  cutRanges(copy, [{ start: 8, end: 13 }, { start: 0, end: 3 }]);
  assert.equal(copy.data, ' two  four');
  for (let i = 0; i < copy.data.length; i++) {
    const p = sourceTextPoint(copy, i);
    assert.equal(source.data[p.offset], copy.data[i], `character ${i} is the source's own`);
  }
  assert.deepEqual(sourceTextPoint(copy, copy.data.length), { node: source, offset: 18 }, 'the end is the end of the last character');
  // The spaces on the far side of the cut are held and not shown.
  leaveOut(copy, 0, 1);
  leaveOut(copy, 5, 6);
  assert.equal(textPointShowing(copy, 0), null, 'a space before the interval is shown by no page');
  assert.deepEqual(textPointShowing(copy, 4), { offset: 1, strict: true }, 'a source offset names the clone offset that shows it');
  assert.deepEqual(textPointShowing(copy, 8), { offset: 5, strict: false }, 'the end of a shown run is only an edge');
  assert.equal(textPointShowing(copy, 9), null, 'a removed word is shown nowhere');
  // Everything removed leaves nothing to point at.
  cutRanges(copy, [{ start: 0, end: copy.data.length }]);
  assert.equal(sourceTextPoint(copy, 0), null);
});

test('a split hands the tail its share, and a replacement of another length leaves a gap that has no source', () => {
  const source = textNode('alpha beta');
  const copy = textNode(source.data);
  noteText(copy, source);
  cutRanges(copy, [{ start: 0, end: 2 }]);
  const tail = splitTextAt(copy, 4);
  assert.equal(copy.data + tail.data, 'pha beta');
  assert.deepEqual(sourceTextPoint(tail, 0), { node: source, offset: 6 }, 'the tail begins where the head left off');
  assert.deepEqual(sourceTextPoint(copy, 0), { node: source, offset: 2 });
  const soft = textNode('co\u00ADop');
  const soft2 = textNode(soft.data);
  noteText(soft2, soft);
  replaceChars(soft2, 2, 3, '\u2010');
  assert.deepEqual(sourceTextPoint(soft2, 3), { node: soft, offset: 3 }, 'one for one maps one to one');
  replaceChars(soft2, 2, 3, '--');
  assert.equal(soft2.data, 'co--op');
  assert.deepEqual(sourceTextPoint(soft2, 4), { node: soft, offset: 3 }, 'the characters after the engine\'s own are the source\'s again');
  assert.deepEqual(textPointShowing(soft2, 2), { offset: 2, strict: false }, 'the end of what precedes the engine\'s text is only an edge');
  assert.deepEqual(textPointShowing(soft2, 3), { offset: 4, strict: true });
});

// THE WORD SPACE FOLLOWS THE TABLE DISPLAY ORDER (*the-word-space-follows-the-table-display-order*, 2026-11-07): CSS 2.1 §17.2 shows a table's header group before its rows and its footer group after them, wherever each is written, and the index, the paths, the clone-side words and the character walk all count in that order.
test('inDisplayOrder: a table numbers its header group first and its footer group last, wherever each is written, and the index, the paths and the character walk agree', async () => {
  const { inDisplayOrder } = await import('../src/word-space.ts');
  const { elAtIn, pathOf, wordsBeforeChar } = await import('../src/positions.ts');
  const win = { getComputedStyle: (e: any) => ({ display: e.display, position: 'static', getPropertyValue: () => '' }) };
  const ownerDocument = { defaultView: win };
  const el = (display: string, kids: any[]): any => {
    const e: any = { nodeType: 1, display, isConnected: true, ownerDocument, childNodes: kids, parentElement: null, getAttribute: () => null };
    e.children = kids.filter((k) => k.nodeType === 1);
    for (const k of kids) k.parentElement = e;
    return e;
  };
  const text = (data: string) => ({ nodeType: 3, data });
  const row = (word: string) => el('table-row', [el('table-cell', [text(word)])]);
  const foot = el('table-footer-group', [row('f')]);
  const body = el('table-row-group', [row('r0'), row('r1')]);
  const head = el('table-header-group', [row('h')]);
  const table = el('table', [foot, text(' '), body, head]);
  assert.deepEqual(inDisplayOrder(table, [...table.children]), [head, body, foot]);
  const index = indexBlocks([table]);
  assert.deepEqual([head, body, foot].map((g) => index.wordsBefore(g)), [0, 1, 3], 'the header`s word first, then the rows`, then the footer`s');
  assert.equal(elAtIn(table, [0, 0]), head, 'a path counts the table`s children in display order');
  assert.deepEqual(pathOf(foot, table, 0), [0, 2]);
  assert.equal(wordsBeforeChar(table, 0), 3, 'the first character written is the footer`s, its word is the fourth');
  assert.equal(wordsBeforeChar(table, 'f r0r1'.length), 0, 'the header`s character, written last, is the first word');
  const div = el('block', [foot, body]);
  const list = [...div.children];
  assert.equal(inDisplayOrder(div, list), list, 'outside a table the order written stands');
  const html = el('table', [head, body, foot]);
  assert.deepEqual(inDisplayOrder(html, [...html.children]), [head, body, foot], 'a table written in HTML`s order is unchanged');
});
