# Changelog

## 0.1.2 — 2026-10-29

- **A seventh face, `./rewrite`**: `seam/rewrite-document.ts`, `rewriteDocumentSheets` alone. The host face `.` also carries `ciceroEngine`, which imports node's `url`, so a page could reach the rewrite only by a path inside `dist/`. No code change. Ruled by Egildo on 2026-10-29.

## 0.1.1 — 2026-10-29

- **A sixth face, `./page`**: `src/chase.ts`, the `<beltype-page>` element, which a view imported as `./internal/chase`. Loading it defines the element once, as before; only its address is new. Ruled by Egildo on 2026-10-29: the element is public, so it does not live under the unstable face.

## 0.1.0 — 2026-10-29

- **Cicero leaves the BelType monorepo.** `src/` and `seam/` move from `packages/engine-cicero` of `github.com/egildo/beltype`, at `main` f48afcef with the seventeen files that lacked types typed in place first (branch `round/the-org-drill`), into this repository, as TypeScript. The port is mechanical: a codemod turned the JSDoc types into annotations, and each of the 36 emitted `.js` files reads the same as the `.js` it came from once both are minified with comments dropped. The code is unchanged.
- **Five faces** replace deep paths: `.` (the host), `./client`, `./facsimile`, `./fragmentation` (the 67 values and one type a view imported by path), and `./internal/*`, unstable. Nothing is un-exported.
- **The engine seam's contract** travels as `seam/engine.ts`, from BelType's `packages/common/src/engine.js`, which `@beltype/common` does not carry.
- **Tests**: the 29 engine suites run on `node:test` from `.ts` (382 tests), with two new ones: the pin between `@beltype/common`'s grammar and the engine's registry, and the layering test. BelType's decisions test stays there with the decision records.
