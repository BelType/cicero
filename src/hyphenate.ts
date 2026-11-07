/**
 * Liang hyphenation — decision-side, no platform dependency (tablet, The Line: "Hyphenation is ours or absent, computed decision-side — the one part of line management identical across engines by construction"; second-coding-round.md item 2).
 *
 * The classic algorithm: patterns carry inter-letter digits; a word (wrapped in boundary markers) collects, for every position, the maximum digit any matching pattern assigns; odd digits are break opportunities. Exceptions bypass the patterns entirely. `leftmin`/`rightmin` guard word edges.
 *
 * The output is candidate offsets only. Materialization is the Compositor's: a chosen hyphen candidate becomes a literal '-' + <br data-beltype="break"> in the fragment — never a soft hyphen, which is an opportunity the browser may skip (the probes' pinned negative).
 *
 * @packageDocumentation
 */

/** A pattern set as a language module supplies it, as `hyphen-patterns/en-us.js` and `hyphen-patterns/it.js` do. */
export type LanguageData = {
  /** Every `lang` value the set answers, lower-case. */
  id: string[];
  leftmin: number;
  rightmin: number;
  /** Liang patterns, inter-letter digits included. */
  patterns: string[];
  /** Hyphenations given literally, `-` at every division. */
  exceptions?: string[];
  /** What counts as a word, as three groups: what stands before it, the word the patterns read, and what stands after it. Absent, plain ASCII letters and nothing around them. */
  word?: RegExp;
};

/** A registered language: the trie built once. A trie node maps a letter to its child node and `'$'` to the digit list of the pattern ending there, which is why its values are untyped. */
export type Language = {
  trie: Map<string, any>;
  /** The undivided word to its literal hyphenation. */
  exceptions: Map<string, string>;
  leftmin: number;
  rightmin: number;
  word: RegExp;
};

/** css-text-4 §6.3.4's three values; a null or an absence is `auto`. */
export type HyphenateLimits = {
  total?: number | null;
  before?: number | null;
  after?: number | null;
};

import enUs from './hyphen-patterns/en-us.ts';
import it from './hyphen-patterns/it.ts';

const LANGS: Map<string,Language> = new Map<any, any>();

/** Build a language's trie once. Exposed as data-in, function-out so a future language module registers the same way. */
export function registerLanguage(data: LanguageData): Language {
  const trie: Map<string,any> = new Map<any, any>();
  for (const pattern of data.patterns) {
    const letters = pattern.replace(/\d/g, '');
    const points: number[] = [];
    let expect = 0;
    for (const ch of pattern) {
      if (/\d/.test(ch)) {
        points[expect] = Number(ch);
      } else {
        expect++;
      }
    }
    let node = trie;
    for (const ch of letters) {
      if (!node.has(ch)) node.set(ch, new Map<any, any>());
      node = node.get(ch);
    }
    node.set('$', points);
  }
  const exceptions = new Map<any, any>();
  for (const ex of data.exceptions ?? []) {
    exceptions.set(ex.replace(/-/g, ''), ex);
  }
  const lang = { trie, exceptions, leftmin: data.leftmin, rightmin: data.rightmin, word: data.word ?? /^()([a-zA-Z]+)()$/ };
  for (const id of data.id) LANGS.set(id, lang);
  return lang;
}

registerLanguage(enUs);
registerLanguage(it);

/** Resolve a lang attribute value to a registered language, or null (no language, no candidates — auto-hyphenation is never guessed). */
export function languageFor(langAttr: string|null|undefined): Language|null {
  if (!langAttr) return null;
  const lower = langAttr.toLowerCase();
  return LANGS.get(lower) ?? LANGS.get(lower.split('-')[0]) ?? null;
}

/**
 * css-text-4 §6.3.4's `hyphenate-limit-chars`, resolved against a pattern set.
 *
 * *"If the word does not meet the required minimum number of characters in the word / before the hyphen / after the hyphen, then the word must not be hyphenated."* Three values, each `auto` or an integer, and `auto` is *"the UA chooses a value that adapts to the current layout"* — so an `auto` here resolves to what this engine has always used: the pattern set's own `leftmin` and `rightmin`, and their sum for the word total. That is what makes the property free to read: a document that declares nothing gets the numbers it got before, term for term.
 */
export function resolveLimits(lang: Pick<Language,'leftmin'|'rightmin'>, limits: HyphenateLimits = {}): { before: number; after: number; total: number; } {
  const before = limits.before ?? lang.leftmin;
  const after = limits.after ?? lang.rightmin;
  return { before, after, total: limits.total ?? lang.leftmin + lang.rightmin };
}

/**
 * Candidate hyphenation offsets for one word: character indices where the word may break, ascending. Non-alphabetic words yield none — sentinels, numbers, and mixed tokens are never hyphenated.
 *
 * The limits are §6.3.4's and they bind an EXCEPTION as well as a pattern match. The specification's sentence is unqualified — *the word must not be hyphenated* — and it is about the word rather than about where the opportunity came from, so a division the exception list supplies is filtered exactly as one the trie supplies is. The same reading reaches an author's soft hyphen at the caller.
 *
 * @param lang - from `languageFor`; null yields no candidates.
 */
export function hyphenationOffsets(text: string, lang: Language|null, limits: HyphenateLimits = {}): number[] {
  if (!lang) return [];
  const { before, after, total } = resolveLimits(lang, limits);
  const found = lang.word.exec(text);
  if (!found) return [];
  const lead = found[1].length;
  const word = found[2];
  if (word.length < total || word.length < before + after) return [];
  // Both apostrophes are one letter to a pattern; the replacement keeps every offset.
  const lower = word.toLowerCase().replace(/’/g, "'");

  const exception = lang.exceptions.get(lower);
  if (exception !== undefined) {
    const offsets = [];
    let pos = 0;
    for (const part of exception.split('-').slice(0, -1)) {
      pos += part.length;
      if (pos >= before && word.length - pos >= after) offsets.push(lead + pos);
    }
    return offsets;
  }

  const marked = `_${lower}_`;
  const points = new Array(marked.length + 1).fill(0);
  for (let i = 0; i < marked.length; i++) {
    let node = lang.trie;
    for (let j = i; j < marked.length; j++) {
      node = node.get(marked[j]);
      if (!node) break;
      const pat = node.get('$');
      if (pat) {
        for (let k = 0; k < pat.length; k++) {
          if (pat[k] != null && pat[k] > points[i + k]) points[i + k] = pat[k];
        }
      }
    }
  }

  const offsets = [];
  // points index p corresponds to the boundary before marked[p]; word offset = p - 1.
  for (let p = 2; p < marked.length - 1; p++) {
    const off = p - 1;
    if (points[p] % 2 === 1 && off >= before && word.length - off >= after) offsets.push(lead + off);
  }
  return offsets;
}
