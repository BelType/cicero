/**
 * Two hosts in one document each keep their own delivery and hiding sheets (fix/scope-per-view, 2026-11-08): `deliver`, `hideReservations`, `showReservations` and `withdraw` take a scope token, defaulting to the document, and the engine's sheets are told apart from the author's whatever the scope.
 *
 * DOM-free: the document is a double with a constructor for sheets and a list of adopted ones.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { deliver, hideReservations, isDeliverySheet, showReservations, withdraw } from '../src/reads.ts';

class Sheet {
  text = '';
  replaceSync(text: string) { this.text = text; }
}
const documentDouble = () => (({ defaultView: { CSSStyleSheet: Sheet }, adoptedStyleSheets: [] } as unknown) as Document);
const values = (key: string, v: string) => new Map([[key, new Map([['--beltype-read-x', v]])]]);
const textOf = (doc: Document) => (doc.adoptedStyleSheets as unknown as Sheet[]).map((s) => s.text);

test('two scopes in one document keep two delivery sheets, and neither overwrites the other', () => {
  const doc = documentDouble();
  const a = {};
  const b = {};
  deliver(doc, values('[href="#a"]', '"1"'), a);
  deliver(doc, values('[href="#b"]', '"2"'), b);
  assert.equal(doc.adoptedStyleSheets.length, 2);
  assert.ok(textOf(doc).some((t) => t.includes('#a')) && textOf(doc).some((t) => t.includes('#b')));
  deliver(doc, values('[href="#a"]', '"3"'), a);
  assert.equal(doc.adoptedStyleSheets.length, 2, 'a second delivery replaces the scope\'s own text');
  assert.ok(textOf(doc).some((t) => t.includes('"3"')) && textOf(doc).some((t) => t.includes('"2"')));
  for (const sheet of doc.adoptedStyleSheets) assert.ok(isDeliverySheet(doc, sheet), 'both are the engine\'s own');
  withdraw(doc, a);
  assert.deepEqual(textOf(doc).map((t) => t.includes('#b')), [true], 'withdrawing one scope leaves the other');
});

test('two scopes hide their own reservations and show them apart', () => {
  const doc = documentDouble();
  const a = {};
  const b = {};
  const site = (key: string) => [{ key, pseudos: ['after' as const] }];
  hideReservations(doc, site('[href="#a"]'), 'view-a', a);
  hideReservations(doc, site('[href="#b"]'), 'view-b', b);
  assert.equal(doc.adoptedStyleSheets.length, 2);
  showReservations(doc, a);
  assert.deepEqual(textOf(doc).map((t) => t.includes('view-b')), [true]);
});

test('the default scope is the document: calls without a token behave as they did', () => {
  const doc = documentDouble();
  deliver(doc, values('[href="#a"]', '"1"'));
  deliver(doc, values('[href="#a"]', '"2"'));
  assert.equal(doc.adoptedStyleSheets.length, 1);
  withdraw(doc);
  assert.equal(doc.adoptedStyleSheets.length, 0);
});
