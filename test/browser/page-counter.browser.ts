/**
 * An element's reset of the page counter, in a real browser (Codeberg issues 1 and 2): the host of each page is reset to the number the element's reset counts on to, the flow and the cells are not reset to the author's value, and a `target-counter()` to a page reads the same number.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `release.browser.ts`, whose server this repeats in small.
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

/** The issues' case: two sections, each `counter-reset: page 1` and two pages long, a footer of `counter(page)`, and a reference to each section's last element. */
const CASE = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
html { font: 11pt/1.4 serif; } @page { size: A5; margin: 15mm; @bottom-center { content: "Pagina " counter(page); } }
.fill { height: 175mm; } section { counter-reset: page 1; break-before: page; } a::after { content: " " counter(page) "/" target-counter(attr(href url), page); }
</style></head><body>
<section><p><a href="#fine-1">Uno:</a></p><div class="fill"></div><p id="fine-1">Fine di uno.</p></section>
<section><p><a href="#fine-2">Due:</a></p><div class="fill"></div><p id="fine-2">Fine di due.</p></section>
</body></html>`;

test('a section\'s counter-reset: page 1 numbers its pages 1, 2 and the next section\'s 1, 2 again, and target-counter() to a page reads the same', async () => {
  docs.set('case', CASE);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/case`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    const result = await (window as any).__beltypeCicero.run();
    const pages = [...(document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page'))] as HTMLElement[];
    const hosts = pages.map((p) => p.style.counterReset);
    const inner = pages.map((p) => [...p.shadowRoot!.querySelectorAll<HTMLElement>('[style*="counter-reset"]')].map((e) => e.style.counterReset).filter((v) => /\bpage\b/.test(v)));
    // The content arrives through the root's slot chain, so a fragment's `a` is a light child of the root.
    const refs = [...document.querySelectorAll('beltype-root a')].map((a) => getComputedStyle(a, '::after').content);
    return { pages: result.pages, hosts, inner, refs };
  });
  assert.equal(out.pages, 4);
  assert.deepEqual(out.hosts.map((h: string) => h.match(/\bpage (\d+)/)?.[1]), ['1', '2', '1', '2'], `the host's page counter: ${out.hosts.join(' | ')}`);
  assert.deepEqual(out.inner.flat(), [], 'nothing inside a page resets the page counter');
  // Three sites: the two fragments and the parked original, which reads as the fragment it was copied for. Chromium joins the adjacent strings.
  assert.ok(out.refs.length >= 2, `references found: ${out.refs.length}`);
  assert.deepEqual(out.refs.map((c: string) => c.match(/\/(\d+)"$/)?.[1]), out.refs.map(() => '2'), `target-counter() of each section's last element: ${out.refs.join(' | ')}`);
  await page.context().close();
});
