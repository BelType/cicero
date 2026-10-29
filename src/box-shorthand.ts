/**
 * `box-shorthand.js` — the one-to-four-value box grammar, expanded here because the CSSOM sometimes cannot.
 *
 * A declaration block asked for `margin-top` answers with the empty string whenever the `margin` shorthand it was written in carries a `var()`. That is CSS's **pending substitution**: a shorthand whose value contains a variable cannot be serialized into its longhands until the variable is substituted, and substitution is a computed-value-time act that a declaration block has not performed. The block still answers `margin` with the text the author wrote.
 *
 * `capture.js` reads longhands only, which is [*a page rule reads its own declarations*](../../../.claude/decisions/cicero/a-page-rule-reads-its-own-declarations.md) and stays right: the browser has already expanded every shorthand it can, and re-expanding those here would be a second CSS parser doing work that was done properly once. This module is the narrow exception that ruling leaves open — the one case where the browser has expanded nothing, so there is nothing to re-do.
 *
 * **It expands and does not resolve.** Each of the values it hands back is the author's own raw text, which `capture.js` then seats on the property it was declared on and measures through the browser, exactly as it does for a longhand — so `var()`, `calc()`, percentages and every refusal keep working with no second road. That is the whole reason this file knows nothing about lengths.
 *
 * DOM-free on purpose: a grammar transcribed from a specification is worth checking without a browser, and `capture.js` can never be imported into node.
 *
 * The case is `packages/essay/cases/33-the-shorthand-the-cssom-cannot-expand` (see CHANGELOG 2026-09-09).
 *
 * @packageDocumentation
 */

/** Split a component-value list on top-level whitespace — commas and spaces inside `var(--a, 1px 2px)` belong to the function, not to the list. */
export function topLevelValues(value: string): string[] {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(ch)) {
      if (current) out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

/**
 * Expand a box shorthand's value into its four sides, by CSS's own one-to-four rule: one value is every side, two are vertical then horizontal, three are top, horizontal, bottom, and four are top, right, bottom, left.
 *
 * A value list of any other length is not the grammar and returns null rather than a guess — the caller then reports no declaration, which is what it would have had without this module at all.
 *
 * @param value - the shorthand's raw declared text
 */
export function expandBox(value: string|null|undefined): { top: string; right: string; bottom: string; left: string; }|null {
  const v = topLevelValues(value ?? '');
  if (v.length === 1) return { top: v[0], right: v[0], bottom: v[0], left: v[0] };
  if (v.length === 2) return { top: v[0], right: v[1], bottom: v[0], left: v[1] };
  if (v.length === 3) return { top: v[0], right: v[1], bottom: v[2], left: v[1] };
  if (v.length === 4) return { top: v[0], right: v[1], bottom: v[2], left: v[3] };
  return null;
}
