/**
 * Release in a real browser (SPEC.md Article XII.7): what `test/release.test.ts` cannot see, the client and the root in a page, headless Chromium through `playwright-core`.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, kept out of the DOM-free `pnpm test`. It serves `dist/` the way a host's `vendorAssets()` table does, and reads nothing outside this repository. The instruments are installed before the client loads: a count of the listeners the engine's files add to `window`, `document` and `document.fonts` (by the stack of the call), a count of runs per handle, and the facsimile's observer.
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
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<<>>>>endobj\n4 0 obj<</Length 0>>stream\n\nendstream endobj\ntrailer<</Root 1 0 R/Size 5>>\n%%EOF\n';

/** The documents the tests serve, by name. */
const docs = new Map<string, string>();
let server: http.Server;
let origin = '';
let browser: Browser;

const respond = (res: http.ServerResponse, body: string | Buffer, type: string) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const name = url.pathname;
    if (name.startsWith('/doc/') && docs.has(name.slice(5))) return respond(res, docs.get(name.slice(5)) as string, 'text/html');
    if (name === '/a.pdf') return respond(res, PDF, 'application/pdf');
    if (name.startsWith(PREFIX)) {
      const rest = name.slice(PREFIX.length);
      const file = (assets.files as Record<string, string>)[rest];
      const dir = rest.startsWith('cicero/seam/') ? ['cicero/seam/', 'seam/'] : rest.startsWith('cicero/src/') ? ['cicero/src/', 'src/'] : null;
      const found = file ?? (dir ? path.join(dist, dir[1] as string, rest.slice((dir[0] as string).length)) : null);
      if (found && fs.existsSync(found)) return respond(res, fs.readFileSync(found), TYPES[path.extname(found)] ?? 'application/octet-stream');
    }
    res.writeHead(404); res.end(name);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

/** A document under Cicero: `paras` paragraphs on 240-px pages, optionally in a webfont family of its own (a local face, so the only news is that it loads) and a PDF. */
function document_(o: { paras?: number; family?: string; key?: string; pdf?: boolean } = {}) {
  const { paras = 40, family = '', key = '', pdf = false } = o;
  const head = ciceroEngine.headHtml('/').replace('client.js"', `client.js${key ? `?k=${key}` : ''}"`);
  const face = family ? `@font-face { font-family: ${family}; src: local("Helvetica Neue"), local("Arial"); }` : '';
  const body = Array.from({ length: paras }, (_, i) => `<p>Paragraph ${i}. Pack my box with five dozen liquor jugs, and then sphinx of black quartz judge my vow.</p>`).join('');
  const object = pdf ? '<object type="application/pdf" data="/a.pdf" style="width:150px;height:80px"><img alt="a page" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></object>' : '';
  return `<!doctype html><html><head><meta charset="utf-8">${head}<style>${face} @page { size: 240px 240px; margin: 20px; } body { margin: 0; font: 14px/1.65 ${family ? `${family}, ` : ''}serif; }</style></head><body>${object}${body}</body></html>`;
}

/** Instruments, installed before the client loads. */
function instruments() {
  const w = window as any;
  const live = new Map<string, string>();
  const ids = new WeakMap<object, number>();
  let issued = 0;
  const idOf = (fn: object) => ids.get(fn) ?? (ids.set(fn, ++issued), issued);
  const name = (t: unknown) => t === window ? 'window' : t === document ? 'document' : t === document.fonts ? 'document.fonts' : null;
  const capture = (o: unknown) => typeof o === 'object' && o !== null ? !!(o as AddEventListenerOptions).capture : !!o;
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, fn: any, o?: any) {
    const who = name(this);
    if (who && fn && !(o && o.once) && String(new Error().stack).includes('/_beltype/cicero/')) live.set(`${who} ${type} ${capture(o)} ${idOf(fn)}`, who);
    return add.call(this, type, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, fn: any, o?: any) {
    const who = name(this);
    if (who && fn) live.delete(`${who} ${type} ${capture(o)} ${idOf(fn)}`);
    return remove.call(this, type, fn, o);
  };
  w.__live = () => [...live.keys()];
  // Runs per handle: every handle assigned to the window has its `run` counted.
  w.__handles = [] as any[];
  w.__trap = () => {
    let held: any;
    Object.defineProperty(window, '__beltypeCicero', { configurable: true, get: () => held, set(v) {
      if (v && typeof v.run === 'function') { const run = v.run; v.n = 0; v.run = (...a: any[]) => { v.n++; return run(...a); }; w.__handles.push(v); }
      held = v;
    } });
  };
  w.__trap();
  // The facsimile's observer: the observers that watched a PDF element, and how many of them were disconnected.
  w.__io = { observed: 0, disconnected: 0 };
  const observe = IntersectionObserver.prototype.observe;
  const disconnect = IntersectionObserver.prototype.disconnect;
  IntersectionObserver.prototype.observe = function (this: any, el: Element) { if (el.localName === 'object') { w.__io.observed++; this.__fac = true; } return observe.call(this, el); };
  IntersectionObserver.prototype.disconnect = function (this: any) { if (this.__fac) w.__io.disconnected++; return disconnect.call(this); };
  w.__logs = 0;
  const info = console.info;
  console.info = (...a: unknown[]) => { if (String(a[0]).includes('pages in') || String(a[0]).includes('pages cut so far')) w.__logs++; return info.apply(console, a); };
}

async function open(name: string, html: string): Promise<Page> {
  docs.set(name, html);
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.addInitScript(instruments);
  await page.goto(`${origin}/doc/${name}`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  return page;
}

const RELEASED = 'this client was released';
const LET_GO = 'the run was let go';

test('1. released while a run is stopped at a page: the pages stay, the handle is gone, run() rejects', async () => {
  const page = await open('one', document_());
  const out = await page.evaluate(async () => {
    const w = window as any;
    const h = w.__beltypeCicero;
    const count = () => document.querySelector('beltype-root')?.shadowRoot?.querySelectorAll('beltype-page').length ?? 0;
    const first = await h.run({ until: 2 });
    const before = count();
    await h.release();
    let rejected = '';
    try { await h.run(); } catch (e: any) { rejected = String(e.message); }
    return { complete: first.complete, cut: first.pages, before, after: count(), gone: w.__beltypeCicero === undefined, rejected };
  });
  assert.equal(out.complete, false);
  assert.equal(out.cut, 2);
  assert.ok(out.before >= 2, `${out.before} pages on screen`);
  assert.equal(out.after, out.before, 'the pages stay');
  assert.ok(out.gone, 'the handle is gone');
  assert.match(out.rejected, new RegExp(RELEASED));
  await page.context().close();
});

test('2. released while a paced run measures: it rejects with the let-go error and the document is put back', async () => {
  const page = await open('two', document_());
  const out = await page.evaluate(async () => {
    const w = window as any;
    const h = w.__beltypeCicero;
    const kids = document.body.children.length;
    const run = h.run({ until: 3 }).then(() => 'resolved', (e: any) => String(e.message));
    const released = h.release().then(() => 'released');
    const outcome = await run;
    await released;
    return { outcome, root: !!document.querySelector('beltype-root'), kids, kidsAfter: document.body.children.length, gone: w.__beltypeCicero === undefined };
  });
  assert.match(out.outcome, new RegExp(LET_GO));
  assert.equal(out.root, false, 'the root is taken out');
  assert.equal(out.kidsAfter, out.kids, 'the document is as it was found');
  assert.ok(out.gone);
  await page.context().close();
});

test('3. released while an unpaced run measures: the run finishes, release waits for it, and nothing runs after', async () => {
  const page = await open('three', document_());
  const out = await page.evaluate(async () => {
    const w = window as any;
    const h = w.__beltypeCicero;
    const order: string[] = [];
    const run = h.run().then((r: any) => { order.push('run'); return r; });
    const released = h.release().then(() => { order.push('release'); });
    const r = await run;
    await released;
    const logs = w.__logs;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { order, complete: r.complete, pages: r.pages, logs, logsLater: w.__logs, runs: w.__handles.map((x: any) => x.n) };
  });
  assert.deepEqual(out.order, ['run', 'release']);
  assert.ok(out.complete && out.pages > 2);
  assert.equal(out.logsLater, out.logs, 'no run after the release');
  assert.deepEqual(out.runs, [1]);
  await page.context().close();
});

test('4. no listener the engine added to window, document or document.fonts is left', async () => {
  const page = await open('four', document_());
  const out = await page.evaluate(async () => {
    const w = window as any;
    const h = w.__beltypeCicero;
    await h.run();
    const held = w.__live();
    await h.release();
    return { held, left: w.__live() };
  });
  assert.ok(out.held.some((k: string) => k.startsWith('document.fonts loadingdone')), `the client listens on the font set: ${out.held.join('; ')}`);
  assert.ok(out.held.some((k: string) => k.startsWith('window hashchange')), 'and the root on the window');
  console.log(`  listeners held before release: ${out.held.length}; left after: ${out.left.length}${out.left.length ? ` (${out.left.join('; ')})` : ''}`);
  assert.deepEqual(out.left, []);
  await page.context().close();
});

test('5. re-seated with a document in another family under a keyed module URL: the new client paginates, the old never runs again', async () => {
  const fresh = await open('five-fresh', document_({ family: 'Alt', key: 'fresh' }));
  const expected = await fresh.evaluate(async () => (await (window as any).__beltypeCicero.run()).pages);
  await fresh.context().close();
  const page = await open('five', document_());
  const next = document_({ family: 'Alt', key: 'kept' });
  const out = await page.evaluate(async (html) => {
    const w = window as any;
    const old = w.__beltypeCicero;
    await old.run();
    await old.release();
    w.__trap();
    document.open();
    document.write(html);
    document.close();
    for (let i = 0; i < 100 && !w.__beltypeCicero?.run; i++) await new Promise((resolve) => setTimeout(resolve, 50));
    const answer = await w.__beltypeCicero.run();
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { pages: answer.pages, complete: answer.complete, runs: w.__handles.map((x: any) => x.n), distinct: w.__handles.length };
  }, next);
  assert.equal(out.distinct, 2);
  assert.equal(out.complete, true);
  assert.equal(out.pages, expected, 'the same pages as a fresh page gives');
  assert.deepEqual(out.runs, [1, 1], 'one run each: the old client answered nothing');
  await page.context().close();
});

test('6. the facsimile observer is disconnected, and a new PDF element after the re-seat observes and draws', async () => {
  const page = await open('six', document_({ paras: 10, pdf: true }));
  const first = await page.evaluate(async () => {
    const w = window as any;
    const h = w.__beltypeCicero;
    await h.run();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const observed = w.__io.observed;
    await h.release();
    return { observed, disconnected: w.__io.disconnected };
  });
  assert.ok(first.observed >= 1, `a PDF element was observed (${first.observed})`);
  assert.equal(first.disconnected, 1, 'the observer is disconnected');
  const next = document_({ paras: 10, pdf: true, key: 'kept', family: 'Alt' });
  const out = await page.evaluate(async (html) => {
    const w = window as any;
    w.__trap();
    document.open();
    document.write(html);
    document.close();
    for (let i = 0; i < 100 && !w.__beltypeCicero?.run; i++) await new Promise((resolve) => setTimeout(resolve, 50));
    await w.__beltypeCicero.run();
    for (let i = 0; i < 100 && !document.querySelector('beltype-root')?.shadowRoot?.querySelector('object canvas, beltype-page object canvas') && !document.querySelector('object canvas'); i++) await new Promise((resolve) => setTimeout(resolve, 50));
    return { observed: w.__io.observed, disconnected: w.__io.disconnected, drawn: !!document.querySelector('object canvas') };
  }, next);
  assert.ok(out.observed > first.observed, `the new element observes (${first.observed} then ${out.observed})`);
  assert.equal(out.disconnected, 1, 'and the new observer is not disconnected');
  assert.ok(out.drawn, 'and its page is drawn');
  await page.context().close();
});
