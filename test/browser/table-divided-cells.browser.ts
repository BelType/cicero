/**
 * Two cells a page divides a row beside, against Chromium's own print of the same document, word for word: a cell spanning three rows at a cut (the essay's old case 92, *the cell that spans the cut*) and a middle- and a bottom-aligned cell beside a tall one (case 93, *the cell aligned in a divided row*), both retired from the monorepo's essay at `a1aabb6` (assessment 2026-11-07, *divided-cell-alignment-and-spanning*).
 *
 * @remarks Each word is on the page whose content area shows it, as the PDF's text layer says of Chromium's. The sentinel grid is the essay's: Courier at 12px on 20px lines, a 400×300px page with 20px margins, orphans and widows 1.
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

const words = (tag: string, n: number) => Array.from({ length: n }, (_, i) => `${tag}w${String(i).padStart(3, '0')}`).join(' ');
const GRID = '@page { size: 400px 300px; margin: 20px; } html { font: 12px/20px "Courier New", Courier, monospace; } body, p, table, td { margin: 0; padding: 0; } body { orphans: 1; widows: 1; } table { border-collapse: collapse; table-layout: fixed; width: 100%; } td { padding: 0 4px; vertical-align: top; } td.middle { vertical-align: middle; } td.bottom { vertical-align: bottom; }';
const doc = (engine: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${engine}<style>${GRID}</style></head><body>${body}</body></html>`;

const CASES: Record<string, string> = {
  'a middle- and a bottom-aligned cell': `<p>${words('p0', 49)}</p><table><tr><td style="width: 33.333%">${words('a0', 20)}</td><td class="middle" style="width: 33.333%">${words('b0', 4)}</td><td class="bottom" style="width: 33.333%">${words('c0', 4)}</td></tr></table><p>${words('q0', 6)}</p>`,
};

/** The spanning cell swept across the page's foot, in three shapes: the lead paragraph's lines move the cut from above the table to below it, through every row the cell spans. Case 92 is the first shape after nine lines. */
const SPANS: Record<string, (span: string, cell: (r: number) => string) => string> = {
  'first of two columns': (span, cell) => `<tr>${span}${cell(1)}</tr><tr>${cell(2)}</tr><tr>${cell(3)}</tr>`,
  'last of two columns': (span, cell) => `<tr>${cell(1)}${span}</tr><tr>${cell(2)}</tr><tr>${cell(3)}</tr>`,
  'middle of three columns': (span, cell) => `<tr>${cell(1)}${span}${cell(1).replaceAll('b1', 'c1')}</tr><tr>${cell(2)}${cell(2).replaceAll('b2', 'c2')}</tr><tr>${cell(3)}${cell(3).replaceAll('b3', 'c3')}</tr>`,
};
for (const [shape, rows] of Object.entries(SPANS)) {
  for (let lines = 3; lines <= 12; lines++) {
    CASES[`a cell spanning three rows, the ${shape}, after ${lines} lines`] = `<p>${words('p0', 7 * lines)}</p><table>${rows(`<td rowspan="3">${words('a0', 24)}</td>`, (r) => `<td>${words(`b${r}`, 6)}</td>`)}</table><p>${words('q0', 6)}</p>`;
  }
}

const WORD = /^[a-z]\d+w\d{3}$/;

/** Chromium's print of the document without the engine: each word's page, from the PDF's text. */
async function chromiumPages(html: string) {
  const page = await (await browser.newContext()).newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  const file = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const at: Record<string, number[]> = {};
  for (let i = 1; i <= file.numPages; i++) {
    const text = ((await (await file.getPage(i)).getTextContent()).items as Array<{ str?: string }>).map((t) => t.str ?? '').join(' ');
    for (const w of text.split(/\s+/)) if (WORD.test(w)) (at[w] ??= []).push(i);
  }
  return at;
}

/** Cicero's pages: each word's page, where its content area shows the word. */
async function ciceroPages(name: string, html: string) {
  docs.set(name, html);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const at = await page.evaluate(async () => {
    await (window as any).__beltypeCicero.run();
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    const at: Record<string, number[]> = {};
    for (const [i, p] of pages.entries()) {
      // A page is `content-visibility: auto`: out of view it is not laid out until a frame has seen it.
      p.scrollIntoView();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const area = p.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect();
      const nodes = [...p.shadowRoot!.querySelectorAll('slot')].flatMap((s) => s.assignedNodes({ flatten: true }));
      for (const n of nodes) {
        const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
        for (let t = n.nodeType === 3 ? n : walker.nextNode(); t; t = walker.nextNode()) {
          for (const m of (t.textContent ?? '').matchAll(/[a-z]\d+w\d{3}/g)) {
            const range = document.createRange();
            range.setStart(t, m.index!);
            range.setEnd(t, m.index! + m[0].length);
            const r = range.getBoundingClientRect();
            if (r.height && r.top >= area.top - 0.5 && r.bottom <= area.bottom + 0.5) (at[m[0]] ??= []).push(i + 1);
          }
          if (n.nodeType === 3) break;
        }
      }
    }
    return at;
  });
  await page.context().close();
  return at as Record<string, number[]>;
}

for (const [name, body] of Object.entries(CASES)) {
  test(`a row divided beside ${name} prints every word on the page Chromium prints it`, async () => {
    const theirs = await chromiumPages(doc('', body));
    const ours = await ciceroPages(`cells-${encodeURIComponent(name)}`, doc(ciceroEngine.headHtml('/'), body));
    assert.deepEqual(ours, theirs);
  });
}
