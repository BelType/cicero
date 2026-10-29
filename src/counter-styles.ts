/**
 * Counter styles — a counter's value spelled the way `counter()`'s second argument asks for (*a counter has a style*, 2026-09-14; css-counter-styles-3's predefined numeric and alphabetic styles).
 *
 * DOM-free and dependency-free, like every other module under `src/` that is arithmetic rather than a reading. It exists as a module rather than as a branch inside `capture.js#resolveContent` because two readers want it in the same round: the page counters, whose style argument the engine once dropped (see CHANGELOG 2026-09-14), and an author's counter read from a margin box under css-page-3 §6.1.
 *
 * **The set is the predefined styles a real stylesheet writes**, and the omissions are named rather than pretended away: the CJK, Hebrew, Georgian, Armenian and Ethiopic systems are predefined too, and an author's own `@counter-style` rule is a CSSOM read with a descriptor grammar behind it. Neither is built. Both land here, through `format`'s one fallback, as a decimal folio and a console line.
 *
 * **The fallback is the decision, and it is the opposite of this engine's usual posture.** *A refusal is a detector; a fallback is a hiding place* is the standing scar, and it holds wherever the hidden thing is a fact the engine failed to compute. Here the fact is computed — the page's number is the Ledger's, correct and readable — and only its spelling is unknown, so refusing would take a whole render down to withhold a number the reader can use. What stops the fallback being a hiding place is the console line, emitted once per distinct unknown style so a hundred pages do not bury it.
 *
 * @packageDocumentation
 */

/** Styles already reported, so a document with a hundred pages says it once. Keyed by the style name as written. */
const warned: Set<string> = new Set<any>();

const ROMAN: ReadonlyArray<readonly [number,string]> = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];

/** 1..3999 as a lower-case roman numeral. Outside that range there is no numeral, which is why `format` never calls this there. */
function roman(n: number): string {
  let out = '';
  let left = n;
  for (const [value, numeral] of ROMAN) {
    while (left >= value) {
      out += numeral;
      left -= value;
    }
  }
  return out;
}

/** 1..∞ as a bijective base-26 string over a…z: 26 is `z`, 27 is `aa`. Zero and negatives have no letter, which is why `format` never calls this there. */
function alphabetic(n: number): string {
  let out = '';
  let left = n;
  while (left > 0) {
    const rem = (left - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    left = Math.floor((left - 1) / 26);
  }
  return out;
}

/**
 * The styles this engine spells, each a function from an integer to a string or to `null` where the style has no representation for that value.
 *
 * A `null` is css-counter-styles-3's own *range* rule rather than a failure: a numeral system that cannot write the number falls back to `decimal`, which is what the specification says happens and what every browser does.
 */
const STYLES: Record<string,(n: number) => string|null> = {
  decimal: (n) => String(n),
  'decimal-leading-zero': (n) => (n >= 0 && n < 10 ? `0${n}` : String(n)),
  'lower-roman': (n) => (n >= 1 && n <= 3999 ? roman(n) : null),
  'upper-roman': (n) => (n >= 1 && n <= 3999 ? roman(n).toUpperCase() : null),
  'lower-alpha': (n) => (n >= 1 ? alphabetic(n) : null),
  'upper-alpha': (n) => (n >= 1 ? alphabetic(n).toUpperCase() : null),
  'lower-latin': (n) => (n >= 1 ? alphabetic(n) : null),
  'upper-latin': (n) => (n >= 1 ? alphabetic(n).toUpperCase() : null),
  none: () => ''
};

/** The style names this engine answers — the checklist's own list, read from the table rather than typed beside it. */
export const COUNTER_STYLES = Object.keys(STYLES);

/**
 * A counter's value, spelled.
 *
 * @param value - the counter's integer value.
 * @param style - the style named by `counter()`'s second argument; anything absent, unknown, or out of its own range yields decimal.
 * @param warn - where the one-per-style notice goes — injected so the pin can read it without a console.
 */
export function format(value: number, style: string|null = 'decimal', warn: (msg: string) => void = (msg) => console.warn(msg)): string {
  const name = String(style ?? 'decimal').trim().toLowerCase();
  const fn = STYLES[name];
  if (!fn) {
    if (!warned.has(name)) {
      warned.add(name);
      warn(`BelType/Cicero: counter style '${name}' is not one this engine spells (${COUNTER_STYLES.join(', ')}) — the counter is printed in decimal. A folio in the wrong numerals is readable; an empty box is not.`);
    }
    return String(value);
  }
  return fn(value) ?? String(value);
}

/** Forget which styles have been reported — for a pin that wants to see the notice twice. Never called by the engine. */
export function resetWarnings() {
  warned.clear();
}
