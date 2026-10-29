/// <reference path="../types/css-tree-subpaths.d.ts" />
/**
 * css-tree, reached by one specifier the rewriter can write once.
 *
 * `seam/rewrite.js` runs in four places — Node's own test suite, BelType's dev server, the essay's venue, and the editing tools' tab — and only two of them can resolve a bare package name. So the import is relative, and each host answers the same name with the file it has:
 *
 * - **Node** resolves this file, which re-exports the installed package. `packages/engine-cicero/package.json` declares the dependency.
 * - **BelType's dev server** publishes css-tree's browser ESM bundle at this path, `_beltype/cicero/seam/csstree.js` (`seam/index.js`'s `vendorAssets`). The one entry in that table that is not the file of its own name.
 * - **The essay's venue** does the same for `/seam/csstree.js` (`lib/venue.js`).
 * - **The editing tools' tab** serves this file and resolves the subpaths below through its own import map, which already carries the package for `css-provenance.js`.
 *
 * **The three narrow subpaths are load-bearing, not tidiness.** css-tree's main entry reaches `lib/version.js`, which imports `createRequire` from `node:module` to read its own `package.json` — so `export * from 'css-tree'` resolves perfectly in Node and throws *Failed to resolve module specifier "module"* in a browser. Measured in the editing tools' tab, where the rewriter loaded as `null` and one console line said a named string would not reach the preview. `css-tree/parser` was already the door `css-provenance.js` went through for the same reason; this file goes through the same one, once more — and the generator is not re-exported at all, because it reaches `source-map-js`, a CommonJS package no browser can consume; the rewriter reads the author's own bytes by offset instead, which is what it does everywhere else.
 *
 * @packageDocumentation
 */

export { default as parse } from 'css-tree/parser';
export { default as walk } from 'css-tree/walker';

