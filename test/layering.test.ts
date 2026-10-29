/**
 * The layering (the engineering constitution, Principle IV), the parts written at 0.1.0: items 1, 2, 3 and 4. Items 5, 7 and 8 are owed (the constitution's standing exceptions); item 6 is `the-engine-knows-no-view.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') ? [join(dir, e.name)] : []));
// Runtime edges only: `import type` and `export type` are erased.
const specifiers = (file: string) => [...readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s(?!type\s)[^;]*?from\s*'([^']+)'|^\s*import\s*'([^']+)'|\bimport\(\s*'([^']+)'\s*\)/gm)].map((m) => (m[1] ?? m[2] ?? m[3]) as string);
const SRC = walk(join(ROOT, 'src'));
const SEAM = walk(join(ROOT, 'seam'));

test('src/ imports nothing outside src/', () => {
  for (const file of SRC) for (const spec of specifiers(file)) {
    assert.ok(spec.startsWith('.') && resolve(dirname(file), spec).startsWith(join(ROOT, 'src')), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test('seam/ imports only src/, seam/, css-tree, common and node\'s url', () => {
  const allowed = /^(\.\.?\/|css-tree(\/parser|\/walker)?$|@beltype\/common\/|url$)/;
  for (const file of SEAM) for (const spec of specifiers(file)) assert.match(spec, allowed, `${relative(ROOT, file)} imports ${spec}`);
});

test('the import graph under src/ has no cycle', () => {
  const edges = new Map(SRC.map((f) => [f, specifiers(f).map((s) => resolve(dirname(f), s))]));
  const state = new Map<string, 'open' | 'done'>();
  const visit = (f: string, path: string[]): void => {
    if (state.get(f) === 'done') return;
    assert.notEqual(state.get(f), 'open', `a cycle: ${[...path, f].map((p) => relative(ROOT, p)).join(' → ')}`);
    state.set(f, 'open');
    for (const g of edges.get(f) ?? []) visit(g, [...path, f]);
    state.set(f, 'done');
  };
  for (const f of SRC) visit(f, []);
});

test('every src/ module but the two custom elements and their importers loads with no DOM', async () => {
  const exempt = new Set(['chase.ts', 'root.ts']);
  const importsExempt = (f: string): boolean => specifiers(f).some((s) => exempt.has(s.replace(/^\.\//, '')) || importsExempt(resolve(dirname(f), s)));
  for (const file of SRC) {
    if (exempt.has(relative(join(ROOT, 'src'), file)) || importsExempt(file)) continue;
    await import(file);
  }
});
