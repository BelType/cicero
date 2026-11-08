/**
 * The encoding contract: the forms a host rewrites into and the capture reads back (*the host rewrites what the parser drops*, 2026-09-14).
 *
 * Chromium's CSS parser refuses four things outright, measured on the parser probe of 2026-09-14: `string-set` on an element, `position: running()` on an element, `content: string()`/`element()` in a margin at-rule, and the whole of any `@page` rule whose selector carries `:blank`. None of them exists in any CSSOM, and this engine's capture reads the CSSOM and nothing else — a ruling that stands. So a host rewrites what the parser would drop into forms the parser keeps, the browser parses the rewritten sheet, and the capture reads what it always read.
 *
 * **This module is the one place those forms are spelled.** The rewriter (`seam/rewrite.js`) writes them and the capture (`src/capture.js`, `src/document-state.js`) reads them, so the two halves cannot drift; nothing else in the engine may spell these names. It is dependency-free and DOM-free, like everything else under `src/`, and every form comes with an `encode`/`decode` pair so a round trip is a unit test rather than a promise.
 *
 * **Two encodings, and the record names them as the price of keeping one parser.** On the element side a custom property survives and cascades, so the declarations are renamed; the engine registers both with `inherits: false` at intake so they cascade as the originals would and reach no descendant. On the page side a custom property is refused as well — measured in the same probe — so the value is carried as an ordinary `<string>` behind a reserved prefix, and a page selector as a reserved page name. A reader of a rewritten sheet meets a prefixed string literal and a strange page name and finds them odd; the host says so once per document on the console.
 *
 * @packageDocumentation
 */

/** A margin box's decoded content term — GCPM's `string()` or `element()`, each with its keyword written out (`element()`'s since *a running element is a named node*, 2026-10-21). */
export type ContentFn = { fn: 'string', name: string, which: string } | { fn: 'element', ident: string, which: string };

/** `string-set: chapter content()` survives as this custom property, its value text carried verbatim. */
export const STRING_SET_PROP = '--beltype-string-set';

/** `position: running(head)` survives as this custom property, holding the identifier alone. */
export const RUNNING_PROP = '--beltype-running';

/** `hyphenate-limit-lines` survives as this custom property, its value text carried verbatim (Chromium drops the property, so the Compositor reads the author's limit from here). It inherits, as the original does, and so is not among {@link CUSTOM_PROPS}. */
export const HYPHENATE_LIMIT_LINES_PROP = '--beltype-hyphenate-limit-lines';

/** Both, for a host that registers them. `syntax: '*'` because the values are the author's own text and this engine is not their grammar; `inherits: false` because neither original inherits. */
export const CUSTOM_PROPS = [STRING_SET_PROP, RUNNING_PROP];

/**
 * The reserved prefix on a margin box's `content` literal.
 *
 * The page context keeps a `<string>` and refuses a custom property, so `string()` and `element()` ride as quoted text: `content: "a " string(chap, first)` becomes `content: "a " "__beltype-fn:string(chap,first)"`, and the value's other terms are untouched. The prefix has no quote and no space in it, which is what lets the capture's own `content` grammar match it as an ordinary string before this module decodes it.
 */
export const FN_PREFIX = '__beltype-fn:';

/** The suffix that turns `:blank` into a page name the parser keeps: `chapter:blank` → `chapter__beltype-blank`, and a bare `:blank` → `__beltype-blank`. */
export const BLANK_SUFFIX = '__beltype-blank';

/** `string(chap, first)` → the literal a margin box's `content` carries. `which` absent is GCPM's own default, `first`, and is written out so a decode never has to know the default twice. */
export const encodeString = (name: string, which: string = 'first'): string => `${FN_PREFIX}string(${name},${which})`;

/** `element(head, last)` → the literal a margin box's `content` carries. `which` absent is GCPM's own default, `first`, and is written out as {@link encodeString} writes it (*a running element is a named node*, 2026-10-21): §1.2.3 gives `element()` the four keywords §1.1.2 gives `string()`. */
export const encodeElement = (ident: string, which: string = 'first'): string => `${FN_PREFIX}element(${ident},${which})`;

/** GCPM §1.1.2's four keywords, and §1.2.3's for `element()`, so a decode can refuse a fifth rather than pass it through to a lookup that answers undefined. */
export const STRING_KEYWORDS = ['first', 'start', 'last', 'first-except'];

/**
 * The prefix of every named string's custom property on the page host (*the page carries its conditions*, 2026-10-21).
 *
 * @remarks
 * A fourth encoding, and the only one written by the engine rather than by a host: a page publishes each of its named strings as `--beltype-string-<name>-<which>` on its own `<beltype-page>`, one property per keyword, and everything the page holds reads it through the cascade. A margin box's `string()` is transliterated into a `var()` of it in the page's shadow sheet (`chase.js`), and an element's `string()` in the flow is rewritten into one by the host (`seam/rewrite.js`), with `""` as the fallback a site measured off the page reads. The name is the meaning: the string's name, escaped so it holds no hyphen, and then the keyword, which may (`first-except`).
 */
export const STRING_PROP_PREFIX = '--beltype-string-';

/** A named string and one of its keywords → the custom property a page publishes it in. `which` absent is GCPM's own default, `first`, written out. */
export const encodeStringProp = (name: string, which: string = 'first'): string => `${STRING_PROP_PREFIX}${escapeField(name)}-${which}`;

/** The inverse of {@link encodeStringProp}, or `null` where the name is not one it writes — `--beltype-string-set` among them, which is the rewritten `string-set` and carries no keyword. */
export function decodeStringProp(prop: string): { name: string; which: string; }|null {
  if (typeof prop !== 'string' || !prop.startsWith(STRING_PROP_PREFIX)) return null;
  const body = prop.slice(STRING_PROP_PREFIX.length);
  const dash = body.indexOf('-');
  if (dash <= 0) return null;
  const which = body.slice(dash + 1);
  return STRING_KEYWORDS.includes(which) ? { name: unescapeField(body.slice(0, dash)), which } : null;
}

/**
 * A margin box's decoded content term, or `null` where the string is an ordinary author literal.
 *
 * @param str - the string part, unquoted, exactly as `resolveContent` reads it.
 */
export function decodeContentFn(str: string): ContentFn|null {
  if (typeof str !== 'string' || !str.startsWith(FN_PREFIX)) return null;
  const body = str.slice(FN_PREFIX.length);
  const s = /^string\(([^,)]+),([^,)]+)\)$/.exec(body);
  if (s) {
    const which = s[2].trim();
    return { fn: 'string', name: s[1].trim(), which: STRING_KEYWORDS.includes(which) ? which : 'first' };
  }
  // `element(head)` with no keyword is still read, as `first`: a literal written before the keyword was carried means what GCPM's default means.
  const e = /^element\(([^,)]+)(?:,([^,)]+))?\)$/.exec(body);
  if (e) {
    const which = (e[2] ?? 'first').trim();
    return { fn: 'element', ident: e[1].trim(), which: STRING_KEYWORDS.includes(which) ? which : 'first' };
  }
  return null; // the prefix without a form this module writes: an author's own literal that happens to start with it, left alone
}

/** A read's meaning, decoded from the custom property that carries it (*a pointer is a read*, 2026-10-03). A target named by an attribute has `attr` and no `url`; a target written as a literal has `url` and no `attr`. */
export type ReadFn = { fn: 'counter', attr: string | null, url: string | null, counter: string, style: string } | { fn: 'counters', attr: string | null, url: string | null, counter: string, style: string, separator: string } | { fn: 'text', attr: string | null, url: string | null, which: string };

/**
 * The prefix of every read's custom property.
 *
 * @remarks
 * A third encoding beside the two above, and the element side's again, because a `content` declaration on an element survives the parser and so does a `var()` in it: `content: " " target-counter(attr(href url), page)` becomes `content: " " var(--beltype-read-counter-attr-href-page-decimal, "")`. The function is replaced in place, inside the author's own declaration, so the author's cascade still decides which rule wins; the engine delivers the value into the property, and the fallback `""` is what a reference whose target is missing shows.
 *
 * **The property's name is the read's meaning**, the way a page name ending in {@link BLANK_SUFFIX} is a page selector's: the function, the address (an attribute's name, or a literal URL), and then the counter and its style or the text's keyword. So the engine learns what a property means from the rewritten sheet alone, two rules writing the same function read the same property, and nothing has to travel beside the sheet from the host that rewrote it.
 */
export const READ_PREFIX = '--beltype-read-';

/** The four keywords `target-text()` takes, css-content-3 §2.6.3 (*"the same values as the string-set property"*). */
export const TEXT_KEYWORDS = ['content', 'before', 'after', 'first-letter'];

/** One field of a read's name: ASCII letters and digits as they are, every other character as `_<hex>_`, so the field holds no hyphen and the hyphen can separate fields. */
const escapeField = (s: string) => [...String(s)].map((ch) => (/[A-Za-z0-9]/.test(ch) ? ch : `_${(ch.codePointAt(0) as number).toString(16)}_`)).join('');

const unescapeField = (s: string) => s.replace(/_([0-9a-f]+)_/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));

/** A read → the custom property that carries it. */
export function encodeRead(read: ReadFn): string {
  const address = read.attr != null ? ['attr', read.attr] : ['url', read.url ?? ''];
  const rest = read.fn === 'text' ? [read.which] : read.fn === 'counters' ? [read.counter, read.style, read.separator] : [read.counter, read.style];
  return READ_PREFIX + [read.fn, ...address, ...rest].map(escapeField).join('-');
}

/** The inverse of {@link encodeRead}, or `null` where the name is not one it writes. */
export function decodeRead(name: string): ReadFn|null {
  if (typeof name !== 'string' || !name.startsWith(READ_PREFIX)) return null;
  const fields = name.slice(READ_PREFIX.length).split('-').map(unescapeField);
  const [fn, kind, value] = fields;
  if (kind !== 'attr' && kind !== 'url') return null;
  const address = { attr: kind === 'attr' ? value : null, url: kind === 'url' ? value : null };
  if (fn === 'counter' && fields.length === 5 && fields[3]) return { fn, ...address, counter: fields[3], style: fields[4] || 'decimal' };
  // The separator is the last field, and an empty one is a trailing hyphen, which `split` keeps.
  if (fn === 'counters' && fields.length === 6 && fields[3]) return { fn, ...address, counter: fields[3], style: fields[4] || 'decimal', separator: fields[5] };
  if (fn === 'text' && fields.length === 4) return { fn, ...address, which: TEXT_KEYWORDS.includes(fields[3]) ? fields[3] : 'content' };
  return null;
}

/** A function's arguments, or a selector list, split on top-level commas; a comma inside a string or inside parentheses or brackets is not a separator. */
export function splitTopLevel(raw: string): string[] {
  const out = [];
  let buf = '';
  let quote = '';
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      buf += ch;
      if (ch === '\\') buf += raw[++i] ?? '';
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  out.push(buf.trim());
  return out;
}

/** A CSS string's contents, its escapes undone the way the tokenizer undoes them for anything a URL fragment holds: a backslash before a character that is not a hex digit is that character. */
const unquoteCss = ( s: string) => s.slice(1, -1).replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/\\(.)/g, '$1');

/**
 * `target-counter()` or `target-text()`, as an author wrote it, → the read it is; `null` for any other function and for a form this engine does not read.
 *
 * The address is css-content-3 §2.6's `[<string> | <url>]`, in the four spellings documents write: `attr(href url)` (the shell's), `attr(href)` (a venue's), a string `"#x"` and `url(#x)`. An `attr()` with a fallback reads the attribute and drops the fallback, a stated limit.
 *
 * `target-counters(<address>, <name>, <separator>[, <style>])` (css-content-3 §2.6.1) is read as `fn: 'counters'`: the separator is a CSS string, and the style an optional counter-style identifier, the same rules `counters()` takes in `document-state.js`. A `target-counters()` of the page counter is refused by name: the page's instances are the page's own (`pageValues`), not the document walk's, and a read this engine cannot answer is refused rather than delivered as zero.
 *
 * @param name - the function's name, as written.
 * @param inner - the text between its parentheses.
 */
export function parseReadFunction(name: string, inner: string): ReadFn|null {
  const fn = String(name).toLowerCase();
  if (fn !== 'target-counter' && fn !== 'target-text' && fn !== 'target-counters') return null;
  const args = splitTopLevel(String(inner));
  const target = args[0] ?? '';
  let address: { attr: string|null; url: string|null; }|null = null;
  const attr = /^attr\(\s*([^\s,()]+)/i.exec(target);
  const url = /^url\(\s*(.*?)\s*\)$/i.exec(target);
  if (attr) address = { attr: attr[1].toLowerCase(), url: null };
  else if (/^(["']).*\1$/s.test(target)) address = { attr: null, url: unquoteCss(target) };
  else if (url) address = { attr: null, url: /^(["']).*\1$/s.test(url[1]) ? unquoteCss(url[1]) : url[1] };
  if (!address) return null;
  if (fn === 'target-counter') {
    const counter = args[1] ?? '';
    if (!/^-?[_a-zA-Z][\w-]*$/.test(counter) || args.length > 3) return null;
    return { fn: 'counter', ...address, counter, style: args[2] || 'decimal' };
  }
  if (fn === 'target-counters') {
    const counter = args[1] ?? '';
    const separator = args[2] ?? '';
    const style = args[3] ?? 'decimal';
    const ident = /^-?[_a-zA-Z][\w-]*$/;
    if (!ident.test(counter) || counter === 'page' || args.length < 3 || args.length > 4) return null;
    if (!/^(["']).*\1$/s.test(separator) || !ident.test(style)) return null;
    return { fn: 'counters', ...address, counter, style, separator: unquoteCss(separator) };
  }
  if (args.length > 2) return null;
  const which = (args[1] ?? 'content').toLowerCase();
  return { fn: 'text', ...address, which: TEXT_KEYWORDS.includes(which) ? which : 'content' };
}

/** A page selector's name and its `:blank` condition, encoded as one identifier. A bare `:blank` carries no name, which is what keeps its specificity at (0,1,0). */
export const encodePageName = (name: string|null|undefined, blank: boolean): string => (blank ? `${name ?? ''}${BLANK_SUFFIX}` : name ?? '');

/**
 * The inverse: a page-name identifier as the capture reads it out of `selectorText`.
 *
 * @returns `name` is null where the identifier names no page — a bare `:blank`, or no identifier at all.
 */
export function decodePageName(ident: string|null|undefined): { name: string|null; blank: boolean; } {
  const s = ident ?? '';
  if (!s.endsWith(BLANK_SUFFIX)) return { name: s || null, blank: false };
  const name = s.slice(0, -BLANK_SUFFIX.length);
  return { name: name || null, blank: true };
}
