# Spec 002: body image

**Why.** Since 0.1.14 the intake refuses an `<img>` standing directly in the body, because the engine drew it on no page wherever a page ended at it. Gotenberg's invoice opens its body with its logo, and is refused: a paginator that cannot print a logo at the top of an invoice is refusing ordinary HTML.

**Ruling.** Egildo's ruling of 2026-11-16: "let's fix the img refusal. Makes no sense and blocks a specimen". The record, *an-atom-in-the-body-is-a-line-of-the-body*, is owed in `codeberg.org/BelType/decisions`; it narrows *bare-body-content-is-refused-by-name*.

**Requirements** (SPEC.md Article II.1.8)
1. An inline-level box holding atoms and no word, standing directly in the body, is taken: an atom (a replaced element, an SVG or MathML element, an `inline-block`, `inline-flex`, `inline-grid` or `inline-table` box), or an inline box whose displayed content is such boxes and line breaks alone (a `<picture>`, an `<a>` around an image).
2. A run of such boxes, line breaks among them, is the line of its anonymous block box (CSS 2.1 §9.2.1.1): one unit of the flow, drawn on exactly one page, held whole where its line fits and moved whole where it does not, as a monolith is (css-break-3 §4.1). The page holds the line, from the margin edge of the block before it to the margin edge of the block after it, and not only the image.
3. A run taller than a page is treated as the same box as a block is: moved to a page of its own and sliced by its edge.
4. Still refused, by name: text, an inline-level box holding a word, a `display: contents` box. The message says what is refused and why.
5. No element is added to the document: every selector the author wrote matches what it matched.

**Out of scope.** The teaching round: a run holding words, whose lines a page may end between. A float inside a run of atoms, which ends the run here.
