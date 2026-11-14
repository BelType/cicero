/**
 * Named pages, in a real browser: css-page-3 §8.1's start and end page values, read at each class A break point between boxes the `page` property applies to, as the WPT `css-page/page-name-*` tests have Chromium print them.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`; the server is `forced-break-run.browser.ts`'s, repeated in small.
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

/** Run `body` and read each page's visible words, joined by single spaces; `runs` above one runs again, where the forcing index reads through the memo the first run left. */
async function pagesOf(name: string, body: string, runs = 1, bodyStyle = ''): Promise<string[]> {
  docs.set(name, `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>html { font: 16px/1.5 serif; } body { margin: 0 } @page { size: 400px 300px; margin: 20px; }</style></head><body style="${bodyStyle}">${body}</body></html>`);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async (runs) => {
    for (let i = 0; i < runs; i++) await (window as any).__beltypeCicero.run();
    const left = document.querySelectorAll('#__beltype-measure').length;
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    // A page's content is the root's light children assigned to the slot it adopted; a part kept hollow outside the interval is not displayed, so only visible text counts.
    return pages.map((p) => [...(p.querySelector(':scope > slot') as HTMLSlotElement).assignedNodes()].flatMap((el) => {
      const words: string[] = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.parentElement?.checkVisibility()) words.push(n.nodeValue ?? '');
      return words;
    }).join(' ').split(/\s+/).filter(Boolean).join(' ')).concat(left ? [`${left} measure containers left in the document`] : []);
  }, runs);
  await page.context().close();
  return out;
}

test('a start page value propagates from the deepest first child: no break where it matches the end before (page-name-propagated-001)', async () => {
  assert.deepEqual(await pagesOf('propagated-1', '<div style="page:a">a</div><div style="page:b"><div style="page:c"><div style="page:a">b</div></div></div>'), ['a b']);
});

test('a start page value propagates, and the siblings after it still switch (page-name-propagated-002)', async () => {
  assert.deepEqual(await pagesOf('propagated-2', '<div style="page:a">a</div><div style="page:b"><div style="page:e"><div style="page:a">b</div></div><div style="page:c">c</div></div><div style="page:d">d</div>'), ['a b', 'c', 'd']);
});

test('a later sibling inside a box that began on the page before switches the name there (page-name-siblings-002)', async () => {
  assert.deepEqual(await pagesOf('siblings-2', '<div style="page:a">a</div><div style="page:b"><div style="page:a">b</div><div>c</div></div>'), ['a b', 'c']);
});

test('a name on a flex item does not apply, so it forces nothing (page-name-flex-001)', async () => {
  assert.deepEqual(await pagesOf('flex-1', '<div>a</div><div style="display:flex;flex-direction:column"><div style="page:b">b</div><div style="page:c">c</div></div><div>d</div>'), ['a b c d']);
});

test('inside a flex item the block flow switches names again, and the item does not propagate them out (page-name-flex-004)', async () => {
  assert.deepEqual(await pagesOf('flex-4', '<div>a</div><div style="display:flex;flex-direction:column"><div><div><div style="page:a">b</div><div style="page:b">c</div></div></div></div><div>d</div>'), ['a b', 'c d']);
});

test('a name on a float does not apply (page-name-float-001, -002)', async () => {
  assert.deepEqual(await pagesOf('float-1', '<div style="page:a;float:left">a</div><div style="page:b">b</div>'), ['a b']);
  assert.deepEqual(await pagesOf('float-2', '<div style="page:a">a</div><div style="page:b;float:left">b</div><div style="page:c">c</div>'), ['a b', 'c']);
});

test('a name on an inline-block does not apply (page-name-inline-block-003)', async () => {
  // One level down since 2026-11-14: an inline-level box directly in the body is refused by name (`scope.browser.ts`).
  assert.deepEqual(await pagesOf('inline-block-3', '<div><div style="page:a;display:inline-block">a</div><div style="page:b;display:inline-block">b</div></div>'), ['a b']);
});

test('an inline box standing beside a block is in an anonymous block named by their container, so the block after it switches (page-name-canvas-001, with words, one level down since an inline-level box directly in the body is refused, 2026-11-14)', async () => {
  assert.deepEqual(await pagesOf('inline-run', '<div style="page:a"><span style="page:b">x</span><div style="page:b">b</div></div>'), ['x', 'b']);
});

test('each named page keeps its own margins, and a context put away at a width change leaves nothing in the flow (page-name-margin-001, -002)', async () => {
  const style = '<style>@page a { margin: 0 } @page b { margin: 30px } @page c { margin: 60px }</style>';
  assert.deepEqual(await pagesOf('margins-1', `${style}<div style="page:a">a</div><div style="page:b">b</div><div style="page:c">c</div>`), ['a', 'b', 'c']);
  const style2 = '<style>@page a { margin: 60px } @page { margin: 0 }</style>';
  assert.deepEqual(await pagesOf('margins-2', `${style2}<div>a</div><div style="page:a">b</div>`), ['a', 'b']);
});
