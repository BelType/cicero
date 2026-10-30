# Changelog

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
