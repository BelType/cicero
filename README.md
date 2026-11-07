# @beltype/cicero

Cicero is a paged-media engine for the live browser. It cuts a document into pages under CSS Paged Media (`@page`, margin boxes, running elements, named strings, counters, fragmentation) and presents them as real `<beltype-page>` frames, editable and re-cut in place. Beta.

`SPEC.md` is what it does; `.specify/memory/constitution.md` is how it is worked on.

## Faces

| Import | What |
| --- | --- |
| `@beltype/cicero` | The host face: `ciceroEngine` (BelType's engine seam) and `rewriteDocumentSheets`. |
| `@beltype/cicero/engine` | `ciceroEngine` alone, without the sheet rewriter and its css-tree: a host that only serves a page (BelType's CLI) loads this. |
| `@beltype/cicero/flags` | `ciceroFlags` alone, the run-wide flags in common's shape. |
| `@beltype/cicero/rewrite` | `rewriteDocumentSheets` alone, for a page: the host face also carries `ciceroEngine`, which imports node's `url` and so cannot load in a browser. |
| `@beltype/cicero/client` | The page side: loading it sets `window.__beltypeCicero`, typed in `seam/handle.d.ts`. |
| `@beltype/cicero/facsimile` | The embedded PDF page (`<object type="application/pdf">`). |
| `@beltype/cicero/fragmentation` | The members a view adapter builds on, re-exported unchanged, listed in `SPEC.md` XIII.3: among them the leading-decoration door (`WRAPPED`, `clonesDecoration`, `truncateLeadingDecoration`) and `firstBelowTheEdge`. |
| `@beltype/cicero/rim` | The rim, `seam/rim.js` itself (`SPEC.md` XIII.4): `watchLateTruth`, `bringsNewFace`, `knowLoadedFaces`, for a view that hears late truth on pages it holds, sharing the client's record of the faces already announced. |
| `@beltype/cicero/page` | The `<beltype-page>` element: loading it defines the element once. Needs a DOM, so it is not in `./fragmentation`, which loads in node. |
| `@beltype/cicero/internal/*` | Every module of `src/` (not `seam/`), for BelType's essay venue. **Unstable**: no promise across versions. |

Published to npm, with provenance:

```json
"@beltype/cicero": "0.1.9"
```

A git dependency on a tag still works, since `prepare` builds `dist/`.

## Working on it

```bash
pnpm install
pnpm run check   # tsc over src and seam, strict
pnpm test        # node:test, the .ts tests run directly
pnpm run build   # dist/
```

The battery is the essay, its own repository, `codeberg.org/BelType/essay`: `pnpm run prove` and `node src/cli.ts reftest` there, with this checkout linked in. The suites run against `dist/`, so `pnpm run build` first.

MIT.
