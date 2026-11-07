/**
 * The page counter under the page context's own `counter-reset`, `counter-increment` and `counter-set`, held to Chromium's print of the same document: each case is printed by Chromium with no engine and read with pdf.js, then run under Cicero, and every page's number must agree.
 *
 * @remarks
 * The cells are the counter probes' (`packages/essay/probes/counters.js` at BelType `5bcda40d`, P33b, c, d and h), the restart idiom the essay held as the want `the-restarted-count`, and the assessment's case of 2026-11-07: `@page { counter-increment: page 2 } @page :first { counter-reset: page 5 }`, which Cicero numbered 3, 4, 5 where Chromium prints 7, 2, 4. Measured 2026-11-07, Chromium as `playwright-core` pins it: a reset belongs to the page box that declares it and does not carry, a set and an increment carry.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `page-counter.browser.ts`, whose server this repeats.
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

const lines = (n: number) => Array.from({ length: n }, (_, i) => `<p>line ${i} of the text</p>`).join('');
/** Twelve lines a page on a 200 × 300 px page, the folio `F` and the number at the foot; `head` is the engine's head fragment, or nothing for Chromium's own print. */
const doc = (css: string, body: string, head: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${head}<style>
@page { size: 200px 300px; margin: 30px; @bottom-center { content: "F" counter(page); } }
html { font: 12px/20px monospace; } body { margin: 0; } p { margin: 0; } ${css}
</style></head><body>${body}</body></html>`;

/** Chromium's print of the document, one folio a page. */
async function printed(css: string, body: string): Promise<number[]> {
  const page = await browser.newPage();
  await page.setContent(doc(css, body, ''));
  const pdf = await page.pdf({ preferCSSPageSize: true });
  await page.close();
  return foliosOf(pdf);
}

/** The folio of every page of a PDF. */
async function foliosOf(pdf: Uint8Array) {
  const file = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const out: number[] = [];
  for (let i = 1; i <= file.numPages; i++) {
    const text = ((await (await file.getPage(i)).getTextContent()).items as Array<{ str?: string }>).map((t) => t.str ?? '').join(' ');
    out.push(Number(text.match(/F(-?\d+)/)?.[1] ?? NaN));
  }
  return out;
}

/** Cicero's numbers: each page host's `page N`, and whatever the host's own style still does to the page counter. */
async function cicero(key: string, css: string, body: string) {
  docs.set(key, doc(css, body, ciceroEngine.headHtml('/')));
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    await (window as any).__beltypeCicero.run();
    const pages = [...(document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page'))] as HTMLElement[];
    return pages.map((p) => ({ reset: p.style.counterReset, style: `${getComputedStyle(p).counterReset} | ${getComputedStyle(p).counterIncrement} | ${getComputedStyle(p).counterSet}` }));
  });
  const pdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  return { hosts: out, folios: await foliosOf(pdf) };
}

const CASES: Array<[string, string, string]> = [
  ['every page adds 2', '@page { counter-increment: page 2 }', lines(36)],
  ['every page resets to 4', '@page { counter-reset: page 4 }', lines(36)],
  ['the first page resets to 10', '@page :first { counter-reset: page 10 }', lines(36)],
  ['every page adds 2 and the first resets to 5', '@page { counter-increment: page 2 } @page :first { counter-reset: page 5 }', lines(36)],
  ['the first page sets 7', '@page :first { counter-set: page 7 }', lines(36)],
  ['every page sets 7', '@page { counter-set: page 7 }', lines(36)],
  ['a right page adds 2', '@page :right { counter-increment: page 2 }', lines(36)],
  ['a named page resets to 2 after a front page', '.front { page: front } .main { page: main } @page main { counter-reset: page 2 }', `<section class="front">${lines(12)}</section><section class="main">${lines(36)}</section>`],
];

for (const [i, [what, css, body]] of CASES.entries()) {
  test(`the page context's counter rules number the pages as Chromium prints them: ${what}`, async () => {
    const want = await printed(css, body);
    const got = await cicero(`c${i}`, css, body);
    assert.deepEqual(got.folios, want, `Chromium prints ${want.join(', ')}; Cicero's print: ${got.folios.join(', ')}`);
    assert.deepEqual(got.hosts.map((p) => Number(p.reset.match(/\bpage (-?\d+)/)?.[1])), want, `Chromium prints ${want.join(', ')}; Cicero's hosts: ${got.hosts.map((p) => p.reset).join(' | ')}`);
    for (const p of got.hosts) assert.doesNotMatch(p.style.replace(/^page -?\d+( pages \d+)?/, ''), /\bpage\b/, `the host's own style counts the page: ${p.style}`);
  });
}
