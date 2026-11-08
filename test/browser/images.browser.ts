/**
 * Images that arrive late, in a real browser: the first run does not wait for them, and the rim resumes only for a picture whose arrival changed its box (*late truth is an edit*, amended 2026-11-08; Egildo's ruling of that day, `.claude/plans/quick-rulings-2026-11-08/image-await.md` in the monorepo).
 *
 * Run by `pnpm run test:browser` after `pnpm run build`. The server delays every image by the milliseconds its URL names and draws it as an SVG of the size its URL names, so the same document is served late, or at once to the run it is compared with. Resumes are counted through the handle's own `run`, which the rim calls (the count `release.browser.ts` keeps), minus the calls the test made itself.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { ciceroEngine } from '../../seam/index.ts';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const assets = ciceroEngine.vendorAssets();
const PREFIX = '/_beltype/';
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const docs = new Map<string, string>();
let server: http.Server;
let origin = '';
/** The pictures' own origin, `localhost` for the same server: a browser holds six connections to one host, and six late pictures on the document's would hold back the engine's own modules. */
let pictures = '';
let browser: Browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const name = url.pathname;
    if (name.startsWith('/doc/') && docs.has(name.slice(5))) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(docs.get(name.slice(5))); }
    if (name.startsWith('/img/')) {
      const w = Number(url.searchParams.get('w')), h = Number(url.searchParams.get('h')), d = Number(url.searchParams.get('d') ?? 0);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#888"/></svg>`;
      setTimeout(() => { res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' }); res.end(svg); }, d);
      return;
    }
    if (name.startsWith(PREFIX)) {
      const rest = name.slice(PREFIX.length);
      const file = (assets.files as Record<string, string>)[rest];
      const dir = rest.startsWith('cicero/seam/') ? ['cicero/seam/', 'seam/'] : rest.startsWith('cicero/src/') ? ['cicero/src/', 'src/'] : null;
      const found = file ?? (dir ? path.join(dist, dir[1] as string, rest.slice((dir[0] as string).length)) : null);
      if (found && fs.existsSync(found)) { res.writeHead(200, { 'content-type': TYPES[path.extname(found)] ?? 'application/octet-stream' }); return res.end(fs.readFileSync(found)); }
    }
    res.writeHead(404); res.end(name);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  pictures = `http://localhost:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

const FIGURES = 8;
const LAZY = FIGURES - 1;
/** Sixteen text-only paragraphs, so the first two pages hold no picture, then `FIGURES` figures among paragraphs; the last is `loading="lazy"`. `delay` is each image's base delay in ms (0 for the run compared with), `sized` whether each declares its `width` and `height`. */
function document_({ delay, sized }: { delay: number; sized: boolean }) {
  const head = ciceroEngine.headHtml('/');
  const p = (i: number) => `<p>Paragraph ${i}. Pack my box with five dozen liquor jugs, and then sphinx of black quartz judge my vow.</p>`;
  const lead = Array.from({ length: 16 }, (_, i) => p(i)).join('');
  const rest = Array.from({ length: FIGURES }, (_, i) => {
    const w = 120 + 20 * i, h = 60 + 15 * i;
    const size = sized ? ` width="${w}" height="${h}"` : '';
    const lazy = i === LAZY ? ' loading="lazy"' : '';
    return `<figure><img alt="figure ${i}" src="${pictures}/img/${i}.svg?w=${w}&h=${h}&d=${delay ? delay + 100 * i : 0}"${size}${lazy}><figcaption>Figure ${i}.</figcaption></figure>${p(100 + i)}${p(200 + i)}`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${head}<style>@page { size: 300px 420px; margin: 20px; } body { margin: 0; font: 14px/1.5 serif; } figure { margin: 8px 0; break-inside: avoid; } img { display: block; }</style></head><body>${lead}${rest}</body></html>`;
}

/** A page with the run counter installed before the client loads. Navigation does not wait for the images: `load` would. */
async function open(name: string, html: string): Promise<Page> {
  docs.set(name, html);
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.addInitScript(() => {
    let held: any;
    Object.defineProperty(window, '__beltypeCicero', { configurable: true, get: () => held, set(v) {
      if (v && typeof v.run === 'function') { const run = v.run; v.n = 0; v.run = (...a: any[]) => { v.n++; return run(...a); }; }
      held = v;
    } });
  });
  await page.goto(`${origin}/doc/${name}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  return page;
}

/** In the page: each page's text, the flat tree followed through shadow roots and slots, whitespace dropped, with the `alt` and drawn height of each picture it shows. */
function pagesText() {
  const walk = (node: Node, out: string[]) => {
    if (node.nodeType === Node.TEXT_NODE) { out.push(node.textContent ?? ''); return; }
    if (!(node instanceof Element)) return;
    if (node.localName === 'img') out.push(`[${node.getAttribute('alt')} ${Math.round(node.getBoundingClientRect().height)}]`);
    if (node.localName === 'slot') { for (const n of (node as HTMLSlotElement).assignedNodes({ flatten: true })) walk(n, out); return; }
    for (const n of (node.shadowRoot ?? node).childNodes) walk(n, out);
  };
  const pages = document.querySelector('beltype-root')?.shadowRoot?.querySelectorAll('beltype-page') ?? [];
  return [...pages].map((pg) => { const out: string[] = []; walk(pg, out); return out.join('').replace(/\s+/g, ''); });
}

/** The CLI's own policy, by hand: the first two pages, then the rest; the time to the first answer; then every image settled, the rim's answers settled, and a second with no call of `run()`. The resumes are the calls the test did not make. */
async function runLikeTheCli(page: Page, preload: boolean) {
  return page.evaluate(async ({ preload, lazy }) => {
    const h = (window as any).__beltypeCicero;
    const settle = (img: HTMLImageElement) => img.complete ? null : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
    if (preload) { for (const img of document.images) if (img.loading === 'lazy') img.loading = 'eager'; await Promise.all([...document.images].map(settle)); }
    const t0 = performance.now();
    const first = await h.run({ until: 2 });
    const firstMs = performance.now() - t0;
    const firstImagesComplete = [...document.images].filter((img) => img.complete && img.naturalWidth > 0).length;
    await h.run();
    const ours = h.n;
    await h.buildAll();
    const originals = [...document.querySelectorAll('beltype-root > figure img')] as HTMLImageElement[];
    await Promise.all(originals.map(settle));
    const lazyLoaded = (() => { const img = originals.find((i) => i.alt === `figure ${lazy}`); return !!img && img.complete && img.naturalWidth > 0; })();
    let n = -1;
    while (n !== h.n) { n = h.n; await new Promise((r) => setTimeout(r, 1000)); await h.settled(); }
    await h.buildAll();
    return { firstPages: first.pages, firstMs, firstImagesComplete, resumes: h.n - ours, lazyLoaded };
  }, { preload, lazy: LAZY });
}

for (const sized of [true, false]) {
  test(`${sized ? '1' : '2'}. images ${sized ? 'with' : 'without'} declared sizes, served late: the first pages are presented before any arrives, and the final pages equal a run with every image preloaded`, async () => {
    const late = await open(`late-${sized}`, document_({ delay: 4000, sized }));
    const out = await runLikeTheCli(late, false);
    const text = await late.evaluate(pagesText);
    const ref = await open(`ref-${sized}`, document_({ delay: 0, sized }));
    await runLikeTheCli(ref, true);
    const want = await ref.evaluate(pagesText);
    console.info(`images ${sized ? 'sized' : 'unsized'}: first ${out.firstPages} pages in ${Math.round(out.firstMs)} ms with ${out.firstImagesComplete} of ${FIGURES} images complete; ${out.resumes} resumes; ${text.length} pages`);
    assert.ok(out.firstPages >= 2, `${out.firstPages} pages at the first answer`);
    assert.equal(out.firstImagesComplete, 0, 'no image had arrived when the first pages were presented');
    assert.ok(out.firstMs < 3000, `the first pages took ${Math.round(out.firstMs)} ms, so the run waited for the pictures`);
    assert.ok(out.lazyLoaded, 'the lazy picture was loaded though no reader scrolled to it');
    if (sized) assert.equal(out.resumes, 0, 'a picture whose box its arrival did not change resumes nothing');
    assert.ok(out.resumes <= FIGURES, `${out.resumes} resumes for ${FIGURES} pictures`);
    assert.deepEqual(text, want);
    await late.context().close();
    await ref.context().close();
  });
}

test('3. a picture whose box changes on load resumes once; one whose box does not changes nothing', async () => {
  const page = await open('swap', document_({ delay: 0, sized: true }).replace('</body>', '<figure id="free"><img alt="free" src="/img/free.svg?w=100&h=40"><figcaption>Free.</figcaption></figure></body>'));
  const out = await page.evaluate(async () => {
    const h = (window as any).__beltypeCicero;
    const settle = (img: HTMLImageElement) => img.complete ? null : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
    await h.run();
    await h.buildAll();
    const quiet = async () => { let n = -1; while (n !== h.n) { n = h.n; await new Promise((r) => setTimeout(r, 600)); await h.settled(); } };
    await quiet();
    const swap = async (alt: string, src: string) => {
      const img = document.querySelector(`beltype-root img[alt="${alt}"]`) as HTMLImageElement;
      const before = h.n;
      img.src = src;
      await settle(img);
      await quiet();
      return h.n - before;
    };
    return {
      sizedNewPicture: await swap('figure 0', '/img/x.svg?w=60&h=200'), // declared size: the box keeps it
      freeSamePicture: await swap('free', '/img/y.svg?w=100&h=40'), // no declared size, the same size
      freeTallerPicture: await swap('free', '/img/z.svg?w=100&h=140'), // no declared size, 100 px taller
    };
  });
  assert.deepEqual(out, { sizedNewPicture: 0, freeSamePicture: 0, freeTallerPicture: 1 });
  await page.context().close();
});
