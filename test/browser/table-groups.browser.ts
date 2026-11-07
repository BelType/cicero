/**
 * Two table shapes that lost rows with no message (assessment 2026-11-07, *thead-after-rows-and-tall-footer-lose-rows*): a header group written after the rows, and a footer group taller than the page area. Each either keeps every row on some page or is refused by name.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`; the server repeats `page-lengths.browser.ts`'s.
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

const rows = (n: number, tag = 'r') => Array.from({ length: n }, (_, i) => `<tr><td>${tag}${i}</td></tr>`).join('');
const doc = (table: string) => `<!doctype html><html><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>html { font: 16px/1.5 serif; } body { margin: 0 } @page { size: 300px 300px; margin: 20px; } td { height: 20px; padding: 0 }</style></head><body>${table}</body></html>`;

/** Run the document; the cells each page prints inside its content area, sorted, and every one seen, or the refusal. */
async function bodyRows(name: string, html: string) {
  docs.set(name, html);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    try {
      await (window as any).__beltypeCicero.run();
    } catch (e: any) {
      return { error: String(e.message) };
    }
    const seen = new Set<string>();
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    const per: string[][] = [];
    // A page shows what its content slot is assigned (the root's slot chain) and only inside its content area, which clips: a row the piece holds below the area's end is not printed.
    for (const p of pages) {
      const area = p.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect();
      const nodes = [...p.shadowRoot!.querySelectorAll('slot')].flatMap((s) => s.assignedNodes({ flatten: true }));
      const here: string[] = [];
      for (const n of nodes) {
        if (n.nodeType !== 1) continue;
        for (const td of (n as Element).querySelectorAll('td, th')) {
          const r = td.getBoundingClientRect();
          if (r.height && r.top >= area.top - 0.5 && r.bottom <= area.bottom + 0.5) here.push(td.textContent!.trim());
        }
      }
      per.push(here.sort());
      here.forEach((r) => seen.add(r));
    }
    return { seen: [...seen], pages: pages.length, per };
  });
  await page.context().close();
  return out as { error?: string; seen?: string[]; pages?: number; per?: string[][] };
}

/** Every row kept, or a refusal naming the shape: never a row lost with no message. */
function keptOrRefused(out: { error?: string; seen?: string[] }, n: number, shape: RegExp) {
  if (out.error !== undefined) return assert.match(out.error, shape);
  const missing = Array.from({ length: n }, (_, i) => `r${i}`).filter((r) => !out.seen!.includes(r));
  assert.deepEqual(missing, [], `rows lost with no message: ${missing.join(' ')}`);
}

test('a header group written after 25 rows keeps every row, or is refused by name', async () => {
  const out = await bodyRows('late-thead', doc(`<table id="late"><tbody>${rows(25)}</tbody><thead><tr><th>Head</th></tr></thead></table>`));
  keptOrRefused(out, 25, /<table id="late"> has a header group written after its rows/);
});

test('a footer group written first and taller than the page area keeps every row, or is refused by name', async () => {
  const out = await bodyRows('tall-tfoot', doc(`<table id="tall"><tfoot>${rows(14, 'f')}</tfoot><tbody>${rows(25)}</tbody></table>`));
  keptOrRefused(out, 25, /<table id="tall"> has a footer group taller than the page area/);
});

for (const [name, style] of [['separated borders', ''], ["collapsed borders, the header's bottom wider", '<style>table { border-collapse: collapse } th { border-bottom: 4px solid } td { border-top: 1px solid }</style>']]) {
  test(`a header group written after its rows is printed as the same table written in HTML order is, under ${name}`, async () => {
    const late = await bodyRows(`late-${name.length}`, doc(`${style}<table><tbody>${rows(25)}</tbody><thead><tr><th>Head</th></tr></thead></table>`));
    const first = await bodyRows(`first-${name.length}`, doc(`${style}<table><thead><tr><th>Head</th></tr></thead><tbody>${rows(25)}</tbody></table>`));
    assert.equal(late.error, undefined, late.error);
    assert.equal(first.per!.length, 3);
    assert.deepEqual(late.per, first.per);
  });
}

test('a header group written after its rows and too tall to repeat is refused by name: where it shows waits on a ruling', async () => {
  const out = await bodyRows('late-tall', doc(`<table id="tall-late"><tbody>${rows(25)}</tbody><thead>${rows(3, 'h')}</thead></table>`));
  assert.match(out.error ?? '', /<table id="tall-late"> has a header group written after its rows, too tall to repeat/);
});

test('a header group written after its rows and too tall to repeat, in a table one page holds, is printed whole', async () => {
  const out = await bodyRows('late-tall-short', doc(`<table><tbody>${rows(3)}</tbody><thead>${rows(4, 'h')}</thead></table>`));
  assert.equal(out.error, undefined, out.error);
  assert.deepEqual(out.per, [['h0', 'h1', 'h2', 'h3', 'r0', 'r1', 'r2']]);
});
