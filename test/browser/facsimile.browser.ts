/**
 * The facsimile's intake in a real browser: a PDF `<object>` whose fallback image has no alt is refused under the default, and under `missingAlt: 'warn'` it is told once and copied with no alternative text, for Caster to refuse at print (Egildo's ruling of 2026-11-08).
 *
 * Run by `pnpm run test:browser` after `pnpm run build`. Each test loads `seam/facsimile.js` alone in a fresh page and calls `install` with a stub for `present`.
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
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<<>>>>endobj\n4 0 obj<</Length 0>>stream\n\nendstream endobj\ntrailer<</Root 1 0 R/Size 5>>\n%%EOF\n';
const BODY = '<object type="application/pdf" data="/a.pdf"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></object><object type="application/pdf" data="/b.pdf#page=1"><img alt=" "></object><object type="application/pdf" data="/c.pdf"><img alt="a page"></object>';

let server: http.Server;
let origin = '';
let browser: Browser;

before(async () => {
  server = http.createServer((req, res) => {
    const name = new URL(req.url ?? '/', 'http://x').pathname;
    if (name === '/doc') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><meta charset="utf-8"><body>${BODY}</body>`); }
    if (name.endsWith('.pdf')) { res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end(PDF); }
    if (name.startsWith(PREFIX)) {
      const rest = name.slice(PREFIX.length);
      const found = (assets.files as Record<string, string>)[rest] ?? (rest.startsWith('cicero/seam/') ? path.join(dist, 'seam', rest.slice('cicero/seam/'.length)) : null);
      if (found && fs.existsSync(found)) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(found)); }
    }
    res.writeHead(404); res.end(name);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

/** Install the facsimile in a fresh page under `options`, and report the refusal, the warnings and each source's copy. */
async function intake(options?: { missingAlt: 'refuse' | 'warn' }) {
  const page = await browser.newPage();
  const warnings: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto(`${origin}/doc`);
  const out = await page.evaluate(async (options) => {
    const facsimile = await import('/_beltype/cicero/seam/facsimile.js' as string);
    let make: ((source: Element) => Element) | null = null;
    try {
      await facsimile.install(document, (_: string, m: (source: Element) => Element) => { make = m; }, options);
    } catch (error) {
      return { error: String((error as Error).message), copies: [] };
    }
    const copies = [...document.querySelectorAll(facsimile.SOURCE)].map((source) => {
      const el = (make as unknown as (source: Element) => Element)(source);
      return { src: el.getAttribute('data-src'), label: el.getAttribute('aria-label'), role: el.getAttribute('role'), editable: el.getAttribute('contenteditable'), is: el.getAttribute('is'), ratio: (el as HTMLElement).style.aspectRatio };
    });
    return { error: null, copies };
  }, options);
  await page.close();
  return { ...out, warnings };
}

test('1. under the default, a source with no fallback alt is refused at intake, by name', async () => {
  const { error, warnings } = await intake();
  assert.equal(error, 'BelType/Cicero: <object type="application/pdf" data="/a.pdf"> has no fallback <img alt="…"> — the page it embeds would be a figure with no alternative text, and the print refuses that. Write the fallback inside the object: <object …><img src="…" alt="what the page shows"></object>.');
  assert.deepEqual(warnings, []);
});

test('2. an explicit refuse is the default', async () => {
  const { error } = await intake({ missingAlt: 'refuse' });
  assert.match(error ?? '', /data="\/a\.pdf"> has no fallback/);
});

test('3. under warn, one warning per source with no alt, naming its data, and its copy carries no alternative text', async () => {
  const { error, warnings, copies } = await intake({ missingAlt: 'warn' });
  assert.equal(error, null);
  const told = warnings.filter((w) => w.includes('has no fallback'));
  assert.equal(told.length, 2);
  assert.ok(told[0]?.includes('<object type="application/pdf" data="/a.pdf">'), told[0]);
  assert.ok(told[1]?.includes('<object type="application/pdf" data="/b.pdf#page=1">'), told[1]);
  const [a, b, c] = copies;
  for (const copy of [a, b]) {
    assert.equal(copy?.label, null);
    assert.equal(copy?.role, null);
    assert.equal(copy?.is, 'beltype-facsimile');
    assert.equal(copy?.editable, 'false');
    assert.equal(copy?.ratio, '200 / 100');
  }
  assert.equal(c?.label, 'a page');
  assert.equal(c?.role, 'img');
  assert.equal(c?.src, `${origin}/c.pdf`);
});

test('4. under the default, a source with an alt is copied as ever', async () => {
  const page = await browser.newPage();
  await page.goto(`${origin}/doc`);
  const copy = await page.evaluate(async () => {
    for (const o of [...document.querySelectorAll('object')].slice(0, 2)) o.remove();
    const facsimile = await import('/_beltype/cicero/seam/facsimile.js' as string);
    let make: ((source: Element) => Element) | null = null;
    await facsimile.install(document, (_: string, m: (source: Element) => Element) => { make = m; });
    const el = (make as unknown as (source: Element) => Element)(document.querySelector(facsimile.SOURCE) as Element);
    return { label: el.getAttribute('aria-label'), role: el.getAttribute('role') };
  });
  await page.close();
  assert.deepEqual(copy, { label: 'a page', role: 'img' });
});
