/**
 * A running element's edit is a chrome event (*the run resumes from an entry*, amended 2026-11-08): `patch` at a top-level running element draws the margin boxes of every page that shows it again, answers `{ chrome: true }`, and the `run({ resumeAt })` a host makes with that answer cuts nothing and answers at once.
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

/** A running head declared at the top level and three pages of flow; the second case also sets a named string from the head and prints it beside the flow's own string. */
const CASE = (extra = '', head = 'Old head') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
html { font: 11pt/1.4 serif; } @page { size: A5; margin: 20mm 15mm; @top-center { content: element(head); } @bottom-center { content: string(chapter) " " counter(page); } }
.rh { position: running(head); } .fill { height: 150mm; } h1 { string-set: chapter content(); } ${extra}
</style></head><body>
<div class="rh">${head}</div>
<h1>Chapter</h1><div class="fill"></div><p>Two.</p><div class="fill"></div><p>Three.</p>
</body></html>`;

/** Run, patch the head (or, with `inner`, the head's first child), run again; what each page's top-center cell shows, the Ledger's cuts and the bottom cells' text before and after, and how many paginations and presentations the patch cost. */
async function patchTheHead(html: string, inner = false) {
  docs.set('case', html);
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/case`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async (inner) => {
    const h = (window as any).__beltypeCicero;
    const read = async () => {
      await h.buildAll();
      const root = document.querySelector('beltype-root')!;
      const pages = [...root.shadowRoot!.querySelectorAll('beltype-page')];
      // A running element's copy is a light child of the root, assigned to a forwarding slot that is its page's light child.
      const heads = pages.map((pg) => [...root.children].filter((c) => c.assignedSlot?.parentElement === pg && !c.matches('p, h1, div.fill')).map((c) => c.textContent));
      // The page's strings are published on its host, which the bottom cell's `content` reads.
      const bottoms = pages.map((pg) => pg.getAttribute('style'));
      return { heads, bottoms, cuts: JSON.stringify(h.ledger.map((e: any) => [e.paths, e.closes])) };
    };
    const first = await h.run();
    const before = await read();
    const count = (name: string) => performance.getEntriesByName(name).length;
    const runs = [count('cicero:paginate'), count('cicero:present')];
    const fresh = document.createElement(inner ? 'span' : 'div');
    if (inner) fresh.textContent = 'New';
    else { fresh.className = 'rh'; fresh.textContent = 'New head'; }
    const answer = h.patch(0, inner ? [0] : [], fresh);
    const again = await h.run({ resumeAt: answer });
    const after = await read();
    return { first: first.pages, answer, again, before, after, cost: [count('cicero:paginate') - runs[0], count('cicero:present') - runs[1]] };
  }, inner);
  await page.context().close();
  return out;
}

test('a running head edited through patch is drawn on every page it runs on, with no page cut again', async () => {
  const out = await patchTheHead(CASE());
  assert.equal(out.first, 3);
  assert.deepEqual(out.before.heads, [['Old head'], ['Old head'], ['Old head']], 'the head before');
  assert.deepEqual(out.answer, { chrome: true }, 'the patch door answers a chrome event');
  assert.deepEqual(out.after.heads, [['New head'], ['New head'], ['New head']], 'every page shows the new head, once');
  assert.equal(out.after.cuts, out.before.cuts, 'the Ledger is the one before');
  assert.deepEqual(out.cost, [0, 0], 'nothing was paginated or presented again');
  assert.equal(out.again.pages, 3);
  assert.deepEqual(out.again.resumed, { from: 1, to: 0, shift: 0, converged: true, kept: 3 }, 'the run cut nothing and kept every page');
  assert.equal(out.again.why, null);
});

test('a named string set from the running head is unread, before the patch and after it, so the chrome answer moves no value', async () => {
  const out = await patchTheHead(CASE('.rh { string-set: chapter "from the head"; }'));
  assert.deepEqual(out.answer, { chrome: true });
  assert.deepEqual(out.after.bottoms, out.before.bottoms, 'the bottom cells read what they read before');
  assert.ok(out.before.bottoms.every((b: string | null) => !b?.includes('from the head')), `the head's string is not read: ${out.before.bottoms.join(' | ')}`);
  assert.equal(out.after.cuts, out.before.cuts);
  assert.deepEqual(out.cost, [0, 0]);
});

test('a box inside the running head is the same case', async () => {
  const out = await patchTheHead(CASE('', '<span>Old</span> head'), true);
  assert.deepEqual(out.answer, { chrome: true });
  assert.deepEqual(out.after.heads, [['New head'], ['New head'], ['New head']]);
  assert.equal(out.after.cuts, out.before.cuts);
  assert.deepEqual(out.cost, [0, 0]);
});
