// What readScope (src/scope.ts) costs a whole run: the built driver is rewritten in place for each variant, a document is printed through a CLI linked to this checkout, and the trace is read.
// `timed` wraps the call in a `cicero:scope` measure; `off` replaces it with no answer (no refusal, no fold). dist/ is restored after.
// Usage: BELTYPE_CLI=<cli checkout linked to this one> node scripts/measure/scope-cost.ts <doc.html> [reps]
// Every Chromium run: lockf -t 3600 /private/tmp/beltype-browser.lock node scripts/measure/scope-cost.ts …
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [doc, repsArg] = process.argv.slice(2);
const cli = process.env.BELTYPE_CLI;
if (!doc || !cli) throw new Error('usage: BELTYPE_CLI=<cli> scope-cost.ts <doc.html> [reps]');
const reps = Number(repsArg ?? 3);
const driver = fileURLToPath(new URL('../../dist/src/driver.js', import.meta.url));
const original = fs.readFileSync(driver, 'utf8');
const call = 'readScope(win, blocks)';
if (!original.includes(call)) throw new Error(`${driver} no longer holds ${call}`);
const variants: Record<string, string> = {
  timed: original.replace(call, `((s) => { const r = readScope(win, blocks); performance.measure('cicero:scope', { start: s, end: performance.now(), detail: { columns: r.length } }); return r; })(performance.now())`),
  off: original.replace(call, '[]'),
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-cost-'));
type M = { name: string; ms: number; detail: any };
const rows: any[] = [];
try {
  for (let i = 0; i < reps; i++) {
    for (const [name, source] of Object.entries(variants)) {
      fs.writeFileSync(driver, source);
      const trace = path.join(tmp, `${name}-${i}.json`);
      try {
        execFileSync('node', [path.join(cli, 'dist/src/cli.js'), 'print', doc, '-o', path.join(tmp, `${name}-${i}.pdf`), '--printer', 'chromium', '--trace', trace], { stdio: ['ignore', 'ignore', 'pipe'] });
      } catch (e: any) {
        console.warn(`${name} ${i}: refused: ${String(e.stderr).split('\n')[0]}`);
      }
      const t = JSON.parse(fs.readFileSync(trace, 'utf8'));
      const ms = (n: string) => (t.cicero as M[]).filter((m) => m.name === n).reduce((a, m) => a + m.ms, 0);
      const runs = (t.cicero as M[]).filter((m) => m.name === 'cicero:index').length;
      const blocks = (t.cicero as M[]).find((m) => m.name === 'cicero:index')?.detail?.blocks;
      const paginate = Math.round(ms('cicero:paginate') * 10) / 10;
      rows.push({ variant: name, rep: i, cut: t.process.cut, paginate, pages: (t.cicero as M[]).find((m) => m.name === 'cicero:paginate')?.detail?.pages, runs, blocks, scope: Math.round(ms('cicero:scope') * 100) / 100, ofCut: `${(100 * ms('cicero:scope') / t.process.cut).toFixed(2)} %`, ofPaginate: `${(100 * ms('cicero:scope') / paginate).toFixed(2)} %` });
    }
  }
} finally {
  fs.writeFileSync(driver, original);
}
console.table(rows);
const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
for (const v of Object.keys(variants)) console.log(`${v}: median cut ${median(rows.filter((r) => r.variant === v).map((r) => r.cut))} ms, median paginate ${median(rows.filter((r) => r.variant === v).map((r) => r.paginate))} ms`);
console.log(`timed: median scope ${median(rows.filter((r) => r.variant === 'timed').map((r) => r.scope))} ms`);
