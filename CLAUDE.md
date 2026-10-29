# Working on Cicero

`@beltype/cicero`: a paged-media engine for the live browser. This file is the working method; it is not a substitute for the documents below.

## The document hierarchy — read in this order

1. **`SPEC.md`** — the product constitution. Normative for every semantic question; each normative sentence cites the decision record that owns it, by name.
2. **`.specify/memory/constitution.md`** — the engineering constitution, its standing exceptions at 0.1.0 among it.
3. **`specs/NNN-*/`** — per-change spec, plan and tasks (Spec Kit, `.claude/skills/speckit-*`).

The decision records still live in BelType (`.claude/decisions/cicero/`); the battery still lives in BelType's essay venue, which mounts this package's `dist/`.

## Non-negotiables

- `src/` imports nothing outside `src/`, and loads in node with no DOM except the two custom elements (`chase.ts`, `root.ts`) and what imports them. `test/layering.test.ts` enforces it.
- The engine names no consumer: no file under `src/` or `seam/` says `prosemirror` (`test/the-engine-knows-no-view.test.ts`).
- TypeScript `strict` + `erasableSyntaxOnly`; relative imports name `./x.ts`. Node runs the sources directly.
- `node:test`, no framework, no network.
- A mechanical change is proven by zero diff: each emitted `.js` against the `.js` before, both minified with comments dropped.
- TSDoc carries the prose, annotations carry the types; never a type restated in prose.

## Run & verify

```bash
pnpm run check   # keep green
pnpm test        # keep green
pnpm run build   # dist/, also run by prepare; seam/facsimile.js is emitted by a second pass (tsconfig.facsimile.json says why)
```
