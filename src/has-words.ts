/**
 * The `:has()` answers — which original elements satisfy which rewritten argument, computed once per run from the originals (*one attribute has words*, 2026-10-10; `.claude/plans/cicero-optimisation/data-beltype.md`, "Computing the words").
 *
 * A box outside a page's interval is presented as a hollow copy, an element with its tag and attributes and no children, and `:has()` cannot look inside nothing. The host rewrites every `:has(A)` into a union that also matches a `has:<h>` word (`data-beltype.js`), and this module is the engine's half: it reads the arguments back from the registry rule the rewriter appended, asks the real tree — the originals, in their real place, so `:has(+ p)` and `section:has(> h2)` answer as the author's document answers them — which elements satisfy each, and hands the answers to the clone registry (`word-space.js`), which writes them on the copies as they are made. The source is never written (*the source document is never written*, C5).
 *
 * **Answered where the tree is real.** `paginate` calls this before any copy exists, with the intake's top-level boxes: the document's own body children on a first run, the root's light children on a later one. A box is asked with `matches` (the box itself) and `querySelectorAll` (everything below it); a selector the browser refuses is skipped, the copy then fails to match it exactly as the browser would fail a rule it could not parse.
 *
 * **Kept per box across runs** (*a resumed run keeps its reads*, 2026-10-22): `askBox` is one top-level box's answers, and a memo the driver hands as `keep` returns them for a box no edit replaced. Below the box every answer is the box's own; the box's own answer to an argument opening with a sibling combinator is asked again every run, since the boxes after it decide it.
 *
 * **And remembered, so an edit can be told apart from a flip.** An argument can reach across blocks — `p:has(+ ul)` is true of a paragraph because of the list after it — so an edit in one block can change another block's words while its entry key stays equal. The answer keeps, per top-level box, which element got which words; the next run compares and the driver treats a box whose words moved as edited (`resume.js`' restart and the page it may not stop before).
 *
 * @packageDocumentation
 */

import { hasArgumentsOf } from './capture.ts';
import { hasWordFor } from './data-beltype.ts';
import { setSourceWords } from './word-space.ts';
import type { Keep } from './forcing-memo.ts';

/** The words each element of each top-level box got: box → (element → its words, joined). A box that got none has no entry. */
export type HasMarks = Map<Element, Map<Element, string>>;

/** One argument's answer for one top-level box: whether the box itself matches `:has(argument)`, and which elements below it do. */
export type Asked = { hash: string, selector: string, sideways: boolean, own: boolean, inner: Element[] };

/**
 * Ask one top-level box every argument: the box with `matches`, everything below it with `querySelectorAll`, in the arguments' order. A selector the browser refuses answers nothing.
 *
 * @param arguments_ - hash → the argument's text, `capture.js`' `hasArgumentsOf`.
 */
export function askBox(box: Element, arguments_: Map<string,string>): Asked[] {
  return [...arguments_].map(([hash, argument]) => {
    const selector = `:has(${argument})`;
    // An argument that opens with a sibling combinator reaches past the box when the box itself is the subject (`p:has(+ ul)` is true of a paragraph because of the list after it); below the box every sibling is inside it.
    const sideways = /(?:^|,)\s*[+~]/.test(argument);
    try {
      return { hash, selector, sideways, own: box.matches(selector), inner: [...box.querySelectorAll(selector)] };
    } catch {
      return { hash, selector, sideways, own: false, inner: [] }; // a selector this browser will not take answers nothing
    }
  });
}

/**
 * Compute the answers and seat them for the copies of this run.
 *
 * @param boxes - the intake's top-level boxes: blocks, fixed boxes, running elements.
 * @param keep - the memo's door (`forcing-memo.js`): a box's {@link askBox} answers are kept from an earlier run where the box was not forgotten since (*a resumed run keeps its reads*, 2026-10-22). Below the box every answer is the box's own; the box's own answer to an argument that opens with a sibling combinator depends on the boxes after it, and is asked again every run. Absent, every box is asked.
 */
export function answerHas(doc: Document, boxes: Iterable<Element>, keep: Keep|null = null): HasMarks {
  const words: WeakMap<Element,string[]> = new WeakMap<any, any>();
  const marks: HasMarks = new Map<any, any>();
  const arguments_ = hasArgumentsOf(doc);
  if (arguments_.size) {
    const hashes = [...arguments_.keys()];
    for (const box of new Set(boxes)) {
      let mine: Map<Element,string>|null = null;
      const note = ( el: Element,  word: string) => {
        const list = words.get(el);
        if (list?.includes(word)) return; // a fixed box nested in a block is asked twice
        if (list) list.push(word);
        else words.set(el, [word]);
        mine ??= new Map<any, any>();
        mine.set(el, `${mine.get(el) ?? ''} ${word}`.trim());
      };
      const read = () => askBox(box, arguments_);
      const asked = keep ? keep('has', box, read, ( kept: Asked[]) => kept.length === hashes.length && kept.every((a, i) => a.hash === hashes[i])) : read();
      for (const a of asked) {
        if (keep && a.sideways) {
          try { a.own = box.matches(a.selector); } catch { a.own = false; }
        }
        if (a.own) note(box, hasWordFor(a.hash));
        for (const el of a.inner) note(el, hasWordFor(a.hash));
      }
      if (mine) marks.set(box, mine);
    }
  }
  setSourceWords(words);
  return marks;
}

/**
 * The boxes whose words differ between two runs' answers — an element that gained a word, lost one, or is new.
 *
 * @param before - the prior run's; absent, nothing is known and nothing is reported.
 */
export function boxesWhoseWordsMoved(before: HasMarks|null|undefined, after: HasMarks, boxes: Iterable<Element>): Element[] {
  if (!before) return [];
  return [...new Set(boxes)].filter((box) => {
    const a = before.get(box);
    const b = after.get(box);
    if (!a && !b) return false;
    if (!a || !b || a.size !== b.size) return true;
    for (const [el, text] of b) if (a.get(el) !== text) return true;
    return false;
  });
}
