/**
 * The pour again doubles its words without pouring while the place stays where it was (critic2-long-paragraph-quadratic, 2026-11-09).
 *
 * @remarks
 * The Cast-off's place is the first block boundary at or past the cursor and the words, moved past a box the bound never cuts inside (`boundAt`). Where the words land inside such a box, a table of many words and few pixels here, every doubling that still lands inside it names the same place, and the driver built, laid out and reported the same feed again each time. Read off `cicero:feed`'s `reach`, the words one pour covers: no page pours the same reach twice.
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

/** A paragraph, a table of 130 one-pixel rows of twenty words each, then thirty paragraphs, on 400 × 300 pages. */
const document_ = () => {
  const words = 'aa bb cc dd ee ff gg hh ii jj kk ll mm nn oo pp qq rr ss tt';
  const rows = Array.from({ length: 130 }, () => `<tr><td>${words}</td></tr>`).join('');
  const after = Array.from({ length: 30 }, (_, i) => `<p>P${i + 1} lorem ipsum dolor sit amet</p>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${ciceroEngine.headHtml('/')}<style>@page { size: 400px 300px; margin: 20px; } html { font: 14px/20px sans-serif; } body { margin: 0; } p { margin: 0 0 10px; } table { border-spacing: 0; font: 1px/1px sans-serif; } td { padding: 0; }</style></head><body><p>P0 lorem ipsum dolor sit amet</p><table><tbody>${rows}</tbody></table>${after}</body></html>`;
};

test('no page pours the same feed twice', async () => {
  docs.set('doubling', document_());
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/doubling`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const done = await page.evaluate(() => (window as any).__beltypeCicero.run());
  assert.equal(done.complete, true);
  const feeds = await page.evaluate(() => performance.getEntriesByName('cicero:feed').map((e) => (e as PerformanceMeasure).detail as { page: number; reach: number; pours: number }));
  const byPage = new Map<number, number[]>();
  for (const f of feeds) byPage.set(f.page, [...(byPage.get(f.page) ?? []), f.reach]);
  assert.ok(byPage.size > 1, `more than one page: ${JSON.stringify([...byPage])}`);
  for (const [p, reach] of byPage) assert.equal(new Set(reach).size, reach.length, `page ${p + 1} poured the same reach twice: ${JSON.stringify(reach)}`);
  await page.context().close();
});
