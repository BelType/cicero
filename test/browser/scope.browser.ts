/**
 * The scope the engine states: a right-to-left root and a vertical box are refused by name, text and an inline-level box standing directly in the body are refused by name, a multi-column box too tall for a page is laid out as one column and reads every word once and in order, and one that fits keeps its columns. Run by `pnpm run test:browser` after `pnpm run build`; the server repeats `composed-refusals.browser.ts`.
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


const doc = (key: string, css: string, html: string, attrs = '') => docs.set(key, `<!doctype html><html lang="en"${attrs}><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
@page { size: 420px 520px; margin: 40px; }
html { font: 14px/20px serif; } body { margin: 0; } ${css}
</style></head><body>${html}</body></html>`);

async function open(key: string) {
  const page = await (await browser.newContext()).newPage();
  const warnings: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  return { page, warnings };
}

const ENTRIES = Array.from({ length: 90 }, (_, i) => `<dt>term${i}</dt><dd>definition of term${i} in a few words</dd>`).join('');
const SOURCE_WORDS = Array.from({ length: 90 }, (_, i) => `term${i} definition of term${i} in a few words`).join(' ').split(' ');

/** The visible words of every page, in page order and DOM order. */
const shownWords = async (page: import('playwright-core').Page) => {
  // Pages are materialised as they come into view: visit every one first.
  await page.evaluate(async () => { for (const p of document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')) { p.scrollIntoView(); await new Promise((r) => requestAnimationFrame(() => r(null))); } });
  return page.evaluate(() => {
  const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
  return pages.flatMap((p) => { return [...(p.querySelector(':scope > slot') as HTMLSlotElement).assignedNodes()].flatMap((el) => {
    const found: string[] = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.parentElement?.checkVisibility()) found.push(...(n.nodeValue ?? '').split(/\s+/).filter(Boolean));
    return found;
  }); });
  });
};

test('multicol-never-divided: a 90-entry two-column list is laid out as one column, with a warning, and reads every word once and in order', async () => {
  doc('tall', 'dl { columns: 2; column-gap: 20px; margin: 0; } dd { margin: 0 0 0 1em; }', `<dl>${ENTRIES}</dl>`);
  const { page, warnings } = await open('tall');
  await page.evaluate(async () => { const c = (window as any).__beltypeCicero; await c.run(); await c.settled(); });
  assert.deepEqual(await shownWords(page), SOURCE_WORDS);
  assert.ok(warnings.some((w) => /<dl>.*multi-column.*one column/.test(w)), `the console names the element: ${JSON.stringify(warnings)}`);
  const pages = await page.evaluate(() => document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page').length);
  assert.ok(pages > 1, 'the list is divided across pages');
  const columns = await page.evaluate(() => [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')].flatMap((p) => [...(p.querySelector(':scope > slot') as HTMLSlotElement).assignedElements()].filter((e) => e.localName === 'dl').map((e) => getComputedStyle(e).columnCount)));
  assert.deepEqual(columns.filter((c) => c !== 'auto'), [], 'no piece of the list keeps its columns');
  await page.context().close();
});

test('multicol-never-divided: a short two-column box keeps its columns and is not warned about', async () => {
  doc('short', 'dl { columns: 2; column-gap: 20px; margin: 0; }', `<dl>${ENTRIES.split('</dd>').slice(0, 6).join('</dd>')}</dd></dl>`);
  const { page, warnings } = await open('short');
  await page.evaluate(async () => { const c = (window as any).__beltypeCicero; await c.run(); await c.settled(); });
  const count = await page.evaluate(() => [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')].flatMap((p) => [...(p.querySelector(':scope > slot') as HTMLSlotElement).assignedElements()].filter((e) => e.localName === 'dl').map((e) => getComputedStyle(e).columnCount)));
  assert.deepEqual(count, ['2']);
  assert.deepEqual(warnings.filter((w) => /multi-column/.test(w)), []);
  await page.context().close();
});

test('rtl-and-vertical-writing: a right-to-left root and a vertical box below the root are refused by name', async () => {
  doc('rtl', '', '<p>text</p>', ' dir="rtl"');
  let { page } = await open('rtl');
  await assert.rejects(page.evaluate(() => (window as any).__beltypeCicero.run()), /right-to-left text is outside this engine's scope/);
  await page.context().close();
  doc('vertical', '.v { writing-mode: vertical-rl; }', '<p>text</p><div class="v"><p>vertical text</p></div>');
  ({ page } = await open('vertical'));
  await assert.rejects(page.evaluate(() => (window as any).__beltypeCicero.run()), /vertical writing is outside this engine's scope: <div class="v">/);
  await page.context().close();
});

test('bare-body-content: text standing directly in the body is refused by its first words', async () => {
  doc('bare-text', '', '<p>alpha one</p>BARE words here<p>omega two</p>');
  const { page } = await open('bare-text');
  await assert.rejects(page.evaluate(() => (window as any).__beltypeCicero.run()), /text directly in the document's body is outside this engine's intake: "BARE words here".*inside a block element/);
  await page.context().close();
});

test('bare-body-content: an inline <svg> standing directly in the body is refused by its tag', async () => {
  doc('bare-svg', '', '<p>alpha one</p><svg width="60" height="40"><rect width="60" height="40" fill="red"/></svg><p>omega two</p>');
  const { page } = await open('bare-svg');
  await assert.rejects(page.evaluate(() => (window as any).__beltypeCicero.run()), /an inline-level box directly in the document's body is outside this engine's intake: <svg> computes display 'inline'.*inside a block element/);
  await page.context().close();
});

test('bare-body-content: whitespace, a comment, a hidden box, a line break and a block <svg> between the blocks are not refused, and every word is shown', async () => {
  doc('bare-guard', 'svg { display: block; }', '\n  <p>alpha one</p>\n\t<!-- BARE comment -->  <div style="display:none">hidden</div><br><svg width="60" height="40"><rect width="60" height="40" fill="red"/></svg>\n<p>omega two</p>\n');
  const { page } = await open('bare-guard');
  await page.evaluate(async () => { const c = (window as any).__beltypeCicero; await c.run(); await c.settled(); });
  assert.deepEqual(await shownWords(page), ['alpha', 'one', 'omega', 'two']);
  await page.context().close();
});
