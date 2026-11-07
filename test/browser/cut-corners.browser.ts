/**
 * A rounded box divided by a page's cut: under `box-decoration-break: slice` the corners at the cut edges are square, and under `clone` each piece keeps all four (css-break-3 §5.4). Measured 2026-11-07 in Chromium's own print of the same box, rasterized: the slice's first page has a rounded top and a square bottom, its second a square top; the clone's corners are all rounded.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`; the server repeats `table-groups.browser.ts`'s.
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

/** The four corner radii of the box's piece on each page, top-left, top-right, bottom-right, bottom-left. */
async function corners(name: string, decoration: string) {
  docs.set(name, `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>html { font: 16px/1.5 serif; } body { margin: 0 } @page { size: 300px 300px; margin: 20px; } #box { box-decoration-break: ${decoration}; border: 4px solid; border-radius: 40px; padding: 8px }</style></head><body><div id="box">${'word '.repeat(300)}</div></body></html>`);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    await (window as any).__beltypeCicero.run();
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    // A page is `content-visibility: auto`, and one a frame has not seen is not laid out.
    for (const p of pages) {
      p.scrollIntoView();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    return pages.map((p) => {
      const box = [...p.shadowRoot!.querySelectorAll('slot')].flatMap((s) => s.assignedNodes({ flatten: true })).find((n) => n.nodeType === 1 && (n as Element).id === 'box') as Element;
      const s = getComputedStyle(box);
      return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
    });
  });
  await page.context().close();
  return out;
}

test('a rounded box sliced by the cut has square corners at each cut edge, and a cloned one keeps them', async () => {
  const sliced = await corners('slice', 'slice');
  assert.ok(sliced.length >= 3, `${sliced.length} pages`);
  const round = ['40px', '40px'];
  const square = ['0px', '0px'];
  assert.deepEqual(sliced[0], [...round, ...square], 'the first piece: rounded at the top, square at the cut');
  for (const middle of sliced.slice(1, -1)) assert.deepEqual(middle, [...square, ...square], 'a middle piece: square at both cuts');
  assert.deepEqual(sliced.at(-1), [...square, ...round], 'the last piece: square at the cut, rounded at the bottom');
  const cloned = await corners('clone', 'clone');
  for (const piece of cloned) assert.deepEqual(piece, [...round, ...round], 'a cloned piece keeps its four corners');
});
