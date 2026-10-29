/**
 * The reads loop compares a page site against the page values the layout was cut under (CHANGELOG 2026-10-28), DOM-free: `settleReads` over a plain tree and a one-rule sheet that reads `counter(page)`, with a `run` of the test's own.
 *
 * What a browser adds (the measure of a site's lines when a value does differ) is proved next door, by the venue's reads gates and the CLI's own round; what is pinned here is which table the loop calls "laid under": the one the run returns beside its `account` where it returns one, and the one it was handed otherwise.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleReads as settleReadsTyped, pageFactsOf } from '../src/reads.ts';
import { byShape } from './fakes.ts';

const settleReads = byShape(settleReadsTyped);

const text = (data: any) => ({ nodeType: 3, data });
/** A document of one paragraph whose `::before` reads `counter(page)`, a plain tree the loop can walk: the rule's selector asked of `matches`, the block's words counted off `childNodes`. */
function documentOf() {
  const p = { nodeType: 1, tagName: 'P', childNodes: [text('alpha beta gamma')], children: [], parentElement: null, matches: (s: any) => s === 'p', querySelectorAll: () => [], closest: () => null };
  const doc = { styleSheets: [{ cssRules: [{ type: 1, selectorText: 'p::before', style: { getPropertyValue: (name: any) => (name === 'content' ? 'counter(page)' : '') } }] }], adoptedStyleSheets: [] };
  return { doc, p };
}

/** The account of one page closing at the document's end, which is all the loop reads of it here. */
const account = [{ pos: null, cut: { path: [0], word: null, px: null }, carried: null, blank: false, closes: { pageNumber: 1, contentW: 100, contentH: 100, strings: {} } }];
const truth = pageFactsOf(account);
/** A page value that is not the truth: the Ledger's warm table, as a document that had two pages left it. */
const stale = [{ counterReset: 'page 1 pages 2', props: {} }];

/** Settle with a `run` that records what it was handed and answers with `answer(laid)` beside the account; the loop's own console line is held back. */
async function settle(answer: any, warmFacts: any) {
  const { doc, p } = documentOf();
  const handed: any[] = [];
  const info = console.info;
  console.info = () => {};
  try {
    const result = await settleReads(doc, { run: async (laid: any) => { handed.push(laid.facts); return { account, index: laid.index, ...answer(laid) }; }, blocksOf: () => [p], originals: [p], warmFacts });
    return { result, handed };
  } finally {
    console.info = info;
  }
}

test('a run that returns the page values it was laid out under settles in one run, whatever table the loop handed it', async () => {
  const { result, handed } = await settle(() => ({ laidFacts: truth }), stale);
  assert.equal(handed.length, 1, 'the page laid itself out under its own interval`s values, which are the truth: nothing moved, nothing is measured, no second run');
  assert.deepEqual(handed[0], stale, 'the loop still hands the run the table it holds');
  assert.equal(result.reads.runs, 1);
  assert.deepEqual(result.facts, truth, 'the table the Ledger keeps is the truth');
});

test('a run that returns nothing beside its account is compared as before: the table the loop handed it is the table it was laid out under', async () => {
  const { result, handed } = await settle(() => ({}), truth);
  assert.equal(handed.length, 1, 'handed the truth and laid out under it, as the driver does');
  assert.deepEqual(result.facts, truth);
});
