/**
 * The intake passes over what never renders and over the host's own machinery, in a real browser: a document whose body holds, between two paragraphs, a hidden `<iframe data-beltype="host">`, a `<template>`, a `<link>` and a `<noscript>` has the paragraphs alone as its top-level blocks, and is cut at the same addresses into the same pages as the document without them (ruled 2026-11-08).
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

const WORDS = (n: number, w: string) => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ');
const CLEAN = `<p>${WORDS(120, 'a')}</p><p>${WORDS(120, 'b')}</p>`;
const MACHINERY = '<iframe data-beltype="host" style="display:none" src="about:blank"></iframe><template><p>never shown</p></template><link rel="help" href="#"><noscript><p>no script</p></noscript>';
const DIRTY = CLEAN.replace('</p><p>', `</p>${MACHINERY}<p>`);

/** Load `body`, read the driver's top-level blocks before the run, then run through the client and read each page's visible words and the Ledger's addresses. */
async function runOf(name: string, body: string) {
  docs.set(name, `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>html { font: 16px/1.5 serif; } body { margin: 0 } @page { size: 400px 300px; margin: 20px; }</style></head><body>${body}</body></html>`);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    const { topLevelBlocks } = await import('/_beltype/cicero/src/driver.js' as string);
    const blocks = topLevelBlocks(document).map((el: Element) => el.tagName);
    await (window as any).__beltypeCicero.run();
    const addresses = ((window as any).__beltypeCicero.ledger as any[]).map((e) => ({ pos: e.pos, cut: e.cut }));
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    const words = pages.map((p) => {
      p.scrollIntoView();
      return [...(p.querySelector(':scope > slot') as HTMLSlotElement).assignedNodes()].flatMap((el) => {
        const found: string[] = [];
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.parentElement?.checkVisibility()) found.push(n.nodeValue ?? '');
        return found;
      }).join(' ').split(/\s+/).filter(Boolean).join(' ');
    });
    return { blocks, addresses, words };
  });
  await page.context().close();
  return out;
}

test('the driver\'s top-level blocks pass over a host\'s iframe, a template, a link and a noscript', async () => {
  assert.deepEqual((await runOf('blocks', DIRTY)).blocks, ['P', 'P']);
});

test('through the client, the document with the four elements is cut at the same addresses into the same pages as the one without', async () => {
  const clean = await runOf('clean', CLEAN);
  const dirty = await runOf('dirty', DIRTY);
  assert.ok(clean.words.length > 1, 'the case divides across pages');
  assert.deepEqual(dirty.addresses, clean.addresses);
  assert.equal(dirty.words.length, clean.words.length);
  assert.deepEqual(dirty.words, clean.words);
});
