/**
 * A cut through preserved whitespace, in a real browser: a continuation holds neither the words nor the newlines cut away, and opens on the next line with its indentation.
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
    if (url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>f</title><body></body>'); return; }
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

/** The text of a block's two fragments, cut at `word`, under a `white-space`. */
async function cutAt(whiteSpace: string, html: string, word: number) {
  const page = await browser.newPage();
  await page.goto(origin);
  const r = await page.evaluate(async ({ whiteSpace, html, word }) => {
    const { mutateToContinuation, mutateToFirstFragment } = await import('/src/fragments.js' as string);
    const { copyOf } = await import('/src/word-space.js' as string);
    const source = document.createElement('pre');
    source.style.whiteSpace = whiteSpace;
    source.innerHTML = html;
    document.body.append(source);
    const fragment = (mutate: typeof mutateToContinuation, options: object) => {
      const cloneOf = new Map();
      const clone = copyOf(source, cloneOf);
      return mutate(clone, { source, cloneOf, ...options }).textContent;
    };
    const cut = { path: [0], word, px: null };
    return { first: fragment(mutateToFirstFragment, { cut }), rest: fragment(mutateToContinuation, { cut }) };
  }, { whiteSpace, html, word });
  await page.close();
  return r;
}

for (const whiteSpace of ['pre', 'pre-wrap', 'pre-line', 'break-spaces']) {
  test(`under ${whiteSpace} a continuation opens on the next line, with its indentation`, async () => {
    const r = await cutAt(whiteSpace, 'one two\n\n    three\nfour', 2);
    assert.equal(r.rest, '    three\nfour');
    assert.equal(r.first, 'one two');
  });
}

test('a resume at a soft wrap opens on the word: the space hung at the end of the line before', async () => {
  const r = await cutAt('pre-wrap', 'aa bb\ncc dd ee', 3);
  assert.equal(r.rest, 'dd ee');
});

test('indentation in the text node before a highlighted word is kept', async () => {
  const r = await cutAt('pre-wrap', '<span>one</span>\n  <span>two</span> three', 1);
  assert.equal(r.rest, '  two three');
});

test('under white-space: normal the data stands: the whitespace collapses, and only the record says it is out', async () => {
  const r = await cutAt('normal', 'one two\n    three', 2);
  assert.equal(r.rest, ' \n    three');
});
