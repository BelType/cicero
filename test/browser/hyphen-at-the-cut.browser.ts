/**
 * A page cut at a line the browser hyphenated under `hyphens: auto`, held to Chromium's print of the same document: the hyphen on the page before, the rest of the word on the page after.
 *
 * @remarks
 * Measured 2026-11-07, Cicero never divided such a word: the Gauge joined its lines, so the page ended a line early and the whole word opened the next page, where Chromium prints `incomprehensi‐` at the foot of page one and `bility` at the head of page two. The Gauge now opens a piece where it measures the hyphen the browser drew, and the first fragment writes it. An `overflow-wrap` break with no hyphen and the composed mode's own hyphenated break are the guards.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `list-continuation.browser.ts`, whose server and oracle this repeats.
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
html { font: 12px/20px monospace; } body { margin: 0; } p { margin: 0; } ${css}
</style></head><body>${body}</body></html>`;

/** The words of every page of a PDF that match `pattern`. */
async function wordsOf(pdf: Uint8Array, pattern: RegExp) {
  const file = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const out: string[][] = [];
  for (let i = 1; i <= file.numPages; i++) {
    const text = ((await (await file.getPage(i)).getTextContent()).items as Array<{ str?: string }>).map((t) => t.str ?? '').join('');
    out.push(text.match(pattern) ?? []);
  }
  return out;
}

/** Chromium's print and Cicero's, of the same document. */
async function both(key: string, css: string, body: string, pattern: RegExp, composed = false) {
  const plain = await browser.newPage();
  await plain.setContent(doc(css, body, ''));
  const chromiumPdf = await plain.pdf({ preferCSSPageSize: true });
  await plain.close();
  docs.set(key, doc(css, body, ciceroEngine.headHtml('/')));
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/${key}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  await page.evaluate((c) => (window as any).__beltypeCicero.run({ composed: c }), composed);
  const ciceroPdf = await page.pdf({ preferCSSPageSize: true });
  await page.context().close();
  return { chromium: await wordsOf(chromiumPdf, pattern), cicero: await wordsOf(ciceroPdf, pattern) };
}

const WORDS = /\S+/g;
const CSS = 'p { orphans: 1; widows: 1; }';
const TEXT = 'a an incomprehensibility extraordinarily characterization internationalization';
const auto = (style = '') => `${lines(11)}<p lang="en" style="hyphens: auto; ${style}">${TEXT}</p>`;

for (const [name, body] of [
  ['a line the browser hyphenated', auto()],
  ['a line hyphenated with an author hyphenate-character', auto("hyphenate-character: '='")],
  ['a word broken by overflow-wrap with no hyphen', `${lines(11)}<p style="overflow-wrap: anywhere">a an incomprehensibilityxqztwvbn more</p>`]
] as const) {
  test(`a page cut at ${name} prints as Chromium prints it`, async () => {
    const out = await both(name.replace(/\W+/g, '-'), CSS, body, WORDS);
    assert.ok(out.chromium.length === 2 && out.chromium[1].length > 0, `the oracle crosses a page: ${JSON.stringify(out.chromium)}`);
    assert.deepEqual(out.cicero, out.chromium, `Cicero ${JSON.stringify(out.cicero)}, Chromium ${JSON.stringify(out.chromium)}`);
  });
}

test('the composed mode writes one hyphen at a cut at its own hyphenated break', async () => {
  const out = await both('composed-auto', CSS, auto(), WORDS, true);
  const text = out.cicero.map((p) => p.join(' ')).join(' ');
  assert.ok(!/\u2010{2}|\u2010\s*$/.test(text), `no doubled or stranded hyphen: ${JSON.stringify(out.cicero)}`);
  assert.equal(text.replace(/\u2010/g, '').replace(/\s+/g, ''), (lines(11).replace(/<[^>]+>/g, '') + TEXT).replace(/\s+/g, ''), `every letter once and in order: ${JSON.stringify(out.cicero)}`);
});
