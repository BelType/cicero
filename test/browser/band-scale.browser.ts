/**
 * The margin bands are measured in the page's own pixels, whatever scale a host draws the page at (assessment 2026-11-07, `critic1-page-zoom`): a host that zooms with a CSS transform gave `layoutBands` scaled widths, and the module's cache kept them, so a page drawn at 0.5 and then at 1.5 wore the widths of neither. The bands of a page under `transform: scale(s)` must equal those of the same page unscaled.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`; the server repeats `margin-box-padding.browser.ts`'s.
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



const doc = (scale: number) => `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
html { font: 12px/1.5 serif; } body { margin: 0; transform: scale(${scale}); transform-origin: 0 0; }
@page { size: 400px 300px; margin: 40px; @top-left { content: "A running head of the chapter, long enough to wrap"; } @top-right { content: "The author, briefer"; } }
</style></head><body><p>One page of text.</p></body></html>`;

/** The top band's tracks on the first page after the run, then again after the body's scale is set to each of `rescales` and the page lays its bands out anew. */
async function tracks(name: string, scale: number, rescales: number[] = []) {
  docs.set(name, doc(scale));
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async (rescales) => {
    await (window as any).__beltypeCicero.run();
    const first = document.querySelector('beltype-root')!.shadowRoot!.querySelector('beltype-page') as any;
    first.scrollIntoView();
    const band = () => (first.shadowRoot!.querySelector('.band[data-band="top"]') as HTMLElement).style.gridTemplateColumns;
    const seen = [band()];
    for (const s of rescales) {
      document.body.style.transform = `scale(${s})`;
      first.layoutBands();
      seen.push(band());
    }
    return seen;
  }, rescales);
  await page.context().close();
  return out;
}

test('a page drawn under a scale lays its margin bands out as the unscaled page does, and follows a second scale', async () => {
  const [plain] = await tracks('plain', 1);
  const widths = (plain as string).split(' ').map(parseFloat);
  assert.ok(widths[0]! > widths[2]!, `the longer head takes more of the band: ${plain}`);
  const scaled = await tracks('scaled', 0.5, [1.5, 1]);
  for (const [i, seen] of scaled.entries()) assert.equal(seen, plain, `pass ${i}: ${seen} for ${plain}`);
});
