/**
 * css-tree's narrow subpaths, which `@types/css-tree` does not declare. `packages/core/src/closure.js`, `packages/editing-tools/assets/css-provenance.js` and `packages/engine-cicero/seam/csstree.js` import `css-tree/parser` and `css-tree/walker` rather than the main entry ON PURPOSE — the main entry reaches `lib/version.js`, which imports `createRequire` from `node:module` and so cannot load in a tab (the reasoning is in `engine-cicero/seam/csstree.js`'s header). Each subpath's default export is the main entry's named one.
 *
 * REACHED BY A REFERENCE DIRECTIVE IN THE IMPORTING FILE, never by a jsconfig `include`: `/// <reference path="…/types/css-tree-subpaths.d.ts" />` under the file's `// @ts-check`. A checked file is checked in EVERY program that reaches it — core's, the CLI's, the editing tools', the root suite's — so a stub one jsconfig includes is a stub the other programs do not have, and the file would be clean in its own package and an error in its consumers'. The directive is a comment, travels with the file, and reads `same` under `scripts/zero-diff.sh` (measured 2026-09-21).
 */

declare module 'css-tree/parser' {
  import { parse } from 'css-tree';
  export default parse;
}

declare module 'css-tree/walker' {
  import { walk } from 'css-tree';
  export default walk;
}
