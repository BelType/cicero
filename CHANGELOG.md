# Changelog

## Unreleased

- **A margin box's padding, border and margin reach its cell.** A box's own declarations went through the page host's filter, which withholds `margin-*`, `border-*` and `padding-*` because the Chase writes the page box's; `@top-left { vertical-align: bottom; padding-bottom: 5mm }` reached no cell and the running head sat on the content area (trattato, 13.6 pt off WeasyPrint). A cell's three are the box's own (`ownedOnCell`, `capture.ts`): only the `width` family and the grid seat stay the Chase's. `test/browser/margin-box-padding.browser.ts` is the red case. Codeberg issue 3.
- **An element's reset of the page counter counts on.** `counter-reset: page 1` on a chapter, or on each letter of a print run, left every page after it reading 1: the reset was delivered as an author counter to the flow and the margin cells, under the host's own `page N`, on every later page in its scope. The page counter is the host's, so the reset is folded into N (`pageNumberAt`, `document-state.ts`): the page the element begins on bears the value and the pages after count on from it, until the next reset. A `target-counter()` to a page reads the same N, so "Pagina 1/2" is 1/2 in the second letter too, where it read 1/4. Codeberg issues 1 and 2.
- **The root line-height provision is a floor again.** `:root { line-height: 1.65 }` in the head fragment has a specificity of (0,1,0) and beat an author's plain `html { font: 10pt/13.4pt … }` (0,0,1) silently: five of the six specimens printed at 1.65 instead of their declared leading (trattato 220 pages for 189). It is now `:where(:root)`, zero specificity: it still beats the browser's `normal` and loses to any author rule on the root. Codeberg issue 4.
- **A continuation of preserved text opens on the next line.** Consuming left the whitespace of every word cut away, which collapses under `white-space: normal` and under `pre`, `pre-wrap`, `pre-line` and `break-spaces` drew one empty line for each newline: a listing's second page opened on the first page's blank lines, and when they filled it the run refused with *entry position runs backward (I1)*. That whitespace now leaves the data where it is preserved, all but the indentation of the line the page opens on, and so does the whitespace after a fragment's last word. A blank line falling exactly at the head of a page goes with the cut, where Chromium keeps it (the essay's case of the blank line at the page head).
- **No break point stands in a repeated copy or beside it.** A table with a header whose first row under the copy did not fit took a place before where the page resumed, and the run refused the document with *entry position runs backward (I1)*. The row now divides under the copy, page for page with Chromium.
- **`@page` rules inside `@layer`, `@supports`, `@media` and imported sheets count** (`pageRulesOf`), and an unlayered rule beats a layered one whatever their order.
- **`cssString` escapes every control character**, so a carriage return or a form feed in a value cannot end the string.
- **Each measure context has its own container**, so two fills in flight do not measure in each other's.
- **The bands and the margin cells are `aria-hidden`.**
- `firstBelowTheEdge` is on the `fragmentation` face.

## 0.1.6 — 2026-11-04

- **`release()`**, a door on the handle for a host that replaces the document in the same window: the client's `loadingdone` listener, the rim, the late-truth batch, the root's window listeners, idle build and observer, and the facsimile's observer are all let go, and the handle leaves the window (Egildo's ruling of 2026-11-03, the kept page of beltype serve; SPEC.md XII.7). `specs/001-release/`.

## 0.1.5 — 2026-11-03

- **Common 0.1.2**, the version that carries `@beltype/common/flags`.
- **The page's content area is as wide as the container it was measured in.** The page grid gave the band between the margins as three thirds, and Chromium lays out in 1/64 px and drops the remainder of each track: 112 mm (423.307 px) became 423.28125 px on the page and 423.296875 px in the measure container. A justified line that fits the second by a hair wrapped on the first, so the cut counted one line where the page showed two, and a paragraph the page could not hold was placed whole, its last line below the page area (trattato page 111, 9.7 pt, the only page of 220; on screen the flow's clip hid it, in print Caster put it beside the folio). `bandTracks` (`margin-boxes.ts`) gives three whole 1/64 px tracks that sum to the floor of the band, and `Chase.applyConditions` writes them. `test/band-tracks.test.ts` is the red case. Articles 139 to 141 of the specimen alone reproduce it (Caster's tiling invariant refused the print: 46 characters left below the clip); a hanging `float: left` number on the list items is what made the line a hair too long, and turning the float off made the specimen's two lines fit.
- **A linked sheet the rewrite replaces keeps its addresses.** A `<link>` whose sheet the rewrite changes becomes a `<style>` of the new text, and a `<style>` resolves `url()` against the document: a font declared inside `@media print` in `css/` was asked for at the document's root, because opening the print block is a change (the tester's case, 2026-11-03), and under a named layer every linked sheet was exposed. `rebaseUrls` (`seam/rewrite.ts`) now writes each relative `url()` and `@import` string against the link's href, in place; `data:`, absolute and `#fragment` addresses stay as written. `test/rewrite.test.ts` holds the red case.

- **`ciceroFlags`**, the run-wide flags in `@beltype/common`'s shape, exported from the host face (`@beltype/cicero`). One flag: `composed`, default `false`. `run()` behaves as before; the client runs in a tab that cannot resolve `@beltype/common`, so it keeps the literal default and a test pins it to the table. The call-level options `until`, `resumeAt` and `layer` are not flags.
- **Two light subpaths**, `@beltype/cicero/engine` (`ciceroEngine`) and `@beltype/cicero/flags` (`ciceroFlags`), so a host that never rewrites sheets does not load css-tree through the host face (about 24 ms in node).

## 0.1.4 — 2026-10-30

- **`@beltype/common` comes from npm.** The dependency was a Codeberg git address over SSH, which only an installer with a Codeberg key could reach; it is now `0.1.1`, exact, from npmjs.com. No code change.
- **The release workflow**, `.github/workflows/release.yml`: a tag `vX.Y.Z` publishes to npm by trusted publishing, once the tag, `package.json` and this heading agree. `repository.url` names the GitHub mirror, as npm's provenance asks; `homepage` and `bugs` name Codeberg.

## 0.1.3 — 2026-10-29

- **The tests are type-checked.** `tsconfig.test.json` adds `test/` to the program and `npm run check` runs it: 1 076 errors read before, 0 now. The parameters are typed, the fake DOM objects are cast once each in `test/fakes.ts` (`fake`, `fakeElement`, `fakeText`, `fakeRect`, `fakeStyle`, `fakeDocument`, and `byShape` for engine entry points handed a fake and read by shape), and the possibly-null reads carry `!`. No assertion and no input value changed; the 389 tests pass as before. No code change under `src/` or `seam/`.

## 0.1.2 — 2026-10-29

- **A seventh face, `./rewrite`**: `seam/rewrite-document.ts`, `rewriteDocumentSheets` alone. The host face `.` also carries `ciceroEngine`, which imports node's `url`, so a page could reach the rewrite only by a path inside `dist/`. No code change. Ruled by Egildo on 2026-10-29.

## 0.1.1 — 2026-10-29

- **A sixth face, `./page`**: `src/chase.ts`, the `<beltype-page>` element, which a view imported as `./internal/chase`. Loading it defines the element once, as before; only its address is new. Ruled by Egildo on 2026-10-29: the element is public, so it does not live under the unstable face.

## 0.1.0 — 2026-10-29

- **Cicero leaves the BelType monorepo.** `src/` and `seam/` move from `packages/engine-cicero` of `github.com/egildo/beltype`, at `main` f48afcef with the seventeen files that lacked types typed in place first (branch `round/the-org-drill`), into this repository, as TypeScript. The port is mechanical: a codemod turned the JSDoc types into annotations, and each of the 36 emitted `.js` files reads the same as the `.js` it came from once both are minified with comments dropped. The code is unchanged.
- **Five faces** replace deep paths: `.` (the host), `./client`, `./facsimile`, `./fragmentation` (the 67 values and one type a view imported by path), and `./internal/*`, unstable. Nothing is un-exported.
- **The engine seam's contract** travels as `seam/engine.ts`, from BelType's `packages/common/src/engine.js`, which `@beltype/common` does not carry.
- **Tests**: the 29 engine suites run on `node:test` from `.ts` (382 tests), with two new ones: the pin between `@beltype/common`'s grammar and the engine's registry, and the layering test. BelType's decisions test stays there with the decision records.
