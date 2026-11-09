/**
 * A divided table's continuation against Chromium's own print of the same document: which rows each page holds, where a continuation's table box begins, and where a nested table's continuation stands across (assessment 2026-11-07, `separated-table-spent-spacing` and `nested-table-continuation-left`).
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


const head = '<!doctype html><html><head><meta charset="utf-8"><title>case</title>';

/** Chromium's print without the engine: per page, the rows whose token it prints, and each token's left edge and top in px from the page's top left. */
async function chromiumPrint(html: string) {
  const page = await (await browser.newContext()).newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const per: { n: number; x: number; y: number }[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vh = p.getViewport({ scale: 1 }).height;
    const text = await p.getTextContent();
    per.push(text.items.flatMap((t) => { const m = 'str' in t ? /^s(\d+)\b/.exec(t.str.trim()) : null; return m && 'transform' in t ? [{ n: Number(m[1]), x: (t.transform[4] as number) * 96 / 72, y: (vh - (t.transform[5] as number)) * 96 / 72 }] : []; }));
  }
  return per;
}

/** Cicero's pages: the rows whose token each shows inside its content area, each token's left edge relative to the page's left, and the top of every table box the page shows against its content area's top. */
async function ciceroPages(name: string, html: string, composed = false) {
  docs.set(name, html);
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async (composed) => {
    await (window as any).__beltypeCicero.run({ composed });
    const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
    const per: { n: number; x: number }[][] = [];
    const tops: number[][] = [];
    for (const p of pages) {
      p.scrollIntoView();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const box = p.getBoundingClientRect();
      const area = p.shadowRoot!.querySelector('.content-area')!.getBoundingClientRect();
      const nodes = [...p.shadowRoot!.querySelectorAll('slot')].flatMap((s) => s.assignedNodes({ flatten: true })).filter((n) => n.nodeType === 1) as Element[];
      const here: { n: number; x: number }[] = [];
      const walker = (root: Element) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const out: Text[] = []; for (let t = w.nextNode(); t; t = w.nextNode()) out.push(t as Text); return out; };
      for (const n of nodes) for (const t of walker(n)) {
        const m = /^s(\d+)$/.exec(t.data.trim());
        if (!m) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        const r = range.getBoundingClientRect();
        if (r.height && r.top >= area.top - 0.5 && r.bottom <= area.bottom + 0.5) here.push({ n: Number(m[1]), x: r.left - box.left });
      }
      per.push(here);
      tops.push(nodes.flatMap((n) => [n, ...n.querySelectorAll('table')]).filter((e) => e.tagName === 'TABLE' && e.getClientRects().length).map((e) => e.getBoundingClientRect().top - area.top));
    }
    return { per, tops };
  }, composed);
  await page.context().close();
  return out as { per: { n: number; x: number }[][]; tops: number[][] };
}

const rowsOf = (per: { n: number }[][]) => per.map((rows) => rows.map((r) => r.n).filter((n) => n > 0).sort((a, b) => a - b)).map((ns) => (ns.length ? `${ns[0]}..${ns.at(-1)}` : '-'));

const cells = (r: number, cols: number, tag = 'td') => `<tr>${Array.from({ length: cols }, (_, c) => `<${tag}>${c === 0 ? `s${r}` : `c${r}x${c}`}</${tag}>`).join('')}</tr>`;
const table = (rows: number, cols: number, cls = '') => `<table${cls ? ` class="${cls}"` : ''}><thead>${cells(0, cols, 'th')}</thead><tbody>${Array.from({ length: rows }, (_, i) => cells(i + 1, cols)).join('')}</tbody></table>`;
const P41 = 'html { font-family: Courier, monospace; font-size: 12px; line-height: 20px; } body { margin: 0; orphans: 1; widows: 1; } p { margin: 0; } @page { size: 360px 320px; margin: 20px; } th, td { border: 1px solid rgb(0, 0, 0); padding: 2px 4px; text-align: left; font-weight: normal; vertical-align: top; }';
const SHAPES: Record<string, string> = {
  'the header-row probe, rows avoided': `<style>${P41} table { width: 100%; border: 3px solid; } tr { break-inside: avoid; }</style></head><body><p>p0</p>${table(30, 3)}</body></html>`,
  'the header-row probe, rows free': `<style>${P41} table { width: 100%; border: 3px solid; }</style></head><body><p>p0</p>${table(30, 3)}</body></html>`,
  'serif on a 400 by 300 page': `<style>html { font: 16px/1.5 serif; } body { margin: 0 } @page { size: 400px 300px; margin: 20px; } table { border: 3px solid; background: rgb(230, 230, 255); } td, th { border: 1px solid; }</style></head><body>${table(30, 2)}</body></html>`,
  'an A5 page in points, padded cells': `<style>html { font: 11pt/1.4 serif; } @page { size: A5; margin: 2cm 1.5cm; } table { width: 100%; border: 3px solid; } td, th { border: 1px solid; padding: 3pt 6pt; }</style></head><body><h1>Title</h1><p>Lead paragraph.</p>${table(60, 3)}</body></html>`
};

const continuations = (tops: number[][]) => tops.slice(1).flat();

for (const [shape, html] of Object.entries(SHAPES)) {
  test(`a bordered table on the default spacing, ${shape}, holds on each page the rows Chromium's holds`, async () => {
    const theirs = await chromiumPrint(head + html);
    const ours = await ciceroPages(`spacing-${shape.length}`, head + ciceroEngine.headHtml('/') + html);
    if (process.env.SWEEP) console.log(`SWEEP\t${shape}\tchromium ${rowsOf(theirs).join(' ')}\tcicero ${rowsOf(ours.per).join(' ')}\ttops ${ours.tops.map((t) => t.map((v) => v.toFixed(2)).join('/')).join(' ')}`);
    assert.deepEqual(rowsOf(ours.per), rowsOf(theirs));
  });

  // Measured 2026-11-09 on main: every continuation's table box begins 2 px above the content area (the default spacing, a spent lead the flow is lifted by), so its background and side borders paint into the page's top margin, where Chromium's print begins them at the page area (pdf.js's operator list of the serif shape's page 2: the table's side borders from 20 px). Two candidate mechanisms, neither settled: the flow's head clip at the area on a page with a spent lead, which departs from *the page clips at its bleed area on the block axis too*, or a clip on the chain's boxes alone; and Caster draws the head at the page box either way (its DESIGN.md S69).
  test(`a bordered table on the default spacing, ${shape}, begins each continuation at the page area`, { todo: 'separated-table-spent-spacing: the spill wants a ruling and Caster' }, async () => {
    const ours = await ciceroPages(`spill-${shape.length}`, head + ciceroEngine.headHtml('/') + html);
    for (const top of continuations(ours.tops)) assert.ok(top >= -0.5, `a continuation's table box at ${top.toFixed(2)} px against the area`);
  });
}

const P41E = `${P41} table { width: 100%; border-collapse: separate; border-spacing: 0; } tr { break-inside: avoid; } table.o > tbody > tr { break-inside: auto; } table.o > tbody > tr > td { padding: 6px; }`;
const outer = (inner: string) => `<style>${P41E}</style></head><body><p>p0</p><table class="o"><thead><tr><th>o0</th><th>o0b</th></tr></thead><tbody><tr><td>o1</td><td>${inner}</td></tr></tbody></table></body></html>`;
const earlyWide = Array.from({ length: 30 }, (_, i) => `<tr><td>x${i + 1}${i < 4 ? ' wider-wider-wider' : ''}</td><td>s${i + 1}</td></tr>`).join('');
/** The left edge of the first-column tokens on each page; the plain table's `sN` stand in its second column. */
const LEFTS: Record<string, string> = {
  'a nested table with its header': outer(table(30, 2)),
  'a nested table without its header': outer(table(30, 2).replace(/<thead>.*?<\/thead>/, '')),
  'a table whose first rows are its widest': `<style>${P41E}</style></head><body><table><thead><tr><th>h</th><th>s0</th></tr></thead><tbody>${earlyWide}</tbody></table></body></html>`
};
const lefts = (per: { n: number; x: number }[][]) => per.map((rows) => rows.filter((r) => r.n > 0).map((r) => Math.round(r.x * 100) / 100).sort((a, b) => a - b)[0] ?? null);

// Measured 2026-11-09 on main, both modes alike: page 1 stands at Chromium's x and every continuation does not (the nested tables 107.72 px against 99.30, the plain one 290.50 against 185.00). The cause is the widths a continuation is pinned at: `tracksOf` reads them off the page's own feed, whose spent rows are hollow and `display: none`, so an automatic-layout table is sized over the interval's rows alone, where Chromium sizes its columns once over every row. The fix is the whole table's widths on every fragment, which SPEC Article VI 7 forbids as written (*a fragment is written its page's tracks as literals, never across pages*).
for (const [shape, html] of Object.entries(LEFTS)) {
  for (const composed of [false, true]) {
    test(`${shape}${composed ? ', composed,' : ''} continues at Chromium's left edge`, { todo: 'nested-table-continuation-left: the widths want a ruling on SPEC Article VI 7' }, async () => {
      const theirs = await chromiumPrint(head + html);
      const ours = await ciceroPages(`left-${shape.length}-${composed}`, head + ciceroEngine.headHtml('/') + html, composed);
      if (process.env.SWEEP) console.log(`SWEEP\t${shape} ${composed}\tchromium ${rowsOf(theirs).join(' ')} ${lefts(theirs).join(' ')}\tcicero ${rowsOf(ours.per).join(' ')} ${lefts(ours.per).join(' ')}`);
      assert.deepEqual(rowsOf(ours.per), rowsOf(theirs));
      for (const [i, x] of lefts(ours.per).entries()) assert.ok(Math.abs((x ?? 0) - (lefts(theirs)[i] ?? 0)) < 0.5, `page ${i + 1}: ${x} against ${lefts(theirs)[i]}`);
    });
  }
}
