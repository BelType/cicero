/**
 * The reads loop over a host's own tree (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`, ruling 3), DOM-free: `settleReads` over a plain tree, a one-rule sheet and a `run` of the test's own. Two of the loop's assumptions are pinned: a `target-text()` target is looked for among the host's originals and counts only inside the blocks, and a run that answers `complete: false` is not taken for the whole document.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRead } from '../src/gcpm-encoding.ts';
import { cssString, RESERVATION, settleReads as settleReadsTyped } from '../src/reads.ts';
import { byShape } from './fakes.ts';

const settleReads = byShape(settleReadsTyped);

/** A constructed sheet's double: it keeps the text it is given. */
class Sheet {
  text = '';
  replaceSync(text: string) { this.text = text; }
}

/** An element double: what the loop's walks read of a tree, and nothing more. Selectors are tag names. */
function el(tag: string, attrs: Record<string, string>, children: any[]): any {
  const e: any = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: attrs.id ?? '',
    childNodes: children,
    children: children.filter((c) => c.nodeType === 1),
    parentElement: null,
    getAttribute: (n: string) => attrs[n] ?? null,
    closest: () => null,
    matches: (s: string) => s === tag,
    contains: (o: any) => { for (let x = o; x; x = x.parentElement) if (x === e) return true; return false; },
    descendants: () => e.children.flatMap((c: any) => [c, ...c.descendants()]),
    querySelectorAll: (s: string) => e.descendants().filter((c: any) => c.matches(s)),
    querySelector: (s: string) => { const m = /^\[id="(.*)"\]$/.exec(s); return e.descendants().find((c: any) => (m ? c.id === m[1] : c.matches(s))) ?? null; },
    get textContent() { return children.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join(''); }
  };
  for (const c of children) c.parentElement = e;
  return e;
}
const text = (data: string) => ({ nodeType: 3, data, parentElement: null });

/** A document whose `a::after` reads `prop`, with these top-level elements in tree order; `getElementById` answers the first in tree order, as the platform's does. */
function documentOf(prop: string, tops: any[]) {
  const all = () => tops.flatMap((t) => [t, ...t.descendants()]);
  return {
    styleSheets: [{ cssRules: [{ type: 1, selectorText: 'a::after', style: { getPropertyValue: (n: string) => (n === 'content' ? `var(${prop}, "")` : '') } }] }],
    adoptedStyleSheets: [] as any[],
    defaultView: { CSSStyleSheet: Sheet },
    baseURI: 'https://x.test/d.html',
    URL: 'https://x.test/d.html',
    getElementById: (id: string) => all().find((e) => e.id === id) ?? null,
    querySelectorAll: (s: string) => all().filter((e) => e.matches(s))
  };
}

/** Settle with a `run` that answers `answer` beside the index it is handed; the loop's console lines are held back. */
async function settle(doc: any, how: any, answer: any = { account: [] }) {
  const { info, warn } = console;
  console.info = console.warn = () => {};
  try {
    return await settleReads(doc, { run: async (laid: any) => ({ index: laid.index, ...answer }), ...how });
  } finally {
    Object.assign(console, { info, warn });
  }
}

const textRead = encodeRead({ fn: 'text', attr: 'href', url: null, which: 'content' });
const pageRead = encodeRead({ fn: 'counter', attr: 'href', url: null, counter: 'page', style: 'decimal' });

test('a target-text() target is the document`s, never a host element outside the blocks that carries the same id', async () => {
  const host = el('div', { id: 'intro' }, [text('Host toolbar label')]);
  const link = el('a', { href: '#intro' }, [text('see')]);
  const block = el('p', {}, [link]);
  const delivered = (result: any) => result.delivered?.get('[href="#intro"]')?.get(textRead) ?? null;

  const alone = await settle(documentOf(textRead, [host, block]), { blocksOf: () => [block] });
  assert.equal(delivered(alone), null, 'the host element is the first `#intro` in tree order, outside the blocks: the reference shows nothing');

  const target = el('h2', { id: 'intro' }, [text('Introduction')]);
  const section = el('section', {}, [target]);
  const both = await settle(documentOf(textRead, [host, block, section]), { blocksOf: () => [block, section], originals: [block, section] });
  assert.equal(delivered(both), cssString('Introduction'), 'among the originals the host hands, the author`s element is the target');
});

test('a run that answers complete: false keeps the reservations hidden and the warm values, and is not checked as the whole document', async () => {
  const link = el('a', { href: '#later' }, [text('see')]);
  const block = el('p', {}, [link]);
  const later = el('h2', { id: 'later' }, [text('Later')]);
  const tail = el('section', {}, [later]);
  const doc = documentOf(pageRead, [block, tail]);
  let runs = 0;
  const account = [{ pos: { b: 1, w: 0 }, cut: { path: [1], word: 0, px: null }, carried: null, blank: false, closes: { pageNumber: 1, contentW: 100, contentH: 100, strings: {} } }];
  const { info, warn } = console;
  console.info = console.warn = () => {};
  let result: any;
  try {
    result = await settleReads(doc, { run: async (laid: any) => { runs++; return { account, index: laid.index, complete: false }; }, blocksOf: () => [block, tail], originals: [block, tail], hide: true });
  } finally {
    Object.assign(console, { info, warn });
  }
  assert.equal(runs, 1, 'a partial chain is not sent round again');
  const hider = doc.adoptedStyleSheets.find((s: any) => /visibility: hidden/.test(s.text));
  assert.ok(hider, 'the reservation is still painted invisible: its target is not cut yet');
  assert.equal(result.delivered.get('[href="#later"]').get(pageRead), cssString(RESERVATION), 'and the table kept for the next run is the one it was laid out under');
});
