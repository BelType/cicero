/**
 * An ordered list a page cut divides, held to Chromium's print of the same document: the marker every item prints on every page.
 *
 * @remarks
 * Measured 2026-11-07, under Cicero alone an `<ol>` numbered its items from 1 again on every page it continued onto, and `reversed`, `start`, an item's `value` and a `counter-set` of `list-item` went wrong the same way; printed through the BelType CLI it matched, because Caster's preparation makes each marker real text before the cut. The continued copy of the list now carries a `start` attribute from HTML's own numbering, so the browser's marker counts on from the item the page resumes at.
 *
 * A `counter-reset` of `list-item` on an item changes no marker in Chromium's print (measured 2026-11-07: the item after it and every item after that print the list's own ordinal, with or without `reversed`), though a `counter(list-item)` the item's own content reads sees the reset; the four `counter-reset` cases hold the markers to that.
 *
 * Every list case also runs under `run({ composed: true })`, the Compositor's own lines, and numbers as Chromium prints (2026-11-07): the copy's `start` is written by the fragment builders both modes share.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `pseudo-counters.browser.ts`, whose server and oracle this repeats.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ciceroEngine } from '../../seam/index.ts';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const assets = ciceroEngine.vendorAssets();
const PREFIX = '/_beltype/';
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const docs = new Map<string, string>();
let server: http.Server;
let origin = '';
let browser: Browser;

before(async () => {
  server = http.createServer((req, res) => {
    const name = new URL(req.url ?? '/', 'http://x').pathname;
    const respond = (body: string | Buffer, type: string) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
    if (name.startsWith('/doc/') && docs.has(name.slice(5))) return respond(docs.get(name.slice(5)) as string, 'text/html');
    if (name.startsWith(PREFIX)) {
      const rest = name.slice(PREFIX.length);
      const file = (assets.files as Record<string, string>)[rest];
      const dir = rest.startsWith('cicero/seam/') ? ['cicero/seam/', 'seam/'] : rest.startsWith('cicero/src/') ? ['cicero/src/', 'src/'] : null;
      const found = file ?? (dir ? path.join(dist, dir[1] as string, rest.slice((dir[0] as string).length)) : null);
      if (found && fs.existsSync(found)) return respond(fs.readFileSync(found), TYPES[path.extname(found)] ?? 'application/octet-stream');
    }
    res.writeHead(404); res.end(name);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

const lines = (n: number) => Array.from({ length: n }, (_, i) => `<p>line ${i} of the text</p>`).join('');
/** Twelve lines a page on a 200 × 300 px page; `head` is the engine's head fragment, or nothing for Chromium's own print. */
const doc = (css: string, body: string, head: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${head}<style>
@page { size: 200px 300px; margin: 30px; }
html { font: 12px/20px monospace; } body { margin: 0; } p { margin: 0; } ${css}
</style></head><body>${body}</body></html>`;

/** The words of every page of a PDF that match `pattern`. */
async function wordsOf(pdf: Uint8Array, pattern: RegExp) {
  const file = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const out: string[][] = [];
  for (let i = 1; i <= file.numPages; i++) {
    const text = ((await (await file.getPage(i)).getTextContent()).items as Array<{ str?: string }>).map((t) => t.str ?? '').join('');
    out.push(text.match(pattern) ?? []);
  }
  return out;
}

/** Chromium's print and Cicero's, of the same document. */
async function both(key: string, css: string, body: string, pattern: RegExp, composed = false) {
  const plain = await browser.newPage();
  await plain.setContent(doc(css, body, ''));
  const chromiumPdf = await plain.pdf({ preferCSSPageSize: true });
  await plain.close();
  docs.set(key, doc(css, body, ciceroEngine.headHtml('/')));
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const ran = await page.evaluate((composed) => (window as any).__beltypeCicero.run({ composed }), composed);
  assert.equal(ran.composed, composed, 'the run was in the mode asked for');
  const ciceroPdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  return { chromium: await wordsOf(chromiumPdf, pattern), cicero: await wordsOf(ciceroPdf, pattern) };
}


const items = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `<li>item ${String.fromCharCode(97 + ((from + i) % 26))}</li>`).join('');
const MARKER = /\d+\.(?= *item)/g;
const CSS = 'ol { margin: 0; padding-left: 40px; } li { margin: 0; }';

for (const [name, body] of [
  ['a plain list', `${lines(8)}<ol>${items(10)}</ol>`],
  ['a list with start', `${lines(8)}<ol start="5">${items(10)}</ol>`],
  ['an item with value', `${lines(8)}<ol>${items(2)}<li value="20">item v</li>${items(7)}</ol>`],
  ['a reversed list', `${lines(8)}<ol reversed>${items(10)}</ol>`],
  ['a reversed list with start', `${lines(8)}<ol reversed start="30">${items(10)}</ol>`],
  ['an item with counter-set', `${lines(8)}<ol>${items(1)}<li style="counter-set: list-item 40">item s</li>${items(8)}</ol>`],
  ['an item past the cut with counter-set', `${lines(8)}<ol>${items(6)}<li style="counter-set: list-item 40">item s</li>${items(3)}</ol>`],
  ['an inner list crossing the cut', `${lines(6)}<ol><li>item outer<ol>${items(10)}</ol></li><li>item next</li></ol>`],
  ['an item the cut divides', `${lines(9)}<ol start="7">${items(1)}<li>item ${'word '.repeat(12)}</li>${items(6)}</ol>`],
  ['a reversed list whose item the cut divides', `${lines(9)}<ol reversed>${items(1)}<li>item ${'word '.repeat(12)}</li>${items(6)}</ol>`],
  ['a list divided twice', `${lines(4)}<ol start="3">${items(26)}</ol>`],
  ['an item with counter-reset', `${lines(8)}<ol>${items(2)}<li style="counter-reset: list-item 50">item r</li>${items(7)}</ol>`],
  ['an item past the cut with counter-reset', `${lines(8)}<ol>${items(6)}<li style="counter-reset: list-item 50">item r</li>${items(3)}</ol>`],
  ['a reversed list with an item with counter-reset', `${lines(8)}<ol reversed>${items(2)}<li style="counter-reset: list-item 50">item r</li>${items(7)}</ol>`],
  ['an item with counter-reset and counter-set', `${lines(8)}<ol>${items(1)}<li style="counter-reset: list-item 50; counter-set: list-item 70">item r</li>${items(8)}</ol>`]
] as const) {
  // The same case under the Compositor's own lines (`run({ composed: true })`): the copy's `start` is written by the fragment builders both modes share.
  for (const composed of [false, true]) test(`${name} divided by a page cut numbers its items as Chromium prints them${composed ? ', composed' : ''}`, async () => {
    const out = await both(`${name.replace(/\W+/g, '-')}${composed ? '-composed' : ''}`, CSS, body, MARKER, composed);
    assert.ok(out.chromium.length > 1 && out.chromium[1].length > 0, `the oracle crosses a page: ${JSON.stringify(out.chromium)}`);
    assert.deepEqual(out.cicero, out.chromium, `Cicero ${JSON.stringify(out.cicero)}, Chromium ${JSON.stringify(out.chromium)}`);
  });
}

/** What `.x::after` and the margin box print, apart from the markers. */
const AFTER = /#-?\d+\./g;
const HEAD = /n-?\d+\./g;

for (const [name, body] of [
  ['a list', `${lines(2)}<ol>${items(6)}</ol>${lines(6)}<p class="x">after</p>`],
  ['a list with start', `${lines(2)}<ol start="5">${items(6)}</ol>${lines(6)}<p class="x">after</p>`],
  ['a reversed list with start', `${lines(2)}<ol reversed start="30">${items(6)}</ol>${lines(6)}<p class="x">after</p>`],
  ['a list holding an inner list', `${lines(2)}<ol><li>item o<ol>${items(3)}</ol></li>${items(2)}</ol>${lines(6)}<p class="x">after</p>`]
] as const) {
  test(`counter(list-item) read after ${name}, on the page past it, is the count Chromium prints`, async () => {
    const out = await both(`after-${name.replace(/\W+/g, '-')}`, `${CSS} .x::after { content: " #" counter(list-item) "." }`, body, AFTER);
    assert.ok(out.chromium.length > 1 && out.chromium[1].length > 0, `the oracle crosses a page: ${JSON.stringify(out.chromium)}`);
    assert.deepEqual(out.cicero, out.chromium, `Cicero ${JSON.stringify(out.cicero)}, Chromium ${JSON.stringify(out.chromium)}`);
  });
}

/** Chromium's print shows no document counter in a margin box (0 for every name, measured 2026-11-07), so the reference is Cicero's own reading of a counter the author increments on each item by hand: `list-item` must read as that one does. */
for (const [name, body] of [
  ['a list', `${lines(8)}<ol>${items(10)}</ol>`],
  ['a list with start', `${lines(8)}<ol start="5">${items(10)}</ol>`]
] as const) {
  test(`a margin box's counter(list-item) on the page ${name} continues onto counts the items before it`, async () => {
    const key = name.replace(/\W+/g, '-');
    const start = /start="(\d+)"/.exec(body)?.[1];
    const ref = start ? `ol { counter-reset: q ${Number(start) - 1} }` : 'ol { counter-reset: q }';
    const of = async (counter: string, extra: string) => (await both(`margin-${counter}-${key}`, `${CSS} ${extra} li { counter-increment: q } @page { @top-center { content: "n" counter(${counter}) "." } }`, body, HEAD)).cicero;
    const listItem = await of('list-item', '');
    const hand = await of('q', ref);
    assert.ok(hand.length > 1 && hand[1][0] !== 'n0.', `the reference counts: ${JSON.stringify(hand)}`);
    assert.deepEqual(listItem, hand);
  });
}
