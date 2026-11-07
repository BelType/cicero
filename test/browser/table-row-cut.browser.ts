/**
 * Where a table with a header is cut between rows, against Chromium's own print of the same document: the page count and the first body row of each page, over row heights, leads before the table and both border models (assessment 2026-11-07, *a collapsed table's row cut one row late*). No row carries `break-inside: avoid`.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`; the server repeats `table-groups.browser.ts`'s.
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

const N = 30;
/** A row of one cell, of two, or of one cell of two lines twice as tall: the cut falls in a cell's stretch, beside a neighbour's, or between a cell's lines. */
const SHAPES: Record<string, (i: number, h: number) => string> = { 'one cell': (i) => `<td>r${i}</td>`, 'two cells': (i) => `<td>r${i}</td><td>r${i}</td>`, 'one cell of two lines': (i, h) => `<td style="height: ${2 * h}px">r${i}<br>and</td>` };
const body = (model: string, h: number, lead: number, cell: (i: number, h: number) => string) => `<style>html { font: 16px/1.5 serif; } body { margin: 0 } @page { size: 300px 300px; margin: 20px; } table { border-collapse: ${model} } td, th { height: ${h}px; padding: 0; border: 1px solid }</style></head><body>${lead ? `<div style="height: ${lead}px"></div>` : ''}<table><thead><tr><th>Head</th></tr></thead><tbody>${Array.from({ length: N }, (_, i) => `<tr>${cell(i, h)}</tr>`).join('')}</tbody></table></body></html>`;
const head = '<!doctype html><html><head><meta charset="utf-8"><title>case</title>';

/** The first body row of each page, from a page list of row numbers. */
const firsts = (per: number[][]) => per.map((rows) => (rows.length ? Math.min(...rows) : -1));

/** Chromium's print of the document without the engine: the body rows on each page, read from the PDF's text. */
async function chromiumPrint(html: string) {
  const page = await (await browser.newContext()).newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const per: number[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const text = await (await doc.getPage(i)).getTextContent();
    per.push(text.items.map((t) => ('str' in t ? /^r(\d+)$/.exec(t.str.trim()) : null)).filter((m) => !!m).map((m) => Number(m![1])));
  }
  return per;
}

/** Cicero's pages: the body rows whose text each prints inside its content area. */
async function ciceroPages(name: string, html: string) {
  docs.set(name, html);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const per = await page.evaluate(async () => {
    await (window as any).__beltypeCicero.run();
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    const per: number[][] = [];
    for (const p of pages) {
      // A page is `content-visibility: auto`: out of view it is not laid out, and its cells measure nothing until a frame has seen it.
      p.scrollIntoView();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const area = p.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect();
      const nodes = [...p.shadowRoot!.querySelectorAll('slot')].flatMap((s) => s.assignedNodes({ flatten: true }));
      const here: number[] = [];
      for (const n of nodes) {
        if (n.nodeType !== 1) continue;
        for (const td of (n as Element).querySelectorAll('td')) {
          // A row is on the page whose content area shows its text, as the PDF's text layer says of Chromium's: a row cut through its stretch shows its text above the cut and its empty remainder after it.
          const m = /^r(\d+)$/.exec(td.firstChild?.textContent!.trim() ?? '');
          if (!m) continue; // a cell's empty remainder
          const range = document.createRange();
          range.selectNodeContents(td.firstChild!);
          const r = range.getBoundingClientRect();
          if (r.height && r.top >= area.top - 0.5 && r.bottom <= area.bottom + 0.5) here.push(Number(m[1]));
        }
      }
      per.push(here);
    }
    return per;
  });
  await page.context().close();
  return per as number[][];
}

for (const model of ['collapse', 'separate']) {
  for (const h of [26, 31, 40, 47]) {
    for (const lead of [0, 16, 37]) {
      for (const [shape, cell] of Object.entries(SHAPES)) {
        test(`a ${model}d-borders table of ${h}px rows of ${shape} after a ${lead}px lead is cut between the rows Chromium cuts between`, async () => {
          const name = `cut-${model}-${h}-${lead}-${shape.length}`;
          const theirs = await chromiumPrint(head + body(model, h, lead, cell));
          const ours = await ciceroPages(name, head + ciceroEngine.headHtml('/') + body(model, h, lead, cell));
          if (process.env.SWEEP) console.log(`SWEEP\t${model}\t${h}\t${lead}\t${shape}\t${theirs.length}\t${firsts(theirs).join(',')}\t${ours.length}\t${firsts(ours).join(',')}`);
          assert.deepEqual(firsts(ours), firsts(theirs));
        });
      }
    }
  }
}
