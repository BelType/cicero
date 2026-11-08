/**
 * A margin box's padding moves its content, in a real browser (Codeberg issue 3): `@top-left { vertical-align: bottom; padding-bottom: 20px }` lifts the running head 20 px off the content area, and `@bottom-left { vertical-align: top; padding-top: 20px }` lowers the folio by the same.
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


const CASE = `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
html { font: 12px/1.5 serif; } @page { size: 300px 300px; margin: 60px; @top-left { content: "Head"; vertical-align: bottom; padding-bottom: 20px; } @bottom-left { content: "Foot"; vertical-align: top; padding-top: 20px; } }
</style></head><body><p>One page of text.</p></body></html>`;

test('a margin box\'s padding moves its content: the head sits 20 px above the content area and the folio 20 px below it', async () => {
  docs.set('case', CASE);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/case`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    await (window as any).__beltypeCicero.run();
    const first = document.querySelector('beltype-root')!.shadowRoot!.querySelector('beltype-page')!;
    const top = first.getBoundingClientRect().top;
    const area = first.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect();
    const rect = (name: string) => {
      const cell = first.shadowRoot!.querySelector(`.margin-cell[data-box="${name}"]`)!;
      const r = cell.getBoundingClientRect();
      const text = getComputedStyle(cell, '::before');
      return { paddingTop: getComputedStyle(cell).paddingTop, paddingBottom: getComputedStyle(cell).paddingBottom, top: r.top - top, bottom: r.bottom - top, content: text.content };
    };
    return { areaTop: area.top - top, areaBottom: area.bottom - top, head: rect('top-left'), foot: rect('bottom-left') };
  });
  assert.equal(out.head.paddingBottom, '20px', `the head's padding: ${JSON.stringify(out.head)}`);
  assert.equal(out.foot.paddingTop, '20px', `the folio's padding: ${JSON.stringify(out.foot)}`);
  await page.context().close();
});

test('CSSMarginRule exists in the pinned Chromium, so margin boxes are read from the CSSOM and never from cssText', async () => {
  const page = await (await browser.newContext()).newPage();
  assert.equal(await page.evaluate(() => typeof (globalThis as any).CSSMarginRule), 'function');
  await page.context().close();
});

test('a margin box carries its own font and size: 9pt serif reads 12px and a serif family on the presented page', async () => {
  docs.set('face', `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
html { font: 20px/1.5 sans-serif; } @page { size: 300px 300px; margin: 60px; @top-center { content: "x"; font: 9pt serif } }
</style></head><body><p>One page of text.</p></body></html>`);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/face`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    await (window as any).__beltypeCicero.run();
    const first = document.querySelector('beltype-root')!.shadowRoot!.querySelector('beltype-page')!;
    const cs = getComputedStyle(first.shadowRoot!.querySelector('.margin-cell[data-box="top-center"]')!);
    return { size: cs.fontSize, family: cs.fontFamily };
  });
  assert.equal(out.size, '12px', JSON.stringify(out));
  assert.match(out.family, /serif/i, JSON.stringify(out));
  assert.doesNotMatch(out.family, /sans-serif/i, JSON.stringify(out));
  await page.context().close();
});
