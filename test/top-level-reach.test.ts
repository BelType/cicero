/**
 * The reach for a unit of replacement that is a whole top-level box (*the forced-break index is kept across runs*, amended 2026-10-25), DOM-free: `capture.js`' `topLevelReach` over a plain tree whose elements answer `matches` for the selectors the reading hands them (a tag, classes, an id, the four combinators), and `ForcingMemo.settle` told the boxes, forgetting the parts of the boxes from the earliest change on and keeping the earlier ones.
 *
 * What a browser adds (that real rules are read off a real CSSOM, and the cost of the reading on the showcase and the manual) is measured next door; what is pinned here is the reading's rule per case and the memo's forgetting, and that `settle(reach)` without boxes is untouched, which `forcing-memo.test.js` and `resumed-reads.test.js` pin as they were.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topLevelReach } from '../src/capture.ts';
import { ForcingMemo } from '../src/forcing-memo.ts';
import { indexBlocks } from '../src/positions.ts';
import { runningBoxes } from '../src/driver.ts';
import { RUNNING_PROP } from '../src/gcpm-encoding.ts';

/** `tag#id.class.class`, with children. */
function el(spec, ...children) {
  const [, tag, id = '', cls = ''] = /^(\w+)(?:#([\w-]+))?((?:\.[\w-]+)*)$/.exec(spec) ?? [];
  const e = {
    tagName: tag.toUpperCase(), id, classes: cls.split('.').filter(Boolean), children, parentElement: null,
    matches: ( sel: string) => matches(e, sel),
    get nextElementSibling() { const s = e.parentElement?.children ?? []; return s[s.indexOf(e) + 1] ?? null; }
  };
  for (const c of children) c.parentElement = e;
  return e;
}

/** A selector of compounds (a tag or `*`, classes, an id, an `:is()`, `:where()` or `:not()` of such compounds) and the four combinators, matched right to left; anything else throws, as a browser's `matches` throws on what it cannot parse. */
function matches(element, selector) {
  const parts = selector.trim().replace(/,\s+/g, ',').split(/\s*([>+~])\s*|\s+/);
  const compound = (e, c) => {
    let wrapped = true;
    c = c.replace(/:(is|where|not)\(([^()]*)\)/g, (_, name, list) => { if (list.split(',').some((s) => compound(e, s)) === (name === 'not')) wrapped = false; return ''; });
    const m = /^([a-z]\w*|\*)?((?:[.#][\w-]+)*)$/i.exec(c);
    if (!m) throw new SyntaxError(c);
    if (!wrapped) return false;
    if (m[1] && m[1] !== '*' && e.tagName !== m[1].toUpperCase()) return false;
    return (m[2].match(/[.#][\w-]+/g) ?? []).every((s) => (s[0] === '.' ? e.classes.includes(s.slice(1)) : e.id === s.slice(1)));
  };
  const at = (e, i) => {
    if (!e || !compound(e, parts[i])) return false;
    if (i === 0) return true;
    const comb = parts[i - 1] ?? ' ';
    const before = () => { const s = e.parentElement?.children ?? []; return s.slice(0, s.indexOf(e)); };
    if (comb === '>') return at(e.parentElement, i - 2);
    if (comb === '+') return at(before().at(-1), i - 2);
    if (comb === '~') return before().some((s) => at(s, i - 2));
    for (let a = e.parentElement; a; a = a.parentElement) if (at(a, i - 2)) return true;
    return false;
  };
  return at(element, parts.length - 1);
}

/** The document: `html > body > div#holder > boxes`, wearing one sheet of the given rules (a string is a style rule's selector). */
function documentOf(boxes, rules) {
  const holder = el('div#holder', ...boxes);
  el('html', el('body', holder));
  const doc = { styleSheets: [{ cssRules: rules.map((r) => (typeof r === 'string' ? { selectorText: r } : r)) }], adoptedStyleSheets: [] };
  return { doc, holder, boxes: () => [...holder.children] };
}

/** Put `fresh` in `old`'s place (or before `before` where `old` is null; take `old` out where `fresh` is null), and report both to the memo, as a host holding its own pages does. */
function edit(holder, memo, { old = null, fresh = null, before = null }) {
  const kids = holder.children;
  if (old && fresh) kids[kids.indexOf(old)] = fresh;
  else if (old) kids.splice(kids.indexOf(old), 1);
  else kids.splice(before ? kids.indexOf(before) : kids.length, 0, fresh);
  if (old) { old.parentElement = null; memo.replaced(old); }
  if (fresh) { fresh.parentElement = holder; memo.replaced(fresh); }
}

/** The ids of the boxes whose part the memo kept: each box is asked once, and a box read is not kept. */
const keptOf = (memo, boxes) => boxes.filter((b) => { let read = false; memo.keep('part', b, () => { read = true; return b.id; }); return !read; }).map((b) => b.id);

/** Settle under the top-level unit, the reach read off the sheets and the boxes, as the consumer does: the reach, whether the memo is usable, and the ids it kept. */
function settled(doc, memo, boxes) {
  const reach = topLevelReach(doc, boxes, memo.boxes);
  const usable = memo.settle(reach, boxes);
  return { reach, usable, kept: usable ? keptOf(memo, boxes) : [] };
}

/** A memo filled over `boxes` under the unit. */
function filled(doc, boxes) {
  const memo = new ForcingMemo();
  memo.settle(topLevelReach(doc, boxes, memo.boxes), boxes);
  keptOf(memo, boxes);
  return memo;
}

const flat = () => [el('h2#a'), el('p#b'), el('p#c'), el('p#d')];
const sections = () => [el('section#s1', el('h2'), el('p')), el('section#s2', el('h2.wide'), el('p')), el('section#s3', el('h2'), el('p'))];

test('a + at the top level: the boxes from the replaced one on are read again, the earlier ones kept', () => {
  const { doc, holder, boxes } = documentOf(flat(), ['h2 + p']);
  const memo = filled(doc, boxes());
  edit(holder, memo, { old: boxes()[2], fresh: el('p#c2') });
  assert.deepEqual(settled(doc, memo, boxes()), { reach: 1, usable: true, kept: ['a', 'b'] });
});

test('a box taken out with nothing in its place: the order says where it stood', () => {
  const { doc, holder, boxes } = documentOf(flat(), ['h2 ~ p']);
  const memo = filled(doc, boxes());
  edit(holder, memo, { old: boxes()[1] });
  assert.deepEqual(settled(doc, memo, boxes()), { reach: 1, usable: true, kept: ['a'] });
});

test('a + whose left side only a box the edit took out could be: the detached box is asked by its compound', () => {
  const { doc, holder, boxes } = documentOf([el('h2#a.x'), el('p#b'), el('p#c')], ['.x + p']);
  const memo = filled(doc, boxes());
  edit(holder, memo, { old: boxes()[0], fresh: el('h2#a2') });
  assert.equal(topLevelReach(doc, boxes(), memo.boxes), 1, 'b followed a .x; now it does not, and no .x remains among the boxes');
});

test('a + inside a box: nothing beyond the replaced box', () => {
  const { doc, holder, boxes } = documentOf(sections(), ['h2 + p', 'section > h2 + p']);
  const memo = filled(doc, boxes());
  edit(holder, memo, { old: boxes()[1], fresh: el('section#s2b', el('h2'), el('p')) });
  assert.deepEqual(settled(doc, memo, boxes()), { reach: 0, usable: true, kept: ['s1', 's3'] });
});

test('a :has() looking down or sideways inside a box crosses no box, the engine\'s union of it neither', () => {
  const studio = 'li > p:first-child:not(:has(~ p), [class], [id], [lang], [aria-label])';
  const union = (sel, arg, bare) => `${sel}:is(:where([data-beltype~="has:abc123"]):is(*, ${bare}), :where(:not([data-beltype~="fragment"])):has(${arg}))`;
  for (const rule of ['section:has(> h2.wide)', union('section', '> h2.wide', 'h2.wide'), studio, `li > p:first-child:not(${union('', '~ p', 'p')})`, 'section:has(h2 ~ p)']) {
    const { doc, holder, boxes } = documentOf(sections(), [rule]);
    const memo = filled(doc, boxes());
    edit(holder, memo, { old: boxes()[1], fresh: el('section#s2b', el('h2'), el('p')) });
    assert.deepEqual(settled(doc, memo, boxes()), { reach: 0, usable: true, kept: ['s1', 's3'] }, rule);
  }
});

test('a :has() opening sideways whose subject is a top-level box: the boxes before the edit depend on it, and nothing is kept', () => {
  for (const [boxesOf, rule] of [[flat, 'h2:has(~ p)'], [sections, 'section:has(+ section)'], [flat, 'h2:has(+ p.lead, > em)']]) {
    const { doc, holder, boxes } = documentOf(boxesOf(), [rule]);
    const memo = filled(doc, boxes());
    edit(holder, memo, { old: boxes().at(-1), fresh: el('p#z') });
    assert.deepEqual(settled(doc, memo, boxes()), { reach: 2, usable: false, kept: [] }, rule);
  }
});

test('a :has() whose subject is an ancestor of the boxes, and an @container rule: everything', () => {
  class CSSContainerRule { cssRules = []; }
  for (const rule of ['body:has(.x) p', ':has(.x)', 'div:has(> section.x)', new CSSContainerRule()]) {
    const { doc, boxes } = documentOf(sections(), [rule]);
    assert.equal(topLevelReach(doc, boxes(), []), 2, String(rule.selectorText ?? rule.constructor.name));
  }
  const { doc, holder, boxes } = documentOf(sections(), ['body:has(.x) p']);
  const memo = filled(doc, boxes());
  edit(holder, memo, { old: boxes()[1], fresh: el('section#s2b') });
  assert.deepEqual(settled(doc, memo, boxes()), { reach: 2, usable: false, kept: [] });
  // Refused and emptied, and the boxes recorded: the next settle reads everything, fills, and keeps from there.
  assert.equal(memo.boxes.length, 3);
});

test(':first-child on the boxes: a box inserted stales the boxes after it, a box replaced in place nothing beyond it', () => {
  const { doc, holder, boxes } = documentOf(sections(), ['section:first-child']);
  const memo = filled(doc, boxes());
  edit(holder, memo, { fresh: el('section#n'), before: boxes()[1] });
  assert.deepEqual(settled(doc, memo, boxes()), { reach: 1, usable: true, kept: ['s1'] });
  edit(holder, memo, { old: boxes()[2], fresh: el('section#s2b') });
  assert.deepEqual(settled(doc, memo, boxes()), { reach: 0, usable: true, kept: ['s1', 'n', 's3'] });
});

test(':last-child on the boxes with an insertion is everything; a structural pseudo-class no box can carry is nothing', () => {
  const last = documentOf(sections(), ['section:last-child']);
  let memo = filled(last.doc, last.boxes());
  edit(last.holder, memo, { fresh: el('section#n') });
  assert.equal(topLevelReach(last.doc, last.boxes(), memo.boxes), 2);
  const inner = documentOf(sections(), ['p:first-child', 'section > p:last-child', 'section p:nth-child(2n+1)']);
  memo = filled(inner.doc, inner.boxes());
  edit(inner.holder, memo, { fresh: el('section#n'), before: inner.boxes()[0] });
  assert.equal(topLevelReach(inner.doc, inner.boxes(), memo.boxes), 0);
});

test(':nth-of-type is moved by any change of a box, :nth-child(… of …) by any replacement', () => {
  const typed = documentOf(flat(), ['p:nth-of-type(2)']);
  let memo = filled(typed.doc, typed.boxes());
  edit(typed.holder, memo, { old: typed.boxes()[1], fresh: el('h2#b2') });
  assert.equal(topLevelReach(typed.doc, typed.boxes(), memo.boxes), 1);
  const of = documentOf(flat(), ['p:nth-child(2 of .lead)']);
  memo = filled(of.doc, of.boxes());
  edit(of.holder, memo, { old: of.boxes()[1], fresh: el('p#b2.lead') });
  assert.equal(topLevelReach(of.doc, of.boxes(), memo.boxes), 1);
});

test('a nested rule is read as it matches, its & the parent\'s selector in :is()', () => {
  const card = { selectorText: '.card', parentRule: null };
  const media = { selectorText: undefined, parentRule: card };
  for (const [rule, boxesOf, reach] of [
    [{ selectorText: '& p + p', parentRule: card }, sections, 0],
    [{ selectorText: 'p + p', parentRule: media }, sections, 0],
    [{ selectorText: '& + p', parentRule: { selectorText: 'h2' } }, flat, 1],
    [{ selectorText: '+ p', parentRule: { selectorText: 'h2' } }, flat, 1],
    [{ selectorText: '& span', parentRule: { selectorText: 'h2 + p' } }, flat, 2],
    [{ selectorText: '& + p' }, flat, 2]
  ]) {
    const { doc, boxes } = documentOf(boxesOf(), [rule]);
    assert.equal(topLevelReach(doc, boxes(), boxes()), reach, `${rule.parentRule?.selectorText ?? rule.parentRule?.parentRule?.selectorText ?? ''} { ${rule.selectorText} }`);
  }
});

test('a wrapper of plain compounds is matched as it stands, so a sibling combinator whose left side no top-level box can be crosses nothing', () => {
  // The studio's quiet press: none of its top-level boxes is an h2 or any of the list, so the rule relates no two of them.
  const press = ':is(header, h2, h3, figure, blockquote, ul, ol, table, section) > p:first-child, :is(h2, h3, figure, blockquote, ul, ol, table, header) + p';
  for (const [rule, boxesOf, reach] of [
    [press, sections, 0],
    [':is(h2, h3) + p', sections, 0],
    [':where(h2.wide) ~ p', sections, 0],
    [':not(section) + p', sections, 0],
    [':is(h2, h3) + p', flat, 1],
    [':not(section) + p', flat, 1],
    // A wrapper holding a pseudo-class or a combinator is still taken out, which only widens what it matches.
    [':is(h2, :hover) + p', sections, 1],
    [':is(h2 em) + p', sections, 1]
  ]) {
    const { doc, boxes } = documentOf(boxesOf(), [rule]);
    assert.equal(topLevelReach(doc, boxes(), boxes()), reach, rule);
  }
});

test('what the reading cannot place is answered on the conservative side', () => {
  for (const rule of ['h2 + p[title="x', ':is(h2 + p) em', ':not(div ~ div) p', 'section ~ ~ p']) {
    const { doc, boxes } = documentOf(sections(), [rule]);
    assert.equal(topLevelReach(doc, boxes(), boxes()), 2, String(rule.selectorText ?? rule));
  }
  // An unreadable sheet might say anything.
  const { doc, boxes } = documentOf(sections(), []);
  doc.styleSheets.push({ get cssRules() { throw new Error('cross-origin'); } });
  assert.equal(topLevelReach(doc, boxes(), []), 2);
});

test('what only looks like a combinator is not one', () => {
  for (const rule of ['section[title~="a"]', 'p[data-x="a + b"]', 'section:nth-child(2n+1)', 'a\\+b']) {
    const { doc, boxes } = documentOf(sections(), [rule]);
    assert.equal(topLevelReach(doc, boxes(), boxes()), 0, rule);
  }
});

test('reach 0 under the unit: the replaced and moved boxes are read again, every other box is kept', () => {
  const { doc, holder, boxes } = documentOf(flat(), ['p em']);
  const memo = filled(doc, boxes());
  const [a, b, c, d] = boxes();
  // c moved before b, d replaced.
  holder.children.splice(0, 4, a, c, b, d);
  memo.replaced(c);
  edit(holder, memo, { old: d, fresh: el('p#d2') });
  assert.deepEqual(settled(doc, memo, boxes()), { reach: 0, usable: true, kept: ['a', 'b'] });
});

test('the position index: a block\'s part is kept when a block is inserted before it, and stamped with its new number', () => {
  const t = (data) => ({ nodeType: 3, data });
  const block = (...kids) => ({ nodeType: 1, style: {}, childNodes: kids, children: kids.filter((k) => k.nodeType === 1) });
  const p = block(t('two words'));
  const blocks = [block(t('one')), block(t('alpha'), p)];
  const memo = new ForcingMemo();
  const first = indexBlocks(blocks, () => false, () => false, memo.keep);
  assert.equal(first.entryFor(p).block, 1);
  blocks.unshift(block(t('new words here')));
  memo.replaced((blocks[0] as any));
  memo.settle(0);
  const again = indexBlocks(blocks, () => false, () => false, memo.keep);
  assert.deepEqual(memo.tally.index, { kept: 2, read: 1 });
  assert.equal(again.entryFor(p).block, 2, 'the kept part answers the block it stands in now');
  assert.equal(first.entryFor(p).block, 1, 'and the index laid before keeps its own');
  assert.deepEqual({ bases: again.bases, total: again.total, at: again.entryFor(p) }, (() => { const fresh = indexBlocks(blocks, () => false, () => false); return { bases: fresh.bases, total: fresh.total, at: fresh.entryFor(p) }; })());
});

test('the running elements: each top-level box\'s are kept through the door, and the block numbers laid on afresh', () => {
  const style = (name) => ({ getPropertyValue: (prop) => (prop === RUNNING_PROP ? name : ''), position: 'static' });
  let reads = 0;
  const head = el('p#head');
  const after = el('p#after');
  const top = el('header#top');
  const body = el('body', top, el('section#s1', head, after), el('section#s2', el('p')));
  const running = new Map([[head, 'chapter'], [top, 'title']]);
  const doc = ({ body, defaultView: { getComputedStyle: (e) => (reads++, style(running.get(e) ?? '')) } } as any);
  const memo = new ForcingMemo();
  const fresh = runningBoxes(doc);
  assert.deepEqual(runningBoxes(doc, memo.keep), fresh);
  reads = 0;
  // A section inserted before the first: its own box is walked, the others' parts are kept, and the running element inside s1 is now in block 1.
  const inserted = el('section#n', el('p'));
  body.children.splice(1, 0, inserted);
  inserted.parentElement = body;
  memo.replaced(inserted);
  memo.settle(0);
  const kept = runningBoxes(doc, memo.keep);
  assert.equal(reads, 2, 'the new section and its paragraph, and nothing else');
  assert.deepEqual(kept, runningBoxes(doc));
  assert.deepEqual(kept.map((r) => [r.el.id, r.name, r.block, r.next?.id ?? null]), [['top', 'title', 0, null], ['head', 'chapter', 1, 'after']]);
});
