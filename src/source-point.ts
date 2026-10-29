/**
 * The source point, both ways (*the engine names the source point*, 2026-10-13) — the character-level refinement of *the engine names the source*, which answers for elements only.
 *
 * `sourcePointOf` turns a DOM point in a presented copy into the same point in the adopted source; `pointShownBy` turns a source point into the point that shows it among the nodes one page presents. **Exact, never aligned**: the answer is what `word-space.js` recorded when the copy was registered and trimmed (`noteText`, `cutText`, `splitTextAt`), so a host does not pair text nodes by order — which a hollow box breaks, since it keeps its tag and loses the text node its source has — and does not recover offsets by comparing strings.
 *
 * **What a point is.** A Text node and a character offset, or an Element and a child index (DOM boundary-point semantics). A text point between two characters names the character after it, and a point at the end of a node the end of its last kept character, so the first kept character of a continuation is where offset 0 points. **An element point is structural**: the boundary before the same author's child in the source, skipping the engine's own marks (the Compositor's breaks and fillers, which shift the copy's child indices) and putting a split text's later pieces where they stand in the source's text. It claims nothing about what is shown.
 *
 * **`null` names a point in nothing the author wrote**: an engine mark, text the engine wrote (the hyphenation character), a node outside the root, a box put away (nothing is shown inside it, and a hollow one has no children to point into), a text node with none of its characters left. An original answers its own point, unchanged — it is the source.
 *
 * @packageDocumentation
 */

import { AWAY, BREAK, FILL, hasWord, SHELL } from './data-beltype.ts';
import { sourceOf, sourceTextPoint, textPointShowing, textRecord } from './word-space.ts';

export type Point = { node: Node, offset: number };

/** Is this one of the engine's own marks with no source — the Compositor's break and filler, the slice shell around a painted monolith? */
const isMark = (el: Element) => hasWord(el, SHELL) || hasWord(el, BREAK) || hasWord(el, FILL);

/** Is the element, or any ancestor up to and including `top`, a box the copy put away? */
function putAwayWithin(el: Element|null, top: Element|null) {
  for (let e = el; e; e = e === top ? null : e.parentElement) if (hasWord(e, AWAY)) return true;
  return false;
}

/** The index of a child among its parent's, by identity. */
const indexIn = (parent: Node, child: Node) => Array.prototype.indexOf.call(parent.childNodes, child);

/**
 * The source point of a DOM point inside a presented copy.
 *
 * @param root - the `<beltype-root>`.
 */
export function sourcePointOf(root: Element, node: Node, offset: number): Point|null {
  if (!node || node === root || !root.contains(node)) return null;
  const holder = node.nodeType === 1 ? (node as Element) : node.parentElement;
  let copy = false;
  for (let e = holder; e && e !== root; e = e.parentElement) {
    if (hasWord(e, AWAY)) return null; // nothing is shown inside a box the copy put away
    if (copy) continue;
    if (sourceOf(e)) copy = true;
    else if (isMark(e)) return null;
  }
  if (!copy) return { node, offset }; // an original
  if (node.nodeType === 3) return sourceTextPoint((node as Text), offset);
  const source = sourceOf((node as Element));
  if (!source) return null;
  const kids = node.childNodes;
  for (let i = Math.max(0, offset); i < kids.length; i++) {
    const kid = kids[i];
    if (kid.nodeType === 1) {
      const s = sourceOf((kid as Element));
      if (s) return { node: source, offset: indexIn(source, s) };
    } else if (kid.nodeType === 3) {
      const rec = textRecord((kid as Text));
      // A later piece of a split text begins inside its source text node: that is a text point, not a boundary between children.
      if (rec) return rec.first > 0 ? { node: rec.source, offset: rec.first } : { node: source, offset: indexIn(source, rec.source) };
    }
  }
  return { node: source, offset: source.childNodes.length };
}

/**
 * The point, among the nodes one page presents, that shows a source point: the original itself where the page presents the original, else the copy's point, else `null`.
 *
 * A text point shown at the end of one piece and the start of another (a page break, a break the Compositor wrote) is answered by the piece that shows it strictly, the first when neither does.
 *
 * @param nodes - what the page presents, in the light DOM: its assigned content, its fixed and running copies.
 * @param sourceNode - a node of the adopted source.
 */
export function pointShownBy(nodes: Iterable<Element>, sourceNode: Node, offset: number): Point|null {
  const isText = sourceNode.nodeType === 3;
  let best: (Point&{ strict: boolean; })|null = null;
  const offer = (p: Point&{ strict: boolean; }) => {
    if (!best || (p.strict && !best.strict)) best = p;
  };
  const visit = (a: Element) => {
    const origin = sourceOf(a);
    if (!origin) {
      if (isMark(a)) for (const k of a.children) visit(k); // a shell holds the copy
      else if (a === sourceNode || a.contains(sourceNode)) offer({ node: sourceNode, offset, strict: true }); // the page presents the original
      return;
    }
    if (origin !== sourceNode && !origin.contains(sourceNode)) return;
    if (isText) {
      const walker = a.ownerDocument.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const text = (t as Text);
        if (textRecord(text)?.source !== sourceNode) continue;
        const hit = textPointShowing(text, offset);
        if (hit && !putAwayWithin(text.parentElement, a)) offer({ node: text, offset: hit.offset, strict: hit.strict });
      }
      return;
    }
    for (const e of [a, ...a.querySelectorAll('*')]) {
      if (sourceOf(e) !== sourceNode || putAwayWithin(e, a)) continue;
      // The first child of the copy standing at or after the source's `offset`th child; the copy's marks have no source and are passed over.
      let at = e.childNodes.length;
      for (let i = 0; i < e.childNodes.length; i++) {
        const kid = e.childNodes[i];
        const s = kid.nodeType === 1 ? sourceOf((kid as Element)) : kid.nodeType === 3 ? textRecord((kid as Text))?.source : null;
        if (s && indexIn(sourceNode, s) >= offset) {
          at = i;
          break;
        }
      }
      offer({ node: e, offset: at, strict: true });
      return;
    }
  };
  for (const a of nodes) visit(a);
  return best ? { node: (best as Point).node, offset: (best as Point).offset } : null;
}
