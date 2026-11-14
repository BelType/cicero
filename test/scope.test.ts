/**
 * The scope the engine states: a vertical box below the root is refused by name, text and an inline-level box directly in the body are refused by name, multi-column boxes are found, and the words sheet turns `one-column` into one column.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readScope, refuseBareContent } from '../src/scope.ts';
import { REGISTRY, WORDS_RULES } from '../src/data-beltype.ts';

const el = (tag: string, kids: any[] = []): any => ({ localName: tag, className: '', querySelectorAll: () => kids });
const win = (styles: Map<any, Record<string, string>>): any => ({ getComputedStyle: (e: any) => styles.get(e) ?? {} });

test('a vertical box below the root is refused by name; a horizontal tree passes', () => {
  const inner = el('p');
  const block = el('div', [inner]);
  assert.deepEqual(readScope(win(new Map()), [block]), []);
  assert.throws(() => readScope(win(new Map([[inner, { writingMode: 'vertical-rl' }]])), [block]), /vertical writing is outside this engine's scope: <p>.*'vertical-rl'/);
});

test('the multi-column boxes are the ones that set a count or a width', () => {
  const a = el('dl'), b = el('div'), c = el('ul');
  const block = el('section', [a, b, c]);
  const styles = new Map<any, Record<string, string>>([[a, { columnCount: '2', columnWidth: 'auto' }], [b, { columnCount: 'auto', columnWidth: '120px' }], [c, { columnCount: 'auto', columnWidth: 'auto' }]]);
  assert.deepEqual(readScope(win(styles), [block]), [a, b]);
});

test('the one-column word is registered and the words sheet makes it one column', () => {
  assert.ok(REGISTRY.some((e) => e.name === 'one-column' && e.kind === 'flag'));
  assert.match(WORDS_RULES, /one-column"\]\s*\{ column-count: auto !important; column-width: auto !important; \}/);
});

test('text directly in the body is refused by its first words; white space and a comment are not', () => {
  const text = (nodeValue: string): any => ({ nodeType: 3, nodeValue });
  const root = (...childNodes: any[]): any => ({ childNodes });
  assert.doesNotThrow(() => refuseBareContent(win(new Map()), root(text(' \n\t'), { nodeType: 8, nodeValue: 'a comment' }, { nodeType: 1 }, text('\r\f ')), []));
  assert.throws(() => refuseBareContent(win(new Map()), root(text('\n'), text('  BARE   words\nhere ')), []), /text directly in the document's body is outside this engine's intake: "BARE words here".*inside a block element/);
  assert.throws(() => refuseBareContent(win(new Map()), root(text('\u00a0')), []), /text directly in the document's body/, 'a no-break space is not white space CSS collapses');
  assert.throws(() => refuseBareContent(win(new Map()), root(text('word '.repeat(30))), []), /"word word word word word word word word …"/);
});

test('an inline-level box directly in the body is refused by its tag; a block, a hidden box and a line break are not', () => {
  const root: any = { childNodes: [] };
  const p = el('p'), none = el('div'), br = el('br'), svg = el('svg'), box = el('div');
  const styles = new Map<any, Record<string, string>>([[p, { display: 'block' }], [none, { display: 'none' }], [br, { display: 'inline' }], [svg, { display: 'inline' }], [box, { display: 'inline-block' }]]);
  assert.doesNotThrow(() => refuseBareContent(win(styles), root, [p, none, br, el('table')]));
  assert.throws(() => refuseBareContent(win(styles), root, [p, svg]), /an inline-level box directly in the document's body is outside this engine's intake: <svg> computes display 'inline'.*inside a block element/);
  assert.throws(() => refuseBareContent(win(styles), root, [box]), /<div> computes display 'inline-block'/);
});
