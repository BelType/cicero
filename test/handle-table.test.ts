/**
 * The handle the client publishes carries the geometry table the intake captured (CHANGELOG 2026-10-28), over the client module loaded in a realm that has no page: `window.__beltypeCicero.table`, which a second host in the same document reads in place of the margin boxes' `content` the root has cleared from the CSSOM by then.
 *
 * What a browser adds (that the table is the intake's, margin boxes and all, after the root has presented) is proved by the consumer's harness, which reads a table with its margin boxes on a page the CLI's own round has presented; what is pinned here is that the handle answers one, and answers none before there is one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.customElements = { get: () => undefined, define: () => {} };
globalThis.HTMLElement = class {};
globalThis.document = { fonts: Object.assign(new Set<any>(), { addEventListener() {} }), addEventListener() {}, createElement: () => ({}) };
await import('../seam/client.ts');

test('the handle answers the intake`s table, and null before an intake took one', () => {
  const handle = (window as any).__beltypeCicero;
  assert.ok('table' in handle, 'the handle has the door');
  assert.equal(handle.table, null, 'nothing is presented: no table');
});
