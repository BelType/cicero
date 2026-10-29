/**
 * Two DOM-free corners of the fragment writer: the trailing truncation (`truncateFrom`, the grab's half of the word-granular forcing search — *the grab descends*), and a carried parallel flow's own extent (`mutateToContinuation`'s `remainderPx`).
 *
 * It is pure structural surgery on a tree: everything after a boundary element leaves the fragment, the boundary itself leaves with it unless the command was a `break-after`, and every ancestor the cut passes through is dressed as a fragment that ends there. None of that reads a computed style or a rect, so none of it needs a browser — a node stub carrying the four members the function actually touches (`parentElement`, `nextSibling`, `remove`, `style`) exercises the whole of it, and this package's suites carry no dependencies by rule.
 *
 * What this cannot say is whether the cut lands in the right PLACE; that is `cases/19-forcing-under-sections` in the venue, printed against Chromium.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { truncateFrom as truncateFromTyped, mutateToContinuation as mutateToContinuationTyped, mutateToFirstFragment as mutateToFirstFragmentTyped, spanWidths, markCont as markContTyped, markCut } from '../src/fragments.ts';
import { noteEngineText as noteEngineTextTyped } from '../src/word-space.ts';
import { byShape } from './fakes.ts';

const truncateFrom = byShape(truncateFromTyped);
const mutateToContinuation = byShape(mutateToContinuationTyped);
const mutateToFirstFragment = byShape(mutateToFirstFragmentTyped);
const noteEngineText = byShape(noteEngineTextTyped);
const markCont = byShape(markContTyped);

/**
 * A cut, and the identity map a DOM-free subject needs (*the cut is a place in the tree*, 2026-09-18).
 *
 * Both fragment writers resolve an address against the SOURCE and reach the clone through a source → clone map, so a test that hands one tree as both has to say so with a map. The map is REQUIRED rather than defaulted: in production an unmapped source element would be the source document itself, and writing on it is what C5 forbids — so a missing entry refuses instead of falling back, and this helper is the one place a test supplies its own.
 */
const cut = (path: any, { word = null, char = 0, px = null }: any = {}) => ({ path, word, ...(char > 0 ? { char } : {}), px });
const identityMap = (root: any) => {
  const m = new Map<any, any>();
  (function walk(n) {
    m.set(n, n);
    for (const c of n.children ?? []) walk(c);
  })(root);
  return m;
};
/** `mutateToContinuation` / `mutateToFirstFragment` against one tree standing as both source and clone. */
const asBoth = (root: any, opts: any) => ({ ...opts, source: root, cloneOf: identityMap(root) });

/** The three attribute verbs `data-beltype`'s grammar reads and writes — what an element must answer for the engine to mark it. */
class Bearer {
  attrs = new Map<any, any>();
  getAttribute(name: any) { return this.attrs.get(name) ?? null; }
  setAttribute(name: any, value: any) { this.attrs.set(name, String(value)); }
  removeAttribute(name: any) { this.attrs.delete(name); }
  /** The words of `data-beltype`, as a sorted list — what a test asserts on. */
  get words() { return (this.getAttribute('data-beltype') ?? '').split(/\s+/).filter(Boolean).sort(); }
}

/** The smallest node that `truncateFrom` can tell from a real one. Text nodes are strings' stand-ins: any node with no children. */
class Node extends Bearer {
  declare name: any;
  declare childNodes: any[];
  declare parentElement: any;
  declare style: any;
  constructor(name: any, children: any[] = []) {
    super();
    this.name = name;
    this.childNodes = [];
    this.parentElement = null;
    this.style = {};
    for (const c of children) this.append(c);
  }
  append(child: any) {
    child.parentElement = this;
    this.childNodes.push(child);
  }
  get nextSibling() {
    const kids = this.parentElement?.childNodes;
    if (!kids) return null;
    return kids[kids.indexOf(this) + 1] ?? null;
  }
  remove() {
    const kids = this.parentElement?.childNodes;
    if (kids) kids.splice(kids.indexOf(this), 1);
    this.parentElement = null;
  }
  /** Document order, names only — what the fragment DISPLAYS. A box outside the interval is kept and not displayed since *every branch gets a place* (2026-09-21), where it used to be removed; what these suites always asked is asked of the displayed boxes. */
  get order() {
    return this.words.includes('away') ? [] : [this.name, ...this.childNodes.flatMap((c) => c.order)];
  }
}

const tree = () => {
  const h2 = new Node('h2');
  const p1 = new Node('p1');
  const p2 = new Node('p2');
  const p3 = new Node('p3');
  const inner = new Node('inner', [p2, p3]);
  const tail = new Node('tail');
  return { root: new Node('section', [h2, p1, inner, tail]), h2, p1, p2, p3, inner, tail };
};

test('the boundary box and everything after it leave the fragment, at every level', () => {
  const t = tree();
  truncateFrom(t.root, t.p2);
  assert.deepEqual(t.root.order, ['section', 'h2', 'p1', 'inner']);
});

test('every ancestor the cut passes through is dressed as a fragment that ends there (§5.2), and no other box is touched', () => {
  const t = tree();
  truncateFrom(t.root, t.p3);
  for (const el of [t.root, t.inner]) {
    assert.deepEqual(el.words, ['split', 'start'], `${el.name}: divided, dressed as the box's beginning, not holding its end — the words sheet truncates its trailing margin, border and padding`);
    assert.equal(el.style.marginBottom, undefined, 'and nothing is written inline');
  }
  assert.deepEqual(t.h2.words, [], 'a box entirely above the cut keeps its own decoration');
  assert.deepEqual(t.p2.words, [], 'a surviving sibling of the boundary is not an ancestor of the cut');
});

test('a boundary at the fragment root truncates nothing — a cut before the block is not a cut inside it', () => {
  const t = tree();
  assert.equal(truncateFrom(t.root, t.root), t.root);
  assert.deepEqual(t.root.order, ['section', 'h2', 'p1', 'inner', 'p2', 'p3', 'tail']);
  assert.deepEqual(t.root.words, []);
});

test('a boundary that is a direct child cuts the top level and dresses only the root', () => {
  const t = tree();
  truncateFrom(t.root, t.inner);
  assert.deepEqual(t.root.order, ['section', 'h2', 'p1']);
  assert.deepEqual(t.root.words, ['split', 'start']);
  assert.deepEqual(t.p1.words, []);
});

/** A source element that answers one computed style — all `applyCarriedRemainder` asks of it. */
const sourceWith = (style: any) => ({ ownerDocument: { defaultView: { getComputedStyle: () => style } } });

/** A bare clone with a style bag and the three attribute verbs, as a carried flow's continuation needs. */
const bareClone = () => Object.assign(new Bearer(), { style: {} as any });

test("a carried parallel flow's continuation keeps the extent it has LEFT, not the one it declared (§5.1)", () => {
  // The rail of `cases/21-parallel-flows`: 96mm declared, 226.79px of itself already shown, 136.04px left. Continued at 96mm it asked for its whole height again on every page it reached, and the flow beside it could never close a page.
  const clone = bareClone();
  assert.equal(mutateToContinuation(clone, { remainderPx: 136.04, source: sourceWith({ height: '362.83px', minHeight: 'auto' }) }), clone);
  assert.equal(clone.style.height, '136.04px');
  assert.equal(clone.style.boxSizing, 'border-box');
  assert.equal(clone.style.minHeight, '0');
  // And it is a continuation, so its leading decoration is truncated whether or not any word was consumed here (§5.2): the box's own start edge was drawn on the page before.
  assert.deepEqual(clone.words, ['end', 'split'], 'divided, and not dressed as a start: the words sheet truncates its leading margin, indent, border and padding');
});

test('a min-height declaration is a declared block size too', () => {
  const clone = bareClone();
  mutateToContinuation(clone, { remainderPx: 40, source: sourceWith({ height: 'auto', minHeight: '200px' }) });
  assert.equal(clone.style.height, '40px');
});

test("an auto-height flow is given no extent — its content already is its size, and writing one would clip what the remainder never measured (C10)", () => {
  const clone = bareClone();
  mutateToContinuation(clone, { remainderPx: 40, source: sourceWith({ height: 'auto', minHeight: 'auto' }) });
  assert.equal(clone.style.height, undefined);
  assert.deepEqual(clone.words, ['end', 'split'], 'it is still a continuation');
});

test('no remainder, no extent — the ordinary continuation path is untouched', () => {
  const clone = { style: {} as any };
  mutateToContinuation(clone, {});
  assert.deepEqual(clone.style, {});
});

/**
 * THE FIRST FRAGMENT, DOM-FREE — `mutateToFirstFragment`, which is `mutateToContinuation` read from the other end.
 *
 * The same posture as the truncation tests above: a node stub carrying the members the function actually touches exercises the whole of the surgery, because none of it reads a rect. It needs a little more than `truncateFrom`'s stub did — text nodes, `children`, `textContent`, `contains` and `compareDocumentPosition` — because consuming words is the half `truncateFrom` never had to do. What it cannot say is whether the boundary is in the right PLACE, which is `cases/47-the-line-before-the-cut` in the venue, printed against Chromium.
 */
class Txt {
  declare nodeType: number;
  declare data: any;
  declare childNodes: any[];
  declare parentElement: any;
  constructor(data: any) {
    this.nodeType = 3;
    this.data = data;
    this.childNodes = [];
    this.parentElement = null;
  }
  get textContent() { return this.data; }
}

class El extends Bearer {
  declare nodeType: number;
  declare name: any;
  declare childNodes: any[];
  declare parentElement: any;
  declare style: any;
  declare tagName: string;
  constructor(name: any, children: any[] = []) {
    super();
    this.nodeType = 1;
    this.name = name;
    this.childNodes = [];
    this.parentElement = null;
    this.style = {};
    for (const c of children) this.append(c);
  }
  append(child: any) {
    child.parentElement = this;
    this.childNodes.push(child);
  }
  get children() { return this.childNodes.filter((n) => n.nodeType !== 3); }
  get nextSibling() {
    const kids = this.parentElement?.childNodes;
    return kids ? kids[kids.indexOf(this) + 1] ?? null : null;
  }
  remove() {
    const kids = this.parentElement?.childNodes;
    if (kids) kids.splice(kids.indexOf(this), 1);
    this.parentElement = null;
  }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  contains(node: any) {
    for (let n = node; n; n = n.parentElement) if (n === this) return true;
    return false;
  }
  /** Document order over the whole tree, text nodes included — the two bits the consumption's partition actually asks for. */
  compareDocumentPosition(other: any) {
    let root = this;
    while (root.parentElement) root = root.parentElement;
    const order: any[] = [];
    (function walk(n) { order.push(n); for (const c of n.childNodes) walk(c); })(root);
    const a = order.indexOf(this);
    const b = order.indexOf(other);
    return b < a ? 2 /* PRECEDING */ : b > a ? 4 /* FOLLOWING */ : 0;
  }
  /** The boxes a fragment DISPLAYS, in order. A box outside the interval is kept and not displayed since *every branch gets a place* (2026-09-21) — it used to be removed — so what these suites always asked, *what does this fragment show*, is asked of the displayed boxes; `kept` below is the other half. */
  get order() { return this.words.includes('away') ? [] : [this.name, ...this.children.flatMap((c) => c.order)]; }
  /** Every box still in the tree, displayed or not — what a structural selector reads. */
  get kept() { return [this.name, ...this.children.flatMap((c) => c.kept)]; }
}

test('the words from the boundary leave, and an element left with none of them leaves with them', () => {
  const p1 = new El('p1', [new Txt('alpha beta ')]);
  const p2 = new El('p2', [new Txt('gamma delta')]);
  const root = new El('section', [p1, p2]);
  assert.equal(mutateToFirstFragment(root, asBoth(root, { cut: cut([0], { word: 2 }) })), root);
  assert.deepEqual(root.order, ['section', 'p1'], 'a box entirely past the cut is spent, exactly as one entirely before the resume point is');
  assert.deepEqual(root.kept, ['section', 'p1', 'p2'], 'and it is KEPT: still the section\'s second child, so `:nth-child` and `:has()` read on this page what they read in the source');
  assert.deepEqual(p2.words, ['away'], 'put away: the words sheet gives it display: none');
  assert.equal(p2.style.display, undefined, 'and nothing is written inline');
  assert.equal(root.textContent, 'alpha beta ', 'with its text emptied, so nothing that reads words off a fragment finds another fragment\'s');
});

test('a box holding the boundary word is KEPT, and the innermost box the cut divides is the one both ends share', () => {
  const p = new El('p', [new Txt('one two three four')]);
  const root = new El('section', [p]);
  mutateToFirstFragment(root, asBoth(root, { cut: cut([0, 0], { word: 2 }), extPx: 10 }));
  assert.deepEqual(root.order, ['section', 'p'], 'the box the cut passes through survives it');
  assert.match(root.textContent, /^one two\s*$/);
  // The cut divides the paragraph, not the section, so §5.3's extension lands on the paragraph.
  assert.equal(p.style.paddingBottom, '10px');
  assert.deepEqual(root.words, ['split', 'start'], 'the top-level block is dressed as a fragment that ends at the cut, and grows by wrapping its child');
  assert.deepEqual(p.words, ['split', 'start']);
});

test('no extension, no padding — a cut that already reaches the fragmentainer writes nothing', () => {
  const p = new El('p', [new Txt('one two three four')]);
  const root = new El('section', [p]);
  mutateToFirstFragment(root, asBoth(root, { cut: cut([0, 0], { word: 3 }) }));
  assert.deepEqual(p.words, ['split', 'start'], 'a slice fragment: its bottom padding is the words sheet\'s to zero, and nothing is written over it');
  assert.equal(p.style.paddingBottom, undefined);
});

test('a Class A cut between two siblings divides their CONTAINER, which is what the extension grows', () => {
  const p1 = new El('p1', [new Txt('alpha beta ')]);
  const p2 = new El('p2', [new Txt('gamma delta')]);
  const box = new El('box', [p1, p2]);
  const root = new El('section', [box]);
  // A BARE path to the second paragraph: the boundary is between the two, so the box it divides is the one they sit in.
  mutateToFirstFragment(root, asBoth(root, { cut: cut([0, 0, 1]), extPx: 12 }));
  assert.equal(box.style.paddingBottom, '12px', 'the boundary divides the box the two paragraphs sit in, not either paragraph');
  assert.equal(p1.style.paddingBottom, undefined, 'a box whose content genuinely ends above the cut is not dressed as a fragment');
});

test('a shell path keeps the shelled box whole and drops everything after it', () => {
  const b = new El('b', [new Txt('b')]);
  const c = new El('c', [new Txt('c')]);
  const shelled = new El('shelled', [b, c]);
  const first = new El('first', [new Txt('first ')]);
  const tail = new El('tail', [new Txt('tail')]);
  const root = new El('section', [first, shelled, tail]);
  mutateToFirstFragment(root, asBoth(root, { cut: cut([0, 1], { px: { remaining: 40, paint: null } }), extPx: 6 }));
  assert.deepEqual(root.order, ['section', 'first', 'shelled', 'b', 'c'], "the box whose end gap the cut fell in keeps its content; its remainder continues on the next page as the shell");
  assert.equal(shelled.style.paddingBottom, '6px');
  assert.deepEqual(shelled.words, ['split', 'start']);
});

/** Element and text stand-ins with the three members the resume-by-path walk reads: `nodeType`, `children` and a text node's `data`. */
class PathEl extends Node {
  declare nodeType: number;
  constructor(name: any, children: any[] = []) { super(name, children); this.nodeType = 1; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
}
class PathTxt {
  declare data: any;
  declare nodeType: number;
  declare parentElement: any;
  constructor(data: any) { this.data = data; this.nodeType = 3; this.parentElement = null; }
  get order() { return [this.data === '' ? '""' : this.data]; }
}

test('a resume path keeps the box the cut fell before, whole, and consumes everything before it (case 51: the plate is wordless and was never shown)', () => {
  const plate = new PathEl('img');
  const caption = new PathEl('figcaption', [new PathTxt('cap000')]);
  const figure = new PathEl('figure', [plate, caption]);
  const p0 = new PathEl('p', [new PathTxt('p0w000 p0w001')]);
  const p2 = new PathEl('p', [new PathTxt('p2w000')]);
  const section = new PathEl('section', [p0, figure, p2]);
  const root = mutateToContinuation(section, asBoth(section, { cut: cut([0, 1]) }));
  assert.equal(root, section);
  assert.deepEqual(section.order, ['section', 'figure', 'img', 'figcaption', 'cap000', 'p', 'p2w000'], 'the paragraph before the figure leaves; the plate, its caption and the paragraph after stay');
  assert.deepEqual(section.words, ['end', 'split'], 'the block resumes, so its own leading decoration truncates (§5.2)');
  assert.deepEqual(figure.words, ['adjoin'], 'the box the page resumes at is dressed too: its leading margin adjoins the cut, and it is not divided');
  assert.deepEqual(plate.words, ['adjoin'], 'and so is its first-child chain, through which a margin would collapse');
  assert.deepEqual(caption.words, [], 'the caption is not first: its margin meets the plate, not the cut');
  assert.deepEqual(p2.words, []);
});

test('a resume path descends: siblings before the path are consumed at every level, and the ancestors the cut passes through are dressed', () => {
  const inner = new PathEl('img');
  const wrap = new PathEl('div', [new PathEl('p', [new PathTxt('w0')]), inner, new PathEl('p', [new PathTxt('w1')])]);
  const section = new PathEl('section', [new PathEl('p', [new PathTxt('a')]), wrap, new PathEl('p', [new PathTxt('b')])]);
  mutateToContinuation(section, asBoth(section, { cut: cut([0, 1, 1]) }));
  assert.deepEqual(section.order, ['section', 'div', 'img', 'p', 'w1', 'p', 'b']);
  assert.deepEqual(wrap.words, ['end', 'split'], 'the wrapper is on the chain the cut passes through');
  assert.deepEqual(inner.words, ['adjoin'], 'the box resumed at gives up the margin adjoining the break');
});

/** A path element that can be MARKED, as the presentation's own elements are: the words of `data-beltype` are all the dressing adds to (every element here already answers the three attribute verbs). */
class MarkEl extends PathEl {}

test('the cut divides its ancestors: a box resumed at by a bare path is whole, and only the boxes above it are dressed and marked (case 71)', () => {
  const box = new MarkEl('div', [new PathTxt('a0w000')]);
  const section = new MarkEl('section', [new MarkEl('p', [new PathTxt('p0w000')]), box]);
  mutateToContinuation(section, asBoth(section, { cut: cut([0, 1]) }));
  assert.deepEqual(section.words, ['end', 'split'], 'and marked — divided, not dressed as a start, still holding the box\'s end — so the dressing sheet withholds what it generates at its beginning');
  assert.deepEqual(box.words, ['adjoin'], 'the box’s own margin adjoins the break (§5.2)');
  for (const prop of ['borderTopWidth', 'paddingTop', 'textIndent']) assert.equal(box.style[prop], undefined, `but the box begins on this page, so it keeps its ${prop}`);
  assert.deepEqual(box.words, ['adjoin'], 'and it is not marked as divided: its ::before, ::marker and ::first-line are its own, and only its margin adjoins the break');
});

test('a start-edge cut keeps its zero: [..X, 0] divides X at both ends, and X’s first child is whole (case 71’s box d, at index zero)', () => {
  const build = () => {
    const child = new MarkEl('p', [new PathTxt('d0w000')]);
    const x = new MarkEl('div', [child]);
    const section = new MarkEl('section', [new MarkEl('p', [new PathTxt('p4w000')]), x]);
    return { child, x, section };
  };
  const head = build();
  mutateToFirstFragment(head.section, asBoth(head.section, { cut: cut([0, 1, 0]) }));
  assert.deepEqual(head.section.order, ['section', 'p', 'p4w000', 'div'], 'the page before ends INSIDE X: X stands, its first child leaves');
  assert.deepEqual(head.x.words, ['split', 'start'], 'marked as a box the closing cut passes through: divided, dressed as the box\'s beginning, not holding its end');
  const tail = build();
  mutateToContinuation(tail.section, asBoth(tail.section, { cut: cut([0, 1, 0]) }));
  assert.deepEqual(tail.section.order, ['section', 'div', 'p', 'd0w000']);
  assert.deepEqual(tail.x.words, ['end', 'split'], 'and is marked');
  assert.equal(tail.child.style.borderTopWidth, undefined, 'the first child is whole');
  assert.deepEqual(tail.child.words, ['adjoin'], 'whole: only its margin, which adjoins the break, is truncated');
});

/** THE HYPHEN IS WRITTEN AT THE CUT (*the hyphen is written at the cut*, 2026-10-06; `packages/essay/cases/83-the-hyphen-across`). A word divided at its soft hyphen: the first fragment keeps the letters and the hyphen the browser drew, the continuation the rest. */
test('a cut after a soft hyphen ends the first fragment with the hyphenation character, in place of the soft hyphen', () => {
  const p = new El('p', [new Txt('p0w022 abcdefgh­ijklmnop p0w024')]);
  const root = new El('section', [p]);
  mutateToFirstFragment(root, asBoth(root, { cut: cut([0, 0], { word: 1, char: 9 }) }));
  assert.equal(root.textContent.trimEnd(), 'p0w022 abcdefgh‐', 'the soft hyphen is replaced by U+2010, which the browser draws where its line breaks there, and the rest of the word and the words after it leave');
});

test('the continuation of that cut begins at the character after the soft hyphen', () => {
  const p = new El('p', [new Txt('p0w022 abcdefgh­ijklmnop p0w024')]);
  const root = new El('section', [p]);
  mutateToContinuation(root, asBoth(root, { cut: cut([0, 0], { word: 1, char: 9 }) }));
  assert.equal(root.textContent.trim(), 'ijklmnop p0w024');
});

test('a cut elsewhere in a word writes no hyphen: a silent break is a silent cut', () => {
  const p = new El('p', [new Txt('abcdefgh­ijklmnop')]);
  const root = new El('section', [p]);
  mutateToFirstFragment(root, asBoth(root, { cut: cut([0, 0], { word: 0, char: 4 }) }));
  assert.equal(root.textContent, 'abcd');
});

/** The Compositor's own break: `abcdefgh`, the hyphen it wrote, its `<br>`, then the soft hyphen and the rest. Its cut is before the soft hyphen, in the source's own characters, and the hyphen it wrote stays on the page it ends. */
test('a cut at the Compositor\'s own break keeps the hyphen it wrote on the first page and takes it off the second', () => {
  const build = () => {
    const hyphen = new Txt('‐');
    noteEngineText(hyphen);
    const br = new El('br');
    br.setAttribute('data-beltype', 'break');
    br.tagName = 'BR';
    const p = new El('p', [new Txt('p0w022 abcdefgh'), hyphen, br, new Txt('­ijklmnop p0w024')]);
    return new El('section', [p]);
  };
  const first = build();
  mutateToFirstFragment(first, asBoth(first, { cut: cut([0, 0], { word: 1, char: 8 }) }));
  assert.equal(first.textContent.trimEnd(), 'p0w022 abcdefgh‐', 'the Compositor\'s hyphen is the hyphen the first fragment ends with, and no second one is written');
  const second = build();
  mutateToContinuation(second, asBoth(second, { cut: cut([0, 0], { word: 1, char: 8 }) }));
  assert.equal(second.textContent.trim(), '­ijklmnop p0w024', 'the hyphen is on the page before: the continuation opens on the soft hyphen, which is invisible there');
});

test('a row of cells takes its widths from the measured columns, a spanning cell the sum of the columns it spans, and a row that does not cover them takes none', () => {
  assert.deepEqual(spanWidths([63.2, 58.4, 60, 178.4], [1, 1, 1, 1]), [63.2, 58.4, 60, 178.4]);
  assert.deepEqual(spanWidths([100, 50, 50], [1, 2]), [100, 100], 'a cell spanning two columns is both of them wide');
  assert.deepEqual(spanWidths([100, 50, 50], [0, 2]), [100, 100], 'a span below one is one');
  assert.equal(spanWidths([100, 50, 50], [1, 1]), null, 'a row a rowspan from above left short covers fewer columns than were measured');
  assert.equal(spanWidths([100, 50], [1, 1, 1]), null, 'and one that covers more has been cut differently');
});

test('the piece words say which cut divided a box, in either order: a resumed piece is split without start, a cut-off one split without end, a middle piece split alone', () => {
  const words = (marks: any) => {
    const el = new El('x');
    for (const mark of marks) mark(el);
    return el.words;
  };
  assert.deepEqual(words([markCont]), ['end', 'split'], 'the opening cut divides it: it did not begin the box here, and it holds the box\'s end');
  assert.deepEqual(words([markCut]), ['split', 'start'], 'the closing cut divides it: it is dressed as the beginning and does not hold the end');
  assert.deepEqual(words([markCont, markCut]), ['split']);
  assert.deepEqual(words([markCut, markCont]), ['split'], 'the order the two cuts are applied in is not part of the answer');
  assert.deepEqual(words([markCont, markCont, markCut, markCut]), ['split'], 'and each is idempotent');
  const kept = new El('y');
  kept.setAttribute('data-beltype', 'pos:12 has:3gv2ab');
  markCont(kept);
  assert.equal(kept.getAttribute('data-beltype'), 'pos:12 has:3gv2ab split end', 'a copy keeps the stamp and the words it inherited');
});

// THE HEADER REPEATS (2026-10-14): a copy the engine repeats is in no word of the box it sits in.
test('joinedWords skips a subtree wearing the artifact word, and counts the rest as before', async () => {
  const joinedWords = byShape((await import('../src/fragments.ts')).joinedWords);
  const text = (data: any) => ({ nodeType: 3, data });
  const el = (words: any, childNodes: any) => ({ nodeType: 1, childNodes, getAttribute: (n: any) => (n === 'data-beltype' ? words : null), tagName: 'DIV' });
  const root = el(null, [text('body one '), el('artifact', [text('copy of the header ')]), text('body two')]);
  const words = joinedWords(root, () => false).map((w: any) => w.text);
  assert.deepEqual(words, ['body', 'one', 'body', 'two']);
});
