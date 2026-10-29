/// <reference lib="dom" />
/**
 * THE PRESENTERS — a host's say over what a COPY of an element is (*a copy may be presented*, 2026-10-14; `.claude/decisions/cicero/a-copy-may-be-presented.md`).
 *
 * Cicero shows the original where it can and a COPY where it must, and a copy is made by `cloneNode`, which copies a tree and nothing that is not in it: the pixels of a `<canvas>`, the page an `<object>` embeds, the drawing a script made. Such an element is presented blank on every page that shows a copy of it, and the box is the right size, so nothing says so. A host that knows how to draw the element says so here: it registers a SELECTOR and a function that makes the element a copy stands in for, and every copy Cicero makes of a matching element is that element instead — the measuring copies and the hollow shells included, because a measurement must see the box a page will show.
 *
 * **The module holds the registry and the questions asked of it, and nothing else.** The swap itself is `word-space.js`'s (`copyOf`, `copyTree`, `shellOf`), the one point every copy passes through; the decision whether a block may be shown as its original is `root.js`'s, which asks {@link holdsPresented}. No DOM is written here, and nothing outward is imported.
 *
 * @packageDocumentation
 */

export type Presenter = {
  /** a CSS selector, tested against the SOURCE element with `matches`. */
  selector: string;
  /** returns ONE element, synchronously, that a copy of `source` is replaced by. */
  make: (source: Element) => Element;
};

let presenters: Presenter[] = [];

/**
 * Register a presenter. Registration must precede the first run; one after it is a change of conditions of every copy, and the seam's next run is a whole run (`seam/client.js`, `conditionsKey`).
 *
 * @remarks
 * **`make` runs often and must be cheap.** It is called for every copy of every matching element — each page that shows one, each hollow shell, each of the Compositor's measuring copies and `reads.js`'s — so an element that costs something to prepare defers the work to its own `connectedCallback` and draws from a cache. It must not return the same element twice (an element sits in one place) and must not return the source. The first presenter whose selector matches wins.
 *
 * The element carries the `data-beltype` words the source earned and is registered against the source (`sourceOf`), and the walk does not descend into it: its children are the presenter's, never the source's.
 */
export function present(selector: string, make: (source: Element) => Element) {
  if (typeof selector !== 'string' || !selector) throw new TypeError('present(selector, make): the selector must be a non-empty CSS selector string');
  if (typeof make !== 'function') throw new TypeError('present(selector, make): make must be a function returning one element');
  presenters.push({ selector, make });
}

/** How many presenters are registered — the number the seam's conditions key reads, so that a registration after a run is seen as the change it is. */
export const presenterCount = () => presenters.length;

/** Forget every registration. For a venue test that registers in a page it reuses; a host has no use for it. */
export function clearPresenters() {
  presenters = [];
}

/** The element a copy of `source` is replaced by, or `null` when no presenter matches it. */
export function presentation(source: Element): Element|null {
  for (const p of presenters) {
    if (!source.matches(p.selector)) continue;
    const made = p.make(source);
    if (!made || made.nodeType !== 1 || made === source) throw new TypeError(`present("${p.selector}"): make must return one new element, and returned ${made ? `<${made.localName}>` : String(made)} for <${source.localName}>`);
    return made;
  }
  return null;
}

/** Does this element hold a presented one — is it one, or does one stand anywhere inside it? The question `root.js` asks to know whether a block may be shown as its original (which would show the source's own element) or must be shown through a copy. */
export function holdsPresented(el: Element) {
  return presenters.some((p) => el.matches(p.selector) || el.querySelector(p.selector) !== null);
}
