/**
 * A margin box takes a running element as the node itself, not only through a forwarding slot (CHANGELOG 2026-10-28), over a double of the little DOM `<beltype-page>` touches: `setMarginBox` given a `{ slot, node }` part, as the root gives it, and a part that is a node, as a page outside the root's shadow tree gives it.
 *
 * What a browser adds (that the slot draws what it is assigned, and that a slot outside a shadow tree draws nothing, which is why the second form exists) is proved next door by the venue's running-element cases and the consumer's own harness; what is pinned here is which nodes become the page's light children, which slots are assigned what, and that the root's form is the same as ever.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Just enough of a node: children, a parent, a `dataset` and a `style`, and the slot's `assign`. */
class Fake {
  declare childNodes: any[];
  declare parentNode: any;
  declare assigned: any[] | undefined;
  constructor(tagName: any) { Object.assign(this, { tagName, nodeType: 1, childNodes: [], dataset: {}, style: {} as any, parentNode: null, assigned: [] }); }
  appendChild(node: any) { node.parentNode?.childNodes.splice(node.parentNode.childNodes.indexOf(node), 1); node.parentNode = this; this.childNodes.push(node); return node; }
  setAttribute() {}
  replaceChildren(...nodes: any[]) { this.childNodes = []; for (const n of nodes) this.appendChild(n); }
  assign(...nodes: any[]) { this.assigned = nodes; }
}
const doc = { createElement: (tag: any) => new Fake(tag), createTextNode: (data: any) => Object.assign(new Fake('#text'), { nodeType: 3, data }) };
(globalThis as any).customElements = { get: () => undefined, define: () => {} };
(globalThis as any).HTMLElement = class extends Fake { declare ownerDocument: any; declare shadow: any; constructor() { super('beltype-page'); this.ownerDocument = doc; } attachShadow() { return (this.shadow = new Fake('#shadow')); } };
const BeltypePage: new () => any = (await import('../src/chase.ts')).BeltypePage;

/** The margin cell a page keeps for a box: the shadow's descendant marked with the box's name. */
function cellOf(page: any, box: any) {
  const find = (node: any) => (node.dataset?.box === box ? node : node.childNodes.map(find).find(Boolean));
  return find(page.shadow);
}

test('a part that is a node is the page`s light child and the cell`s own slot is assigned it', () => {
  const page = new BeltypePage();
  const clone = new Fake('em');
  page.setMarginBox('top-center', ['the ', clone]);
  const [text, slot] = cellOf(page, 'top-center').childNodes;
  assert.equal(text.data, 'the ');
  assert.equal(clone.parentNode, page, 'a page outside the root has no shadow tree above it: the node is its light child, where manual assignment reaches it');
  assert.equal(slot.tagName, 'slot');
  assert.deepEqual(slot.assigned, [clone], 'the cell`s slot draws the node itself, with no forwarding slot between');
});

test('a `{ slot, node }` part is the root`s chain as ever: the forwarding slot is the page`s light child and is assigned the node, the cell`s slot the forwarding slot', () => {
  const page = new BeltypePage();
  const forward = new Fake('slot');
  const clone = new Fake('em');
  page.setMarginBox('top-center', [{ slot: forward, node: clone }]);
  const [slot] = cellOf(page, 'top-center').childNodes;
  assert.equal(forward.parentNode, page);
  assert.deepEqual(forward.assigned, [clone]);
  assert.deepEqual(slot.assigned, [forward]);
  assert.equal(clone.parentNode, null, 'the root appends its clone itself; the page does not');
});

test('null clears the box', () => {
  const page = new BeltypePage();
  page.setMarginBox('top-center', ['x']);
  page.setMarginBox('top-center', null);
  assert.deepEqual(cellOf(page, 'top-center').childNodes, []);
});
