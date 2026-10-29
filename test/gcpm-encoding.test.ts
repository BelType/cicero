/**
 * The encoding contract — `src/gcpm-encoding.js` (*the host rewrites what the parser drops*, 2026-09-14).
 *
 * Both halves of the mechanism import this module and neither may spell its names itself, so what these tests pin is the ROUND TRIP: whatever the rewriter encodes, the capture decodes to the same thing. A test that transcribed the literal strings instead would pass on the day the two halves disagreed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeString, encodeElement, decodeContentFn as decodeContentFnTyped, encodePageName, decodePageName, encodeRead, decodeRead, parseReadFunction, FN_PREFIX, BLANK_SUFFIX, STRING_KEYWORDS, encodeStringProp, decodeStringProp, STRING_SET_PROP } from '../src/gcpm-encoding.ts';
import { byShape } from './fakes.ts';

const decodeContentFn = byShape(decodeContentFnTyped);

test('every string() reading round-trips through the literal', () => {
  for (const which of STRING_KEYWORDS) {
    assert.deepEqual(decodeContentFn(encodeString('chap', which)), { fn: 'string', name: 'chap', which });
  }
  assert.deepEqual(decodeContentFn(encodeString('chap')), { fn: 'string', name: 'chap', which: 'first' }, 'no second argument is GCPM\'s own default and is written out, so a decode never has to know the default twice');
});

test('element() round-trips through the literal, its keyword written out', () => {
  assert.deepEqual(decodeContentFn(encodeElement('head')), { fn: 'element', ident: 'head', which: 'first' }, 'no second argument is GCPM\'s own default, written out as string()\'s is');
  for (const which of STRING_KEYWORDS) assert.deepEqual(decodeContentFn(encodeElement('mark', which)), { fn: 'element', ident: 'mark', which }, `element(mark, ${which})`);
  assert.equal(encodeElement('mark', 'last'), `${FN_PREFIX}element(mark,last)`);
  assert.deepEqual(decodeContentFn(`${FN_PREFIX}element(mark,fifth)`), { fn: 'element', ident: 'mark', which: 'first' }, 'a fifth keyword is refused to the default, never passed through to a lookup');
});

test('an ordinary author string decodes to nothing at all', () => {
  for (const s of ['', 'Chapter one', 'string(chap)', '__beltype', 'a — b']) assert.equal(decodeContentFn(s), null);
});

test('the prefix alone is not a form, and is left to be an author\'s own literal', () => {
  assert.equal(decodeContentFn(FN_PREFIX), null);
  assert.equal(decodeContentFn(`${FN_PREFIX}leader(.)`), null, 'a term this module does not write is not one it may claim to have written');
});

test('a fifth keyword is narrowed to first rather than passed through to a lookup that answers nothing', () => {
  assert.equal(decodeContentFn(`${FN_PREFIX}string(chap,middle)`).which, 'first');
});

test('a page name round-trips, and a bare :blank carries no name', () => {
  assert.equal(encodePageName('chapter', true), `chapter${BLANK_SUFFIX}`);
  assert.deepEqual(decodePageName(encodePageName('chapter', true)), { name: 'chapter', blank: true });
  assert.deepEqual(decodePageName(encodePageName(null, true)), { name: null, blank: true }, 'css-page-3 §4.4 counts page type names at f and :blank at g — a blank page that took a NAME would outrank every :first rule in the document');
  assert.deepEqual(decodePageName(encodePageName('chapter', false)), { name: 'chapter', blank: false });
  assert.deepEqual(decodePageName(''), { name: null, blank: false });
  assert.deepEqual(decodePageName(null), { name: null, blank: false });
});

// *target-counters() is read* (2026-10-14): the list of every instance in scope at the target, outermost first, joined by a separator the author writes.

test('target-counters() parses to one read: the address, the counter, the separator, and the optional style', () => {
  assert.deepEqual(parseReadFunction('target-counters', 'attr(href url), item, "."'), { fn: 'counters', attr: 'href', url: null, counter: 'item', style: 'decimal', separator: '.' }, 'the shell`s spelling');
  assert.deepEqual(parseReadFunction('target-counters', 'attr(href), item, " / ", lower-roman'), { fn: 'counters', attr: 'href', url: null, counter: 'item', style: 'lower-roman', separator: ' / ' }, 'a venue`s spelling, a separator with spaces, and the counter style');
  assert.deepEqual(parseReadFunction('TARGET-COUNTERS', '"#t", item, \'.\''), { fn: 'counters', attr: null, url: '#t', counter: 'item', style: 'decimal', separator: '.' }, 'a literal address, and a single-quoted separator');
});

test('a malformed target-counters() is refused, as an unsupported form is: no separator, an unquoted one, a fifth argument, the page counter, a counter name or a style that is not an identifier', () => {
  for (const inner of ['attr(href), item', 'attr(href), item, .', 'attr(href), item, ".", lower-roman, x', 'attr(href), page, "."', 'attr(href), 1item, "."', 'attr(href), item, ".", "roman"']) {
    assert.equal(parseReadFunction('target-counters', inner), null, inner);
  }
});

test('a target-counters() read round-trips through its name, whatever its separator spells, and the name stays a plain custom property', () => {
  const separators = ['.', ' / ', '"', "'", '\\', 'é', '', '-', '_', ' (', '\n'];
  const addresses = [{ attr: 'href', url: null }, { attr: null, url: '#chap 1' }];
  for (const separator of separators) for (const address of addresses) for (const style of ['decimal', 'lower-roman']) {
    const read = { fn: 'counters', ...address, counter: 'item', style, separator };
    const name = encodeRead((read as any));
    assert.match(name, /^--[\w-]+$/, 'a plain identifier');
    assert.deepEqual(decodeRead(name), read, JSON.stringify(separator));
  }
});

test('a named string\'s page property round-trips for every keyword, a name holding a hyphen included, and the rewritten string-set is not one', () => {
  // The page carries its conditions (2026-10-21): the page host publishes `--beltype-string-<name>-<which>`, and the margin dress and the flow rewrite read it.
  for (const name of ['heading', 'chapter-title', 'h_2']) {
    for (const which of STRING_KEYWORDS) {
      const prop = encodeStringProp(name, which);
      assert.match(prop, /^--[\w-]+$/, 'a plain identifier');
      assert.deepEqual(decodeStringProp(prop), { name, which });
    }
  }
  assert.equal(encodeStringProp('heading'), '--beltype-string-heading-first', 'no keyword is GCPM\'s default, written out');
  assert.equal(decodeStringProp(STRING_SET_PROP), null);
  assert.equal(decodeStringProp('--beltype-string-heading-fifth'), null, 'a keyword GCPM does not have is no property of ours');
  assert.equal(decodeStringProp('--beltype-read-text-attr-href-content'), null);
});
