/**
 * Composed-mode refusals: a multi-column box and a float in the padding. Run by `pnpm run test:browser` after `pnpm run build`; the server repeats `hyphen-limit-lines.browser.ts`.
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

const TEXT = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. '.repeat(1);

/** Composes a document and reads, for each `p`, how many composed breaks it holds and its widest line (the widest client rect of its text), plus the console's warnings. */
async function composed(key: string, body: string, css = '') {
  docs.set(key, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
@page { size: A4; margin: 20mm; }
html { font: 12pt/1.4 sans-serif; } body { margin: 0; } p { margin: 0; text-align: justify; } ${css}
</style></head><body>${body}</body></html>`);
  const page = await (await browser.newContext()).newPage();
  const warnings: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  await page.evaluate(() => (window as any).__beltypeCicero.run({ composed: true }));
  // The original stays parked in the light DOM and the composed copy is a second `p`: read them all, a parked one has no rects and no breaks.
  const paras = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('p')];
    const r = document.createRange();
    return [{ breaks: document.querySelectorAll('br[data-beltype~="break"]').length, widest: Math.max(0, ...ps.flatMap((p) => { r.selectNodeContents(p); return [...r.getClientRects()].map((c) => c.width); })) }];
  });
  await page.context().close();
  return { paras, warnings };
}

test('control: the same paragraph without columns is composed', async () => {
  const { paras } = await composed('nocols', `<p class="c">${TEXT}</p>`, '.c { width: 300px; }');
  assert.ok(paras[0].breaks > 2, `composed: ${paras[0].breaks} breaks`);
});

test('a paragraph that is itself multi-column keeps the browser\'s lines in composed mode', async () => {
  const { paras } = await composed('colsp', `<p class="c">${TEXT}</p>`, '.c { columns: 3; column-gap: 0; width: 300px; }');
  assert.equal(paras[0].breaks, 0, 'the paragraph is not composed');
  assert.ok(paras[0].widest <= 100.5, `widest line ${paras[0].widest}px in a 100px column`);
});

test('a multi-column box keeps the browser\'s lines in composed mode: no line wider than its column', async () => {
  const { paras } = await composed('cols', `<div class="c"><p>${TEXT}</p></div>`, '.c { columns: 3; column-gap: 0; width: 300px; }');
  assert.equal(paras[0].breaks, 0, 'the paragraph is not composed');
  assert.ok(paras[0].widest <= 100.5, `widest line ${paras[0].widest}px in a 100px column`);
});

test('a block with a float wholly in its own padding is composed (Codeberg issue 7)', async () => {
  const { paras } = await composed('hang', `<div class="w"><div class="num"></div><p class="comma">${TEXT}</p></div>`, '.w { width: 400px; } .comma { padding-left: 40px; } .num { float: left; width: 40px; height: 20px; }');
  assert.ok(paras[0].breaks > 2, `composed: ${paras[0].breaks} breaks`);
});

test('a float child wholly in its paragraph\'s padding is an outside marker: the paragraph composes and the number stays where it hangs (Codeberg issue 7)', async () => {
  const { paras } = await composed('hang-child', `<p class="comma"><span class="num">1.</span> ${TEXT}</p>`, '.comma { width: 400px; padding-left: 40px; } .num { float: left; width: 40px; margin-left: -40px; }');
  assert.ok(paras[0].breaks > 2, `composed: ${paras[0].breaks} breaks`);
});

test('a float child that intrudes on the content box still refuses', async () => {
  const { paras } = await composed('intruding-child', `<p class="comma"><span class="num">1.</span> ${TEXT}</p>`, '.comma { width: 400px; padding-left: 40px; } .num { float: left; width: 80px; margin-left: -40px; }');
  assert.equal(paras[0].breaks, 0);
});

test('a block a float really intrudes on stays refused', async () => {
  const { paras } = await composed('beside', `<div class="w"><div class="f"></div><p>${TEXT}</p></div>`, '.w { width: 400px; } .f { float: left; width: 100px; height: 60px; }');
  assert.equal(paras[0].breaks, 0);
});

test('a paragraph nested in a block that sets the font is measured in that font: the composed lines fit the box (`composed-pull-quote-overrun`)', async () => {
  const { paras } = await composed('quote', `<blockquote><p>${TEXT}</p></blockquote>`, 'blockquote { margin: 10pt 8mm; font: italic 22px/1.3 serif; width: 366px; }');
  assert.ok(paras[0].breaks > 2, `composed: ${paras[0].breaks} breaks`);
  assert.ok(paras[0].widest <= 366.5, `widest line ${paras[0].widest}px in a 366px box`);
});
