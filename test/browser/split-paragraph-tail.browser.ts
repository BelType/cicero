/**
 * A paragraph split across pages ends on a page: justified text under `hyphens: auto` over several pages presents every letter of the source once and in order, in the print of Cicero's pages (Codeberg issue 14, found in the studio's Quiet Press, where the end of a split paragraph was left below the page's clip and resumed on no page).
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `hyphen-at-the-cut.browser.ts`, whose server this repeats.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
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

const POOL = ['incomprehensibility', 'extraordinarily', 'characterization', 'morbi', 'pariatur', 'porttitor', 'consequat', 'fugiat', 'internationalization', 'vulputate', 'eiusmod', 'semper', 'faucibus', 'senectus', 'cillum', 'pulvinar', 'deserunt', 'and', 'of'];
const paragraph = (seed: number, n: number) => Array.from({ length: n }, (_, i) => `${POOL[(seed * 7 + i * 5 + (i >> 2)) % POOL.length]}`).join(' ') + '.';
const PARAGRAPHS = Array.from({ length: 8 }, (_, k) => paragraph(k + 1, 90 + k * 13));
const BODY = PARAGRAPHS.map((text) => `<p>${text}</p>`).join('');

test('a paragraph cut at a hyphen the browser drew presents its source once: the hyphen is a text node of its own, before a break mark, as the Compositor\'s is', async () => {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
@page { size: 420px 520px; margin: 40px; }
html { font: 14px/20px serif; } body { margin: 0; }
p { margin: 0; text-align: justify; hyphens: auto; orphans: 2; widows: 2; text-indent: 1.3em; }
</style></head><body>${BODY}</body></html>`;
  docs.set('split-tail', html);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/split-tail`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  await page.evaluate(() => (window as any).__beltypeCicero.run());
  // What a printer reads from the pages: every text node a page shows, with whether a break mark follows it.
  const shown = await page.evaluate(() => {
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    return pages.flatMap((p) => { p.scrollIntoView(); return [...(p.querySelector(':scope > slot') as HTMLSlotElement).assignedNodes()].flatMap((el) => {
      const found: { data: string; breaks: boolean }[] = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const next = n.nextSibling;
        if (n.parentElement?.closest('p') && n.parentElement.checkVisibility()) found.push({ data: n.nodeValue ?? '', breaks: next instanceof Element && (next.getAttribute('data-beltype') ?? '').split(/\s+/).includes('break') });
      }
      return found;
    }); });
  });
  const source = PARAGRAPHS.join('\u0000');
  const foreign = shown.map((t) => t.data.trim()).filter((text) => text && text !== '\u2010' && !source.includes(text));
  assert.deepEqual(foreign, [], 'every other text node is a run of its source: the hyphen is in no source node, where a printer would find it matching none');
  const hyphens = shown.filter((t) => t.data === '\u2010');
  assert.ok(hyphens.length > 0, 'the case divides a paragraph at a hyphen the browser drew');
  assert.deepEqual(hyphens.filter((t) => !t.breaks), [], 'each hyphen the engine wrote stands before a break mark');
  // And the print of those pages holds every letter of the source once, in order.
  const file = await getDocument({ data: new Uint8Array(await page.pdf({ preferCSSPageSize: true })) }).promise;
  let printed = '';
  for (let k = 1; k <= file.numPages; k++) printed += ((await (await file.getPage(k)).getTextContent()).items as Array<{ str?: string }>).map((t) => t.str ?? '').join('');
  const letters = (text: string) => text.replace(/[^a-z]/g, '');
  assert.equal(letters(printed), letters(source));
  await page.context().close();
});
