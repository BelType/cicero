/**
 * The sixteen page-margin boxes — their names, their seats on the Chase's grid, and css-page-3 §6.2's Table 2 (*where in the band*, 2026-09-07).
 *
 * A module of its own for two reasons, and neither is tidiness. **The list of sixteen names was written twice** — once in `chase.js`, which builds the cells, and once in `capture.js`, which decides whether an at-rule inside a `@page` rule is a margin box — and two lists of the same sixteen things is the fork this engine's own account ruling forbids everywhere else. And **§6.2's table is data, transcribed from a specification**, so it is worth being able to check without a browser; `chase.js` cannot be imported outside one, since defining a custom element needs `HTMLElement` to exist.
 *
 * §6.2 says the table is not advice: *"user agents must behave as though the values in the following table were established by rules in the UA default style sheet."* Two things about it are worth stating before anyone reads the rows, because both are the opposite of the obvious guess. **It is not centring** — ten of the sixteen are aligned somewhere other than the horizontal centre. And **the four corners align toward the page area**: `top-left-corner` is `right`, `top-right-corner` is `left`, which keeps a corner's content beside the page rather than out at the sheet's edge.
 *
 * @packageDocumentation
 */

/** A margin box's outer intrinsic widths, as a caller measures them (§5.3.2). An absent entry is a box that is not generated. */
export type IntrinsicPair = {
  /** The min-content outer width, in px. */
  min?: number;
  /** The max-content outer width, in px. */
  max?: number;
  /** Whether the box is generated, which is §5.2's question, where the caller knows the answer; inferred from the widths where absent. */
  generated?: boolean;
};

/** A declaration as the capture carries it: property, value, priority, in the declaration block's own order. */
export type Decl = [prop: string, value: string, priority: string];

/**
 * Name, grid row, grid column, `text-align`, `vertical-align`. The grid seat is the Chase's; the last two are §6.2's own, transcribed.
 *
 * The only vertical variation in the table is down the two side bands, where the three boxes take `top`, `middle` and `bottom` in turn. Everything else is `middle`.
 */
export const MARGIN_CELLS: ReadonlyArray<readonly [name: string,row: number,column: number,textAlign: string,verticalAlign: string]> = [
  ['top-left-corner', 1, 1, 'right', 'middle'],
  ['top-left', 1, 2, 'left', 'middle'],
  ['top-center', 1, 3, 'center', 'middle'],
  ['top-right', 1, 4, 'right', 'middle'],
  ['top-right-corner', 1, 5, 'left', 'middle'],
  ['left-top', 2, 1, 'center', 'top'],
  ['left-middle', 3, 1, 'center', 'middle'],
  ['left-bottom', 4, 1, 'center', 'bottom'],
  ['right-top', 2, 5, 'center', 'top'],
  ['right-middle', 3, 5, 'center', 'middle'],
  ['right-bottom', 4, 5, 'center', 'bottom'],
  ['bottom-left-corner', 5, 1, 'right', 'middle'],
  ['bottom-left', 5, 2, 'left', 'middle'],
  ['bottom-center', 5, 3, 'center', 'middle'],
  ['bottom-right', 5, 4, 'right', 'middle'],
  ['bottom-right-corner', 5, 5, 'left', 'middle']
];

/** The sixteen names alone — what the capture matches an at-rule inside a `@page` rule against. */
export const MARGIN_BOXES = MARGIN_CELLS.map(([name]) => name);

/**
 * The two properties a margin cell's own mechanism consumes, and the only translation in this engine.
 *
 * A margin cell is a flex container holding one text node, so that text node is an anonymous flex item whose width is its own content. `text-align` on the container therefore moves nothing — it aligns text *inside* a box exactly as wide as its text — and `justify-content` is the lever; `vertical-align` does not apply to a flex container at all, and `align-items` is.
 *
 * **This names property names and stays inside the criterion rather than beside it.** *The page context dresses the host* withholds a declaration on three grounds, and the first is *a property the Chase itself writes*: these are that, in the strictest form. The Chase's cell is a flex box because a flex box is what centres one string in a rectangle, and the price of choosing that mechanism is translating the two properties the specification writes its table in. What is refused is the alternative — teaching the engine which of Appendix A's fifty properties it "supports".
 */
export const ALIGN_X: Record<string,string> = { left: 'flex-start', start: 'flex-start', right: 'flex-end', end: 'flex-end', center: 'center', justify: 'flex-start' };
export const ALIGN_Y: Record<string,string> = { top: 'flex-start', 'text-top': 'flex-start', middle: 'center', bottom: 'flex-end', 'text-bottom': 'flex-end' };

/**
 * The three tracks the page grid gives the band between its margins, in CSS px.
 *
 * @remarks
 * Chromium lays a length out in 1/64 px and drops the remainder of every track on its own, so three thirds of 423.307 px are three tracks of 141.09375 and sum to 423.28125 px, while the measure container, one box of that width, floors the whole to 423.296875. A line that fits the one and not the other is measured on one line and shown on two (specimen `trattato`, page 111). The tracks are therefore whole 1/64 px units that sum to the floor of the band, the last one taking the remainder: no third of a unit is left for the grid to drop, and the content area is as wide as the container it was measured in.
 */
export function bandTracks(band: number): [number,number,number] {
  const units = Math.floor(band * 64);
  const third = Math.floor(units / 3);
  return [third / 64, third / 64, (units - 2 * third) / 64];
}

/** The three boxes of each horizontal band, in band order — what `bandWidths` sizes, and the only membership test `chase.js` needs to know which cells leave the outer grid. */
export const HORIZONTAL_BANDS = {
  top: ['top-left', 'top-center', 'top-right'],
  bottom: ['bottom-left', 'bottom-center', 'bottom-right']
};

/**
 * A box's intrinsic pair, normalized — a box that is not generated *"is assumed to have a width and an outer width of zero"* (§5.3.2), which is what an absent entry means here.
 *
 * **Whether it is generated is §5.2's question, answered by content and never by a width** (*a margin box exists by its content*, 2026-09-15): a box whose content is the empty string is generated and measures zero, and inferring generation from the measurement gave the author's rule along the foot no width at all. A caller that knows says so in `generated`; an entry without the flag falls back to the inference, which is only right for a box that has something to measure.
 */
const pair = (x: IntrinsicPair|null|undefined): { min: number; max: number; generated: boolean; } => ({ min: Math.max(0, x?.min ?? 0), max: Math.max(0, x?.max ?? 0), generated: x?.generated ?? ((x?.max ?? 0) > 0 || (x?.min ?? 0) > 0) });

/**
 * §5.3.2's *Resolving auto widths* for two boxes, which is the whole of the section's arithmetic — the three-box case calls it once against an imaginary box.
 *
 * The three branches are the section's own, in its own order, and each is a different answer to *how much room is there*: more than both max-content widths want, so distribute the surplus in proportion to those; more than both min-content widths want but not both max, so distribute the surplus in proportion to how much each box could still grow; or less than even the min-content widths, in which case the same arithmetic runs with a negative flex space and factors in proportion to the min-content widths, which shrinks the boxes in proportion to how small they already are. *"In each case, both flex factors are assumed to be 1 if their sum is equal to zero."*
 */
function distribute(x: { min: number; max: number; }, y: { min: number; max: number; }, available: number): [number,number] {
  const share: (bx: number,by: number,flex: number,fx: number,fy: number) => [number,number] = (bx, by, flex, fx, fy): [number,number] => {
    const sum = fx + fy;
    const [gx, gy] = sum === 0 ? [1, 1] : [fx, fy];
    return [bx + (flex * gx) / (gx + gy), by + (flex * gy) / (gx + gy)];
  };
  const sumMax = x.max + y.max;
  if (sumMax < available) return share(x.max, y.max, available - sumMax, x.max, y.max);
  const sumMin = x.min + y.min;
  if (sumMin < available) return share(x.min, y.min, available - sumMin, x.max - x.min, y.max - y.min);
  return share(x.min, y.min, available - sumMin, x.min, y.min);
}

/**
 * The variable-dimension algorithm — css-page-3 §5.3.2, over one horizontal band (*the margin boxes flex*, 2026-09-14). Pure arithmetic: three `{ min, max }` outer intrinsic widths in, three used outer widths out, summing to `available`.
 *
 * The section states its own priorities before it states its rules, and they are what the shape below is for: *"to center the middle box (B) if it is generated, to minimize overflow and overlap, and to distribute space proportionally to the amount of content."* So the generated middle box is resolved first, against an **imaginary AC box** each of whose dimensions is double the larger of A and C — that doubling is exactly what preserves B's centring, since whatever is left over is then halved between the two sides. With no middle box the band is distributed between A and C directly, which is how §5.4's lone top-left box comes to be *"allowed to cross the center of the page box"*: nothing is generated on the other side to stop at.
 *
 * **`width: auto` only.** §5.3.2's *Handling min-width and max-width* re-runs the whole distribution up to twice more with the constraint substituted for the computed width, and its *"if only one box has `width: auto`"* branch needs a used width for a box that declares one. Neither is built; both are named on the checklist. A document declaring any of the three gets this answer.
 *
 * @returns the used outer widths of A, B and C.
 */
export function bandWidths({ a, b, c, available }: { a?: IntrinsicPair|null; b?: IntrinsicPair|null; c?: IntrinsicPair|null; available: number; }): [number,number,number] {
  const A = pair(a);
  const B = pair(b);
  const C = pair(c);
  const room = Math.max(0, available);
  if (!B.generated) {
    const [wa, wc] = distribute(A, C, room);
    return [wa, 0, wc];
  }
  const AC = { min: 2 * Math.max(A.min, C.min), max: 2 * Math.max(A.max, C.max) };
  const [wb] = distribute(B, AC, room);
  const used = Math.min(Math.max(0, wb), room);
  const side = (room - used) / 2;
  return [side, used, side];
}

/**
 * A margin box's own `text-align` and `vertical-align`, restated as the two properties its cell actually reads.
 *
 * The original is kept beside the translation rather than replaced by it: `text-align` still governs the text inside a box wide enough to hold more than one line of it, and dropping it would be this file deciding the author meant only one of the two things the property does. A value neither table names rides through untranslated — the browser ignores `vertical-align` on a flex container, which is a truthful outcome rather than a silent one.
 */
export function translateAlignment(decls: Decl[]): Decl[] {
  const out: Decl[] = [];
  for (const [prop, value, priority] of decls) {
    out.push([prop, value, priority]);
    const key = String(value).trim().toLowerCase();
    if (prop === 'text-align' && ALIGN_X[key]) out.push(['justify-content', ALIGN_X[key], priority]);
    if (prop === 'vertical-align' && ALIGN_Y[key]) out.push(['align-items', ALIGN_Y[key], priority]);
  }
  return out;
}
