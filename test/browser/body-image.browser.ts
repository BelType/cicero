/**
 * An atomic inline-level box standing directly in the body is cut as the anonymous block box CSS 2.1 §9.2.1.1 puts it in, in a real browser: it is drawn on exactly one page, wherever a page ends, and the line it stands on moves whole (*an atom in the body is a line of the body*, ruled 2026-11-16). Each case states the page its boxes must be drawn on.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`. The page area is 340 by 440 px; the blocks are `<div>`s of a fixed height, so every case's arithmetic is the page's. A box is drawn on a page where it reaches into that page's area.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
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

/** A block of a fixed height, named by `k`. */
const H = (k: string, h: number, style = '') => `<div data-k="${k}" style="height:${h}px;${style}"></div>`;
/** An image of a fixed size, named by `k`, drawn from a data URL so it is sized and loaded with the document. */
const IMG = (k: string, h: number, style = '', w = 60) => `<img data-k="${k}" width="${w}" height="${h}" alt="${k}" style="${style}" src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='${w}' height='${h}' fill='%23888'/></svg>`)}">`;

/** Load the case, run it to the end and answer, for every named box, the pages it is drawn on (0-based), with the page count. */
async function placed(key: string, html: string, css = ''): Promise<{ on: Record<string, number[]>; pages: number; page: Page; }> {
  docs.set(key, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
@page { size: 420px 520px; margin: 40px; }
html { font: 14px/20px serif; } body { margin: 0; } ${css}
</style></head><body>${html}</body></html>`);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  await page.evaluate(async () => { const c = (window as any).__beltypeCicero; await c.run(); await c.settled(); });
  const out = await page.evaluate(async () => {
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    for (const p of pages) { p.scrollIntoView(); await new Promise((r) => requestAnimationFrame(() => r(null))); }
    const on: Record<string, number[]> = {};
    pages.forEach((p, i) => {
      p.scrollIntoView();
      // The page area: the page box less its 40px margins, where a box that is drawn on this page stands.
      const frame = p.getBoundingClientRect();
      const area = { top: frame.top + 40, bottom: frame.bottom - 40 };
      for (const el of (p.querySelector(':scope > slot') as HTMLSlotElement).assignedElements()) {
        for (const x of [el, ...el.querySelectorAll('[data-k]')]) {
          const k = x.getAttribute('data-k');
          if (!k || !x.checkVisibility()) continue;
          const r = x.getBoundingClientRect();
          if (r.height <= 0 || r.bottom <= area.top + 0.5 || r.top >= area.bottom - 0.5) continue;
          (on[k] ??= []).push(i);
        }
      }
    });
    return { on, pages: pages.length };
  });
  return { ...out, page };
}

/** The tops of two named boxes on screen, in the presentation, to say they stand on one line. */
const topsOf = (page: Page, ...ks: string[]) => page.evaluate((ks) => {
  const all = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')].flatMap((p) => (p.querySelector(':scope > slot') as HTMLSlotElement).assignedElements());
  return ks.map((k) => { const el = all.find((e) => e.getAttribute('data-k') === k); return el ? el.getBoundingClientRect().top : null; });
}, ks);

const close = (page: Page) => page.context().close();

test('an image between two blocks in mid-page is drawn there', async () => {
  const { on, page } = await placed('mid', H('x', 100) + IMG('a', 80) + H('y', 100));
  assert.deepEqual(on, { x: [0], a: [0], y: [0] });
  await close(page);
});

test('an image where a page ends exactly is drawn at the top of the next page', async () => {
  const { on, pages, page } = await placed('exact', H('x', 440) + IMG('a', 80) + H('y', 100));
  assert.deepEqual(on, { x: [0], a: [1], y: [1] });
  assert.equal(pages, 2);
  await close(page);
});

test('an image taller than what is left of the page moves whole to the next page', async () => {
  const { on, page } = await placed('left', H('x', 400) + IMG('a', 80) + H('y', 100));
  assert.deepEqual(on, { x: [0], a: [1], y: [1] });
  await close(page);
});

test('an image taller than a whole page is drawn as the same image as a block is: moved to a page of its own and sliced by its edge', async () => {
  const inline = await placed('tall', H('x', 100) + IMG('a', 600) + H('y', 100));
  const block = await placed('tall-block', H('x', 100) + IMG('a', 600, 'display:block') + H('y', 100));
  assert.deepEqual(block.on, { x: [0], a: [1, 2], y: [2] });
  assert.deepEqual(inline.on, block.on);
  await close(inline.page); await close(block.page);
});

test('an image as the body\'s first child is drawn on the first page', async () => {
  const { on, page } = await placed('first', IMG('a', 80) + H('x', 200) + H('y', 100));
  assert.deepEqual(on, { a: [0], x: [0], y: [0] });
  await close(page);
});

test('an image as the body\'s last child is drawn on the page it stands on, and on the next where the page is full', async () => {
  let { on, pages, page } = await placed('last-fits', H('x', 100) + IMG('a', 80));
  assert.deepEqual(on, { x: [0], a: [0] });
  assert.equal(pages, 1);
  await close(page);
  ({ on, pages, page } = await placed('last-full', H('x', 440) + IMG('a', 80)));
  assert.deepEqual(on, { x: [0], a: [1] });
  assert.equal(pages, 2);
  await close(page);
});

test('two images on one line move together, though the shorter would fit', async () => {
  const { on, page } = await placed('pair', H('x', 425) + IMG('a', 30) + ' ' + IMG('b', 10, 'vertical-align:top') + H('y', 50));
  assert.deepEqual(on, { x: [0], a: [1], b: [1], y: [1] });
  const [a, b] = await topsOf(page, 'a', 'b');
  assert.ok(a != null && b != null && Math.abs(a - b) < 1, `one line: tops ${a} and ${b}`);
  await close(page);
});

test('an image beside an inline-block moves with it', async () => {
  const { on, page } = await placed('beside', H('x', 425) + IMG('a', 10, 'vertical-align:top') + '<span data-k="b" style="display:inline-block;width:40px;height:30px;background:#ccc"></span>' + H('y', 50));
  assert.deepEqual(on, { x: [0], a: [1], b: [1], y: [1] });
  const [a, b] = await topsOf(page, 'a', 'b');
  assert.ok(a != null && b != null && Math.abs(a - b) < 1, `one line: tops ${a} and ${b}`);
  await close(page);
});

test('an inline-block alone where a page ends is drawn at the top of the next page', async () => {
  const { on, page } = await placed('inline-block', H('x', 440) + '<div data-k="a" style="display:inline-block;width:40px;height:30px;background:#ccc"></div>' + H('y', 50));
  assert.deepEqual(on, { x: [0], a: [1], y: [1] });
  await close(page);
});

test('an image after a forced break is drawn on the page the break opens', async () => {
  const { on, pages, page } = await placed('forced', H('x', 100, 'break-after:page') + IMG('a', 80) + H('y', 100));
  assert.deepEqual(on, { x: [0], a: [1], y: [1] });
  assert.equal(pages, 2);
  await close(page);
});

test('a floated and an absolutely positioned image are blockified by CSS and taken as before', async () => {
  let { on, page } = await placed('float', H('x', 100) + IMG('a', 80, 'float:left') + H('y', 100));
  assert.deepEqual(on, { x: [0], a: [0], y: [0] });
  await close(page);
  ({ on, page } = await placed('abs', H('x', 100) + IMG('a', 80, 'position:absolute') + H('y', 100)));
  assert.deepEqual(on, { x: [0], a: [0], y: [0] });
  await close(page);
});

test('an image inside a <picture> where a page ends is drawn at the top of the next page', async () => {
  const { on, page } = await placed('picture', H('x', 440) + `<picture data-k="p">${IMG('a', 80)}</picture>` + H('y', 100));
  assert.deepEqual(on.a, [1], JSON.stringify(on));
  assert.deepEqual(on.y, [1]);
  await close(page);
});

test('a linked image, an <a> holding an image and no word, where a page ends is drawn at the top of the next page', async () => {
  const { on, page } = await placed('linked', H('x', 440) + `<a href="#">${IMG('a', 80)}</a>` + H('y', 100));
  assert.deepEqual(on, { x: [0], a: [1], y: [1] });
  await close(page);
});

test('an inline <svg> where a page ends is drawn at the top of the next page', async () => {
  const { on, page } = await placed('svg', H('x', 440) + '<svg data-k="a" width="60" height="80"><rect width="60" height="80" fill="#888"/></svg>' + H('y', 100));
  assert.deepEqual(on, { x: [0], a: [1], y: [1] });
  await close(page);
});

test('the page holds the image\'s line, not only the image: an image that fits on a line that does not moves to the next page', async () => {
  // 60px are left; the image is 50px and sits on the baseline of a 40px line, so its line reaches some 15px below it.
  let { on, page } = await placed('strut', H('x', 380) + IMG('a', 50) + H('y', 50), 'body { line-height: 40px; }');
  assert.deepEqual(on, { x: [0], a: [1], y: [1] });
  await close(page);
  // On a 20px line it reaches some 5px below the image, and the line fits.
  ({ on, page } = await placed('strut-fits', H('x', 380) + IMG('a', 50) + H('y', 50)));
  assert.deepEqual(on, { x: [0], a: [0], y: [0, 1] });
  await close(page);
});
