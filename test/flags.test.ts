import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ciceroFlags } from '../seam/flags.ts';

test('ciceroFlags names composed alone, off by default, and the client\'s literal default is the table\'s', () => {
  assert.equal(ciceroFlags.owner, 'cicero');
  assert.deepEqual(Object.keys(ciceroFlags.table), ['composed']);
  assert.deepEqual(ciceroFlags.defaults, { composed: false });
  assert.equal(ciceroFlags.parse('composed', 'true'), true);
  assert.throws(() => ciceroFlags.resolve({ composed: 'yes' as never }), { message: /'composed' takes false or true/ });
  const client = readFileSync(new URL('../seam/client.ts', import.meta.url), 'utf8');
  assert.match(client, new RegExp(`async function runOnce\\(\\{ composed = ${ciceroFlags.defaults.composed},`));
});
