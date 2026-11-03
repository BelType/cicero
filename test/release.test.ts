/**
 * Release (SPEC.md Article XII.7): after the rim is stopped, every listener it added is removed and every observer disconnected, so a document that replaces the page is not answered by the old client. The client and the root need a DOM; what they add is proved by the consumer's re-seat.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchLateTruth } from '../seam/rim.ts';
import { fake, fakeElement } from './fakes.ts';

/** An event target that counts what is still registered on it. */
const target = (shape: object = {}) => {
  const live = new Set<string>();
  return Object.assign({
    live,
    addEventListener: (type: string, fn: unknown, capture?: unknown) => live.add(`${type}:${String(fn)}:${capture}`),
    removeEventListener: (type: string, fn: unknown, capture?: unknown) => live.delete(`${type}:${String(fn)}:${capture}`)
  }, shape);
};

test('stop() removes every listener the rim added and disconnects its observer', () => {
  const observed = new Set<unknown>();
  class RO { observe(el: unknown) { observed.add(el); } unobserve(el: unknown) { observed.delete(el); } disconnect() { observed.clear(); } }
  const doc = target({ defaultView: { ResizeObserver: RO, customElements: { get: () => undefined, whenDefined: () => new Promise(() => {}) } } });
  const fonts = target();
  const box = target({ localName: 'section', querySelectorAll: () => [] });
  const rim = watchLateTruth({ document: fake<Document>(doc), fonts: fake<FontFaceSet>(fonts), originals: [fake<Element>(box)], onSignal: () => {} });
  assert.ok(doc.live.size > 0 && fonts.live.size > 0 && box.live.size > 0 && observed.size > 0, 'the rim listens');
  rim.pieces([[fakeElement(), fakeElement()]], []);
  rim.stop();
  assert.equal(doc.live.size, 0, 'the document');
  assert.equal(fonts.live.size, 0, 'the font set');
  assert.equal(box.live.size, 0, 'the box');
  assert.equal(observed.size, 0, 'the observer');
});
