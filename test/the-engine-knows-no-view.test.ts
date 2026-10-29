/**
 * The engine knows no view, as a sweep (*the engine knows no view*, `.claude/decisions/project/the-engine-knows-no-view.md`, ruling 1): no file under `src/` or `seam/` names ProseMirror, in code or in prose.
 *
 * A view that consumes the engine's objects lives in a package of its own and imports the engine; the arrow never points back. The word is matched case-insensitively and comments are not spared, because an editor's vocabulary in a header is where the import starts. Modelled on the repository's `test/host.test.js`, which sweeps core for `fs`; a claim in a comment is not one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PACKAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('no file under src/ or seam/ names prosemirror', () => {
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
  const files = ['src', 'seam'].flatMap((d) => walk(path.join(PACKAGE, d)));
  assert.ok(files.length > 30, 'the sweep reads the engine, not an empty directory');
  const offenders = files.filter((file) => /prosemirror/i.test(fs.readFileSync(file, 'utf-8'))).map((file) => path.relative(PACKAGE, file));
  assert.deepEqual(offenders, [], 'the engine knows no view: a view consumes the engine from its own package');
});
