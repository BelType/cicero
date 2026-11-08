/**
 * A fixed box and a running element written inside a block stay where the author put them (*a fixed box at any depth*, 2026-09-15; *a running element is a named node*, amended 2026-10-21): every page shows the fixed box's copy and the running head its page's keyword names, and `patch` at a path inside the block that holds them answers an address and the run resumes. The manual's shape: a running head written inside its chapter's `<section>`.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, like `release.browser.ts`, whose server this repeats in small.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { ciceroEngine } from '../../seam/index.ts';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const assets = ciceroEngine.vendorAssets();
const PREFIX = '/_beltype/';
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let server: http.Server;
let origin = '';
let browser: Browser;

/** Two chapters, each a `<section>` holding its own running head; the first also holds a fixed box. Three pages: the first chapter takes two, the second one. */
const CASE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>case</title>${ciceroEngine.headHtml('/')}<style>
html { font: 11pt/1.4 serif; } @page { size: A5; margin: 20mm 15mm; @top-center { content: element(head); } }
section { break-before: page; } .rh { position: running(head); } .stamp { position: fixed; top: 0; left: 0; } .fill { height: 150mm; }
</style></head><body>
<section><div class="rh">Head A</div><h1>Chapter A</h1><div class="stamp">STAMP</div><div class="fill"></div><p>Two.</p><div class="fill"></div></section>
<section><div class="rh">Head B</div><h1>Chapter B</h1><p>Three.</p></section>
</body></html>`;

before(async () => {
  server = http.createServer((req, res) => {
    const name = new URL(req.url ?? '/', 'http://x').pathname;
    const respond = (body: string | Buffer, type: string) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
    if (name === '/doc/case') return respond(CASE, 'text/html');
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

/** Run, read every page, patch the first chapter's `<p>Two.</p>` (path [4] inside section 0), run again with the answer, read again. */
async function runAndPatch() {
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/case`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    const h = (window as any).__beltypeCicero;
    const read = async () => {
      await h.buildAll();
      const root = document.querySelector('beltype-root')!;
      const pages = [...root.shadowRoot!.querySelectorAll('beltype-page')];
      // Every copy and original a page shows is a light child of the root, assigned to a slot that is the page's light child.
      const on = (pg: Element) => [...root.children].filter((c) => c.assignedSlot?.parentElement === pg);
      return {
        heads: pages.map((pg) => on(pg).filter((c) => c.matches('.rh')).map((c) => c.textContent)),
        stamps: pages.map((pg) => on(pg).filter((c) => c.matches('.stamp')).length),
        // Read slot by slot in the page's own order, each slot's nodes in its assignment order: the root's light-DOM order is the order copies were appended in, not the page's.
        text: pages.map((pg) => [...pg.children].filter((c): c is HTMLSlotElement => c instanceof HTMLSlotElement).map((slot) => slot.assignedNodes().map((n) => n.textContent).join(' ')).join(' | ').replace(/\s+/g, ' ').trim())
      };
    };
    const first = await h.run();
    const before = await read();
    const fresh = document.createElement('p');
    fresh.textContent = 'Two, edited.';
    const answer = h.patch(0, [4], fresh);
    const again = answer ? await h.run({ resumeAt: answer }) : null;
    const after = await read();
    return { pages: first.pages, before, answer, again: again && { pages: again.pages, resumed: again.resumed }, after };
  });
  await page.context().close();
  return out;
}

const hash = (pages: string[]) => createHash('sha256').update(JSON.stringify(pages)).digest('hex').slice(0, 16);

test('a fixed box and a running head inside their blocks are on every page, and the text per page is as it was', async () => {
  const out = await runAndPatch();
  assert.equal(out.pages, 3);
  assert.deepEqual(out.before.heads, [['Head A'], ['Head A'], ['Head B']], 'each page shows its chapter\'s head, once');
  assert.deepEqual(out.before.stamps, [1, 1, 1], 'every page shows one copy of the fixed box');
  // The pages' text, hashed: measured on main at 155ba49, where the two were lifted out of their sections at intake.
  assert.equal(hash(out.before.text), '04e33df925d4cbfb', `the text per page: ${JSON.stringify(out.before.text)}`);
});

test('patch inside a block that holds a fixed box and a running head answers an address, and the run resumes', async () => {
  const out = await runAndPatch();
  assert.ok(out.answer && !('chrome' in out.answer), `patch answers an address: ${JSON.stringify(out.answer)}`);
  assert.ok(out.again?.resumed, `the run resumed: ${JSON.stringify(out.again)}`);
  assert.equal(out.again?.pages, 3);
  assert.deepEqual(out.after.heads, [['Head A'], ['Head A'], ['Head B']]);
  assert.deepEqual(out.after.stamps, [1, 1, 1]);
  assert.ok(out.after.text[1]?.includes('Two, edited.'), `the edit is on page two: ${JSON.stringify(out.after.text)}`);
});
