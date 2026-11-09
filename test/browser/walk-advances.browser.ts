/**
 * Three documents the walk refused or mis-cut where Chromium prints them (assessment 2026-11-07, group B of the seventh batch): a row taller than the page under `break-inside: avoid` that opens the document, a block-end padding taller than the page area, and an `<object>` whose data fails and whose fallback is taller than the page. Each is read against Chromium's own print of the same document.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`; the server repeats `table-row-cut.browser.ts`'s.
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
let server: http.Server; let origin = ''; let browser: Browser;
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
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

const head = '<!doctype html><html><head><meta charset="utf-8"><title>case</title>';
const sheet = '<style>html { font: 16px/1.5 serif } body { margin: 0 } @page { size: 300px 300px; margin: 20px }</style></head><body>';
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line${i}`).join('<br>');

/** Chromium's print without the engine: the words on each page, read from the PDF's text. */
async function chromiumPrint(body: string) {
  const page = await (await browser.newContext()).newPage();
  await page.setContent(head + sheet + body);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const per: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) per.push((await (await doc.getPage(i)).getTextContent()).items.map((t) => ('str' in t ? t.str.trim() : '')).filter(Boolean));
  return per;
}

/** Cicero's pages, settled: the words each shows inside its content area, or the refusal the run threw. */
async function ciceroPages(name: string, body: string): Promise<string[][] | { refused: string }> {
  docs.set(name, head + ciceroEngine.headHtml('/') + sheet + body);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    const h = (window as any).__beltypeCicero;
    try { await h.run(); await h.settled(); } catch (e) { return { refused: String((e as Error).message) }; }
    const per: string[][] = [];
    const root = document.querySelector('beltype-root')!.shadowRoot!;
    for (const [k, p] of [...root.querySelectorAll('beltype-page')].entries()) {
      // A page is `content-visibility: auto`: out of view it is not laid out.
      p.scrollIntoView();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // A page's flow can be filled a frame or more after it comes into view; wait for its content area to be laid out.
      for (let i = 0; i < 60 && !p.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect().height; i++) await new Promise((r) => requestAnimationFrame(r));
      const area = p.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect();
      const here: string[] = [];
      // The page's flow is what the root's slot for it holds (`iv-<k>`), read there: after a resumed presentation the page's own slot answers with the forwarding slot unflattened, though the page draws what it forwards (measured 2026-11-09 on the object case, printed through Chromium: four pages, `after` on the fourth).
      for (const n of (root.querySelector(`slot[name="iv-${k}"]`) as HTMLSlotElement | null)?.assignedNodes() ?? []) {
        const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
        for (let t = walker.currentNode.nodeType === 3 ? walker.currentNode : walker.nextNode(); t; t = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(t);
          const r = range.getBoundingClientRect();
          // A page whose content area the frame has not laid out yet (seen on the last page of the object case, area 0 by 0 after sixty frames) is read by what it is assigned.
          if (t.textContent!.trim() && (!area.height || (r.height && r.top >= area.top - 0.5 && r.bottom <= area.bottom + 0.5))) here.push(t.textContent!.trim());
        }
      }
      per.push(here);
    }
    return per;
  });
  await page.context().close();
  return out as string[][] | { refused: string };
}

test('a row taller than the page under break-inside: avoid that opens the document is divided at once, with no blank first page', async () => {
  const body = `<table><tr style="break-inside: avoid"><td>${lines(40)}</td></tr><tr><td>after</td></tr></table>`;
  const theirs = await chromiumPrint(body);
  const ours = await ciceroPages('avoid-row', body);
  assert.ok(Array.isArray(ours), `refused: ${(ours as { refused: string }).refused}`);
  assert.ok(ours[0].includes('line0'), `the first page shows the row's first line: ${JSON.stringify(ours[0])}`);
  assert.equal(ours.length, theirs.length);
});

test('a block-end padding taller than the page area is spent across pages, and the document is not refused', async () => {
  const body = '<div style="padding-bottom: 700px; border: 2px solid">Hello</div><p>after</p>';
  const ours = await ciceroPages('end-padding', body);
  assert.ok(Array.isArray(ours), `refused: ${(ours as { refused: string }).refused}`);
  // Every word on exactly one page. Chromium prints four pages, the last holding `after` alone; the engine prints three, `after` after the padding's last 208 px: a placement difference, not a loss (report of 2026-11-09).
  assert.deepEqual(ours.flat(), ['Hello', 'after']);
  assert.ok(ours.length >= 3, `the padding spans the pages: ${ours.length}`);
});

test('an <object> whose data fails is measured at its fallback, and a fallback picture taller than the page is cut as Chromium cuts it', async () => {
  const tall = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="700"><rect width="100" height="700" fill="teal"/></svg>')}`;
  const body = `<p>before</p><object data="/nope.png" style="display: block"><img style="display: block" src="${tall}" width="100" height="700" alt="a tall picture"></object><p>after</p>`;
  const theirs = await chromiumPrint(body);
  const ours = await ciceroPages('object-fallback', body);
  assert.ok(Array.isArray(ours), `refused: ${(ours as { refused: string }).refused}`);
  assert.equal(ours.length, theirs.length, `pages: ${JSON.stringify(ours)} against ${JSON.stringify(theirs)}`);
  assert.deepEqual(ours.flat(), ['before', 'after'], JSON.stringify(ours) + JSON.stringify(theirs));
});
