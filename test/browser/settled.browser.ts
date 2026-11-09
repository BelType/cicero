/**
 * `settled()` waits for a face that is still on its way, and for the resume it causes (the printer waits, 2026-11-08).
 *
 * @remarks
 * The essay's `margin-boxes/content-001` is printed through the CLI, and a face the presented pages asked for arrived after `run()` had answered, was heard as a late fact and cut the document again while Caster read the pages: one print in three refused 'the pages were replaced while they were being printed'. `run()` resolving was all the print waited for. `settled()` is the promise that says nothing is left to cut again: this case adds a face that takes 600 ms to arrive, after the run, and holds that `settled()` resolves only after the face has arrived and the whole run it caused has ended.
 *
 * Run by `pnpm run test:browser` after `pnpm run build`, on the harness of `release.browser.ts`.
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
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/** The documents the tests serve, by name. */
const docs = new Map<string, string>();
let server: http.Server;
let origin = '';
let browser: Browser;

const FACE = path.join(path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json'))), 'standard_fonts', 'LiberationSans-Regular.ttf');
const respond = (res: http.ServerResponse, body: string | Buffer, type: string) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const name = url.pathname;
    if (name.startsWith('/doc/') && docs.has(name.slice(5))) return respond(res, docs.get(name.slice(5)) as string, 'text/html');
    if (name === '/face.ttf') return void setTimeout(() => respond(res, fs.readFileSync(FACE), 'font/ttf'), 600); // the late face
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



/** The shape of the essay's `margin-boxes/content-001`: no text in the body, a face inherited from the root and used only by a margin box, so nothing asks for it until the pages are presented. */
const document_ = () => `<!doctype html><html lang="en"><head><meta charset="utf-8">${ciceroEngine.headHtml('/')}<style>@font-face { font-family: Late; src: url(/face.ttf); } html { font-family: Late, serif; } @page { size: 240px 240px; margin: 40px; @top-center { content: "PASS"; } } body { margin: 0; }</style></head><body></body></html>`;

test('settled() resolves only after a face that loads late and the run it causes', async () => {
  docs.set('late', document_());
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => assert.fail(`page error: ${e.message}`));
  await page.goto(`${origin}/doc/late`);
  await page.waitForFunction(() => (window as any).__beltypeCicero?.run);
  const out = await page.evaluate(async () => {
    const h = (window as any).__beltypeCicero;
    const runs: number[] = [];
    const run = h.run;
    h.run = (...args: unknown[]) => { runs.push(performance.now()); return run.apply(h, args); }; // the rim reads the handle's property at each call, so it counts the resumes it asks for
    const t0 = performance.now();
    await run.call(h);
    const answered = performance.now() - t0;
    await h.settled();
    return { answered, ms: performance.now() - t0, runs: runs.length, faces: [...document.fonts].map((f) => f.family + ':' + f.status), loading: document.fonts.status };
  });
  assert.deepEqual(out.faces, ['Late:loaded'], 'the face has arrived');
  assert.equal(out.runs, 1, `the run the face caused has ended: one cut again, asked for by the rim (run() answered at ${Math.round(out.answered)} ms, settled() at ${Math.round(out.ms)} ms)`);
  assert.equal(out.loading, 'loaded');
  await page.context().close();
});
