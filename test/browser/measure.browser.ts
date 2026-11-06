/**
 * The measure context in a real browser: two contexts in one document measure in containers of their own, as two fills in flight do, and the neutralizing sheet stays until the last context goes.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
let server: http.Server;
let browser: Browser;
let origin = '';

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x').pathname;
    if (url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>m</title><body></body>'); return; }
    const file = path.join(dist, url);
    if (!file.startsWith(dist) || !fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('content-type', 'text/javascript');
    res.end(fs.readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

test('two contexts keep what each measures, and the sheet stays until the last goes', async () => {
  const page = await browser.newPage();
  await page.goto(origin);
  const r = await page.evaluate(async () => {
    const { createMeasureContext } = await import('/src/measure.js' as string);
    const nodeOf = (t: string) => Object.assign(document.createElement('p'), { textContent: t });
    const a = createMeasureContext(document, 300), b = createMeasureContext(document, 200);
    a.measure([nodeOf('first')]);
    b.measure([nodeOf('second')]);
    const held = [a.container.textContent, b.container.textContent, a.container.offsetWidth, b.container.offsetWidth];
    const sheets = () => document.head.querySelectorAll('style').length;
    const withBoth = sheets();
    a.dispose();
    const afterOne = [b.container.isConnected, sheets()];
    b.dispose();
    return { held, withBoth, afterOne, afterBoth: sheets(), left: document.querySelectorAll('#__beltype-measure').length };
  });
  assert.deepEqual(r.held, ['first', 'second', 300, 200]);
  assert.equal(r.afterOne[0], true);
  assert.equal(r.afterOne[1], r.withBoth);
  assert.equal(r.afterBoth, r.withBoth - 1);
  assert.equal(r.left, 0);
});
