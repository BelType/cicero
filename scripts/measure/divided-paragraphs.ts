// Every paragraph divided across a page cut, read piece by piece after a print through the CLI linked to this checkout: the hanging number stands once, on the first piece, and the pieces' visible letters are the source paragraph's, none lost and none doubled. Caster's own verdict (the conservation of words) is the print's.
// Usage: BELTYPE_CLI=<cli checkout linked to this one> lockf -t 3600 /private/tmp/beltype-browser.lock node scripts/measure/divided-paragraphs.ts <doc.html> [--composed] [--json out.json]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const doc = args.find((a) => !a.startsWith('--') && a.endsWith('.html'));
const composed = args.includes('--composed');
const jsonAt = args.includes('--json') ? args[args.indexOf('--json') + 1] : undefined;
const cli = process.env.BELTYPE_CLI;
if (!doc || !cli) throw new Error('usage: BELTYPE_CLI=<cli> divided-paragraphs.ts <doc.html> [--composed] [--json out.json]');
const run = await import(path.join(cli, 'dist/src/run.js'));
const { chromium } = await import(path.join(cli, 'node_modules/playwright-core/index.mjs'));
const { ciceroFlags } = await import(path.join(cli, 'node_modules/@beltype/cicero/dist/seam/flags.js'));

type Piece = { page: number; start: boolean; end: boolean; letters: string; text: string; nums: string[]; clipped: string; cls: string };

/** In the page: every piece of a divided `<p>`, in reading order, with what a reader sees of it. */
function piecesInPage(): Piece[] {
  const has = (el: Element, w: string) => (el.getAttribute('data-beltype') ?? '').split(/\s+/).includes(w);
  const letters = (s: string) => s.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');
  const pages = [...document.querySelector('beltype-root')!.shadowRoot!.querySelectorAll('beltype-page')];
  const out: Piece[] = [];
  pages.forEach((p, k) => {
    p.scrollIntoView();
    const box = p.getBoundingClientRect();
    for (const el of (p.querySelector(':scope > slot') as HTMLSlotElement).assignedElements()) {
      for (const q of [...(el.matches('p') ? [el] : []), ...el.querySelectorAll('p')]) {
        if (!has(q, 'split')) continue;
        let text = '';
        let clipped = '';
        const walk = document.createTreeWalker(q, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          if (!n.parentElement?.checkVisibility()) continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          const rects = [...r.getClientRects()].filter((c) => c.width > 0);
          if (rects.some((c) => c.bottom > box.bottom + 1 || c.top < box.top - 1)) clipped += n.nodeValue;
          else text += n.nodeValue;
        }
        const nums = [...q.querySelectorAll('.num')].filter((n) => n.checkVisibility() && (n.textContent ?? '').trim()).map((n) => (n.textContent ?? '').trim());
        out.push({ page: k + 1, start: has(q, 'start'), end: has(q, 'end'), letters: letters(text), text, nums, clipped, cls: q.className });
      }
    }
  });
  return out;
}

/** In the page: every source `<p>` of the document as served, its letters and its hanging number. */
async function sourceInPage(): Promise<{ letters: string; num: string | null; cls: string }[]> {
  const letters = (s: string) => s.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');
  const d = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
  return [...d.body.querySelectorAll('p')].map((p) => ({ letters: letters(p.textContent ?? ''), num: p.querySelector('.num')?.textContent?.trim() ?? null, cls: p.className }));
}

const html = fs.readFileSync(doc, 'utf8');
const root = path.dirname(path.resolve(doc));
const docPath = `/${encodeURIComponent(path.basename(doc))}`;
const missing = new Set<string>();
const browser = await chromium.launch({ headless: true, args: run.ARGS });
let verdict = 'accepted';
let pages = 0;
let pieces: Piece[] = [];
let source: Awaited<ReturnType<typeof sourceInPage>> = [];
try {
  const context = await browser.newContext({ viewport: run.VIEWPORT, serviceWorkers: 'block' });
  await run.routeCompanions(context, missing);
  const page = await context.newPage();
  await run.routeDocument(page, missing, { root, docPath, served: run.servedHtml(html) });
  try {
    const printed = await run.printOnPage(page, missing, { caster: {}, cicero: ciceroFlags.resolve(composed ? { composed: true } : {}), beltype: { printer: 'caster', check: false } }, { docPath });
    pages = printed.pages;
    if (missing.size) verdict = `refused: ${[...missing].join('; ')}`;
  } catch (e) {
    verdict = `refused: ${(e as Error).message}`;
  }
  pieces = await page.evaluate(piecesInPage);
  source = await page.evaluate(sourceInPage);
} finally {
  await browser.close();
}

// Pair the pieces: a piece that is not an end continues on a later page with a piece that is not a start.
const divided: Piece[][] = [];
let open: Piece[] | null = null;
for (const p of pieces) {
  if (p.start) { open = [p]; divided.push(open); }
  else if (open) open.push(p);
  else divided.push([p]); // a continuation with no first piece: reported as a failure below
  if (p.end) open = null;
}
const used = new Set<number>();
const failures: unknown[] = [];
for (const group of divided) {
  const letters = group.map((p) => p.letters).join('');
  const first = group[0]!;
  const at = source.findIndex((s, i) => !used.has(i) && s.letters === letters);
  const near = at >= 0 ? at : source.findIndex((s, i) => !used.has(i) && first.letters.length > 0 && s.letters.startsWith(first.letters));
  if (near >= 0) used.add(near);
  const src = near >= 0 ? source[near]! : null;
  const problems: string[] = [];
  if (!first.start) problems.push('no first piece');
  if (!group.at(-1)!.end) problems.push('no last piece');
  if (group.length < 2) problems.push('one piece');
  if (!src) problems.push('no source paragraph matches its first piece');
  else if (src.letters !== letters) problems.push(src.letters.length > letters.length ? `lost ${src.letters.length - letters.length} letters` : `${letters.length - src.letters.length} letters more than the source`);
  const nums = group.flatMap((p, i) => p.nums.map((n) => ({ n, i })));
  if (src?.num) {
    if (nums.length !== 1) problems.push(`number stands ${nums.length} times (${nums.map((x) => `${x.n} on piece ${x.i + 1}`).join(', ')})`);
    else if (nums[0]!.i !== 0) problems.push(`number on piece ${nums[0]!.i + 1}`);
  } else if (nums.length) problems.push(`a number the source does not hang (${nums.map((x) => x.n).join(', ')})`);
  const clipped = group.filter((p) => p.clipped).map((p) => `page ${p.page}: ${p.clipped.slice(0, 60)}`);
  if (clipped.length) problems.push(`text outside its page: ${clipped.join(' | ')}`);
  if (problems.length) failures.push({ pages: group.map((p) => p.page), cls: first.cls, num: src?.num ?? null, head: first.text.slice(0, 80), problems });
}
const withNum = divided.filter((g) => g[0]!.nums.length || source.find((s) => s.letters.startsWith(g[0]!.letters) && g[0]!.letters)?.num).length;
const summary = { doc, composed, verdict, pages, pieces: pieces.length, divided: divided.length, dividedWithNumber: withNum, failures: failures.length };
console.log(JSON.stringify(summary));
for (const f of failures) console.log(JSON.stringify(f));
if (jsonAt) fs.writeFileSync(jsonAt, JSON.stringify({ summary, failures, divided: divided.map((g) => g.map(({ letters, ...p }) => p)) }, null, 2));
