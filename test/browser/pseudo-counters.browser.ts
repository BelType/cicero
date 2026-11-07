/**
 * A counter a `::before` or an `::after` increments, held to Chromium's print of the same document: the number each figure prints on every page, and a `target-counter()` to a figure.
 *
 * @remarks
 * Chromium's print draws no `target-counter()` (measured 2026-11-07: the `::after` that holds one prints nothing), so the reference is held to the counter at its target, after the target's `::before`. The assessment of 2026-11-07 found the reference reading 0: the counter walk read each element's own style and never its pseudo-elements'. Measured the same day, a figure numbered by its `::before` printed 1 on every page under Cicero, for the same reason: the counters a page is handed at its start did not hold the increments of the pages before it.
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
/** Twelve lines a page on a 200 × 300 px page; `head` is the engine's head fragment, or nothing for Chromium's own print. */
const doc = (css: string, body: string, head: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${head}<style>
@page { size: 200px 300px; margin: 30px; }
html { font: 12px/20px monospace; } body { margin: 0; counter-reset: fig; } p { margin: 0; } ${css}
</style></head><body>${body}</body></html>`;

/** The words of every page of a PDF that match `pattern`. */
async function wordsOf(pdf: Uint8Array, pattern: RegExp) {
  const file = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const out: string[][] = [];
  for (let i = 1; i <= file.numPages; i++) {
    const text = ((await (await file.getPage(i)).getTextContent()).items as Array<{ str?: string }>).map((t) => t.str ?? '').join(' ');
    out.push(text.match(pattern) ?? []);
  }
  return out;
}

/** Chromium's print and Cicero's, of the same document. */
async function both(key: string, css: string, body: string, pattern: RegExp) {
  const plain = await browser.newPage();
  await plain.setContent(doc(css, body, ''));
  const chromiumPdf = await plain.pdf({ preferCSSPageSize: true });
  await plain.close();
  docs.set(key, doc(css, body, ciceroEngine.headHtml('/')));
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  await page.evaluate(() => (window as any).__beltypeCicero.run());
  const ciceroPdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  return { chromium: await wordsOf(chromiumPdf, pattern), cicero: await wordsOf(ciceroPdf, pattern) };
}

/** Three figures, one a page, the second and third referred to. */
const FIGURES = `<p><a href="#f2">see</a></p><p class="fig" id="f1">one</p>${lines(14)}<p class="fig" id="f2">two</p>${lines(14)}<p class="fig" id="f3">three</p><p><a href="#f3">see</a></p>`;
const REFERENCE = 'a::after { content: " REF" target-counter(attr(href url), fig); }';

// A reference reads the counters at its target after the target's `::before` and before its `::after`, as WeasyPrint stores a target (`formatting_structure/build.py`, *"after the ::before is parsed and before the ::after is"*): a figure numbered by its `::before` is read at the number it prints, one numbered by its `::after` at the number before it.
for (const [where, css, refs] of [
  ['::before', '.fig::before { counter-increment: fig; content: "FIG" counter(fig) " "; }', ['REF2', 'REF3']],
  ['::after', '.fig::after { counter-increment: fig; content: " FIG" counter(fig); }', ['REF1', 'REF2']]
] as const) {
  test(`a counter a ${where} increments numbers each page as Chromium prints it, and target-counter() reads it at the target`, async () => {
    const out = await both(`fig${where.slice(2)}`, `${css} ${REFERENCE}`, FIGURES, /(FIG|REF)\d+/g);
    const figures = (pages: string[][]) => pages.map((words) => words.filter((w) => w.startsWith('FIG')));
    assert.deepEqual(figures(out.chromium), [['FIG1'], ['FIG2'], ['FIG3']], 'the oracle');
    assert.deepEqual(figures(out.cicero), figures(out.chromium), `the figures' own numbers: ${JSON.stringify(out.cicero)}`);
    assert.deepEqual(out.cicero.flat().filter((w) => w.startsWith('REF')), refs, `the references: ${JSON.stringify(out.cicero)}`);
  });
}

/**
 * A running head from a heading numbered by its `::before`: css-gcpm-3 §1.1 gives `content()` the element's text, which holds no generated content, so the head reads `Results` where the heading prints `3. Results`; a `counter()` in the same `string-set` reads the number the `::before` printed.
 *
 * @remarks
 * Chromium's print draws no `string()`, so this case is held to the text of css-gcpm-3 and to WeasyPrint's reading of it. The assessment of 2026-11-07 reported `3. Results` from the paper specimen; the read of the same day found it is not Cicero's `content()`: printed through the BelType CLI, Caster's preparation runs before the cut and makes the `::before` a real `<span class="caster-generated">` inside the heading, whose text `content()` then reads.
 */
test('a running head reads a numbered heading\'s text without its ::before, and a counter() beside it reads the number the ::before printed', async () => {
  const css = `@page { @top-center { content: "HEAD[" string(plain) "|" string(numbered) "]"; } }
    body { counter-reset: sec; } h2 { margin: 0; font-size: 12px; string-set: plain content(), numbered counter(sec) " " content(); } h2::before { counter-increment: sec; content: counter(sec) ". "; }`;
  const body = `<h2>Intro</h2>${lines(14)}<h2>Methods</h2>${lines(14)}<h2>Results</h2>${lines(10)}`;
  const out = await both('heads', css, body, /HEAD\[[^\]]*\]/g);
  assert.deepEqual(out.cicero.map((words) => words.join('').replace(/\s+/g, ' ')), ['HEAD[Intro|1 Intro]', 'HEAD[Methods|2 Methods]', 'HEAD[Results|3 Results]', 'HEAD[Results|3 Results]']);
});

/**
 * The same head from a heading whose `::before` a printer's preparation has already made real: Caster turns it into a `<span data-beltype-generated="before">` before the cut, and `content()` leaves out what carries that attribute (the ruling of 2026-11-07, `GENERATED_ATTRIBUTE` in `@beltype/common/data-beltype`), so the head reads the heading without its number; `content(before)` reads exactly that span.
 */
test('a running head leaves out a ::before a printer made real, which content(before) reads', async () => {
  const css = `@page { @top-center { content: "HEAD[" string(plain) "|" string(number) "]"; } }
    h2 { margin: 0; font-size: 12px; string-set: plain content(), number content(before); }`;
  const heading = (n: number, title: string) => `<h2><span class="caster-generated" data-beltype-generated="before">${n}. </span>${title}</h2>`;
  const body = `${heading(1, 'Intro')}${lines(14)}${heading(2, 'Methods')}${lines(14)}${heading(3, 'Results')}${lines(10)}`;
  const out = await both('heads-prepared', css, body, /HEAD\[[^\]]*\]/g);
  assert.deepEqual(out.cicero.map((words) => words.join('').replace(/\s+/g, ' ')), ['HEAD[Intro|1.]', 'HEAD[Methods|2.]', 'HEAD[Results|3.]', 'HEAD[Results|3.]']);
});
