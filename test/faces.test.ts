import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the engine and flags subpaths resolve and export their member alone', async () => {
  const engine = await import('@beltype/cicero/engine');
  const flags = await import('@beltype/cicero/flags');
  assert.deepEqual(Object.keys(engine), ['ciceroEngine']);
  assert.deepEqual(Object.keys(flags), ['ciceroFlags']);
});
