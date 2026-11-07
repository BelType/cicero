/**
 * The page context's lengths Chromium resolves and Cicero refused, in a real browser (Codeberg issue 10): `size` in `em`, a bare orientation keyword, and a custom property set on the root.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `release.browser.ts`, whose server this repeats in small.
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

const doc = (style: string) => `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>html { font: 16px/1.5 serif; } body { margin: 0 } ${style}</style></head><body><p>One page.</p></body></html>`;

/** Run the document and read the first page's box and its content area, in px, or the refusal. */
async function firstPage(name: string, html: string) {
  docs.set(name, html);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    try {
      await (window as any).__beltypeCicero.run();
    } catch (e: any) {
      return { error: String(e.message) };
    }
    const first = document.querySelector('beltype-root')!.shadowRoot!.querySelector('beltype-page')!;
    const host = first.getBoundingClientRect();
    const area = first.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect();
    return { w: host.width, h: host.height, areaTop: area.top - host.top, areaLeft: area.left - host.left };
  });
  await page.context().close();
  return out as { error?: string; w?: number; h?: number; areaTop?: number; areaLeft?: number };
}

// The host is one px shorter than the sheet, the print-safety inset `applyConditions` takes off the bottom margin (`chase.ts`).
test('size in em resolves against the root font: 20em 7em at 16px is 320 by 112', async () => {
  const out = await firstPage('em', doc('@page { size: 20em 7em; margin: 10px; }'));
  assert.equal(out.error, undefined, out.error);
  assert.deepEqual([out.w, out.h], [320, 112 - 1]);
});

test('a bare orientation keyword turns the sheet the cascade already gave: :first { size: portrait } on 300 by 200 is 200 by 300', async () => {
  const out = await firstPage('orientation', doc('@page { size: 300px 200px; margin: 10px; } @page :first { size: portrait }'));
  assert.equal(out.error, undefined, out.error);
  assert.deepEqual([out.w, out.h], [200, 300 - 1]);
});

test('a custom property set on the root reaches the page context: margin: var(--m) with :root { --m: 25px }', async () => {
  const out = await firstPage('custom', doc(':root { --m: 25px } @page { size: 300px 200px; margin: var(--m); }'));
  assert.equal(out.error, undefined, out.error);
  assert.deepEqual([out.areaTop, out.areaLeft], [25, 25]);
});

test('a custom property holding a two-value shorthand, the WPT case: margin: var(--m) with :root { --m: 20px 40px }', async () => {
  const out = await firstPage('custom2', doc(':root { --m: 20px 40px } @page { size: 400px 200px; margin: var(--m); }'));
  assert.equal(out.error, undefined, out.error);
  assert.deepEqual([out.areaTop, out.areaLeft], [20, 40]);
});
