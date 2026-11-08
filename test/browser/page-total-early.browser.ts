/**
 * A flow site that reads `counter(pages)` is invisible while the pages are shown before the total is known (cicero flow-counter-pages-visible-early, 2026-11-08).
 *
 * @remarks
 * `hideReservations` hid only cross-reference reservations, so `p::before { content: counter(pages) }` in the flow printed its reservation, `0`, on every page of a paced `run({ until: { pages: 1 } })`. The page total is blank until the run is complete (the header of `src/chase.ts`), and a flow site that reads it is hidden the same way until then.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, on the harness of `release.browser.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { ciceroEngine } from '../../seam/index.ts';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const assets = ciceroEngine.vendorAssets();
const PREFIX = '/_beltype/';
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/** The documents the tests serve, by name. */
const docs = new Map<string, string>();
let server: http.Server;
let origin = '';
let browser: Browser;

const respond = (res: http.ServerResponse, body: string | Buffer, type: string) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const name = url.pathname;
    if (name.startsWith('/doc/') && docs.has(name.slice(5))) return respond(res, docs.get(name.slice(5)) as string, 'text/html');
    if (name.startsWith(PREFIX)) {
      const rest = name.slice(PREFIX.length);
      const file = (assets.files as Record<string, string>)[rest];
      const dir = rest.startsWith('cicero/seam/') ? ['cicero/seam/', 'seam/'] : rest.startsWith('cicero/src/') ? ['cicero/src/', 'src/'] : null;
      const found = file ?? (dir ? path.join(dist, dir[1] as string, rest.slice((dir[0] as string).length)) : null);
      if (found && fs.existsSync(found)) return respond(res, fs.readFileSync(found), TYPES[path.extname(found)] ?? 'application/octet-stream');
    }
    res.writeHead(404); res.end(name);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });


/** Forty paragraphs on 240-px pages, the first one reading the page total in its `::before`. */
const document_ = () => {
  const body = Array.from({ length: 40 }, (_, i) => `<p${i === 0 ? ' class="total"' : ''}>Paragraph ${i}. Pack my box with five dozen liquor jugs, and then sphinx of black quartz judge my vow.</p>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${ciceroEngine.headHtml('/')}<style>@page { size: 240px 240px; margin: 20px; } body { margin: 0; font: 14px/1.65 serif; } .total::before { content: "of " counter(pages) " "; }</style></head><body>${body}</body></html>`;
};

test('a flow site reading counter(pages) is hidden under a paced run and shown once the total is known', async () => {
  docs.set('total', document_());
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/total`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  /** The visibility of every presented flow site's `::before`. */
  const sites = () => page.evaluate(() => {
    return [...document.querySelectorAll('beltype-root .total')].map((el) => { const s = getComputedStyle(el, "::before"); return { visibility: s.visibility }; });
  });
  const first = await page.evaluate(() => (window as any).__beltypeCicero.run({ until: { pages: 1 } }));
  assert.equal(first.complete, false);
  const early = await sites();
  assert.ok(early.length > 0, 'the flow site is presented');
  assert.ok(early.every((s) => s.visibility === 'hidden'), `hidden before the total is known: ${JSON.stringify(early)}`);
  const done = await page.evaluate(() => (window as any).__beltypeCicero.run());
  assert.equal(done.complete, true);
  const late = await sites();
  assert.ok(late.length > 0 && late.every((s) => s.visibility === 'visible'), `shown once it is: ${JSON.stringify(late)}`);
  await page.context().close();
});
