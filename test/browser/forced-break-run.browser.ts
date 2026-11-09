/**
 * A forced break beside a bare run of text, in a real browser: the run is an anonymous block box (CSS 2.1 §9.2.1.1), so a `break-after` on the block before it falls before the run, and a `break-before` on the block after it falls after the run, as Chromium prints both.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `page-lengths.browser.ts`, whose server this repeats in small.
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
async function pagesOf(name: string, body: string, runs = 1): Promise<string[]> {
  docs.set(name, `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>html { font: 16px/1.5 serif; } body { margin: 0 } @page { size: 400px 300px; margin: 20px; }</style></head><body>${body}</body></html>`);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async (runs) => {
    for (let i = 0; i < runs; i++) await (window as any).__beltypeCicero.run();
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    // A page's content is the root's light children assigned to the slot it adopted; a part kept hollow outside the interval is not displayed, so only visible text counts.
    return pages.map((p) => [...(p.querySelector(':scope > slot') as HTMLSlotElement).assignedNodes()].flatMap((el) => {
      const words: string[] = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.parentElement?.checkVisibility()) words.push(n.nodeValue ?? '');
      return words;
    }).join(' ').split(/\s+/).filter(Boolean).join(' '));
  }, runs);
  await page.context().close();
  return out;
}

test('break-after on a block before a bare run falls before the run, as Chromium prints it', async () => {
  assert.deepEqual(await pagesOf('after', '<div><p style="break-after:page">a</p>run of text<p>b</p></div>'), ['a', 'run of text b']);
});

test('break-after before a trailing run falls before the run', async () => {
  assert.deepEqual(await pagesOf('trailing', '<div><p style="break-after:page">a</p>run of text</div><p>b</p>'), ['a', 'run of text b']);
});

test('break-after before a run that opens with an inline wrapper falls before the run', async () => {
  assert.deepEqual(await pagesOf('wrapped', '<div><p style="break-after:page">a</p><em>run</em> of text<p>b</p></div>'), ['a', 'run of text b']);
});

test('break-after carried out of a nested last child falls before the run after its parent', async () => {
  assert.deepEqual(await pagesOf('nested', '<div><section><p style="break-after:page">a</p></section>run of text<p>b</p></div>'), ['a', 'run of text b']);
});

test('break-before on a block after a bare run falls after the run', async () => {
  assert.deepEqual(await pagesOf('before', '<div><p>a</p>run of text<p style="break-before:page">b</p></div>'), ['a run of text', 'b']);
});

test('break-after before a run of whitespace alone falls before the next block', async () => {
  assert.deepEqual(await pagesOf('space', '<div><p style="break-after:page">a</p>   \n  <p>b</p></div>'), ['a', 'b']);
});

test('break-after before a run that ends the document falls before the run', async () => {
  assert.deepEqual(await pagesOf('last', '<div><p style="break-after:page">a</p>run of text</div>'), ['a', 'run of text']);
});

test('break-after on a block inside an inline wrapper falls before the run that follows it there', async () => {
  assert.deepEqual(await pagesOf('inline', '<div><span><p style="break-after:page">a</p>run of text</span><p>b</p></div>'), ['a', 'run of text b']);
});

test('break-after before a run in a nested container falls before the run', async () => {
  assert.deepEqual(await pagesOf('deep', '<section><p>z</p><div><p style="break-after:page">a</p>run of text<p>b</p></div></section>'), ['z a', 'run of text b']);
});

test('a second run, reading through the forcing memo, puts the break before the run as the first did', async () => {
  assert.deepEqual(await pagesOf('again', '<div><p style="break-after:page">a</p>run of text<p>b</p></div>', 2), ['a', 'run of text b']);
});

// Chromium prints this shape on two pages, and the same document without the run on two as well: it costs no blank page for a parity (*a parity is worth a page* is this engine's ruling, not Chromium's print).
test('break-after: right before a run costs the blank page and puts the run on the right', async () => {
  assert.deepEqual(await pagesOf('parity', '<div><p style="break-after:right">a</p>run of text<p>b</p></div>'), ['a', '', 'run of text b']);
});

test('break-after before a run inside a table cell falls before the run', async () => {
  assert.deepEqual(await pagesOf('cell', '<table><tr><td><p style="break-after:page">a</p>run of text<p>b</p></td></tr></table>'), ['a', 'run of text b']);
});

test('break-after before a run inside a flex item falls before the run', async () => {
  assert.deepEqual(await pagesOf('flex-item', '<div style="display:flex"><div><p style="break-after:page">a</p>run of text<p>b</p></div></div>'), ['a', 'run of text b']);
});

test('break-after before a run inside a table cell beside another cell falls before the run, and the neighbour stays on its page', async () => {
  assert.deepEqual(await pagesOf('cell-row', '<table><tr><td><p style="break-after:page">a</p>run of text<p>b</p></td><td>z</td></tr></table>'), ['a z', 'run of text b']);
});

test('break-after before a run inside a flex item beside another item falls before the run, and the neighbour stays on its page', async () => {
  assert.deepEqual(await pagesOf('flex-row', '<div style="display:flex"><div><p style="break-after:page">a</p>run of text<p>b</p></div><div>z</div></div>'), ['a z', 'run of text b']);
});

test('break-after before a run that is an anonymous flex item of a column falls before the run', async () => {
  assert.deepEqual(await pagesOf('flex-column', '<div style="display:flex;flex-direction:column"><p style="break-after:page">a</p>run of text<p>b</p></div>'), ['a', 'run of text b']);
});
